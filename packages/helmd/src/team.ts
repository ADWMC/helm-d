// Local multi-agent collaboration and auditable evolution.
//
// This module is the protocol/state layer only: it records tickets, role
// assignments, reports and handoffs, and stores versioned team artifacts with
// an eval gate. Worker session spawning, sandboxing and benchmark execution are
// separate adapters so the protocol stays testable without a DSH host.

import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, normalize } from 'node:path'
import { loadSettings } from './settings.js'

export const TEAM_ROLES = ['orchestrator', 'triage', 'static', 'dynamic', 'decoy-audit', 'critic', 'reporter'] as const
export type TeamRole = (typeof TEAM_ROLES)[number]

export type TicketState = 'open' | 'working' | 'review' | 'blocked' | 'done' | 'dropped'
export type ReportState = 'progress' | 'ready' | 'blocked' | 'failed' | 'dropped'

export interface TeamReport {
  id: string
  role: TeamRole
  state: ReportState
  summary: string
  evidenceIds: string[]
  repro?: string
  budget?: number
  tokens?: number
  wallTimeMs?: number
  source?: 'worker' | 'manual'
  stopReason?: string
  at: string
}

export interface TeamHandoff {
  id: string
  from: TeamRole
  to: TeamRole
  question: string
  at: string
}

export interface RoleAssignment {
  role: TeamRole
  sessionId?: string
  state: 'idle' | 'running' | 'done'
  startedAt?: string
  endedAt?: string
}

export type TaskState = 'ready' | 'blocked' | 'claimed' | 'done' | 'failed'

export interface TeamTask {
  id: string
  role: TeamRole
  /** Task ids that must be done before this task is claimable. */
  blockedBy: string[]
  state: TaskState
  owner?: TeamRole
  /** ISO timestamp; an expired lease can be reclaimed by another worker. */
  leaseUntil?: string
  createdAt: string
  updatedAt: string
}

export interface TeamBudget {
  wallTimeMs?: number
  maxToolCalls?: number
}

export interface TeamSteer {
  id: string
  role: TeamRole
  message: string
  at: string
}

export interface TeamTicket {
  id: string
  goal: string
  caseDir: string
  state: TicketState
  revision: number
  /** Active artifact revisions captured when the first worker starts. */
  artifactRevisions: Record<string, number>
  /** Role dependencies: a role may only start once every listed role is done. */
  roleDeps?: Partial<Record<TeamRole, TeamRole[]>>
  /** Per-ticket budget; inherited by workers (T-05). */
  budget?: TeamBudget
  /** Optional task DAG (T-03); legacy tickets without tasks keep the roleDeps gate. */
  tasks?: TeamTask[]
  roles: RoleAssignment[]
  reports: TeamReport[]
  handoffs: TeamHandoff[]
  steers?: TeamSteer[]
  createdAt: string
  updatedAt: string
}

export interface TeamState {
  tickets: TeamTicket[]
}

export type ArtifactKind = 'role-prompt' | 'playbook' | 'skill' | 'model-profile' | 'budget-policy' | 'tool-policy'

export interface EvalResult {
  baseline: Record<string, number>
  candidate: Record<string, number>
  pass: boolean
  reasons: string[]
  holdout?: {
    baseline: Record<string, number>
    candidate: Record<string, number>
    pass: boolean
    reasons: string[]
  }
  at: string
}

export interface ArtifactRevision {
  kind: ArtifactKind
  id: string
  revision: number
  parent: number
  value: string
  source: string
  at: string
  /** Added+removed lines relative to the active revision (edit budget). */
  diffLines?: number
  eval?: EvalResult
}

export interface TeamVersions {
  artifacts: ArtifactRevision[]
  active: Record<string, number>
}

const DEFAULT_ROLES: TeamRole[] = ['triage', 'static', 'critic', 'reporter']

/** Ticket defaults follow the operator's settings (workbench 设置 tab / DSH
 *  settings page); the hardcoded set is only the fallback when settings are
 *  unreadable or the stored role list is empty. */
function configuredDefaultRoles(): TeamRole[] {
  try {
    const roles = loadSettings().team.defaultRoles
    const valid = roles.filter((role) => TEAM_ROLES.includes(role))
    if (valid.length > 0) return valid
  } catch { /* fall back to the built-in set */ }
  return DEFAULT_ROLES
}
const HIGHER_IS_BETTER = ['correctness', 'evidence', 'canaryResistance', 'blockedHonesty'] as const
const LOWER_IS_BETTER = ['tokens', 'wallTime'] as const

