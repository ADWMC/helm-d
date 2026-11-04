// Case workspace core — pure fs/state operations, no cordis deps.
// Everything a case needs lives on disk; the in-memory map only binds
// a session (exec.agent.id) to its active case dir for convenience.

import { createHash } from 'node:crypto'
import { createReadStream, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { mkdir, copyFile, writeFile, appendFile, readFile, readdir, rename } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'

export interface CaseInfo {
  dir: string
  name: string
  goal: string
  mode: string
  route: string
  /** Explicit recon scope (hostnames/CIDRs); empty means recon tools refuse. */
  scope?: string[]
}

const bindings = new Map<string, CaseInfo>()

/** $DSH_HOME/storages/helmd/sessions/<sha256(sessionId)>.json */
function sessionBindingPath(sessionId: string): string {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  const key = createHash('sha256').update(sessionId).digest('hex')
  return join(home, 'storages', 'helmd', 'sessions', `${key}.json`)
}

/** Read the bound case from memory, then from the session binding file. The
 *  file survives host restarts and context compaction; without it the model
 *  (and the workbench) would fall back to "latest open case on disk", which is
 *  exactly the cross-session confusion the workbench used to show. */
export function getCase(sessionId?: string): CaseInfo | undefined {
  const key = sessionId ?? '__global__'
  const cached = bindings.get(key)
  if (cached) return cached
  if (!sessionId) return undefined
  try {
    const parsed = JSON.parse(readFileSync(sessionBindingPath(sessionId), 'utf8')) as Partial<CaseInfo> | null
    if (parsed !== null && typeof parsed === 'object' && typeof parsed.dir === 'string') {
      const dir = resolve(parsed.dir)
      if (existsSync(join(dir, 'CASE.md'))) {
        const info: CaseInfo = {
          dir,
          name: typeof parsed.name === 'string' ? parsed.name : basename(dir),
          goal: typeof parsed.goal === 'string' ? parsed.goal : 'unspecified',
          mode: typeof parsed.mode === 'string' ? parsed.mode : 'full',
          route: typeof parsed.route === 'string' ? parsed.route : 'pending (route_task)',
          ...(Array.isArray(parsed.scope) ? { scope: parsed.scope.map(String) } : {}),
        }
        bindings.set(key, info)
        return info
      }
    }
  } catch { /* no binding file / unreadable — the caller sees no active case */ }
  return undefined
}

export function bindCase(sessionId: string | undefined, info: CaseInfo): void {
  const key = sessionId ?? '__global__'
  bindings.set(key, info)
  if (!sessionId) return
  try {
    const path = sessionBindingPath(sessionId)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify({ sessionId, ...info, boundAt: new Date().toISOString() }, null, 2), 'utf8')
  } catch { /* best effort: the in-memory binding still works for this process */ }
}

export function unbindCase(sessionId?: string): CaseInfo | undefined {
  const key = sessionId ?? '__global__'
  const info = bindings.get(key)
  bindings.delete(key)
  if (sessionId) {
    try { unlinkSync(sessionBindingPath(sessionId)) } catch { /* already absent */ }
  }
  return info
}

/** Root resolution: explicit arg > HELMD_CASES_DIR > process.cwd(). */
export function casesRoot(root?: string): string {
  const base = root?.trim() || process.env.HELMD_CASES_DIR?.trim() || process.cwd()
  return resolve(base, 'helmd-cases')
}

