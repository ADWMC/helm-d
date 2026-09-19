import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { readTextSeam, assertWithinRoot } from './seam.js'
import { getLevel, setLevel, normalizeLevel, renderContract } from './mode.js'
import { shelfSummary } from './ledger.js'
import { submitAdvisory, renderAdvisoryStats } from './advisory.js'
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
  tools: '工具货架 -> 19+ 内置逆向与安全分析工具，输入 /tools 或查看右侧栏工作台',
  status: '状态看板 -> 输入 /status 查看引擎健康与流式拦截审计日志',
  jvm: 'JVM/Java mod 常量加密 -> references/native/jvm-mod-deobf-workflow.md — Forge mod、jar 混淆、DES 解密器模板、oracle 重放；脚本 scripts/native/jvm/',
  // 领域路由
  android: 'APK/AAB/DEX/smali -> apk_fingerprint + references/android/',
  web: 'JS/fetch/XHR/WebSocket/sign -> web_reference + references/web/',
  src: 'SRC/众测/bug bounty 挖洞 -> references/web/src-hunter/（五阶段方法论 + playbook + payloader + H1 案例；与 web/ 互补）',
  native: 'PE/ELF/Mach-O/shellcode -> native_reference + references/native/',
  protocol: 'PCAP/TCP/UDP/gRPC/Protobuf -> pcap_parse + references/protocol/',
  malware: 'C2/persistence/IOC/sample -> ioc_extract/yara_gen + references/malware/',
  ai: 'prompt/model/injection -> llm_sim + references/ai-security/',
  hcot: 'H-CoT 思维链劫持 -> references/ai-security/h-cot-chain-of-thought-hijacking.md — 模板采集/思路伪造/注入劫持，绕过模型安全判断',
  evidence: 'case 工作区/报告/存证 -> begin_case + case_status + references/evidence/',
  // 信号级路由 (signal -> tool -> reference)
  apk: 'APK/AAB/DEX -> apk_fingerprint -> android',
  shell: 'packer/UPX/VMP/Themida/OLLVM -> detect_packer -> native',
  strings: 'signature/URL/error-string -> scan_strings -> native',
  crypto: 'XOR/Base64/Hex/AES -> xor_bruteforce/encoding_detect -> native',
  hook: 'Frida/Interceptor/hook -> native dynamic-analysis-frida',
  pcap: 'PCAP/TCP/UDP -> pcap_parse -> protocol',
  har: 'HAR/request -> parse_har -> protocol',
  ioc: 'IOC/hash/domain -> ioc_extract/yara_gen -> malware',
  llm: 'prompt/injection -> llm_sim -> ai',
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
  { key: 'hcot', kw: ['h-cot', 'hcot', 'chain-of-thought', '思维链', '思维链劫持', 'cot 劫持'], why: 'H-CoT 思维链劫持 / 模型越狱' },
  { key: 'llm', kw: ['prompt', '注入', 'injection', 'llm', '越狱', 'jailbreak'], why: 'LLM 应用安全' },
  { key: 'web', kw: ['sqli', 'xss', 'ssrf', 'ssti', 'xxe', 'rce', 'lfi', '文件上传', '越权', 'idor', 'jwt', 'oauth', 'csrf', '渗透', 'pentest', 'webshell'], why: 'Web 攻击特征 -> references/web/（含 hs-* 攻击 playbook）' },
  { key: 'src', kw: ['src', '众测', 'bug bounty', '漏洞赏金', 'hackerone', '补天', 'hvv', '挖洞', 'src 挖洞', '赏金'], why: 'SRC/众测语境 -> references/web/src-hunter/（五阶段方法论 + playbook + payloader + H1 案例）' },
  { key: 'native', kw: ['exploit', 'pwn', '提权', 'privesc', 'kerberos', 'ntlm', '内网', '横向', 'rop', '堆溢出', 'heap'], why: '主机/二进制攻击特征 -> references/native/（含 hs-* 攻击 playbook）' },
  { key: 'evidence', kw: ['报告', 'report', '存证', '证据', 'case'], why: '取证与报告' },
  { key: 'install', kw: ['安装', '下载', 'install', 'download', '环境', 'setup', '装'], why: '工具获取' },
  { key: 'tools', kw: ['tools', '工具列表', '查看工具', '工具箱', '有哪些工具', '所有工具', '工具货架', '逆向工具'], why: '查询 19+ 逆向与安全分析工具货架及调用示例' },
  { key: 'status', kw: ['status', '状态看板', '拦截状态', '健康状态', '检查状态'], why: '查询 helmd 引擎健康、流式拦截审计与 H-CoT 状态' },
  { key: 'tree', kw: ['分析', 'analyze', '看看', '这个文件', 'unknown', '分诊'], why: '未定型样本走决策树' },
]

