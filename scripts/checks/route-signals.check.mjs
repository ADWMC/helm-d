// Subject: route_task's signal matching. Generic Chinese "注入" and "劫持" are
// ambiguous native-domain terms; model evaluation and explicit LLM terms route to llm.
import assert from 'node:assert/strict'
import { loadArtifacts } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const seam = await loadArtifacts()
if (seam === null) skip('route-signals', 'need packages/helmd/dist and an installed @deepseek-ai/dsh')
const { matchRoute } = seam.router
const report = createReporter('route-signals')

const primary = (hint) => matchRoute(hint)[0]?.key ?? 'tree'

await report.check('LLM evaluation phrasing routes to llm', () => {
  for (const hint of ['模型评测', 'prompt injection', 'llm jailbreak']) {
    assert.equal(primary(hint), 'llm', `expected llm for: ${hint}`)
  }
})

await report.check('generic hijacking and injection hints do not route to llm', () => {
  for (const hint of ['dll 劫持 分析', '进程劫持 排查', '劫持 注入点']) {
    assert.notEqual(primary(hint), 'llm', `ambiguous/native hint must not route to llm: ${hint}`)
  }
})

report.finish()
