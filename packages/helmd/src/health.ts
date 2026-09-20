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
import { readShelfTools } from './ledger.js'
import { registerHelmdApi } from './api-routes.js'

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
   * Drift-repair verdict: `healed (<from> → <to>) — …` when the preset was rewritten;
   * `<status> not repaired — …` or `off (HELMD_AUTO_HEAL=0)` when it was left alone;
   * `unavailable (…)` / `failed (…)` otherwise.
   */
  autoHeal: string
  /** Dynamic shelf tools loaded from TOOLS.md (JSON stringified). */
  tools: string
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
  tools: z.string().default('[]'),
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

/**
 * Drift-repair policy:
 *   unset → repair a deployed preset that carries our fingerprint header (provenance is
 *           provable: it is an artifact we generated), and only report one without a
 *           header (it may be hand-written, so overwriting it is the user's call);
 *   `0`   → never write — escape hatch for a locked-down or hand-managed deployment;
 *   `1`   → repair every healable status, header or not.
 * A repair keeps the previous file as `.bak` first. Restarting dsh and asserting the
 * catalog (MAINTENANCE §8) stays the user's step: this only re-syncs the file.
 */
function healPolicy(): 'auto' | 'off' | 'force' {
  const flag = process.env.HELMD_AUTO_HEAL?.trim().toLowerCase()
  if (flag === '0' || flag === 'false' || flag === 'no') return 'off'
  if (flag === '1' || flag === 'true' || flag === 'yes') return 'force'
  return 'auto'
}

/** Statuses whose deployed file carries the gen-preset header, i.e. provably our artifact. */
const DERIVED_STATUSES = new Set(['STALE', 'HOST_UPGRADED'])

function shouldRepair(status: string, policy: 'auto' | 'off' | 'force'): boolean {
  if (policy === 'off') return false
  if (policy === 'force') return true
  return DERIVED_STATUSES.has(status)
}

/** Why a healable status was left alone. */
function reportOnlyVerdict(status: string, policy: 'auto' | 'off' | 'force'): string {
  if (policy === 'off') return 'off (HELMD_AUTO_HEAL=0)'
  return `${status} not repaired — no gen-preset fingerprint header, so the file is not provably ours; `
    + 'regenerate with install / setup-preset, or set HELMD_AUTO_HEAL=1 to overwrite it (a .bak is kept)'
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

/** `- id:` rows of a preset or host standard, in file order. */
function rowIds(text: string): string[] {
  return [...text.matchAll(/^- id: (.+)$/gm)].map((m) => m[1].trim())
}

/**
 * Structural half of the MAINTENANCE §8 guardrail: everything assertable about the artifact
 * itself, with no session involved. The live half (a restarted host answers the first
 * request with exactly [pwsh, read]) stays with the operator — it cannot be produced from
 * inside the process that is being asserted.
 */
export function assertPresetArtifact(deployed: string, hostStandardText: string): { ok: boolean; detail: string } {
  const hostIds = rowIds(hostStandardText)
  const deployedIds = rowIds(deployed)
  const expected = [...hostIds, 'helmd'].sort()
  if (JSON.stringify([...deployedIds].sort()) !== JSON.stringify(expected)) {
    return {
      ok: false,
      detail: `row ids differ from this host's standard (expected ${expected.length}: host rows + helmd, got ${deployedIds.length})`,
    }
  }
  const duplicated = [...new Set(deployedIds.filter((id, i) => deployedIds.indexOf(id) !== i))]
  if (duplicated.length > 0) return { ok: false, detail: `duplicated row ids: ${duplicated.join(', ')}` }
  if ((deployed.match(/@adwmc\/helm-d/g) ?? []).length !== 1) {
    return { ok: false, detail: 'the helmd row is not declared exactly once' }
  }
  if (!deployed.includes('helmd online')) return { ok: false, detail: 'activation line missing — this is not luna persona' }
  return { ok: true, detail: `${deployedIds.length} rows (host standard + helmd)` }
}

/** Run the artifact assertion against the evaluated paths; unreadable inputs report no verdict. */
function artifactVerdict(health: HelmdHealth): string {
  try {
    const deployed = readFileSync(health.presetPath, 'utf8')
    const host = readFileSync(health.hostPath, 'utf8')
    const result = assertPresetArtifact(deployed, host)
    return result.ok ? `artifact check OK (${result.detail})` : `ARTIFACT CHECK FAILED: ${result.detail}`
  } catch {
    return 'artifact check skipped (files unreadable)'
  }
}

/**
 * Regenerate the deployed preset from the installed host standard. The caller has already
 * decided (via {@link shouldRepair}) that writing is allowed; this only performs it and
 * keeps the previous file as `.bak` first, matching scripts/setup-preset.ps1.
 */
function autoHealPreset(): { healed: boolean; verdict: string } {
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
    tools: JSON.stringify(readShelfTools()),
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
    // Same host standard: the deployed file should therefore be byte-equal to the preset
    // this package ships (both derive from that standard plus persona.txt). A difference
    // means the deployment is older than the package or was edited by hand — the case the
    // README's "content drift" badge is for, and otherwise invisible because the header
    // only tracks the HOST.
    if (!matchesBundledPreset(text)) {
      base.status = 'STALE'
      base.detail = 'deployed preset no longer matches the preset this package ships (persona or rows changed without re-sync); regenerate (repack / setup-preset, or HELMD_AUTO_HEAL=1 + restart)'
      return base
    }
    base.status = 'OK'
    // The structural half of MAINTENANCE §8 is cheap and worth stating on every boot: it is
    // the assertion that would have caught the 2026-08-26 crippled-catalog preset.
    base.detail = `preset matches installed dsh standard (${base.hostFingerprint}); ${artifactVerdict(base)}`
  } else {
    base.status = 'HOST_UPGRADED'
    base.detail = `preset targets dsh ${base.presetFingerprint} but the host now hashes ${base.hostFingerprint}; regenerate (repack / setup-preset, or HELMD_AUTO_HEAL=1 + restart)`
  }
  return base
}

