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
 * Overridable host version (fixture/tests with a bare standard file): DSH_HOST_VERSION
 *
 * The host-native Agent Teams rows are emitted with the package names of the
 * TARGET host generation: dsh 0.2.2-rc.2 renamed
 * `@deepseek-ai/dsh-experimental-{tool-,}agent-team` to
 * `@deepseek-ai/dsh-{tool-,}agent-team` (the experimental names stop at
 * 0.2.2-rc.1). The version is read from the located host tree, so a renamed
 * host never gets a specifier it cannot resolve.
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
/** Set by locateHostStandard() when DSH_HOST_STANDARD_YML supplied the path. */
let locatedFromEnv = false
// --out <file|dir>: writers for installed-bundle / test use. Default already IS
// the package-internal patch, so the health heal and setup scripts pass it only
// to redirect (tests) or to be explicit.
let outArg = null
for (let i = 0; i < process.argv.length - 1; i++) {
  if (process.argv[i] === '--out') outArg = process.argv[i + 1]
}
if (outArg !== null && outArg === '') throw new Error('--out requires a file or directory argument')

// Persona search order: repo layout then installed-bundle layout. Sealed
// installs intentionally omit persona.txt (it lives in profiles.dat), so a
// missing source is not an error there: the generated patch carries an empty
// persona prefix and only needs the activation marker for its sanity check.
function findPersona() {
  const candidates = [
    join(repoRoot, 'packages', 'helmd', 'presets', 'persona.txt'),
    join(repoRoot, 'presets', 'persona.txt'),
  ]
  for (const c of candidates) if (exists(c)) return c
  return null
}
const personaPath = findPersona()
if (personaPath === null) {
  console.error('note: persona.txt not shipped (sealed bundle); using the activation marker for preset sanity')
}

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

// ── desktop (Electron) host support ─────────────────────────────────────────
// The desktop product bundles the whole dsh tree INSIDE its archive at
// resources/app.asar/dsh/… (electron-builder `files: [{ from: dsh, to: 'dsh' }]`;
// asarUnpack only lifts native modules out), so none of the node_modules probes
// below can see it. productName is 'DeepSeek Harness'.
const DESKTOP_ASAR_ENTRIES = [
  'dsh/node_modules/@deepseek-ai/dsh-web-app/presets/standard.patch.yml',
  'dsh/node_modules/@deepseek-ai/dsh-agent-presets/presets/standard/agent.cordis.yml',
]

/**
 * Read one file out of an Electron `app.asar` without dependencies. Layout:
 * a 4-byte LE length, a small pickled frame, the JSON filesystem map, then the
 * file bytes at a 4-byte-aligned base; each entry's `offset` (string past 2 GiB
 * archives) is relative to that base. Map keys carry the packing platform's
 * separator, so lookups split on both. Returns null for anything unreadable.
 */
export function readAsarEntry(archive, entry) {
  let buf
  try { buf = readFileSync(archive) } catch { return null }
  const jsonStart = buf.indexOf('{"files"')
  if (jsonStart < 0) return null
  // Brace-match the map: it is one JSON object and may contain braces in strings.
  let depth = 0, end = -1, inStr = false, esc = false
  for (let i = jsonStart; i < buf.length; i++) {
    const c = buf[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === 0x5c) esc = true
      else if (c === 0x22) inStr = false
      continue
    }
    if (c === 0x22) inStr = true
    else if (c === 0x7b) depth++
    else if (c === 0x7d && --depth === 0) { end = i + 1; break }
  }
  if (end < 0) return null
  let header
  try { header = JSON.parse(buf.slice(jsonStart, end).toString('utf8')) } catch { return null }
  // The map nests as directory → { files: { children } } per level; a file entry
  // carries size/offset directly.
  let map = header.files
  let node = null
  for (const part of entry.split(/[/\\]/)) {
    if (map === null || typeof map !== 'object') return null
    node = map[part]
    if (node === undefined || node === null || typeof node !== 'object') return null
    map = node.files
  }
  if (node === null || typeof node !== 'object' || typeof node.size !== 'number') return null
  if (node.unpacked === true) {
    // asarUnpack entries live as real files beside the archive.
    try { return readFileSync(join(archive + '.unpacked', ...entry.split(/[/\\]/)), 'utf8') } catch { return null }
  }
  const base = (end + 3) & ~3
  const start = base + Number(node.offset)
  if (start + node.size > buf.length) return null
  return buf.slice(start, start + node.size).toString('utf8')
}

/**
 * Candidate desktop archives: the archive of the RUNNING packaged binary (the
 * desktop host runs inside `resources/app.asar` on the same executable, so
 * `process.execPath` and Electron's `process.resourcesPath` pin it for any
 * install root), the standard install roots for productName 'DeepSeek Harness',
 * plus <PATH entry>/../../../resources/app.asar because the installed bundled
 * CLI lives at <app>/resources/runtime/cli/bin.
 * DSH_DESKTOP_APP_ASAR pins one archive explicitly.
 */
