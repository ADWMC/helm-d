// Candidate mining tool (T-16): local artifact -> candidates.jsonl. No network.

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { readFileSync } from 'node:fs'
import { getCase, saveEvidence } from '../case.js'
import { extractCandidates, loadCandidates, writeCandidates } from '../mining.js'

interface ExecLike { agent?: { id?: string } }

export function registerMiningTools(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'mine_candidates',
    description:
      'Extract candidate endpoints/parameters from a local HAR, OpenAPI/Swagger, JS/HTML, APK manifest or binary strings ' +
      'into mining/candidates.jsonl. Deterministic, offline, and proposals only — run_poc must prove them.',
    parameters: {
      path: { type: 'string', required: true, description: 'Local artifact path (HAR/OpenAPI/JS/HTML).' },
      target: { type: 'string', required: true, description: 'Target label for the candidates, e.g. https://example.com.' },
      format: { type: 'string', description: 'har | openapi | text | apk (inferred from extension/content when omitted).' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { path: string; target: string; format?: string }, exec?: ExecLike) {
      const active = getCase(exec?.agent?.id)
      if (active === undefined) throw new Error('no active case; begin_case() first')
      const isApk = args.path.toLowerCase().endsWith('.apk')
      const binary = isApk || /\.(dex|so|dll|exe|bin|elf|macho|dylib)$/i.test(args.path)
      const text = readFileSync(args.path, binary ? 'latin1' : 'utf8')
      const format = args.format === 'har' || args.format === 'openapi' || args.format === 'text' || args.format === 'apk'
        ? args.format
        : isApk
          ? 'apk'
          : args.path.toLowerCase().endsWith('.har')
            ? 'har'
            : /"openapi"|"swagger"/.test(text.slice(0, 2048))
              ? 'openapi'
              : 'text'
      const candidates = extractCandidates(text, args.target, format, args.path)
      writeCandidates(active.dir, candidates)
      const evidence = await saveEvidence(active.dir, 'mine_candidates', JSON.stringify(candidates, null, 2), `${format} candidates`)
      return [
        `mined ${candidates.length} candidate(s) from ${format}`,
        `evidence: ${evidence.id}`,
        `candidates: ${candidates.slice(0, 8).map((candidate) => `${candidate.class}:${candidate.endpoint}`).join(' · ') || '(none)'}`,
        `stored: mining/candidates.jsonl (total ${loadCandidates(active.dir).length})`,
      ].join('\n')
    },
  }))
}
