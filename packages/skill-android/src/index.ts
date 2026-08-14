import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)

export const name = 'skill-android'
export const inject = ['tools']

const scriptRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../scripts')

export function apply(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'apk_fingerprint',
    description: 'Detect APK framework / HTTP stack / obfuscation. Read references/fingerprint.md for interpretation.',
    parameters: {
      apk: { type: 'string', required: true, description: 'Path to the APK/XAPK file.' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { apk: string }) {
      const { stdout } = await execFileAsync('bash', [resolve(scriptRoot, 'fingerprint.sh'), args.apk])
      return stdout
    },
  }))
}