export function slugify(text: string, max = 48): string {
  const clean = text
    .replace(/[\\/:\*\?"<>\|]+/g, ' ')
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '')
  return clean || 'case'
}

function today(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function nowStamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

async function sha256File(path: string): Promise<string> {
  return await new Promise((resolvePromise, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(path)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolvePromise(hash.digest('hex')))
    stream.on('error', reject)
  })
}

/** Create <root>/helmd-cases/<date>-<slug>[/] with collision suffixes. */
export async function createCaseDir(opts: {
  goal: string
  samples: string[]
  mode: string
  route: string
  root?: string
  scope?: string[]
}): Promise<CaseInfo> {
  const base = casesRoot(opts.root)
  const hint = slugify(opts.goal || basename(opts.samples[0] ?? ''))
  let name = `${today()}-${hint}`
  for (let i = 2; existsSync(join(base, name)); i++) name = `${today()}-${hint}-${i}`

  const dir = join(base, name)
  for (const sub of ['sample', 'evidence', 'scripts']) {
    await mkdir(join(dir, sub), { recursive: true })
  }

  const lines: string[] = []
  let id = 0
  for (const sample of opts.samples) {
    if (!existsSync(sample)) throw new Error(`sample not found: ${sample}`)
    const dest = join(dir, 'sample', basename(sample))
    await copyFile(sample, dest)
    const sha = await sha256File(dest)
    id++
    const eid = `E-${String(id).padStart(3, '0')}`
    await writeFile(join(dir, 'evidence', `${eid}-sha256.txt`),
      `${sha}  ${basename(sample)}\nsource: ${resolve(sample)}\n`, 'utf8')
    lines.push(`  - sample/${basename(sample)} sha256:${sha}`)
  }

  const caseMd = [
    `# CASE ${name}`,
    `status: open`,
    `mode: ${opts.mode}`,
    `route: ${opts.route}`,
    ...(opts.scope !== undefined && opts.scope.length > 0 ? [`scope: ${opts.scope.join(', ')}`] : []),
    `goal: ${opts.goal}`,
    ...(lines.length ? ['samples:', ...lines] : []),
    '',
    '## timeline',
    `- [${nowStamp()}] BEGIN — created by begin_case`,
    '',
    '## resume（压缩恢复契约：恢复时先 case_status()；压缩前把 1-6 更新到当前）',
    '1. 目标与用户约束：goal + 用户说过的范围/边界（安全相关约束逐字保留，不要转述）',
    '2. 已确认事实：验证过的结论 + 对应 E-id（未验证的猜测不要写进来）',
    '3. 关键参数：命令 / 偏移 / 哈希 / 工具版本 —— 正文只写 E-id，细节留在 evidence/',
    '4. 已排除的路线：试过且失败的路子（同步进 DEAD_ENDS，写明根因）',
    '5. 当前进展：正在做的这一步、做到哪、下一步的最小动作',
    '6. 待办与阻塞：等材料 / 等外部结果 / 等用户技术选择（写明等什么、由谁给）',
    '',
  ].join('\n')
  await writeFile(join(dir, 'CASE.md'), caseMd, 'utf8')
  await writeFile(join(dir, 'findings.md'), `# FINDINGS ${name}\n`, 'utf8')

  return { dir, name, goal: opts.goal, mode: opts.mode, route: opts.route, ...(opts.scope !== undefined ? { scope: [...opts.scope] } : {}) }
}

/** Evidence files present for a case (E-xxx entries), counted from disk. */
export async function countEvidence(caseDir: string): Promise<number> {
  const files = await readdir(join(caseDir, 'evidence')).catch(() => [] as string[])
  return files.filter((f) => /^E-\d{3}/.test(f) && !f.endsWith('.meta.json')).length
}

export interface EvidenceEntry {
  id: string
  file: string
}

/** Evidence entries on disk, sorted by E-number. */
export async function listEvidence(caseDir: string): Promise<EvidenceEntry[]> {
  const files = await readdir(join(caseDir, 'evidence')).catch(() => [] as string[])
  return files
    .filter((file) => !file.endsWith('.meta.json'))
    .map((file) => {
      const match = /^(E-\d+)/.exec(file)
      return match ? { id: match[1], file } : null
    })
    .filter((entry): entry is EvidenceEntry => entry !== null)
    .sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * Next evidence id for one case directory.
 *
 * The directory is scanned once per case, not once per save: this runs on the
 * tool-call path for EVERY domain tool while a case is open, and a readdir grows
 * with the evidence count. After the first scan the counter is process-local —
 * the case directory is created and owned by this process, so no external writer
 * can invalidate it. Restart safety is preserved by the initial scan.
 */
const evidenceCounters = new Map<string, number>()

/** Next E-number = max existing + 1; the scan happens once per case directory. */
export async function nextEvidenceId(caseDir: string): Promise<string> {
  const cached = evidenceCounters.get(caseDir)
  if (cached !== undefined) {
    const next = cached + 1
    evidenceCounters.set(caseDir, next)
    return `E-${String(next).padStart(3, '0')}`
  }
  const files = await readdir(join(caseDir, 'evidence')).catch(() => [] as string[])
  let max = 0
  for (const f of files) {
    if (f.endsWith('.meta.json')) continue
    const m = /^E-(\d{3})-/.exec(f)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  evidenceCounters.set(caseDir, max + 1)
  return `E-${String(max + 1).padStart(3, '0')}`
}

/** Drop a case directory's counter (called when its case closes). */
export function resetEvidenceCounter(caseDir: string): void {
  evidenceCounters.delete(caseDir)
}

export async function saveEvidence(
  caseDir: string,
  toolLabel: string,
  content: string,
  summary: string,
  options: { maxBytes?: number } = {},
): Promise<{ id: string; path: string; sha256: string; dedup?: string }> {
  const maxBytes = options.maxBytes ?? 256 * 1024
  const capped = maxBytes > 0 && content.length > maxBytes
    ? content.slice(0, maxBytes) + `\n[truncated at ${Math.round(maxBytes / 1024)}KB; full length ${content.length}]\n`
    : content
  const sha = createHash('sha256').update(capped, 'utf8').digest('hex')
  // Dedup: if an evidence file with the same content hash exists, return it.
  const files = await readdir(join(caseDir, 'evidence')).catch(() => [] as string[])
  for (const f of files) {
    if (!/^E-\d{3,}-/.test(f) || f.endsWith('.meta.json')) continue
    const existing = await readFile(join(caseDir, 'evidence', f), 'utf8').catch(() => '')
    const existingSha = createHash('sha256').update(existing, 'utf8').digest('hex')
    if (existingSha === sha) {
      const existingId = /^E-(\d{3,})-/.exec(f)?.[1]
      if (existingId) return { id: `E-${existingId}`, path: join(caseDir, 'evidence', f), sha256: sha, dedup: `E-${existingId}` }
    }
  }
  const id = await nextEvidenceId(caseDir)
  const safeTool = toolLabel.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40) || 'output'
  const path = join(caseDir, 'evidence', `${id}-${safeTool}.txt`)
  await writeFile(path, capped, 'utf8')
  // Content-addressed chain (T-06): each meta points at the previous evidence
  // hash. The chain is audit metadata, not a security signature.
  const metas = await listEvidenceMeta(caseDir)
  const prevHash = metas.length > 0 ? metas[metas.length - 1].sha256 : 'genesis'
  const meta: EvidenceMeta = {
    id,
    file: basename(path),
    sha256: sha,
    prevHash,
    tool: safeTool,
    ts: new Date().toISOString(),
  }
  await writeFile(join(caseDir, 'evidence', `${id}-${safeTool}.meta.json`), JSON.stringify(meta, null, 2), 'utf8')
  await appendTimeline(caseDir, `${toolLabel} → ${id} — ${summary.slice(0, 80)}`)
  return { id, path, sha256: sha }
}

/** T-02 claim audit: hash-like tokens in a finding detail must appear verbatim
 *  in at least one cited evidence file; E-id references must be cited. */
export async function uncitedClaims(caseDir: string, detail: string, evidenceIds: string[], negativeIds: string[] = []): Promise<string[]> {
  const citations = new Set([...evidenceIds, ...negativeIds])
  const brokenCitations = [...new Set((detail.match(/\bE-\d{3,}\b/gi) ?? []))]
    .filter((id) => !citations.has(id.toUpperCase()))
  const hashes = [...new Set((detail.match(/\b[a-f0-9]{32,64}\b/gi) ?? []).map((value) => value.toLowerCase()))]
  if (hashes.length === 0) return brokenCitations
  const files = await readdir(join(caseDir, 'evidence')).catch(() => [] as string[])
  let haystack = ''
  for (const file of files) {
    if (!/^E-\d{3,}-/.test(file) || file.endsWith('.meta.json')) continue
    const id = /^(E-\d{3,})-/.exec(file)?.[1]
    if (id === undefined || !citations.has(id)) continue
    haystack += (await readFile(join(caseDir, 'evidence', file), 'utf8').catch(() => '')) + '\n'
  }
  const lower = haystack.toLowerCase()
  return [...brokenCitations, ...hashes.filter((hash) => !lower.includes(hash))]
}

export interface EvidenceMeta {
  id: string
  file: string
  sha256: string
  prevHash: string
  tool: string
  ts: string
}

/** Evidence meta rows in E-number order; malformed files are ignored. */
export async function listEvidenceMeta(caseDir: string): Promise<EvidenceMeta[]> {
  const files = await readdir(join(caseDir, 'evidence')).catch(() => [] as string[])
  const metas: EvidenceMeta[] = []
  for (const file of files.filter((name) => name.endsWith('.meta.json'))) {
    try {
      const parsed = JSON.parse(await readFile(join(caseDir, 'evidence', file), 'utf8')) as Partial<EvidenceMeta>
      if (typeof parsed.id === 'string' && typeof parsed.sha256 === 'string') {
        metas.push({
          id: parsed.id,
          file: typeof parsed.file === 'string' ? parsed.file : '',
          sha256: parsed.sha256,
          prevHash: typeof parsed.prevHash === 'string' ? parsed.prevHash : 'genesis',
          tool: typeof parsed.tool === 'string' ? parsed.tool : 'unknown',
          ts: typeof parsed.ts === 'string' ? parsed.ts : '',
        })
      }
    } catch { /* ignore a half-written meta */ }
  }
  return metas.sort((a, b) => a.id.localeCompare(b.id))
}

/** Chain head for a set of evidence ids (latest cited sha256). */
export async function evidenceChainHead(caseDir: string, ids?: string[]): Promise<string | undefined> {
  const metas = await listEvidenceMeta(caseDir)
  const wanted = ids === undefined ? metas : metas.filter((meta) => ids.includes(meta.id))
  return wanted.length > 0 ? wanted[wanted.length - 1].sha256 : undefined
}

/** Re-hash evidence and report ids whose content no longer matches its meta. */
export async function staleEvidenceIds(caseDir: string): Promise<string[]> {
  const metas = await listEvidenceMeta(caseDir)
  const stale: string[] = []
  for (const meta of metas) {
    const content = await readFile(join(caseDir, 'evidence', meta.file), 'utf8').catch(() => '')
    const sha = createHash('sha256').update(content, 'utf8').digest('hex')
    if (sha !== meta.sha256) stale.push(meta.id)
  }
  return stale
}

export async function appendTimeline(caseDir: string, line: string): Promise<void> {
  await appendFile(join(caseDir, 'CASE.md'), `- [${nowStamp()}] ${line}\n`, 'utf8')
}

export async function loadCaseMd(caseDir: string): Promise<string> {
  return await readFile(join(caseDir, 'CASE.md'), 'utf8')
}

export async function validateEvidenceIds(
  caseDir: string,
  ids: string[],
): Promise<{ ok: boolean; missing: string[]; known: string[] }> {
  const files = await readdir(join(caseDir, 'evidence')).catch(() => [] as string[])
  const known = files
    .filter((f) => !f.endsWith('.meta.json'))
    .map((f) => /^(E-\d{3})-/.exec(f)?.[1])
    .filter((x): x is string => Boolean(x))
  const missing = ids.filter((id) => !known.includes(id))
  return { ok: missing.length === 0, missing, known }
}

// ── Finding registry ────────────────────────────────────────────────────────
// A finding is no longer prose in findings.md alone: findings.json is the
// source of truth (severity / status / confidence / dedup counters), while the
// markdown stays the human audit trail. Design surveyed from ARTEX (severity +
// 9-state triage), xalgorix (CVSS→severity + weak-evidence downgrade),
// Decepticon (critical/high need 2+ verification methods), T3MP3ST
// (provenance caps severity), VulnClaw (verified-gate + dedup by type+location).

export const FINDING_SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number]
export const FINDING_STATUSES = ['candidate', 'verified', 'rejected', 'duplicate', 'wontfix'] as const
export type FindingStatus = (typeof FINDING_STATUSES)[number]
export const FINDING_CONFIDENCES = ['verified', 'probable', 'unverified'] as const
export type FindingConfidence = (typeof FINDING_CONFIDENCES)[number]

const SEVERITY_RANK: Record<FindingSeverity, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4 }
const STATUS_STRENGTH: Record<FindingStatus, number> = { candidate: 1, verified: 2, rejected: 3, duplicate: 3, wontfix: 3 }

