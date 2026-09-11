// Advisory ledger — every guidance helm-d injects into a session (hook directive,
// route_task recommendation, mode contract) carries a machine-checkable adoption
// proof. At the next prompt assembly the pending advisories are reckoned against
// the session's own event log; the verdict (adopted / ignored) is persisted, and
// guidance that keeps being ignored is demoted instead of repeating forever.
//
// This is deliberately not hook-scoped: any producer (tool, hook, preset) can
// submit, and the same ledger answers "did the agent act on what we told it?".

import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
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
  /**
   * Teach, then measure: render the reminder only while the ledger says this discipline is
   * not yet followed (see {@link shouldTeach}). Used for guidance that is worth stating a
   * few times but not forever — once the rate is good it stays a pure metric.
   */
  adaptive?: boolean
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

/** Ledger size that triggers compaction, and how many recent rows survive it. */
const LEDGER_COMPACT_BYTES = 4 * 1024 * 1024
const LEDGER_KEEP_ROWS = 5000

/** Sessions held in memory; the oldest insertion is evicted (no session-close hook exists). */
const MAX_PENDING_SESSIONS = 64

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
  if (pending.size > MAX_PENDING_SESSIONS) {
    const oldest = pending.keys().next().value
    if (oldest !== undefined && oldest !== sessionId) pending.delete(oldest)
  }
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
  const path = advisoryLedgerPath()
  try {
    // The ledger directory is created by the tool ledger on its first write. An advisory
    // can be reckoned before any tool_memory call ever ran, and a bare appendFileSync into
    // a missing directory throws ENOENT — swallowed below, so the row would be lost with
    // no signal while the tally stays empty and every adaptive reminder keeps teaching.
    mkdirSync(dirname(path), { recursive: true })
    appendFileSync(path, `${JSON.stringify({ ...entry, ts: new Date().toISOString() })}\n`, 'utf8')
    compactLedger(path)
  } catch {
    // Ledger write failure must never break prompt assembly.
  }
}

/**
 * Keep the ledger bounded: past the size cap the previous file is preserved as
 * `<ledger>.1` and only the newest rows carry over. Adoption rates are read from the
 * recent window, so an unbounded file buys nothing but latency.
 */
function compactLedger(path: string): void {
  let size = 0
  try {
    size = statSync(path).size
  } catch {
    return
  }
  if (size <= LEDGER_COMPACT_BYTES) return
  const rows = readFileSync(path, 'utf8').split('\n').filter((line) => line.trim() !== '')
  if (rows.length <= LEDGER_KEEP_ROWS) return
  copyFileSync(path, `${path}.1`)
  writeFileSync(path, `${rows.slice(-LEDGER_KEEP_ROWS).join('\n')}\n`, 'utf8')
  ledgerCache = null
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

/** One persisted reckoning row, as much of it as the tally needs. */
interface LedgerRow {
  key?: unknown
  tier?: unknown
  verdict?: unknown
}

/** Parsed ledger rows plus the file identity they came from. */
interface LedgerCache {
  path: string
  mtimeMs: number
  size: number
  rows: LedgerRow[]
}

let ledgerCache: LedgerCache | null = null

/**
 * The ledger's rows, parsed once per file change. The ledger gains a line per assistant
 * turn, and prompt assembly asks for these tallies every turn, so re-reading the whole
 * file per question would put a growing file scan on the hot path.
 */
function ledgerRows(): LedgerRow[] {
  const path = advisoryLedgerPath()
  if (!existsSync(path)) {
    ledgerCache = null
    return []
  }
  let mtimeMs = 0
  let size = 0
  try {
    const stat = statSync(path)
    mtimeMs = stat.mtimeMs
    size = stat.size
  } catch {
    return ledgerCache?.path === path ? ledgerCache.rows : []
  }
  if (ledgerCache !== null && ledgerCache.path === path && ledgerCache.mtimeMs === mtimeMs && ledgerCache.size === size) {
    return ledgerCache.rows
  }
  const rows: LedgerRow[] = []
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      rows.push(JSON.parse(trimmed) as LedgerRow)
    } catch {
      // malformed ledger line — skip
    }
  }
  ledgerCache = { path, mtimeMs, size, rows }
  return rows
}

