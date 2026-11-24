import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { distDir } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const entry = join(distDir, 'tools', 'caseflow.js')
if (!(await import('node:fs')).existsSync(entry)) skip('protection-gate', 'need pnpm build')
const home = mkdtempSync(join(tmpdir(), 'helmd-protection-'))
process.env.DSH_HOME = home
const api = await import(pathToFileURL(join(distDir, 'case.js')).href)
const { registerCaseflowTools } = await import(pathToFileURL(entry).href)
const { registerNativeTools } = await import(pathToFileURL(join(distDir, 'tools', 'native.js')).href)
const { markReferenceLoaded } = await import(pathToFileURL(join(distDir, 'advisory.js')).href)
markReferenceLoaded('sess', 'native/protection-detection-methodology.md')
const dir = join(home, 'helmd-cases', 'case')
mkdirSync(join(dir, 'evidence'), { recursive: true })
writeFileSync(join(dir, 'CASE.md'), 'status: open\ngoal: unpack a candidate\nmode: deep\nroute: reverse\n')
api.bindCase('sess', { dir, name: 'case', goal: 'unpack a candidate', mode: 'deep', route: 'reverse' })
const tools = new Map()
const ctx = { tools: { register: (def) => tools.set(def.name, def) }, on: () => {}, get: () => undefined }
registerCaseflowTools(ctx)
registerNativeTools(ctx)
const call = (name, args) => tools.get(name).execute(args, { agent: { id: 'sess', session: { snapshotEvents: () => [{ type: 'tool/call', data: { name: 'read_reference' } }] } } })
const report = createReporter('protection-gate')

try {
  await report.check('case route refuses missing and invented evidence', async () => {
    const signals = {
      targetVisible: false, staticAttempts: 2, runtimeDependent: false, writeExecuteEvidence: true,
      localVmEvidence: false, generatedCodeEvidence: false, signatureOnly: false,
      canRunIsolated: true, observerReady: true, observerFailed: false, discriminatingQuestion: true,
    }
    assert.match(await call('protection_route', { ...signals, evidence_ids: [] }), /REJECTED/)
    assert.match(await call('protection_route', { ...signals, evidence_ids: ['E-999'] }), /REJECTED/)
    const imported = await api.saveEvidence(dir, 'manual_external-cli', 'UPX! (unverified signature)', 'external observation')
    const result = await call('protection_route', { ...signals, evidence_ids: [imported.id] })
    assert.match(result, /ADVISORY.*self-reported/)
    assert.match(result, /algorithm: unknown/)
  })

  await report.check('tool evidence alone cannot confirm an unpacking hypothesis', async () => {
    const start = await call('record_hypothesis', { statement: 'UPX unpack completed', expected: 'restored image', test_cmd: 'tool' })
    assert.match(start, /H-001/)
    const result = await call('update_hypothesis', { id: 'H-001', status: 'confirmed', observation: 'UPX restored', evidence_ids: ['E-001'] })
    assert.match(result, /REJECTED/)
    assert.equal((await api.loadHypotheses(dir))[0].status, 'open')
    await call('update_hypothesis', { id: 'H-001', status: 'blocked', observation: 'no verifier', evidence_ids: ['E-001'] })
  })

  await report.check('candidate allowed but verified protection finding and promotion rejected', async () => {
    const finding = { title: 'UPX unpacked image', detail: 'candidate only', evidence_ids: ['E-001'], repro_cmd: 'check', severity: 'medium' }
    assert.match(await call('record_finding', finding), /\[medium\/candidate\]/)
    const accepted = await call('record_finding', { ...finding, status: 'candidate' })
    assert.match(accepted, /finding (?:recorded|merged)/)
    const id = (await api.loadFindings(dir))[0].id
    assert.match(await call('update_finding', { finding_id: id, status: 'verified' }), /REJECTED/)
    assert.equal((await api.loadFindings(dir))[0].status, 'candidate')
  })

  await report.check('deep case may close honestly without a fabricated finding', async () => {
    const empty = join(home, 'helmd-cases', 'empty')
    mkdirSync(join(empty, 'evidence'), { recursive: true })
    writeFileSync(join(empty, 'CASE.md'), 'status: open\ngoal: unresolved\nmode: deep\nroute: reverse\n')
    api.bindCase('other', { dir: empty, name: 'empty', goal: 'unresolved', mode: 'deep', route: 'reverse' })
    const end = (summary) => tools.get('end_case').execute({ summary }, { agent: { id: 'other' } })
    assert.match(await end('completed'), /REJECTED/)
    assert.match(await end('inconclusive (no-evidence: no sample provided)'), /case closed/)
    assert.match(readFileSync(join(empty, 'CASE.md'), 'utf8'), /status: completed/)
  })
} finally {
  rmSync(home, { recursive: true, force: true })
}

report.finish()
