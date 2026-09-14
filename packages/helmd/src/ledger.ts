// Tool Ledger — file-based memory binding tool dir / usage / responsibility,
// plus a dead-end ledger. Explicit writes only (register/note); notes require
// an evidence id or case reference — no auto-extraction, no fabricated status.

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

export function ledgerDir(): string {
  const env = process.env.HELMD_TOOLS_DIR?.trim()
  return env || join(homedir(), '.dsh', 'helmd-tools')
}

const TOOLS_MD = () => join(ledgerDir(), 'TOOLS.md')
const DEADENDS_MD = () => join(ledgerDir(), 'DEAD_ENDS.md')

const TOOLS_TEMPLATE = [
  '# Tool Ledger — 工具账本',
  '',
  '> 由 tool_memory 维护，人可直接编辑。每工具一个条目：目录/用法/职责/坑。',
  '',
  '## 货架速览',
  '',
  '| 工具 | 职责 | 状态 |',
  '|---|---|---|',
  '',
].join('\n')

const DEADENDS_TEMPLATE = [
  '# Dead-End Ledger — 死路账本',
  '',
  '> 已证伪路线（2-3 次无实质突破），一entry一路线。route_task 卡片自动注入 Top3。',
  '',
  '## 死路速览',
  '',
  '| 特征 | 战术 | 根因 |',
  '|---|---|---|',
  '',
].join('\n')

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function ensureFile(p: string, template: string): string {
  if (!existsSync(p)) {
    mkdirSync(ledgerDir(), { recursive: true })
    writeFileSync(p, template, 'utf8')
  }
  return readFileSync(p, 'utf8')
}

/** Insert a row right after the overview table separator line. */
function addTableRow(text: string, heading: string, row: string): string {
  const lines = text.split('\n')
  const hIdx = lines.findIndex((l) => l.startsWith(heading))
  if (hIdx === -1) return text + '\n' + row + '\n'
  let sep = -1
  for (let i = hIdx + 1; i < lines.length; i++) {
    if (/^\|[-\s|]+\|$/.test(lines[i].trim())) { sep = i; break }
    if (lines[i].startsWith('## ')) break
  }
  if (sep === -1) return text + '\n' + row + '\n'
  lines.splice(sep + 1, 0, row)
  return lines.join('\n')
}

/** Append content at the end of a `## <title>` section (before next `## `); false when section absent. */
function appendToSection(text: string, title: string, block: string): string | false {
  const lines = text.split('\n')
  const start = lines.findIndex((l) => l.trim() === `## ${title}`)
  if (start === -1) return false
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) { end = i; break }
  }
  lines.splice(end, 0, ...block.split('\n'))
  return lines.join('\n')
}

export function registerToolEntry(name: string, toolPath: string, purpose: string, usage?: string, version?: string): string {
  const safe = name.replace(/[^a-zA-Z0-9_-]+/g, '_')
  mkdirSync(join(ledgerDir(), safe), { recursive: true })
  let text = ensureFile(TOOLS_MD(), TOOLS_TEMPLATE)
  const section = `## ${safe}`
  if (!text.includes(section)) {
    const entry = [
      '',
      section,
      `- 路径: ${toolPath}`,
      `- 版本: ${version || 'unknown'}（${today()} 登记）`,
      `- 职责: ${purpose}`,
      ...(usage ? [`- 用法:\n\`\`\`bash\n${usage}\n\`\`\``] : []),
      '- 坑: (暂无)',
      `- 状态: installed（${today()}）`,
      '',
    ].join('\n')
    text = addTableRow(text, '## 货架速览', `| ${safe} | ${purpose.slice(0, 40)} | installed |`)
    text = text.trimEnd() + '\n' + entry
  } else {
    const block = `\n> re-register（${today()}）: 路径=${toolPath} 职责=${purpose}${version ? ` 版本=${version}` : ''}`
    const updated = appendToSection(text, safe, block)
    text = updated === false ? text.trimEnd() + '\n' + block + '\n' : updated
  }
  writeFileSync(TOOLS_MD(), text, 'utf8')
  return join(ledgerDir(), safe)
}

export function noteTool(toolName: string, content: string, evidence: string, kind: 'pitfall' | 'template'): void {
  const safe = toolName.replace(/[^a-zA-Z0-9_-]+/g, '_')
  let text = ensureFile(TOOLS_MD(), TOOLS_TEMPLATE)
  if (!text.includes(`## ${safe}`)) {
    // implicit registration with minimal info
    text = addTableRow(text, '## 货架速览', `| ${safe} | (待补职责) | noted |`)
    text = text.trimEnd() + '\n' + [``, `## ${safe}`, `- 路径: (未登记)`, `- 职责: (待补)`, `- 状态: noted`, ``].join('\n')
  }
  const block = `\n- ${kind === 'pitfall' ? '坑' : '用法'}（${today()}，证据:${evidence}）: ${content}`
  const updated = appendToSection(text, safe, block)
  text = updated === false ? text.trimEnd() + '\n' + block + '\n' : updated
  writeFileSync(TOOLS_MD(), text, 'utf8')
}

