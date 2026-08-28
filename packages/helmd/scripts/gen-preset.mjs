#!/usr/bin/env node
/**
 * gen-preset.mjs — generate presets/full-reverse/agent.cordis.yml from the
 * HOST's own installed `standard` agent preset.
 *
 * Why: standard platform tools (pwsh/bash/read/etc.) belong to the agent
 * preset and must be copied from the installed dsh standard preset. The
 * profile already mounts the helmd bundle, however; declaring that bundle in
 * the user preset registers helmd twice and can fail with "already
 * registered" when a standing mount is rebuilt. This script therefore emits:
 *
 *   output = host standard - host persona + luna persona
 *
 * The generated preset owns standard platform tool rows, but never owns the
 * helmd bundle row. --check detects a host upgrade through its fingerprint.
 *
 * Usage:
 *   node scripts/gen-preset.mjs            # write generated files (repo layout)
 *   node scripts/gen-preset.mjs --out <dir># write <dir>/agent.cordis.yml only (bundle layout)
 *   node scripts/gen-preset.mjs --check    # verify on-disk == freshly generated;
 *                                          #   distinguishes "host upgraded"
 *                                          #   (fingerprint moved) from "file
 *                                          #   drifted" (same host fingerprint)
 *
 * The first line of every generated file is
 *
 *   # gen-preset: host=<sha256 of the host standard text>
 *
 * so --check can tell WHICH side moved: a fingerprint mismatch means the
 * installed dsh upgraded (regenerate), a content mismatch with a matching
 * fingerprint means persona.txt or the file itself changed (re-sync).
 *
 * Persona single source: packages/helmd/presets/persona.txt (repo) or
 * <bundle>/presets/persona.txt (installed bundle; resolved relative to this
 * script so the same file works in both layouts).
 * Overridable host discovery env: DSH_HOST_STANDARD_YML
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')

const CHECK = process.argv.includes('--check')
// --out <dir>: writer for installed-bundle use (e.g. install/setup-preset).
// In that layout persona.txt sits beside this script at ../presets/persona.txt.
let outDir = null
for (let i = 0; i < process.argv.length - 1; i++) {
  if (process.argv[i] === '--out') outDir = process.argv[i + 1]
}
if (outDir !== null && outDir === '') throw new Error('--out requires a directory argument')

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

const outPaths = outDir !== null
  ? [join(resolve(outDir), 'agent.cordis.yml')]
  : [join(repoRoot, 'presets', 'full-reverse', 'agent.cordis.yml')]

// ── locate the host's shipped standard preset ──────────────────────────────
function locateHostStandard() {
  if (process.env.DSH_HOST_STANDARD_YML) {
    const p = resolve(process.env.DSH_HOST_STANDARD_YML)
    if (!exists(p)) throw new Error(`DSH_HOST_STANDARD_YML points to missing file: ${p}`)
    return p
  }
  // On win32 npm is an npm.cmd shim; spawning bare "npm" fails with ENOENT.
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  let globalRoot
  try {
    globalRoot = execFileSync(npmCmd, ['root', '-g'], {
      encoding: 'utf8',
      // Node >=20 blocks .cmd spawning without a shell (CVE-2024-27980).
      shell: process.platform === 'win32',
    }).trim()
  } catch (e) {
    globalRoot = null
    console.error(`note: "${npmCmd} root -g" failed (${String(e.message).split('\n')[0]}); probing default locations`)
  }
  // Probe order: npm-reported root, then the platform-default global roots.
  const std = ['@deepseek-ai', 'dsh', 'config', 'agent-presets', 'standard', 'agent.cordis.yml']
  const bases = []
  if (globalRoot) bases.push(globalRoot)
  if (process.env.APPDATA) bases.push(join(process.env.APPDATA, 'npm', 'node_modules'))
  bases.push('/usr/local/lib/node_modules', '/usr/lib/node_modules')
  for (const b of bases) {
    const c = join(b, ...std)
    if (exists(c)) return c
  }
  throw new Error(
    'host standard preset not found; probed:\n  ' + bases.join('\n  ')
    + '\nset DSH_HOST_STANDARD_YML to <dsh>/config/agent-presets/standard/agent.cordis.yml',
  )
}
function exists(p) {
  try { readFileSync(p); return true } catch { return false }
}

// ── transform ───────────────────────────────────────────────────────────────
/** Render the complete replacement persona row from persona.txt. */
function renderPersonaRow(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n')
  const body = lines.map((l) => (l === '' ? '' : '      ' + l)).join('\n')
  return [
    "- id: persona",
    "  name: '@deepseek-ai/dsh-persona'",
    '  config:',
    '    text: |',
    body,
    '    complete: true',
    '    includeRuntimeContext: false',
  ].join('\n')
}

