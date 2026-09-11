// Advisory ledger — every guidance helm-d injects into a session (hook directive,
// route_task recommendation, mode contract) carries a machine-checkable adoption
// proof. At the next prompt assembly the pending advisories are reckoned against
// the session's own event log; the verdict (adopted / ignored) is persisted, and
// guidance that keeps being ignored is demoted instead of repeating forever.
//
// This is deliberately not hook-scoped: any producer (tool, hook, preset) can
// submit, and the same ledger answers "did the agent act on what we told it?".

import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ledgerDir } from './ledger.js'
import { ASSISTANT_MESSAGE, eventCount, eventTexts, toolCalls, type ToolCall } from './session-log.js'

/** How binding an advisory is. `mandatory` is never demoted and never truncated. */
export type AdvisoryTier = 'mandatory' | 'recommended' | 'hint'

/** The objectively observable behaviour that counts as "acted on it". */
export type Proof =
  | { kind: 'tool_called'; tools: string[]; argIncludes?: string }
  | { kind: 'finding_recorded' }
  | { kind: 'case_opened' }
  | { kind: 'evidence_saved' }
  | { kind: 'reference_read'; pathIncludes?: string }
  | { kind: 'mode_set' }
  /** Adopted when NO marker appears in the assistant replies inside the window. */
  | { kind: 'reply_avoids'; markers: string[] }
  /** Adopted when at least one marker appears in the assistant replies inside the window. */
  | { kind: 'reply_shows'; markers: string[] }

export interface Advisory {
  /** Dedupe key: one live advisory per key per session. */
  key: string
  tier: AdvisoryTier
  content: string
  /** Adoption proof; absent means "delivered only" — never counted as ignored. */
  proof?: Proof
  /** Assistant turns allowed before an unadopted advisory is reckoned `ignored`. */
  withinTurns?: number
  /**
   * Track adoption only — never render into the prompt. Use when the producing
   * tool already delivered the guidance as its own result (e.g. route_task's card),
   * so re-injecting would duplicate it, and demotion would wrongly silence a
   * per-call fact. Track-only advisories are still reckoned and recorded.
   */
  trackOnly?: boolean
}

export type Verdict = 'adopted' | 'ignored' | 'delivered'

export interface Reckoned {
  key: string
  tier: AdvisoryTier
  verdict: Verdict
  turnsWaited: number
}

interface Pending {
  advisory: Advisory
  atEventCount: number
}

const TIER_ORDER: Record<AdvisoryTier, number> = { mandatory: 0, recommended: 1, hint: 2 }
const DEMOTE_AFTER = 3

const pending = new Map<string, Pending[]>()

/** Advisory ledger path; shares the tool-ledger directory so it survives with it. */
export function advisoryLedgerPath(): string {
  return join(ledgerDir(), 'advisories.jsonl')
}

/** Submit or refresh one advisory for a session. `atEventCount` anchors the proof window. */
export function submitAdvisory(sessionId: string, advisory: Advisory, atEventCount: number): void {
  const list = pending.get(sessionId) ?? []
  const next: Pending = { advisory, atEventCount }
  const index = list.findIndex((entry) => entry.advisory.key === advisory.key)
  if (index >= 0) list[index] = next
  else list.push(next)
  pending.set(sessionId, list)
}

/** Whether a key already has an un-reckoned advisory in this session. */
export function hasPending(sessionId: string, key: string): boolean {
  return (pending.get(sessionId) ?? []).some((entry) => entry.advisory.key === key)
}

/** Live (not yet reckoned) advisories, tier-ordered. */
export function advisoryQueue(sessionId: string): Advisory[] {
  return (pending.get(sessionId) ?? [])
    .map((entry) => entry.advisory)
    .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier])
}

function proven(proof: Proof | undefined, calls: ToolCall[], after: readonly unknown[]): boolean {
  if (!proof) return false
  switch (proof.kind) {
    case 'tool_called':
      return calls.some((c) => proof.tools.includes(c.name)
        && (proof.argIncludes === undefined || c.args.includes(proof.argIncludes)))
    case 'finding_recorded':
      return calls.some((c) => c.name === 'record_finding')
    case 'case_opened':
      return calls.some((c) => c.name === 'begin_case')
    case 'evidence_saved':
      return calls.some((c) => c.name === 'save_evidence')
    case 'reference_read':
      return calls.some((c) => c.name === 'read_reference'
        && (proof.pathIncludes === undefined || c.args.includes(proof.pathIncludes)))
    case 'mode_set':
      return calls.some((c) => c.name === 'analysis_mode')
    case 'reply_avoids': {
      const text = eventTexts(after, ASSISTANT_MESSAGE)
      return text.length > 0 && !proof.markers.some((m) => text.includes(m))
    }
    case 'reply_shows': {
      const text = eventTexts(after, ASSISTANT_MESSAGE)
      return proof.markers.some((m) => text.includes(m))
    }
  }
}