export function isSeverity(value: unknown): value is FindingSeverity {
  return typeof value === 'string' && (FINDING_SEVERITIES as readonly string[]).includes(value)
}
export function isFindingStatus(value: unknown): value is FindingStatus {
  return typeof value === 'string' && (FINDING_STATUSES as readonly string[]).includes(value)
}
export function isConfidence(value: unknown): value is FindingConfidence {
  return typeof value === 'string' && (FINDING_CONFIDENCES as readonly string[]).includes(value)
}

/** CVSS v3 bands (xalgorix uses the same HackerOne-aligned buckets). */
export function cvssToSeverity(score: number): FindingSeverity {
  if (score >= 9.0) return 'critical'
  if (score >= 7.0) return 'high'
  if (score >= 4.0) return 'medium'
  if (score > 0) return 'low'
  return 'info'
}

function severityAtMost(severity: FindingSeverity, cap: FindingSeverity): FindingSeverity {
  return SEVERITY_RANK[severity] > SEVERITY_RANK[cap] ? cap : severity
}
function downgradeOne(severity: FindingSeverity): FindingSeverity {
  const order: FindingSeverity[] = ['info', 'low', 'medium', 'high', 'critical']
  const idx = Math.max(0, order.indexOf(severity) - 1)
  return order[idx]
}

export interface Finding {
  id: string
  title: string
  detail: string
  severity: FindingSeverity
  status: FindingStatus
  confidence: FindingConfidence
  vulnClass: string
  target?: string
  cvss?: number
  cvssVector?: string
  /** Severity the model asserted before CVSS / evidence-strength rules ran. */
  assertedSeverity?: FindingSeverity
  evidence: string
  evidenceIds: string[]
  /** Evidence chain head at record time (T-06). */
  evidenceHash?: string
  /** Independent negative-control evidence ids (T-02). */
  negativeEvidenceIds?: string[]
  negativeControl?: string
  /** PoC recipe/run id linking the finding to T-15 evidence. */
  pocId?: string
  /** Re-hash mismatch against the evidence meta chain (computed on load). */
  stale?: boolean
  repro?: string
  seenCount: number
  createdAt: string
  updatedAt: string
}

