// Subject: route_task's signal matching. `劫持` alone is a native-domain word (DLL /
// process hijacking); only H-CoT phrasing may route to the H-CoT reference.
import assert from 'node:assert/strict'
import { loadArtifacts } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const seam = await loadArtifacts()
if (seam === null) skip('route-signals', 'need packages/helmd/dist and an installed @deepseek-ai/dsh')
const { matchRoute } = seam.router
const report = createReporter('route-signals')

const primary = (hint) => matchRoute(hint)[0]?.key ?? 'tree'

await report.check('H-CoT phrasing still routes to hcot', () => {
  for (const hint of ['h-cot 思维链劫持', '思维链 越狱', 'chain-of-thought hijacking']) {
    assert.equal(primary(hint), 'hcot', `expected hcot for: ${hint}`)
  }
})

await report.check('native hijacking hints no longer route to hcot (the regression)', () => {
  for (const hint of ['dll 劫持 分析', '进程劫持 排查', '劫持 注入点']) {
    assert.notEqual(primary(hint), 'hcot', `native hint must not route to hcot: ${hint}`)
  }
})

report.finish()