function desktopAsarCandidates() {
  const out = []
  const pinned = process.env.DSH_DESKTOP_APP_ASAR?.trim()
  if (pinned) out.push(resolve(pinned))
  const push = (p) => { if (p) out.push(p) }
  // Self-anchor first: a custom install root (D:\DeepSeek Harness, a portable
  // build, …) matches none of the default locations, and the host that loads
  // this plugin IS the packaged binary beside its own resources/app.asar.
  const exeDir = dirname(process.execPath ?? '')
  if (exeDir !== '' && exeDir !== '.') push(join(exeDir, 'resources', 'app.asar'))
  const resourcesPath = process.resourcesPath
  if (typeof resourcesPath === 'string' && resourcesPath !== '') push(join(resourcesPath, 'app.asar'))
  const app = process.platform === 'win32' ? 'DeepSeek Harness' : 'DeepSeek Harness'
  if (process.env.LOCALAPPDATA) push(join(process.env.LOCALAPPDATA, 'Programs', app, 'resources', 'app.asar'))
  if (process.env.PROGRAMFILES) push(join(process.env.PROGRAMFILES, app, 'resources', 'app.asar'))
  if (process.env['PROGRAMFILES(X86)']) push(join(process.env['PROGRAMFILES(X86)'], app, 'resources', 'app.asar'))
  push('/Applications/DeepSeek Harness.app/Contents/Resources/app.asar')
  if (process.env.HOME) push(join(process.env.HOME, 'Applications', 'DeepSeek Harness.app', 'Contents', 'Resources', 'app.asar'))
  push('/opt/DeepSeek Harness/resources/app.asar')
  const sep = process.platform === 'win32' ? ';' : ':'
  for (const raw of (process.env.PATH ?? '').split(sep)) {
    const dir = raw.replace(/[\\/]+$/, '')
    if (dir !== '') push(join(dir, '..', '..', '..', 'resources', 'app.asar'))
  }
  return [...new Set(out)]
}

/**
 * Read the host standard text. A located desktop archive is returned as
 * `<archive>!<entry>` (the `!` form is what locateHostStandard hands back).
 */
export function readHostStandardText(located) {
  const bang = located.indexOf('!')
  if (bang <= 0) return readFileSync(located, 'utf8')
  const archive = located.slice(0, bang)
  const entry = located.slice(bang + 1)
  const text = readAsarEntry(archive, entry)
  if (text === null) throw new Error(`cannot read ${entry} out of the desktop archive ${archive}`)
  return text
}

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
    locatedFromEnv = true
    return p
  }
  // Desktop installs first: the bundled host inside app.asar is the one that
  // actually loads the plugin, and an npm-global dsh beside it is unrelated.
  for (const archive of desktopAsarCandidates()) {
    for (const entry of DESKTOP_ASAR_ENTRIES) {
      if (readAsarEntry(archive, entry) !== null) return `${archive}!${entry}`
    }
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
    + '\nset DSH_HOST_STANDARD_YML to the host\'s dsh-web-app/presets/standard.patch.yml (dsh >= 0.1.7),'
    + ' or DSH_DESKTOP_APP_ASAR to a desktop installation\'s resources/app.asar',
  )
}
function exists(p) {
  try { readFileSync(p); return true } catch { return false }
}

// ── host-generation-dependent row names ─────────────────────────────────────
// dsh 0.2.2-rc.2 renamed the host-native Agent Teams packages; the experimental
// names stop at 0.2.2-rc.1. A row's `name` is a package specifier the loader
// imports only while the row is enabled, so a stale name silently drops the team
// tools instead of failing loud — the generator must pick by target host.
const TEAM_PACKAGES = {
  tool: { current: '@deepseek-ai/dsh-tool-agent-team', legacy: '@deepseek-ai/dsh-experimental-tool-agent-team' },
  service: { current: '@deepseek-ai/dsh-agent-team', legacy: '@deepseek-ai/dsh-experimental-agent-team' },
}
/** First host release that ships the renamed (non-experimental) packages. */
const TEAM_RENAME_HOST = '0.2.2-rc.2'

/** Split a located standard into its archive form (`archive!entry`) and entry path. */
function splitLocated(located) {
  const bang = located.indexOf('!')
  return bang > 0
    ? { archive: located.slice(0, bang), entry: located.slice(bang + 1) }
    : { archive: null, entry: located }
}

/**
 * The `@deepseek-ai` package directory that owns the located standard:
 * `<…>/node_modules/@deepseek-ai/dsh-web-app/presets/standard.patch.yml`.
 */
