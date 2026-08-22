import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readTextSeam, runSeam, assertWithinRoot } from '../seam.js'

const refRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../references/protocol')
const scriptRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../scripts/protocol')
const packageRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..')

export function registerProtocolTools(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'protocol_reference',
    description: 'Read a protocol reference doc on demand; apply your own judgment. Start with index.md.',
    parameters: { path: { type: 'string', required: true, description: 'Path relative to references/.' } },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { path: string }) {
      const abs = resolve(refRoot, args.path)
      assertWithinRoot(abs, refRoot)
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
