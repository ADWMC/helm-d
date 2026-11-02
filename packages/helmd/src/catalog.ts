// Persona-profile catalog: sealed profiles.dat → enumerable profiles with an
// active pointer. M1 scope: the "ds4.1f" profile is the current persona text;
// additional profiles are plain catalog entries (content TBD by operator).
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { unseal } from './crypt.js'

export interface Profile {
  id: string
  name: string
  /** Sealed body — unseal() at load; plaintext lives only in memory. */
  sealed: string
  body?: string
}

export interface Catalog {
  version: number
  activeId: string
  profiles: Profile[]
  /** Sealed tail override block (presets/boost.txt), unsealed in memory. */
  boost?: string
}

/** Walk up from this module to the package root. Modules live either at
 *  dist/ (dev) or dist/.real/ (sealed runtime) — fixed ../ depth breaks in
 *  the .real layout, so locate the root by its package.json marker. */
function packageRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, 'package.json'))) return dir
    dir = dirname(dir)
  }
  return dir
}

const catalogPath = join(packageRoot(), 'presets', 'profiles.dat')

let cached: Catalog | undefined

/** Load + unseal the catalog. Bodies are decrypted in memory only. */
export function loadCatalog(): Catalog {
  if (cached !== undefined) return cached
  const raw = JSON.parse(readFileSync(catalogPath, 'utf8')) as {
    version: number
    activeId: string
    profiles: Array<{ id: string; name: string; sealed: string }>
    boost?: string
  }
  cached = {
    version: raw.version,
    activeId: raw.activeId,
    profiles: raw.profiles.map((p) => ({
      id: p.id,
      name: p.name,
      sealed: p.sealed,
      body: unseal(p.sealed),
    })),
    ...(raw.boost ? { boost: unseal(raw.boost) } : {}),
  }
  return cached
}

/** Tail override block (sealed boost.txt). Undefined when the build has none. */
export function boostBody(): string | undefined {
  return loadCatalog().boost
}

/** Profile body by id; falls back to the active profile. */
export function profileBody(id?: string): string | undefined {
  const catalog = loadCatalog()
  const wanted = id ?? catalog.activeId
  return catalog.profiles.find((p) => p.id === wanted)?.body
}
