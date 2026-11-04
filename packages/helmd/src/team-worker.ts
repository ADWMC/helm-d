// Local worker-session adapter for the team protocol.
//
// The protocol/state layer lives in team.ts; this module turns one ticket role
// into a real DSH child Agent through ctx.subagents (the host's in-process
// spawn provider). The prompt is assembled from the revisions pinned to the
// ticket, so an evolution activation never changes a running ticket.
//
// No network and no external service: the child runs in the same DSH profile
// and workspace as its parent. If the host has no subagent provider, callers
// get a clear error instead of a silent no-op.

import type { Context } from '@deepseek-ai/cordis'
import { basename } from 'node:path'
import { bindCase } from './case.js'
import {
  activeRevision, assignRole, claimTask, completeTask, getTicket, listRevisions, pinArtifactRevisions,
  recordReport, type ArtifactKind, type ReportState, type TeamReport, type TeamRole,
} from './team.js'
import { loadSettings } from './settings.js'

const ARTIFACT_KINDS: ArtifactKind[] = ['role-prompt', 'playbook', 'skill', 'model-profile', 'budget-policy', 'tool-policy']
const MAX_WALL_TIME_MS = 60 * 60 * 1000

/** Default budget follows the operator settings (minutes), clamped to the
 *  hard ceiling; the budget-policy artifact still overrides per ticket. */
function defaultWallTimeMs(): number {
  try {
    return Math.min(MAX_WALL_TIME_MS, loadSettings().team.defaultWallTimeMin * 60 * 1000)
  } catch {
    return 15 * 60 * 1000
  }
}
const DEFAULT_ROLE_PROMPTS: Record<TeamRole, string> = {
  orchestrator: [
    'You are the orchestrator. Decompose the goal, dispatch role workers, and merge their reports.',
    'Do not read raw sample bytes or canary-like content; work from evidence ids and worker summaries.',
    'A worker result is evidence only after its E-ids and repro are checked. Never invent a result.',
  ].join('\n'),
  triage: [
    'You are the triage worker. Identify file type, architecture, packing/obfuscation, imports, strings, and risk surface.',
    'Record the minimum facts needed to choose a route and a budget. Do not claim dynamic behavior you did not observe.',
  ].join('\n'),
  static: [
    'You are the static-analysis worker. Recover structure, strings, imports, call chains, and configuration.',
    'Cite concrete evidence (E-ids, offsets, function names). A string alone is not a call chain.',
  ].join('\n'),
  dynamic: [
    'You are the dynamic-analysis worker. Execute only inside the provided case workspace or an explicitly isolated sandbox.',
    'Capture observable behavior, traces, and dumps. Never execute untrusted samples outside the sandbox.',
  ].join('\n'),
  'decoy-audit': [
    'You are the decoy-audit worker. Look for canaries, fake architecture, dead code, impossible capability claims, and budget anomalies.',
    'Canary values must never enter a finding or a report excerpt. Report their existence, not their value.',
  ].join('\n'),
  critic: [
    'You are the critic. Verify every finding against the evidence ledger, repro command, and a second source when possible.',
    'You may veto a finding. State exactly which evidence is missing; do not fill gaps with speculation.',
  ].join('\n'),
  reporter: [
    'You are the reporter. Merge accepted findings into a concise report with confidence, evidence ids, and residual risk.',
    'Do not add new conclusions; if the material is incomplete, report the gap explicitly.',
  ].join('\n'),
}

export interface WorkerReport {
  state: ReportState
  summary: string
  evidenceIds: string[]
  repro?: string
  stopReason?: string
}

export interface TeamSubagentProvider {
  readonly name: string
  readonly capabilities?: {
    readonly agentOptions?: boolean
  }
}

export interface TeamActivation {
  readonly childId: string
  readonly result: Promise<{ output?: unknown; stopReason?: string; diagnostic?: string }>
  dispose?(): Promise<void>
}

export interface TeamActivationSpec {
  readonly provider: string
  readonly label: string
  readonly request: {
    readonly parent: unknown
    readonly prompt: Array<{ type: 'text'; text: string }>
    readonly cwd?: string
    readonly agentOptions?: {
      provider?: string
      model?: string
      reasoningEffort?: string
      maxTokens?: number
    }
  }
  readonly signal: AbortSignal
  readonly delivery: 'caller' | 'parent'
}

