import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createReporter } from './reporter.mjs'

const root = join(import.meta.dirname, '..', '..', 'packages', 'helmd', 'references')
const read = (path) => readFileSync(join(root, path), 'utf8')
const report = createReporter('protection-skill-routing')

await report.check('reverse playbook routes signature triage to candidate verification first', () => {
  const triage = read('playbooks/reverse.yaml').split('  - id: triage\n')[1]?.split('  - id: map\n')[0]
  assert.ok(triage, 'missing triage phase')
  assert.match(triage, /read_reference\('native\/protection-detection-methodology\.md'\)/)
  assert.match(triage, /目标代码不可见时再读 native\/packer-handling\.md/)
  assert.doesNotMatch(triage, /toolbox\/patterns\.md.*触发表/)
})

await report.check('signature table and VMP shortcut do not assert automatic recovery or encryption', () => {
  const patterns = read('toolbox/patterns.md')
  assert.match(patterns, /UPX.*核对块布局与解包器版本/)
  assert.match(patterns, /SHVMP.*不能由名称推出 ChaCha20/)
  assert.doesNotMatch(patterns, /upx -d` 直接脱壳|仅动态分析，无法静态脱壳/)
  const vmp = read('native/vmp-pe-fast-triage.md')
  assert.match(vmp, /URLs=0.*仅说明当前搜索未命中/)
  assert.doesNotMatch(vmp, /VMP 完全加密，\*\*静态分析到此为止\*\*/)
})

await report.check('dynamic and DEX cards require calibrated observations, not absolute tool priority', () => {
  const ida = read('native/dynamic-analysis.md')
  const frida = read('native/dynamic-analysis-frida.md')
  const dex = read('android/android-unpacking.md')
  assert.match(ida, /断点及观测点校准/)
  assert.doesNotMatch(ida, /IDA 调试器（首选）|阶段 2\.5/)
  assert.match(frida, /先核实函数签名、ABI、地址和参数来源/)
  assert.doesNotMatch(frida, /阶段 3\.5b|IDA 调试器为首选/)
  assert.match(dex, /不能保证找到所有 DEX/)
  assert.match(dex, /区分|native ELF/)
  assert.doesNotMatch(read('native/crypto-validation-patterns.md'), /代码层面 100% 可靠/)
})

await report.check('case creation in reference cards names the actual tool', () => {
  assert.match(read('toolbox/tool-matrix.md'), /\| 创建 case 工作区 \| `begin_case`/)
  assert.doesNotMatch(read('native/jvm-mod-deobf-workflow.md'), /`create_case`/)
})

report.finish()
