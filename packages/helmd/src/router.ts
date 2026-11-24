import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { readTextSeam, assertWithinRoot } from './seam.js'
import { readSealedReference } from './sealed-refs.js'
import { getLevel, setLevel, normalizeLevel, renderContract } from './mode.js'
import { playbookFor } from './autonomy.js'
import { submitAdvisory, renderAdvisoryStats, markReferencePage, markRoutedReference } from './advisory.js'
import { sessionEvents, type AgentLike } from './session-log.js'

// 目录：领域 -> 触发信号与去向（可发现性元数据，不下结论）
const catalog: Record<string, string> = {
  // 快速导航
  case: '样本分析入口 -> begin_case(goal, samples) 建工作区；续接用 case_status()',
  tree: '分诊决策树 -> references/toolbox/decision-tree.md — 拿到样本后先走这里',
  methodology: '方法论 -> references/toolbox/methodology.md — 分析流程、工具选择、实战案例',
  patterns: '模式速查 -> references/toolbox/patterns.md — 保护器签名、反分析技术、Patch 编码',
  report: '报告模板 -> references/evidence/reporting.md — 标准化输出模板',
  install: '工具安装 -> references/toolbox/tool-install.md — 下载、安装、验证',
  network: '出站通道 -> references/toolbox/network-egress.md — 先探本机可用代理，探不到或连不上就直连+换源',
  tools: '外部专业工具目录 -> toolbox(action=catalog/probe)；输出用 save_evidence 入链',
  status: '状态看板 -> 输入 /status 查看引擎健康与流式拦截审计日志',
  jvm: 'JVM/Java mod 常量加密 -> references/native/jvm-mod-deobf-workflow.md — Forge mod、jar 混淆、oracle 重放方法；选外部专业工具保存原始输出',
  // 领域路由
  android: 'APK/AAB/DEX/smali -> references/android/ + 外部反编译器',
  web: 'JS/fetch/XHR/WebSocket/sign -> web_reference + references/web/',
  native: 'PE/ELF/Mach-O/shellcode -> native_reference + references/native/',
  protocol: 'PCAP/TCP/UDP/gRPC/Protobuf -> references/protocol/ + 外部协议分析器',
  malware: 'C2/persistence/IOC/sample -> references/malware/ + 外部分析器',
  ai: 'prompt/model security -> references/ai-security/ + 外部评测器',
  evidence: 'case 工作区/报告/存证 -> begin_case + case_status + references/evidence/',
  // 信号级路由 (signal -> tool -> reference)
  apk: 'APK/AAB/DEX -> android 参考 + 专业反编译器',
  shell: 'packer/UPX/VMP/Themida/OLLVM -> native 保护方法 + 专业分析器',
  strings: 'signature/URL/error-string -> native 参考 + 专业字符串工具',
  crypto: 'XOR/Base64/Hex/AES -> native 加密方法 + 专业分析器',
  hook: 'Frida/Interceptor/hook -> native dynamic-analysis-frida',
  pcap: 'PCAP/TCP/UDP -> protocol 参考 + 外部协议分析器',
  har: 'HAR/request -> protocol 参考 + 外部协议分析器',
  ioc: 'IOC/hash/domain -> malware 参考 + 外部分析器',
  llm: 'model security / prompt injection -> ai 参考 + 外部评测器',
}

// 确定性路由表（dhicoc master-route 契约：先路由后动手，PRIMARY + 一句依据）
interface Route {
  key: string
  kw: string[]
  why: string
}

