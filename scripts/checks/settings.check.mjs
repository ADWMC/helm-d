// Subject: the operator settings store and the team knobs wired to it. The
// file is the single runtime store (workbench 设置 tab + DSH settings-page row
// both land here), so clamping/merging and the team consumers are pinned.
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { distDir } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const home = mkdtempSync(join(tmpdir(), 'helmd-settings-'))
process.env.DSH_HOME = home
if (!existsSync(join(distDir, 'settings.js'))) skip('settings', 'need packages/helmd/dist (run pnpm build)')
const settings = await import(pathToFileURL(join(distDir, 'settings.js')).href)
const team = await import(pathToFileURL(join(distDir, 'team.js')).href)
const worker = await import(pathToFileURL(join(distDir, 'team-worker.js')).href)
const report = createReporter('settings')

await report.check('defaults are returned when no settings file exists', () => {
  assert.equal(existsSync(settings.settingsPath()), false)
  const s = settings.loadSettings()
  assert.equal(s.intercept.enabled, true)
  assert.equal(s.team.maxParallelWorkers, 4)
  assert.deepEqual(s.team.defaultRoles, ['triage', 'static', 'critic', 'reporter'])
})

await report.check('saveSettings deep-merges, clamps and persists', () => {
  const saved = settings.saveSettings({ team: { maxParallelWorkers: 99, defaultRoles: ['triage', 'ghost'] }, star: { popupDelaySec: -5 } })
  assert.equal(saved.team.maxParallelWorkers, 8)
  assert.equal(saved.star.popupDelaySec, 0)
  assert.deepEqual(saved.team.defaultRoles, ['triage'])
  assert.equal(saved.intercept.enabled, true, 'untouched group keeps its value')
  const onDisk = JSON.parse(readFileSync(settings.settingsPath(), 'utf8'))
  assert.equal(onDisk.team.maxParallelWorkers, 8)
})

await report.check('invalid values fall back to defaults instead of breaking', () => {
  const saved = settings.saveSettings({ team: { maxParallelWorkers: 'x' }, advisory: { nextActionNudge: 'yes' } })
  assert.equal(saved.team.maxParallelWorkers, settings.DEFAULT_SETTINGS.team.maxParallelWorkers)
  assert.equal(saved.advisory.nextActionNudge, true)
})

await report.check('createTicket default roles follow the settings store', () => {
  settings.saveSettings({ team: { defaultRoles: ['triage', 'static'] } })
  const ticket = team.createTicket({ goal: 'roles from settings', caseDir: join(home, 'case') })
  assert.deepEqual(ticket.roles.map((r) => r.role), ['triage', 'static'])
})

await report.check('worker start enforces the configured per-ticket concurrency limit', async () => {
  settings.saveSettings({ team: { maxParallelWorkers: 1 } })
  const ticket = team.createTicket({ goal: 'limit', caseDir: join(home, 'limit'), roles: ['triage', 'static'] })
  const runtime = {
    subagents: {
      getProvider: () => ({ name: 'spawn' }),
      startActivation: async (spec) => ({
        childId: `child-${spec.label}`,
        result: new Promise(() => { /* worker stays running for this test */ }),
        dispose: async () => {},
      }),
    },
  }
  const started = await worker.startTeamWorker({
    ticketId: ticket.id, role: 'triage', parentAgent: { id: 'parent' }, runtime,
  })
  assert.ok(started.sessionId.startsWith('child-'))
  await assert.rejects(
    () => worker.startTeamWorker({ ticketId: ticket.id, role: 'static', parentAgent: { id: 'parent' }, runtime }),
    /concurrency limit/,
  )
})

rmSync(home, { recursive: true, force: true })
report.finish()
