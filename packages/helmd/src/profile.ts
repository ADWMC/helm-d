// Runtime armor-profile selection. The catalog ships sealed profile bodies
// (profiles.dat); this module owns only WHICH one is active — an operator
// choice that must survive a restart but take effect immediately.
//
// State is a small file beside the gate state, not a settings document:
// 0.1.7 settings only carries Config schemas, and an enum the operator flips
// at runtime is runtime state, not deployment configuration.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, normalize } from 'node:path'
import { loadCatalog } from './catalog.js'

export interface ProfileSummary {
  id: string
  name: string
  active: boolean
}

export interface ProfileStatus {
  activeId: string
  profiles: ProfileSummary[]
}

/** $DSH_HOME (or ~/.dsh) + storages/helmd/profile.json */
function statePath(): string {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return normalize(join(home, 'storages', 'helmd', 'profile.json'))
}

/** Active profile id: persisted choice when it still exists in the catalog,
 *  otherwise the build-time default. A stale id must never blank the persona. */
export function getActiveProfileId(): string {
  const catalog = loadCatalog()
  try {
    const parsed = JSON.parse(readFileSync(statePath(), 'utf8')) as { activeId?: unknown }
    if (typeof parsed.activeId === 'string' && catalog.profiles.some((p) => p.id === parsed.activeId)) {
      return parsed.activeId
    }
  } catch { /* first run or unreadable — fall back to the sealed default */ }
  return catalog.activeId
}

/** Persist the operator's choice after validating it against the catalog. */
export function setActiveProfileId(id: string): void {
  const catalog = loadCatalog()
  if (!catalog.profiles.some((p) => p.id === id)) {
    const known = catalog.profiles.map((p) => p.id).join(', ')
    throw new Error(`unknown profile "${id}" (known: ${known})`)
  }
  mkdirSync(dirname(statePath()), { recursive: true })
  writeFileSync(statePath(), JSON.stringify({ activeId: id }, null, 2), 'utf8')
}

/** Enumerable catalog + which entry is active (web panel payload). */
export function profileStatus(): ProfileStatus {
  const catalog = loadCatalog()
  const activeId = getActiveProfileId()
  return {
    activeId,
    profiles: catalog.profiles.map((p) => ({ id: p.id, name: p.name, active: p.id === activeId })),
  }
}
