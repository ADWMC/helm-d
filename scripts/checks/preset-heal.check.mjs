// Subject: the preset drift-repair contract (0.1.7: the preset is a package-internal
// patch loaded through dsh.bundle.patch, no `.agent-presets` deployment). Report-only by
// default — a running host must not rewrite a file it cannot prove is ours; with
// HELMD_AUTO_HEAL=1 it keeps a .bak first. The generator runs against a fixture host
// standard in a throwaway directory, so neither the real host nor the shipped artifact
// is touched.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { distDir, hostStandardEntry, loadArtifacts } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const seam = await loadArtifacts()
if (seam === null) skip('preset-heal', 'need packages/helmd/dist and an installed @deepseek-ai/dsh')

const pkgDir = join(distDir, '..')
const here = dirname(fileURLToPath(import.meta.url))
/** A trimmed 0.1.7 host `standard.patch.yml` so the check does not depend on the installed host. */
const fixtureHost = join(here, 'fixtures', 'host-standard.patch.yml')
const fixtureText = readFileSync(fixtureHost, 'utf8')
if (!fixtureText.includes('plugins:')) skip('preset-heal', 'host standard fixture lost its plugins: list')
const hostHash = createHash('sha256').update(fixtureText, 'utf8').digest('hex')

const report = createReporter('preset-heal')
const home = mkdtempSync(join(tmpdir(), 'helmd-heal-'))
const patchPath = join(home, 'preset.generated.patch.yml')
const headerless = '# hand-written patch without a fingerprint header\n- id: persona\n'
const drifted = `# gen-preset: host=${hostHash}\n\n- id: persona\n  name: 'x'\n`

const saved = { ...process.env }
process.env.DSH_HOST_STANDARD_YML = fixtureHost
process.env.HELMD_PRESET_PATCH = patchPath
delete process.env.HELMD_AUTO_HEAL

/** The health verdict the host plane computes, without registering any HTTP route. */
const evaluate = () => seam.health.evaluateHealth()

writeFileSync(patchPath, headerless, 'utf8')

await report.check('a header-less patch is only reported by default (provenance unknown)', () => {
  const base = evaluate()
  assert.equal(base.status, 'LEGACY_PRESET', `unexpected status: ${base.status} — ${base.detail}`)
  assert.match(base.autoHeal, /^LEGACY_PRESET not repaired/)
  assert.equal(readFileSync(patchPath, 'utf8'), headerless, 'report-only must not rewrite the file')
})

