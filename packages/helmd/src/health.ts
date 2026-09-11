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
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
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
  /**
   * Drift-repair verdict: `off (report-only; …)` by default, `unavailable (…)`,
   * `failed (…)`, or `healed (<from> → <to>) — …` when `HELMD_AUTO_HEAL=1` wrote the preset.
   */
  autoHeal: string
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
  autoHeal: z.string().default('off'),
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

const DEFAULT_PRESET_NAME = 'helmd'
const HEALABLE = new Set(['HOST_UPGRADED', 'STALE', 'LEGACY_PRESET'])

/** Deployed preset directory name; overridable for a preset deployed under another name. */
function presetName(): string {
  return process.env.HELMD_PRESET_NAME?.trim() || DEFAULT_PRESET_NAME
}

/** Whether the drift repair may write. Report-only unless explicitly enabled. */
function autoHealEnabled(): boolean {
  const flag = process.env.HELMD_AUTO_HEAL?.trim().toLowerCase()
  return flag === '1' || flag === 'true' || flag === 'yes'
}

/** Locate the bundled generator that rewrites the deployed preset from the host standard. */
function resolveGenerator(): string | null {
  try {
    const p = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'scripts', 'gen-preset.mjs')
    return existsSync(p) ? p : null
  } catch {
    return null
  }
}

/**
 * Regenerate the deployed preset when it drifted. Report-only by default: the running
 * host must not rewrite a user-editable composition file without an explicit opt-in —
 * MAINTENANCE §8 requires a restart plus the live catalog assertion after any preset
 * content change, which a boot-time rewrite cannot perform. When enabled, the previous
 * file is preserved as `.bak` first, matching scripts/setup-preset.ps1.
 */
function autoHealPreset(): { healed: boolean; verdict: string } {
  if (!autoHealEnabled()) return { healed: false, verdict: 'off (report-only; set HELMD_AUTO_HEAL=1 to repair)' }
  const gen = resolveGenerator()
  if (gen === null) return { healed: false, verdict: 'unavailable (no generator)' }
  const out = join(dshHome(), '.agent-presets', presetName())
  const target = join(out, 'agent.cordis.yml')
  try {
    if (existsSync(target)) {
      try {
        copyFileSync(target, `${target}.bak`)
      } catch {
        // A failed backup must not block the repair; the exit status below still reports it.
      }
    }
    const res = spawnSync(process.execPath, [gen, '--out', out], {
      encoding: 'utf8',
      timeout: 60_000,
    })
    if (res.status !== 0) {
      const why = String(res.stderr || res.error?.message || '').trim().split('\n').slice(-1)[0] ?? ''
      return { healed: false, verdict: `failed (exit ${String(res.status)}${why ? `: ${why}` : ''})` }
    }
    return { healed: true, verdict: 'restart dsh and assert the first request is [pwsh, read] (MAINTENANCE §8)' }
  } catch (e) {
    return { healed: false, verdict: `failed (${(e as Error).message})` }
  }
}

function evaluateHealthCore(): HelmdHealth {
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
    autoHeal: 'off',
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

  const presetPath = join(dshHome(), '.agent-presets', presetName(), 'agent.cordis.yml')
  base.presetPath = presetPath
  if (!existsSync(presetPath)) {
    base.status = 'NOT_DEPLOYED'
    base.detail = `no deployed preset under .agent-presets/${presetName()}; run install / setup-preset`
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
    base.detail = 'deployed preset has no gen-preset fingerprint header; regenerate (repack / setup-preset, or HELMD_AUTO_HEAL=1 + restart)'
    return base
  }
  base.presetFingerprint = m[1].slice(0, 12)
  if (m[1].startsWith(base.hostFingerprint)) {
    base.status = 'OK'
    base.detail = `preset matches installed dsh standard (${base.hostFingerprint})`
  } else {
    base.status = 'HOST_UPGRADED'
    base.detail = `preset targets dsh ${base.presetFingerprint} but the host now hashes ${base.hostFingerprint}; regenerate (repack / setup-preset, or HELMD_AUTO_HEAL=1 + restart)`
  }
  return base
}

/**
 * Evaluate the deployed-preset fingerprint and, when it drifted, optionally regenerate it
 * from the installed host standard (`HELMD_AUTO_HEAL=1` opts in; default is report-only).
 * @returns the health verdict, with the auto-heal outcome folded in.
 */
function evaluateHealth(): HelmdHealth {
  const first = evaluateHealthCore()
  if (!HEALABLE.has(first.status)) return first
  const outcome = autoHealPreset()
  if (!outcome.healed) {
    first.autoHeal = outcome.verdict
    return first
  }
  const healed = evaluateHealthCore()
  healed.autoHeal = `healed (${first.status} → ${healed.status}) — ${outcome.verdict}`
  return healed
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
