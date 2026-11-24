import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readTextSeam } from './seam.js'

export const name = 'skill-protocol'
export const inject = ['tools']

const refRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../references')

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
}
