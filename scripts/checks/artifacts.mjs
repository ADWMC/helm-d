// Artifacts under test for the host-seam checks: the installed host `dsh-session`
// package plus helm-d's built output. One responsibility: locate and load them, or
// report their absence so a check can skip instead of guessing.
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const repoRoot = join(import.meta.dirname, '..', '..')
export const distDir = join(repoRoot, 'packages', 'helmd', 'dist')

/** Installed host `dsh-session` entry, or null when this machine has no global dsh. */
export function hostSessionEntry() {
  const roots = [
    process.env.DSH_NODE_MODULES,
    process.env.APPDATA ? join(process.env.APPDATA, 'npm', 'node_modules') : undefined,
    '/usr/local/lib/node_modules',
    '/usr/lib/node_modules',
  ].filter((root) => typeof root === 'string')
  for (const root of roots) {
    const entry = join(root, '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-session', 'lib', 'index.js')
    if (existsSync(entry)) return entry
  }
  return null
}

/** The host's shipped `standard` agent preset, or null when it cannot be located. */
export function hostStandardEntry() {
  const override = process.env.DSH_HOST_STANDARD_YML
  if (override && existsSync(override)) return override
  const entry = hostSessionEntry()
  if (entry === null) return null
  const candidates = [
    // <global>/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-session/lib/index.js → the presets package
    join(entry, '..', '..', '..', '..', '@deepseek-ai', 'dsh-agent-presets', 'presets', 'standard', 'agent.cordis.yml'),
    join(entry, '..', '..', '..', '..', 'dsh-agent-presets', 'presets', 'standard', 'agent.cordis.yml'),
    join(entry, '..', '..', '..', '..', 'dsh', 'config', 'agent-presets', 'standard', 'agent.cordis.yml'),
  ]
  return candidates.find((candidate) => existsSync(candidate)) ?? null
}

/** Whether every built module a check may import is present. */
export function distReady() {
  return ['session-log.js', 'prompt-assembly.js', 'bootstrap.js', 'hcot-hook.js', 'router.js', 'advisory.js', 'ledger.js', 'health.js']
    .every((name) => existsSync(join(distDir, name)))
}

/**
 * Load the host session package and helm-d's built modules.
 * @returns the handles, or null when either artifact is unavailable.
 */
export async function loadArtifacts() {
  const entry = hostSessionEntry()
  if (entry === null || !distReady()) return null
  const built = (name) => import(pathToFileURL(join(distDir, name)).href)
  return {
    hostEntry: entry,
    distDir,
    host: await import(pathToFileURL(entry).href),
    log: await built('session-log.js'),
    assembly: await built('prompt-assembly.js'),
    bootstrap: await built('bootstrap.js'),
    hcot: await built('hcot-hook.js'),
    router: await built('router.js'),
    advisory: await built('advisory.js'),
    ledger: await built('ledger.js'),
    health: await built('health.js'),
  }
}
