#!/usr/bin/env node
// Verify the sealed package shape. No dsh host required.
//
//   node scripts/verify-pack.mjs
//   node scripts/verify-pack.mjs --require-sealed
//   node scripts/verify-pack.mjs --tarball dist-tgz/helmd.tgz
//
// The release gate runs the --require-sealed form after scripts/repack.ps1.
// A normal dev checkout has plaintext dist/ after `pnpm build`, so the default
// form skips instead of pretending the dev tree is a sealed release.
import { execFileSync } from 'node:child_process'
import { createDecipheriv, scryptSync } from 'node:crypto'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkgDir = join(repoRoot, 'packages', 'helmd')
const argv = process.argv.slice(2)
const requireSealed = argv.includes('--require-sealed')
const tarballArgIndex = argv.indexOf('--tarball')
const tarballArg = tarballArgIndex >= 0 ? argv[tarballArgIndex + 1] : undefined

const EXPECTED = new Set([
  'client.js',
  'cordis.patch.yml',
  'dist/health.d.ts',
  'dist/health.js',
  'dist/index.d.ts',
  'dist/index.js',
  'package.json',
  'payload.dat',
  'preset.generated.patch.yml',
  'presets/preset.yml',
  'presets/profiles.dat',
  'references.dat',
])

const FORBIDDEN_PREFIXES = [
  '.real/',
  'node_modules/',
  'references/',
  'scripts/',
  'src/',
  'tests/',
  'presets/profiles/',
]

const FORBIDDEN_FILES = new Set([
  'presets/persona.txt',
  'presets/boost.txt',
])

const PERSONA_LEAK_MARKERS = [
  'You are ' + 'luna',
  '## HARD ' + 'BOUNDS',
  '## SLANG ' + 'ROUTING',
  'helmd ' + 'online',
]

// The payload key is embedded in the generated stub by design (honor-system:
// the target is the npm static scanner, not extraction). The release gate uses
// it only to assert that runtime scripts and real modules really are sealed in.
const PAYLOAD_SECRET = 'helm-d/profiles/v1::6f4d2a0c-9e17-4b8e-a3f2-c81d54e7b930'
const PAYLOAD_SALT = 'helm-d/profiles/v1::salt-v1'
const SEALED_SCRIPTS = [
  'scripts/gen-preset.mjs',
  'scripts/setup-preset.ps1',
  'scripts/setup-preset.sh',
]

function fail(message) {
  console.error(`pack-verify: FAIL — ${message}`)
  process.exitCode = 1
}