/** $DSH_HOME/storages/helmd/team */
function teamDir(): string {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return normalize(join(home, 'storages', 'helmd', 'team'))
}

function statePath(): string {
  return join(teamDir(), 'state.json')
}

function versionsPath(): string {
  return join(teamDir(), 'versions.json')
}

let lockDepth = 0
const sleepCell = new Int32Array(new SharedArrayBuffer(4))

/** Serialize read-modify-write across worker sessions in this process and
 *  across host processes. Writes are small and short-lived, so a synchronous
 *  lock file is cheaper than a second persistence format. */
function withStoreLock<T>(fn: () => T): T {
  if (lockDepth > 0) return fn()
  mkdirSync(teamDir(), { recursive: true })
  const lock = join(teamDir(), 'state.lock')
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      const fd = openSync(lock, 'wx')
      lockDepth += 1
      try {
        return fn()
      } finally {
        lockDepth -= 1
        closeSync(fd)
        try { unlinkSync(lock) } catch { /* already removed */ }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      Atomics.wait(sleepCell, 0, 0, 10)
    }
  }
  throw new Error('team state is locked by another process; retry')
}

function readJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch {
    return fallback
  }
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  const temp = `${path}.${process.pid}.tmp`
  writeFileSync(temp, JSON.stringify(value, null, 2), 'utf8')
  renameSync(temp, path)
}

function now(): string {
  return new Date().toISOString()
}

function nextId(prefix: string, existing: readonly { id: string }[]): string {
  const max = existing.reduce((best, item) => {
    const match = new RegExp(`^${prefix}-(\\d+)$`).exec(item.id)
    return match ? Math.max(best, Number(match[1])) : best
  }, 0)
  return `${prefix}-${String(max + 1).padStart(3, '0')}`
}

function loadState(): TeamState {
  const state = readJson<TeamState>(statePath(), { tickets: [] })
  const tickets = Array.isArray(state.tickets) ? state.tickets : []
  return {
    tickets: tickets.map((ticket) => ({
      ...ticket,
      artifactRevisions: ticket.artifactRevisions && typeof ticket.artifactRevisions === 'object'
        ? ticket.artifactRevisions
        : {},
      roleDeps: ticket.roleDeps && typeof ticket.roleDeps === 'object'
        ? ticket.roleDeps
        : undefined,
      tasks: Array.isArray(ticket.tasks)
        ? ticket.tasks.map((task) => ({
          ...task,
          blockedBy: Array.isArray(task.blockedBy) ? task.blockedBy : [],
        }))
        : undefined,
      steers: Array.isArray(ticket.steers) ? ticket.steers : undefined,
    })),
  }
}

function saveState(state: TeamState): void {
  writeJson(statePath(), state)
}