export interface FindingInput {
  title: string
  detail: string
  evidenceIds: string[]
  severity: FindingSeverity
  vulnClass?: string
  target?: string
  confidence?: FindingConfidence
  cvss?: number
  cvssVector?: string
  status?: FindingStatus
  repro?: string
  negativeEvidenceIds?: string[]
  negativeControl?: string
  pocId?: string
}

export interface RecordedFinding {
  finding: Finding
  merged: boolean
  notes: string[]
}

function findingsPath(caseDir: string): string {
  return join(caseDir, 'findings.json')
}

function normalizeKey(value: string | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Stable dedup key: vuln class + target + normalized title (xalgorix/VulnClaw). */
function findingKey(finding: Pick<Finding, 'vulnClass' | 'target' | 'title'>): string {
  return `${normalizeKey(finding.vulnClass || 'unspecified')}|${normalizeKey(finding.target)}|${normalizeKey(finding.title)}`
}

function normalizeFinding(raw: Partial<Finding> & { title?: string }, index: number): Finding {
  const severity = isSeverity(raw.severity) ? raw.severity : 'info'
  return {
    id: typeof raw.id === 'string' && /^F-\d+$/.test(raw.id) ? raw.id : `F-${String(index + 1).padStart(3, '0')}`,
    title: typeof raw.title === 'string' ? raw.title : '',
    detail: typeof raw.detail === 'string' ? raw.detail : '',
    severity,
    status: isFindingStatus(raw.status) ? raw.status : 'verified',
    confidence: isConfidence(raw.confidence) ? raw.confidence : 'probable',
    vulnClass: typeof raw.vulnClass === 'string' && raw.vulnClass.trim() !== '' ? raw.vulnClass : 'unspecified',
    ...(typeof raw.target === 'string' && raw.target.trim() !== '' ? { target: raw.target } : {}),
    ...(typeof raw.cvss === 'number' && Number.isFinite(raw.cvss) ? { cvss: raw.cvss } : {}),
    ...(typeof raw.cvssVector === 'string' && raw.cvssVector.trim() !== '' ? { cvssVector: raw.cvssVector.trim() } : {}),
    ...(isSeverity(raw.assertedSeverity) ? { assertedSeverity: raw.assertedSeverity } : {}),
    evidence: typeof raw.evidence === 'string' ? raw.evidence : (raw.evidenceIds ?? []).join(', '),
    evidenceIds: Array.isArray(raw.evidenceIds) ? raw.evidenceIds.map(String) : [],
    ...(typeof raw.evidenceHash === 'string' && raw.evidenceHash !== '' ? { evidenceHash: raw.evidenceHash } : {}),
    ...(Array.isArray(raw.negativeEvidenceIds) && raw.negativeEvidenceIds.length > 0
      ? { negativeEvidenceIds: raw.negativeEvidenceIds.map(String) }
      : {}),
    ...(typeof raw.negativeControl === 'string' && raw.negativeControl.trim() !== '' ? { negativeControl: raw.negativeControl } : {}),
    ...(typeof raw.pocId === 'string' && raw.pocId.trim() !== '' ? { pocId: raw.pocId } : {}),
    ...(raw.stale === true ? { stale: true } : {}),
    ...(typeof raw.repro === 'string' && raw.repro.trim() !== '' ? { repro: raw.repro } : {}),
    seenCount: typeof raw.seenCount === 'number' && raw.seenCount > 0 ? raw.seenCount : 1,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
  }
}

/** Legacy markdown fallback: entries written before findings.json existed. */
function parseFindingsMarkdown(raw: string): Finding[] {
  return raw.split(/^## /m).slice(1).map((chunk, index) => {
    const lines = chunk.split('\n')
    const title = (lines.shift() ?? '').trim()
    const meta = (name: string): string | undefined => {
      const line = lines.find((entry) => new RegExp(`^[-*]?\\s*${name}:`, 'i').test(entry))
      return line?.replace(new RegExp(`^[-*]?\\s*${name}:\\s*`, 'i'), '').trim()
    }
    const evidenceLine = lines.find((line) => /^evidence:/i.test(line)) ?? ''
    const reproLine = lines.find((line) => /^repro:/i.test(line)) ?? ''
    const detail = lines.filter((line) => !/^([-*]?\s*(severity|status|confidence|vuln_class):|evidence:|repro:)/i.test(line)).join('\n').trim()
    return normalizeFinding({
      id: `F-${String(index + 1).padStart(3, '0')}`,
      title,
      detail: detail.slice(0, 500),
      severity: (meta('severity') as FindingSeverity) ?? 'info',
      status: (meta('status') as FindingStatus) ?? 'verified',
      confidence: (meta('confidence') as FindingConfidence) ?? 'probable',
      vulnClass: meta('vuln_class'),
      evidence: evidenceLine.replace(/^evidence:\s*/i, ''),
      evidenceIds: evidenceLine.replace(/^evidence:\s*/i, '').split(/[,\s]+/).filter(Boolean),
      repro: reproLine.replace(/^repro:\s*/i, ''),
    }, index)
  }).filter((finding) => finding.title !== '')
}

async function markStaleFindings(caseDir: string, findings: Finding[]): Promise<Finding[]> {
  const stale = new Set(await staleEvidenceIds(caseDir))
  if (stale.size === 0) return findings
  for (const finding of findings) {
    if (finding.evidenceIds.some((id) => stale.has(id))) finding.stale = true
  }
  return findings
}

/** Findings: findings.json is authoritative; markdown is the legacy fallback. */
export async function loadFindings(caseDir: string): Promise<Finding[]> {
  try {
    const parsed: unknown = JSON.parse(await readFile(findingsPath(caseDir), 'utf8'))
    if (Array.isArray(parsed)) {
      return await markStaleFindings(caseDir, parsed.map((entry, index) => normalizeFinding(entry as Partial<Finding>, index)))
    }
  } catch { /* no registry yet: fall through to markdown */ }
  try {
    const raw = await readFile(join(caseDir, 'findings.md'), 'utf8')
    return await markStaleFindings(caseDir, parseFindingsMarkdown(raw))
  } catch {
    return []
  }
}

