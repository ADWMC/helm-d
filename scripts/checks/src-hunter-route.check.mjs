// Subject: the src-hunter capability tier. Two things can silently rot here:
//   1. the SRC signal words stop routing to `srchunter`, so the 50MB subtree is
//      unreachable and the fusion is dead weight;
//   2. the subtree's entry files move/rename, so the route card points at nothing.
// This check pins both, and asserts the subtree stays OUT of the other domains.
import assert from 'node:assert/strict'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { loadArtifacts, repoRoot } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const seam = await loadArtifacts()
if (seam === null) skip('src-hunter-route', 'need packages/helmd/dist and an installed @deepseek-ai/dsh')
const { matchRoute } = seam.router
const report = createReporter('src-hunter-route')
const primary = (hint) => matchRoute(hint)[0]?.key ?? 'tree'

const SRC_HUNTER = join(repoRoot, 'packages', 'helmd', 'references', 'web', 'src-hunter')

await report.check('SRC/bug-bounty phrasing routes to srchunter', () => {
  for (const hint of [
    'src 挖洞', '众测项目怎么打', 'bug bounty 目标', 'hackerone 报告怎么写',
    '补天 SRC', 'HVV 攻防', '任意账号登录', '密码重置绕过',
    '默认凭据 未授权访问', '支付漏洞 逻辑漏洞',
  ]) {
    assert.equal(primary(hint), 'srchunter', `expected srchunter for: ${hint}`)
  }
})

await report.check('ordinary web analysis does NOT get pulled into srchunter', () => {
  for (const hint of ['xss 绕过', 'ssrf 探测内网', 'idor 越权测试', 'csrf 检测']) {
    assert.notEqual(primary(hint), 'srchunter', `ordinary web hint must not route to srchunter: ${hint}`)
  }
})

await report.check('the route card opens a real entry file and warns against bulk loading', async () => {
  const text = seam.router.renderRoute('众测 挖洞')
  assert.match(text, /src-hunter\/index\.md/, 'card must name src-hunter/index.md')
  assert.match(text, /按需 Read/, 'card must warn against loading the whole subtree')
})

await report.check('every path the route card names exists on disk', () => {
  for (const rel of [
    'index.md',
    'methodology/00-index.md',
    'playbooks/00-index.md',
    'payloader/index.md',
    'compliance.md',
    'templates/report-submission.md',
  ]) {
    assert.ok(existsSync(join(SRC_HUNTER, rel)), `missing src-hunter entry file: ${rel}`)
  }
})

await report.check('read_reference resolves every path the docs actually use', () => {
  // Regression: the cross-reference pointers and the route card address the subtree
  // as "src-hunter/...", which only resolves if resolveReferenceFile falls back to a
  // domain-relative lookup. A bare directory must also yield its index.md, never the
  // directory itself (readText would then throw EISDIR).
  const refRoot = join(repoRoot, 'packages', 'helmd', 'references')
  const { resolveReferenceFile } = seam.router
  const must = [
    'src-hunter/index.md',
    'src-hunter',
    'src-hunter/payloader/index.md',
    'src-hunter/playbooks/xss/00-index.md',
    'src-hunter/methodology/00-index.md',
    'src-hunter/compliance.md',
    'src-hunter/templates/report-submission.md',
    'sql-injection.md',
  ]
  for (const rel of must) {
    const abs = resolveReferenceFile(refRoot, rel)
    assert.ok(abs, 'unresolved: ' + rel)
    assert.ok(existsSync(abs) && statSync(abs).isFile(), 'not a readable file: ' + rel + ' -> ' + abs)
  }
  for (const rel of ['does-not-exist.md', 'src-hunter/nope/missing.md']) {
    assert.equal(resolveReferenceFile(refRoot, rel), null, 'expected null for: ' + rel)
  }
})

await report.check('the subtree stays under web/ and leaks into no other domain', () => {
  for (const domain of ['native', 'protocol', 'malware', 'android', 'ai-security', 'evidence', 'toolbox']) {
    const leaked = join(repoRoot, 'packages', 'helmd', 'references', domain, 'src-hunter')
    assert.ok(!existsSync(leaked), `src-hunter must not appear under ${domain}/`)
  }
  assert.ok(existsSync(SRC_HUNTER), 'src-hunter subtree is missing from references/web/')
})

report.finish()
