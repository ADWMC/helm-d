import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readTextSeam, runSeam, assertWithinRoot } from '../seam.js'

const refRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../references/native')
const scriptRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../scripts/native')
const packageRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..')

export function registerNativeTools(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'native_reference',
    description: 'Read a native/binary reference doc on demand; apply your own judgment. Start with index.md.',
    parameters: { path: { type: 'string', required: true, description: 'Path relative to references/.' } },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { path: string }) {
      const abs = resolve(refRoot, args.path)
      assertWithinRoot(abs, refRoot)
      return await readTextSeam(ctx, abs)
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
      return await runSeam(ctx, ['python', resolve(scriptRoot, 'protection/detect_packer.py'), args.file], packageRoot)
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
      return await runSeam(ctx, ['python', resolve(scriptRoot, 'scan_strings.py'), args.path, ...(args.min != null ? ['--min', String(args.min)] : [])], packageRoot)
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
      return await runSeam(ctx, ['python', resolve(scriptRoot, 'crypto/xor_bruteforce.py'), args.data, ...(args.keylen != null ? ['-k', String(args.keylen)] : [])], packageRoot)
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
      return await runSeam(ctx, ['python', resolve(scriptRoot, 'crypto/encoding_detect.py'), args.text], packageRoot)
    },
  }))
}