async function saveFindings(caseDir: string, findings: Finding[]): Promise<void> {
  await writeFile(findingsPath(caseDir), JSON.stringify(findings, null, 2), 'utf8')
}

/** Record one finding with severity/status/confidence rules.
 *  - CVSS, when supplied, is authoritative; the asserted value is kept for audit.
 *  - unverified confidence caps severity at medium; critical/high need >= 2
 *    independent evidence ids, otherwise they are downgraded one band.
 *  - identical vuln class + target + normalized title merges into the existing
 *    finding (evidence union, max severity, seen_count). */
export async function recordFinding(caseDir: string, input: FindingInput): Promise<RecordedFinding> {
  const title = input.title.trim()
  const detail = input.detail.trim()
  if (title === '') throw new Error('finding title is required')
  if (detail === '') throw new Error('finding detail is required')
  const evidenceIds = [...new Set(input.evidenceIds.map((id) => id.trim()).filter(Boolean))]
  if (evidenceIds.length === 0) throw new Error('at least one evidence id is required')
  const negativeEvidenceIds = [...new Set((input.negativeEvidenceIds ?? []).map((id) => id.trim()).filter(Boolean))]
  const overlap = negativeEvidenceIds.filter((id) => evidenceIds.includes(id))
  if (overlap.length > 0) throw new Error(`negative control must use independent evidence; overlap: ${overlap.join(', ')}`)
  if (negativeEvidenceIds.length > 0) {
    const known = await validateEvidenceIds(caseDir, negativeEvidenceIds)
    if (!known.ok) throw new Error(`unknown negative-control evidence ids: ${known.missing.join(', ')}`)
  }
  const evidenceHash = await evidenceChainHead(caseDir, [...evidenceIds, ...negativeEvidenceIds])

  const notes: string[] = []
  let severity: FindingSeverity = isSeverity(input.severity) ? input.severity : 'info'
  if (!isSeverity(input.severity)) notes.push(`unknown severity "${String(input.severity)}" coerced to info`)
  const assertedSeverity = severity
  let asserted: FindingSeverity | undefined

  const parsedVector = input.cvssVector !== undefined && input.cvssVector.trim() !== ''
    ? parseCvssVector(input.cvssVector)
    : undefined
  if (input.cvssVector !== undefined && input.cvssVector.trim() !== '' && parsedVector === undefined) {
    throw new Error(`invalid CVSS vector: ${input.cvssVector}`)
  }
  const cvssScore = parsedVector?.score ?? (typeof input.cvss === 'number' && Number.isFinite(input.cvss) ? input.cvss : undefined)
  if (cvssScore !== undefined) {
    const fromCvss = parsedVector?.severity ?? cvssToSeverity(Math.max(0, Math.min(10, cvssScore)))
    if (fromCvss !== severity) {
      asserted = severity
      severity = fromCvss
      notes.push(`severity overridden by CVSS ${cvssScore}${parsedVector !== undefined ? ' (vector)' : ''} → ${fromCvss} (asserted ${assertedSeverity})`)
    }
  }
  const confidence = isConfidence(input.confidence) ? input.confidence : 'probable'
  const capped = severityAtMost(severity, confidence === 'unverified' ? 'medium' : 'critical')
  if (capped !== severity) {
    notes.push(`severity capped at ${capped}: confidence=${confidence}`)
    severity = capped
  }
  if ((severity === 'critical' || severity === 'high') && evidenceIds.length < 2) {
    const next = downgradeOne(severity)
    notes.push(`severity downgraded ${severity} → ${next}: ${severity} requires >= 2 evidence ids, got ${evidenceIds.length}`)
    severity = next
  }

  const findings = await loadFindings(caseDir)
  const status: FindingStatus = isFindingStatus(input.status) ? input.status : 'verified'
  const key = findingKey({ vulnClass: input.vulnClass ?? '', target: input.target, title })
  const existing = findings.find((finding) => findingKey(finding) === key)
  const nowIso = new Date().toISOString()
  if (existing !== undefined) {
    existing.evidenceIds = [...new Set([...existing.evidenceIds, ...evidenceIds])]
    existing.evidence = existing.evidenceIds.join(', ')
    if (negativeEvidenceIds.length > 0) {
      existing.negativeEvidenceIds = [...new Set([...(existing.negativeEvidenceIds ?? []), ...negativeEvidenceIds])]
    }
    if (input.negativeControl !== undefined && input.negativeControl.trim() !== '') existing.negativeControl = input.negativeControl.trim()
    if (input.pocId !== undefined && input.pocId.trim() !== '') existing.pocId = input.pocId.trim()
    if (evidenceHash !== undefined) existing.evidenceHash = evidenceHash
    if (cvssScore !== undefined) existing.cvss = cvssScore
    if (input.cvssVector !== undefined && input.cvssVector.trim() !== '') existing.cvssVector = input.cvssVector.trim()
    existing.seenCount += 1
    existing.updatedAt = nowIso
    if (SEVERITY_RANK[severity] > SEVERITY_RANK[existing.severity]) existing.severity = severity
    if (STATUS_STRENGTH[status] > STATUS_STRENGTH[existing.status] && existing.status === 'candidate') existing.status = status
    await saveFindings(caseDir, findings)
    await appendTimeline(caseDir, `FINDING merge — ${existing.id} ${title} (+${evidenceIds.join(', ')})`)
    return { finding: existing, merged: true, notes }
  }

  const nextNumber = findings.reduce((best, finding) => {
    const match = /^F-(\d+)$/.exec(finding.id)
    return match ? Math.max(best, Number(match[1])) : best
  }, 0) + 1
  const finding: Finding = {
    id: `F-${String(nextNumber).padStart(3, '0')}`,
    title,
    detail,
    severity,
    status,
    confidence,
    vulnClass: (input.vulnClass ?? 'unspecified').trim() || 'unspecified',
    ...(input.target !== undefined && input.target.trim() !== '' ? { target: input.target.trim() } : {}),
    ...(cvssScore !== undefined ? { cvss: cvssScore } : {}),
    ...(input.cvssVector !== undefined && input.cvssVector.trim() !== '' ? { cvssVector: input.cvssVector.trim() } : {}),
    ...(asserted !== undefined ? { assertedSeverity: asserted } : {}),
    evidence: evidenceIds.join(', '),
    evidenceIds,
    ...(evidenceHash !== undefined ? { evidenceHash } : {}),
    ...(negativeEvidenceIds.length > 0 ? { negativeEvidenceIds } : {}),
    ...(input.negativeControl !== undefined && input.negativeControl.trim() !== ''
      ? { negativeControl: input.negativeControl.trim() }
      : {}),
    ...(input.pocId !== undefined && input.pocId.trim() !== '' ? { pocId: input.pocId.trim() } : {}),
    ...(input.repro !== undefined && input.repro.trim() !== '' ? { repro: input.repro.trim() } : {}),
    seenCount: 1,
    createdAt: nowIso,
    updatedAt: nowIso,
  }
  findings.push(finding)
  await saveFindings(caseDir, findings)
  await appendFile(
    join(caseDir, 'findings.md'),
    `\n## ${title}\n- severity: ${severity}\n- status: ${status}\n- confidence: ${confidence}\n- vuln_class: ${finding.vulnClass}\n${finding.target ? `- target: ${finding.target}\n` : ''}${finding.cvss !== undefined ? `- cvss: ${finding.cvss}\n` : ''}${detail}\nevidence: ${evidenceIds.join(', ')}\n${finding.repro ? `repro: ${finding.repro}\n` : ''}`,
    'utf8',
  )
  await appendTimeline(caseDir, `FINDING ${finding.id} — ${title} [${severity}/${status}] (${evidenceIds.join(', ')})`)
  return { finding, merged: false, notes }
}

