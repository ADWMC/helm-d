// Subject: the preset drift-repair contract. Report-only by default — a running host must
// not rewrite the user's agent.cordis.yml; with HELMD_AUTO_HEAL=1 it keeps a .bak first.
// Everything runs against a throwaway DSH_HOME, so the real deployment is never touched.
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { hostStandardEntry, loadArtifacts } from './artifacts.mjs'
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

await report.check('default is report-only and the deployed preset is left alone', () => {
  const base = healthBase()
  assert.equal(base.status, 'LEGACY_PRESET', 'a header-less preset should read as legacy')
  assert.match(base.autoHeal, /^off \(report-only/)
  assert.equal(readFileSync(presetPath, 'utf8'), drifted, 'report-only must not rewrite the file')
})

await report.check('HELMD_AUTO_HEAL=1 rewrites it and keeps the previous file as .bak', () => {
  process.env.HELMD_AUTO_HEAL = '1'
  const base = healthBase()
  assert.match(base.autoHeal, /^healed \(LEGACY_PRESET → /, `unexpected verdict: ${base.autoHeal}`)
  assert.equal(readFileSync(`${presetPath}.bak`, 'utf8'), drifted, 'previous content should survive as .bak')
  assert.match(readFileSync(presetPath, 'utf8'), /^# gen-preset: host=[0-9a-f]{64}/)
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
