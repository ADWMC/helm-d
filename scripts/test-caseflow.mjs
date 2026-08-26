import { apply } from '../packages/helmd/dist/index.js'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.HELMD_CASES_DIR = mkdtempSync(join(tmpdir(), 'helmd-case-test-'))
const tools = []
const mk = () => ({ register: (d) => { if (d && d.name) tools.push(d) } })
const ctx = new Proxy({}, {
  get(t, p) {
    if (p === 'tools') { if (!t.tools) t.tools = mk(); return t.tools }   // 稳定服务对象，模拟真实 cordis
    if (p === 'on') return () => {}
    if (p === 'get') return () => undefined
    if (typeof p === 'string') return t[p]
  },
  set() { return true },
})
apply(ctx)
const T = Object.fromEntries(tools.map((d) => [d.name, d]))
const A = 'sess-A'

// 样本文件
import { writeFileSync } from 'node:fs'
const sample = join(process.env.HELMD_CASES_DIR, 'target.bin')
writeFileSync(sample, 'VMProtect marker .vmp0 section\x00\x01\x02binary')

let pass = 0, fail = 0
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS ${name}`) }
  else { fail++; console.log(`  FAIL ${name} ${extra}`) }
}

console.log('== 1. begin_case 建目录+哈希存证 ==')
const r1 = await T.begin_case.execute({ goal: 'analyze vm protector sample', samples: [sample] }, { agent: { id: A } })
check('返回 case 路径', r1.includes('helmd-cases') && r1.includes('case opened'), r1.slice(0, 120))
check('含四行规约', r1.includes('find_tool()') && r1.includes('case_status()'))

console.log('== 2. CASE.md 落盘内容 ==')
const fs = await import('node:fs/promises')
const casesBase = join(process.env.HELMD_CASES_DIR, 'helmd-cases')
const caseDir = (await fs.readdir(casesBase))[0]
const dir = join(casesBase, caseDir)
const cmd = await fs.readFile(join(dir, 'CASE.md'), 'utf8')
check('status open', cmd.includes('status: open'))
check('样本哈希 E-001', /E-001-sha256\.txt/.test((await fs.readdir(join(dir, 'evidence'))).join(',')))
check('BEGIN timeline', cmd.includes('BEGIN'))

console.log('== 3. 领域工具经 persist 钩子自动存证 ==')
const r3 = await T.hash_artifact.execute({ path: sample }, { agent: { id: A } })
check('hash 输出正常', r3.length > 0)
check('E 编号尾注', /\[evidence: E-\d{3} saved/.test(r3), r3.slice(-100))
const r3b = await T.scan_strings.execute({ path: sample }, { agent: { id: A } })
check('第二工具递增编号', /E-\d{3} saved/.test(r3b.slice(-90)), r3b.slice(-90))

console.log('== 4. 无绑定会话拿到软提示 ==')
const r4 = await T.hash_artifact.execute({ path: sample }, { agent: { id: 'sess-B' } })
check('no active case 尾注', r4.includes('[no active case'))
check('B 会话不串写', !/\[evidence:/.test(r4))

console.log('== 5. record_finding 校验 ==')
const evids = (await fs.readdir(join(dir, 'evidence'))).map(f => /^E-\d{3}/.exec(f)?.[0]).filter(Boolean)
const bad = await T.record_finding.execute({ title: 'x', detail: 'y', evidence_ids: ['E-099'] }, { agent: { id: A } })
check('假编号被拒', bad.includes('REJECTED') && bad.includes('E-099'))
const good = await T.record_finding.execute({
  title: 'packer identified', detail: '.vmp0 section indicates VMProtect family',
  evidence_ids: [evids[0]],
}, { agent: { id: A } })
check('真编号通过', good.startsWith('finding recorded'), good)

console.log('== 6. save_evidence 外部输出 ==')
const r6 = await T.save_evidence.execute({ label: 'ext-cli-run', content: 'some external tool stdout' }, { agent: { id: A } })
check('外部输出入链', /\[evidence: E-\d{3} saved/.test(r6))

console.log('== 7. case_status 续接视图 ==')
const r7 = await T.case_status.execute({}, { agent: { id: A } })
check('头部信息', r7.includes('status: open') && r7.includes(caseDir))
check('timeline 回放', r7.includes('recent timeline') && r7.includes('BEGIN'))

console.log('== 8. 压缩模拟：新会话发现最近 case ==')
const r8 = await T.case_status.execute({}, { agent: { id: 'sess-NEW' } })
check('提示 cases 根目录', r8.includes(process.env.HELMD_CASES_DIR))

console.log('== 9. deep 档 end_case 门禁（先关第一个，再开零 findings 的新 case）==')
const r9pre = await T.end_case.execute({ summary: 'first done' }, { agent: { id: A } })
check('第一个 case 关闭（有 finding）', r9pre.includes('case closed'))
await T.analysis_mode.execute({ level: 'deep' }, { agent: { id: A } })
const r9open = await T.begin_case.execute({ goal: 'deep-guard-check' }, { agent: { id: A } })
check('第二个 case 打开', r9open.includes('case opened'))
const dirsNow = await fs.readdir(casesBase)
const dir2 = join(casesBase, dirsNow.find((n) => n.includes('deep-guard')))
const r9a = await T.end_case.execute({}, { agent: { id: A } })
check('无 findings 拒绝关闭', r9a.includes('DEEP mode requires'), r9a.slice(0, 80))
// 新 case 证据命名空间独立：先存一条再引用
const r9ev = await T.save_evidence.execute({ label: 'probe', content: 'guard evidence' }, { agent: { id: A } })
const eid2 = /E-\d{3}/.exec(r9ev)?.[0]
check('新 case 独立从 E-001 起算', eid2 === 'E-001', r9ev)
const r9m = await T.record_finding.execute({
  title: 'guard pass', detail: 'recorded to satisfy deep gate',
  evidence_ids: [eid2],
}, { agent: { id: A } })
check('补 finding 通过', r9m.startsWith('finding recorded'))
const r9b = await T.end_case.execute({ summary: 'done for now' }, { agent: { id: A } })
check('有 finding 后正常关闭', r9b.includes('case closed'))
const cmdAfter = await fs.readFile(join(dir2, 'CASE.md'), 'utf8')
check('盖章 completed', cmdAfter.includes('status: completed'))

console.log('== 10. no-persist 名单豁免 ==')
const r10 = await T.skill_catalog.execute({ domain: 'case' }, { agent: { id: A } })
check('catalog 无尾注污染', !r10.includes('[no active case') && !r10.includes('[evidence:'))
check('新 case 目录条目存在', r10.includes('begin_case'))

console.log('== 11. find_tool 接线（网络容错）==')
const r11 = await T.find_tool.execute({ query: 'vmprotect unpacker', context: 'section .vmp0 from E-001' }, { agent: { id: A } })
check('结构化返回', r11.includes('variant queries:') && r11.includes('unpacker'))

console.log(`\n结果: ${pass} pass / ${fail} fail`)
await new Promise((r) => setTimeout(r, 200))
process.exit(fail ? 1 : 0)