const ROUTE_TABLE: Route[] = [
  { key: 'apk', kw: ['apk', 'aab', 'dex', 'xapk', '安卓', 'android', 'smali', 'manifest'], why: 'Android 包样本' },
  { key: 'jvm', kw: ['jar', 'forge', 'fabric', 'mixin', 'minecraft', 'mod', 'des', '加密常量', '字符串解密', 'indy'], why: 'JVM 常量加密特征' },
  { key: 'shell', kw: ['壳', '加壳', 'packer', 'upx', 'vmp', 'vmprotect', 'themida', 'ollvm', '脱壳'], why: '保护器/壳特征' },
  { key: 'crypto', kw: ['xor', 'base64', 'hex', 'aes', 'rc4', '解密', 'encode', 'decode'], why: '编码/加密识别' },
  { key: 'strings', kw: ['字符串', 'string', 'url', 'ip', '签名串', '特征码'], why: '字符串情报' },
  { key: 'hook', kw: ['frida', 'hook', 'interceptor', '插桩', 'inline'], why: '运行时插桩' },
  { key: 'pcap', kw: ['pcap', '抓包', 'tcp', 'udp', '流量', 'packet'], why: '流量捕获' },
  { key: 'har', kw: ['har', 'http', '请求', 'response', '接口'], why: 'HTTP 会话' },
  { key: 'ioc', kw: ['ioc', 'c2', '域名', 'domain', 'hash', '持久化', 'persistence'], why: '威胁指标' },
  { key: 'malware', kw: ['恶意', 'malware', '病毒', 'backdoor', '木马', 'yara'], why: '恶意样本判定' },
  { key: 'llm', kw: ['prompt', '提示词', '模型评测', '模型安全', '大模型', 'injection', 'llm', '越狱', 'jailbreak'], why: 'LLM 应用安全' },
  { key: 'web', kw: ['sqli', 'xss', 'ssrf', 'ssti', 'xxe', 'rce', 'lfi', '文件上传', '越权', 'idor', 'jwt', 'oauth', 'csrf', '渗透', 'pentest', 'webshell'], why: 'Web 攻击特征 -> references/web/（含 hs-* 攻击 playbook）' },
  { key: 'native', kw: ['elf', '.so', '.dll', '.exe', 'pe 文件', 'mach-o', '二进制', '逆向', 'reverse engineering', 'exploit', 'pwn', '提权', 'privesc', 'kerberos', 'ntlm', '内网', '横向', 'rop', '堆溢出', 'heap'], why: '主机/二进制分析入口 -> references/native/' },
  { key: 'evidence', kw: ['报告', 'report', '存证', '证据', 'case'], why: '取证与报告' },
  { key: 'install', kw: ['安装', '下载', 'install', 'download', '环境', 'setup', '装'], why: '工具获取' },
  { key: 'network', kw: ['超时', 'timeout', '连不上', '无法连接', '无法访问', '代理', 'proxy', 'dns', 'connection refused', 'connection reset', 'unreachable', '网络不通', '下载失败'], why: '出站通道故障 -> 探本机代理，探不到则直连+换源' },
  { key: 'tools', kw: ['tools', '工具列表', '查看工具', '工具箱', '有哪些工具', '所有工具', '工具货架', '逆向工具'], why: '查询 19+ 逆向与安全分析工具货架及调用示例' },
  { key: 'status', kw: ['status', '状态看板', '拦截状态', '健康状态', '检查状态'], why: '查询 helmd 引擎健康与流式拦截审计状态' },
  { key: 'tree', kw: ['分析', 'analyze', '看看', '这个文件', 'unknown', '分诊'], why: '未定型样本走决策树' },
]

/** PRIMARY route -> first evidence action, not a bundled domain analyzer. */
const ROUTE_TOOL: Record<string, string> = {
  evidence: 'begin_case', tools: 'toolbox(action=catalog/probe)', status: 'case_status',
}

/** PRIMARY route -> the reference doc to read BEFORE running the route tool.
 *  The guidance chain audit (2026-11-19) showed the model never reads references
 *  on its own: the card must name the doc and the order, not just the tool. */