interface Tally {
  adopted: number
  ignored: number
  tier: AdvisoryTier
}

/** Per-key tally from the cached rows; the last row's tier wins. */
function tally(): Map<string, Tally> {
  const out = new Map<string, Tally>()
  for (const row of ledgerRows()) {
    if (typeof row.key !== 'string') continue
    if (row.verdict !== 'adopted' && row.verdict !== 'ignored') continue
    const entry = out.get(row.key) ?? { adopted: 0, ignored: 0, tier: 'hint' }
    if (row.verdict === 'adopted') entry.adopted += 1
    else entry.ignored += 1
    if (isTier(row.tier)) entry.tier = row.tier
    out.set(row.key, entry)
  }
  return out
}

function isTier(value: unknown): value is AdvisoryTier {
  return value === 'mandatory' || value === 'recommended' || value === 'hint'
}

/** Ignored tally per key, read from the persisted ledger. */
export function ignoredCounts(): Map<string, number> {
  const counts = new Map<string, number>()
  for (const [key, entry] of tally()) counts.set(key, entry.ignored)
  return counts
}

/** Adopted / ignored tally per key, for the route card. */
export function advisoryStats(): Map<string, { adopted: number; ignored: number }> {
  const stats = new Map<string, { adopted: number; ignored: number }>()
  for (const [key, entry] of tally()) stats.set(key, { adopted: entry.adopted, ignored: entry.ignored })
  return stats
}

/** A non-mandatory advisory that keeps being ignored stops being surfaced. */
export function isDemoted(key: string, tier: AdvisoryTier): boolean {
  if (tier === 'mandatory') return false
  return (tally().get(key)?.ignored ?? 0) >= DEMOTE_AFTER
}

/**
 * Keys whose ignored tally reached the threshold and whose tier may actually be demoted.
 * Mandatory keys never are, so they must not be labelled as demoted either.
 */
export function demotedKeys(threshold = DEMOTE_AFTER): Set<string> {
  const keys = new Set<string>()
  for (const [key, entry] of tally()) {
    if (entry.ignored >= threshold && entry.tier !== 'mandatory') keys.add(key)
  }
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

/**
 * Teaching thresholds, measured over a SLIDING window of the key's most recent verdicts.
 * A cumulative rate cannot answer "is this being followed *now*": after enough good history
 * it never drops below the bar (so a later regression is never taught), and near the bar it
 * flaps. The window retires the reminder once the discipline holds and brings it back when
 * it degrades.
 */
const RECENT_WINDOW = 10
const TEACH_MIN_SAMPLES = 5
const TEACH_MIN_RATE = 0.7

/** This key's most recent verdicts, oldest → newest, capped at the window. */
function recentOutcomes(key: string, window = RECENT_WINDOW): Verdict[] {
  const out: Verdict[] = []
  for (const row of ledgerRows()) {
    if (row.key !== key) continue
    if (row.verdict !== 'adopted' && row.verdict !== 'ignored') continue
    out.push(row.verdict)
  }
  return out.slice(-window)
}

/**
 * Whether a teaching advisory is still worth rendering: until the recent window shows the
 * discipline is followed often enough, then never again — it stays a pure metric. Teaching
 * and measuring are the same submission; only the reminder retires.
 */
export function shouldTeach(key: string): boolean {
  const recent = recentOutcomes(key)
  if (recent.length < TEACH_MIN_SAMPLES) return true
  const adopted = recent.filter((verdict) => verdict === 'adopted').length
  return adopted / recent.length < TEACH_MIN_RATE
}

/** Render the session's surviving advisories as one prompt section body. */
export function renderAdvisories(sessionId: string): string {
  const live = advisoryQueue(sessionId).filter((a) => {
    if (a.trackOnly) return false
    if (isDemoted(a.key, a.tier)) return false
    return !a.adaptive || shouldTeach(a.key)
  })
  if (live.length === 0) return ''
  return live
    .map((a) => {
      const tag = a.tier === 'mandatory' ? 'MUST' : a.tier === 'recommended' ? 'SHOULD' : 'HINT'
      return `${tag} [${a.key}] ${a.content}`
    })
    .join('\n')
}