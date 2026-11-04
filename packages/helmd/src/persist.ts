// persistToCase: wraps ctx.tools.register once in apply() so every domain
// tool gains evidence persistence with zero per-tool edits. Soft gate:
// without an active case tools behave exactly as before (plus a footer).

import type { Context } from '@deepseek-ai/cordis'
import { getCase, saveEvidence, loadHypotheses, loadFindings, listEvidence } from './case.js'
import { getLevel } from './mode.js'
import { deriveNextAction } from './autonomy.js'
import { submitAdvisory } from './advisory.js'
import { sessionEvents } from './session-log.js'
import { loadSettings } from './settings.js'

const NO_PERSIST = new Set([
  // knowledge / router / session tools — outputs are not case artifacts
  'skill_catalog', 'read_reference', 'analysis_mode', 'route_task',
  'evidence_reference', 'native_reference', 'web_reference',
  'malware_reference', 'ai_reference', 'protocol_reference',
  'tool_recommend',
  // coordination, not an artifact of the analysis
  'team_dispatch',
  // case lifecycle / ledger bookkeeping itself
  'begin_case', 'case_status', 'record_finding', 'end_case', 'save_evidence',
  'record_hypothesis', 'update_hypothesis',
  // recon tools persist raw output and the asset/evidence link themselves
  'recon_passive', 'recon_ports', 'recon_http', 'recon_crawl', 'recon_import',
  'run_poc',
  'oob_start', 'oob_poll', 'oob_stop',
  'mine_candidates',
])

export function isNoPersist(toolName: string): boolean {
  return NO_PERSIST.has(toolName)
}

const lastNudge = new Map<string, { at: number; next: string }>()

/** L4-lite scheduler: after a tool result, push the current next action into the
 *  advisory section when the case state changes. A nudge, never a gate. */
async function nudgeCaseState(
  sessionId: string | undefined,
  agent: unknown,
  active: { dir: string; goal: string },
): Promise<void> {
  if (sessionId === undefined) return
  if (!loadSettings().advisory.nextActionNudge) return
  const now = Date.now()
  const last = lastNudge.get(sessionId)
  if (last !== undefined && now - last.at < 3000) return
  const hypotheses = await loadHypotheses(active.dir)
  const findings = await loadFindings(active.dir)
  const evidence = await listEvidence(active.dir)
  const next = deriveNextAction({
    mode: getLevel(sessionId),
    goal: active.goal,
    hypotheses,
    findings,
    evidence,
  })
  if (next === '' || last?.next === next) return
  lastNudge.set(sessionId, { at: now, next })
  submitAdvisory(sessionId, {
    key: 'case:next',
    tier: 'recommended',
    content: next,
    proof: {
      kind: 'tool_called',
      tools: ['case_status', 'record_hypothesis', 'update_hypothesis', 'record_finding', 'end_case'],
    },
    withinTurns: 3,
    adaptive: true,
  }, sessionEvents(agent as unknown as Parameters<typeof sessionEvents>[0], 'persist').length)
}

async function persistHook(
  sessionId: string | undefined,
  toolName: string,
  result: unknown,
  agent: unknown,
): Promise<unknown> {
  if (typeof result !== 'string') return result
  const active = getCase(sessionId)
  if (!active) {
    return result + '\n[no active case — output NOT persisted. begin_case(goal, samples) keeps evidence.]'
  }
  const firstLine = result.split('\n').find((l) => l.trim()) ?? ''
  const large = result.length > 256 * 1024
  const { id, path } = await saveEvidence(active.dir, toolName, result, firstLine, large ? { maxBytes: 0 } : {})
  try {
    await nudgeCaseState(sessionId, agent, active)
  } catch {
    // The nudge is best-effort; a case/ledger read failure must not break the tool result.
  }
  if (large) {
    return [
      `[evidence: ${id} saved to ${active.name} — full output is ${result.length} bytes at ${path}]`,
      '[model view: head/tail stub only; read the evidence file for the middle]',
      '--- head ---',
      result.slice(0, 4096),
      '--- tail ---',
      result.slice(-4096),
    ].join('\n')
  }
  return result + `\n[evidence: ${id} saved to ${active.name}]`
}

/**
 * Wrap register so every later-registered tool executes through the hook.
 * Must be called BEFORE any register*Tools(ctx) in apply().
 */
export function applyPersistenceWrap(ctx: Context): () => void {
  const target = ctx.tools as unknown as {
    register: (def: { name: string; execute?: (...a: any[]) => any }) => void
  }
  const originalRegister = target.register
  target.register = (def) => {
    if (!def || typeof def.execute !== 'function' || isNoPersist(def.name)) {
      return originalRegister.call(ctx.tools, def)
    }
    const original = def.execute.bind(def)
    ;(def as any).execute = async (args: unknown, exec?: { agent?: { id?: string } }) => {
      const result = await original(args, exec)
      return await persistHook(exec?.agent?.id, def.name, result, exec?.agent)
    }
    return originalRegister.call(ctx.tools, def)
  }
  return () => {
    target.register = originalRegister
  }
}
