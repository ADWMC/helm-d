// Subject: the advisory ledger must survive its own directory not existing yet.
// The ledger shares the tool-ledger directory, and only tool_memory ever created it — so on
// a machine where tool_memory was never called, every verdict was written with a bare
// appendFileSync into a missing directory, threw ENOENT into an empty catch, and vanished:
// the adoption card stayed empty and every adaptive reminder kept teaching forever.
// This check pins the fresh-machine shape: the directory does not exist when the first
// verdict is recorded.
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadArtifacts } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'
import { event } from './session-event-fixture.mjs'

const seam = await loadArtifacts()
if (seam === null) skip('advisory-ledger-dir', 'need packages/helmd/dist and an installed @deepseek-ai/dsh')
const report = createReporter('advisory-ledger-dir')

const sandbox = mkdtempSync(join(tmpdir(), 'helmd-advisory-dir-'))
// Point the ledger at a directory that does NOT exist — the shape of a fresh machine.
const missingDir = join(sandbox, 'never-created')
process.env.HELMD_TOOLS_DIR = missingDir

const SESSION = 'check-advisory-ledger-dir'
seam.advisory.submitAdvisory(SESSION, {
  key: 'check:unmet',
  tier: 'recommended',
  content: 'a discipline this session will not follow',
  proof: { kind: 'tool_called', tools: ['tool-that-never-runs'] },
  withinTurns: 1,
}, 0)

const settled = seam.advisory.reckonAdvisories(SESSION, [
  event('assistant/message', { message: { content: 'reply without the required tool call' } }),
])
const ledger = seam.advisory.advisoryLedgerPath()

await report.check('a verdict is recorded even when its directory does not exist yet', () => {
  assert.equal(settled.length, 1, 'the advisory should have been reckoned')
  assert.equal(settled[0].verdict, 'ignored')
  assert.ok(existsSync(missingDir), `the ledger directory should have been created: ${missingDir}`)
  assert.ok(existsSync(ledger), `the ledger file should exist: ${ledger}`)
  assert.match(readFileSync(ledger, 'utf8'), /"key":"check:unmet"[^\n]*"verdict":"ignored"/)
})

await report.check('the recorded row reads back as an ignored tally', () => {
  assert.deepEqual(seam.advisory.advisoryStats().get('check:unmet'), { adopted: 0, ignored: 1 })
})

delete process.env.HELMD_TOOLS_DIR
rmSync(sandbox, { recursive: true, force: true })
report.finish()
