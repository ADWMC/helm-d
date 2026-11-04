// Subject: the curated external-tool catalog + registry. Operator rule: only
// tools with a verified GitHub repository may be installed. Also pins the asset
// picker's safety rules (explicit name, single candidate, digest required) and
// the registry round-trip. No network here — release fetching is exercised by
// the real UI/route, not this check.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { distDir } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const catalogEntry = join(distDir, 'toolbox', 'catalog.js')
const registryEntry = join(distDir, 'toolbox', 'registry.js')
const installerEntry = join(distDir, 'toolbox', 'installer.js')
const toolboxEntry = join(distDir, 'tools', 'toolbox.js')
if (!existsSync(catalogEntry) || !existsSync(registryEntry) || !existsSync(installerEntry)) {
  skip('toolbox-catalog', 'need packages/helmd/dist (run pnpm build)')
}
const home = mkdtempSync(join(tmpdir(), 'helmd-toolbox-'))
process.env.DSH_HOME = home
const catalog = await import(pathToFileURL(catalogEntry).href)
const registry = await import(pathToFileURL(registryEntry).href)
const installer = await import(pathToFileURL(installerEntry).href)
const toolbox = await import(pathToFileURL(toolboxEntry).href)
const health = await import(pathToFileURL(join(distDir, 'toolbox', 'health.js')).href)
const report = createReporter('toolbox-catalog')

await report.check('every catalog entry has a verified GitHub repo and unique id', () => {
  const ids = new Set()
  for (const entry of catalog.TOOL_CATALOG) {
    assert.ok(catalog.isGithubRepo(entry.repo), `${entry.id}: not a GitHub repo (${entry.repo})`)
    assert.ok(!ids.has(entry.id), `duplicate catalog id: ${entry.id}`)
    ids.add(entry.id)
    assert.ok(['release', 'pip', 'manual'].includes(entry.kind), `${entry.id}: bad kind ${entry.kind}`)
  }
})

await report.check('tools without a GitHub link stay out of the catalog', () => {
  const ids = catalog.TOOL_CATALOG.map((entry) => entry.id)
  for (const banned of ['ida', 'ida-pro', 'exeinfope', 'gdb', 'nook-cli']) {
    assert.ok(!ids.includes(banned), `catalog must not contain ${banned} (no GitHub link)`)
  }
})

await report.check('registry round-trips an installed row and removes it', () => {
  const row = {
    id: 'jadx', name: 'jadx', repo: 'https://github.com/skylot/jadx', version: 'v1.5.0',
    path: join(home, 'helmd-tools', 'catalog', 'jadx', 'v1.5.0'), assetName: 'jadx.zip',
    sha256: 'a'.repeat(64), installedAt: new Date().toISOString(),
  }
  registry.upsertInstalled(row)
  assert.equal(registry.installedTool('jadx').version, 'v1.5.0')
  assert.equal(installer.toolHealth('jadx').installed, true)
  const removed = registry.removeInstalled('jadx')
  assert.equal(removed.id, 'jadx')
  assert.equal(registry.installedTool('jadx'), undefined)
})

await report.check('asset picker requires an explicit choice when the release is ambiguous', () => {
  const assets = [
    { name: 'jadx-1.5.0.zip', size: 10, digest: 'sha256:' + 'b'.repeat(64), url: 'https://example.invalid/a.zip' },
    { name: 'jadx-1.5.0.tar.gz', size: 11, digest: 'sha256:' + 'c'.repeat(64), url: 'https://example.invalid/a.tgz' },
  ]
  assert.throws(() => installer.chooseAsset(assets), /multiple assets/)
  assert.equal(installer.chooseAsset(assets, 'jadx-1.5.0.zip').name, 'jadx-1.5.0.zip')
})

await report.check('catalog asset patterns resolve exactly one digest-pinned asset', () => {
  const assets = [
    { name: 'jadx-1.5.0.zip', size: 10, digest: 'sha256:' + 'b'.repeat(64), url: 'https://example.invalid/a.zip' },
    { name: 'jadx-gui-1.5.0-win.zip', size: 11, digest: 'sha256:' + 'c'.repeat(64), url: 'https://example.invalid/gui.zip' },
    { name: 'notes.txt', size: 1, digest: null, url: 'https://example.invalid/n.txt' },
  ]
  assert.equal(installer.chooseAsset(assets, undefined, '^jadx-\\d.*\\.zip$').name, 'jadx-1.5.0.zip')
  assert.throws(() => installer.chooseAsset(assets, undefined, '^jadx-.*\\.zip$'), /ambiguous/)
  assert.throws(() => installer.chooseAsset(assets, undefined, '^missing-'), /no asset matching/)
  const unhashed = [{ name: 'tool.zip', size: 1, digest: null, url: 'https://example.invalid/t.zip' }]
  assert.throws(() => installer.chooseAsset(unhashed, undefined, '^tool\\.zip$'), /no GitHub sha256 digest/)
})

await report.check('asset picker refuses assets without a digest', () => {
  const assets = [{ name: 'tool.zip', size: 10, digest: null, url: 'https://example.invalid/a.zip' }]
  assert.throws(() => installer.chooseAsset(assets), /no digest-pinned archive/)
  assert.throws(() => installer.chooseAsset(assets, 'tool.zip'), /no GitHub sha256 digest/)
})

await report.check('tool_recommend scores catalog matches instead of substring-only rules', async () => {
  let recommend
  toolbox.registerToolboxTools({ tools: { register: (def) => { if (def.name === 'tool_recommend') recommend = def } } })
  assert.ok(recommend, 'tool_recommend must register')
  const out = await recommend.execute({ query: 'jadx apk decompiler' })
  assert.match(out, /catalog matches/)
  assert.match(out, /jadx/)
  assert.match(out, /trust=verified/)
})

await report.check('offline mirror installs a catalog id only with a matching sha256', async () => {
  const archive = join(home, 'ffuf-mirror.exe')
  writeFileSync(archive, 'mirror-binary')
  const sha = createHash('sha256').update(readFileSync(archive)).digest('hex')
  const installed = await installer.installCatalogMirror('ffuf', archive, sha)
  assert.match(installed.version, /^mirror-/)
  assert.equal(installed.sha256, sha)
  assert.equal(registry.installedTool('ffuf').path, installed.path)
  registry.removeInstalled('ffuf')
  rmSync(installed.path, { recursive: true, force: true })
  await assert.rejects(() => installer.installCatalogMirror('ffuf', archive, '0'.repeat(64)), /sha256 mismatch/)
})

await report.check('local command probe is read-only, cached, and reports missing tools', () => {
  health.clearProbeCache()
  const node = health.probeCommand(process.platform === 'win32' ? 'node' : 'node')
  assert.equal(node.status, 'verified')
  assert.ok(node.path)
  const again = health.probeCommand('node')
  assert.equal(again.at, node.at, 'second probe must hit the TTL cache')
  assert.equal(health.probeCommand('definitely-not-a-real-tool-xyz').status, 'missing')
})

rmSync(home, { recursive: true, force: true })
report.finish()