function generate(hostText, personaText) {
  const startMatch = hostText.match(/^- id: persona\r?\n/m)
  if (!startMatch || startMatch.index === undefined) {
    throw new Error('host standard has no `- id: persona` row')
  }
  const startIndex = startMatch.index
  const nextRow = /^- id: /gm
  nextRow.lastIndex = startIndex + startMatch[0].length
  const nextMatch = nextRow.exec(hostText)
  const endIndex = nextMatch?.index ?? hostText.length
  const out =
    hostText.slice(0, startIndex)
    + renderPersonaRow(personaText) + '\n\n'
    + hostText.slice(endIndex).replace(/^\r?\n+/, '')
  assertShape(hostText, out, personaText)
  return out
}

// ── assertions: fail loud, never emit a silently-wrong preset ──────────────
function assertShape(hostText, out, personaText) {
  const ids = (t) => [...t.matchAll(/^- id: (.+)$/gm)].map((m) => m[1])
  const hostIds = ids(hostText)
  const outIds = ids(out)
  const expect = [...hostIds].sort()
  const got = [...outIds].sort()
  if (JSON.stringify(got) !== JSON.stringify(expect)) {
    throw new Error(`row id set mismatch\n  expected: ${expect.join(', ')}\n  got:      ${got.join(', ')}`)
  }
  for (const id of outIds) {
    const count = outIds.filter((candidate) => candidate === id).length
    if (count !== 1 && id !== '_') throw new Error(`duplicated row id: ${id} (x${count})`)
  }
  if (out.includes('@dsh-security/helmd')) {
    throw new Error('preset must not redeclare the profile-owned helmd bundle')
  }

  const pBlock = out.slice(out.indexOf('- id: persona'), out.indexOf('- id: ', out.indexOf('- id: persona') + 1))
  for (const probe of ['complete: true', 'includeRuntimeContext: false']) {
    if (!pBlock.includes(probe)) throw new Error(`persona row lost ${probe}`)
  }
  if (pBlock.includes('{{model}}') || pBlock.includes('{{cwd}}')) {
    throw new Error('luna persona leaked host template placeholders — persona.txt is wrong?')
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

// Read a generated file's recorded host fingerprint, or null when absent.
function fileFingerprint(p) {
  let cur
  try { cur = readFileSync(p, 'utf8') } catch { return null }
  const m = cur.match(/^# gen-preset: host=([0-9a-f]{64})\n/)
  return m ? m[1] : null
}

if (CHECK) {
  let bad = false
  for (const p of outPaths) {
    let cur
    try { cur = readFileSync(p, 'utf8') } catch { cur = null }
    if (cur === generated) continue
    const fp = fileFingerprint(p)
    if (fp !== null && fp !== hostHash) {
      console.error(`HOST UPGRADED: ${p} was generated against dsh standard ${fp.slice(0, 12)}…;`)
      console.error(`  the installed host standard now hashes ${hostHash.slice(0, 12)}… — platform rows are stale.`)
      console.error(`  regenerate: node ${process.argv[1]}  (or re-run repack / setup-preset)`)
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
  if (current === generated) {
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