export function listTickets(): TeamTicket[] {
  return loadState().tickets.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getTicket(id: string): TeamTicket | undefined {
  return loadState().tickets.find((ticket) => ticket.id === id)
}

function updateTicket(id: string, mutate: (ticket: TeamTicket) => void): TeamTicket {
  return withStoreLock(() => {
    const state = loadState()
    const ticket = state.tickets.find((item) => item.id === id)
    if (ticket === undefined) throw new Error(`unknown ticket ${id}`)
    mutate(ticket)
    ticket.updatedAt = now()
    saveState(state)
    return ticket
  })
}

/** Resolve the role a worker session was assigned to. Used by the tool-policy
 *  guard so a child cannot start more children or close the parent case. */
export function sessionRole(sessionId?: string): TeamRole | undefined {
  if (sessionId === undefined || sessionId === '') return undefined
  for (const ticket of loadState().tickets) {
    const assignment = ticket.roles.find((role) => role.sessionId === sessionId)
    if (assignment !== undefined) return assignment.role
  }
  return undefined
}

/** Freeze the active artifact revisions into the ticket at first dispatch. */
export function pinArtifactRevisions(ticketId: string, revisions: Record<string, number>): TeamTicket {
  return updateTicket(ticketId, (ticket) => {
    if (Object.keys(ticket.artifactRevisions).length === 0) ticket.artifactRevisions = { ...revisions }
  })
}

/** Ensure the ticket workspace is a usable case: standalone tickets get the
 *  same CASE.md + evidence/ skeleton begin_case would create, so worker
 *  evidence tools and the session-binding reader (which requires CASE.md)
 *  work instead of surfacing ENOENT. Never touches an existing case. */
function scaffoldCaseDir(caseDir: string, goal: string): void {
  try {
    if (existsSync(join(caseDir, 'CASE.md'))) return
    mkdirSync(join(caseDir, 'evidence'), { recursive: true })
    writeFileSync(
      join(caseDir, 'CASE.md'),
      [
        'status: open',
        `goal: ${goal}`,
        'mode: full',
        'route: team',
        '',
        '## timeline',
        `- [${now()}] ticket workspace scaffolded (team)`,
        '',
        '## resume',
        '- workspace created by the team rail; workers report through the ticket',
        '',
      ].join('\n'),
      'utf8',
    )
  } catch {
    // A read-only workspace must not block ticket creation; workers degrade to
    // text-only reports and the orchestrator sees it in their summaries.
  }
}

export function createTicket(input: {
  goal: string
  caseDir: string
  roles?: TeamRole[]
  revision?: number
  artifactRevisions?: Record<string, number>
  roleDeps?: Partial<Record<TeamRole, TeamRole[]>>
  budget?: TeamBudget
  tasks?: Array<{ id?: string; role: TeamRole; blockedBy?: string[] }>
}): TeamTicket {
  const goal = input.goal.trim()
  const caseDir = input.caseDir.trim()
  if (goal === '') throw new Error('goal is required')
  if (caseDir === '') throw new Error('caseDir is required')
  scaffoldCaseDir(caseDir, goal)
  return withStoreLock(() => {
    const state = loadState()
    const roles = (input.roles && input.roles.length > 0 ? input.roles : configuredDefaultRoles())
    const unique = [...new Set(roles)].filter((role) => TEAM_ROLES.includes(role))
    if (unique.length === 0) throw new Error('at least one valid role is required')
    const timestamp = now()
    const roleTaskIds = new Map(unique.map((role, index) => [role, `TK-${String(index + 1).padStart(3, '0')}`]))
    const taskInputs: Array<{ id?: string; role: TeamRole; blockedBy?: string[] }> = input.tasks !== undefined && input.tasks.length > 0
      ? input.tasks
      : unique.map((role) => ({
        role,
        blockedBy: (input.roleDeps?.[role] ?? [])
          .map((dep) => roleTaskIds.get(dep))
          .filter((id): id is string => id !== undefined),
      }))
    const tasks: TeamTask[] = taskInputs.map((task, index) => ({
      id: task.id ?? `TK-${String(index + 1).padStart(3, '0')}`,
      role: task.role,
      blockedBy: [...new Set(task.blockedBy ?? [])],
      state: (task.blockedBy ?? []).length > 0 ? 'blocked' : 'ready',
      createdAt: timestamp,
      updatedAt: timestamp,
    }))
    const ticket: TeamTicket = {
      id: nextId('T', state.tickets),
      goal,
      caseDir,
      state: 'open',
      revision: input.revision ?? 0,
      artifactRevisions: { ...(input.artifactRevisions ?? {}) },
      ...(input.roleDeps !== undefined ? { roleDeps: input.roleDeps } : {}),
      ...(input.budget !== undefined ? { budget: input.budget } : {}),
      ...(tasks.length > 0 ? { tasks } : {}),
      roles: unique.map((role) => ({ role, state: 'idle' })),
      reports: [],
      handoffs: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    state.tickets.push(ticket)
    saveState(state)
    return ticket
  })
}

export function assignRole(ticketId: string, role: TeamRole, sessionId: string): TeamTicket {
  const session = sessionId.trim()
  if (session === '') throw new Error('sessionId is required')
  return updateTicket(ticketId, (ticket) => {
    const assignment = ticket.roles.find((item) => item.role === role)
    if (assignment === undefined) throw new Error(`role ${role} is not part of ticket ${ticketId}`)
    assignment.sessionId = session
    assignment.state = 'running'
    assignment.startedAt ??= now()
    if (ticket.state === 'open') ticket.state = 'working'
  })
}

/** Claim the role's next ready DAG task with a lease. Idempotent while the
 *  caller still owns an unexpired lease; a different live owner is rejected. */
export function claimTask(ticketId: string, role: TeamRole, leaseMs = 30 * 60 * 1000): TeamTask {
  return withStoreLock(() => {
    const state = loadState()
    const ticket = state.tickets.find((item) => item.id === ticketId)
    if (ticket === undefined) throw new Error(`unknown ticket ${ticketId}`)
    if (ticket.tasks === undefined || ticket.tasks.length === 0) throw new Error(`ticket ${ticketId} has no task DAG`)
    const byId = new Map(ticket.tasks.map((task) => [task.id, task]))
    const ready = ticket.tasks.find((task) => {
      if (task.role !== role || task.state === 'done' || task.state === 'failed') return false
      const blockersDone = task.blockedBy.every((id) => byId.get(id)?.state === 'done')
      return blockersDone
    })
    if (ready === undefined) {
      const own = ticket.tasks.find((task) => task.role === role)
      if (own !== undefined) throw new Error(`task ${own.id} is not ready (blocked by: ${own.blockedBy.join(', ') || 'state'})`)
      throw new Error(`no task for role ${role} in ticket ${ticketId}`)
    }
    const current = Date.now()
    const liveLease = ready.state === 'claimed'
      && ready.owner !== undefined
      && ready.leaseUntil !== undefined
      && Date.parse(ready.leaseUntil) > current
    if (liveLease && ready.owner !== role) {
      throw new Error(`task ${ready.id} is leased by ${ready.owner} until ${ready.leaseUntil}`)
    }
    if (liveLease && ready.owner === role) return ready
    ready.state = 'claimed'
    ready.owner = role
    ready.leaseUntil = new Date(current + Math.max(1000, leaseMs)).toISOString()
    ready.updatedAt = now()
    ticket.updatedAt = now()
    if (ticket.state === 'open') ticket.state = 'working'
    saveState(state)
    return ready
  })
}

/** Finish a claimed task. `done` unblocks dependents; `blocked`/`failed`
 *  release the lease so another attempt can claim it. */
export function completeTask(ticketId: string, role: TeamRole, outcome: 'done' | 'blocked' | 'failed'): TeamTask {
  return withStoreLock(() => {
    const state = loadState()
    const ticket = state.tickets.find((item) => item.id === ticketId)
    if (ticket === undefined) throw new Error(`unknown ticket ${ticketId}`)
    const task = [...(ticket.tasks ?? [])].reverse().find((item) => item.role === role && item.state === 'claimed' && item.owner === role)
    if (task === undefined) throw new Error(`role ${role} has no claimed task in ticket ${ticketId}`)
    task.state = outcome
    task.owner = undefined
    task.leaseUntil = undefined
    task.updatedAt = now()
    if (outcome === 'done') {
      for (const candidate of ticket.tasks ?? []) {
        if (candidate.state === 'blocked' && candidate.blockedBy.every((id) => ticket.tasks?.find((item) => item.id === id)?.state === 'done')) {
          candidate.state = 'ready'
          candidate.updatedAt = now()
        }
      }
    }
    ticket.updatedAt = now()
    saveState(state)
    return task
  })
}

/** Audit a steer instruction; delivery itself is performed by the caller. */
export function recordSteer(ticketId: string, role: TeamRole, message: string): TeamSteer {
  const text = message.trim()
  if (text === '') throw new Error('steer message is required')
  return withStoreLock(() => {
    const state = loadState()
    const ticket = state.tickets.find((item) => item.id === ticketId)
    if (ticket === undefined) throw new Error(`unknown ticket ${ticketId}`)
    const steer: TeamSteer = {
      id: nextId('S', ticket.steers ?? []),
      role,
      message: text.slice(0, 4000),
      at: now(),
    }
    ticket.steers = [...(ticket.steers ?? []), steer]
    ticket.updatedAt = steer.at
    saveState(state)
    return steer
  })
}

export function recordReport(input: {
  ticketId: string
  role: TeamRole
  state: ReportState
  summary: string
  evidenceIds?: string[]
  repro?: string
  budget?: number
  tokens?: number
  wallTimeMs?: number
  source?: 'worker' | 'manual'
  stopReason?: string
}): TeamTicket {
  const summary = input.summary.trim()
  if (summary === '') throw new Error('summary is required')
  return updateTicket(input.ticketId, (ticket) => {
    const assignment = ticket.roles.find((item) => item.role === input.role)
    if (assignment === undefined) throw new Error(`role ${input.role} is not part of ticket ${input.ticketId}`)
    // Workers both auto-record (final output) and may call team_report — the
    // same content twice is noise, not signal. Drop an exact repeat of the
    // role's latest report.
    const last = [...ticket.reports].reverse().find((report) => report.role === input.role)
    if (last !== undefined && last.state === input.state && last.summary === summary) {
      return ticket
    }
    const report: TeamReport = {
      id: nextId('R', ticket.reports),
      role: input.role,
      state: input.state,
      summary,
      evidenceIds: [...new Set(input.evidenceIds ?? [])],
      ...(input.repro !== undefined && input.repro.trim() !== '' ? { repro: input.repro.trim() } : {}),
      ...(input.budget !== undefined ? { budget: input.budget } : {}),
      ...(input.tokens !== undefined ? { tokens: input.tokens } : {}),
      ...(input.wallTimeMs !== undefined ? { wallTimeMs: input.wallTimeMs } : {}),
      ...(input.source !== undefined ? { source: input.source } : {}),
      ...(input.stopReason !== undefined ? { stopReason: input.stopReason } : {}),
      at: now(),
    }
    ticket.reports.push(report)
    const claimedTask = [...(ticket.tasks ?? [])].reverse().find((task) => task.role === input.role && (task.state === 'claimed' || task.state === 'ready') && (task.owner === undefined || task.owner === input.role))
    if (claimedTask !== undefined) {
      if (input.state === 'ready') {
        claimedTask.state = 'done'
        claimedTask.owner = undefined
        claimedTask.leaseUntil = undefined
        claimedTask.updatedAt = now()
        for (const candidate of ticket.tasks ?? []) {
          if (candidate.state === 'blocked' && candidate.blockedBy.every((id) => ticket.tasks?.find((task) => task.id === id)?.state === 'done')) {
            candidate.state = 'ready'
            candidate.updatedAt = now()
          }
        }
      } else if (input.state === 'blocked' || input.state === 'failed' || input.state === 'dropped') {
        claimedTask.state = input.state === 'failed' ? 'failed' : 'blocked'
        claimedTask.owner = undefined
        claimedTask.leaseUntil = undefined
        claimedTask.updatedAt = now()
      }
    }
    if (input.state === 'blocked' || input.state === 'failed') ticket.state = 'blocked'
    else if (input.state === 'dropped') ticket.state = 'dropped'
    else if (input.state === 'ready' && input.role === 'reporter') ticket.state = 'review'
    else if (ticket.state === 'open') ticket.state = 'working'
    if (input.state === 'ready' || input.state === 'dropped' || input.state === 'failed') {
      assignment.state = 'done'
      assignment.endedAt = now()
    }
  })
}

export function recordHandoff(input: { ticketId: string; from: TeamRole; to: TeamRole; question: string }): TeamTicket {
  const question = input.question.trim()
  if (question === '') throw new Error('question is required')
  return updateTicket(input.ticketId, (ticket) => {
    if (!ticket.roles.some((item) => item.role === input.from)) throw new Error(`role ${input.from} is not part of ticket ${input.ticketId}`)
    if (!ticket.roles.some((item) => item.role === input.to)) throw new Error(`role ${input.to} is not part of ticket ${input.ticketId}`)
    ticket.handoffs.push({ id: nextId('H', ticket.handoffs), from: input.from, to: input.to, question, at: now() })
    ticket.state = 'blocked'
  })
}

export function closeTicket(ticketId: string, outcome: 'done' | 'dropped'): TeamTicket {
  return updateTicket(ticketId, (ticket) => { ticket.state = outcome })
}

function loadVersions(): TeamVersions {
  const versions = readJson<TeamVersions>(versionsPath(), { artifacts: [], active: {} })
  return {
    artifacts: Array.isArray(versions.artifacts) ? versions.artifacts : [],
    active: versions.active && typeof versions.active === 'object' ? versions.active : {},
  }
}

function saveVersions(versions: TeamVersions): void {
  writeJson(versionsPath(), versions)
}

function artifactKey(kind: ArtifactKind, id: string): string {
  return `${kind}:${id}`
}

export function listRevisions(kind?: ArtifactKind, id?: string): ArtifactRevision[] {
  return loadVersions().artifacts
    .filter((item) => (kind === undefined || item.kind === kind) && (id === undefined || item.id === id))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id) || a.revision - b.revision)
}

