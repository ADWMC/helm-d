import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runSeam } from '../seam.js'

const scriptRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../scripts/android')
const packageRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..')

export function registerAndroidTools(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'apk_fingerprint',
    description: 'Detect APK framework / HTTP stack / obfuscation. Read references/fingerprint.md for interpretation.',
    parameters: {
      apk: { type: 'string', required: true, description: 'Path to the APK/XAPK file.' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { apk: string }) {
      return await runSeam(ctx, ['bash', resolve(scriptRoot, 'fingerprint.sh'), args.apk], packageRoot)
    },
  }))
}
