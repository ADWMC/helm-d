// Subject: the plugin's peer ranges must admit every published dsh host in the
// supported interval [0.2.0-rc.1, 0.2.2-rc.1] — under BOTH semver semantics,
// because the host's compatibility verdict (dsh-app-boot's
// evaluatePluginCompatibility) could not be read locally: node-semver's default
// refuses a prerelease unless a comparator shares its [major,minor,patch]
// tuple, so a range that merely looks broad can still reject 0.2.1-* or
// 0.2.2-* prereleases. The manifest (fixtures/dsh-host-manifest.json) is the
// source of truth for which versions exist and which cordis/schemastery
// versions a host tree can carry (pin floor = historical install, resolved =
// today's max-satisfying build).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import semver from 'semver'
import { repoRoot } from './artifacts.mjs'
import { createReporter } from './reporter.mjs'

const report = createReporter('peer-range')
const manifest = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', 'dsh-host-manifest.json'), 'utf8'))
const pkg = JSON.parse(readFileSync(join(repoRoot, 'packages', 'helmd', 'package.json'), 'utf8'))

const SEMANTICS = [
  ['plain node-semver', false],
  ['includePrerelease', true],
]

await report.check('every in-interval host version is admitted by the dsh-settings / dsh-tools peers under both semantics', () => {
  const problems = []
  for (const host of manifest.hosts) {
    for (const name of ['@deepseek-ai/dsh-settings', '@deepseek-ai/dsh-tools']) {
      const range = pkg.peerDependencies[name]
      const version = host.siblings[name]
      for (const [label, loose] of SEMANTICS) {
        if (!semver.satisfies(version, range, { includePrerelease: loose })) {
          problems.push(`${name}@${version} (host ${host.version}) rejected under ${label}: ${range}`)
        }
      }
    }
  }
  assert.equal(problems.join('\n'), '', `${problems.length} admission gap(s)`)
})

await report.check('cordis / schemastery peers admit every version a host tree can carry, under both semantics', () => {
  const problems = []
  for (const host of manifest.hosts) {
    for (const [field, name] of [['cordis', '@deepseek-ai/cordis'], ['schemastery', '@deepseek-ai/schemastery']]) {
      const range = pkg.peerDependencies[name]
      for (const version of [host[field].floor, host[field].resolved]) {
        for (const [label, loose] of SEMANTICS) {
          if (!semver.satisfies(version, range, { includePrerelease: loose })) {
            problems.push(`${name}@${version} (pin ${host[field].pin}, host ${host.version}) rejected under ${label}: ${range}`)
          }
        }
      }
    }
  }
  assert.equal(problems.join('\n'), '', `${problems.length} admission gap(s)`)
})

await report.check('versions beyond the interval stay excluded under both semantics', () => {
  const range = pkg.peerDependencies['@deepseek-ai/dsh-settings']
  for (const version of ['0.2.3-rc.1', '0.2.3-0', '0.2.3', '0.3.0']) {
    for (const [label, loose] of SEMANTICS) {
      assert.equal(semver.satisfies(version, range, { includePrerelease: loose }), false,
        `${version} must not be admitted under ${label}: ${range}`)
    }
  }
})

await report.check('devDependencies mirror the peer ranges', () => {
  for (const name of ['@deepseek-ai/cordis', '@deepseek-ai/dsh-settings', '@deepseek-ai/dsh-tools', '@deepseek-ai/schemastery']) {
    assert.equal(pkg.devDependencies[name], pkg.peerDependencies[name],
      `${name} dev range drifted from peer range`)
  }
})

report.finish()
