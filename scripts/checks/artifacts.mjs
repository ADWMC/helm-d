// Artifacts under test for the host-seam checks: the installed host `dsh-session`
// package plus helm-d's built output. One responsibility: locate and load them, or
// report their absence so a check can skip instead of guessing.
import { existsSync, realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const repoRoot = join(import.meta.dirname, '..', '..')
export const distDir = join(repoRoot, 'packages', 'helmd', 'dist')

const SESSION_TAIL = ['@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-session', 'lib', 'index.js']

/**
 * Candidate `<prefix>/node_modules` roots that may hold a global `@deepseek-ai/dsh`.
 *
 * A dsh install is not always the npm-global one: the official installer and
 * bundled/portable Node setups put it beside their own binary (e.g.
 * `D:\NodeJS\node_modules`). Probing APPDATA alone made every host-seam check
 * skip silently on such machines — the suite still printed `PASS`, so a broken
 * host integration looked green. Derive roots from wherever this process can
 * actually observe dsh; keep the explicit env override first.
 */
function candidateNodeModules() {
  const roots = [
    process.env.DSH_NODE_MODULES,
    process.env.APPDATA ? join(process.env.APPDATA, 'npm', 'node_modules') : undefined,
    '/usr/local/lib/node_modules',
    '/usr/lib/node_modules',
  ]

  // A PATH entry IS the install prefix: the official Windows bundle ships
  // `D:\NodeJS\dsh` beside `D:\NodeJS\node_modules`, so probing `dirname`
  // (which yields `D:\`) misses it — probe the entry itself. Unix layouts put
  // the global tree one level down under `<prefix>/lib`, so cover both.
  const sep = process.platform === 'win32' ? ';' : ':'
  for (const raw of (process.env.PATH ?? '').split(sep)) {
    const dir = raw.replace(/[\/]+$/, '')
    if (dir === '') continue
    roots.push(join(dir, 'node_modules'), join(dir, 'lib', 'node_modules'))
  }

  return roots.filter((root) => typeof root === 'string' && root !== '')
}

/** Installed host `dsh-session` entry, or null when this machine has no global dsh. */
export function hostSessionEntry() {
  const seen = new Set()
  for (const root of candidateNodeModules()) {
    const key = root.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const entry = join(root, ...SESSION_TAIL)
    if (existsSync(entry)) {
      // pnpm-style trees expose the package through a symlink; resolve it so the
      // entry names a real file even when its directory does not. hostStandardEntry()
      // walks ancestors rather than counting levels, so this is convenience only.
      try { return realpathSync(entry) } catch { return entry }
    }
  }
  return null
}

/** Host `standard` preset tails, newest host generation first. */
const HOST_STANDARD_TAILS = [
  // dsh >= 0.1.7: `standard` is a web-app preset patch, not an agent.cordis.yml
  ['@deepseek-ai', 'dsh-web-app', 'presets', 'standard.patch.yml'],
  ['@deepseek-ai', 'dsh-agent-presets', 'presets', 'standard', 'agent.cordis.yml'],
  ['dsh-agent-presets', 'presets', 'standard', 'agent.cordis.yml'],
  ['config', 'agent-presets', 'standard', 'agent.cordis.yml'],
]

/** Every ancestor directory of a file, nearest first. */
function ancestors(file) {
  const out = []
  let dir = dirname(file)
  for (;;) {
    out.push(dir)
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return out
}

/**
 * The host's shipped `standard` agent preset, or null when it cannot be located.
 *
 * Probed by walking `dsh-session`'s ancestors instead of counting `../..` levels:
 * npm hoists differently per host version and install method (0.1.7 keeps
 * `dsh-web-app` inside `@deepseek-ai/dsh/node_modules`), and a fixed depth
 * silently reported "no host" on the layout it wasn't written for.
 */
export function hostStandardEntry() {
  const override = process.env.DSH_HOST_STANDARD_YML
  if (override && existsSync(override)) return override
  const entry = hostSessionEntry()
  if (entry === null) return null
  const dirs = ancestors(entry)
  for (const tail of HOST_STANDARD_TAILS) {
    for (const dir of dirs) {
      const candidate = join(dir, ...tail)
      if (existsSync(candidate)) return candidate
    }
  }
  return null
}

/** helm-d's built composition root, or null when the build is missing. */
export function pluginEntry() {
  const entry = join(distDir, 'index.js')
  return existsSync(entry) ? entry : null
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