export function noteDeadEnd(featureTag: string, tactic: string, rootCause: string, evidence: string): void {
  let text = ensureFile(DEADENDS_MD(), DEADENDS_TEMPLATE)
  text = addTableRow(text, '## 死路速览', `| ${featureTag} | ${tactic.slice(0, 30)} | ${rootCause.slice(0, 40)} |`)
  text = text.trimEnd() + '\n' + [
    '',
    `## ${featureTag} — ${tactic}`,
    `- 根因: ${rootCause}`,
    `- 证据: ${evidence}`,
    `- 日期: ${today()}`,
    '',
  ].join('\n')
  writeFileSync(DEADENDS_MD(), text, 'utf8')
}

export function searchLedger(query: string): string {
  const out: string[] = []
  for (const [label, p, tpl] of [
    ['工具账本', TOOLS_MD(), TOOLS_TEMPLATE],
    ['死路账本', DEADENDS_MD(), DEADENDS_TEMPLATE],
  ] as const) {
    const text = ensureFile(p, tpl)
    const q = query.toLowerCase()
    const sections = text.split(/\n(?=## )/)
    const hits = sections.filter((s) => s.toLowerCase().includes(q) && !s.startsWith('# Tool') && !s.startsWith('# Dead'))
    if (hits.length) out.push(`=== ${label} 命中 ${hits.length} 节 ===\n` + hits.join('\n'))
  }
  return out.length ? out.join('\n\n') : `账本无「${query}」命中。可用 tool_memory register/note 补录。`
}

/** Shelf overview + top dead-ends for the route card. Silent when ledgers absent/empty. */
// ── H-CoT 结果账本回流 ───────────────────────────────────────────────
const HCOT_MIN_SAMPLES = 3

/** Result-ledger path; mirrors the Python runner's resolution order. */
export function hcotLedgerPath(): string {
  return process.env.HELMD_HCOT_LEDGER?.trim() || join(ledgerDir(), 'h_cot_results.jsonl')
}

interface HcotAgg {
  model: string
  variant: string
  total: number
  brk: number
  transfer: number
  transferTotal: number
  score: number
}

function readHcotRecords(): Array<Record<string, unknown>> {
  const p = hcotLedgerPath()
  if (!existsSync(p)) return []
  const out: Array<Record<string, unknown>> = []
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      out.push(JSON.parse(trimmed) as Record<string, unknown>)
    } catch {
      // malformed ledger line — skip it rather than fail the sync
    }
  }
  return out
}

function hcotAggregate(): HcotAgg[] {
  const map = new Map<string, HcotAgg>()
  for (const r of readHcotRecords()) {
    const model = typeof r.model === 'string' ? r.model : '?'
    const variant = typeof r.variant === 'string' ? r.variant : ''
    if (!variant) continue
    const key = `${model}::${variant}`
    const a = map.get(key) ?? { model, variant, total: 0, brk: 0, transfer: 0, transferTotal: 0, score: 0 }
    const brk = Boolean(r.break ?? r.first_fragment_leaked)
    a.total += 1
    if (brk) a.brk += 1
    if (typeof r.transfer_compliant === 'boolean') {
      a.transferTotal += 1
      if (r.transfer_compliant) a.transfer += 1
    }
    a.score += typeof r.score === 'number' ? r.score : brk ? 1 : 0
    map.set(key, a)
  }
  return [...map.values()]
}