await report.check('HELMD_AUTO_HEAL=1 regenerates a header-less patch and keeps .bak', () => {
  process.env.HELMD_AUTO_HEAL = '1'
  const base = evaluate()
  assert.match(base.autoHeal, /^healed \(LEGACY_PRESET → /, `unexpected verdict: ${base.autoHeal}`)
  assert.equal(readFileSync(`${patchPath}.bak`, 'utf8'), headerless, 'previous content should survive as .bak')
  assert.match(readFileSync(patchPath, 'utf8'), /^# gen-preset: host=[0-9a-f]{64}/)
  delete process.env.HELMD_AUTO_HEAL
})

// Content drift: the fingerprint matches the installed host, so the header cannot see it.
// The structural assertion is what catches a hand-edit or an unsynced persona change.
await report.check('matching fingerprint but broken rows reads as STALE and is repaired by default', () => {
  writeFileSync(patchPath, drifted, 'utf8')
  const base = evaluate()
  assert.match(base.autoHeal, /^healed \(STALE → /, `expected a repair, got ${base.autoHeal}`)
  assert.equal(readFileSync(`${patchPath}.bak`, 'utf8'), drifted, 'the drifted content should survive as .bak')
  const healed = readFileSync(patchPath, 'utf8')
  assert.match(healed, new RegExp(`^# gen-preset: host=${hostHash}`), 'the repair re-anchors the fingerprint')
  assert.match(healed, /^    - id: preset-helmd$/m, 'the entry must be retargeted at helmd')
  assert.match(healed, /^          - id: helmd$/m, 'the helmd agent row must be appended')
})

await report.check('HELMD_AUTO_HEAL=0 leaves even a provably-ours patch alone', () => {
  writeFileSync(patchPath, drifted, 'utf8')
  process.env.HELMD_AUTO_HEAL = '0'
  const base = evaluate()
  assert.match(base.autoHeal, /^off \(HELMD_AUTO_HEAL=0\)/)
  assert.equal(readFileSync(patchPath, 'utf8'), drifted, 'auto-heal is off')
  delete process.env.HELMD_AUTO_HEAL
})

await report.check('a patch generated for an older host is repaired by default', () => {
  writeFileSync(patchPath, drifted.replace(hostHash, 'f'.repeat(64)), 'utf8')
  const base = evaluate()
  assert.match(base.autoHeal, /^healed \(HOST_UPGRADED → OK\)/, `expected a repair, got ${base.autoHeal}`)
  assert.match(base.autoHeal, /artifact check OK \(\d+ rows \(host standard \+ helmd\)\)/, 'a repair must assert the artifact it wrote')
})

// The structural assertion on its own inputs.
const { assertPresetArtifact } = await import(pathToFileURL(join(distDir, 'health.js')).href)
const healedText = readFileSync(patchPath, 'utf8')

await report.check('the artifact assertion accepts host rows + helmd', () => {
  const good = assertPresetArtifact(healedText, fixtureText)
  assert.equal(good.ok, true, good.detail)
})

await report.check('it rejects a patch missing one of the host rows', () => {
  const bad = assertPresetArtifact(healedText.replace(/^          - id: tool-fs\n/m, ''), fixtureText)
  assert.equal(bad.ok, false, 'a dropped platform row must fail the assertion')
  assert.match(bad.detail, /row ids differ/)
})

await report.check('it rejects a patch whose entry was not retargeted', () => {
  const bad = assertPresetArtifact(healedText.replace('- id: preset-helmd', '- id: preset-standard'), fixtureText)
  assert.equal(bad.ok, false, 'a standard entry must fail the assertion')
  assert.match(bad.detail, /not retargeted/)
})

await report.check('it rejects a patch without the activation line', () => {
  const bad = assertPresetArtifact(healedText.replace(/helmd online[^\n]*/g, 'somebody else'), fixtureText)
  assert.equal(bad.ok, false, 'a foreign persona must fail the assertion')
  assert.match(bad.detail, /activation line missing/)
})

// The artifact this package actually ships, judged against the host actually
// installed. Reported, not failed, while the installed host predates 0.1.7: the
// generator only speaks the new shape, so there is nothing to assert yet.
const realHost = (() => {
  // hostStandardEntry() honours DSH_HOST_STANDARD_YML, which this check points at
  // the fixture, so probe the installed host with the override lifted.
  const override = process.env.DSH_HOST_STANDARD_YML
  if (saved.DSH_HOST_STANDARD_YML === undefined) delete process.env.DSH_HOST_STANDARD_YML
  else process.env.DSH_HOST_STANDARD_YML = saved.DSH_HOST_STANDARD_YML
  try {
    return hostStandardEntry()
  } finally {
    process.env.DSH_HOST_STANDARD_YML = override
  }
})()
const realIs017 = realHost !== null && readFileSync(realHost, 'utf8').includes('plugins:')
if (!realIs017) {
  console.log(`  – not run: the shipped-patch case needs a 0.1.7 host standard (found ${String(realHost)}); upgrade dsh to >= 0.1.7-alpha.1`)
} else {
  await report.check('the shipped patch reads OK against the installed host', () => {
    process.env.DSH_HOST_STANDARD_YML = realHost
    process.env.HELMD_PRESET_PATCH = join(pkgDir, 'preset.generated.patch.yml')
    const base = evaluate()
    assert.equal(base.status, 'OK', `expected OK, got ${base.status}: ${base.detail}`)
    assert.match(base.detail, /artifact check OK \(\d+ rows \(host standard \+ helmd\)\)/)
  })
}

for (const k of ['DSH_HOST_STANDARD_YML', 'HELMD_PRESET_PATCH', 'HELMD_AUTO_HEAL']) {
  if (saved[k] === undefined) delete process.env[k]
  else process.env[k] = saved[k]
}
rmSync(home, { recursive: true, force: true })
report.finish()
