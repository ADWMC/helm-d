// T-15 PoC runner: positive + independent negative control, then a three-state
// verdict. HTTP only; no arbitrary shell and no destructive request by default.

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { requestText } from '../star-gate.js'
import { getCase, saveEvidence } from '../case.js'
import { ReconLimiter, checkReconTarget } from '../recon.js'
import { classifyPoc, recipeById, renderPocRequest, type PocRequest } from '../poc.js'
import { loadSettings } from '../settings.js'

interface ExecLike { agent?: { id?: string } }

const limiter = new ReconLimiter(1, 2)

function withSuffix(url: string, suffix?: string): string {
  if (suffix === undefined || suffix.trim() === '') return url
  const value = suffix.trim()
  if (value.startsWith('?') || value.startsWith('/')) return url.replace(/\/$/, '') + value
  return url + value
}

function parseHeaders(raw?: string): Record<string, string> | undefined {
  if (raw === undefined || raw.trim() === '') return undefined
  const parsed: unknown = JSON.parse(raw)
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('headers must be a JSON object')
  return Object.fromEntries(Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [key, String(value)]))
}

async function send(url: string, request: PocRequest): Promise<{ status: number; text: string }> {
  await limiter.acquire(new URL(url).hostname)
  try {
    const response = await requestText(url, {
      method: request.method,
      headers: request.headers ?? {},
      ...(request.body !== undefined ? { body: request.body } : {}),
    })
    return { status: response.status, text: response.text.slice(0, 256 * 1024) }
  } finally {
    limiter.release()
  }
}

export function registerPocTools(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'run_poc',
    description:
      'Run a deterministic PoC recipe against one in-scope URL: positive request + independent negative control, ' +
      'then verdict verified/refuted/inconclusive. Safe recipes only unless team.riskApproval=allow. ' +
      'Both raw responses are saved as evidence; cite them in record_finding.',
    parameters: {
      recipe: { type: 'string', required: true, description: 'http-diff | sqli-boolean | path-traversal | idor | xss-canary | jwt-none | state-change' },
      url: { type: 'string', required: true, description: 'In-scope target URL (scope from begin_case).' },
      positive_suffix: { type: 'string', description: 'Query/path suffix for the positive request, e.g. ?id=1%27%20OR%201=1--' },
      negative_suffix: { type: 'string', description: 'Independent benign suffix for the control request.' },
      positive_headers: { type: 'string', description: 'JSON object of positive request headers.' },
      negative_headers: { type: 'string', description: 'JSON object of negative request headers.' },
      positive_body: { type: 'string', description: 'Positive request body.' },
      negative_body: { type: 'string', description: 'Negative request body.' },
      success_regex: { type: 'string', description: 'Override the recipe marker regex.' },
      lab: { type: 'boolean', description: 'Allow private/loopback targets (authorized lab only).' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: {
      recipe: string
      url: string
      positive_suffix?: string
      negative_suffix?: string
      positive_headers?: string
      negative_headers?: string
      positive_body?: string
      negative_body?: string
      success_regex?: string
      lab?: boolean
    }, exec?: ExecLike) {
      const active = getCase(exec?.agent?.id)
      if (active === undefined) throw new Error('no active case; begin_case(scope=[...]) first')
      const recipe = recipeById(args.recipe)
      if (recipe === undefined) throw new Error(`unknown PoC recipe: ${args.recipe}`)
      if (!recipe.safe && loadSettings().team.riskApproval !== 'allow') {
        throw new Error(`recipe ${recipe.id} is state-changing; set team.riskApproval=allow or use a safe recipe`)
      }
      const url = args.url.trim()
      const host = new URL(url).hostname
      const scope = checkReconTarget(host, active.scope ?? [], args.lab === true)
      if (!scope.ok) throw new Error(scope.reason ?? 'target rejected')
      const marker = new RegExp(args.success_regex ?? recipe.successRegex, 'i')
      const positiveRequest = renderPocRequest(recipe.positive, {
        ...(args.positive_headers !== undefined ? { headers: parseHeaders(args.positive_headers) } : {}),
        ...(args.positive_body !== undefined ? { body: args.positive_body } : {}),
      })
      const negativeRequest = renderPocRequest(recipe.negative, {
        ...(args.negative_headers !== undefined ? { headers: parseHeaders(args.negative_headers) } : {}),
        ...(args.negative_body !== undefined ? { body: args.negative_body } : {}),
      })
      const positive = await send(withSuffix(url, args.positive_suffix), positiveRequest)
      const negative = await send(withSuffix(url, args.negative_suffix), negativeRequest)
      const positiveHit = marker.test(positive.text)
      const negativeHit = marker.test(negative.text)
      const verdict = classifyPoc(positiveHit, negativeHit)
      const positiveEvidence = await saveEvidence(active.dir, 'poc_positive', `${positive.status}\n${positive.text}`, `${recipe.id} positive`)
      const negativeEvidence = await saveEvidence(active.dir, 'poc_negative', `${negative.status}\n${negative.text}`, `${recipe.id} negative`)
      return [
        `recipe: ${recipe.id} (${recipe.vulnClass})`,
        `positive: HTTP ${positive.status} hit=${positiveHit} evidence=${positiveEvidence.id}`,
        `negative: HTTP ${negative.status} hit=${negativeHit} evidence=${negativeEvidence.id}`,
        `verdict: ${verdict.verdict} — ${verdict.reason}`,
        `finding link: positive_evidence_ids=[${positiveEvidence.id}] negative_evidence_ids=[${negativeEvidence.id}]`,
      ].join('\n')
    },
  }))
}
