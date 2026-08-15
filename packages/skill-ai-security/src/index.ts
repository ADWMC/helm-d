import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)

export const name = 'skill-ai-security'
export const inject = ['tools']

const refRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../references')
const scriptRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../scripts')

export function apply(ctx: Context): void {

  ctx.tools.register(defineTool({
    name: 'ai_reference',
    description: 'Read a AI/LLM security reference doc on demand; apply your own judgment. Start with index.md.',
    parameters: { path: { type: 'string', required: true, description: 'Path relative to references/.' } },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { path: string }) {
      const abs = resolve(refRoot, args.path)
      if (abs !== refRoot && !abs.startsWith(refRoot + sep)) throw new Error('path out of scope')
      return await readFile(abs, 'utf8')
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
      const { stdout } = await execFileAsync('python', [resolve(scriptRoot, 'ai-security-analysis_llm_sim.py'), '--system-prompt', args.system_prompt, '--input', args.input])
      return stdout
    },
  }))
}
