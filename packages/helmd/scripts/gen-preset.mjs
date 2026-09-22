#!/usr/bin/env node
/**
 * gen-preset.mjs — generate the package-internal preset patch
 * (`preset.generated.patch.yml`) from the HOST's own installed standard preset.
 *
 * 0.1.7 shape: a preset is ONE composition entry (`name: '@deepseek-ai/dsh-agent-preset'`)
 * whose `config.plugins` list carries the platform rows; the standard lives at
 * `<dsh>/…/dsh-web-app/presets/standard.patch.yml`. Our generated file is a
 * sibling insert-patch declaring preset id `helmd`, loaded through the bundle's
 * `dsh.bundle.patch` array — there is no `.agent-presets/` deployment step anymore.
 *
 * Output = host `config.plugins` − host persona + luna persona + helmd row.
 *
 * The first line of the generated file is
 *
 *   # gen-preset: host=<sha256 of the host standard text>
 *
 * so --check / the health card can tell WHICH side moved: a fingerprint mismatch
 * means the installed dsh upgraded (regenerate), a content mismatch with a
 * matching fingerprint means persona.txt or the file itself changed (re-sync).
 *
 * Persona single source: packages/helmd/presets/persona.txt (repo) or
 * <bundle>/presets/persona.txt (installed bundle; resolved relative to this
 * script so the same file works in both layouts).
 * Overridable host discovery env: DSH_HOST_STANDARD_YML
 *
 * Usage:
 *   node scripts/gen-preset.mjs              # write the package-internal patch
 *   node scripts/gen-preset.mjs --out <file> # write that file instead
 *                                             #   (<dir> ⇒ <dir>/preset.generated.patch.yml)
 *   node scripts/gen-preset.mjs --check      # verify on-disk == freshly generated;
 *                                             #   distinguishes "host upgraded"
 *                                             #   (fingerprint moved) from "file
 *                                             #   drifted" (same host fingerprint)
 *
 * Requires a 0.1.7+ host standard (a `plugins:` list). Against an older host it
 * fails loud rather than emitting a preset the current loader cannot consume.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')

const CHECK = process.argv.includes('--check')
// --out <file|dir>: writers for installed-bundle / test use. Default already IS
// the package-internal patch, so the health heal and setup scripts pass it only
// to redirect (tests) or to be explicit.
let outArg = null
for (let i = 0; i < process.argv.length - 1; i++) {
  if (process.argv[i] === '--out') outArg = process.argv[i + 1]
}
if (outArg !== null && outArg === '') throw new Error('--out requires a file or directory argument')

// Persona search order: repo layout then installed-bundle layout.
function findPersona() {
  const candidates = [
    join(repoRoot, 'packages', 'helmd', 'presets', 'persona.txt'),
    join(repoRoot, 'presets', 'persona.txt'),
  ]
  for (const c of candidates) if (exists(c)) return c
  throw new Error('cannot find persona.txt (looked in repo and bundle layouts)')
}
const personaPath = findPersona()

// Default output: the package-internal patch in BOTH layouts —
// repo layout writes packages/helmd/preset.generated.patch.yml, bundle layout
// (script living at <pkg>/scripts) writes <pkg>/preset.generated.patch.yml.
// Probe a FILE inside the package: readFileSync on a directory throws EISDIR.
const defaultOut = exists(join(repoRoot, 'packages', 'helmd', 'package.json'))
  ? join(repoRoot, 'packages', 'helmd', 'preset.generated.patch.yml')
  : join(repoRoot, 'preset.generated.patch.yml')

const outPaths = outArg === null
  ? [defaultOut]
  : [outArg.endsWith('.yml') || outArg.endsWith('.yaml')
    ? resolve(outArg)
    : join(resolve(outArg), 'preset.generated.patch.yml')]

// ── locate the host's shipped standard preset ──────────────────────────────
// Tail segments per host generation, newest first: 0.1.7 keeps the standard as
// a web-app preset patch; 0.1.5 shipped the full agent.cordis.yml.
const TAILS = [
  ['@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-web-app', 'presets', 'standard.patch.yml'],
  ['@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-agent-presets', 'presets', 'standard', 'agent.cordis.yml'],
  ['@deepseek-ai', 'dsh', 'config', 'agent-presets', 'standard', 'agent.cordis.yml'],
]

/** Candidate global node_modules roots: npm-reported, platform defaults, PATH prefixes. */
function nodeModulesBases() {
  const bases = []
  // On win32 npm is an npm.cmd shim, and Node >=20 refuses to spawn .cmd
  // without a shell (CVE-2024-27980). Passing one static command string keeps
  // the shell harmless and avoids the DEP0190 args+shell warning.
  const npmRootCmd = process.platform === 'win32' ? 'npm.cmd root -g' : 'npm root -g'
  try {
    const root = execSync(npmRootCmd, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    if (root) bases.push(root)
  } catch (e) {
    console.error(`note: "${npmRootCmd}" failed (${String(e.message).split('\n')[0]}); probing default locations`)
  }
  if (process.env.APPDATA) bases.push(join(process.env.APPDATA, 'npm', 'node_modules'))
  bases.push('/usr/local/lib/node_modules', '/usr/lib/node_modules')
  // The official installer/bundle puts dsh beside its own binary: a PATH entry
  // IS the install prefix (D:\NodeJS\node_modules\…), so probe entries too.
  const sep = process.platform === 'win32' ? ';' : ':'
  for (const raw of (process.env.PATH ?? '').split(sep)) {
    const dir = raw.replace(/[\\/]+$/, '')
    if (dir === '') continue
    bases.push(join(dir, 'node_modules'), join(dir, 'lib', 'node_modules'))
  }
  return bases
}

function locateHostStandard() {
  if (process.env.DSH_HOST_STANDARD_YML) {
    const p = resolve(process.env.DSH_HOST_STANDARD_YML)
    if (!exists(p)) throw new Error(`DSH_HOST_STANDARD_YML points to missing file: ${p}`)
    return p
  }
  const bases = [...new Set(nodeModulesBases().map((b) => resolve(b)))]
  const probed = []
  for (const b of bases) {
    for (const tail of TAILS) {
      const c = join(b, ...tail)
      probed.push(c)
      if (exists(c)) return c
    }
  }
  throw new Error(
    'host standard preset not found; probed:\n  ' + probed.join('\n  ')
    + '\nset DSH_HOST_STANDARD_YML to the host\'s dsh-web-app/presets/standard.patch.yml (dsh >= 0.1.7)',
  )
}
function exists(p) {
  try { readFileSync(p); return true } catch { return false }
}

// ── shared extraction (mirrored in packages/helmd/src/health.ts) ───────────
/**
 * Top-level plugin-row ids of either preset shape: ids directly under a
 * `plugins:` list (0.1.7, indent = plugins + 2 — group children sit deeper and
 * are skipped), or column-0 `- id:` rows of a legacy agent.cordis.yml.
 */
export function pluginRowIds(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const pi = lines.findIndex((l) => /^\s*plugins:\s*$/.test(l))
  if (pi < 0) return [...text.matchAll(/^- id: (.+)$/gm)].map((m) => m[1].trim())
  const pIndent = lines[pi].length - lines[pi].trimStart().length
  const base = pIndent + 2
  const out = []
  for (let i = pi + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    const ind = line.length - line.trimStart().length
    if (ind <= pIndent) break
    if (ind !== base) continue
    const m = line.trimStart().match(/^-\s+id:\s*(.+)$/)
    if (m) out.push(m[1].trim())
  }
  return out
}

// ── transform ───────────────────────────────────────────────────────────────
/** Render the luna persona row at the given `- id:` indent of the plugins list. */
function renderPersonaRow(text, base) {
  const id = ' '.repeat(base)
  const key = ' '.repeat(base + 2)
  const conf = ' '.repeat(base + 4)
  const body = ' '.repeat(base + 6)
  const lines = text.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n')
  const rendered = lines.map((l) => (l === '' ? '' : body + l)).join('\n')
  return [
    `${id}- id: persona`,
    `${key}name: '@deepseek-ai/dsh-persona'`,
    `${key}config:`,
    `${conf}prefix: |`,
    rendered,
    `${conf}complete: false`,
    `${conf}includeRuntimeContext: false`,
  ]
}

// preset.yml (old sidecar) keeps the display text; 0.1.7 reads it from the
// entry config instead, so migrate `description`/`order` into the header.
function presetMeta() {
  const candidates = [
    join(repoRoot, 'packages', 'helmd', 'presets', 'preset.yml'),
    join(repoRoot, 'presets', 'preset.yml'),
  ]
  for (const c of candidates) {
    if (!exists(c)) continue
    const text = readFileSync(c, 'utf8')
    const order = text.match(/^order:\s*(\d+)\s*$/m)
    const description = text.match(/^description:\s*(.+?)\s*$/m)
    return {
      order: order ? Number(order[1]) : null,
      description: description ? description[1] : null,
    }
  }
  return { order: null, description: null }
}

/** Retarget the host entry header at our preset: `- id: preset-helmd`, config `id: helmd`. */
function rewriteEntryHeader(header, meta) {
  let inConfig = false
  let sawPresetId = false
  let sawConfigId = false
  const out = []
  for (const line of header) {
    let m
    if ((m = line.match(/^(\s*- id: )preset-[\w-]+$/))) {
      out.push(m[1] + 'preset-helmd')
      sawPresetId = true
    } else if (/^\s*config:\s*$/.test(line)) {
      inConfig = true
      out.push(line)
    } else if (inConfig && (m = line.match(/^(\s*)id: \S+$/))) {
      out.push(`${m[1]}id: helmd`)
      if (meta.description) {
        const d = /^["']/.test(meta.description) ? meta.description : JSON.stringify(meta.description)
        out.push(`${m[1]}description: ${d}`)
      }
      sawConfigId = true
    } else if (inConfig && meta.order != null && (m = line.match(/^(\s*)order: \S+$/))) {
      out.push(`${m[1]}order: ${meta.order}`)
    } else {
      out.push(line)
    }
  }
  if (!sawPresetId) throw new Error('host entry row is not `- id: preset-<name>` - unexpected 0.1.7 standard shape')
  if (!sawConfigId) throw new Error('host entry config has no `id:` line')
  return out
}

function generate(hostText, personaText) {
  const lines = hostText.replace(/\r\n/g, '\n').split('\n')
  // Trailing blank line from the final newline: it would land between the last
  // host row and our appended `helmd` row.
  while (lines.length && lines[lines.length - 1] === '') lines.pop()
  const pi = lines.findIndex((l) => /^\s*plugins:\s*$/.test(l))
  if (pi < 0) {
    throw new Error('host standard has no `plugins:` list — dsh >= 0.1.7 required (install the 0.1.7 host, or point DSH_HOST_STANDARD_YML at its dsh-web-app/presets/standard.patch.yml)')
  }
  const pIndent = lines[pi].length - lines[pi].trimStart().length
  const base = pIndent + 2
  const basePrefix = ' '.repeat(base)
  // plugins block = everything more-indented than its key (0.1.7 puts it last).
  let end = lines.length
  for (let i = pi + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    if (line.length - line.trimStart().length <= pIndent) { end = i; break }
  }
  let personaStart = -1
  let personaEnd = -1
  for (let i = pi + 1; i < end; i++) {
    if (!lines[i].startsWith(`${basePrefix}- id: `)) continue
    if (lines[i].startsWith(`${basePrefix}- id: persona`) && personaStart < 0) personaStart = i
    else if (personaStart >= 0) { personaEnd = i; break }
  }
  if (personaStart < 0) throw new Error('host standard has no top-level `persona` row in plugins')
  if (personaEnd < 0) personaEnd = end
  const helmdRow = [
    `${basePrefix}- id: helmd`,
    `${' '.repeat(base + 2)}name: '@adwmc/helm-d/agent'`,
  ]
  const insertIdx = lines.findIndex((l) => l === '- insert:')
  if (insertIdx < 0 || insertIdx > pi) {
    throw new Error('host standard is not an insert-patch (no top-level `- insert:`) - expected dsh >= 0.1.7 dsh-web-app/presets/standard.patch.yml')
  }
  const outLines = [
    ...rewriteEntryHeader(lines.slice(insertIdx, pi), presetMeta()),
    ...lines.slice(pi, personaStart),
    ...renderPersonaRow(personaText, base),
    ...lines.slice(personaEnd, end),
    ...helmdRow,
    ...lines.slice(end),
  ]
  const out = outLines.join('\n')
  assertShape(hostText, out, personaText, base)
  return out.replace(/\n*$/, '') + '\n'
}

// ── assertions: fail loud, never emit a silently-wrong preset ──────────────
function assertShape(hostText, out, personaText, base) {
  const hostIds = pluginRowIds(hostText)
  const outIds = pluginRowIds(out)
  const expect = [...hostIds, 'helmd'].sort()
  const got = [...outIds].sort()
  if (JSON.stringify(got) !== JSON.stringify(expect)) {
    throw new Error(`row id set mismatch\n  expected: ${expect.join(', ')}\n  got:      ${got.join(', ')}`)
  }
  for (const id of outIds) {
    const count = outIds.filter((candidate) => candidate === id).length
    if (count !== 1 && id !== '_') throw new Error(`duplicated row id: ${id} (x${count})`)
  }
  if ((out.match(/@adwmc\/helm-d/g) ?? []).length !== 1) throw new Error('preset must declare helmd exactly once')
  if (!out.includes('- id: preset-helmd')) throw new Error('entry row `- id: preset-helmd` missing')
  if (!out.includes("name: '@deepseek-ai/dsh-agent-preset'")) throw new Error('entry must declare @deepseek-ai/dsh-agent-preset')

  const basePrefix = ' '.repeat(base)
  const pStart = out.indexOf(`${basePrefix}- id: persona`)
  if (pStart < 0) throw new Error('persona row missing from output')
  const pNext = out.indexOf(`${basePrefix}- id: `, pStart + 1)
  const pBlock = pNext < 0 ? out.slice(pStart) : out.slice(pStart, pNext)
  if (!out.includes('id: helmd')) throw new Error('entry config `id: helmd` missing')
  for (const probe of ['complete: false', 'includeRuntimeContext: false']) {
    if (!pBlock.includes(probe)) throw new Error(`persona row lost ${probe}`)
  }
  if (pBlock.includes('{{model}}') || pBlock.includes('{{cwd}}')) {
    throw new Error('luna persona leaked host template placeholders - persona.txt is wrong?')
  }
  if (!out.includes('helmd online')) throw new Error('activation line missing from persona')
  if (!personaText.trim()) throw new Error('persona.txt is empty')
}

// ── main ────────────────────────────────────────────────────────────────────
const hostYml = locateHostStandard()
const hostText = readFileSync(hostYml, 'utf8')
const hostHash = createHash('sha256').update(hostText, 'utf8').digest('hex')
const personaText = readFileSync(personaPath, 'utf8')
const body = generate(hostText, personaText)
const generated = `# gen-preset: host=${hostHash}\n\n` + body

// Generated files are written with LF, but a Windows checkout with
// core.autocrlf=true (and no .gitattributes pinning these paths) hands them
// back as CRLF. Normalising before every comparison keeps the check about
// *content*, not about which platform last touched the working tree.
function normalizeEol(text) {
  return text.replace(/\r\n/g, '\n')
}

// Read a generated file's recorded host fingerprint, or null when absent.
function fileFingerprint(p) {
  let cur
  try { cur = readFileSync(p, 'utf8') } catch { return null }
  const m = normalizeEol(cur).match(/^# gen-preset: host=([0-9a-f]{64})\n/)
  return m ? m[1] : null
}

if (CHECK) {
  let bad = false
  for (const p of outPaths) {
    let cur
    try { cur = readFileSync(p, 'utf8') } catch { cur = null }
    if (cur !== null && normalizeEol(cur) === generated) continue
    const fp = fileFingerprint(p)
    if (fp !== null && fp !== hostHash) {
      console.error(`HOST UPGRADED: ${p} was generated against dsh standard ${fp.slice(0, 12)}…;`)
      console.error(`  the installed host standard now hashes ${hostHash.slice(0, 12)}… — platform rows are stale.`)
      console.error(`  regenerate: node ${process.argv[1]}  (or re-run repack / setup-preset)`)
    } else if (cur === null) {
      console.error(`NOT GENERATED: ${p} does not exist yet`)
    } else {
      console.error(`STALE: ${p} does not match generation from ${hostYml} (same host fingerprint, content drifted)`)
    }
    bad = true
  }
  console.log(bad ? 'preset check FAILED' : `preset check OK (${hostYml})`)
  process.exit(bad ? 1 : 0)
}

let wroteAny = false
for (const p of outPaths) {
  const oldFp = fileFingerprint(p)
  mkdirSync(dirname(p), { recursive: true })
  // Avoid changing mtime when the generated bytes are already current. dsh
  // uses the composition file stamp to decide whether to rebuild a standing
  // mount; a no-op install must not trigger a second registration attempt.
  let current = null
  try { current = readFileSync(p, 'utf8') } catch { /* new output */ }
  if (current !== null && normalizeEol(current) === generated) {
    console.log(`unchanged: ${p}`)
    continue
  }
  writeFileSync(p, generated, 'utf8')
  wroteAny = true
  console.log(`generated: ${p}`)
  if (oldFp !== null && oldFp !== hostHash) {
    console.log(`  note: host standard changed since last generation (${oldFp.slice(0, 12)}… → ${hostHash.slice(0, 12)}…)`)
  }
}
if (!wroteAny) console.log('nothing to write')
console.log(`source of truth: ${hostYml}`)