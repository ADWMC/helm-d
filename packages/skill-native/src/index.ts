import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { apply as applySkillFilesystem } from '@deepseek-ai/dsh-skill-filesystem'
import { readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)

export const name = 'skill-native'
export const inject = ['tools', 'skills']

const refRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../references')
const scriptRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../scripts')
const bundledSkillRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../skills')

export function apply(ctx: Context): void {

  applySkillFilesystem(ctx, {
    providerName: 'helmd-skill-native-bundled',
    includeDefaultRoots: false,
    bundledSkillDir: bundledSkillRoot,
  })

  ctx.tools.register(defineTool({
    name: 'native_reference',
    description: 'Read a native/binary reference doc on demand; apply your own judgment. Start with index.md.',
    parameters: { path: { type: 'string', required: true, description: 'Path relative to references/.' } },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { path: string }) {
      const abs = resolve(refRoot, args.path)
      if (abs !== refRoot && !abs.startsWith(refRoot + sep)) throw new Error('path out of scope')
      return await readFile(abs, 'utf8')
    },
  }))
  ctx.tools.register(defineTool({
    name: 'detect_packer',
    description: 'Detect PE/ELF packers (UPX/VMProtect/Themida/OLLVM).',
    parameters: {
      file: { type: 'string', required: true },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: any) {
      const { stdout } = await execFileAsync('python', [resolve(scriptRoot, 'protection/detect_packer.py'), args.file])
      return stdout
    },
  }))
  ctx.tools.register(defineTool({
    name: 'scan_strings',
    description: 'Extract printable ASCII/UTF-16LE strings from a binary.',
    parameters: {
      path: { type: 'string', required: true },
      min: { type: 'number' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: any) {
      const { stdout } = await execFileAsync('python', [resolve(scriptRoot, 'scan_strings.py'), args.path, ...(args.min != null ? ['--min', String(args.min)] : [])])
      return stdout
    },
  }))
  ctx.tools.register(defineTool({
    name: 'xor_bruteforce',
    description: 'Bruteforce single-byte XOR key on a file or hex string.',
    parameters: {
      data: { type: 'string', required: true },
      keylen: { type: 'number' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: any) {
      const { stdout } = await execFileAsync('python', [resolve(scriptRoot, 'crypto/xor_bruteforce.py'), args.data, ...(args.keylen != null ? ['-k', String(args.keylen)] : [])])
      return stdout
    },
  }))
  ctx.tools.register(defineTool({
    name: 'encoding_detect',
    description: 'Detect and decode Base64/Hex/ROT13/XOR on an encoded string.',
    parameters: {
      text: { type: 'string', required: true },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: any) {
      const { stdout } = await execFileAsync('python', [resolve(scriptRoot, 'crypto/encoding_detect.py'), args.text])
      return stdout
    },
  }))
}
