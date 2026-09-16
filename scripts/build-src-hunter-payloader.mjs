// Rebuild the src-hunter payloader knowledge as readable markdown.
//
// WHY: upstream ships payloader/by-category/**.md and payloader/tools/**.md, but
// those files are mojibake — they were written with GBK bytes decoded as latin1
// (verified: 'MySQL注入 - 基础探测' round-trips to 'MySQLע�� - ����̽��'). The raw
// JSON they were generated FROM is valid UTF-8, so the JSON is the authoritative
// source and the .md files are discarded.
//
// Output: packages/helmd/references/web/src-hunter/payloader/{by-category,tools}/
// with English kebab-case filenames (repo convention) and an index that mirrors
// upstream's category table.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const RAW = resolve(process.argv[2] ?? '')
if (!RAW || !existsSync(join(RAW, 'web.json'))) {
  console.error('usage: node scripts/build-src-hunter-payloader.mjs <path-to-payloader/raw>')
  process.exit(1)
}
const OUT = resolve('packages/helmd/references/web/src-hunter/payloader')

// Upstream Chinese category name -> output file basename (English kebab-case).
const FILE_OF_CATEGORY = {
  'SQL/NoSQL注入': 'sql-nosql-injection',
  'XSS跨站脚本': 'xss',
  'SSRF服务端请求伪造': 'ssrf',
  'RCE远程代码执行': 'rce',
  'LFI/RFI文件包含': 'lfi-rfi',
  'API安全': 'api-security',
  'SSTI模板注入': 'ssti',
  '认证漏洞': 'authentication',
  'XXE实体注入': 'xxe',
  'CSRF跨站请求伪造': 'csrf',
  '文件漏洞': 'file-vulnerabilities',
  '业务逻辑漏洞': 'business-logic',
  '框架漏洞': 'framework-vulnerabilities',
  'JWT安全': 'jwt',
  '云安全漏洞': 'cloud-security',
  'AI安全': 'ai-security',
  '缓存与CDN安全': 'cache-and-cdn',
  '开放重定向': 'open-redirect',
  '供应链攻击': 'supply-chain',
  '原型链污染': 'prototype-pollution',
  'WebSocket安全': 'websocket',
  '请求走私': 'request-smuggling',
  '点击劫持': 'clickjacking',
  '凭证窃取': 'credential-theft',
  '横向移动': 'lateral-movement',
  '权限提升': 'privilege-escalation',
  '免杀与规避': 'evasion',
  '隧道代理': 'tunneling',
  '信息收集': 'recon',
  '权限维持': 'persistence',
  'Exchange攻击': 'exchange',
  'ADCS攻击': 'adcs',
  'SharePoint攻击': 'sharepoint',
  '域渗透攻击': 'domain-pentest',
  '内网渗透': 'intranet-pentest',
  'Web渗透': 'web-pentest',
  'Windows渗透': 'windows-pentest',
  '反弹Shell': 'reverse-shell',
  '漏洞利用': 'exploitation',
  '密码攻击': 'password-attack',
  '系统命令': 'system-commands',
  '红队工具': 'red-team-tools',
  '编码解码': 'encoding-decoding',
  '域渗透': 'domain-pentest-tools',
}

function slug(cat) {
  return FILE_OF_CATEGORY[cat] ?? cat.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()
}

/** Render one execution-style block (shared shape: title/command/description/platform/syntaxBreakdown). */
function renderStep(s, i) {
  const out = [`#### ${s.title ?? `step ${i + 1}`}`]
  if (s.command) {
    const lang = /^(GET|POST|PUT|PATCH|DELETE|HEAD)\s/m.test(s.command) ? '' : ''
    out.push('', '```' + lang, String(s.command).trimEnd(), '```')
  }
  if (s.description) out.push('', s.description)
  const breaks = s.syntaxBreakdown ?? []
  if (breaks.length) {
    out.push('', '| 片段 | 说明 | 类型 |', '|---|---|---|')
    for (const b of breaks) {
      const cell = (v) => String(v ?? '').replace(/\|/g, '\|').replace(/\n/g, ' ')
      out.push(`| \`${cell(b.part)}\` | ${cell(b.explanation)} | ${cell(b.type)} |`)
    }
  }
  if (s.platform && s.platform !== 'all') out.push('', `> platform: \`${s.platform}\``)
  return out.join('\n')
}

