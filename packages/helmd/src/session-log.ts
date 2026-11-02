// Session event-log seam — the ONE place helm-d reads a session's event log.
//
// dsh 0.1.2-alpha.4 removed `Session.events` (card DSH-0.1.2-A4-03) in favour of
// `seq` / `eventAt()` / `snapshotEvents()` / `ownEvents()`. On a 0.1.5 host the legacy
// property is simply absent, so a direct read yields `undefined` and every consumer that
// guards with `Array.isArray(session.events)` degrades to "no events" without a sound —
// silent breakage instead of a diagnosable failure. Everything that needs the log goes
// through here, so the seam is stated once and a future host change has one edit point.

/** The session surface helm-d relies on; anything else is host-internal. */
export interface SessionLike {
  /** Current host: frozen snapshot of the whole append-only log, oldest first. */
  snapshotEvents?: () => readonly unknown[]
  /** Pre-0.1.2-alpha.4 host: the live log array (removed upstream). */
  events?: readonly unknown[]
  /** Session identity, when the host exposes it. */
  id?: string
  /** Durable session metadata; `delegationDepth > 0` marks a subagent child. */
  header?: { delegationDepth?: number }
}

/** The agent surface helm-d relies on. */
export interface AgentLike {
  id?: string
  session?: SessionLike
}

/** One `tool/call` event's payload, as helm-d needs it. */
export interface ToolCall {
  name: string
  args: string
}

/** Host session event names helm-d reads. One spelling per concept, exported. */
export const USER_MESSAGE = 'user/message'
export const ASSISTANT_MESSAGE = 'assistant/message'
export const TOOL_CALL = 'tool/call'

const warned = new Set<string>()

/** Warn once per process per key: hooks run every turn, the diagnosis is worth one line. */
export function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return
  warned.add(key)
  console.warn(`[helmd] ${message}`)
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * The agent's session event log, oldest first.
 * Empty when the host exposes no readable log — reported once, never silent.
 * @param agent - the assemble/tool context's agent; the session hangs off it.
 * @param scope - caller name, used as the once-per-process warning key and prefix.
 */
export function sessionEvents(agent: AgentLike | undefined, scope: string): readonly unknown[] {
  const session = agent?.session
  if (session == null) return []
  if (typeof session.snapshotEvents === 'function') {
    try {
      const events = session.snapshotEvents()
      if (Array.isArray(events)) return events
      warnOnce(`${scope}:shape`, `${scope}: session.snapshotEvents() did not return an array`)
      return []
    } catch (error) {
      warnOnce(`${scope}:throw`, `${scope}: session.snapshotEvents() failed (${describe(error)})`)
      return []
    }
  }
  if (Array.isArray(session.events)) return session.events
  warnOnce(
    `${scope}:no-accessor`,
    `${scope}: host session exposes neither snapshotEvents() nor events — consumers see an empty log `
    + '(dsh >= 0.1.2-alpha.4 requires snapshotEvents(); card DSH-0.1.2-A4-03)',
  )
  return []
}

/** One event's message text: a plain string or joined content blocks; '' otherwise. */
export function eventText(event: unknown): string {
  const content = (event as { data?: { message?: { content?: unknown } } } | undefined)?.data?.message?.content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content.map(blockText).filter(Boolean).join('\n')
}

function blockText(block: unknown): string {
  if (typeof block === 'string') return block
  const text = (block as { text?: unknown } | null)?.text
  return typeof text === 'string' ? text : ''
}

function eventType(event: unknown): string {
  return String((event as { type?: unknown } | undefined)?.type ?? '')
}

/** Whether the window holds any event of one of `types` (host event names, exact). */
export function hasEventType(events: readonly unknown[], types: readonly string[]): boolean {
  return events.some((event) => types.includes(eventType(event)))
}

/**
 * Text of the newest event of `type`; null when the window holds none.
 * An empty newest event stays empty — callers that need to look further back own that rule.
 */
export function latestEventText(events: readonly unknown[], type: string): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    if (eventType(events[i]) !== type) continue
    return eventText(events[i])
  }
  return null
}

/** Concatenated text of every event of `type`, in log order. */
export function eventTexts(events: readonly unknown[], type: string): string {
  return events.filter((event) => eventType(event) === type).map(eventText).filter(Boolean).join('\n')
}

/** How many events of `type` the window holds. */
export function eventCount(events: readonly unknown[], type: string): number {
  return events.filter((event) => eventType(event) === type).length
}

/** The `tool/call` events in the window, in order, with stringified arguments. */
export function toolCalls(events: readonly unknown[]): ToolCall[] {
  const calls: ToolCall[] = []
  for (const event of events) {
    if (eventType(event) !== TOOL_CALL) continue
    const data = (event as { data?: { name?: unknown; arguments?: unknown } }).data
    calls.push({ name: String(data?.name ?? ''), args: String(data?.arguments ?? '') })
  }
  return calls
}
