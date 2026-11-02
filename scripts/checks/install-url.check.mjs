// Subject: install/update URLs. `releases/latest/download/<asset>` is a rolling
// address; writing it into a profile dependency makes pnpm's lockfile sha512
// fail on the next release (ERR_PNPM_TARBALL_INTEGRITY, Issue #5). Keep every
// user-facing `dsh plugin add` on a versioned URL and keep the recovery doc
// linked.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { repoRoot } from './artifacts.mjs'
import { createReporter } from './reporter.mjs'

const files = [
  join(repoRoot, 'README.md'),
  join(repoRoot, 'README.en.md'),
  join(repoRoot, 'packages', 'helmd', 'client.js'),
]
const report = createReporter('install-url')

await report.check('no user-facing install command uses releases/latest/download', () => {
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n')
    const bad = lines.filter((line) => /dsh plugin/.test(line) && /releases\/latest\/download/.test(line))
    assert.deepEqual(bad, [], `${file}: use a versioned releases/download/vX.Y.Z URL instead`)
  }
})

await report.check('README install command stays on a versioned release URL', () => {
  for (const name of ['README.md', 'README.en.md']) {
    const text = readFileSync(join(repoRoot, name), 'utf8')
    assert.match(text, /releases\/download\/v\d+\.\d+\.\d+[^/\s]*\/helm-d\.tgz/, `${name}: missing versioned helm-d.tgz URL`)
  }
})

await report.check('the lockfile-integrity recovery doc exists and is linked', () => {
  assert.ok(existsSync(join(repoRoot, 'docs', 'install-troubleshooting.md')), 'missing docs/install-troubleshooting.md')
  for (const name of ['README.md', 'README.en.md']) {
    assert.match(readFileSync(join(repoRoot, name), 'utf8'), /docs\/install-troubleshooting\.md/, `${name}: recovery doc is not linked`)
  }
})

report.finish()