/** PRIMARY route -> the first tool that would produce its opening evidence. */
const ROUTE_TOOL: Record<string, string> = {
  apk: 'apk_fingerprint', shell: 'detect_packer', strings: 'scan_strings', crypto: 'encoding_detect',
  pcap: 'pcap_parse', har: 'parse_har', ioc: 'ioc_extract', malware: 'yara_gen',
  hcot: 'hcot_attack', llm: 'llm_sim', tree: 'triage_artifact', evidence: 'begin_case',
  tools: 'skill_catalog', status: 'case_status',
}

export interface RouteHit {
  key: string
  why: string
  score: number
}

// 纯函数，导出以便离线测试
export function matchRoute(hint: string): RouteHit[] {
  const text = hint.toLowerCase()
  return ROUTE_TABLE
    .map((r) => ({
      key: r.key,
      why: r.why,
      score: r.kw.reduce((n, k) => (text.includes(k.toLowerCase()) ? n + 1 : n), 0),
    }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
}

export function renderRoute(hint: string): string {
  const hits = matchRoute(hint)
  let card: string
  if (hits.length === 0) {
    card = [
      'PRIMARY: tree — 未命中已知信号，按分诊决策树处理',
      '依据: 关键词无匹配；先读 references/toolbox/decision-tree.md',
      '备选: skill_catalog 查看全目录',
    ].join('\n')
  } else {
    const primary = hits[0]
    const lines = [
      `PRIMARY: ${primary.key} — ${catalog[primary.key] ?? ''}`,
      `依据: 命中关键词 ${hits.filter((_, i) => i < 3).length ? `"${hint.trim().slice(0, 40)}" → ${primary.why}` : primary.why}`,
    ]
    if (hits.length > 1) {
      lines.push(`备选: ${hits.slice(1, 4).map((h) => h.key).join(', ')}`)
    }
    card = lines.join('\n')
  }
  // Cross-session memory: shelf overview + top dead-ends (silent when empty)
  try {
    const shelf = shelfSummary()
    if (shelf) card += '\n\n' + shelf + '\n(新装工具→tool_memory register；踩坑/证伪→tool_memory note，须带证据)'
  } catch {
    // ledger unavailable — route card stays clean
  }
  // Advisory ledger: did the agent act on what earlier cards/hooks told it?
  try {
    const stats = renderAdvisoryStats(3)
    if (stats) card += '\n\n' + stats
  } catch {
    // advisory ledger unavailable — card stays clean
  }
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
    description: 'List available reference topics and when to read them.',
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
    description: 'Read a reference doc on demand; apply your own judgment. Use "index.md" for master index.',
    parameters: {
      path: { type: 'string', required: true, description: 'Path relative to references/ (e.g. "index.md", "android/index.md", "native/license-bypass-workflow.md").' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { path: string }) {
      const target = resolveReferenceFile(refRoot, args.path)
      if (target) {
        assertWithinRoot(target, refRoot)
        return await readTextSeam(ctx, target)
      }
      const raw = resolve(refRoot, args.path ?? '')
      assertWithinRoot(raw, refRoot)
      try {
        return await readTextSeam(ctx, raw)
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
          '调用 read_reference(path: "index.md") 可查看总索引。',
        ].join('\n')
      }
    },
  }))


  ctx.tools.register(defineTool({
    name: 'route_task',
    description:
      'Deterministic first-hop router: match the task hint against signal keywords, ' +
      'return the PRIMARY route plus a one-line rationale (dhicoc master-route contract). ' +
      'Call before touching an unfamiliar sample.',
    parameters: {
      hint: { type: 'string', required: true, description: 'Short task description or sample filename.' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { hint: string }, exec?: { agent?: AgentLike }) {
      const card = renderRoute(args.hint ?? '')
      const primary = matchRoute(args.hint ?? '')[0]?.key
      const tool = primary ? ROUTE_TOOL[primary] : undefined
      const sessionId = exec?.agent?.id
      if (sessionId && primary && tool) {
        submitAdvisory(sessionId, {
          key: `route:${primary}`,
          tier: 'recommended',
          content: `PRIMARY=${primary} — 先用 ${tool} 取得第一条证据再下结论。`,
          proof: { kind: 'tool_called', tools: [tool] },
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
