// Subject: the session-log seam — reading the host log and extracting text/tool calls.
// Driven by the REAL host `dsh-session` package, so a host accessor change (dsh
// 0.1.2-alpha.4 removed `Session.events`) fails here instead of silently degrading
// helm-d's hooks to "no events" inside a live session.
import assert from 'node:assert/strict'
import { loadArtifacts } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'
import { event } from './session-event-fixture.mjs'

const seam = await loadArtifacts()
if (seam === null) skip('session-log', 'need packages/helmd/dist and an installed @deepseek-ai/dsh')
const { ASSISTANT_MESSAGE, TOOL_CALL, USER_MESSAGE } = seam.log
const { eventCount, eventText, hasEventType, latestEventText, sessionEvents, toolCalls } = seam.log
const report = createReporter('session-log')
console.log(`session-log: host=${seam.hostEntry}`)

// 1. Accessor: the current host exposes snapshotEvents() and no longer `events`.
const session = seam.host.Session.create(seam.host.SessionId('session-probe-seam'), [], undefined, 0)
await report.check('host Session exposes snapshotEvents()', () => {
  assert.equal(typeof session.snapshotEvents, 'function')
})
await report.check('host Session no longer exposes events (the pre-migration read returns undefined)', () => {
  assert.equal(session.events, undefined)
})
await report.check('sessionEvents() reads the real host log', () => {
  const events = sessionEvents({ id: 'probe', session }, 'session-log-check')
  assert.equal(events.length, session.snapshotEvents().length)
  assert.ok(events.length >= 1, 'a created session holds at least its own marker event')
})

// 2. Legacy hosts keep working; an unreadable log is reported once, never silently empty.
await report.check('legacy host exposing only events still reads', () => {
  const legacy = { session: { id: 'legacy', events: [event(TOOL_CALL, { name: 'pwsh', arguments: '{}' })] } }
  assert.equal(sessionEvents(legacy, 'session-log-check').length, 1)
})
await report.check('no accessor at all: empty log plus exactly one warning', () => {
  const warnings = []
  const realWarn = console.warn
  console.warn = (message) => warnings.push(String(message))
  try {
    sessionEvents({ session: { id: 'none' } }, 'session-log-check')
    sessionEvents({ session: { id: 'none' } }, 'session-log-check')
  } finally {
    console.warn = realWarn
  }
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /neither snapshotEvents\(\) nor events/)
})

// 3. Extraction against the host's declared payload shapes (SessionEventMap).
const user = event(USER_MESSAGE, { message: { content: '分析这个样本' } })
const assistant = event(ASSISTANT_MESSAGE, { message: { content: [{ type: 'text', text: '结论如下' }] } })
const call = event(TOOL_CALL, { name: 'pwsh', arguments: '{"command":"ls"}' })
await report.check('eventText handles string and content-block messages', () => {
  assert.equal(eventText(user), '分析这个样本')
  assert.equal(eventText(assistant), '结论如下')
})
await report.check('window helpers agree on types and payloads', () => {
  const window = [user, assistant, call]
  assert.equal(latestEventText(window, ASSISTANT_MESSAGE), '结论如下')
  assert.equal(latestEventText(window, USER_MESSAGE), '分析这个样本')
  assert.equal(hasEventType(window, [TOOL_CALL]), true)
  assert.equal(eventCount(window, ASSISTANT_MESSAGE), 1)
  assert.deepEqual(toolCalls(window), [{ name: 'pwsh', args: '{"command":"ls"}' }])
})
await report.check('an empty newest assistant event stays empty (H-CoT keeps its original rule)', () => {
  const empty = event(ASSISTANT_MESSAGE, { message: { content: '' } })
  assert.equal(latestEventText([assistant, empty], ASSISTANT_MESSAGE), '')
})

report.finish()
