// Subject: the preset generator and the runtime drift-repair must work against
// EVERY host generation in the supported interval — not just the trimmed 0.1.7
// fixture preset-heal uses. The real standards are committed under
// fixtures/host-standard-<sha>.patch.yml (deduplicated by content; see
// fixtures/dsh-host-manifest.json). Two contracts are exercised per standard:
//   1. generation: gen-preset.mjs produces an artifact that passes the runtime
//      structural assertion (assertPresetArtifact) and keeps the team rows that
//      stand down when the host already runs the official Agent Teams bundle;
//   2. cross-host repair: an artifact generated for a different host generation
//      reads HOST_UPGRADED and is regenerated to the target fingerprint.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import semver from 'semver'
import { distDir, distReady } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

// Needs only the built artifacts: the host standard comes from the committed
// fixtures and the generator runs as a subprocess, so an installed npm-global
// dsh is irrelevant here (and its absence must not hide this regression).
if (!distReady()) skip('preset-cross-host', 'need packages/helmd/dist (run pnpm build)')

const report = createReporter('preset-cross-host')
const here = dirname(fileURLToPath(import.meta.url))
const fixtures = join(here, 'fixtures')
const manifest = JSON.parse(readFileSync(join(fixtures, 'dsh-host-manifest.json'), 'utf8'))

// One entry per unique standard, oldest host generation first.
const bySha = new Map()
for (const host of manifest.hosts) {
  if (!bySha.has(host.standard.sha256)) {
    bySha.set(host.standard.sha256, { sha256: host.standard.sha256, fixture: host.standard.fixture, hosts: [host.version] })
  } else {
    bySha.get(host.standard.sha256).hosts.push(host.version)
  }
}
const standards = [...bySha.values()]
assert.ok(standards.length > 1, 'the interval must span more than one host generation')

const home = mkdtempSync(join(tmpdir(), 'helmd-cross-host-'))
const saved = { ...process.env }
const { assertPresetArtifact, evaluateHealth } = await import(pathToFileURL(join(distDir, 'health.js')).href)

const read = (std) => readFileSync(join(fixtures, std.fixture), 'utf8')
const generate = (std) => {
  const out = join(home, std.sha256.slice(0, 12))
  process.env.DSH_HOST_STANDARD_YML = join(fixtures, std.fixture)
  // A bare standard fixture carries no host tree to read the version from; pin
  // it so the Agent Teams row names are chosen as the real host would.
  process.env.DSH_HOST_VERSION = std.hosts[0]
  execFileSync(process.execPath, [join(here, '..', 'gen-preset.mjs'), '--out', out], {
    encoding: 'utf8',
    env: process.env,
  })
  return readFileSync(join(out, 'preset.generated.patch.yml'), 'utf8')
}

