import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readTextSeam, assertWithinRoot } from './seam.js'
import { getLevel, setLevel, normalizeLevel, renderContract } from './mode.js'

// 目录：领域 -> 触发信号与去向（可发现性元数据，不下结论）
const catalog: Record<string, string> = {
  // 快速导航
  case: '样本分析入口 -> begin_case(goal, samples) 建工作区；续接用 case_status()',
  tree: '分诊决策树 -> references/toolbox/decision-tree.md — 拿到样本后先走这里',
  methodology: '方法论 -> references/toolbox/methodology.md — 分析流程、工具选择、实战案例',
  patterns: '模式速查 -> references/toolbox/patterns.md — 保护器签名、反分析技术、Patch 编码',
  report: '报告模板 -> references/evidence/reporting.md — 标准化输出模板',
  install: '工具安装 -> references/toolbox/tool-install.md — 下载、安装、验证',
  jvm: 'JVM/Java mod 常量加密 -> references/native/jvm-mod-deobf-workflow.md — Forge mod、jar 混淆、DES 解密器模板、oracle 重放；脚本 scripts/native/jvm/',
  // 领域路由
  android: 'APK/AAB/DEX/smali -> apk_fingerprint + references/android/',
  web: 'JS/fetch/XHR/WebSocket/sign -> web_reference + references/web/',
  native: 'PE/ELF/Mach-O/shellcode -> native_reference + references/native/',
  protocol: 'PCAP/TCP/UDP/gRPC/Protobuf -> pcap_parse + references/protocol/',
  malware: 'C2/persistence/IOC/sample -> ioc_extract/yara_gen + references/malware/',
  ai: 'prompt/model/injection -> llm_sim + references/ai-security/',
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
  { key: 'llm', kw: ['prompt', '注入', 'injection', 'llm', '越狱', 'jailbreak'], why: 'LLM 应用安全' },
  { key: 'evidence', kw: ['报告', 'report', '存证', '证据', 'case'], why: '取证与报告' },
  { key: 'install', kw: ['安装', '下载', 'install', 'download', '环境', 'setup', '装'], why: '工具获取' },
  { key: 'tree', kw: ['分析', 'analyze', '看看', '这个文件', 'unknown', '分诊'], why: '未定型样本走决策树' },
]

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
  if (hits.length === 0) {
    return [
      'PRIMARY: tree — 未命中已知信号，按分诊决策树处理',
      '依据: 关键词无匹配；先读 references/toolbox/decision-tree.md',
      '备选: skill_catalog 查看全目录',
    ].join('\n')
  }
  const primary = hits[0]
  const lines = [
    `PRIMARY: ${primary.key} — ${catalog[primary.key] ?? ''}`,
    `依据: 命中关键词 ${hits.filter((_, i) => i < 3).length ? `"${hint.trim().slice(0, 40)}" → ${primary.why}` : primary.why}`,
  ]
  if (hits.length > 1) {
    lines.push(`备选: ${hits.slice(1, 4).map((h) => h.key).join(', ')}`)
  }
  return lines.join('\n')
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
    description: 'Read a reference doc on demand; apply your own judgment.',
    parameters: {
      path: { type: 'string', required: true, description: 'Path relative to references/.' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { path: string }) {
      const abs = resolve(refRoot, args.path)
      assertWithinRoot(abs, refRoot)
      return await readTextSeam(ctx, abs)
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
    async execute(args: { hint: string }) {
      return renderRoute(args.hint ?? '')
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
