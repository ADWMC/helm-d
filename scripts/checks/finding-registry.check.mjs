// Subject: the finding register — severity/status/confidence, CVSS authority,
// evidence-strength rules and dedup. Design surveyed from ARTEX (severity +
// triage states), xalgorix (CVSS→severity, weak-evidence downgrade), Decepticon
// (critical/high need 2+ verification methods), VulnClaw (dedup by type+location).
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { distDir } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const entry = join(distDir, 'case.js')
if (!existsSync(entry)) skip('finding-registry', 'need packages/helmd/dist (run pnpm build)')
const home = mkdtempSync(join(tmpdir(), 'helmd-findings-'))
process.env.DSH_HOME = home
const caseApi = await import(pathToFileURL(entry).href)
const report = createReporter('finding-registry')

function freshCase(name) {
  const dir = join(home, 'helmd-cases', name)
  mkdirSync(join(dir, 'evidence'), { recursive: true })
  writeFileSync(join(dir, 'CASE.md'), 'status: open\ngoal: findings\nmode: full\nroute: reverse\n')
  return dir
}

await report.check('critical with a single evidence id is downgraded one band', async () => {
  const dir = freshCase('downgrade')
  const recorded = await caseApi.recordFinding(dir, {
    title: 'single evidence critical', detail: 'd', evidenceIds: ['E-001'], severity: 'critical', repro: 'cmd',
  })
  assert.equal(recorded.finding.severity, 'high')
  assert.ok(recorded.notes.some((note) => note.includes('downgraded')))
})

await report.check('critical with two independent evidence ids is accepted', async () => {
  const dir = freshCase('critical')
  const recorded = await caseApi.recordFinding(dir, {
    title: 'two evidence critical', detail: 'd', evidenceIds: ['E-001', 'E-002'], severity: 'critical', repro: 'cmd',
  })
  assert.equal(recorded.finding.severity, 'critical')
  assert.equal(recorded.finding.status, 'verified')
})

await report.check('CVSS overrides the asserted severity and keeps it for audit', async () => {
  const dir = freshCase('cvss')
  const recorded = await caseApi.recordFinding(dir, {
    title: 'cvss says critical', detail: 'd', evidenceIds: ['E-001', 'E-002'], severity: 'low', cvss: 9.8, repro: 'cmd',
  })
  assert.equal(recorded.finding.severity, 'critical')
  assert.equal(recorded.finding.assertedSeverity, 'low')
})

await report.check('unverified confidence caps severity at medium', async () => {
  const dir = freshCase('confidence')
  const recorded = await caseApi.recordFinding(dir, {
    title: 'unverified claim', detail: 'd', evidenceIds: ['E-001', 'E-002'], severity: 'critical', confidence: 'unverified', repro: 'cmd',
  })
  assert.equal(recorded.finding.severity, 'medium')
})

await report.check('same vuln_class + target + title merges instead of duplicating', async () => {
  const dir = freshCase('dedup')
  const first = await caseApi.recordFinding(dir, {
    title: 'License check is base64', detail: 'd', evidenceIds: ['E-001'], severity: 'medium',
    vulnClass: 'license-bypass', target: 'license_check.py', repro: 'cmd',
  })
  const second = await caseApi.recordFinding(dir, {
    title: 'license check is BASE64!', detail: 'd2', evidenceIds: ['E-002', 'E-003'], severity: 'high',
    vulnClass: 'license-bypass', target: 'license_check.py', repro: 'cmd',
  })
  assert.equal(second.merged, true)
  assert.equal(second.finding.id, first.finding.id)
  assert.equal(second.finding.seenCount, 2)
  assert.equal(second.finding.severity, 'high', 'merge keeps the higher severity')
  assert.deepEqual(second.finding.evidenceIds.sort(), ['E-001', 'E-002', 'E-003'])
  const findings = await caseApi.loadFindings(dir)
  assert.equal(findings.length, 1, 'registry must not grow on duplicates')
})

await report.check('update_finding moves the triage state and rejects unknown enums', async () => {
  const dir = freshCase('lifecycle')
  const recorded = await caseApi.recordFinding(dir, {
    title: 'lifecycle', detail: 'd', evidenceIds: ['E-001'], severity: 'medium', repro: 'cmd',
  })
  const updated = await caseApi.updateFinding(dir, recorded.finding.id, { status: 'rejected', note: 'could not reproduce' })
  assert.equal(updated.status, 'rejected')
  await assert.rejects(() => caseApi.updateFinding(dir, recorded.finding.id, { status: 'bogus' }), /unknown finding status/)
  const counts = caseApi.findingStatusCounts(await caseApi.loadFindings(dir))
  assert.equal(counts.rejected, 1)
})

await report.check('legacy findings.md is still readable with safe defaults', async () => {
  const dir = freshCase('legacy')
  writeFileSync(join(dir, 'findings.md'), '# FINDINGS legacy\n\n## old finding\ndetail text\nevidence: E-001, E-002\nrepro: cmd\n')
  const findings = await caseApi.loadFindings(dir)
  assert.equal(findings.length, 1)
  assert.equal(findings[0].severity, 'info')
  assert.equal(findings[0].status, 'verified')
  assert.deepEqual(findings[0].evidenceIds, ['E-001', 'E-002'])
  const severity = caseApi.severityCounts(findings)
  assert.equal(severity.info, 1)
})

rmSync(home, { recursive: true, force: true })
report.finish()
