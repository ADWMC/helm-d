// Subject: the About tab's version comparison. The network half runs only on
// an explicit click; this check covers the pure normalization/diff logic so a
// version-tag change cannot silently turn "same version" into "update".
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { distDir } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const entry = join(distDir, 'update-check.js')
if (!existsSync(entry)) skip('update-check', 'need packages/helmd/dist (run pnpm build)')
const { normalizeVersion, versionDiffers, parseReleaseNotes } = await import(pathToFileURL(entry).href)
const report = createReporter('update-check')

await report.check('normalizeVersion strips a leading v and whitespace', () => {
  assert.equal(normalizeVersion(' v0.5.1fix '), '0.5.1fix')
  assert.equal(normalizeVersion('V0.5.2'), '0.5.2')
  assert.equal(normalizeVersion(undefined), '')
})

await report.check('versionDiffers compares normalized versions', () => {
  assert.equal(versionDiffers('0.5.1fix', 'v0.5.1fix'), false)
  assert.equal(versionDiffers('0.5.1fix', '0.5.2'), true)
  assert.equal(versionDiffers('', '0.5.2'), false)
})

await report.check('parseReleaseNotes extracts release bullets and strips emphasis', () => {
  const notes = parseReleaseNotes('## Changes\n- **Hot switch** armor profiles\n* 33 tools\n\nplain line')
  assert.deepEqual(notes, ['Hot switch armor profiles', '33 tools'])
})

await report.check('parseReleaseNotes tolerates a non-string body', () => {
  assert.deepEqual(parseReleaseNotes(undefined), [])
  assert.deepEqual(parseReleaseNotes(''), [])
})

report.finish()