/** Fold the H-CoT result ledger into the tool + dead-end ledgers. Idempotent. */
export function syncHcotLedger(): string {
  const aggs = hcotAggregate()
  if (aggs.length === 0) return ''
  const byModel = new Map<string, HcotAgg[]>()
  for (const a of aggs) {
    const list = byModel.get(a.model) ?? []
    list.push(a)
    byModel.set(a.model, list)
  }
  const notes: string[] = []
  for (const [model, list] of byModel) {
    const mature = list.filter((a) => a.total >= HCOT_MIN_SAMPLES)
    const best = mature.slice().sort((x, y) => y.score / y.total - x.score / x.total)[0]
    if (best && best.score > 0) {
      const transfer = best.transferTotal ? `${best.transfer}/${best.transferTotal}` : '-'
      const content = `model=${model} 首选变体=${best.variant} break=${best.brk}/${best.total} transfer=${transfer} mean_score=${(best.score / best.total).toFixed(2)}`
      if (!ensureFile(TOOLS_MD(), TOOLS_TEMPLATE).includes(content)) {
        noteTool('hcot_attack', content, 'h_cot_results.jsonl', 'template')
        notes.push(`winner ${model} -> ${best.variant}`)
      }
      // 货架速览行：shelfSummary 只收表格行，故把首选变体补成一行
      const rowKey = `| hcot_attack/${model} `
      const shelf = ensureFile(TOOLS_MD(), TOOLS_TEMPLATE)
      if (!shelf.includes(rowKey)) {
        writeFileSync(TOOLS_MD(), addTableRow(shelf, '## 货架速览', `| hcot_attack/${model} | 首选 ${best.variant} break=${best.brk}/${best.total} | picked |`), 'utf8')
        notes.push(`shelf ${model}`)
      }
    }
    for (const a of mature) {
      if (a.brk === 0) {
        const tag = `H-CoT/${model}/${a.variant}`
        if (!ensureFile(DEADENDS_MD(), DEADENDS_TEMPLATE).includes(tag)) {
          noteDeadEnd(tag, 'H-CoT 变体注入', `连续 ${a.total} 次 break=0（首段与最终均被拒）`, 'h_cot_results.jsonl')
          notes.push(`deadend ${model}/${a.variant}`)
        }
      }
    }
  }
  return notes.length ? `[H-CoT 账本回流] ${notes.join('; ')}` : ''
}

export interface ShelfToolItem {
  name: string
  cat: string
  desc: string
  path: string
  status: string
}

/**
 * Parse structured tool list from TOOLS.md so both the host plane and
 * web client can dynamically display the real installed tools on the shelf.
 */
