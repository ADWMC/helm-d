// Read-only local command probe with a small TTL cache (T-12.1/T-12.4).
// It only asks the OS where a name resolves; it never executes the tool.

import { spawnSync } from 'node:child_process'

export interface ProbeResult {
  command: string
  status: 'verified' | 'missing'
  path?: string
  at: string
}

const ttlMs = 5 * 60 * 1000
const maxEntries = 64
const cache = new Map<string, ProbeResult>()

export function probeCommand(command: string): ProbeResult {
  const name = command.trim()
  if (name === '') throw new Error('command is required')
  const hit = cache.get(name)
  if (hit !== undefined && Date.now() - Date.parse(hit.at) < ttlMs) return hit
  const finder = process.platform === 'win32' ? 'where' : 'which'
  const result = spawnSync(finder, [name], { encoding: 'utf8', timeout: 5000 })
  const path = result.status === 0 ? String(result.stdout ?? '').split(/\r?\n/).find((line) => line.trim() !== '')?.trim() : undefined
  const probe: ProbeResult = {
    command: name,
    status: path === undefined ? 'missing' : 'verified',
    ...(path !== undefined ? { path } : {}),
    at: new Date().toISOString(),
  }
  cache.set(name, probe)
  if (cache.size > maxEntries) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at.localeCompare(b[1].at))[0]
    if (oldest !== undefined) cache.delete(oldest[0])
  }
  return probe
}

export function clearProbeCache(): void {
  cache.clear()
}
