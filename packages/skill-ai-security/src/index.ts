import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readTextSeam, runSeam } from './seam.js'

export const name = 'skill-ai-security'
export const inject = ['tools']

const refRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../references')
const scriptRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../scripts')
const packageRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')

export function apply(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'ai_reference',
    description: 'Read a AI/LLM security reference doc on demand; apply your own judgment. Start with index.md.',
    parameters: { path: { type: 'string', required: true, description: 'Path relative to references/.' } },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { path: string }) {
      const abs = resolve(refRoot, args.path)
      if (abs !== refRoot && !abs.startsWith(refRoot + sep)) throw new Error('path out of scope')
      return await readTextSeam(ctx, abs)
    },
  }))
  ctx.tools.register(defineTool({
    name: 'llm_sim',
    description: 'Simulate an LLM app locally to test prompt-injection payloads (OpenAI-compatible).',
    parameters: {
      system_prompt: { type: 'string', required: true },
      input: { type: 'string', required: true },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: any) {
      return await runSeam(ctx, ['python', resolve(scriptRoot, 'ai-security-analysis_llm_sim.py'), '--system-prompt', args.system_prompt, '--input', args.input], packageRoot)
    },
  }))
}