function record(entry: Reckoned): void {
  try {
    appendFileSync(advisoryLedgerPath(), `${JSON.stringify({ ...entry, ts: new Date().toISOString() })}\n`, 'utf8')
  } catch {
    // Ledger write failure must never break prompt assembly.
  }
}

/** Reckon pending advisories against the session's events; persist every verdict. */
export function reckonAdvisories(sessionId: string, events: readonly unknown[]): Reckoned[] {
  const list = pending.get(sessionId)
  if (!list || list.length === 0) return []
  const kept: Pending[] = []
  const settled: Reckoned[] = []
  for (const entry of list) {
    const after = events.slice(entry.atEventCount)
    const waited = eventCount(after, ASSISTANT_MESSAGE)
    const proof = entry.advisory.proof
    let verdict: Verdict | null = null
    if (proofedNow(proof, after)) verdict = 'adopted'
    else if (proof === undefined) verdict = 'delivered'
    else if (waited >= (entry.advisory.withinTurns ?? 1)) verdict = 'ignored'
    if (verdict === null) {
      kept.push(entry)
      continue
    }
    const reckoned: Reckoned = { key: entry.advisory.key, tier: entry.advisory.tier, verdict, turnsWaited: waited }
    record(reckoned)
    settled.push(reckoned)
  }
  if (kept.length > 0) pending.set(sessionId, kept)
  else pending.delete(sessionId)
  return settled
}

function proofedNow(proof: Proof | undefined, after: readonly unknown[]): boolean {
  return proven(proof, toolCalls(after), after)
}

/** Ignored tally per key, read from the persisted ledger. */
export function ignoredCounts(): Map<string, number> {
  const counts = new Map<string, number>()
  const path = advisoryLedgerPath()
  if (!existsSync(path)) return counts
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const row = JSON.parse(trimmed) as { key?: unknown; verdict?: unknown }
      if (row.verdict !== 'ignored' || typeof row.key !== 'string') continue
      counts.set(row.key, (counts.get(row.key) ?? 0) + 1)
    } catch {
      // malformed ledger line — skip
    }
  }
  return counts
}

/** Adopted / ignored tally per key, for the route card. */
export function advisoryStats(): Map<string, { adopted: number; ignored: number }> {
  const stats = new Map<string, { adopted: number; ignored: number }>()
  const path = advisoryLedgerPath()
  if (!existsSync(path)) return stats
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const row = JSON.parse(trimmed) as { key?: unknown; verdict?: unknown }
      if (typeof row.key !== 'string' || (row.verdict !== 'adopted' && row.verdict !== 'ignored')) continue
      const entry = stats.get(row.key) ?? { adopted: 0, ignored: 0 }
      if (row.verdict === 'adopted') entry.adopted += 1
      else entry.ignored += 1
      stats.set(row.key, entry)
    } catch {
      // malformed ledger line — skip
    }
  }
  return stats
}

/** A non-mandatory advisory that keeps being ignored stops being surfaced. */
export function isDemoted(key: string, tier: AdvisoryTier): boolean {
  if (tier === 'mandatory') return false
  return (ignoredCounts().get(key) ?? 0) >= DEMOTE_AFTER
}

/** Keys whose ignored tally reached the demotion threshold, regardless of tier. */
export function demotedKeys(threshold = DEMOTE_AFTER): Set<string> {
  const keys = new Set<string>()
  for (const [key, count] of ignoredCounts()) if (count >= threshold) keys.add(key)
  return keys
}

/** Compact adoption-stats block for tool output (route card, case_status, end_case). */
export function renderAdvisoryStats(limit = 5): string {
  const stats = advisoryStats()
  if (stats.size === 0) return ''
  const demoted = demotedKeys()
  const rows = [...stats.entries()]
    .sort((a, b) => (b[1].adopted + b[1].ignored) - (a[1].adopted + a[1].ignored))
    .slice(0, limit)
    .map(([key, v]) => `| ${key} | adopted=${v.adopted} ignored=${v.ignored}${demoted.has(key) ? ' | 已降频' : ''} |`)
  return '[建议采纳率]\n' + rows.join('\n')
}

/** Render the session's surviving advisories as one prompt section body. */
export function renderAdvisories(sessionId: string): string {
  const live = advisoryQueue(sessionId).filter((a) => !a.trackOnly && !isDemoted(a.key, a.tier))
  if (live.length === 0) return ''
  return live
    .map((a) => {
      const tag = a.tier === 'mandatory' ? 'MUST' : a.tier === 'recommended' ? 'SHOULD' : 'HINT'
      return `${tag} [${a.key}] ${a.content}`
    })
    .join('\n')
}