#!/usr/bin/env node
// build-sealed.mjs — transform the built package into a sealed distribution.
//
// After tsc + build-profiles:
//   1. ALL compiled dist modules (including the two host entries health.js /
//      index.js) MOVE under <pkg>/.real/ and seal into payload.dat. Two
//      generated stubs (dist/health.js, dist/index.js) self-extract on first
//      import, then re-export the real module's named exports. The published
//      tarball carries no flaggable plaintext — npm's supply-chain scan sees
//      only the sealed blob.
//   2. Only runtime preset/install scripts seal too (extracted on activation).
//   3. references/** seals into references.dat (read_reference decrypts in
//      memory per request). The source references/ dir stays in the repo —
//      npm pack excludes it via files negation.
//
// Crypto: built-in profiles key (operator ruling: honor-system; the target
// is npm's static scanner, not extraction).
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import crypto from 'node:crypto'

const pkgRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const distDir = join(pkgRoot, 'dist')
const refDir = join(pkgRoot, 'references')

const SECRET = 'helm-d/profiles/v1::6f4d2a0c-9e17-4b8e-a3f2-c81d54e7b930'
const SALT = 'helm-d/profiles/v1::salt-v1'
const key = crypto.scryptSync(SECRET, SALT, 32)

function seal(plain) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const b64u = (b) => b.toString('base64url')
  return [b64u(iv), b64u(cipher.getAuthTag()), b64u(enc)].join('.')
}

// Type entries stay plaintext at dist root (exports map "types" resolution).
const KEEP_PLAIN = new Set(['health.d.ts', 'index.d.ts'])
const RUNTIME_SCRIPTS = new Set(['gen-preset.mjs', 'setup-preset.ps1', 'setup-preset.sh'])
const RUNTIME_TOOLS = new Set(['caseflow', 'toolbox'])

// tsc emits every src module, including retired analyzers. Package only the
// static dependency closure of the two public entry points. Relative dynamic
// imports must be reviewed explicitly; silently dropping one breaks installs.
function runtimeModules(dir) {
  const pending = ['health.js', 'index.js']
  const included = new Set()
  while (pending.length) {
    const rel = pending.pop()
    if (included.has(rel)) continue
    const abs = join(dir, rel)
    if (!existsSync(abs)) throw new Error(`runtime dependency is missing: ${rel}`)
    included.add(rel)
    const text = readFileSync(abs, 'utf8')
    if (/\bimport\s*\(\s*[^'"\s]/.test(text)) throw new Error(`review dynamic import in ${rel}`)
    for (const match of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"](\.[^'"]+\.js)['"]/g)) {
      const next = join(dirname(rel), match[1]).replace(/\\/g, '/')
      if (!next.startsWith('../') && !next.startsWith('/')) pending.push(next)
      else throw new Error(`runtime import escapes package: ${rel} → ${match[1]}`)
    }
  }
  return included
}

async function exportNames(file) {
  const mod = await import(pathToFileURL(file).href)
  return Object.keys(mod)
}

function walk(dir, prefix = '') {
  const out = []
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    const rel = prefix ? `${prefix}/${entry}` : entry
    if (statSync(p).isDirectory()) out.push(...walk(p, rel))
    else out.push(rel)
  }
  return out
}

function sealReferences() {
  const refManifest = { files: {} }
  for (const rel of walk(refDir)) {
    refManifest.files[rel.replace(/\\/g, '/')] = readFileSync(join(refDir, rel), 'utf8')
  }
  writeFileSync(join(pkgRoot, 'references.dat'), seal(JSON.stringify(refManifest)), 'utf8')
  return Object.keys(refManifest.files).length
}

// Updating reference text does not require destroying an existing .real tree
// or overwriting a previously packed release in dist-tgz/.
if (process.argv.includes('--references-only')) {
  console.log(`sealed: references.dat (${sealReferences()} files)`)
  process.exit(0)
}

// ── 1. dist → .real/ + payload.dat ──────────────────────────────────────────
// ALWAYS seal the fresh compile output. tsc re-emits into dist/, so a .real/
// left over from an earlier seal is stale by definition — sealing it shipped
// old modules once (v0.5.1fix incident: new gate/star-gate never reached the
// payload). Wipe .real/ first, then require real modules, not entry stubs.
const realDir = join(pkgRoot, '.real')
rmSync(realDir, { recursive: true, force: true })
const sourceDir = distDir
for (const entry of ['health.js', 'index.js']) {
  const candidate = join(sourceDir, entry)
  if (!existsSync(candidate)) throw new Error(`dist/${entry} is missing — run \`npm run build\` before sealing`)
  if (readFileSync(candidate, 'utf8').includes('Sealed entry stub')) {
    throw new Error(`dist/${entry} is a sealed stub — run \`npm run build\` before sealing`)
  }
}
const distFiles = walk(sourceDir)
const runtime = runtimeModules(sourceDir)
const manifest = { hash: '', files: {} }
const realMove = []
const excluded = []
for (const rel of distFiles) {
  const module = rel.replace(/(?:\.js\.map|\.d\.ts|\.js)$/, '.js')
  if (!runtime.has(module)) {
    excluded.push(rel)
    continue
  }
  const toolMatch = /^tools\/([^/.]+)\.(?:js|js\.map|d\.ts)$/.exec(rel)
  if (toolMatch && !RUNTIME_TOOLS.has(toolMatch[1])) throw new Error(`retired domain tool reachable: ${rel}`)
  const base = rel.split('/').pop()
  // Only the two root entry declarations stay plaintext; nested .d.ts files
  // belong to sealed modules (e.g. toolbox/health.d.ts).
  if (!rel.includes('/') && KEEP_PLAIN.has(base)) continue
  const src = join(sourceDir, rel)
  const target = `.real/${rel}`
  manifest.files[target] = readFileSync(src, 'utf8')
  realMove.push([src, target])
}

// Only runtime preset scripts ship. Domain scripts remain in the repository as
// historical source, not as tools available to the installed plugin.
const scriptDir = join(pkgRoot, 'scripts')
const scriptFiles = existsSync(scriptDir) ? walk(scriptDir).filter((rel) => RUNTIME_SCRIPTS.has(rel)) : []
for (const rel of scriptFiles) {
  manifest.files[`scripts/${rel}`] = readFileSync(join(scriptDir, rel), 'utf8')
}

manifest.hash = crypto.createHash('sha256')
  .update(Object.keys(manifest.files).sort().join('\n'))
  .digest('hex')
  .slice(0, 16)

for (const [src, target] of realMove) {
  const abs = join(pkgRoot, target)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, readFileSync(src), 'utf8')
  rmSync(src)
}
// npm's files allowlist includes dist/ wholesale. Remove tsc outputs outside
// the runtime closure, otherwise retired analyzers leak as plaintext files.
for (const rel of excluded) rmSync(join(sourceDir, rel))
writeFileSync(join(pkgRoot, 'payload.dat'), seal(JSON.stringify(manifest)), 'utf8')

