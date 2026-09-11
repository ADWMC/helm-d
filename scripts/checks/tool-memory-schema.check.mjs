// Subject: the tool_memory parameter schema. Only `note` needs an evidence id, so the
// schema must not force callers to invent one for register/search/sync.
import assert from 'node:assert/strict'
import { loadArtifacts } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const seam = await loadArtifacts()
if (seam === null) skip('tool-memory-schema', 'need packages/helmd/dist and an installed @deepseek-ai/dsh')
const report = createReporter('tool-memory-schema')

let definition = null
seam.ledger.registerLedgerTool({ tools: { register: (def) => { definition = def } } })

await report.check('tool_memory registers one definition', () => {
  assert.ok(definition !== null, 'registerLedgerTool should call ctx.tools.register')
  assert.equal(definition.name, 'tool_memory')
})

await report.check('action stays required; evidence does NOT (note rejects it at execute time)', () => {
  // defineTool compiles the author map into JSON Schema; `required` is what the host validates against.
  const schema = definition.parameters
  assert.equal(schema?.type, 'object')
  assert.ok(Array.isArray(schema.required), 'parameters should carry a JSON-Schema required list')
  assert.ok(schema.required.includes('action'), `action must stay required: ${schema.required}`)
  assert.ok(!schema.required.includes('evidence'), `evidence must not be required: ${schema.required}`)
  assert.equal(schema.properties?.evidence?.type, 'string')
})

await report.check('an evidence-less note is still rejected by the handler', async () => {
  const verdict = await definition.execute({ action: 'note', tool_name: 'x', content: 'y' })
  assert.match(String(verdict), /REJECTED/)
})

report.finish()
