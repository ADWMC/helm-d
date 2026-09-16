// One-shot migration: fold the src-hunter skill (SRC / bug-bounty workflow) into
// packages/helmd/references/web/src-hunter/ as a self-contained subtree.
//
// Precedent: AboutSecurity (as-*) and hack-skills (hs-*) integrations both landed
// FLAT in references/web/ with per-source index sections. src-hunter differs in two
// deliberate ways, both requested by the maintainer:
//   1. it lands in its own subdirectory (web/src-hunter/) so the SRC scope stays
//      separable from the existing white-box/black-box web corpus;
//   2. every source filename that violates the repo's `[a-z0-9-].md` convention is
//      translated to English kebab-case (the upstream payloader/ tree is Chinese).
//
// Usage: node scripts/merge-src-hunter.mjs <extracted-src-hunter-root>
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, cpSync, statSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'

const SRC = resolve(process.argv[2] ?? '')
if (!SRC || !existsSync(join(SRC, 'SKILL.md'))) {
  console.error('usage: node scripts/merge-src-hunter.mjs <extracted-src-hunter-root>')
  process.exit(1)
}
const REF = resolve('packages/helmd/references/web/src-hunter')
const SRCREF = join(SRC, 'references')
mkdirSync(REF, { recursive: true })

// ── 1. filename translation tables ─────────────────────────────────────────
// payloader/by-category/web/<CN>.md -> payloader/by-category/web/<en>.md
const WEB_CAT = {
  'ai安全': 'ai-security',
  'api安全': 'api-security',
  'csrf跨站请求伪造': 'csrf',
  'jwt安全': 'jwt',
  'lfi-rfi文件包含': 'lfi-rfi',
  'rce远程代码执行': 'rce',
  'sql-nosql注入': 'sql-nosql-injection',
  'ssrf服务端请求伪造': 'ssrf',
  'ssti模板注入': 'ssti',
  'websocket安全': 'websocket',
  'xss跨站脚本': 'xss',
  'xxe实体注入': 'xxe',
  '业务逻辑漏洞': 'business-logic',
  '云安全漏洞': 'cloud-security',
  '供应链攻击': 'supply-chain',
  '原型链污染': 'prototype-pollution',
  '开放重定向': 'open-redirect',
  '文件漏洞': 'file-vulnerabilities',
  '框架漏洞': 'framework-vulnerabilities',
  '点击劫持': 'clickjacking',
  '缓存与cdn安全': 'cache-and-cdn',
  '认证漏洞': 'authentication',
  '请求走私': 'request-smuggling',
}
// payloader/by-category/intranet/<CN>.md -> .../<en>.md
const INTRANET_CAT = {
  'adcs攻击': 'adcs',
  'exchange攻击': 'exchange',
  'sharepoint攻击': 'sharepoint',
  '信息收集': 'recon',
  '免杀与规避': 'evasion',
  '凭证窃取': 'credential-theft',
  '域渗透攻击': 'domain-pentest',
  '权限提升': 'privilege-escalation',
  '权限维持': 'persistence',
  '横向移动': 'lateral-movement',
  '隧道代理': 'tunneling',
}
// payloader/tools/<CN>.md -> payloader/tools/<en>.md
const TOOLS_CAT = {
  'web渗透': 'web-pentest',
  'windows渗透': 'windows-pentest',
  '信息收集': 'recon',
  '内网渗透': 'intranet-pentest',
  '凭证窃取': 'credential-theft',
  '反弹shell': 'reverse-shell',
  '域渗透': 'domain-pentest',
  '密码攻击': 'password-attack',
  '权限提升': 'privilege-escalation',
  '漏洞利用': 'exploitation',
  '系统命令': 'system-commands',
  '红队工具': 'red-team-tools',
  '编码解码': 'encoding-decoding',
  '隧道代理': 'tunneling',
}
const catName = (map, base) => map[base] ?? base
const kebab = (s) => s.replace(/\.md$/i, '').replace(/[_\s]+/g, '-').toLowerCase()

// ── 2. link rewriting ──────────────────────────────────────────────────────
// Upstream playbooks link as `references/playbooks/<x>.md`, `../methodology/...`,
// `references/h1-reports/by-weakness/<x>.md`, `references/payloader/...`.
// Inside the subtree those become sibling-relative paths.
function rewrite(text, fromDir) {
  return text
    // references/ ->  (subtree root === former references/ root)
    .replace(/\]\((?:\.\.\/)*references\//g, '](')
    .replace(/`(?:\.\.\/)*references\//g, '`')
    // bare payloader/<CN>.md mentions inside index tables
    .replace(/\]\(payloader\/by-category\/web\/([^)]+)\.md\)/g, (m, b) => `](payloader/by-category/web/${catName(WEB_CAT, b)}.md)`)
    .replace(/\]\(payloader\/by-category\/intranet\/([^)]+)\.md\)/g, (m, b) => `](payloader/by-category/intranet/${catName(INTRANET_CAT, b)}.md)`)
    .replace(/\]\(payloader\/tools\/([^)]+)\.md\)/g, (m, b) => `](payloader/tools/${catName(TOOLS_CAT, b)}.md)`)
    .replace(/\]\(by-category\/web\/([^)]+)\.md\)/g, (m, b) => `](by-category/web/${catName(WEB_CAT, b)}.md)`)
    .replace(/\]\(by-category\/intranet\/([^)]+)\.md\)/g, (m, b) => `](by-category/intranet/${catName(INTRANET_CAT, b)}.md)`)
    .replace(/\]\(tools\/([^)]+)\.md\)/g, (m, b) => `](tools/${catName(TOOLS_CAT, b)}.md)`)
}

// ── 3. copy playbooks (dirs + top-level files), rewriting links ────────────
function copyMdTree(from, to) {
  mkdirSync(to, { recursive: true })
  for (const e of readdirSync(from, { withFileTypes: true })) {
    const s = join(from, e.name)
    const d = join(to, e.name)
    if (e.isDirectory()) copyMdTree(s, d)
    else if (e.name.endsWith('.md')) writeFileSync(d, rewrite(readFileSync(s, 'utf8')), 'utf8')
  }
}
for (const dir of ['playbooks', 'methodology', 'dictionaries', 'industry']) {
  copyMdTree(join(SRCREF, dir), join(REF, dir))
}
mkdirSync(join(REF, 'templates'), { recursive: true })
writeFileSync(join(REF, 'templates', 'report-submission.md'), rewrite(readFileSync(join(SRCREF, 'templates', 'report-submission.md'), 'utf8')), 'utf8')
writeFileSync(join(REF, 'compliance.md'), rewrite(readFileSync(join(SRCREF, 'compliance.md'), 'utf8')), 'utf8')
copyMdTree(join(SRCREF, 'tools'), join(REF, 'tools'))

// ── 4. h1-reports: rendered by-weakness + raw JSON corpus ──────────────────
copyMdTree(join(SRCREF, 'h1-reports', 'by-weakness'), join(REF, 'h1-reports', 'by-weakness'))
cpSync(join(SRCREF, 'h1-reports', 'raw'), join(REF, 'h1-reports', 'raw'), { recursive: true })

console.log('copied playbooks/methodology/dictionaries/industry/templates/tools/h1-reports')