try {
  const generated = new Map()
  for (const std of standards) {
    const text = generate(std)
    generated.set(std.sha256, text)

    await report.check(`generation against ${std.hosts[0]}… standard passes the runtime artifact assertion`, () => {
      const verdict = assertPresetArtifact(text, read(std))
      assert.equal(verdict.ok, true, `${std.fixture}: ${verdict.detail}`)
    })

    await report.check(`the team rows stand down when the host already runs Agent Teams (${std.hosts[0]}…)`, () => {
      // dsh 0.2.2-rc.2 renamed the host-native team packages; a standard must not
      // straddle that rename, and the row must name the target host's packages.
      const renamedHosts = std.hosts.filter((version) => semver.gte(version, '0.2.2-rc.2'))
      assert.ok(renamedHosts.length === 0 || renamedHosts.length === std.hosts.length,
        `standard ${std.sha256.slice(0, 12)} spans the Agent Teams rename: ${std.hosts.join(', ')}`)
      const toolPackage = renamedHosts.length > 0
        ? '@deepseek-ai/dsh-tool-agent-team'
        : '@deepseek-ai/dsh-experimental-tool-agent-team'
      assert.ok(text.includes(`name: '${toolPackage}'`), `host ${std.hosts[0]} must name ${toolPackage}`)
      assert.match(text, /^ {10}- id: tool-agent-team$/m, 'the preset-scoped team tool row must exist')
      assert.match(text, /disabled: !!js "\[\.\.\.\(ctx\.get\('loader'\)/, 'the team tool row must carry the host-standdown condition')
      assert.match(text, /^    - id: helmd-agent-team$/m, 'the top-level team service row must exist under its own id')
      assert.match(text, /^ {6}disabled: !!js "\[\.\.\.\(ctx\.get\('loader'\)/m, 'the team service row must carry the host-standdown condition')
      assert.equal((text.match(/@adwmc\/helm-d/g) ?? []).length, 1, 'helmd must be declared exactly once')
    })
  }

  // Cross-host repair, cycled: each generation is the foreign artifact for the
  // next one, so every standard is covered as a repair target exactly once.
  const patchPath = join(home, 'deployed.preset.generated.patch.yml')
  process.env.HELMD_PRESET_PATCH = patchPath
  delete process.env.HELMD_AUTO_HEAL
  for (let i = 0; i < standards.length; i++) {
    const target = standards[i]
    const foreign = standards[(i + 1) % standards.length]
    const hostText = read(target)
    const hostHash = createHash('sha256').update(hostText, 'utf8').digest('hex')

    await report.check(`an artifact from ${foreign.hosts[0]}… heals to ${target.hosts[0]}…`, () => {
      writeFileSync(patchPath, generated.get(foreign.sha256), 'utf8')
      process.env.DSH_HOST_STANDARD_YML = join(fixtures, target.fixture)
      // A real repair reads the target host's version from its tree; a bare
      // fixture has none, so pin it the way the install path would see it.
      process.env.DSH_HOST_VERSION = target.hosts[0]
      // evaluateHealth repairs by default (the artifact carries our fingerprint,
      // so provenance is provable) and returns the POST-heal verdict.
      const base = evaluateHealth()
      assert.match(base.autoHeal, /^healed \(HOST_UPGRADED → OK\)/, `unexpected verdict: ${base.autoHeal} (status ${base.status})`)
      const healed = readFileSync(patchPath, 'utf8')
      assert.match(healed, new RegExp(`^# gen-preset: host=${hostHash}`), 'the repair must re-anchor the target fingerprint')
      const verdict = assertPresetArtifact(healed, hostText)
      assert.equal(verdict.ok, true, `healed artifact: ${verdict.detail}`)
      const expectedTool = semver.gte(target.hosts[0], '0.2.2-rc.2')
        ? '@deepseek-ai/dsh-tool-agent-team'
        : '@deepseek-ai/dsh-experimental-tool-agent-team'
      assert.ok(healed.includes(`name: '${expectedTool}'`), `the repair must name ${expectedTool}`)
    })
  }

  await report.check('HELMD_AUTO_HEAL=0 leaves a foreign-host artifact alone', () => {
    const target = standards[0]
    const foreign = standards[standards.length - 1]
    writeFileSync(patchPath, generated.get(foreign.sha256), 'utf8')
    process.env.DSH_HOST_STANDARD_YML = join(fixtures, target.fixture)
    process.env.HELMD_AUTO_HEAL = '0'
    try {
      const base = evaluateHealth()
      assert.equal(base.status, 'HOST_UPGRADED')
      assert.match(base.autoHeal, /^off \(HELMD_AUTO_HEAL=0\)/, `unexpected verdict: ${base.autoHeal}`)
      assert.equal(readFileSync(patchPath, 'utf8'), generated.get(foreign.sha256), 'report-only must not rewrite the file')
    } finally {
      delete process.env.HELMD_AUTO_HEAL
    }
  })
} finally {
  for (const key of ['DSH_HOST_STANDARD_YML', 'DSH_HOST_VERSION', 'HELMD_PRESET_PATCH', 'HELMD_AUTO_HEAL']) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
  rmSync(home, { recursive: true, force: true })
}

report.finish()
