import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readTextSeam, assertWithinRoot } from './seam.js'

// 目录：领域 -> 触发信号与去向（可发现性元数据，不下结论）
const catalog: Record<string, string> = {
  // 快速导航
  tree: '分诊决策树 -> references/toolbox/decision-tree.md — 拿到样本后先走这里',
  methodology: '方法论 -> references/toolbox/methodology.md — 分析流程、工具选择、实战案例',
  patterns: '模式速查 -> references/toolbox/patterns.md — 保护器签名、反分析技术、Patch 编码',
  report: '报告模板 -> references/evidence/reporting.md — 标准化输出模板',
  install: '工具安装 -> references/toolbox/tool-install.md — 下载、安装、验证',
  // 领域路由
  android: 'APK/AAB/DEX/smali -> apk_fingerprint + references/android/',
  web: 'JS/fetch/XHR/WebSocket/sign -> web_reference + references/web/',
  native: 'PE/ELF/Mach-O/shellcode -> native_reference + references/native/',
  protocol: 'PCAP/TCP/UDP/gRPC/Protobuf -> pcap_parse + references/protocol/',
  malware: 'C2/persistence/IOC/sample -> ioc_extract/yara_gen + references/malware/',
  ai: 'prompt/model/injection -> llm_sim + references/ai-security/',
  evidence: 'case/report/hash/triage -> create_case + references/evidence/',
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

const refRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../references')

export function registerRouterTools(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'skill_catalog',
    description: 'List available reference topics and when to read them.',
    parameters: {
      domain: { type: 'string', description: 'Optional domain filter.' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { domain?: string }) {
      const { domain } = args
      return domain ? (catalog[domain] ?? `unknown domain: ${domain}`) : Object.values(catalog).join('\n')
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
}