function walk(dir, prefix = '') {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`
    if (entry.isDirectory()) out.push(...walk(join(dir, entry.name), rel))
    else out.push(rel.replace(/\\/g, '/'))
  }
  return out
}

function readTarball(tgz) {
  const abs = resolve(tgz)
  if (!existsSync(abs)) throw new Error(`tarball not found: ${abs}`)
  const tmp = mkdtempSync(join(tmpdir(), 'helmd-pack-'))
  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    rmSync(tmp, { recursive: true, force: true })
  }
  try {
    // Pass a relative archive name: GNU tar on Windows reads `C:\...` as a
    // remote `host:path` spec and fails with "Cannot connect to C:".
    execFileSync('tar', ['-xzf', basename(abs), '-C', tmp], { cwd: dirname(abs), stdio: 'pipe' })
    const packageDir = join(tmp, 'package')
    if (!existsSync(join(packageDir, 'package.json'))) {
      throw new Error(`unexpected tarball layout (missing package/package.json): ${basename(abs)}`)
    }
    return {
      files: walk(packageDir),
      read: (rel) => readFileSync(join(packageDir, rel), 'utf8'),
      size: (rel) => statSync(join(packageDir, rel)).size,
      cleanup,
    }
  } catch (error) {
    cleanup()
    throw error
  }
}

function packLocal() {
  const tmp = mkdtempSync(join(tmpdir(), 'helmd-pack-'))
  try {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    const stdout = execFileSync(npm, ['pack', '--json', '--pack-destination', tmp], {
      cwd: pkgDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      // Node 24 on Windows refuses to spawn .cmd files without a shell (EINVAL).
      shell: process.platform === 'win32',
    })
    const info = JSON.parse(stdout)[0]
    if (!info || typeof info.filename !== 'string') throw new Error('npm pack --json returned no filename')
    return readTarball(join(tmp, info.filename))
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

function payloadFiles(pkg) {
  const [iv, tag, data] = pkg.read('payload.dat').split('.')
  if (!iv || !tag || !data) throw new Error('payload.dat is not in iv.tag.data form')
  const key = scryptSync(PAYLOAD_SECRET, PAYLOAD_SALT, 32)
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  const plain = Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8')
  const manifest = JSON.parse(plain)
  return new Set(Object.keys(manifest.files ?? {}))
}

function verify(pkg, source) {
  const got = new Set(pkg.files)
  const missing = [...EXPECTED].filter((f) => !got.has(f))
  const unexpected = [...got].filter((f) => !EXPECTED.has(f))

  if (missing.length > 0) fail(`${source}: missing ${missing.join(', ')}`)
  if (unexpected.length > 0) fail(`${source}: unexpected ${unexpected.join(', ')}`)

  for (const file of got) {
    if (FORBIDDEN_PREFIXES.some((prefix) => file.startsWith(prefix))) {
      fail(`${source}: forbidden path ${file}`)
    }
    if (FORBIDDEN_FILES.has(file) || file.endsWith('.map')) {
      fail(`${source}: forbidden file ${file}`)
    }
  }

  for (const entry of ['dist/health.js', 'dist/index.js']) {
    if (!got.has(entry)) continue
    const head = pkg.read(entry).slice(0, 200)
    if (!head.includes('Sealed entry stub')) fail(`${source}: ${entry} is not a sealed stub`)
  }

  for (const blob of ['payload.dat', 'references.dat', 'presets/profiles.dat']) {
    if (got.has(blob) && pkg.size(blob) === 0) fail(`${source}: ${blob} is empty`)
  }

  let sealedCount = 0
  if (got.has('payload.dat')) {
    let sealed = new Set()
    try {
      sealed = payloadFiles(pkg)
    } catch (error) {
      fail(`${source}: payload.dat cannot be unsealed (${error.message})`)
    }
    sealedCount = sealed.size
    for (const rel of ['.real/health.js', '.real/index.js', ...SEALED_SCRIPTS]) {
      if (!sealed.has(rel)) fail(`${source}: payload.dat is missing ${rel}`)
    }
  }

  if (got.has('preset.generated.patch.yml')) {
    const preset = pkg.read('preset.generated.patch.yml')
    if (!/^# gen-preset: host=[0-9a-f]{64}/m.test(preset)) {
      fail(`${source}: preset.generated.patch.yml has no host fingerprint header`)
    }
    for (const marker of PERSONA_LEAK_MARKERS) {
      if (preset.includes(marker)) fail(`${source}: persona plaintext leaked into preset patch ("${marker}")`)
    }
  }

  for (const rel of ['client.js', 'cordis.patch.yml']) {
    if (got.has(rel) && pkg.size(rel) === 0) fail(`${source}: ${rel} is empty`)
  }

  if (process.exitCode === 1) return
  console.log(`pack-verify: PASS — ${source}: ${got.size} files, ${sealedCount} sealed payload files, no plaintext persona/references/scripts`)
}

function main() {
  if (tarballArg !== undefined) {
    if (tarballArg === '') {
      fail('--tarball requires a path')
      return
    }
    const pkg = readTarball(tarballArg)
    try {
      verify(pkg, tarballArg)
    } finally {
      pkg.cleanup()
    }
    return
  }

  const distEntry = join(pkgDir, 'dist', 'health.js')
  const sealed = existsSync(distEntry) && readFileSync(distEntry, 'utf8').includes('Sealed entry stub')
  if (!sealed) {
    const message = 'dist/ is a dev build (plaintext); run scripts/repack.ps1 before the release gate'
    if (requireSealed) {
      fail(message)
      return
    }
    console.log(`pack-verify: SKIP — ${message}`)
    return
  }

  const pkg = packLocal()
  try {
    verify(pkg, 'npm pack')
  } finally {
    pkg.cleanup()
  }
}

main()
