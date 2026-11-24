import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { distDir } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const entry = join(distDir, 'persist.js')
if (!existsSync(entry)) skip('persistence-guard', 'need packages/helmd/dist (run pnpm build)')
const home = mkdtempSync(join(tmpdir(), 'helmd-persist-guard-'))
process.env.DSH_HOME = home
const { bindCase, listEvidence } = await import(pathToFileURL(join(distDir, 'case.js')).href)
const { applyPersistenceWrap, isNoPersist } = await import(pathToFileURL(entry).href)
const report = createReporter('persistence-guard')
const caseDir = join(home, 'helmd-cases', 'case')
mkdirSync(join(caseDir, 'evidence'), { recursive: true })
writeFileSync(join(caseDir, 'CASE.md'), 'status: open\ngoal: test\n')
bindCase('persist-guard', { dir: caseDir, name: 'case', goal: 'test', mode: 'full', route: 'reverse' })
const registered = new Map()
const ctx = { tools: { register(def) { registered.set(def.name, def) } } }
const unwrap = applyPersistenceWrap(ctx)
ctx.tools.register({ name: 'scan_strings', execute: async () => 'REJECTED — no sample' })
ctx.tools.register({ name: 'hash_artifact', execute: async () => 'sha256 verified' })
ctx.tools.register({ name: 'update_finding', execute: async () => 'REJECTED — unknown finding' })
unwrap()
const exec = { agent: { id: 'persist-guard' } }

try {
  await report.check('failed analysis output never receives an evidence ID', async () => {
    const out = await registered.get('scan_strings').execute({}, exec)
    assert.match(out, /NOT persisted/)
    assert.equal((await listEvidence(caseDir)).length, 0)
  })
  await report.check('successful analysis output receives a usable evidence ID', async () => {
    const out = await registered.get('hash_artifact').execute({}, exec)
    assert.match(out, /evidence: E-001 saved/)
    const evidence = await listEvidence(caseDir)
    assert.equal(evidence.length, 1)
    assert.match(evidence[0].file, /^E-001-hash_artifact\.txt$/)
  })
  await report.check('administrative and advisory tools cannot create analysis evidence', async () => {
    for (const name of ['update_finding', 'toolbox', 'protection_route']) assert.equal(isNoPersist(name), true)
    assert.equal(await registered.get('update_finding').execute({}, exec), 'REJECTED — unknown finding')
    assert.equal((await listEvidence(caseDir)).length, 1)
    assert.ok(!(await listEvidence(caseDir)).some((entry) => entry.file.includes('update_finding')))
  })
} finally {
  rmSync(home, { recursive: true, force: true })
}
report.finish()
