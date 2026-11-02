import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { join, resolve } from 'node:path'
import { packageRoot, readTextSeam, runSeam, assertWithinRoot  } from '../seam.js'

const refRoot = join(packageRoot(), 'references', 'evidence')
const scriptRoot = join(packageRoot(), 'scripts', 'evidence')

export function registerEvidenceTools(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'evidence_reference',
    description: 'Read a evidence/reporting reference doc on demand; apply your own judgment. Start with index.md.',
    parameters: { path: { type: 'string', required: true, description: 'Path relative to references/.' } },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { path: string }) {
      const abs = resolve(refRoot, args.path)
      assertWithinRoot(abs, refRoot)
      return await readTextSeam(ctx, abs)
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
      return await runSeam(ctx, ['python', resolve(scriptRoot, 'triage_artifact.py'), args.artifact, '--out', args.out], packageRoot())
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
      return await runSeam(ctx, ['python', resolve(scriptRoot, 'hash_artifact.py'), args.path], packageRoot())
    },
  }))
}