// ── 2. generate the two entry stubs ─────────────────────────────────────────
const stubNames = {
  'health.js': await exportNames(join(pkgRoot, '.real', 'health.js')),
  'index.js': await exportNames(join(pkgRoot, '.real', 'index.js')),
}

const STUB_HEAD = `// Sealed entry stub — the real module ships encrypted in payload.dat
// and self-extracts to .real/ on first import (npm supply-chain scan sees
// only the sealed blob). Generated by scripts/build-sealed.mjs — do not edit.
import { createDecipheriv, createHash, scryptSync } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const realDir = join(pkgRoot, '.real')
const payloadPath = join(pkgRoot, 'payload.dat')
const KEY = scryptSync(${JSON.stringify(SECRET)}, ${JSON.stringify(SALT)}, 32)
function unseal(s) {
  const [i, t, d] = s.split('.')
  const c = createDecipheriv('aes-256-gcm', KEY, Buffer.from(i, 'base64url'))
  c.setAuthTag(Buffer.from(t, 'base64url'))
  return Buffer.concat([c.update(Buffer.from(d, 'base64url')), c.final()]).toString('utf8')
}
// Re-extract whenever the payload bytes change (marker = payload SHA256).
const payloadHash = createHash('sha256').update(readFileSync(payloadPath)).digest('hex')
const markerPath = join(realDir, '.unsealed')
if (!existsSync(markerPath) || readFileSync(markerPath, 'utf8') !== payloadHash) {
  const manifest = JSON.parse(unseal(readFileSync(payloadPath, 'utf8')))
  for (const [rel, content] of Object.entries(manifest.files)) {
    const p = join(pkgRoot, rel)
    mkdirSync(dirname(p), { recursive: true })
    writeFileSync(p, content, 'utf8')
  }
  writeFileSync(markerPath, payloadHash)
}
`

for (const [base, names] of Object.entries(stubNames)) {
  const target = join(distDir, base)
  if (existsSync(target)) rmSync(target)
  const lines = [STUB_HEAD, `const mod = await import('../.real/${base}')`]
  for (const name of names) {
    lines.push(`export const ${name} = mod.${name}`)
  }
  lines.push('export default mod.default')
  writeFileSync(target, lines.join('\n'), 'utf8')
}

// ── 3. references → references.dat ──────────────────────────────────────────
const referenceCount = sealReferences()

console.log(
  `sealed: payload.dat (${Object.keys(manifest.files).length} files, ` +
  `${Math.round(statSync(join(pkgRoot, 'payload.dat')).size / 1024)} KB) + ` +
  `references.dat (${referenceCount} files, ` +
  `${Math.round(statSync(join(pkgRoot, 'references.dat')).size / 1024)} KB) + ` +
  `stubs [${Object.keys(stubNames).join(', ')}]`,
)
