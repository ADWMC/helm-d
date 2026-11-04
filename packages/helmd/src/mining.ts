// Candidate mining (T-16): deterministic extraction from local artifacts.
// No network, no SAST engine, no symbol execution. Candidates are proposals,
// not findings; the PoC runner (T-15) must prove them.

import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface Candidate {
  class: string
  target: string
  endpoint: string
  param?: string
  source: string
  confidence: number
}

const CLASS_RANK: Record<string, number> = {
  'auth-bypass': 5,
  idor: 5,
  sqli: 5,
  rce: 5,
  ssrf: 4,
  xss: 4,
  'path-traversal': 4,
  'file-upload': 4,
  api: 2,
  unknown: 1,
}

function classifyEndpoint(endpoint: string): string {
  const value = endpoint.toLowerCase()
  if (/\/(?:user|account|order|invoice|file|download|upload|admin|api\/v\d+\/)/.test(value)) return 'idor'
  if (/(?:id|q|search|query|filter|sort)=/.test(value)) return 'sqli'
  if (/(?:url|next|redirect|callback|webhook)=/.test(value)) return 'ssrf'
  if (/(?:path|file|template|page|view)=/.test(value)) return 'path-traversal'
  return 'api'
}

function key(candidate: Candidate): string {
  return `${candidate.class}|${candidate.target}|${candidate.endpoint}|${candidate.param ?? ''}`
}

export function dedupeCandidates(candidates: Candidate[]): Candidate[] {
  const seen = new Map<string, Candidate>()
  for (const candidate of candidates) {
    const id = key(candidate)
    const prior = seen.get(id)
    if (prior === undefined || candidate.confidence > prior.confidence) seen.set(id, candidate)
  }
  return [...seen.values()].sort((a, b) =>
    (CLASS_RANK[b.class] ?? 0) - (CLASS_RANK[a.class] ?? 0)
    || b.confidence - a.confidence
    || a.endpoint.localeCompare(b.endpoint))
}

function candidateFromUrl(target: string, rawUrl: string, source: string, confidence: number): Candidate | null {
  let url: URL
  try { url = new URL(rawUrl, target) } catch { return null }
  if (!['http:', 'https:'].includes(url.protocol)) return null
  return {
    class: classifyEndpoint(url.pathname + url.search),
    target,
    endpoint: url.pathname + url.search,
    ...(url.searchParams.keys().next().done === false ? { param: [...url.searchParams.keys()][0] } : {}),
    source,
    confidence,
  }
}

/** HAR 1.2: every request URL, with query parameters preserved. */
export function extractHar(text: string, target: string): Candidate[] {
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { return [] }
  const entries = (parsed as { log?: { entries?: Array<{ request?: { url?: unknown } }> } })?.log?.entries
  if (!Array.isArray(entries)) return []
  const rows: Candidate[] = []
  for (const entry of entries) {
    const raw = entry?.request?.url
    if (typeof raw !== 'string') continue
    const candidate = candidateFromUrl(target, raw, 'har', 0.7)
    if (candidate !== null) rows.push(candidate)
  }
  return dedupeCandidates(rows)
}

/** OpenAPI 3 / Swagger 2 paths + parameters. */
export function extractOpenApi(text: string, target: string): Candidate[] {
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { return [] }
  const paths = (parsed as { paths?: Record<string, Record<string, unknown>> })?.paths
  if (paths === null || typeof paths !== 'object') return []
  const rows: Candidate[] = []
  for (const [endpoint, methods] of Object.entries(paths)) {
    if (methods === null || typeof methods !== 'object') continue
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
      const operation = (methods as Record<string, unknown>)[method]
      if (operation === null || typeof operation !== 'object') continue
      const params = (operation as { parameters?: Array<{ name?: unknown; in?: unknown }> }).parameters ?? []
      for (const param of params) {
        if (typeof param?.name !== 'string') continue
        rows.push({
          class: classifyEndpoint(endpoint),
          target,
          endpoint,
          param: param.name,
          source: `openapi:${method}`,
          confidence: 0.8,
        })
      }
      if (params.length === 0) {
        rows.push({ class: classifyEndpoint(endpoint), target, endpoint, source: `openapi:${method}`, confidence: 0.6 })
      }
    }
  }
  return dedupeCandidates(rows)
}

const URL_RE = /https?:\/\/[^\s"'`<>\\]+/g
const PATH_RE = /["'`](\/(?:api|v\d+|rest|graphql|admin|user|account|file|upload|download)[^"'`\s]*)["'`]/g

/** JS/HTML text: absolute URLs and quoted API paths. No evaluation. */
export function extractText(text: string, target: string): Candidate[] {
  const rows: Candidate[] = []
  for (const match of text.matchAll(URL_RE)) {
    const candidate = candidateFromUrl(target, match[0], 'text:url', 0.55)
    if (candidate !== null) rows.push(candidate)
  }
  for (const match of text.matchAll(PATH_RE)) {
    try {
      const candidate = candidateFromUrl(target, new URL(match[1], target).href, 'text:path', 0.5)
      if (candidate !== null) rows.push(candidate)
    } catch { /* skip malformed path */ }
  }
  return dedupeCandidates(rows)
}

export function extractCandidates(text: string, target: string, format: 'har' | 'openapi' | 'text'): Candidate[] {
  if (format === 'har') return extractHar(text, target)
  if (format === 'openapi') return extractOpenApi(text, target)
  return extractText(text, target)
}

export function candidatesPath(caseDir: string): string {
  return join(caseDir, 'mining', 'candidates.jsonl')
}

export function writeCandidates(caseDir: string, candidates: Candidate[]): void {
  // Replace the file rather than appending, so reruns are deterministic.
  mkdirSync(join(caseDir, 'mining'), { recursive: true })
  writeFileSync(candidatesPath(caseDir), candidates.map((candidate) => JSON.stringify(candidate)).join('\n') + '\n', 'utf8')
}

export function loadCandidates(caseDir: string): Candidate[] {
  if (!existsSync(candidatesPath(caseDir))) return []
  const rows: Candidate[] = []
  for (const line of readFileSync(candidatesPath(caseDir), 'utf8').split('\n')) {
    if (line.trim() === '') continue
    try {
      const parsed = JSON.parse(line) as Partial<Candidate>
      if (typeof parsed.class === 'string' && typeof parsed.endpoint === 'string') {
        rows.push({
          class: parsed.class,
          target: typeof parsed.target === 'string' ? parsed.target : '',
          endpoint: parsed.endpoint,
          ...(typeof parsed.param === 'string' ? { param: parsed.param } : {}),
          source: typeof parsed.source === 'string' ? parsed.source : 'unknown',
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        })
      }
    } catch { /* skip malformed line */ }
  }
  return rows
}

export function miningLine(caseDir: string, assetCount: number): string {
  const candidates = loadCandidates(caseDir)
  const tested = new Set(candidates.filter((candidate) => candidate.class === 'unknown').map((candidate) => candidate.endpoint))
  return `[mining] candidates ${candidates.length} · untested ${Math.max(0, candidates.length - tested.size)} · assets ${assetCount}`
}
