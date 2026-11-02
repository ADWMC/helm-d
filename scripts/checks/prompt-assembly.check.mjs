// Subject: the prompt-assembly seam adapter — the host event name it wires, and the
// before/after ordering contract that helm-d's advisory producers depend on.
import assert from 'node:assert/strict'
import { loadArtifacts } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const seam = await loadArtifacts()
if (seam === null) skip('prompt-assembly', 'need packages/helmd/dist and an installed @deepseek-ai/dsh')
const { registerAssemblyListener } = seam.assembly
const report = createReporter('prompt-assembly')

await report.check('wires the host waterfall event name', () => {
  let seen = null
  registerAssemblyListener({ on: (name, handler) => { seen = { name, handler } } }, {})
  assert.equal(seen.name, 'system-prompt/assemble')
  assert.equal(typeof seen.handler, 'function')
})

// Registration order is the contract: the listener registered first is OUTER, so its
// `before` runs before inner listeners and its `after` runs after them.
const ordering = []
let waterfall = null
registerAssemblyListener(
  { on: (_name, handler) => { waterfall = handler } },
  {
    before: () => ordering.push('outer-before'),
    after: (assembled) => ({
      ...assembled,
      sections: [...(Array.isArray(assembled.sections) ? assembled.sections : []), { name: 'helmd:advisories', text: 'A' }],
    }),
  },
)
const assembled = await waterfall({}, { agent: { id: 'a', session: { id: 's' } } }, async () => {
  ordering.push('inner')
  return { sections: [{ name: 'deployment:persona-prefix', text: 'P' }], tools: [{ name: 'pwsh' }], variables: { x: '1' } }
})
await report.check('before runs before inner listeners; after runs after them', () => {
  assert.deepEqual(ordering, ['outer-before', 'inner'])
})
await report.check('after appends its section and preserves every other field', () => {
  assert.deepEqual(assembled.sections.map((section) => section.name), ['deployment:persona-prefix', 'helmd:advisories'])
  assert.deepEqual(assembled.tools, [{ name: 'pwsh' }])
  assert.deepEqual(assembled.variables, { x: '1' })
})
let passthrough = null
registerAssemblyListener({ on: (_name, handler) => { passthrough = handler } }, { before: () => {} })
const inner = { sections: [{ name: 'X', text: 'x' }] }
const untouched = await passthrough({}, { agent: undefined }, async () => inner)
await report.check('a listener without after returns the inner assembly untouched', () => {
  assert.equal(untouched, inner)
})

report.finish()
