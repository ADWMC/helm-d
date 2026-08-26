// Case workspace core — pure fs/state operations, no cordis deps.
// Everything a case needs lives on disk; the in-memory map only binds
// a session (exec.agent.id) to its active case dir for convenience.

import { createHash } from 'node:crypto'
import { createReadStream, existsSync } from 'node:fs'
import { mkdir, copyFile, writeFile, appendFile, readFile, readdir } from 'node:fs/promises'
import { join, resolve, basename } from 'node:path'

export interface CaseInfo {
  dir: string
  name: string
  goal: string
  mode: string
  route: string
}

const bindings = new Map<string, CaseInfo>()

export function getCase(sessionId?: string): CaseInfo | undefined {
  return bindings.get(sessionId ?? '__global__')
}

export function bindCase(sessionId: string | undefined, info: CaseInfo): void {
  bindings.set(sessionId ?? '__global__', info)
}

export function unbindCase(sessionId?: string): CaseInfo | undefined {
  const key = sessionId ?? '__global__'
  const info = bindings.get(key)
  bindings.delete(key)
  return info
}

/** Root resolution: explicit arg > HELMD_CASES_DIR > process.cwd(). */
export function casesRoot(root?: string): string {
  const base = root?.trim() || process.env.HELMD_CASES_DIR?.trim() || process.cwd()
  return resolve(base, 'helmd-cases')
}

export function toolsShelfRoot(root?: string): string {
  const base = root?.trim() || process.env.HELMD_CASES_DIR?.trim() || process.cwd()
  return resolve(base, 'helmd-tools')
}

function slugify(text: string, max = 40): string {
  const slug = text.toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '')
  return (slug || 'case').slice(0, max)
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
    `goal: ${opts.goal}`,
    ...(lines.length ? ['samples:', ...lines] : []),
    '',
    '## timeline',
    `- [${nowStamp()}] BEGIN — created by begin_case`,
    '',
    '## resume',
    'context compacted? → case_status() first. Parameters come from evidence/, never memory.',
    '',
  ].join('\n')
  await writeFile(join(dir, 'CASE.md'), caseMd, 'utf8')
  await writeFile(join(dir, 'findings.md'), `# FINDINGS ${name}\n`, 'utf8')

  return { dir, name, goal: opts.goal, mode: opts.mode, route: opts.route }
}

/** Next E-number = max existing + 1 (survives restarts; no in-memory counter). */
export async function nextEvidenceId(caseDir: string): Promise<string> {
  const files = await readdir(join(caseDir, 'evidence')).catch(() => [] as string[])
  let max = 0
  for (const f of files) {
    const m = /^E-(\d{3})-/.exec(f)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `E-${String(max + 1).padStart(3, '0')}`
}

export async function saveEvidence(
  caseDir: string,
  toolLabel: string,
  content: string,
  summary: string,
): Promise<{ id: string; path: string }> {
  const id = await nextEvidenceId(caseDir)
  const safeTool = toolLabel.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40) || 'output'
  const capped = content.length > 256 * 1024
    ? content.slice(0, 256 * 1024) + `\n[truncated at 256KB; full length ${content.length}]\n`
    : content
  const path = join(caseDir, 'evidence', `${id}-${safeTool}.txt`)
  await writeFile(path, capped, 'utf8')
  await appendTimeline(caseDir, `${toolLabel} → ${id} — ${summary.slice(0, 80)}`)
  return { id, path }
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
    .map((f) => /^(E-\d{3})-/.exec(f)?.[1])
    .filter((x): x is string => Boolean(x))
  const missing = ids.filter((id) => !known.includes(id))
  return { ok: missing.length === 0, missing, known }
}

export async function appendFinding(
  caseDir: string,
  title: string,
  detail: string,
  ids: string[],
): Promise<void> {
  await appendFile(
    join(caseDir, 'findings.md'),
    `\n## ${title}\n${detail}\nevidence: ${ids.join(', ')}\n`,
    'utf8',
  )
  await appendTimeline(caseDir, `FINDING — ${title} (${ids.join(', ')})`)
}

export async function closeCase(caseDir: string, summary?: string): Promise<void> {
  const md = await loadCaseMd(caseDir)
  await writeFile(join(caseDir, 'CASE.md'), md.replace(/^status: open/m, 'status: completed'), 'utf8')
  if (summary) await appendTimeline(caseDir, `END — ${summary.slice(0, 120)}`)
  else await appendTimeline(caseDir, 'END — closed by end_case')
}
