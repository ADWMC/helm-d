import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readTextSeam, runSeam, assertWithinRoot } from '../seam.js'

const refRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../references/ai-security')
const scriptRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../scripts/ai-security')
const packageRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..')

export function registerAiSecurityTools(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'ai_reference',
    description: 'Read a AI/LLM security reference doc on demand; apply your own judgment. Start with index.md.',
    parameters: { path: { type: 'string', required: true, description: 'Path relative to references/.' } },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { path: string }) {
      const abs = resolve(refRoot, args.path)
      assertWithinRoot(abs, refRoot)
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
  ctx.tools.register(defineTool({
    name: 'hcot_attack',
    description:
      'Execute the H-CoT (chain-of-thought hijacking) three-step attack against an OpenAI-compatible target: ' +
      'template probe -> forged execution trace -> injection, capturing the FIRST output fragment ' +
      '(DeepSeek answers-then-retracts, so the first fragment matters more than the final state). ' +
      'Evolvable: variants live in scripts/ai-security/h_cot_variants.json, each live run appends an outcome ' +
      'to a result ledger (first fragment / final usability / cross-turn transfer), and auto picks the best ' +
      'variant for this model by mean score (explore while samples < 3). ' +
      'Pass stats for the variant win-rate table, dry_run to rehearse the three payloads offline.',
    parameters: {
      goal: { type: 'string', description: 'The real target request; required unless stats is set.' },
      variant: { type: 'string', description: 'Explicit variant id from h_cot_variants.json.' },
      auto: { type: 'boolean', description: 'Pick the best-scoring variant for this model from the ledger (default).' },
      stats: { type: 'boolean', description: 'Print the variant win-rate table and exit; no goal needed.' },
      probe: { type: 'string', description: 'Adjacent harmless template probe; overrides the variant probe.' },
      forge_file: { type: 'string', description: 'External forged-reasoning file, overriding the variant forge.' },
      base_url: { type: 'string', description: 'OpenAI-compatible base URL.' },
      model: { type: 'string', description: 'Target model id (selection is per-model).' },
      first_chars: { type: 'number', description: 'First-fragment capture length in characters (default 400).' },
      transfer_probe: { type: 'string', description: 'Follow-up question asked after injection to measure cross-turn transfer.' },
      ledger: { type: 'string', description: 'Result ledger JSONL path (default HELMD_HCOT_LEDGER or ~/.dsh/helmd-tools/h_cot_results.jsonl).' },
      dry_run: { type: 'boolean', description: 'Print the three payloads without calling the API.' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: any) {
      if (!args.stats && (args.goal == null || String(args.goal).trim() === '')) {
        return 'REJECTED — 需要 goal（真实目标请求）；只查变体胜率请传 stats: true。'
      }
      const argv = ['python', resolve(scriptRoot, 'h_cot_attack.py')]
      if (args.stats) {
        argv.push('--stats')
      } else {
        if (args.goal != null) argv.push('--goal', args.goal)
        if (args.variant != null) argv.push('--variant', args.variant)
        if (args.auto) argv.push('--auto')
        if (args.probe != null) argv.push('--probe', args.probe)
        if (args.forge_file != null) argv.push('--forge-file', args.forge_file)
        if (args.base_url != null) argv.push('--base-url', args.base_url)
        if (args.model != null) argv.push('--model', args.model)
        if (args.first_chars != null) argv.push('--first-chars', String(args.first_chars))
        if (args.transfer_probe != null) argv.push('--transfer-probe', args.transfer_probe)
        argv.push(args.dry_run ? '--dry-run' : '--json')
      }
      if (args.ledger != null) argv.push('--ledger', args.ledger)
      return await runSeam(ctx, argv, packageRoot)
    },
  }))
}