function hostScope(located) {
  const { archive, entry } = splitLocated(located)
  if (archive === null) {
    const dir = dirname(dirname(dirname(entry)))
    return { archive: null, dir }
  }
  const parts = entry.split(/[/\\]/)
  return { archive, dir: parts.slice(0, Math.max(0, parts.length - 3)).join('/') }
}

/** Read one file from the host package tree (filesystem or inside the desktop archive). */
function readHostTreeFile(located, name) {
  const scope = hostScope(located)
  try {
    if (scope.archive === null) {
      const p = join(scope.dir, ...name.split('/'))
      return exists(p) ? readFileSync(p, 'utf8') : null
    }
    return readAsarEntry(scope.archive, `${scope.dir}/${name}`)
  } catch {
    return null
  }
}

/** The target host's version: explicit override, else the host CLI manifest. */
function hostVersion(located) {
  const override = process.env.DSH_HOST_VERSION?.trim()
  if (override) return override
  const text = readHostTreeFile(located, 'dsh/package.json')
  if (text === null) return null
  try {
    const parsed = JSON.parse(text)
    return typeof parsed.version === 'string' ? parsed.version : null
  } catch {
    return null
  }
}

/** Semver precedence for the numeric-core prerelease versions hosts use here. */
function compareVersions(a, b) {
  const parse = (value) => {
    const [core, pre = ''] = String(value).trim().replace(/^v/, '').split('-')
    return { core: core.split('.').map((n) => Number.parseInt(n, 10) || 0), pre: pre === '' ? [] : pre.split('.') }
  }
  const x = parse(a)
  const y = parse(b)
  for (let i = 0; i < 3; i++) {
    if (x.core[i] !== y.core[i]) return x.core[i] < y.core[i] ? -1 : 1
  }
  if (x.pre.length === 0 || y.pre.length === 0) {
    return x.pre.length === y.pre.length ? 0 : x.pre.length === 0 ? 1 : -1
  }
  for (let i = 0; i < Math.min(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i]
    const q = y.pre[i]
    const pn = /^\d+$/.test(p)
    const qn = /^\d+$/.test(q)
    if (pn && qn) {
      if (Number(p) !== Number(q)) return Number(p) < Number(q) ? -1 : 1
    } else if (pn !== qn) {
      return pn ? -1 : 1
    } else if (p !== q) {
      return p < q ? -1 : 1
    }
  }
  return x.pre.length === y.pre.length ? 0 : x.pre.length < y.pre.length ? -1 : 1
}

