// Subject: T-13.2/T-13.3 deterministic exports — CVSS vector scoring, SARIF
// ordering/levels, report NOT RUN markers, and daily severity trend.
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { distDir } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const entry = join(distDir, 'case.js')
if (!existsSync(entry)) skip('finding-export', 'need packages/helmd/dist (run pnpm build)')
const caseApi = await import(pathToFileURL(entry).href)
const report = createReporter('finding-export')

const finding = (over) => ({
  id: 'F-001', title: 't', detail: 'd', severity: 'medium', status: 'verified', confidence: 'verified',
  vulnClass: 'sqli', evidence: 'E-001', evidenceIds: ['E-001'], repro: 'cmd',
  seenCount: 1, createdAt: '2026-11-04T00:00:00.000Z', updatedAt: '2026-11-04T00:00:00.000Z',
  ...over,
})

await report.check('CVSS 3.1 vectors match the standard bands', () => {
  assert.equal(caseApi.parseCvssVector('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H').score, 9.8)
  assert.equal(caseApi.parseCvssVector('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H').severity, 'critical')
  assert.equal(caseApi.parseCvssVector('CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H').score, 8.8)
  assert.equal(caseApi.parseCvssVector('CVSS:3.1/AV:L/AC:H/PR:H/UI:R/S:U/C:L/I:N/A:N').score, 1.8)
  assert.equal(caseApi.parseCvssVector('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H').score, 10)
  assert.equal(caseApi.parseCvssVector('not-a-vector'), undefined)
})

await report.check('SARIF is deterministic, ordered, and excludes rejected findings', () => {
  const rows = [
    finding({ id: 'F-002', severity: 'low', status: 'rejected', title: 'rejected' }),
    finding({ id: 'F-003', severity: 'high', vulnClass: 'xss', title: 'high' }),
  ]
  const one = caseApi.renderSarif('case', rows)
  const two = caseApi.renderSarif('case', rows)
  assert.equal(one, two)
  const sarif = JSON.parse(one)
  assert.equal(sarif.version, '2.1.0')
  assert.equal(sarif.runs[0].results.length, 1)
  assert.equal(sarif.runs[0].results[0].level, 'error')
  assert.deepEqual(sarif.runs[0].results[0].properties.evidenceIds, ['E-001'])
})

await report.check('report renders missing fields as NOT RUN and keeps rejected separate', () => {
  const rows = [
    finding({ id: 'F-001', repro: '', evidenceIds: [], cvss: undefined }),
    finding({ id: 'F-002', status: 'rejected', title: 'rejected' }),
  ]
  const text = caseApi.renderCaseReport('case', rows)
  assert.match(text, /- repro: NOT RUN/)
  assert.match(text, /- evidence: NOT RUN/)
  assert.match(text, /- cvss: NOT RUN/)
  assert.match(text, /## Rejected/)
  assert.equal(text, caseApi.renderCaseReport('case', rows))
})

await report.check('severity trend is grouped by creation day and severity', () => {
  const trend = caseApi.findingTrend([
    finding({ id: 'F-001' }),
    finding({ id: 'F-002', severity: 'critical' }),
    finding({ id: 'F-003', createdAt: '2026-11-05T00:00:00.000Z' }),
  ])
  assert.equal(trend[0].date, '2026-11-04')
  assert.equal(trend[0].total, 2)
  assert.equal(trend[0].critical, 1)
  assert.equal(trend[1].date, '2026-11-05')
})

report.finish()
