import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { join, resolve } from 'node:path'
import { packageRoot, readTextSeam, runSeam, assertWithinRoot  } from '../seam.js'
import { getCase, validateEvidenceIds } from '../case.js'
import { chooseProtectionAction, type ProtectionSignals } from '../protection-route.js'

const refRoot = join(packageRoot(), 'references', 'native')
const scriptRoot = join(packageRoot(), 'scripts', 'native')

export function registerNativeTools(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'protection_route',
    description: 'Advisory protection triage for an active Case. Requires existing evidence IDs; agent-supplied signals are not independently verified. Never executes a sample or confirms an algorithm.',
    parameters: {
      evidence_ids: { type: 'array', items: { type: 'string' }, required: true, description: 'Existing E-ids supporting the supplied observations.' },
      targetVisible: { type: 'boolean', required: true },
      staticAttempts: { type: 'number', required: true },
      runtimeDependent: { type: 'boolean', required: true },
      writeExecuteEvidence: { type: 'boolean', required: true },
      localVmEvidence: { type: 'boolean', required: true },
      generatedCodeEvidence: { type: 'boolean', required: true },
      signatureOnly: { type: 'boolean', required: true },
      canRunIsolated: { type: 'boolean', required: true },
      observerReady: { type: 'boolean', required: true },
      observerFailed: { type: 'boolean', required: true },
      discriminatingQuestion: { type: 'boolean', required: true },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: ProtectionSignals & { evidence_ids: string[] }, exec?: { agent?: { id?: string } }) {
      const active = getCase(exec?.agent?.id)
      if (!active) return 'REJECTED — begin_case first; route observations must belong to a Case.'
      if (!Array.isArray(args.evidence_ids) || args.evidence_ids.length === 0) return 'REJECTED — supply at least one existing E-id.'
      const check = await validateEvidenceIds(active.dir, args.evidence_ids)
      if (!check.ok) return `REJECTED — unknown E-ids: ${check.missing.join(', ')}`
      const fields: (keyof Omit<ProtectionSignals, 'staticAttempts'>)[] = [
        'targetVisible', 'runtimeDependent', 'writeExecuteEvidence', 'localVmEvidence', 'generatedCodeEvidence',
        'signatureOnly', 'canRunIsolated', 'observerReady', 'observerFailed', 'discriminatingQuestion',
      ]
      if (fields.some((field) => typeof args[field] !== 'boolean')) return 'REJECTED — all signals must be explicit booleans.'
      try {
        const result = chooseProtectionAction(args)
        return `ADVISORY (self-reported signals, not evidence-verified): ${result.action}\nkind: ${result.kind} (${result.confidence})\nalgorithm: unknown\nartifact: none\nreason: ${result.reason}\ncited E-ids: ${args.evidence_ids.join(', ')}\nDo not execute a sample or promote a finding from this advice alone.`
      } catch (error) {
        return `REJECTED — ${error instanceof Error ? error.message : String(error)}`
      }
    },
  }))
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
    description: 'Report candidate PE/ELF protection signatures and entropy, not confirmed packer identity or algorithm.',
    parameters: {
      file: { type: 'string', required: true },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: any) {
      return await runSeam(ctx, ['python', resolve(scriptRoot, 'protection/detect_packer.py'), args.file], packageRoot())
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
      return await runSeam(ctx, ['python', resolve(scriptRoot, 'scan_strings.py'), args.path, ...(args.min != null ? ['--min', String(args.min)] : [])], packageRoot())
    },
  }))
  ctx.tools.register(defineTool({
    name: 'xor_bruteforce',
    description:
      'Single/multi-byte XOR key bruteforce ranked by English-likeness (letter density + word/flag-format bonus). ' +
      'Omit keylen for single-byte ranked candidates; pass keylen for repeating-key. Use top_n to widen the candidate list.',
    parameters: {
      data: { type: 'string', required: true, description: 'File path or hex string.' },
      keylen: { type: 'number', description: 'Repeating-key length; omit for single-byte mode.' },
      top_n: { type: 'number', description: 'Candidate count (default 10).' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: any) {
      const extra: string[] = []
      if (args.keylen != null) extra.push('-k', String(args.keylen))
      if (args.top_n != null) extra.push('-n', String(args.top_n))
      return await runSeam(ctx, ['python', resolve(scriptRoot, 'crypto/xor_bruteforce.py'), args.data, ...extra], packageRoot())
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
      return await runSeam(ctx, ['python', resolve(scriptRoot, 'crypto/encoding_detect.py'), args.text], packageRoot())
    },
  }))
}
