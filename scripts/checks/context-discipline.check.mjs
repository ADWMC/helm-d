// Subject: T-08 large-output discipline. A tool result over 256KB must be
// stored in full as evidence while the model sees head/tail plus the E-id.
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { distDir } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const entry = join(distDir, 'persist.js')
if (!existsSync(entry)) skip('context-discipline', 'need packages/helmd/dist (run pnpm build)')
const home = mkdtempSync(join(tmpdir(), 'helmd-persist-'))
process.env.DSH_HOME = home
const caseApi = await import(pathToFileURL(join(distDir, 'case.js')).href)
const persist = await import(pathToFileURL(entry).href)
const report = createReporter('context-discipline')

const dir = join(home, 'helmd-cases', 'big-case')
mkdirSync(join(dir, 'evidence'), { recursive: true })
writeFileSync(join(dir, 'CASE.md'), 'status: open\ngoal: big\nmode: full\nroute: reverse\n')
caseApi.bindCase('sess-big', { dir, name: 'big-case', goal: 'big', mode: 'full', route: 'reverse' })

let tool
const tools = {
  register: (definition) => {
    tool = definition
    return () => {}
  },
}
const ctx = { tools }
persist.applyPersistenceWrap(ctx)
const large = 'HEAD\n' + 'x'.repeat(300 * 1024) + '\nTAIL'
const definition = {
  name: 'big_tool',
  execute: async () => large,
}
tools.register(definition)

await report.check('large output is fully persisted and returned as a head/tail stub', async () => {
  const out = await tool.execute({}, { agent: { id: 'sess-big' } })
  assert.match(out, /^\[evidence: E-001 saved/)
  assert.match(out, /head\/tail stub only/)
  assert.match(out, /^HEAD/m)
  assert.match(out, /TAIL$/m)
  assert.ok(out.length < large.length / 2, 'stub must be much smaller than the full output')
  const evidenceFile = join(dir, 'evidence', 'E-001-big_tool.txt')
  assert.equal(existsSync(evidenceFile), true)
  assert.equal(statSync(evidenceFile).size, Buffer.byteLength(large), 'evidence keeps the full output')
  assert.match(readFileSync(evidenceFile, 'utf8'), /TAIL$/)
  assert.equal(caseApi.countEvidence ? await caseApi.countEvidence(dir) : 1, 1)
})

await report.check('meta chain was written for the large capture', async () => {
  const metas = await caseApi.listEvidenceMeta(dir)
  assert.equal(metas.length, 1)
  assert.equal(metas[0].id, 'E-001')
  assert.match(metas[0].sha256, /^[a-f0-9]{64}$/)
})

rmSync(home, { recursive: true, force: true })
report.finish()
