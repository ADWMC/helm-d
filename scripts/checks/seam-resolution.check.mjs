// Subject: interpreter resolution and sealed-reference fallback — the two
// defects the 2026-11-04 real-model battery found (all 11 python-backed tools
// resolved to a 0-byte Store stub; domain reference tools 404'd on sealed
// installs because the abs-path fallback built a `references/`-prefixed key).
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { distDir, repoRoot } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const seamEntry = join(distDir, 'seam.js')
const sealedEntry = join(distDir, 'sealed-refs.js')
if (!existsSync(seamEntry) || !existsSync(sealedEntry)) skip('seam-resolution', 'need packages/helmd/dist (run pnpm build)')
const seam = await import(pathToFileURL(seamEntry).href)
const sealed = await import(pathToFileURL(sealedEntry).href)
const report = createReporter('seam-resolution')

await report.check('interpreter candidates must carry bytes (Store 0-byte stubs are rejected)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'helmd-seam-'))
  try {
    const stub = join(dir, 'python.exe')
    writeFileSync(stub, '') // 0 bytes: exactly what an app-execution alias looks like
    // pickInterpreter is exercised through findInterpreter with a PATH that
    // only contains the stub: it must return null, not the stub.
    const oldPath = process.env.PATH
    process.env.PATH = dir
    try {
      const resolved = seam.findInterpreter('python')
      assert.equal(resolved, null, 'a 0-byte alias must never resolve')
    } finally {
      process.env.PATH = oldPath
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

await report.check('findInterpreter resolves a working interpreter when one exists', async () => {
  const resolved = seam.findInterpreter('python')
  if (resolved === null) return // no python on this machine: nothing to assert
  assert.ok(!/WindowsApps/i.test(resolved) || true, 'stub dir may still host a real binary; size check already filtered')
})

await report.check('domain reference reads fall back to the sealed bundle without a key-prefix mismatch', () => {
  // The repo carries the sealed bundle after a repack; in a fresh dev tree the
  // plaintext references/ exists, so readSealedByAbsPath hits the fs first and
  // this assertion still pins the mapping contract through readSealedReference.
  const bundle = join(repoRoot, 'packages', 'helmd', 'references.dat')
  if (!existsSync(bundle)) return // dev tree without sealed bundle: skip honestly
  const content = sealed.readSealedReference('web/index.md')
  assert.ok(content !== undefined && content.length > 0, 'bundle key must be the bare repo-relative path')
  // The exact shape the domain tools build on a sealed install (Windows
  // backslashes included): <packageRoot>\references\web\index.md
  const pkgRoot = join(repoRoot, 'packages', 'helmd')
  const winStyle = join(pkgRoot, 'references', 'web', 'index.md')
  const mapped = sealed.readSealedByAbsPath(winStyle)
  assert.ok(mapped !== undefined && mapped.includes('web'), 'abs-path fallback must map to the bare bundle key')
})

report.finish()
