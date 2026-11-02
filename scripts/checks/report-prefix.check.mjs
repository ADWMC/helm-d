// Subject: the delivery-report metric. When the user asks for progress, the reply owes one
// of the four labels from AGENTS.md §9 / the persona OUTPUT section; the advisory ledger
// keeps the per-turn rate. Drives the built hook against a throwaway ledger directory.
import assert from 'node:assert/strict'
import { appendFileSync, mkdtempSync, rmSync } from 'node:fs'
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

const { registerAdvisoryHook, REPORT_KEY, isReportRequest } = await import(pathToFileURL(join(distDir, 'advisory-hook.js')).href)
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

/** Text of the section the hook injected into one assembly, if any. */
const injected = (assembly) => (assembly?.sections ?? []).map((s) => s.text ?? '').join('\n')

await report.check('while the discipline is unproven the reminder IS injected', async () => {
  events.push(user('进展如何？'))
  const result = await assemble()
  assert.match(injected(result), /已修复并验证/, 'the four labels should be taught while the rate is unproven')
  events.push(assistant('已修复并验证：本轮检查全绿'))
  await assemble()
})

await report.check('once the ledger shows it is followed the reminder retires', async () => {
  const stat = rate()
  const need = Math.max(0, 5 - (stat.adopted + stat.ignored))
  const rows = Array.from({ length: need }, () => JSON.stringify({
    key: REPORT_KEY, tier: 'mandatory', verdict: 'adopted', turnsWaited: 1, ts: '2026-01-01T00:00:00.000Z',
  }))
  if (rows.length) appendFileSync(join(home, 'advisories.jsonl'), `${rows.join('\n')}\n`, 'utf8')
  events.push(user('进展如何？'))
  const result = await assemble()
  assert.ok(!injected(result).includes('已修复并验证'), `reminder should retire, got: ${injected(result)}`)
  events.push(assistant('进展列表：已修复并验证 3 项'))
  await assemble()
})

await report.check('measurement continues after the reminder retires', async () => {
  const before = rate().adopted + rate().ignored
  events.push(user('进展如何？'))
  await assemble()
  events.push(assistant('已修复并验证：仍在记账'))
  await assemble()
  assert.equal(rate().adopted + rate().ignored, before + 1, 'the ledger keeps counting after teaching ends')
})

await report.check('the trigger needs both a work noun and an ask', () => {
  const asked = ['进展如何？', '修完了吗', 'any progress?', 'status update?', '还剩什么没做？', '汇报一下当前情况', "what's left?", 'are we done?']
  for (const turn of asked) assert.equal(isReportRequest(turn), true, `should ask for a report: ${turn}`)
  const notAsked = ['帮我分析这个样本', '查看服务状态', 'check the service status', '完成这个任务', '查看进程状态并汇报给日志']
  for (const turn of notAsked) assert.equal(isReportRequest(turn), false, `should not ask for a report: ${turn}`)
})

await report.check('a regression inside the recent window brings the reminder back', async () => {
  // Push the cumulative rate far above the bar (24/29) while the recent window is bad
  // (5 adopted / 5 ignored): a cumulative rule would stay retired, the window must teach.
  const rows = [
    ...Array.from({ length: 20 }, () => JSON.stringify({ key: REPORT_KEY, tier: 'mandatory', verdict: 'adopted', turnsWaited: 1, ts: '2026-01-01T00:00:00.000Z' })),
    ...Array.from({ length: 5 }, () => JSON.stringify({ key: REPORT_KEY, tier: 'mandatory', verdict: 'ignored', turnsWaited: 1, ts: '2026-01-01T00:00:00.000Z' })),
  ]
  appendFileSync(join(home, 'advisories.jsonl'), `${rows.join('\n')}\n`, 'utf8')
  events.push(user('进展如何？'))
  const result = await assemble()
  assert.match(injected(result), /已修复并验证/, 'a degraded recent window must be taught again')
  events.push(assistant('已修复并验证：窗口内回归，重新受教'))
  await assemble()
})

rmSync(home, { recursive: true, force: true })
report.finish()
