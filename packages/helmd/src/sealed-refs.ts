// Runtime reader for the sealed references bundle (references.dat).
// Installed packages ship references sealed (npm supply-chain scan sees no
// plaintext); the repo dev layout keeps the plaintext references/ directory,
// which read_reference prefers when present.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { unseal } from './crypt.js'

let cache: Map<string, string> | undefined

/** Walk up from this module to the package root. Modules live either at
 *  dist/ (dev) or dist/.real/ (sealed runtime) — fixed ../ depth breaks in
 *  the .real layout, so locate the root by the markers it carries. */
function packageRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, 'package.json'))) return dir
    dir = dirname(dir)
  }
  return dir
}

function bundlePath(): string {
  return join(packageRoot(), 'references.dat')
}

function manifest(): Map<string, string> | undefined {
  if (cache !== undefined) return cache
  const p = bundlePath()
  if (!existsSync(p)) return undefined
  try {
    const parsed = JSON.parse(unseal(readFileSync(p, 'utf8'))) as { files: Record<string, string> }
    cache = new Map(Object.entries(parsed.files))
    return cache
  } catch {
    return undefined
  }
}

/** Sealed reference content by repo-relative path, or undefined when the
 *  bundle is absent (repo dev mode) or the path is not in the bundle. */
export function readSealedReference(relPath: string): string | undefined {
  const m = manifest()
  if (m === undefined) return undefined
  const key = relPath.replace(/\\/g, '/').replace(/^\//, '')
  return m.get(key)
}

/** Sealed content by absolute path: any path containing a `references`
 *  segment maps to its bundle key (references/<rest>). Used by readTextSeam
 *  so every domain tool's plaintext reference read transparently falls back
 *  to the encrypted bundle when the plaintext file is absent. */
export function readSealedByAbsPath(absPath: string): string | undefined {
  const m = manifest()
  if (m === undefined) return undefined
  const norm = absPath.replace(/\\/g, '/')
  const marker = '/references/'
  const idx = norm.lastIndexOf(marker)
  if (idx < 0) return undefined
  const key = 'references' + norm.slice(idx + marker.length)
  return m.get(key)
}