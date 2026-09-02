/**
 * Host-plane health surface for the helmd package.
 *
 * Registers the read-only settings namespace `helmd` whose composed base
 * carries a boot-time evaluation of the deployed preset fingerprint
 * (`# gen-preset: host=<sha256>` header written by gen-preset.mjs) against
 * the hash of the INSTALLED host's own `standard` agent preset.
 *
 * Evaluation runs once per process start — deliberately. The standing-mount
 * semantics mean a preset change is only safe after a harness restart
 * (incident 2026-08-26: generation replacement collides in the same preset
 * scope), so boot time is exactly the moment this verdict is true.
 *
 * Agent tools are mounted separately by the helmd preset. Keeping this row on
 * the host plane makes the health card available without exposing helmd tools
 * to other agents.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

/** The settings namespace this module serves. Also the client card key. */
export const HELMD_HEALTH_NS = 'helmd'

const FINGERPRINT_RE = /^# gen-preset: host=([0-9a-f]{64})/m

/** Health verdict served to the settings card. All fields are plain strings. */
export interface HelmdHealth {
  /** OK | HOST_UPGRADED | STALE | LEGACY_PRESET | NOT_DEPLOYED | UNKNOWN */
  status: string
  /** Human-readable one-liner supporting the status. */
  detail: string
  /** sha256 of the installed host standard, first 12 hex chars ('' if unreadable). */
  hostFingerprint: string
  /** Fingerprint recorded inside the deployed preset ('' if absent). */
  presetFingerprint: string
  /** Absolute path of the deployed agent.cordis.yml ('' if not found). */
  presetPath: string
  /** Absolute path of the host standard used ('' if not found). */
  hostPath: string
  /** ISO timestamp of this evaluation (host boot). */
  checkedAt: string
  /** Installed helmd package version. */
  version: string
}

const HelmdHealthSchema = z.object({
  status: z.string().default('UNKNOWN'),
  detail: z.string().default(''),
  hostFingerprint: z.string().default(''),
  presetFingerprint: z.string().default(''),
  presetPath: z.string().default(''),
  hostPath: z.string().default(''),
  checkedAt: z.string().default(''),
  version: z.string().default(''),
})

/** Harness home: DSH_HOME wins, else ~/.dsh (matches gen-preset deployment). */
function dshHome(): string {
  return process.env.DSH_HOME ?? join(homedir(), '.dsh')
}

/**
 * Locate the installed dsh's shipped standard preset without spawning npm
 * (this runs on the session server). Same probe order as scripts/gen-preset.mjs.
 */
function locateHostStandard(): string | null {
  const env = process.env.DSH_HOST_STANDARD_YML
  if (env && existsSync(env)) return env
  const candidates: string[] = []
  const appdata = process.env.APPDATA
  if (appdata) {
    candidates.push(join(appdata, 'npm', 'node_modules', '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-agent-presets', 'presets', 'standard', 'agent.cordis.yml'))
    candidates.push(join(appdata, 'npm', 'node_modules', '@deepseek-ai', 'dsh', 'config', 'agent-presets', 'standard', 'agent.cordis.yml'))
  }
  // Typical POSIX global roots when APPDATA is absent (non-Windows hosts).
  candidates.push(
    '/usr/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-agent-presets/presets/standard/agent.cordis.yml',
    '/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-agent-presets/presets/standard/agent.cordis.yml',
    '/usr/lib/node_modules/@deepseek-ai/dsh/config/agent-presets/standard/agent.cordis.yml',
    '/usr/local/lib/node_modules/@deepseek-ai/dsh/config/agent-presets/standard/agent.cordis.yml',
  )
  for (const c of candidates) if (existsSync(c)) return c
  return null
}

function evaluateHealth(): HelmdHealth {
  let version = ''
  try {
    const pkgUrl = new URL('../package.json', import.meta.url)
    version = JSON.parse(readFileSync(pkgUrl, 'utf8')).version ?? ''
  } catch { /* keep '' */ }

  const base: HelmdHealth = {
    status: 'UNKNOWN',
    detail: '',
    hostFingerprint: '',
    presetFingerprint: '',
    presetPath: '',
    hostPath: '',
    checkedAt: new Date().toISOString(),
    version,
  }

  const hostPath = locateHostStandard()
  base.hostPath = hostPath ?? ''
  if (hostPath === null) {
    base.status = 'UNKNOWN'
    base.detail = 'cannot locate the installed dsh standard preset; set DSH_HOST_STANDARD_YML'
    return base
  }
  try {
    base.hostFingerprint = createHash('sha256').update(readFileSync(hostPath, 'utf8'), 'utf8').digest('hex').slice(0, 12)
  } catch {
    base.status = 'UNKNOWN'
    base.detail = `host standard at ${hostPath} is unreadable`
    return base
  }

  const presetPath = join(dshHome(), '.agent-presets', 'helmd', 'agent.cordis.yml')
  base.presetPath = presetPath
  if (!existsSync(presetPath)) {
    base.status = 'NOT_DEPLOYED'
    base.detail = 'no deployed preset under .agent-presets/helmd; run install / setup-preset'
    return base
  }

  let text = ''
  try { text = readFileSync(presetPath, 'utf8') } catch {
    base.status = 'UNKNOWN'
    base.detail = `deployed preset ${presetPath} is unreadable`
    return base
  }
  const m = text.match(FINGERPRINT_RE)
  if (!m) {
    base.presetFingerprint = ''
    base.status = 'LEGACY_PRESET'
    base.detail = 'deployed preset has no gen-preset fingerprint header; regenerate (repack or setup-preset)'
    return base
  }
  base.presetFingerprint = m[1].slice(0, 12)
  if (m[1].startsWith(base.hostFingerprint)) {
    base.status = 'OK'
    base.detail = `preset matches installed dsh standard (${base.hostFingerprint})`
  } else {
    base.status = 'HOST_UPGRADED'
    base.detail = `preset targets dsh ${base.presetFingerprint} but the host now hashes ${base.hostFingerprint}; regenerate (repack or setup-preset)`
  }
  return base
}

/**
 * Bundle row apply. Registers the namespace once on the host plane.
 * @param ctx - the host composition context this row was plugged into.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    const settings = (settingsCtx as Context & {
      settings: { register(ns: unknown, schema: unknown, opts: unknown): unknown }
    }).settings
    const health = evaluateHealth()
    try {
      settings.register(
        HELMD_HEALTH_NS,
        HelmdHealthSchema,
        { base: { ...health } },
      )
    } catch (e) {
      console.error(`[helmd-health] settings registration failed: ${String((e as Error)?.message ?? e)}`)
    }
  })
}
