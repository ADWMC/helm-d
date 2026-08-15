import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readTextSeam } from './seam.js'

export const name = 'security-router'
export const inject = ['tools']

// 目录：领域 -> 触发信号与去向（可发现性元数据，不下结论）
const catalog: Record<string, string> = {
  android: 'APK/AAB/DEX/smali -> @dsh-security/skill-android',
  web: 'JS/fetch/XHR/WebSocket/sign -> @dsh-security/skill-web',
  native: 'PE/ELF/Mach-O/shellcode -> @dsh-security/skill-native',
  protocol: 'PCAP/TCP/UDP/gRPC/Protobuf -> @dsh-security/skill-protocol',
  malware: 'C2/persistence/IOC/sample -> @dsh-security/skill-malware',
  ai: 'prompt/model/injection -> @dsh-security/skill-ai-security',
}

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
    description: 'Read a reference doc on demand; apply your own judgment.',
    parameters: {
      path: { type: 'string', required: true, description: 'Path relative to references/.' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { path: string }) {
      const abs = resolve(refRoot, args.path)
      if (abs !== refRoot && !abs.startsWith(refRoot + sep)) throw new Error('path out of scope')
      return await readTextSeam(ctx, abs)
    },
  }))
}
