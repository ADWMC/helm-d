// Session-event fixture for the host-seam checks: builds envelopes shaped like the
// host's `SessionEvent` (`type`/`seq`/`time`/`data`, see dsh-session SessionEventMap).
// One responsibility: produce test events; it asserts nothing.
export function event(type, data) {
  return { type, seq: 0, time: 0, data }
}
