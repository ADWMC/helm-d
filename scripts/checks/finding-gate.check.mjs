// Subject: the anti-pretence gates on record_finding. A model can CLAIM it
// read references or ran a tool; the gate must judge by the evidence filenames
// (produced by the persisting wrapper) and the session's real tool/call trace.
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { distDir } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const entry = join(distDir, 'tools', 'caseflow.js')
if (!existsSync(entry)) skip('finding-gate', 'need packages/helmd/dist (run pnpm build)')

const home = mkdtempSync(join(tmpdir(), 'helmd-findgate-'))
process.env.DSH_HOME = home
const caseApi = await import(pathToFileURL(join(distDir, 'case.js')).href)
const settingsApi = await import(pathToFileURL(join(distDir, 'settings.js')).href)
const caseflow = await import(pathToFileURL(entry).href)
const report = createReporter('finding-gate')

const caseDir = join(home, 'helmd-cases', 'gate-case')
mkdirSync(join(caseDir, 'evidence'), { recursive: true })
writeFileSync(join(caseDir, 'CASE.md'), 'status: open\ngoal: gate\nmode: full\nroute: reverse\n')
caseApi.bindCase('sess-gate', { dir: caseDir, name: 'gate-case', goal: 'gate', mode: 'full', route: 'reverse' })

// Capture the registered tools with a minimal context.
const tools = new Map()
caseflow.registerCaseflowTools({
  tools: { register: (def) => tools.set(def.name, def) },
  on: () => {},
  get: () => undefined,
})
const finding = tools.get('record_finding')
assert.ok(finding, 'record_finding must register')

/** Fake live agent whose session log carries the given tool names. */
function agentWith(calls) {
  return {
    id: 'sess-gate',
    session: {
      snapshotEvents: () => calls.map((name) => ({ type: 'tool/call', data: { name, arguments: '{}' } })),
    },
  }
}

async function record(agent, ids) {
  return finding.execute(
    { title: 't', detail: 'd', evidence_ids: ids, repro_cmd: 'cmd', severity: 'medium' },
    { agent },
  )
}

await report.check('rejects a finding whose cited evidence is all self-authored', async () => {
  writeFileSync(join(caseDir, 'evidence', 'E-001-manual_scan_strings.txt'), 'invented claim with a spoofed label')
  const out = await record(agentWith(['save_evidence', 'read_reference']), ['E-001'])
  assert.match(out, /REJECTED — every cited evidence id is self-authored/)
})

await report.check('rejects when no real read_reference call exists in the session trace', async () => {
  writeFileSync(join(caseDir, 'evidence', 'E-002-scan_strings.txt'), 'real tool output')
  const out = await record(agentWith(['case_status', 'save_evidence']), ['E-002'])
  assert.match(out, /no read_reference call found/)
})

await report.check('accepts real tool evidence + a real read_reference call', async () => {
  const out = await record(agentWith(['read_reference', 'scan_strings']), ['E-002'])
  assert.match(out, /finding recorded: F-\d+/)
  assert.match(readFileSync(join(caseDir, 'findings.md'), 'utf8'), /E-002/)
})

await report.check('both gates can be switched off in settings', async () => {
  settingsApi.saveSettings({ advisory: { requireDocRead: false, requireToolEvidence: false } })
  try {
    writeFileSync(join(caseDir, 'evidence', 'E-003-manual_fake.txt'), 'invented again')
    const out = await record(agentWith([]), ['E-003'])
    // Same title/vuln_class/target as the earlier accepted finding → the
    // register legitimately merges it; either verb proves the gate let it in.
    assert.match(out, /finding (?:recorded|merged): F-\d+/, 'gates off must restore the old behaviour')
  } finally {
    settingsApi.saveSettings({ advisory: { requireDocRead: true, requireToolEvidence: true } })
  }
})

rmSync(home, { recursive: true, force: true })
report.finish()
