// Subject: the model-facing autonomy packet. case_status must answer "what do
// I know, what is open, and what should I do next" from disk state without the
// model rereading files. Pure functions only — no network, no case dirs.
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { distDir } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const entry = join(distDir, 'autonomy.js')
if (!existsSync(entry)) skip('autonomy', 'need packages/helmd/dist (run pnpm build)')
const { playbookFor, deriveNextAction, warningsFor, renderAutonomyPacket } = await import(pathToFileURL(entry).href)
const report = createReporter('autonomy')

const base = { mode: 'full', goal: 'APK unpack and license check', hypotheses: [], findings: [], evidence: [] }
const hyp = (over) => ({
  id: 'H-001',
  statement: 'License check lives in .cctor',
  expected: 'cctor contains RSA init',
  testCmd: 'ilspy on .cctor',
  status: 'open',
  evidenceIds: [],
  ...over,
})

await report.check('playbook selection follows the case goal', () => {
  assert.match(playbookFor('APK unpack'), /reverse\.yaml$/)
  assert.match(playbookFor('web sqli on TARGET'), /pentest\.yaml$/)
  assert.match(playbookFor('内网 横向 域控'), /pentest\.yaml$/)
})

await report.check('no hypothesis yet: triage or record one', () => {
  assert.match(deriveNextAction(base), /Triage/)
  const withEvidence = { ...base, evidence: [{ id: 'E-001', file: 'E-001-hash.txt' }] }
  assert.match(deriveNextAction(withEvidence), /record_hypothesis/)
})

await report.check('open hypothesis: run its test, then update it', () => {
  const next = deriveNextAction({ ...base, hypotheses: [hyp()] })
  assert.match(next, /Resolve H-001/)
  assert.match(next, /ilspy on \.cctor/)
  assert.match(next, /update_hypothesis/)
})

await report.check('resolved state without findings: record one', () => {
  const next = deriveNextAction({
    ...base,
    hypotheses: [hyp({ status: 'confirmed', evidenceIds: ['E-001'] })],
    evidence: [{ id: 'E-001', file: 'E-001.txt' }],
  })
  assert.match(next, /record_finding/)
})

await report.check('finding without repro: ask for repro_cmd', () => {
  const next = deriveNextAction({
    ...base,
    hypotheses: [hyp({ status: 'confirmed', evidenceIds: ['E-001'] })],
    findings: [{ title: 'F', evidence: 'E-001' }],
    evidence: [{ id: 'E-001', file: 'E-001.txt' }],
  })
  assert.match(next, /repro_cmd/)
})

await report.check('warnings name the gaps that block a clean close', () => {
  const warnings = warningsFor({
    ...base,
    hypotheses: [hyp(), hyp({ id: 'H-002', status: 'blocked' })],
    findings: [{ title: 'F', evidence: 'E-001' }],
    evidence: [{ id: 'E-001', file: 'E-001.txt' }],
  })
  const text = warnings.join('\n')
  assert.match(text, /Open hypothesis H-001/)
  assert.match(text, /Blocked hypothesis H-002/)
  assert.match(text, /lack repro_cmd/)
})

await report.check('the packet carries ledger state, playbook, warnings and next', () => {
  const text = renderAutonomyPacket({
    ...base,
    hypotheses: [hyp()],
    findings: [{ title: 'F', evidence: 'E-001', repro: 'ilspy ...' }],
    evidence: [{ id: 'E-001', file: 'E-001.txt' }],
  })
  assert.match(text, /\[autonomy\]/)
  assert.match(text, /playbook: references\/playbooks\/reverse\.yaml/)
  assert.match(text, /open hypothesis: H-001/)
  assert.match(text, /findings: 1/)
  assert.match(text, /repro: yes/)
  assert.match(text, /warnings:/)
  assert.match(text, /next: Resolve H-001/)
})

report.finish()
