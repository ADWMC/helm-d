import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readTextSeam, runSeam } from './seam.js'

export const name = 'skill-evidence'
export const inject = ['tools']

const refRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../references')
const scriptRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../scripts')
const packageRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')

export function apply(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'evidence_reference',
    description: 'Read a evidence/reporting reference doc on demand; apply your own judgment. Start with index.md.',
    parameters: { path: { type: 'string', required: true, description: 'Path relative to references/.' } },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { path: string }) {
      const abs = resolve(refRoot, args.path)
      if (abs !== refRoot && !abs.startsWith(refRoot + sep)) throw new Error('path out of scope')
      return await readTextSeam(ctx, abs)
    },
  }))
  ctx.tools.register(defineTool({
    name: 'create_case',
    description: 'Create a structured reverse case workspace (case.json, dirs, hypotheses table).',
    parameters: {
      case_name: { type: 'string', required: true },
      out: { type: 'string', required: true },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: any) {
      return await runSeam(ctx, ['python', resolve(scriptRoot, 'create_case.py'), '--case-name', args.case_name, '--out', args.out], packageRoot)
    },
  }))
  ctx.tools.register(defineTool({
    name: 'triage_artifact',
    description: 'Collect safe offline triage facts for an artifact (magic, entropy, strings).',
    parameters: {
      artifact: { type: 'string', required: true },
      out: { type: 'string', required: true },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: any) {
      return await runSeam(ctx, ['python', resolve(scriptRoot, 'triage_artifact.py'), args.artifact, '--out', args.out], packageRoot)
    },
  }))
  ctx.tools.register(defineTool({
    name: 'hash_artifact',
    description: 'Print SHA-256 and size of an artifact.',
    parameters: {
      path: { type: 'string', required: true },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: any) {
      return await runSeam(ctx, ['python', resolve(scriptRoot, 'hash_artifact.py'), args.path], packageRoot)
    },
  }))
}