/** Update one finding's triage state/severity (lifecycle: candidate → verified
 *  → rejected/duplicate/wontfix). Evidence and repro are immutable here. */
export async function updateFinding(
  caseDir: string,
  id: string,
  patch: { status?: FindingStatus; severity?: FindingSeverity; note?: string },
): Promise<Finding | undefined> {
  const findings = await loadFindings(caseDir)
  const finding = findings.find((entry) => entry.id === id)
  if (finding === undefined) return undefined
  if (patch.status !== undefined) {
    if (!isFindingStatus(patch.status)) throw new Error(`unknown finding status: ${String(patch.status)}`)
    finding.status = patch.status
  }
  if (patch.severity !== undefined) {
    if (!isSeverity(patch.severity)) throw new Error(`unknown severity: ${String(patch.severity)}`)
    finding.severity = patch.severity
  }
  finding.updatedAt = new Date().toISOString()
  await saveFindings(caseDir, findings)
  await appendTimeline(caseDir, `FINDING ${id} → ${finding.status}${patch.severity ? ` (${patch.severity})` : ''}${patch.note ? ` — ${patch.note}` : ''}`)
  return finding
}

export function severityCounts(findings: Finding[]): Record<FindingSeverity, number> {
  const counts: Record<FindingSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  for (const finding of findings) counts[finding.severity] += 1
  return counts
}

export function findingStatusCounts(findings: Finding[]): Record<FindingStatus, number> {
  const counts: Record<FindingStatus, number> = { candidate: 0, verified: 0, rejected: 0, duplicate: 0, wontfix: 0 }
  for (const finding of findings) counts[finding.status] += 1
  return counts
}

export async function closeCase(caseDir: string, summary?: string): Promise<void> {
  // 1. Auto-sweep any loose files left in case root to evidence/
  const swept = await sweepCaseRootFiles(caseDir)
  if (swept.length > 0) {
    await appendTimeline(caseDir, `SWEEP — auto-archived loose files to evidence/: ${swept.join(', ')}`)
  }

  // 2. Mark completed
  const md = await loadCaseMd(caseDir)
  await writeFile(join(caseDir, 'CASE.md'), md.replace(/^status: open/m, 'status: completed'), 'utf8')
  if (summary) await appendTimeline(caseDir, `END — ${summary.slice(0, 120)}`)
  else await appendTimeline(caseDir, 'END — closed by end_case')
}

export interface CaseSummary {
  name: string
  dir: string
  status: 'open' | 'completed' | 'unknown'
  goal: string
  mode: string
  route: string
  evidenceCount: number
  /** Finding counts for the Case list (T-13.1); omitted when unreadable. */
  findingsBySeverity?: Record<FindingSeverity, number>
  staleFindings?: number
  looseFiles: string[]
}

/** List all case directories under casesRoot with metadata. */
export async function listCasesOnDisk(root?: string): Promise<CaseSummary[]> {
  const base = casesRoot(root)
  if (!existsSync(base)) return []
  try {
    const entries = await readdir(base, { withFileTypes: true })
    const results: CaseSummary[] = []
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const dirPath = join(base, entry.name)
      const caseMdPath = join(dirPath, 'CASE.md')
      if (existsSync(caseMdPath)) {
        try {
          const md = await readFile(caseMdPath, 'utf8')
          const statusMatch = /^status:\s*(open|completed)\b/m.exec(md)
          const goalMatch = /^goal:\s*(.*)$/m.exec(md)
          const modeMatch = /^mode:\s*(.*)$/m.exec(md)
          const routeMatch = /^route:\s*(.*)$/m.exec(md)
          const evidenceCount = await countEvidence(dirPath)
          const looseFiles = await listLooseFilesInCase(dirPath)
          const findings = await loadFindings(dirPath)
          results.push({
            name: entry.name,
            dir: dirPath,
            status: (statusMatch?.[1] as any) ?? 'unknown',
            goal: goalMatch?.[1]?.trim() ?? 'unspecified',
            mode: modeMatch?.[1]?.trim() ?? 'full',
            route: routeMatch?.[1]?.trim() ?? 'pending (route_task)',
            evidenceCount,
            findingsBySeverity: severityCounts(findings),
            staleFindings: findings.filter((finding) => finding.stale).length,
            looseFiles,
          })
        } catch {}
      }
    }
    results.sort((a, b) => b.name.localeCompare(a.name))
    return results
  } catch {
    return []
  }
}

