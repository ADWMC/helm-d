import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readTextSeam, runSeam } from './seam.js'

export const name = 'skill-protocol'
export const inject = ['tools']

const refRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../references')
const scriptRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../scripts')
const packageRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')

export function apply(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'protocol_reference',
    description: 'Read a protocol reference doc on demand; apply your own judgment. Start with index.md.',
    parameters: { path: { type: 'string', required: true, description: 'Path relative to references/.' } },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { path: string }) {
      const abs = resolve(refRoot, args.path)
      if (abs !== refRoot && !abs.startsWith(refRoot + sep)) throw new Error('path out of scope')
      return await readTextSeam(ctx, abs)
    },
  }))
  ctx.tools.register(defineTool({
    name: 'pcap_parse',
    description: 'Parse a PCAP and extract TCP/UDP streams.',
    parameters: {
      file: { type: 'string', required: true },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: any) {
      return await runSeam(ctx, ['python', resolve(scriptRoot, 'protocol/pcap_minimal.py'), args.file], packageRoot)
    },
  }))
  ctx.tools.register(defineTool({
    name: 'state_machine',
    description: 'Infer a protocol state machine (DOT) from a message log.',
    parameters: {
      messages: { type: 'string', required: true },
      out: { type: 'string' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: any) {
      return await runSeam(ctx, ['python', resolve(scriptRoot, 'protocol/protocol_state_machine.py'), args.messages, ...(args.out != null ? [args.out] : [])], packageRoot)
    },
  }))
  ctx.tools.register(defineTool({
    name: 'parse_har',
    description: 'Parse HAR request/response fields for protocol reversing.',
    parameters: {
      har: { type: 'string', required: true },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: any) {
      return await runSeam(ctx, ['python', resolve(scriptRoot, 'parse_har_fields.py'), args.har], packageRoot)
    },
  }))
}