/** Bundled generated preset that this package ships as its own mirror. */
function bundledPreset(): string | null {
  try {
    const p = fileURLToPath(new URL('../presets/agent.cordis.yml', import.meta.url))
    return existsSync(p) ? readFileSync(p, 'utf8') : null
  } catch {
    return null
  }
}

/**
 * Whether the deployed preset equals the shipped one.
 * Line endings are normalized: git may check the repo out with CRLF while the generator
 * writes LF, and that difference is not drift. An unreadable bundle reports no verdict.
 */
function matchesBundledPreset(deployed: string): boolean {
  const shipped = bundledPreset()
  if (shipped === null) return true
  const normalize = (s: string) => s.replace(/\r\n/g, '\n').trimEnd()
  return normalize(shipped) === normalize(deployed)
}

/**
 * Evaluate the deployed-preset fingerprint and, when it drifted, optionally regenerate it
 * from the installed host standard (`HELMD_AUTO_HEAL=1` opts in; default is report-only).
 * @returns the health verdict, with the auto-heal outcome folded in.
 */
export function evaluateHealth(): HelmdHealth {
  const first = evaluateHealthCore()
  if (!HEALABLE.has(first.status)) return first
  const policy = healPolicy()
  if (!shouldRepair(first.status, policy)) {
    first.autoHeal = reportOnlyVerdict(first.status, policy)
    return first
  }
  const outcome = autoHealPreset()
  if (!outcome.healed) {
    first.autoHeal = outcome.verdict
    return first
  }
  const healed = evaluateHealthCore()
  healed.autoHeal = `healed (${first.status} → ${healed.status}) — ${artifactVerdict(healed)}; ${outcome.verdict}`
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

  // tools 必须在列：api-routes 的 /api/helmd/tools 读 ctx.tools，cordis 的注入守卫
  // 会对未声明的服务抛 `cannot get property "tools" without inject`（路由处理器
  // 接住后对外表现为 HTTP 500）。
  ctx.inject(['webServer', 'tools'], (webCtx) => {
    try {
      registerHelmdApi(webCtx)
    } catch (e) {
      console.error(`[helmd-health] webServer route registration failed: ${String((e as Error)?.message ?? e)}`)
    }
  })
}
