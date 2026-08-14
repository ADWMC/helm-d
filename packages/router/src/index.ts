import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'security-router'
export const inject = ['systemPrompt', 'tools']

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
// 系统提示词随 bundle 分发，加载时读入一次（prompt.md）
const promptText = readFileSync(
  resolve(fileURLToPath(new URL('.', import.meta.url)), '../prompt.md'),
  'utf8',
)

export function apply(ctx: Context): void {
  ctx.systemPrompt.section({
    name: 'security-system-prompt',
    order: 110,
    text: promptText,
  })

  ctx.tools.register(defineTool({
    name: 'skill_catalog',
    description: 'List available reference topics and when to read them.',
    parameters: {
      domain: { type: 'string', required: false, description: 'Optional domain filter.' },
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
      return await readFile(abs, 'utf8')
    },
  }))
}
