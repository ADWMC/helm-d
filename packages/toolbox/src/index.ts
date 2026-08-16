import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readTextSeam } from './seam.js'

export const name = 'toolbox'
export const inject = ['tools']

const refRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../references')

// 信号 -> 首选工具 | 替代 | 存证格式（可发现性推荐，不下结论）
const rules: Record<string, string> = {
  apk: 'APK/DEX -> JADX/apktool + apk_fingerprint | 替代: Androguard/Ghidra | 存证: manifest/call graph/smali',
  dex: 'DEX -> JADX/baksmali + apk_fingerprint | 替代: Androguard | 存证: smali/call graph',
  frida: 'hook -> Frida + dynamic-analysis-frida | 替代: x64dbg/LLDB | 存证: hook log/stack/参数',
  hook: 'hook -> Frida + dynamic-analysis-frida | 替代: x64dbg | 存证: hook log/stack',
  native: 'PE/ELF -> IDA/Ghidra + detect_packer | 替代: radare2/rizin | 存证: 函数/类型/xrefs',
  pe: 'PE -> IDA/Ghidra + detect_packer | 替代: radare2 | 存证: 段/导入/xrefs',
  elf: 'ELF -> IDA/Ghidra + detect_packer | 替代: radare2/rizin | 存证: 段/符号/xrefs',
  shell: '壳 -> detect_packer | 替代: 手动段名/熵 | 存证: 壳类型/段名',
  packer: '壳 -> detect_packer | 替代: 手动段名/熵 | 存证: 壳类型/段名',
  vmp: 'VMP/Themida -> detect_packer + Frida dump | 存证: 段名/dump 校验',
  js: 'JS -> Chrome DevTools/CDP + bot_analyze | 替代: mitmproxy/Playwright | 存证: HAR/请求 diff',
  sign: '签名 -> crypto-analysis-methodology + xor_bruteforce | 替代: Frida hook | 存证: 明文/密钥',
  crypto: '加密 -> encoding_detect + xor_bruteforce | 替代: CyberChef | 存证: 算法/密钥',
  xor: 'XOR -> xor_bruteforce | 存证: 密钥/明文',
  pcap: '流量 -> Wireshark/tshark + pcap_parse | 替代: Scapy/Kaitai | 存证: 字段表/状态机',
  tcp: 'TCP/UDP -> pcap_parse + state_machine | 存证: 流/状态机',
  har: 'HAR -> parse_har | 存证: 字段表',
  malware: '样本 -> triage + ioc_extract + yara_gen | 替代: 沙箱 | 存证: IOC/规则/行为',
  ioc: 'IOC -> ioc_extract + yara_gen | 存证: IOC 清单',
  llm: 'prompt -> llm_sim + ai_reference | 存证: payload/响应',
  prompt: 'injection -> llm_sim + ai_reference | 存证: payload/响应',
  crash: '崩溃 -> crash-dump 动态分析 | 存证: minidump/栈',
  fuzz: 'fuzz -> coverage-guided + emulation | 存证: seed/coverage/crash',
}

export function apply(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'tool_recommend',
    description: 'Recommend tools and evidence format from a task or signal description.',
    parameters: {
      query: { type: 'string', description: 'Plain task or signal, e.g. "APK unpack Frida dex"; empty returns the full tool matrix.' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { query?: string }) {
      const q = (args.query ?? '').toLowerCase()
      if (!q) {
        return await readTextSeam(ctx, resolve(refRoot, 'tool-matrix.md'))
      }
      const hits: string[] = []
      for (const [key, value] of Object.entries(rules)) {
        if (q.includes(key)) hits.push(value)
      }
      const unique = [...new Set(hits)]
      return unique.length
        ? unique.join('\n')
        : 'triage-and-route: detect_packer + scan_strings + create_case + hash_artifact'
    },
  }))
}
