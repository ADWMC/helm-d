#!/usr/bin/env node
/**
 * gen-preset.mjs — generate presets/full-reverse/agent.cordis.yml from the
 * HOST's own installed `standard` agent preset.
 *
 * Why: the profile already mounts the standard platform rows and the helmd
 * bundle through its host composition. Re-declaring those rows in a user
 * preset collides with the host registry (and can fail with "already
 * registered"), especially when a standing mount is rebuilt. This script
 * therefore emits a deliberately small overlay by construction:
 *
 *   output = luna persona row
 *
 * The host standard is still read and fingerprinted so --check detects a
 * host upgrade, while the generated preset never owns host-plane tools.
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
  if (!/^- id: persona\r?\n/m.test(hostText)) {
    throw new Error('host standard has no `- id: persona` row')
  }
  const out = renderPersonaRow(personaText) + '\n'
  assertShape(hostText, out, personaText)
  return out
}

// ── assertions: fail loud, never emit a silently-wrong preset ──────────────
function assertShape(hostText, out, personaText) {
  const ids = (t) => [...t.matchAll(/^- id: (.+)$/gm)].map((m) => m[1])
  const outIds = ids(out)
  if (JSON.stringify(outIds) !== JSON.stringify(['persona'])) {
    throw new Error(`overlay must contain only persona row, got: ${outIds.join(', ')}`)
  }
  if (out.includes('@dsh-security/helmd') || /@deepseek-ai\/dsh-tool-/.test(out)) {
    throw new Error('overlay must not redeclare host or helmd bundle entries')
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