const ROUTE_REF: Record<string, string> = {
  apk: 'android/index.md', jvm: 'native/jvm-mod-deobf-workflow.md',
  shell: 'native/protection-detection-methodology.md', crypto: 'native/crypto-analysis-methodology.md',
  strings: 'native/index.md', hook: 'android/frida-hook-principles.md',
  pcap: 'protocol/index.md', har: 'protocol/index.md',
  ioc: 'malware/index.md', malware: 'malware/malware-analysis-methodology.md',
  llm: 'ai-security/index.md', web: 'web/index.md', native: 'native/index.md',
  evidence: 'evidence/reporting.md', install: 'toolbox/tool-install.md',
  network: 'toolbox/network-egress.md', tree: 'toolbox/decision-tree.md',
  tools: 'toolbox/tool-matrix.md', status: 'evidence/workflow.md',
}

export interface RouteHit {
  key: string
  why: string
  score: number
}

// 纯函数，导出以便离线测试
export function matchRoute(hint: string): RouteHit[] {
  const text = hint.toLowerCase().replace(/(?:不要|不用|无需|不必|别)[^，,。；;]{0,36}(?:[，,。；;]|$)/g, ' ')
  const matches = (keyword: string): boolean => {
    const word = keyword.toLowerCase()
    if (!/^[a-z0-9]+$/.test(word)) return text.includes(word)
    return new RegExp(`(?<![a-z0-9])${word}(?![a-z0-9])`).test(text)
  }
  return ROUTE_TABLE
    .map((r) => ({
      key: r.key,
      why: r.why,
      score: r.kw.reduce((n, k) => (matches(k) ? n + 1 : n), 0),
    }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
}

export function firstReference(hint: string): string {
  const primary = matchRoute(hint)[0]?.key ?? 'tree'
  if (primary === 'hook' && /\.so\b|\.dll\b|\.exe\b|\belf\b/i.test(hint)) return 'native/dynamic-analysis-frida.md'
  return ROUTE_REF[primary] ?? 'toolbox/decision-tree.md'
}

export function renderRoute(hint: string): string {
  const hits = matchRoute(hint)
  let card: string
  if (hits.length === 0) {
    card = [
      'PRIMARY: tree — 未命中已知信号，按分诊决策树处理',
      '依据: 关键词无匹配；先读 references/toolbox/decision-tree.md',
      'FIRST: read_reference("toolbox/decision-tree.md") — 决策树定类型后再动手',
      '备选: skill_catalog 查看全目录',
    ].join('\n')
  } else {
    const primary = hits[0]
    const ref = firstReference(hint)
    const lines = [
      `PRIMARY: ${primary.key} — ${catalog[primary.key] ?? ''}`,
      `依据: 命中关键词 ${hits.filter((_, i) => i < 3).length ? `"${hint.trim().slice(0, 40)}" → ${primary.why}` : primary.why}`,
    ]
    if (ref !== undefined) {
      lines.push(`FIRST: read_reference("${ref}") — 读方法论再动手；本会话没读过参考时 record_finding 会拒绝结论`)
    }
    lines.push(`NEXT: ${ROUTE_TOOL[primary.key] ?? 'toolbox(action=catalog/probe) → 外部专业工具 → save_evidence'} — 取得第一条可核查证据`)
    if (hits.length > 1) {
      lines.push(`备选: ${hits.slice(1, 4).map((h) => h.key).join(', ')}`)
    }
    card = lines.join('\n')
  }
  // Advisory ledger: did the agent act on what earlier cards/hooks told it?
  try {
    const stats = renderAdvisoryStats(3)
    if (stats) card += '\n\n' + stats
  } catch {
    // advisory ledger unavailable — card stays clean
  }
  card += `\nplaybook: ${playbookFor(hint)} (stage suggestions; not a gate)`
  return card
}

const DOMAINS = ['toolbox', 'native', 'android', 'web', 'ai-security', 'malware', 'protocol', 'evidence']


export function resolveReferenceFile(root: string, userPath?: string): string | null {
  let cleaned = (userPath ?? '').trim().replace(/\\/g, '/')
  cleaned = cleaned.replace(/^(\.\/|\/)+/, '')
  if (cleaned.startsWith('references/')) {
    cleaned = cleaned.slice('references/'.length)
  } else if (cleaned === 'references') {
    cleaned = ''
  }
  if (!cleaned || cleaned === '.') {
    cleaned = 'index.md'
  }
  cleaned = cleaned.replace(/^(@dsh-security\/|@helm-d\/)?skill-([a-z0-9_-]+)/, '$2')

  const candidate = resolve(root, cleaned)
  try {
    assertWithinRoot(candidate, root)
  } catch {
    return null
  }

  // Exact file or directory with index.md
  if (existsSync(candidate)) {
    try {
      if (statSync(candidate).isDirectory()) {
        const idx = resolve(candidate, 'index.md')
        if (existsSync(idx)) return idx
      } else {
        return candidate
      }
    } catch {
      return candidate
    }
  }

  // Without .md extension
  if (!cleaned.endsWith('.md')) {
    const withMd = resolve(root, cleaned + '.md')
    if (existsSync(withMd)) return withMd
  }

  // Flat filename fallback across domains
  if (!cleaned.includes('/')) {
    for (const d of DOMAINS) {
      const sub = resolve(root, d, cleaned)
      if (existsSync(sub)) return sub
      if (!cleaned.endsWith('.md')) {
        const subMd = resolve(root, d, cleaned + '.md')
        if (existsSync(subMd)) return subMd
      }
    }
  }

  return null
}

const refRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../references')

export function registerRouterTools(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'skill_catalog',
    description:
      'List available reference topics and when to read them. Call this when a task names a domain ' +
      '(android/web/native/protocol/malware/ai/evidence) and you have not yet read that domain\'s docs this session.',
    parameters: {
      domain: { type: 'string', description: 'Optional domain filter.' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { domain?: string }, exec?: { agent?: { id?: string } }) {
      const { domain } = args
      if (domain) return catalog[domain] ?? `unknown domain: ${domain}`
      const entries = Object.entries(catalog).map(([k, v]) => `${k}: ${v}`)
      entries.unshift(renderContract(getLevel(exec?.agent?.id)))
      return entries.join('\n')
    },
  }))

  ctx.tools.register(defineTool({
    name: 'read_reference',
    description:
      'Read a reference doc BEFORE applying a technique from memory. Call route_task first — its card names the ' +
      'doc to read. Use "index.md" for the master index with the task-routing table. Output limited to 200 lines ' +
      'per call — use offset to continue. record_finding rejects conclusions from a session that never read one.',
    parameters: {
      path: { type: 'string', required: true, description: 'Path relative to references/.' },
      offset: { type: 'number', description: 'Line offset for pagination (default 0).' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { path: string; offset?: number }, exec?: { agent?: AgentLike }) {
      const MVI_MAX = 200
      const sessionId = exec?.agent?.id ?? exec?.agent?.session?.id
      const offset = args.offset ?? 0
      if (!Number.isSafeInteger(offset) || offset < 0) return 'REJECTED — offset must be a non-negative integer.'
      const mvi = (text: string): string => {
        const lines = text.split('\n')
        if (offset >= lines.length) return `[offset ${offset} is beyond ${lines.length} lines]`
        if (lines.length <= MVI_MAX && offset === 0) return text
        const slice = lines.slice(offset, offset + MVI_MAX)
        const header = offset > 0 ? `[… continued from line ${offset + 1}]\n` : ''
        const footer = offset + slice.length < lines.length
          ? `\n[truncated: ${lines.length} total lines, showing ${offset + 1}–${offset + slice.length}. read_reference(path, offset=${offset + MVI_MAX}) to continue]`
          : ''
        return header + slice.join('\n') + footer
      }
      const receipt = (path: string, text: string): void => {
        if (text.trim()) markReferencePage(sessionId, path, offset, text.split('\n').length, MVI_MAX)
      }
      const rel = (args.path ?? '').replace(/\\/g, '/').replace(/^\//, '').replace(/^references\//, '')
      if (rel.split('/').includes('..')) return 'REJECTED — reference path out of scope.'
      const raw = resolve(refRoot, args.path ?? '')
      if (args.path && (args.path.startsWith('/') || /^[a-z]:[/\\]/i.test(args.path))) return 'REJECTED — reference path out of scope.'
      assertWithinRoot(raw, refRoot)
      const local = resolveReferenceFile(refRoot, args.path)
      const sealed = local && existsSync(local) ? undefined : readSealedReference(rel)
      if (sealed !== undefined) {
        receipt(rel, sealed)
        return mvi(sealed)
      }
      const sealedIndex = local ? undefined : readSealedReference(rel ? rel.replace(/\/?$/, '/index.md') : 'index.md')
      if (sealedIndex !== undefined) {
        receipt(rel.replace(/\/?$/, '/index.md'), sealedIndex)
        return mvi(sealedIndex)
      }
      const target = local
      if (target) {
        assertWithinRoot(target, refRoot)
        const text = await readTextSeam(ctx, target)
        receipt(target.slice(refRoot.length + 1).replace(/\\/g, '/'), text)
        return mvi(text)
      }
      try {
        const text = await readTextSeam(ctx, raw)
        receipt(raw.slice(refRoot.length + 1).replace(/\\/g, '/'), text)
        return mvi(text)
      } catch {
        return [
          `参考文档未找到: "${args.path}"`,
          '可用领域索引:',
          '- android/index.md (Android 逆向)',
          '- native/index.md (Native/二进制与脱壳)',
          '- web/index.md (Web 安全与渗透)',
          '- ai-security/index.md (AI 安全与越狱防御)',
          '- malware/index.md (恶意代码与威胁分析)',
          '- protocol/index.md (网络协议与抓包分析)',
          '- evidence/index.md (证据链与报告规范)',
          '- toolbox/index.md (决策树与通用工具箱)',
          '调用 read_reference(path: "index.md") 可查看总索引（任务路由 + 全量目录）。',
        ].join('\n')
      }
    },
  }))


  ctx.tools.register(defineTool({
    name: 'route_task',
    description:
      'Deterministic first-hop router: match the task hint against signal keywords, ' +
      'return the PRIMARY route plus the reference doc to read FIRST and the tool for the opening evidence. ' +
      'Call before touching an unfamiliar sample, then follow the card: read_reference, then the route tool.',
    parameters: {
      hint: { type: 'string', required: true, description: 'Short task description or sample filename.' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { hint: string }, exec?: { agent?: AgentLike }) {
      const card = renderRoute(args.hint ?? '')
      const primary = matchRoute(args.hint ?? '')[0]?.key ?? 'tree'
      const tool = primary ? ROUTE_TOOL[primary] : undefined
      const ref = firstReference(args.hint ?? '')
      const sessionId = exec?.agent?.id ?? exec?.agent?.session?.id
      if (sessionId && primary) {
        markRoutedReference(sessionId, ref)
        submitAdvisory(sessionId, {
          key: `route-read:${primary}`,
          tier: 'recommended',
          content: `PRIMARY=${primary} — 先 read_reference(${ref ?? 'index.md'})，再用 ${tool ?? 'toolbox 查找专业工具，保存原始输出到 Case'} 取得第一条证据。`,
          proof: { kind: 'reference_loaded', path: ref },
          withinTurns: 2,
          trackOnly: true,
        }, sessionEvents(exec?.agent, 'route_task').length)
      }
      return card
    },
  }))

  ctx.tools.register(defineTool({
    name: 'analysis_mode',
    description:
      'Get or set the analysis intensity level for this session: lite (quick triage), ' +
      'full (standard flow, default), deep (full evidence chain). Ponytail-style ladder: ' +
      'pick the shallowest rung that answers the task.',
    parameters: {
      level: { type: 'string', description: 'lite | full | deep. Omit to read the current contract.' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { level?: string }, exec?: { agent?: { id?: string } }) {
      const next = normalizeLevel(args.level)
      const sessionId = exec?.agent?.id
      if (next) setLevel(next, sessionId)
      return renderContract(getLevel(sessionId))
    },
  }))
}
