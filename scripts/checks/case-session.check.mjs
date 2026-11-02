// Subject: case ownership across sessions and restarts. The workbench used to
// show the newest open case on disk, so a fresh session could display another
// session's investigation; the model also forgot the binding after a restart.
// This pins the session-keyed binding file and the per-turn prompt section.
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { distDir } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const caseEntry = join(distDir, 'case.js')
const contextEntry = join(distDir, 'case-context.js')
if (!existsSync(caseEntry) || !existsSync(contextEntry)) skip('case-session', 'need packages/helmd/dist (run pnpm build)')

const home = mkdtempSync(join(tmpdir(), 'helmd-case-session-'))
process.env.DSH_HOME = home
process.env.HELMD_CASES_DIR = home
const caseDir = join(home, 'helmd-cases', '2026-10-27-binding')
mkdirSync(join(caseDir, 'evidence'), { recursive: true })
writeFileSync(join(caseDir, 'CASE.md'), [
  '# binding test',
  '',
  'status: open',
  'goal: prove the case is session-bound',
  'mode: full',
  'route: reverse',
  '',
].join('\n'))

const { bindCase, getCase, unbindCase } = await import(pathToFileURL(caseEntry).href)
const { renderCaseContext } = await import(pathToFileURL(contextEntry).href)
const info = { dir: caseDir, name: '2026-10-27-binding', goal: 'prove the case is session-bound', mode: 'full', route: 'reverse' }
const report = createReporter('case-session')

bindCase('sess-A', info)
const bindingFile = join(home, 'storages', 'helmd', 'sessions', createHash('sha256').update('sess-A').digest('hex') + '.json')

await report.check('binding a case writes a session-keyed file and resolves for that session', () => {
  assert.ok(existsSync(bindingFile), 'binding file was not written')
  assert.equal(getCase('sess-A')?.name, info.name)
})

await report.check('another session never sees the binding', () => {
  assert.equal(getCase('sess-B'), undefined)
})

await report.check('a fresh module (host restart) reloads the binding from disk', async () => {
  const fresh = await import(pathToFileURL(caseEntry).href + '?restart=' + Date.now())
  assert.equal(fresh.getCase('sess-A')?.name, info.name)
})

await report.check('the prompt section names the active case and its close/evidence rules', () => {
  const text = renderCaseContext(info)
  assert.match(text, /Active case: 2026-10-27-binding/)
  assert.match(text, /prove the case is session-bound/)
  assert.match(text, /case_status\(\)/)
  assert.match(text, /end_case\(summary\)/)
})

await report.check('the assembly listener injects the section only for the bound session', async () => {
  const { registerCaseContext } = await import(pathToFileURL(contextEntry).href + '?wire=' + Date.now())
  let assemble
  const ctx = {
    on(name, handler) {
      if (name === 'system-prompt/assemble') assemble = handler
      return () => {}
    },
  }
  registerCaseContext(ctx)
  assert.equal(typeof assemble, 'function', 'case context did not register an assembly listener')
  const bound = await assemble({}, { agent: { id: 'sess-A' } }, async () => ({ sections: [] }))
  assert.ok(bound.sections.some((s) => s.name === 'helm-d:case' && s.text.includes(info.name)))
  const other = await assemble({}, { agent: { id: 'sess-B' } }, async () => ({ sections: [] }))
  assert.ok(!other.sections.some((s) => s.name === 'helm-d:case'))
})

await report.check('closing/unbinding removes the persisted binding', () => {
  unbindCase('sess-A')
  assert.equal(getCase('sess-A'), undefined)
  assert.equal(existsSync(bindingFile), false)
})

rmSync(home, { recursive: true, force: true })
report.finish()
