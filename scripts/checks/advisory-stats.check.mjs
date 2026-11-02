// Subject: the adoption-rate card. A mandatory advisory is never demoted, so the card
// must not tell the user it was: the tally has to read each key's own tier.
import assert from 'node:assert/strict'
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadArtifacts } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const seam = await loadArtifacts()
if (seam === null) skip('advisory-stats', 'need packages/helmd/dist and an installed @deepseek-ai/dsh')
const report = createReporter('advisory-stats')

const home = mkdtempSync(join(tmpdir(), 'helmd-advisory-'))
const ledger = join(home, 'advisories.jsonl')
process.env.HELMD_TOOLS_DIR = home
const row = (key, tier, verdict) => JSON.stringify({ key, tier, verdict, turnsWaited: 1, ts: '2026-09-11T00:00:00.000Z' })
writeFileSync(ledger, [
  ...[1, 2, 3].map(() => row('stance:no-hedge', 'mandatory', 'ignored')),
  ...[1, 2, 3].map(() => row('route:web', 'recommended', 'ignored')),
].join('\n') + '\n', 'utf8')

const card = seam.advisory.renderAdvisoryStats()

await report.check('a mandatory key is never reported as demoted', () => {
  assert.equal(seam.advisory.isDemoted('stance:no-hedge', 'mandatory'), false)
  const line = card.split('\n').find((l) => l.includes('stance:no-hedge')) ?? ''
  assert.ok(line.length > 0, 'card should list the mandatory key')
  assert.ok(!line.includes('已降频'), `mandatory key must not be labelled demoted: ${line}`)
})

await report.check('a repeatedly ignored non-mandatory key IS reported as demoted', () => {
  assert.equal(seam.advisory.isDemoted('route:web', 'recommended'), true)
  const line = card.split('\n').find((l) => l.includes('route:web')) ?? ''
  assert.ok(line.includes('已降频'), `expected the demotion label: ${line}`)
})

await report.check('the cached tally sees an appended row', () => {
  appendFileSync(ledger, `${row('route:web', 'recommended', 'adopted')}\n`, 'utf8')
  assert.deepEqual(seam.advisory.advisoryStats().get('route:web'), { adopted: 1, ignored: 3 })
})

rmSync(home, { recursive: true, force: true })
report.finish()