function renderEntry(e, n) {
  const out = [`### ${n}. ${e.name}`, '']
  out.push(`- **id:** \`${e.id}\``)
  if (e.category) out.push(`- **分类:** ${e.category}${e.subCategory ? ` / ${e.subCategory}` : ''}`)
  if (e.tags?.length) out.push(`- **tags:** ${e.tags.map((t) => `\`${t}\``).join(' ')}`)
  out.push('')
  if (e.description) out.push(e.description, '')
  if (e.prerequisites?.length) {
    out.push('**前置条件**', '')
    for (const p of e.prerequisites) out.push(`- ${p}`)
    out.push('')
  }
  const exec = e.execution ?? []
  if (exec.length) {
    out.push('**利用步骤**', '')
    exec.forEach((s, i) => out.push(renderStep(s, i), ''))
  }
  const sections = [
    ['WAF 绕过', e.wafBypass],
    ['EDR 绕过', e.edrBypass],
  ]
  for (const [label, list] of sections) {
    if (!list?.length) continue
    out.push(`**${label}**`, '')
    list.forEach((s, i) => out.push(renderStep(s, i), ''))
  }
  if (e.opsecTips?.length) {
    out.push('**OPSEC**', '')
    for (const t of e.opsecTips) out.push(`- ${t}`)
    out.push('')
  }
  if (e.tutorial) out.push('**教程**', '', String(e.tutorial), '')
  if (e.references?.length) {
    out.push('**参考**', '')
    for (const r of e.references) out.push(typeof r === 'string' ? `- ${r}` : `- ${r.title ?? ''} ${r.url ?? ''}`.trim())
    out.push('')
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()
}

/** Render a raw JSON corpus into per-category files + an index table. */
function build(jsonName, subdir, title, intro) {
  const entries = JSON.parse(readFileSync(join(RAW, jsonName), 'utf8'))
  const byCat = new Map()
  for (const e of entries) {
    const cat = e.category ?? 'uncategorized'
    if (!byCat.has(cat)) byCat.set(cat, [])
    byCat.get(cat).push(e)
  }
  const dir = join(OUT, subdir)
  mkdirSync(dir, { recursive: true })
  const rows = []
  for (const cat of [...byCat.keys()].sort()) {
    const list = byCat.get(cat)
    const base = slug(cat)
    const fname = `${base}.md`
    const head = [
      `# ${cat} — ${title}`,
      '',
      `> 来源：src-hunter \`references/payloader/raw/${jsonName}\`（${list.length} 条）`,
      `> 本文件由 \`scripts/build-src-hunter-payloader.mjs\` 从结构化 JSON 生成；上游同名 \`.md\` 为乱码，已弃用。`,
      '',
      '---',
      '',
    ].join('\n')
    const body = list.map((e, i) => renderEntry(e, i + 1)).join('\n\n---\n\n')
    writeFileSync(join(dir, fname), head + body + '\n', 'utf8')
    rows.push({ cat, fname, count: list.length, subdir })
  }
  return { rows, total: entries.length, dir }
}

const web = build('web.json', 'by-category/web', 'Web 攻击 payload', '')
const intranet = build('intranet.json', 'by-category/intranet', '内网渗透 payload', '')
const tools = build('tools.json', 'tools', '工具命令速查', '')

const table = (rows, label) => {
  const lines = [`## ${label}`, '', '| 类别 | 数量 | 文件 |', '|------|----:|------|']
  for (const r of rows.sort((a, b) => b.count - a.count)) {
    lines.push(`| ${r.cat} | ${r.count} | [${r.subdir}/${r.fname}](${r.subdir}/${r.fname}) |`)
  }
  return lines.join('\n')
}

// waf-bypass.md upstream is readable UTF-8 (6501 lines) — copy as-is, don't rebuild.
const wafSrc = resolve(RAW, '..', 'waf-bypass.md')
let wafNote = ''
if (existsSync(wafSrc)) {
  const text = readFileSync(wafSrc, 'utf8')
  writeFileSync(join(OUT, 'waf-bypass.md'), text, 'utf8')
  wafNote = `- WAF/EDR 绕过变体：见 [waf-bypass.md](waf-bypass.md)（${text.split('\n').length} 行）`
}

writeFileSync(join(OUT, 'index.md'), [
  '# Payload 知识库（结构化）',
  '',
  '> 来源：src-hunter `references/payloader/`。原 markdown 为乱码（GBK 字节被当 latin1），',
  '> 此处全部由 `scripts/build-src-hunter-payloader.mjs` 从原始 JSON 重建，内容完整可读。',
  '',
  `- Web 攻击 payload: **${web.total}** 条 / ${web.rows.length} 类`,
  `- 内网渗透 payload: **${intranet.total}** 条 / ${intranet.rows.length} 类`,
  `- 工具命令速查: **${tools.total}** 条 / ${tools.rows.length} 类`,
  wafNote,
  '',
  '---',
  '',
  table(web.rows, `Web 攻击分类（${web.total} 条）`),
  '',
  table(intranet.rows, `内网渗透分类（${intranet.total} 条）`),
  '',
  table(tools.rows, `工具命令分类（${tools.total} 条）`),
  '',
].filter((l) => l !== null).join('\n'), 'utf8')

console.log(`payloader rebuilt: web=${web.total}/${web.rows.length}cats  intranet=${intranet.total}/${intranet.rows.length}cats  tools=${tools.total}/${tools.rows.length}cats`)