/** Agent Teams package specifiers for the target host generation. */
function teamPackageNames(located) {
  const version = hostVersion(located)
  if (version === null) {
    // A bare standard file (DSH_HOST_STANDARD_YML, fixtures) carries no tree to
    // read the version from; DSH_HOST_VERSION is then the only signal. Keep the
    // pre-rename names, which the whole 0.2.0–0.2.2-rc.1 range resolves.
    if (!locatedFromEnv) console.error('note: cannot read the host version; using the pre-0.2.2-rc.2 Agent Teams package names (set DSH_HOST_VERSION to override)')
    return { tool: TEAM_PACKAGES.tool.legacy, service: TEAM_PACKAGES.service.legacy, version: null }
  }
  const renamed = compareVersions(version, TEAM_RENAME_HOST) >= 0
  return {
    tool: renamed ? TEAM_PACKAGES.tool.current : TEAM_PACKAGES.tool.legacy,
    service: renamed ? TEAM_PACKAGES.service.current : TEAM_PACKAGES.service.legacy,
    version,
  }
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
/** Render the persona row with an EMPTY prefix — v2 delivers the persona via
 *  the plugin's own systemPrompt section (helm-d:persona) sourced from the
 *  sealed profiles.dat. The row stays so the host row-id set is preserved and
 *  the deployment persona stays neutralized. */
function renderPersonaRow(base) {
  const id = ' '.repeat(base)
  const key = ' '.repeat(base + 2)
  const conf = ' '.repeat(base + 4)
  return [
    `${id}- id: persona`,
    `${key}name: '@deepseek-ai/dsh-persona'`,
    `${key}config:`,
    `${conf}prefix: ""`,
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

function generate(hostText, personaText, team) {
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
    // Host-native Agent Teams tools, scoped to helmd sessions only (the service
    // row below is the host-plane half; this row is the per-preset half,
    // mirroring how standard.patch.yml scopes tool-subagent inside the preset).
    // The specifier follows the target host generation (rc.2 dropped the
    // `experimental-` prefix); see teamPackageNames().
    `${basePrefix}- id: tool-agent-team`,
    `${' '.repeat(base + 2)}name: '${team.tool}'`,
    `${' '.repeat(base + 2)}disabled: !!js "[...(ctx.get('loader')?.entries?.() ?? [])].some((e) => e.options?.name === '${team.tool}' && !e.disabled)"`,
    `${basePrefix}- id: helmd`,
    `${' '.repeat(base + 2)}name: '@adwmc/helm-d/agent'`,
  ]
  // Host-plane team service (roster/mailbox/task DAG). static inject is all
  // host-level services, so it composes at the top level like `subagent` does
  // in dsh-base — a sibling entry INSIDE the same `- insert:` list (col 4,
  // matching preset-helmd), outside any plugins block, hence invisible to
  // pluginRowIds and to the helmd-only tool scoping.
  const teamServiceRow = [
    '    - id: helmd-agent-team',
    `      name: '${team.service}'`,
    `      disabled: !!js "[...(ctx.get('loader')?.entries?.() ?? [])].some((e) => e.options?.name === '${team.service}' && e.options?.id !== 'helmd-agent-team' && !e.disabled)"`,
    '      config:',
    '        maxMembers: 8',
  ]
  const insertIdx = lines.findIndex((l) => l === '- insert:')
  if (insertIdx < 0 || insertIdx > pi) {
    throw new Error('host standard is not an insert-patch (no top-level `- insert:`) - expected dsh >= 0.1.7 dsh-web-app/presets/standard.patch.yml')
  }
  const outLines = [
    ...rewriteEntryHeader(lines.slice(insertIdx, pi), presetMeta()),
    ...lines.slice(pi, personaStart),
    ...renderPersonaRow(base),
    ...lines.slice(personaEnd, end),
    ...helmdRow,
    ...lines.slice(end),
    ...teamServiceRow,
  ]
  const out = outLines.join('\n')
  assertShape(hostText, out, personaText, base, team)
  return out.replace(/\n*$/, '') + '\n'
}

// ── assertions: fail loud, never emit a silently-wrong preset ──────────────
function assertShape(hostText, out, personaText, base, team) {
  const hostIds = pluginRowIds(hostText)
  const outIds = pluginRowIds(out)
  const expect = [...hostIds, 'helmd', 'tool-agent-team'].sort()
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
  // The two host-native team rows must name the packages of the TARGET host
  // generation (0.2.2-rc.2 renamed them); a leftover experimental name is a
  // specifier the newer host cannot resolve.
  const toolRow = out.match(new RegExp(`${' '.repeat(base)}- id: tool-agent-team\\n *name: '([^']+)'`))
  if (toolRow === null) throw new Error('team tool row missing from output')
  if (toolRow[1] !== team.tool) throw new Error(`team tool row must name ${team.tool}, got ${toolRow[1]}`)
  if (!out.includes(`name: '${team.service}'`)) throw new Error(`team service row must name ${team.service}`)

  const basePrefix = ' '.repeat(base)
  const pStart = out.indexOf(`${basePrefix}- id: persona`)
  if (pStart < 0) throw new Error('persona row missing from output')
  const pNext = out.indexOf(`${basePrefix}- id: `, pStart + 1)
  const pBlock = pNext < 0 ? out.slice(pStart) : out.slice(pStart, pNext)
  if (!out.includes('id: helmd')) throw new Error('entry config `id: helmd` missing')
  for (const probe of ['complete: false', 'includeRuntimeContext: false']) {
    if (!pBlock.includes(probe)) throw new Error(`persona row lost ${probe}`)
  }
  // v2: the persona text ships ONLY inside the sealed profiles.dat — the patch
  // must carry an EMPTY prefix. Any persona plaintext here is a distribution leak.
  const LEAK_MARKERS = ['You are ' + 'luna', '## HARD ' + 'BOUNDS', '## SLANG ' + 'ROUTING']
  if (LEAK_MARKERS.some((marker) => pBlock.includes(marker))) {
    throw new Error('persona plaintext leaked into the preset patch — v2 delivers the persona via the sealed profiles.dat, not the patch')
  }
  if (!personaText.trim()) throw new Error('persona.txt is empty')
  if (!personaText.includes('helmd ' + 'online')) throw new Error('persona source lost the activation line (profiles/ds4.1f.md sanity)')
}

// ── main ────────────────────────────────────────────────────────────────────
const hostYml = locateHostStandard()
const hostText = readHostStandardText(hostYml)
const hostHash = createHash('sha256').update(hostText, 'utf8').digest('hex')
const personaText = personaPath === null
  ? 'helmd ' + 'online' + '\n'
  : readFileSync(personaPath, 'utf8')
const team = teamPackageNames(hostYml)
console.log(`host team packages: ${team.tool} + ${team.service}${team.version === null ? ' (version unknown)' : ` (host ${team.version})`}`)
const body = generate(hostText, personaText, team)
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