/** Check for non-case stray directories or files sitting directly in helmd-cases/. */
export async function auditCasesRoot(root?: string): Promise<{ cases: CaseSummary[]; strays: string[] }> {
  const base = casesRoot(root)
  const cases = await listCasesOnDisk(root)
  const strays: string[] = []
  if (!existsSync(base)) return { cases, strays }
  try {
    const entries = await readdir(base, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isFile()) {
        strays.push(`file:${entry.name}`)
      } else if (entry.isDirectory()) {
        const caseMdPath = join(base, entry.name, 'CASE.md')
        if (!existsSync(caseMdPath)) {
          strays.push(`dir:${entry.name}`)
        }
      }
    }
  } catch {}
  return { cases, strays }
}

/** Find the most recently created case marked status: open. */
export async function findOpenCaseOnDisk(root?: string): Promise<CaseInfo | undefined> {
  const all = await listCasesOnDisk(root)
  const open = all.find((c) => c.status === 'open')
  if (!open) return undefined
  return {
    dir: open.dir,
    name: open.name,
    goal: open.goal,
    mode: open.mode,
    route: open.route,
  }
}

/** Load a specific case by directory or folder name. */
export async function loadCaseInfoFromDisk(caseDirOrName: string, root?: string): Promise<CaseInfo | undefined> {
  const base = casesRoot(root)
  const dirPath = caseDirOrName.includes('/') || caseDirOrName.includes('\\')
    ? resolve(caseDirOrName)
    : join(base, caseDirOrName)
  const caseMdPath = join(dirPath, 'CASE.md')
  if (!existsSync(caseMdPath)) return undefined
  try {
    const md = await readFile(caseMdPath, 'utf8')
    const goalMatch = /^goal:\s*(.*)$/m.exec(md)
    const modeMatch = /^mode:\s*(.*)$/m.exec(md)
    const routeMatch = /^route:\s*(.*)$/m.exec(md)
    const scopeMatch = /^scope:\s*(.*)$/m.exec(md)
    return {
      dir: dirPath,
      name: basename(dirPath),
      goal: goalMatch?.[1]?.trim() ?? 'unspecified',
      mode: modeMatch?.[1]?.trim() ?? 'full',
      route: routeMatch?.[1]?.trim() ?? 'pending (route_task)',
      ...(scopeMatch?.[1]?.trim() ? { scope: scopeMatch[1].split(',').map((item) => item.trim()).filter(Boolean) } : {}),
    }
  } catch {
    return undefined
  }
}

/** List any loose unorganized files directly in the case root. */
export async function listLooseFilesInCase(caseDir: string): Promise<string[]> {
  const loose: string[] = []
  try {
    const entries = await readdir(caseDir, { withFileTypes: true })
    for (const e of entries) {
      if (e.isFile() && e.name !== 'CASE.md' && e.name !== 'findings.md') {
        loose.push(e.name)
      }
    }
  } catch {}
  return loose
}

/** Auto-sweep unorganized files from case root into evidence/. */
export async function sweepCaseRootFiles(caseDir: string): Promise<string[]> {
  const swept: string[] = []
  try {
    const loose = await listLooseFilesInCase(caseDir)
    for (const name of loose) {
      const src = join(caseDir, name)
      const dest = join(caseDir, 'evidence', name)
      if (!existsSync(dest)) {
        await rename(src, dest)
        swept.push(name)
      }
    }
  } catch {}
  return swept
}

// ── Hypothesis ledger ────────────────────────────────────────────────────────

export interface Hypothesis {
  id: string
  statement: string
  expected: string
  testCmd: string
  negativeCmd?: string
  observed?: string
  status: 'open' | 'confirmed' | 'refuted' | 'blocked'
  observation?: string
  evidenceIds: string[]
  createdAt: string
  updatedAt: string
}

const hypothesisCounters = new Map<string, number>()

function hypothesesPath(caseDir: string): string {
  return join(caseDir, 'hypotheses.json')
}

export async function recordHypothesis(
  caseDir: string,
  statement: string,
  expected: string,
  testCmd: string,
  evidenceIds: string[] = [],
  negativeCmd?: string,
): Promise<Hypothesis> {
  let count = hypothesisCounters.get(caseDir)
  if (count === undefined) {
    const existing = await loadHypotheses(caseDir)
    count = existing.length
    hypothesisCounters.set(caseDir, count)
  }
  count++
  hypothesisCounters.set(caseDir, count)
  const now = new Date().toISOString()
  const h: Hypothesis = {
    id: `H-${String(count).padStart(3, '0')}`,
    statement,
    expected,
    testCmd,
    ...(negativeCmd !== undefined && negativeCmd.trim() !== '' ? { negativeCmd: negativeCmd.trim() } : {}),
    status: 'open',
    evidenceIds,
    createdAt: now,
    updatedAt: now,
  }
  const all = await loadHypotheses(caseDir)
  all.push(h)
  await writeFile(hypothesesPath(caseDir), JSON.stringify(all, null, 2), 'utf8')
  await appendTimeline(caseDir, `HYPOTHESIS ${h.id} — ${statement.slice(0, 80)}`)
  return h
}

export async function updateHypothesis(
  caseDir: string,
  id: string,
  status: Hypothesis['status'],
  observation: string,
  evidenceIds: string[] = [],
): Promise<Hypothesis | undefined> {
  const all = await loadHypotheses(caseDir)
  const h = all.find((x) => x.id === id)
  if (!h) return undefined
  h.status = status
  h.observation = observation
  h.observed = observation
  if (evidenceIds.length > 0) h.evidenceIds = [...new Set([...h.evidenceIds, ...evidenceIds])]
  h.updatedAt = new Date().toISOString()
  await writeFile(hypothesesPath(caseDir), JSON.stringify(all, null, 2), 'utf8')
  await appendTimeline(caseDir, `HYPOTHESIS ${id} → ${status} — ${observation.slice(0, 80)}`)
  return h
}

export async function loadHypotheses(caseDir: string): Promise<Hypothesis[]> {
  try {
    return JSON.parse(await readFile(hypothesesPath(caseDir), 'utf8')) as Hypothesis[]
  } catch { return [] }
}

export async function getOpenHypothesisCount(caseDir: string): Promise<number> {
  const all = await loadHypotheses(caseDir)
  return all.filter((h) => h.status === 'open').length
}

/** Parse a CVSS v3.0/3.1 base vector. Returns undefined on malformed input;
 *  the score is authoritative over a caller-supplied number (T-13.3). */