export function activeRevision(kind: ArtifactKind, id: string): ArtifactRevision | undefined {
  const versions = loadVersions()
  const revision = versions.active[artifactKey(kind, id)]
  return revision === undefined ? undefined : versions.artifacts.find((item) => item.kind === kind && item.id === id && item.revision === revision)
}

export function proposeRevision(input: {
  kind: ArtifactKind
  id: string
  value: string
  source: string
  maxDiffLines?: number
}): ArtifactRevision {
  if (input.id.trim() === '') throw new Error('artifact id is required')
  if (input.value.trim() === '') throw new Error('artifact value is required')
  return withStoreLock(() => {
    const versions = loadVersions()
    const key = artifactKey(input.kind, input.id)
    const existing = versions.artifacts.filter((item) => item.kind === input.kind && item.id === input.id)
    const revision = existing.reduce((best, item) => Math.max(best, item.revision), 0) + 1
    const active = versions.active[key]
    const previous = active === undefined ? undefined : existing.find((item) => item.revision === active)
    const diffLines = previous === undefined ? input.value.split('\n').length : changedLineCount(previous.value, input.value)
    const limit = input.maxDiffLines ?? 200
    if (diffLines > limit) throw new Error(`edit budget exceeded: ${diffLines} changed lines > ${limit}`)
    const artifact: ArtifactRevision = {
      kind: input.kind,
      id: input.id,
      revision,
      parent: versions.active[key] ?? 0,
      value: input.value,
      source: input.source,
      at: now(),
      diffLines,
    }
    versions.artifacts.push(artifact)
    saveVersions(versions)
    return artifact
  })
}

