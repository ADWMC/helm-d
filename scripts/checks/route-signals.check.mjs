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

await report.check('native sample names and generic reverse tasks reach native guidance', () => {
  for (const hint of ['逆向', '分析这个 ELF', '检查 sample.so']) {
    assert.equal(primary(hint), 'native', `expected native for: ${hint}`)
  }
  assert.equal(primary('UPX 壳'), 'shell')
  assert.equal(primary('APK classes.dex'), 'apk')
})

await report.check('negated tasks do not override the requested target; short English signals match words', () => {
  assert.equal(primary('不要分析 APK，只看 ELF'), 'native')
  assert.equal(primary('请不要解密，仅检查 ELF'), 'native')
  assert.notEqual(primary('design review'), 'jvm')
  assert.equal(primary('检查 .so 的 Frida hook'), 'hook')
  assert.equal(seam.router.firstReference('检查 .so 的 Frida hook'), 'native/dynamic-analysis-frida.md')
})

report.finish()
