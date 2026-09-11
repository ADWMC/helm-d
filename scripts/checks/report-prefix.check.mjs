// Subject: the delivery-report metric. When the user asks for progress, the reply owes one
// of the four labels from AGENTS.md §9 / the persona OUTPUT section; the advisory ledger
// keeps the per-turn rate. Drives the built hook against a throwaway ledger directory.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { distDir, pluginEntry } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const entry = pluginEntry()
if (entry === null) skip('report-prefix', 'need packages/helmd/dist (run pnpm build)')

const home = mkdtempSync(join(tmpdir(), 'helmd-report-'))
process.env.HELMD_TOOLS_DIR = home
const report = createReporter('report-prefix')

const { registerAdvisoryHook, REPORT_KEY } = await import(pathToFileURL(join(distDir, 'advisory-hook.js')).href)
const { advisoryStats } = await import(pathToFileURL(join(distDir, 'advisory.js')).href)

/** Capture the assembly listener the hook registers. */
let listener = null
registerAdvisoryHook({ on: (_name, handler) => { listener = handler } })

const user = (text) => ({ type: 'user/message', data: { message: { content: text } } })
const assistant = (text) => ({ type: 'assistant/message', data: { message: { content: text } } })
/** One accumulating session log, the way a real session grows turn by turn. */
const events = []
const sessionOf = () => ({ agent: { id: 'check', session: { id: 'check', snapshotEvents: () => events } } })
const assemble = () => listener({}, sessionOf(), async () => ({ sections: [] }))
const rate = () => advisoryStats().get(REPORT_KEY) ?? { adopted: 0, ignored: 0 }

await report.check('a reply labelled with a report prefix is adopted', async () => {
  events.push(user('进展如何？'))
  await assemble()
  events.push(assistant('已修复并验证：pnpm test:checks 10 PASS'))
  await assemble()
  assert.equal(rate().adopted, 1, `expected one adoption, got ${JSON.stringify(rate())}`)
})

await report.check('an unlabelled report is recorded as ignored', async () => {
  events.push(user('进展如何？'))
  await assemble()
  events.push(assistant('都弄好了，没问题。'))
  await assemble()
  assert.equal(rate().ignored, 1, `expected one ignore, got ${JSON.stringify(rate())}`)
})

await report.check('a non-report turn does not arm the metric', async () => {
  const before = rate()
  events.push(user('帮我分析这个样本'))
  await assemble()
  events.push(assistant('样本已分诊，见 E-001。'))
  await assemble()
  assert.deepEqual(rate(), before, 'ordinary task turns must not move this metric')
})

rmSync(home, { recursive: true, force: true })
report.finish()
