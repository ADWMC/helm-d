// Subject: desktop (Electron) installs bundle the whole dsh tree inside
// resources/app.asar/dsh/…, which no node_modules probe can see — the 2026-11
// real-session finding behind the preset standdown work. This check pins:
//   1. the committed fixture archive (built with @electron/asar 4.3.1, the same
//      tool the product packs with) yields the newest in-interval host standard
//      through the shipped zero-dependency reader;
//   2. unreadable / wrong-shape / truncated archives read as null (probe falls
//      through instead of failing boot);
//   3. an `unpacked` entry is read from the app.asar.unpacked sibling;
//   4. end to end through the public health API: DSH_DESKTOP_APP_ASAR drives
//      locate + HOST_UPGRADED repair against the archived standard.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { distDir, loadArtifacts } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const seam = await loadArtifacts()
if (seam === null) skip('host-asar', 'need packages/helmd/dist (run pnpm build)')

const report = createReporter('host-asar')
const here = dirname(fileURLToPath(import.meta.url))
const fixtures = join(here, 'fixtures')
const manifest = JSON.parse(readFileSync(join(fixtures, 'dsh-host-manifest.json'), 'utf8'))
const { readAsarEntry } = await import(pathToFileURL(join(distDir, 'health.js')).href)

const archive = join(fixtures, 'desktop-app.asar')
const ENTRY = 'dsh/node_modules/@deepseek-ai/dsh-web-app/presets/standard.patch.yml'
const oldest = manifest.hosts[0]
const newest = manifest.hosts[manifest.hosts.length - 1]

await report.check('the committed desktop archive yields the newest host standard', () => {
  const text = readAsarEntry(archive, ENTRY)
  assert.ok(text !== null, 'the fixture archive must carry the host standard')
  // The archive bytes are immutable LF; the fixture is pinned eol=lf but a
  // hand-copied checkout could still carry CRLF, so compare content, not bytes.
  const norm = (t) => t.replace(/\r\n/g, '\n')
  const expected = readFileSync(join(fixtures, newest.standard.fixture), 'utf8')
  assert.equal(norm(text), norm(expected), 'archive content must match the manifest standard')
  assert.equal(createHash('sha256').update(norm(text), 'utf8').digest('hex'), newest.standard.sha256)
})

await report.check('wrong-shape, foreign and truncated archives read as null', () => {
  assert.equal(readAsarEntry(archive, 'dsh/nope.yml'), null, 'a missing entry is null')
  assert.equal(readAsarEntry(join(fixtures, 'host-standard.patch.yml'), ENTRY), null, 'a yaml file is not an archive')
  const home = mkdtempSync(join(tmpdir(), 'helmd-asar-'))
  try {
    const cut = join(home, 'cut.asar')
    writeFileSync(cut, readFileSync(archive).slice(0, 40), 'utf8')
    assert.equal(readAsarEntry(cut, ENTRY), null, 'a truncated header is null')
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

await report.check('an unpacked entry is read from the app.asar.unpacked sibling', () => {
  const home = mkdtempSync(join(tmpdir(), 'helmd-asar-'))
  try {
    // Hand-built minimal archive: the shipped reader ignores the pickled frame,
    // so the frame bytes are placeholders; what matters is the map and the flag.
    const json = JSON.stringify({ files: { 'a.txt': { size: 5, offset: '0', unpacked: true } } })
    const frame = Buffer.from([4, 0, 0, 0, 0x8c, 1, 0, 0, 0x88, 1, 0, 0, 0x82, 1, 0, 0])
    const arc = join(home, 'x.asar')
    writeFileSync(arc, Buffer.concat([frame, Buffer.from(json)]))
    mkdirSync(join(home, 'x.asar.unpacked'), { recursive: true })
    writeFileSync(join(home, 'x.asar.unpacked', 'a.txt'), 'hello', 'utf8')
    assert.equal(readAsarEntry(arc, 'a.txt'), 'hello')
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

// End to end through the public surface: an artifact generated for the oldest
// in-interval host, repaired against the archived newest standard.
const home = mkdtempSync(join(tmpdir(), 'helmd-asar-'))
const saved = { ...process.env }
try {
  const patchPath = join(home, 'preset.generated.patch.yml')
  execFileSync(process.execPath, [join(here, '..', 'gen-preset.mjs'), '--out', join(home, 'old')], {
    encoding: 'utf8',
    env: { ...process.env, DSH_HOST_STANDARD_YML: join(fixtures, oldest.standard.fixture) },
  })
  writeFileSync(patchPath, readFileSync(join(home, 'old', 'preset.generated.patch.yml'), 'utf8'), 'utf8')

  process.env.DSH_DESKTOP_APP_ASAR = archive
  delete process.env.DSH_HOST_STANDARD_YML
  process.env.HELMD_PRESET_PATCH = patchPath
  delete process.env.HELMD_AUTO_HEAL

  await report.check('a pinned desktop archive drives locate + repair end to end', () => {
    const base = seam.health.evaluateHealth()
    assert.equal(base.hostPath, `${archive}!${ENTRY}`, 'the located host must display as archive!entry')
    assert.equal(base.hostFingerprint, newest.standard.sha256.slice(0, 12))
    assert.match(base.autoHeal, /^healed \(HOST_UPGRADED → OK\)/, `unexpected verdict: ${base.autoHeal}`)
    const healed = readFileSync(patchPath, 'utf8')
    assert.match(healed, new RegExp(`^# gen-preset: host=${newest.standard.sha256}`), 'the repair must anchor the archived host')
  })
} finally {
  for (const key of ['DSH_DESKTOP_APP_ASAR', 'DSH_HOST_STANDARD_YML', 'HELMD_PRESET_PATCH', 'HELMD_AUTO_HEAL']) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
  rmSync(home, { recursive: true, force: true })
}

report.finish()