/** Cheap deterministic edit distance (set difference); the budget cares about
 *  how much an operator has to review, not character-level fidelity. */
function changedLineCount(before: string, after: string): number {
  const oldLines = before.split('\n').map((line) => line.trimEnd())
  const newLines = after.split('\n').map((line) => line.trimEnd())
  const oldSet = new Set(oldLines)
  const newSet = new Set(newLines)
  return newLines.filter((line) => !oldSet.has(line)).length + oldLines.filter((line) => !newSet.has(line)).length
}

export interface GateOptions {
  /** Scores within this band are treated as noise, not regression. */
  noise?: number
  /** Minimum improvement required on at least one metric. */
  minImprovement?: number
  holdout?: { baseline: Record<string, number>; candidate: Record<string, number> }
  diffLines?: number
  maxDiffLines?: number
}

/** Gate: higher-is-better metrics may not regress beyond the noise band,
 *  lower-is-better may not grow by more than 10%, at least one metric must
 *  improve by minImprovement, a holdout set must also pass, and edits must fit
 *  the review budget. */
export function canActivate(
  baseline: Record<string, number>,
  candidate: Record<string, number>,
  options: GateOptions = {},
): { pass: boolean; reasons: string[] } {
  const reasons: string[] = []
  const noise = Math.max(0, options.noise ?? 0.1)
  const minImprovement = Math.max(0, options.minImprovement ?? 0)
  for (const key of HIGHER_IS_BETTER) {
    if (candidate[key] === undefined) { reasons.push(`missing metric ${key}`); continue }
    if (candidate[key]! < (baseline[key] ?? 0) - noise) reasons.push(`${key} regressed`)
  }
  for (const key of LOWER_IS_BETTER) {
    if (candidate[key] === undefined) continue
    const before = baseline[key] ?? 0
    if (before > 0 && candidate[key]! > before * 1.1) reasons.push(`${key} grew >10%`)
  }
  const improved = [...HIGHER_IS_BETTER, ...LOWER_IS_BETTER].some((key) => {
    if (candidate[key] === undefined || baseline[key] === undefined) return false
    return LOWER_IS_BETTER.includes(key as (typeof LOWER_IS_BETTER)[number])
      ? candidate[key]! < baseline[key]! - minImprovement
      : candidate[key]! > baseline[key]! + minImprovement
  })
  if (!improved) reasons.push(minImprovement > 0 ? `no metric improved by >${minImprovement}` : 'no metric improved')
  if (options.diffLines !== undefined && options.maxDiffLines !== undefined && options.diffLines > options.maxDiffLines) {
    reasons.push(`edit budget exceeded: ${options.diffLines} > ${options.maxDiffLines} lines`)
  }
  if (options.holdout !== undefined) {
    const holdout = canActivate(options.holdout.baseline, options.holdout.candidate, { noise, minImprovement })
    if (!holdout.pass) reasons.push(`holdout failed: ${holdout.reasons.join('; ')}`)
  }
  return { pass: reasons.length === 0, reasons }
}

