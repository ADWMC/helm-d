import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readTextSeam } from './seam.js'

export const name = 'security-router'
export const inject = ['tools']

// 目录：领域 -> 触发信号与去向（可发现性元数据，不下结论）
const catalog: Record<string, string> = {
  android: 'APK/AAB/DEX/smali -> @helm-d/skill-android',
  web: 'JS/fetch/XHR/WebSocket/sign -> @helm-d/skill-web',
  native: 'PE/ELF/Mach-O/shellcode -> @helm-d/skill-native',
  protocol: 'PCAP/TCP/UDP/gRPC/Protobuf -> @helm-d/skill-protocol',
  malware: 'C2/persistence/IOC/sample -> @helm-d/skill-malware',
  ai: 'prompt/model/injection -> @helm-d/skill-ai-security',
  evidence: 'case/report/hash/triage -> @helm-d/skill-evidence',
  // 信号级路由 (signal -> tool -> bundle)
  apk: 'APK/AAB/DEX -> apk_fingerprint -> skill-android',
  shell: 'packer/UPX/VMP/Themida/OLLVM -> detect_packer -> skill-native',
  strings: 'signature/URL/error-string -> scan_strings -> skill-native',
  crypto: 'XOR/Base64/Hex/AES -> xor_bruteforce/encoding_detect -> skill-native',
  hook: 'Frida/Interceptor/hook -> skill-native dynamic-analysis-frida',
  pcap: 'PCAP/TCP/UDP -> pcap_parse -> skill-protocol',
  har: 'HAR/request -> parse_har -> skill-protocol',
  ioc: 'IOC/hash/domain -> ioc_extract/yara_gen -> skill-malware',
  llm: 'prompt/injection -> llm_sim -> skill-ai-security',
}

import { existsSync, statSync } from 'node:fs'

const refRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../references')

export function apply(ctx: Context): void {
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
    description: 'Read a reference doc on demand; apply your own judgment. Use "index.md" for index.',
    parameters: {
      path: { type: 'string', required: true, description: 'Path relative to references/.' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { path: string }) {
      let cleaned = (args.path ?? '').trim().replace(/\\/g, '/')
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

      let target = resolve(refRoot, cleaned)
      if (target !== refRoot && !target.startsWith(refRoot + sep)) throw new Error('path out of scope')

      if (existsSync(target)) {
        if (statSync(target).isDirectory()) {
          const idx = resolve(target, 'index.md')
          if (existsSync(idx)) target = idx
        }
      } else if (!cleaned.endsWith('.md')) {
        const withMd = resolve(refRoot, cleaned + '.md')
        if (existsSync(withMd)) target = withMd
      }

      return await readTextSeam(ctx, target)
    },
  }))
}

