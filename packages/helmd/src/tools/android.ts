import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { join, resolve } from 'node:path'
import { packageRoot, runSeam  } from '../seam.js'

const scriptRoot = join(packageRoot(), 'scripts', 'android')

export function registerAndroidTools(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'apk_fingerprint',
    description: 'Detect APK framework / HTTP stack / obfuscation. Read references/fingerprint.md for interpretation.',
    parameters: {
      apk: { type: 'string', required: true, description: 'Path to the APK/XAPK file.' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { apk: string }) {
      return await runSeam(ctx, ['bash', resolve(scriptRoot, 'fingerprint.sh'), args.apk], packageRoot())
    },
  }))
}