export interface TeamSubagentRuntime {
  getProvider(name: string): TeamSubagentProvider | undefined
  startActivation(spec: TeamActivationSpec): Promise<TeamActivation>
  /** Host-native mid-turn steer (dsh-subagent manager). Optional: old hosts
   *  only expose startActivation, and team_steer reports that clearly. */
  steerPrompt?(
    parent: unknown,
    childId: string,
    content: Array<{ type: 'text'; text: string }>,
    source: unknown,
    signal: AbortSignal,
  ): Promise<unknown>
}

export interface TeamAgentRegistry {
  get(id: string): unknown
}

/** Services are resolved dynamically: the web/health layer only declares
 *  webServer+tools, and the agent layer may run on a host build without the
 *  subagent seam. Missing services become a readable error at call time. */
function service<T>(ctx: Context | undefined, name: string): T | undefined {
  if (ctx === undefined) return undefined
  try {
    const get = (ctx as unknown as { get?: (key: string) => unknown }).get
    const value = typeof get === 'function' ? get.call(ctx, name) : undefined
    return (value ?? undefined) as T | undefined
  } catch {
    return undefined
  }
}

function resolveRuntime(input: StartWorkerInput): {
  agents: TeamAgentRegistry | undefined
  subagents: TeamSubagentRuntime | undefined
} {
  if (input.runtime !== undefined) {
    return { agents: input.runtime.agents, subagents: input.runtime.subagents }
  }
  return {
    agents: service<TeamAgentRegistry>(input.ctx, 'agents'),
    subagents: service<TeamSubagentRuntime>(input.ctx, 'subagents'),
  }
}

function textOf(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value.map((part) => {
      if (typeof part === 'string') return part
      if (part !== null && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string') {
        return (part as { text: string }).text
      }
      return ''
    }).join('\n').trim()
  }
  return ''
}