/** Parent selection from dgm: score × 1/(1+children) keeps one lineage from
 *  monopolising the archive while still preferring stronger candidates. */
export function selectParent<T extends { score: number; children: number }>(candidates: T[]): T | undefined {
  return [...candidates].sort((a, b) =>
    (b.score / (1 + b.children)) - (a.score / (1 + a.children)))[0]
}

export function evaluateRevision(input: {
  kind: ArtifactKind
  id: string
  revision: number
  baseline: Record<string, number>
  candidate: Record<string, number>
  holdout?: { baseline: Record<string, number>; candidate: Record<string, number> }
  maxDiffLines?: number
}): ArtifactRevision {
  return withStoreLock(() => {
    const versions = loadVersions()
    const artifact = versions.artifacts.find((item) => item.kind === input.kind && item.id === input.id && item.revision === input.revision)
    if (artifact === undefined) throw new Error(`unknown revision ${input.kind}:${input.id}@${input.revision}`)
    const gate = canActivate(input.baseline, input.candidate, {
      ...(input.holdout !== undefined ? { holdout: input.holdout } : {}),
      ...(artifact.diffLines !== undefined ? { diffLines: artifact.diffLines } : {}),
      ...(input.maxDiffLines !== undefined ? { maxDiffLines: input.maxDiffLines } : {}),
    })
    const holdout = input.holdout === undefined
      ? undefined
      : (() => {
        const result = canActivate(input.holdout.baseline, input.holdout.candidate, { noise: 0.1, minImprovement: 0 })
        return { ...input.holdout, ...result }
      })()
    artifact.eval = {
      baseline: input.baseline,
      candidate: input.candidate,
      pass: gate.pass,
      reasons: gate.reasons,
      ...(holdout !== undefined ? { holdout } : {}),
      at: now(),
    }
    saveVersions(versions)
    return artifact
  })
}

