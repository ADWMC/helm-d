// Subject: the case lifecycle's disk contracts — the resume handoff block written by
// begin_case, and end_case's completion gate (a closed case points at evidence on disk,
// or states in words why it has none).
//
// Drives the built plugin composition root against a throwaway HELMD_CASES_DIR, so no
// real case workspace is touched.
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { pluginEntry } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const entry = pluginEntry()
if (entry === null) skip('case-close', 'need packages/helmd/dist (run pnpm build)')

const home = mkdtempSync(join(tmpdir(), 'helmd-case-check-'))
process.env.HELMD_CASES_DIR = home
const report = createReporter('case-close')

/** Minimal cordis stand-in: capture registered tools, ignore lifecycle events. */
const tools = []
const ctx = new Proxy({}, {
  get(target, prop) {
    if (prop === 'tools') { target.tools ??= { register: (def) => { if (def?.name) tools.push(def) } }; return target.tools }
    if (prop === 'commands') { target.commands ??= { register: () => {} }; return target.commands }
    if (prop === 'on') return () => {}
    if (prop === 'get') return () => undefined
    if (typeof prop === 'string') return target[prop]
  },
  set() { return true },
})
const { apply } = await import(pathToFileURL(entry).href)
apply(ctx)
const T = Object.fromEntries(tools.map((def) => [def.name, def]))
const agent = { agent: { id: 'check-session' } }

const opened = await T.begin_case.execute({ goal: 'resume-contract check' }, agent)
const caseDir = readdirSync(join(home, 'helmd-cases')).map((n) => join(home, 'helmd-cases', n))[0]

await report.check('begin_case writes the numbered resume contract', () => {
  const md = readFileSync(join(caseDir, 'CASE.md'), 'utf8')
  for (const n of ['1.', '2.', '3.', '4.', '5.', '6.']) assert.ok(md.includes(`\n${n} `), `missing resume section ${n}`)
  assert.match(md, /## resume/)
})

await report.check('case_status surfaces the resume block', async () => {
  const status = await T.case_status.execute({}, agent)
  assert.match(status, /## resume/)
  assert.match(status, /用户约束|授权范围/)
})

await report.check('end_case rejects a close with no evidence and no stated reason', async () => {
  const verdict = await T.end_case.execute({ summary: 'quick look, done' }, agent)
  assert.match(verdict, /REJECTED/)
  assert.match(verdict, /no-evidence/)
  const md = readFileSync(join(caseDir, 'CASE.md'), 'utf8')
  assert.match(md, /status: open/, 'a rejected close must leave the case open')
})

await report.check('an explicit no-evidence reason is accepted', async () => {
  const verdict = await T.end_case.execute({ summary: 'advisory only (no-evidence: user asked a question, no sample)' }, agent)
  assert.match(verdict, /case closed/)
})

await report.check('evidence on disk satisfies the gate', async () => {
  await T.begin_case.execute({ goal: 'second case' }, agent)
  await T.save_evidence.execute({ label: 'probe', content: 'stdout from an external tool' }, agent)
  const verdict = await T.end_case.execute({ summary: 'closed with E-001 on disk' }, agent)
  assert.match(verdict, /case closed/)
})

// A case opened with a sample hashes it, so the gate passes without extra work.
await report.check('a sample hashed at begin_case already counts as evidence', async () => {
  const sample = join(home, 'sample.bin')
  writeFileSync(sample, 'MZ\x00\x01\x02 packer marker')
  await T.begin_case.execute({ goal: 'sample case', samples: [sample] }, agent)
  const verdict = await T.end_case.execute({ summary: 'sample case closed' }, agent)
  assert.match(verdict, /case closed/)
})

await report.check('pentest keeps distinct routes but bounds open portfolio and does not auto-verify findings', async () => {
  await T.begin_case.execute({ goal: 'web pentest', scope: ['example.test'] }, agent)
  const first = { statement: 'Test the login boundary', expected: 'different result by identity', test_cmd: 'compare identity A and B' }
  assert.match(await T.record_hypothesis.execute(first, agent), /H-001 recorded/)
  assert.match(await T.record_hypothesis.execute({ ...first, statement: 'Test file upload boundary' }, agent), /H-002 recorded/)
  assert.match(await T.record_hypothesis.execute(first, agent), /REJECTED — same route/)
  assert.match(await T.record_hypothesis.execute({ ...first, statement: 'Test object authorization' }, agent), /H-003 recorded/)
  assert.match(await T.record_hypothesis.execute({ ...first, statement: 'Test password reset' }, agent), /REJECTED — at most 3/)
  const packet = await T.case_status.execute({}, agent)
  assert.match(packet, /pentest routes: open 3\/3/)
  assert.match(packet, /scope example.test/)
  // Model-authored evidence cannot pass the normal record_finding gate;
  // the pentest default is covered by finding-gate.
  assert.match(await T.update_hypothesis.execute({ id: 'H-001', status: 'blocked', observation: 'no account', evidence_ids: [] }, agent), /blocked/)
  assert.match(await T.record_hypothesis.execute({ ...first, statement: 'Test password reset' }, agent), /H-004 recorded/)
})

rmSync(home, { recursive: true, force: true })
report.finish()