export function parseCvssVector(vector: string): { score: number; severity: FindingSeverity } | undefined {
  const raw = vector.trim().replace(/^CVSS:3\.[01]\//i, '')
  const parts = new Map<string, string>()
  for (const pair of raw.split('/')) {
    const [key, value] = pair.split(':')
    if (key === undefined || value === undefined) return undefined
    parts.set(key.toUpperCase(), value.toUpperCase())
  }
  const av = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 }[parts.get('AV') ?? '']
  const ac = { L: 0.77, H: 0.44 }[parts.get('AC') ?? '']
  const ui = { N: 0.85, R: 0.62 }[parts.get('UI') ?? '']
  const scope = parts.get('S')
  const prTable = scope === 'C'
    ? { N: 0.85, L: 0.68, H: 0.5 }
    : { N: 0.85, L: 0.62, H: 0.27 }
  const pr = prTable[parts.get('PR') as 'N' | 'L' | 'H']
  const cia = { H: 0.56, L: 0.22, N: 0 }
  const c = cia[parts.get('C') as 'H' | 'L' | 'N']
  const i = cia[parts.get('I') as 'H' | 'L' | 'N']
  const a = cia[parts.get('A') as 'H' | 'L' | 'N']
  if (av === undefined || ac === undefined || ui === undefined || pr === undefined || scope === undefined
    || (scope !== 'U' && scope !== 'C') || c === undefined || i === undefined || a === undefined) return undefined
  const iss = 1 - (1 - c) * (1 - i) * (1 - a)
  const impact = scope === 'U' ? 6.42 * iss : 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15)
  const exploitability = 8.22 * av * ac * pr * ui
  if (impact <= 0) return { score: 0, severity: 'info' }
  const base = scope === 'U'
    ? Math.min(impact + exploitability, 10)
    : Math.min(1.08 * (impact + exploitability), 10)
  const score = Math.ceil(base * 10) / 10
  return { score, severity: cvssToSeverity(score) }
}

/** Deterministic SARIF 2.1.0 projection (T-13.2). Rejected findings are not
 *  promoted into the report; ordering is severity then F-id. */
export function renderSarif(caseName: string, findings: Finding[]): string {
  const rank = (finding: Finding): number => SEVERITY_RANK[finding.severity] ?? 0
  const visible = findings
    .filter((finding) => finding.status !== 'rejected')
    .slice()
    .sort((a, b) => rank(b) - rank(a) || a.id.localeCompare(b.id))
  const ruleIds = [...new Set(visible.map((finding) => finding.vulnClass))]
  const level = (severity: FindingSeverity): 'error' | 'warning' | 'note' =>
    severity === 'critical' || severity === 'high' ? 'error' : severity === 'medium' ? 'warning' : 'note'
  const sarif = {
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [{
      tool: {
        driver: {
          name: 'helm-d',
          informationUri: 'https://github.com/ADWMC/helm-d',
          rules: ruleIds.map((id) => ({ id, name: id })),
        },
      },
      results: visible.map((finding) => ({
        ruleId: finding.vulnClass,
        level: level(finding.severity),
        message: { text: finding.detail || finding.title },
        locations: [{
          physicalLocation: {
            artifactLocation: { uri: finding.target ?? caseName },
          },
        }],
        fingerprints: { 'helm-d/finding': finding.id },
        properties: {
          id: finding.id,
          severity: finding.severity,
          status: finding.status,
          confidence: finding.confidence,
          evidenceIds: finding.evidenceIds,
          ...(finding.repro !== undefined ? { repro: finding.repro } : {}),
          ...(finding.evidenceHash !== undefined ? { evidenceHash: finding.evidenceHash } : {}),
        },
      })),
    }],
  }
  return JSON.stringify(sarif, null, 2) + '\n'
}

/** Finding counts by creation day and severity, plus status transitions in the
 *  timeline. Deterministic order; used by the workbench trend line. */
export function findingTrend(findings: Finding[]): Array<{
  date: string
  total: number
  critical: number
  high: number
  medium: number
  low: number
  info: number
}> {
  const byDate = new Map<string, { total: number; critical: number; high: number; medium: number; low: number; info: number }>()
  for (const finding of findings) {
    const date = finding.createdAt.slice(0, 10)
    const row = byDate.get(date) ?? { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 }
    row.total += 1
    row[finding.severity] += 1
    byDate.set(date, row)
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }))
}

/** Deterministic report projection (T-11/T-13.2): fixed field order, stable
 *  severity/id sort, and explicit NOT RUN for missing repro/evidence. Rejected
 *  findings are listed separately and never mixed into the verified body. */
export function renderCaseReport(caseName: string, findings: Finding[]): string {
  const rank = (finding: Finding): number => SEVERITY_RANK[finding.severity] ?? 0
  const sortFindings = (items: Finding[]): Finding[] => items
    .slice()
    .sort((a, b) => rank(b) - rank(a) || a.id.localeCompare(b.id))
  const visible = sortFindings(findings.filter((finding) => finding.status !== 'rejected'))
  const rejected = sortFindings(findings.filter((finding) => finding.status === 'rejected'))
  const section = (title: string, items: Finding[]): string[] => {
    const lines = [`## ${title}`, '']
    if (items.length === 0) return [...lines, 'NOT RUN', '']
    for (const finding of items) {
      lines.push(
        `### ${finding.id} — ${finding.title}`,
        `- severity: ${finding.severity}`,
        `- status: ${finding.status}`,
        `- confidence: ${finding.confidence}`,
        `- vuln_class: ${finding.vulnClass}`,
        `- target: ${finding.target ?? 'unspecified'}`,
        `- cvss: ${finding.cvss ?? 'NOT RUN'}`,
        `- evidence: ${finding.evidenceIds.length > 0 ? finding.evidenceIds.join(', ') : 'NOT RUN'}`,
        `- repro: ${finding.repro?.trim() ? finding.repro : 'NOT RUN'}`,
        `- detail: ${finding.detail}`,
        '',
      )
    }
    return lines
  }
  return [
    `# ${caseName} — findings report`,
    '',
    ...section('Findings', visible),
    ...section('Rejected', rejected),
  ].join('\n').replace(/\n+$/, '\n')
}