export function activateRevision(kind: ArtifactKind, id: string, revision: number): ArtifactRevision {
  return withStoreLock(() => {
    const versions = loadVersions()
    const artifact = versions.artifacts.find((item) => item.kind === kind && item.id === id && item.revision === revision)
    if (artifact === undefined) throw new Error(`unknown revision ${kind}:${id}@${revision}`)
    if (artifact.eval === undefined || !artifact.eval.pass) throw new Error('revision has not passed its eval gate')
    versions.active[artifactKey(kind, id)] = revision
    saveVersions(versions)
    return artifact
  })
}

export function rollbackRevision(kind: ArtifactKind, id: string): ArtifactRevision {
  return withStoreLock(() => {
    const versions = loadVersions()
    const key = artifactKey(kind, id)
    const current = versions.active[key]
    if (current === undefined) throw new Error(`no active revision for ${key}`)
    const artifact = versions.artifacts.find((item) => item.kind === kind && item.id === id && item.revision === current)
    if (artifact === undefined || artifact.parent === 0) throw new Error(`no previous revision for ${key}`)
    const previous = versions.artifacts.find((item) => item.kind === kind && item.id === id && item.revision === artifact.parent)
    if (previous === undefined) throw new Error(`previous revision ${artifact.parent} is missing`)
    versions.active[key] = previous.revision
    saveVersions(versions)
    return previous
  })
}

export function teamStatus(): { tickets: TeamTicket[]; artifacts: ArtifactRevision[]; active: Record<string, number> } {
  const versions = loadVersions()
  return { tickets: listTickets(), artifacts: versions.artifacts, active: versions.active }
}
