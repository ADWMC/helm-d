#!/usr/bin/env node
/**
 * gen-preset.mjs — generate presets/full-reverse/agent.cordis.yml from the
 * HOST's own installed `standard` agent preset.
 *
 * Why: the platform rows (shell/fs/jobs/skills/goals/plan/compaction/
 * delegation/…) are host-plane composition that MUST track the installed dsh
 * version. Hand-copying them (the old flow) drifts on every host upgrade and
 * produced incident 2026-08-26 (44-tool crippled catalog, zero platform
 * tools). This script derives the preset by construction:
 *
 *   output = host standard原文 - persona row + luna persona + helmd row
 *
 * so "non-helmd part ≡ installed host standard" holds at build time instead
 * of by discipline. Assertions fail loud (exit 1) on any mismatch.
 *
 * Usage:
 *   node scripts/gen-preset.mjs            # write generated files
 *   node scripts/gen-preset.mjs --check    # verify on-disk == freshly generated
 *
 * Persona single source: packages/helmd/presets/persona.txt
 * Overridable host discovery env: DSH_HOST_STANDARD_YML
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const personaPath = join(repoRoot, 'packages', 'helmd', 'presets', 'persona.txt')
const outPaths = [
  join(repoRoot, 'presets', 'full-reverse', 'agent.cordis.yml'),
]

const CHECK = process.argv.includes('--check')

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
const HELMD_ROW = [
  '# ── helmd unified security bundle ──────────────────────────────────────',
  "- id: helmd",
  "  name: '@dsh-security/helmd'",
].join('\n')

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
  const rowMarker = /^- id: /m

  // Replace exactly the persona ROW block: from its line start up to (not
  // including) the next top-level row marker. Any comment headers above the
  // identity section sit before the match and survive untouched.
  const startMatch = hostText.match(/^- id: persona\n/m)
  if (!startMatch) throw new Error('host standard has no `- id: persona` row')

  const startIndex = startMatch.index
  const rest = hostText.slice(startIndex)
  const nextRow = rest.slice(1).match(/^- id: /m) // search after consuming column-0 minus offset safety
  // Compute absolute index of the next row precisely.
  let endAbs
  if (nextRow) {
    const re = /^- id: /gm
    re.lastIndex = startIndex + 1
    const m = re.exec(hostText)
    endAbs = m ? m.index : hostText.length
  } else {
    endAbs = hostText.length
  }

  const out =
    hostText.slice(0, startIndex)
    + renderPersonaRow(personaText) + '\n\n'
    + hostText.slice(endAbs).replace(/^\n+/, '')   // normalize gap to ours
    // append helmd bundle row (idempotent guard: never duplicate)
    + (hostText.includes("@dsh-security/helmd'") ? '' : '\n' + HELMD_ROW + '\n')

  assertShape(hostText, out, personaText)
  return out
}

// ── assertions: fail loud, never emit a silently-wrong preset ──────────────
function assertShape(hostText, out, personaText) {
  const ids = (t) => [...t.matchAll(/^- id: (.+)$/gm)].map((m) => m[1])
  const hostIds = ids(hostText)
  const outIds = ids(out)
  const expect = [...hostIds.filter((i) => i !== 'persona'), 'persona', 'helmd'].sort()
  const got = [...outIds].sort()
  if (JSON.stringify(expect) !== JSON.stringify(got)) {
    throw new Error(`row id set mismatch\n  expected: ${expect.join(', ')}\n  got:      ${got.join(', ')}`)
  }
  for (const id of outIds) {
    const n = outIds.filter((x) => x === id).length
    if (n !== 1 && id !== '_') throw new Error(`duplicated row id: ${id} (x${n})`)
  }
  const nHelmd = (out.match(/^ {2}name: '@dsh-security\/helmd'$/gm) || []).length
  if (nHelmd !== 1) throw new Error(`expected exactly one @dsh-security/helmd row, got ${nHelmd}`)

  const pBlock = out.slice(out.indexOf('- id: persona'), out.indexOf('- id: ', out.indexOf('- id: persona') + 1))
  for (const probe of ['complete: true', 'includeRuntimeContext: false']) {
    if (!pBlock.includes(probe)) throw new Error(`persona row lost ${probe}`)
  }
  if (pBlock.includes('{{model}}') || pBlock.includes('{{cwd}}')) {
    throw new Error('luna persona leaked host template placeholders — persona.txt is wrong?')
  }
  if (!out.includes('helmd online')) throw new Error('activation line missing from persona')
  if (!personaText.trim()) throw new Error('persona.txt is empty')

  // every non-persona byte outside the two touched regions must be identical
  const stripTouched = (t) =>
    t
      .replace(/^- id: persona\n[\s\S]*?(?=^- id: )/m, '@@PERSONA@@\n')
      .replace(/\n# ── helmd unified security bundle[\s\S]*$/, '')
      .trimEnd()
  if (stripTouched(hostText.replace(/^- id: persona\n[\s\S]*?(?=^- id: )/m, '@@PERSONA@@\n').trimEnd())
      !== stripTouched(out).trim()) {
    throw new Error('untouched region drifted — transform must only swap persona row and append helmd row')
  }
}

// ── main ────────────────────────────────────────────────────────────────────
const hostYml = locateHostStandard()
const hostText = readFileSync(hostYml, 'utf8')
const personaText = readFileSync(personaPath, 'utf8')
const generated = generate(hostText, personaText)

if (CHECK) {
  let bad = false
  for (const p of outPaths) {
    const cur = readFileSync(p, 'utf8')
    if (cur !== generated) {
      console.error(`STALE: ${p} does not match generation from ${hostYml}`)
      bad = true
    }
  }
  console.log(bad ? 'preset check FAILED' : `preset check OK (${hostYml})`)
  process.exit(bad ? 1 : 0)
}

for (const p of outPaths) {
  writeFileSync(p, generated, 'utf8')
  console.log(`generated: ${p}`)
}
console.log(`source of truth: ${hostYml}`)
