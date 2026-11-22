import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { repoRoot } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const probe = spawnSync('python', ['--version'], { encoding: 'utf8' })
if (probe.status !== 0) skip('packer-signatures', 'working python not installed')
const report = createReporter('packer-signatures')
const dir = mkdtempSync(join(tmpdir(), 'helmd-packer-hints-'))
const script = join(repoRoot, 'packages', 'helmd', 'scripts', 'native', 'protection', 'detect_packer.py')
try {
  await report.check('fake UPX signature in non-PE/ELF data cannot confirm packer or algorithm', () => {
    const input = join(dir, 'fake.bin')
    writeFileSync(input, Buffer.from('UPX! harmless normal resource, not an executable'))
    const result = spawnSync('python', [script, input], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /candidate hints only/)
    assert.match(result.stdout, /No known signatures/)
    assert.doesNotMatch(result.stdout, /Detected packers:/)
  })
  await report.check('damaged PE header cannot inherit a UPX verdict from a marker', () => {
    const input = join(dir, 'bad.exe')
    writeFileSync(input, Buffer.concat([Buffer.from('MZ'), Buffer.alloc(60), Buffer.from('UPX!')]))
    const result = spawnSync('python', [script, input], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /candidate hints only/)
    assert.doesNotMatch(result.stdout, /Detected packers:/)
  })
} finally {
  rmSync(dir, { recursive: true, force: true })
}
report.finish()