function parseJsonObject(text: string): Record<string, unknown> | undefined {
  const candidates = [text.trim()]
  for (const match of text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) candidates.push(match[1].trim())
  for (const candidate of candidates) {
    if (!candidate.startsWith('{')) continue
    try {
      const parsed: unknown = JSON.parse(candidate)
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch { /* not JSON; keep the text report */ }
  }
  return undefined
}

/** Convert a child's final output into the ticket report contract. JSON is
 *  optional; a plain text report still gets evidence ids and a state. */
export function extractWorkerReport(output: unknown, stopReason?: string): WorkerReport {
  const text = textOf(output)
  const parsed = parseJsonObject(text)
  const rawState = typeof parsed?.state === 'string' ? parsed.state : ''
  const state: ReportState = stopReason !== undefined && stopReason !== 'completed'
    ? 'failed'
    : rawState === 'blocked' || rawState === 'failed' || rawState === 'dropped'
      ? rawState
      : /\bBLOCKED\b/i.test(text)
        ? 'blocked'
        : 'ready'
  const summary = typeof parsed?.summary === 'string' && parsed.summary.trim() !== ''
    ? parsed.summary.trim()
    : text.trim()
  const evidenceIds = Array.isArray(parsed?.evidenceIds)
    ? parsed.evidenceIds.map(String).filter((id) => /^E-\d+$/i.test(id))
    : [...new Set(text.match(/\bE-\d+\b/gi) ?? [])]
  const repro = typeof parsed?.repro === 'string' && parsed.repro.trim() !== '' ? parsed.repro.trim() : undefined
  return {
    state,
    summary: summary === '' ? `worker ended with ${stopReason ?? 'no output'}` : summary.slice(0, 4000),
    evidenceIds: [...new Set(evidenceIds)],
    ...(repro !== undefined ? { repro } : {}),
    ...(stopReason !== undefined ? { stopReason } : {}),
  }
}

/** T-05 finish gate: a "ready" report with no evidence and no substantive
 *  summary is not a result; budget/stop-reason exhaustion becomes blocked,
 *  never a normal completion. Exported for the unit check. */
export function applyFinishGate(report: WorkerReport, elapsedMs: number, budgetMs: number): WorkerReport {
  const summary = report.summary.trim()
  const exhausted = report.stopReason !== undefined
    && (/max.*token|length|budget|abort/i.test(report.stopReason) || elapsedMs >= budgetMs * 0.95)
  if (exhausted) {
    return {
      ...report,
      state: 'blocked',
      summary: `budget/stop reason exhausted (${report.stopReason}, ${Math.round(elapsedMs / 1000)}s/${Math.round(budgetMs / 1000)}s): ${summary}`.slice(0, 4000),
    }
  }
  if (report.state === 'ready' && report.evidenceIds.length === 0 && (summary.length < 20 || /^(done|ok|ready|完成|好的)$/i.test(summary))) {
    return {
      ...report,
      state: 'blocked',
      summary: 'finish gate: ready report has no substantive summary or evidence id',
    }
  }
  return report
}

function revisionAt(kind: ArtifactKind, id: string, revision: number) {
  if (revision <= 0) return undefined
  return listRevisions(kind, id).find((item) => item.revision === revision)
}

function artifactValue(ticketRevisions: Record<string, number>, kind: ArtifactKind, id: string): string | undefined {
  const pinned = ticketRevisions[`${kind}:${id}`]
  const artifact = pinned !== undefined ? revisionAt(kind, id, pinned) : activeRevision(kind, id)
  return artifact?.value
}

export interface StartWorkerInput {
  ctx?: Context
  runtime?: {
    agents?: TeamAgentRegistry
    subagents?: TeamSubagentRuntime
  }
  ticketId: string
  role: TeamRole
  task?: string
  parentAgent?: unknown
  parentSessionId?: string
  signal?: AbortSignal
  /** Notify the parent model when the child settles (default) or keep the
   *  result local to the ticket reporter. */
  delivery?: 'parent' | 'caller'
}

export interface StartedWorker {
  ticketId: string
  role: TeamRole
  sessionId: string
  completion: Promise<TeamReport | undefined>
}

/** Build the worker prompt from the ticket's pinned revisions. */
export function renderWorkerPrompt(input: {
  ticketId: string
  role: TeamRole
  goal: string
  caseDir: string
  task?: string
  revisions: Record<string, number>
}): string {
  const rolePrompt = artifactValue(input.revisions, 'role-prompt', input.role)
    ?? artifactValue(input.revisions, 'role-prompt', 'common')
    ?? DEFAULT_ROLE_PROMPTS[input.role]
  const playbook = artifactValue(input.revisions, 'playbook', input.role)
    ?? artifactValue(input.revisions, 'playbook', 'common')
  const skill = artifactValue(input.revisions, 'skill', input.role)
    ?? artifactValue(input.revisions, 'skill', 'common')
  const model = artifactValue(input.revisions, 'model-profile', input.role)
  const budget = artifactValue(input.revisions, 'budget-policy', input.role)
    ?? artifactValue(input.revisions, 'budget-policy', 'common')
  const toolPolicy = artifactValue(input.revisions, 'tool-policy', input.role)
    ?? artifactValue(input.revisions, 'tool-policy', 'common')
  const sections = [
    `[helm-d team] ticket=${input.ticketId} role=${input.role}`,
    `case=${input.caseDir}`,
    `goal=${input.goal}`,
    input.task !== undefined && input.task.trim() !== '' ? `task=${input.task.trim()}` : '',
    '',
    '## role',
    rolePrompt,
    playbook !== undefined ? `\n## playbook\n${playbook}` : '',
    skill !== undefined ? `\n## skill\n${skill}` : '',
    model !== undefined ? `\n## model profile\n${model}` : '',
    budget !== undefined ? `\n## budget policy\n${budget}` : '',
    toolPolicy !== undefined ? `\n## tool policy\n${toolPolicy}` : '',
    '',
    '## workflow (mandatory order)',
    '1. `case_status()` first — the autonomy packet gives the goal, hypotheses, matched playbook and next action.',
    '2. `route_task(goal)` — then `read_reference(<matched refs>)` the routed references BEFORE claiming anything. Domain knowledge lives in references; do not guess from memory.',
    '3. Prefer domain tools over raw shell one-liners. Every tool output auto-persists into evidence/ — cite those E-ids in any claim.',
    '3b. Large output (>256KB) is stored in evidence and shown as head/tail only; read the E-file instead of pasting it into context.',
    '4. Guesses go through `record_hypothesis`; conclusions through `record_finding` (repro_cmd required, and always pass severity; critical/high need >= 2 evidence ids). No evidence, no claim.',
    '5. Finish with the JSON report block below. state=blocked with the exact missing input when something is missing — never fabricate evidence or repro.',
    '',
    '## rules',
    '- Work only on this ticket and this case directory. Cite evidence ids for every factual claim.',
    '- Do not invent a repro command or a finding. If blocked, report state=blocked and the exact missing input.',
    '- Do not call begin_case, end_case, or team_dispatch; the orchestrator owns those.',
    '- When finished, put a final report in one JSON block:',
    '  {"state":"ready|blocked|failed","summary":"...","evidenceIds":["E-001"],"repro":"command"}',
    '- Canary values never belong in the summary; report only that a canary exists.',
  ].filter((line) => line !== '')
  return sections.join('\n').slice(0, 24000)
}

function parseModelProfile(value: string | undefined): TeamActivationSpec['request']['agentOptions'] {
  if (value === undefined) return undefined
  try {
    const parsed: unknown = JSON.parse(value)
    if (parsed === null || typeof parsed !== 'object') return undefined
    const raw = parsed as Record<string, unknown>
    const provider = typeof raw.provider === 'string' && raw.provider.trim() !== '' ? raw.provider.trim() : undefined
    const model = typeof raw.model === 'string' && raw.model.trim() !== '' ? raw.model.trim() : undefined
    if (provider === undefined && model === undefined) return undefined
    if (provider === undefined || model === undefined) throw new Error('model-profile must supply provider and model together')
    return {
      provider,
      model,
      ...(typeof raw.reasoningEffort === 'string' && raw.reasoningEffort.trim() !== ''
        ? { reasoningEffort: raw.reasoningEffort.trim() }
        : {}),
      ...(typeof raw.maxTokens === 'number' && Number.isFinite(raw.maxTokens)
        ? { maxTokens: Math.max(1, Math.trunc(raw.maxTokens)) }
        : {}),
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('provider and model')) throw error
    return undefined
  }
}

function parseBudget(value: string | undefined): number {
  if (value === undefined) return defaultWallTimeMs()
  try {
    const parsed: unknown = JSON.parse(value)
    if (parsed !== null && typeof parsed === 'object' && typeof (parsed as { wallTimeMs?: unknown }).wallTimeMs === 'number') {
      return Math.max(1000, Math.min(MAX_WALL_TIME_MS, (parsed as { wallTimeMs: number }).wallTimeMs))
    }
  } catch { /* plain text budget falls back to the default */ }
  return defaultWallTimeMs()
}

/** Start one local child Agent for a ticket role. The returned completion is
 *  recorded as a report even when the child fails, so the ticket never hangs
 *  in `running` without an auditable outcome. */
export async function startTeamWorker(input: StartWorkerInput): Promise<StartedWorker> {
  const ticket = getTicket(input.ticketId)
  if (ticket === undefined) throw new Error(`unknown ticket ${input.ticketId}`)
  if (ticket.state === 'done' || ticket.state === 'dropped') throw new Error(`ticket ${ticket.id} is ${ticket.state}`)
  const assignment = ticket.roles.find((role) => role.role === input.role)
  if (assignment === undefined) throw new Error(`role ${input.role} is not part of ticket ${ticket.id}`)
  if (assignment.state === 'running') throw new Error(`role ${input.role} is already running in ticket ${ticket.id}`)
  const running = ticket.roles.filter((role) => role.state === 'running').length
  const maxParallel = loadSettings().team.maxParallelWorkers
  if (running >= maxParallel) {
    throw new Error(`team concurrency limit reached: ${running}/${maxParallel} workers already running in ticket ${ticket.id}`)
  }
  // DAG gate: every listed prerequisite role must have finished (assignment
  // done) before this role may start. Unknown deps are ignored defensively.
  const unmet = (ticket.roleDeps?.[input.role] ?? []).filter((dep) => {
    const assignment = ticket.roles.find((role) => role.role === dep)
    return assignment !== undefined && assignment.state !== 'done'
  })
  if (unmet.length > 0) {
    throw new Error(`role ${input.role} waits for: ${unmet.join(', ')} (finish or team_report them done first)`)
  }

  const { agents, subagents } = resolveRuntime(input)
  if (subagents === undefined) throw new Error('host subagent service is unavailable; cannot start a local worker')
  const provider = subagents.getProvider('spawn') ?? subagents.getProvider('fork')
  if (provider === undefined) throw new Error('host has no spawn/fork subagent provider; cannot start a local worker')
  const parent = input.parentAgent ?? (input.parentSessionId !== undefined ? agents?.get(input.parentSessionId) : undefined)
  if (parent === undefined) throw new Error('parent session is not live; start the worker from a live helmd session')

  const active: Record<string, number> = {}
  for (const kind of ARTIFACT_KINDS) {
    for (const id of [input.role, 'common']) {
      const rev = activeRevision(kind, id)
      if (rev !== undefined) active[`${kind}:${id}`] = rev.revision
    }
  }
  pinArtifactRevisions(ticket.id, active)
  const pinned = getTicket(ticket.id)?.artifactRevisions ?? active
  const budget = Math.min(
    MAX_WALL_TIME_MS,
    ticket.budget?.wallTimeMs ?? parseBudget(artifactValue(pinned, 'budget-policy', input.role) ?? artifactValue(pinned, 'budget-policy', 'common')),
  )
  const agentOptions = parseModelProfile(
    artifactValue(pinned, 'model-profile', input.role) ?? artifactValue(pinned, 'model-profile', 'common'),
  )
  if (agentOptions !== undefined && provider.capabilities?.agentOptions === false) {
    throw new Error(`subagent provider ${provider.name} does not support model-profile agentOptions`)
  }
  const prompt = renderWorkerPrompt({
    ticketId: ticket.id,
    role: input.role,
    goal: ticket.goal,
    caseDir: ticket.caseDir,
    task: input.task,
    revisions: pinned,
  })

  const controller = new AbortController()
  if (input.signal?.aborted === true) controller.abort()
  const forwardAbort = () => controller.abort()
  input.signal?.addEventListener('abort', forwardAbort, { once: true })
  const timer = setTimeout(() => controller.abort(), budget)
  timer.unref?.()
  const startedAt = Date.now()

  let activation: TeamActivation
  let claimed = false
  try {
    if ((ticket.tasks ?? []).length > 0) {
      claimTask(ticket.id, input.role, budget)
      claimed = true
    }
    activation = await subagents.startActivation({
      provider: provider.name,
      label: `${ticket.id}/${input.role}`,
      request: {
        parent,
        prompt: [{ type: 'text', text: prompt }],
        cwd: ticket.caseDir,
        ...(agentOptions !== undefined ? { agentOptions } : {}),
      },
      signal: controller.signal,
      delivery: input.delivery ?? 'parent',
    })
  } catch (error) {
    clearTimeout(timer)
    input.signal?.removeEventListener('abort', forwardAbort)
    if (claimed) {
      try { completeTask(ticket.id, input.role, 'blocked') } catch { /* no lease left */ }
    }
    throw error
  }

  assignRole(ticket.id, input.role, String(activation.childId))
  const sessionId = String(activation.childId)
  // The child is a new Session: bind the parent's case so persist.ts and the
  // case tools write evidence to the same ledger the ticket reports cite.
  bindCase(sessionId, {
    dir: ticket.caseDir,
    name: basename(ticket.caseDir),
    goal: ticket.goal,
    mode: 'full',
    route: 'team',
  })
  const completion = (async (): Promise<TeamReport | undefined> => {
    try {
      const result = await activation.result
      const report = applyFinishGate(extractWorkerReport(result.output, result.stopReason), Date.now() - startedAt, budget)
      const updated = recordReport({
        ticketId: ticket.id,
        role: input.role,
        state: report.state,
        summary: report.summary,
        evidenceIds: report.evidenceIds,
        repro: report.repro,
        wallTimeMs: Date.now() - startedAt,
        source: 'worker',
        stopReason: report.stopReason,
      })
      return updated.reports[updated.reports.length - 1]
    } catch (error) {
      const updated = recordReport({
        ticketId: ticket.id,
        role: input.role,
        state: 'failed',
        summary: `worker failed: ${error instanceof Error ? error.message : String(error)}`,
        wallTimeMs: Date.now() - startedAt,
        source: 'worker',
        stopReason: 'error',
      })
      return updated.reports[updated.reports.length - 1]
    } finally {
      clearTimeout(timer)
      input.signal?.removeEventListener('abort', forwardAbort)
      try { await activation.dispose?.() } catch { /* terminal result is already recorded */ }
    }
  })()
  return { ticketId: ticket.id, role: input.role, sessionId, completion }
}
