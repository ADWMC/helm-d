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
const { playbookFor, deriveNextAction, warningsFor, renderAutonomyPacket, detectNoPath, pentestRouteAdmission } = await import(pathToFileURL(entry).href)
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
  assert.match(playbookFor('reverse engineer web HTTP client APK'), /reverse\.yaml$/)
  assert.match(playbookFor('study JWT implementation in binary'), /reverse\.yaml$/)
})

await report.check('no hypothesis yet: triage or record one', () => {
  assert.match(deriveNextAction(base), /Triage/)
  const withEvidence = { ...base, evidence: [{ id: 'E-001', file: 'E-001-hash.txt' }] }
  assert.match(deriveNextAction(withEvidence), /record one goal-linked hypothesis/)
})

await report.check('open hypothesis: run its test, then update it', () => {
  const next = deriveNextAction({ ...base, hypotheses: [hyp()] })
  assert.match(next, /Resolve H-001/)
  assert.match(next, /ilspy on \.cctor/)
  assert.match(next, /update_hypothesis/)
  assert.match(next, /target logic is hidden.*protection methodology/)
})

await report.check('reverse observation is not automatically a finding', () => {
  const next = deriveNextAction({
    ...base,
    hypotheses: [hyp({ status: 'confirmed', evidenceIds: ['E-001'] })],
    evidence: [{ id: 'E-001', file: 'E-001.txt' }],
  })
  assert.match(next, /not automatically a vulnerability/)
  assert.doesNotMatch(next, /record_finding/)
})

await report.check('blocked/refuted hypotheses do not demand an invented finding', () => {
  const next = deriveNextAction({ ...base, hypotheses: [hyp({ status: 'blocked' })] })
  assert.match(next, /inconclusive\/blocked/)
  assert.doesNotMatch(next, /record_finding/)
})

await report.check('finding without repro: ask for repro_cmd', () => {
  const next = deriveNextAction({
    ...base,
    hypotheses: [hyp({ status: 'confirmed', evidenceIds: ['E-001'] })],
    findings: [{ title: 'F', evidence: 'E-001' }],
    evidence: [{ id: 'E-001', file: 'E-001.txt' }],
  })
  assert.match(next, /reproducible command/)
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
  assert.match(text, /reverse focus: sample identity/)
  assert.match(text, /next: Resolve H-001/)
})

await report.check('NO_PATH fires only after three identical calls without evidence growth', () => {
  const calls = [
    { name: 'bash', args: '{"command":"strings a"}' },
    { name: 'bash', args: '{"command":"strings a"}' },
    { name: 'bash', args: '{"command":"strings a"}' },
  ]
  assert.match(detectNoPath(calls, false) ?? '', /repeated 3x/)
  assert.equal(detectNoPath(calls, true), undefined, 'new evidence proves the path is not dead')
  assert.equal(detectNoPath(calls.slice(1), false), undefined, 'two calls are not enough')
  const packet = renderAutonomyPacket({ ...base, noPath: 'switch path' })
  assert.match(packet, /^\[NO_PATH\] switch path/)
  assert.match(deriveNextAction({ ...base, noPath: 'identical tool calls' }), /Reverse path stalled/)
})

await report.check('pentest cannot invent targets or close on a lone finding', () => {
  const web = { ...base, goal: 'web pentest' }
  assert.match(deriveNextAction(web), /No explicit network scope/)
  assert.match(deriveNextAction({ ...web, scope: ['example.test'] }), /specialist scanner/)
  const mapped = { ...web, scope: ['example.test'], assets: [{ kind: 'url', value: 'https://example.test', evidenceId: 'E-001' }] }
  assert.match(deriveNextAction(mapped), /2-3 distinct testable routes/)
  assert.match(deriveNextAction({ ...mapped, hypotheses: [hyp({ status: 'blocked' })], findings: [{ title: 'candidate', evidence: 'E-002', status: 'candidate' }] }), /Recheck finding/)
  assert.doesNotMatch(deriveNextAction({ ...mapped, hypotheses: [hyp({ status: 'blocked' })], findings: [{ title: 'candidate', evidence: 'E-002', status: 'candidate' }] }), /close with end_case/)
  assert.match(deriveNextAction({ ...mapped, hypotheses: [hyp({ status: 'blocked' })] }), /inconclusive\/blocked/)
  assert.match(renderAutonomyPacket(mapped), /pentest routes: open 0\/3; scope example.test; observed assets 1/)
  assert.match(deriveNextAction({ ...mapped, noPath: 'identical probe', hypotheses: [hyp()] }), /stop that probe/)
  assert.match(deriveNextAction({ ...mapped, hypotheses: [hyp({ status: 'confirmed', evidenceIds: ['E-001'] })], findings: [{ title: 'other', evidence: 'E-001', status: 'verified' }] }), /Do not infer a finding from shared E ids/)
  assert.doesNotMatch(deriveNextAction({ ...mapped, hypotheses: [hyp({ status: 'refuted' })] }), /Untested in-scope asset/)
  assert.match(deriveNextAction({ ...base, goal: 'reverse engineer HTTP stack', scope: ['example.test'] }), /Triage/)
  assert.match(deriveNextAction({ ...base, goal: 'SQLi', scope: ['example.test'] }), /specialist scanner/)
})

await report.check('pentest route portfolio is bounded and deduped without restricting reverse', () => {
  assert.equal(pentestRouteAdmission([hyp()], 'Other independent mechanism'), undefined)
  assert.match(pentestRouteAdmission([hyp()], 'license CHECK lives in cctor!'), /same route already recorded/i)
  assert.match(pentestRouteAdmission([hyp(), hyp({ id: 'H-002' }), hyp({ id: 'H-003' })], 'another route'), /at most 3/)
})

report.finish()