export function readShelfTools(): ShelfToolItem[] {
  try {
    const p = TOOLS_MD()
    if (!existsSync(p)) return []
    const text = readFileSync(p, 'utf8')
    const sections = text.split(/\n(?=## )/)
    const items: ShelfToolItem[] = []

    for (const sec of sections) {
      if (!sec.startsWith('## ') || sec.startsWith('## 货架速览') || sec.startsWith('## 死路速览')) continue
      const lines = sec.split('\n')
      const name = lines[0].replace(/^##\s+/, '').trim()
      let path = '(未登记)'
      let purpose = '(待补职责)'
      let status = 'installed'
      let cat = '逆向分析'

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('- 路径:')) {
          path = trimmed.replace(/^- 路径:\s*/, '').trim()
        } else if (trimmed.startsWith('- 职责:')) {
          purpose = trimmed.replace(/^- 职责:\s*/, '').trim()
        } else if (trimmed.startsWith('- 状态:')) {
          status = trimmed.replace(/^- 状态:\s*/, '').trim()
        }
      }

      // Auto-classify category based on purpose / name keywords
      const pLower = (name + ' ' + purpose).toLowerCase()
      if (pLower.includes('混淆') || pLower.includes('脱壳') || pLower.includes('unpack') || pLower.includes('de4dot')) {
        cat = '反混淆 / 脱壳'
      } else if (pLower.includes('android') || pLower.includes('apk') || pLower.includes('dex') || pLower.includes('jadx')) {
        cat = 'Android 逆向'
      } else if (pLower.includes('hook') || pLower.includes('插桩') || pLower.includes('frida') || pLower.includes('hwbp') || pLower.includes('断点')) {
        cat = '动态插桩 / 调试'
      } else if (pLower.includes('web') || pLower.includes('渗透') || pLower.includes('sqlmap') || pLower.includes('nmap') || pLower.includes('fuzz')) {
        cat = 'Web / 资产渗透'
      } else if (pLower.includes('aes') || pLower.includes('加密') || pLower.includes('解密') || pLower.includes('zkm') || pLower.includes('密钥')) {
        cat = '算法 / 密钥解密'
      } else if (pLower.includes('pe') || pLower.includes('elf') || pLower.includes('metadata') || pLower.includes('二进制') || pLower.includes('dnfile')) {
        cat = '二进制取证'
      } else if (pLower.includes('h-cot') || pLower.includes('hcot') || pLower.includes('ai') || pLower.includes('模型')) {
        cat = 'AI / 思维链安全'
      }

      items.push({
        name,
        cat,
        desc: purpose,
        path,
        status,
      })
    }
    return items
  } catch {
    return []
  }
}

/**
 * Shelf overview + top dead-ends for the route card. Read-only: a routing card must not
 * write to a ledger, so folding the H-CoT result ledger in is the explicit
 * `tool_memory sync` path. Silent when the ledgers are absent or empty.
 */
export function shelfSummary(): string {
  try {
    const parts: string[] = []
    if (existsSync(TOOLS_MD())) {
      const t = readFileSync(TOOLS_MD(), 'utf8')
      const rows = t.split('\n').filter((l) => /^\|/.test(l) && !/^\|[-\s|:]+\|$/.test(l) && !/^\| (工具|特征) /.test(l))
      if (rows.length) parts.push('[本机工具货架]\n' + rows.join('\n'))
    }
    if (existsSync(DEADENDS_MD())) {
      const d = readFileSync(DEADENDS_MD(), 'utf8')
      const rows = d.split('\n').filter((l) => /^\|/.test(l) && !/^\|[-\s|:]+\|$/.test(l) && !/^\| (工具|特征) /.test(l)).slice(0, 3)
      if (rows.length) parts.push('[已知死路 Top3]\n' + rows.join('\n'))
    }
    return parts.join('\n')
  } catch {
    return ''
  }
}

interface LedgerArgs {
  action: string
  tool_name?: string
  feature_tag?: string
  tactic?: string
  path?: string
  purpose?: string
  usage?: string
  version?: string
  content?: string
  evidence?: string
  kind?: string
  target?: string
  query?: string
}

export function registerLedgerTool(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'tool_memory',
    description:
      'Tool ledger memory: bind tool dir/usage/responsibility (register), record pitfalls/lessons/dead-ends (note, evidence id required), ' +
      'fold the H-CoT result ledger into both ledgers (sync), search across ledgers (search). The shelf overview is auto-injected into route_task output. Use it whenever you install a tool, ' +
      'learn a working usage, or falsify a route — this is the cross-session memory.',
    parameters: {
      action: { type: 'string', required: true, description: 'register | note | sync | search' },
      tool_name: { type: 'string', description: 'register/note(tool): tool name.' },
      feature_tag: { type: 'string', description: 'note(deadend): protector/pattern tag, e.g. ConfuserEx_Dynamic.' },
      tactic: { type: 'string', description: 'note(deadend): the falsified tactic, e.g. "static in-place IL patch".' },
      path: { type: 'string', description: 'register: absolute tool path.' },
      purpose: { type: 'string', description: 'register: what it is for / when NOT to use.' },
      usage: { type: 'string', description: 'register: verified command template.' },
      version: { type: 'string', description: 'register: version string.' },
      content: { type: 'string', description: 'note: the pitfall/lesson/dead-end root cause.' },
      evidence: { type: 'string', description: 'note: evidence id (E-xxx) or case name. Required for note — register/search/sync do not carry one.' },
      kind: { type: 'string', description: 'note(tool): pitfall | template (default pitfall).' },
      target: { type: 'string', description: 'note: tool | deadend (default tool).' },
      query: { type: 'string', description: 'search: keyword.' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: LedgerArgs) {
      if (args.action === 'register') {
        if (!args.tool_name || !args.path || !args.purpose) {
          return 'REJECTED — register 需要 tool_name + path + purpose。'
        }
        const dir = registerToolEntry(args.tool_name, args.path, args.purpose, args.usage, args.version)
        return `[LEDGER] ${args.tool_name} 已绑定：${dir}\n货架速览已更新，route_task 卡片下次自动携带。`
      }
      if (args.action === 'note') {
        if (!args.evidence) {
          return 'REJECTED — note 必须携带证据（evidence E-id 或 case 名）。无证据不写入。'
        }
        if (args.target === 'deadend') {
          if (!args.feature_tag || !args.tactic || !args.content) return 'REJECTED — deadend note 需要 feature_tag + tactic + content（根因）。'
          noteDeadEnd(args.feature_tag, args.tactic, args.content, args.evidence)
          return `[DEAD-END] ${args.feature_tag} — ${args.tactic} 已入账本，后续会话 route_task 卡片自动携带。`
        }
        if (!args.tool_name || !args.content) return 'REJECTED — tool note 需要 tool_name + content。'
        noteTool(args.tool_name, args.content, args.evidence, (args.kind === 'template' ? 'template' : 'pitfall') as 'template' | 'pitfall')
        return `[LEDGER] ${args.tool_name} 追加${args.kind === 'template' ? '用法' : '坑'}（证据:${args.evidence}）。`
      }
      if (args.action === 'sync') {
        return syncHcotLedger() || '[H-CoT 账本回流] 无可用记录（h_cot_results.jsonl 缺失或为空）。'
      }
      if (args.action === 'search') {
        return searchLedger(args.query ?? '')
      }
      return 'REJECTED — action 必须是 register | note | sync | search。'
    },
  }))
}
