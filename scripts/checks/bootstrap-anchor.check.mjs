// Subject: bootstrap anchoring — the first-request catalog restriction and the
// promotion that lifts it, exercised against the CURRENT host session shape (a session
// that exposes snapshotEvents() and no longer `events`).
import assert from 'node:assert/strict'
import { loadArtifacts } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'
import { event } from './session-event-fixture.mjs'

const seam = await loadArtifacts()
if (seam === null) skip('bootstrap-anchor', 'need packages/helmd/dist and an installed @deepseek-ai/dsh')
const report = createReporter('bootstrap-anchor')

let waterfall = null
seam.bootstrap.applyBootstrapFilter(
  { on: (_name, handler) => { waterfall = handler }, logger: { warn: () => {} } },
  { shellTools: ['pwsh'], commonTools: ['read'], promoteOn: 'either' },
)

/** A session shaped like the running host: snapshotEvents() only, no `events`. */
const hostShaped = (events) => ({ id: 'agent-1', session: { id: 'session-1', snapshotEvents: () => events } })
const catalog = [{ name: 'pwsh' }, { name: 'read' }, { name: 'glob' }]
const assemble = (agent) => waterfall({}, { agent }, async () => ({ sections: [], tools: catalog }))
const promotion = event(seam.log.TOOL_CALL, { name: 'pwsh', arguments: '{}' })

await report.check('the pre-migration read can never see the log on this host shape', () => {
  const agent = hostShaped([promotion])
  assert.equal(Array.isArray(agent.session.events), false)
})
await report.check('cold session keeps the [pwsh, read] anchor', async () => {
  const assembled = await assemble(hostShaped([]))
  assert.deepEqual(assembled.tools.map((tool) => tool.name), ['pwsh', 'read'])
})
await report.check('a promotion event restores the full catalog', async () => {
  const assembled = await assemble(hostShaped([promotion]))
  assert.deepEqual(assembled.tools.map((tool) => tool.name), ['pwsh', 'read', 'glob'])
})
await report.check('a subagent child is never restricted', async () => {
  const child = { id: 'agent-2', session: { id: 'session-2', header: { delegationDepth: 1 }, snapshotEvents: () => [] } }
  const assembled = await assemble(child)
  assert.deepEqual(assembled.tools.map((tool) => tool.name), ['pwsh', 'read', 'glob'])
})
await report.check('a catalog without the anchor pair is exposed whole', async () => {
  let plain = null
  seam.bootstrap.applyBootstrapFilter(
    { on: (_name, handler) => { plain = handler }, logger: { warn: () => {} } },
    { shellTools: ['pwsh'], commonTools: ['read'], promoteOn: 'either' },
  )
  const assembled = await plain({}, { agent: hostShaped([]) }, async () => ({ sections: [], tools: [{ name: 'glob' }] }))
  assert.deepEqual(assembled.tools.map((tool) => tool.name), ['glob'])
})

report.finish()
