// Subject: the operator settings store. The file is the single runtime store
// (workbench 设置 tab + DSH settings-page row both land here), so
// clamping/merging — including the toolbox group — is pinned here.
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { distDir } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const home = mkdtempSync(join(tmpdir(), 'helmd-settings-'))
process.env.DSH_HOME = home
if (!existsSync(join(distDir, 'settings.js'))) skip('settings', 'need packages/helmd/dist (run pnpm build)')
const settings = await import(pathToFileURL(join(distDir, 'settings.js')).href)
const report = createReporter('settings')

await report.check('defaults are returned when no settings file exists', () => {
  assert.equal(existsSync(settings.settingsPath()), false)
  const s = settings.loadSettings()
  assert.equal(s.intercept.enabled, true)
  assert.equal(s.toolbox.modelInstall, false)
})

await report.check('saveSettings deep-merges, clamps and persists', () => {
  const saved = settings.saveSettings({ intercept: { enabled: false }, star: { popupDelaySec: -5 } })
  assert.equal(saved.intercept.enabled, false)
  assert.equal(saved.star.popupDelaySec, 0)
  assert.equal(saved.advisory.autonomyPacket, true, 'untouched group keeps its value')
  const onDisk = JSON.parse(readFileSync(settings.settingsPath(), 'utf8'))
  assert.equal(onDisk.intercept.enabled, false)
})

await report.check('invalid values fall back to defaults instead of breaking', () => {
  const saved = settings.saveSettings({ star: { popupDelaySec: 'x' }, advisory: { nextActionNudge: 'yes' } })
  assert.equal(saved.star.popupDelaySec, settings.DEFAULT_SETTINGS.star.popupDelaySec)
  assert.equal(saved.advisory.nextActionNudge, true)
})

await report.check('saveSettings keeps the stored toolbox group when saving other keys', () => {
  // F-001 (settings audit): the merge used to drop the toolbox key, silently
  // resetting modelInstall to the default on every unrelated save.
  const stored = JSON.parse(readFileSync(settings.settingsPath(), 'utf8'))
  stored.toolbox = { modelInstall: true }
  writeFileSync(settings.settingsPath(), JSON.stringify(stored), 'utf8')
  const saved = settings.saveSettings({ intercept: { enabled: true } })
  assert.equal(saved.toolbox.modelInstall, true, 'toolbox survives an unrelated save')
  const onDisk = JSON.parse(readFileSync(settings.settingsPath(), 'utf8'))
  assert.equal(onDisk.toolbox.modelInstall, true, 'toolbox survives on disk too')
})

rmSync(home, { recursive: true, force: true })
report.finish()
