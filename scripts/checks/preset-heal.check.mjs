// Subject: the preset drift-repair contract. Report-only by default — a running host must
// not rewrite the user's agent.cordis.yml; with HELMD_AUTO_HEAL=1 it keeps a .bak first.
// Everything runs against a throwaway DSH_HOME, so the real deployment is never touched.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { distDir, hostStandardEntry, loadArtifacts } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const seam = await loadArtifacts()
if (seam === null) skip('preset-heal', 'need packages/helmd/dist and an installed @deepseek-ai/dsh')

/** The host's own standard preset doubles as the generator's input here. */
const hostStandard = hostStandardEntry()
if (hostStandard === null) skip('preset-heal', 'host standard preset not found for the generator')

const report = createReporter('preset-heal')
const home = mkdtempSync(join(tmpdir(), 'helmd-heal-'))
const presetDir = join(home, '.agent-presets', 'helmd')
const presetPath = join(presetDir, 'agent.cordis.yml')
const drifted = '# hand-written preset without a fingerprint header\n- id: persona\n'
mergeInto(process.env, { DSH_HOME: home, DSH_HOST_STANDARD_YML: hostStandard })

/** Read the health verdict the host plane would register, without touching the real one. */
function healthBase() {
  let base = null
  const ctx = {
    inject: (_deps, callback) => callback({ settings: { register: (_ns, _schema, opts) => { base = opts?.base } } }),
  }
  seam.health.apply(ctx)
  return base
}

mkdirSync(presetDir, { recursive: true })
writeFileSync(presetPath, drifted, 'utf8')
delete process.env.HELMD_AUTO_HEAL

await report.check('a header-less preset is only reported by default (provenance unknown)', () => {
  const base = healthBase()
  assert.equal(base.status, 'LEGACY_PRESET', 'a header-less preset should read as legacy')
  assert.match(base.autoHeal, /^LEGACY_PRESET not repaired/)
  assert.equal(readFileSync(presetPath, 'utf8'), drifted, 'report-only must not rewrite the file')
})

await report.check('HELMD_AUTO_HEAL=1 rewrites even a header-less preset and keeps .bak', () => {
  process.env.HELMD_AUTO_HEAL = '1'
  const base = healthBase()
  assert.match(base.autoHeal, /^healed \(LEGACY_PRESET → /, `unexpected verdict: ${base.autoHeal}`)
  assert.equal(readFileSync(`${presetPath}.bak`, 'utf8'), drifted, 'previous content should survive as .bak')
  assert.match(readFileSync(presetPath, 'utf8'), /^# gen-preset: host=[0-9a-f]{64}/)
})

// Content drift: same host fingerprint, but the file is not what this package ships (an
// older deployment, or a hand edit). The header alone cannot see this, and the header
// proves the file is our own artifact — so the default policy repairs it.
const hostHash = createHash('sha256').update(readFileSync(hostStandard, 'utf8'), 'utf8').digest('hex')
const shipped = readFileSync(join(distDir, '..', 'presets', 'agent.cordis.yml'), 'utf8')
delete process.env.HELMD_AUTO_HEAL

await report.check('same host fingerprint but different content reads as STALE and is repaired by default', () => {
  writeFileSync(presetPath, `# gen-preset: host=${hostHash}\n\n- id: persona\n  name: 'x'\n`, 'utf8')
  const base = healthBase()
  assert.match(base.autoHeal, /^healed \(STALE → /, `expected a repair, got ${base.autoHeal}`)
  assert.equal(readFileSync(`${presetPath}.bak`, 'utf8').includes("name: 'x'"), true, 'the drifted content should survive as .bak')
  assert.equal(readFileSync(presetPath, 'utf8').replace(/\r\n/g, '\n'), shipped.replace(/\r\n/g, '\n'))
})

await report.check('HELMD_AUTO_HEAL=0 leaves even a provably-ours preset alone', () => {
  writeFileSync(presetPath, `# gen-preset: host=${hostHash}\n\n- id: persona\n  name: 'x'\n`, 'utf8')
  process.env.HELMD_AUTO_HEAL = '0'
  const base = healthBase()
  assert.match(base.autoHeal, /^off \(HELMD_AUTO_HEAL=0\)/)
  assert.equal(readFileSync(presetPath, 'utf8').includes("name: 'x'"), true, 'auto-heal is off')
  delete process.env.HELMD_AUTO_HEAL
})

await report.check('a preset generated for an older host is repaired by default', () => {
  writeFileSync(presetPath, `# gen-preset: host=${'f'.repeat(64)}\n\n- id: persona\n  name: 'old host'\n`, 'utf8')
  const base = healthBase()
  assert.match(base.autoHeal, /^healed \(HOST_UPGRADED → OK\)/, `expected a repair, got ${base.autoHeal}`)
  assert.match(base.autoHeal, /artifact check OK \(\d+ rows \(host standard \+ helmd\)\)/, 'a repair must assert the artifact it wrote')
  assert.equal(readFileSync(presetPath, 'utf8').replace(/\r\n/g, '\n'), shipped.replace(/\r\n/g, '\n'))
})

// The structural assertion the repair runs afterwards, on its own inputs.
const { assertPresetArtifact } = await import(pathToFileURL(join(distDir, 'health.js')).href)
const hostText = readFileSync(hostStandard, 'utf8')

await report.check('the artifact assertion accepts host rows + helmd', () => {
  const good = assertPresetArtifact(shipped, hostText)
  assert.equal(good.ok, true, good.detail)
})

await report.check('it rejects a preset missing one of the host rows', () => {
  const hostRows = [...hostText.matchAll(/^- id: (.+)$/gm)].map((m) => m[1].trim())
  const withoutOne = hostText.replace(new RegExp(`^- id: ${hostRows[0]}\\n`, 'm'), '')
  const bad = assertPresetArtifact(`${withoutOne}\n\n- id: helmd\n  name: '@dsh-security/helmd'\n`, hostText)
  assert.equal(bad.ok, false, 'a dropped platform row must fail the assertion')
  assert.match(bad.detail, /row ids differ/)
})

await report.check('it rejects a preset without the activation line', () => {
  const notOurs = shipped.replace(/helmd online[^\n]*/g, 'somebody else')
  const bad = assertPresetArtifact(notOurs, hostText)
  assert.equal(bad.ok, false, 'a foreign persona must fail the assertion')
  assert.match(bad.detail, /activation line missing/)
})

await report.check('the shipped preset itself reads as OK, CRLF included, with the structural check stated', () => {
  writeFileSync(presetPath, shipped.replace(/\n/g, '\r\n'), 'utf8')
  const base = healthBase()
  assert.equal(base.status, 'OK', `expected OK, got ${base.status}: ${base.detail}`)
  assert.match(base.detail, /artifact check OK \(\d+ rows \(host standard \+ helmd\)\)/, 'the assertion should be stated on every boot')
})

mergeInto(process.env, { DSH_HOME: undefined, DSH_HOST_STANDARD_YML: undefined, HELMD_AUTO_HEAL: undefined })
rmSync(home, { recursive: true, force: true })
report.finish()

/** Set/remove env entries together so the check cannot leak state into the next one. */
function mergeInto(env, patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete env[key]
    else env[key] = value
  }
}
