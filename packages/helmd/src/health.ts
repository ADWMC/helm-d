/**
 * Host-plane health surface for the helmd package.
 *
 * Evaluates the package-internal preset patch (`preset.generated.patch.yml`,
 * written by gen-preset.mjs and loaded through `dsh.bundle.patch`) against the
 * hash of the INSTALLED host's own `standard` preset patch, and serves the
 * verdict at `GET /api/helmd/health`.
 *
 * 0.1.7 moved presets from a deployed `.agent-presets/<name>/agent.cordis.yml`
 * to a composition row, so this package now carries its own preset artifact and
 * there is no deployment step to drift: drift here means the shipped artifact
 * was generated against a different host standard (HOST_UPGRADED) or no longer
 * satisfies the structural assertion (STALE).
 *
 * Evaluation runs once per process start — deliberately. The standing-mount
 * semantics mean a preset change is only safe after a harness restart
 * (incident 2026-08-26: generation replacement collides in the same preset
 * scope), so boot time is exactly the moment this verdict is true.
 *
 * The verdict is derived state, not configuration: 0.1.7's settings document
 * only carries Config schemas of profile entries, so the card reads the HTTP
 * route instead of a settings namespace. Agent tools are mounted by the preset
 * row; keeping this row on the host plane makes the health card available
 * without exposing helmd tools to other agents.
 */
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import { readShelfTools } from './ledger.js'
import { registerHelmdApi } from './api-routes.js'

/** Legacy settings namespace; now only the client health-card key. */
export const HELMD_HEALTH_NS = 'helmd'

const FINGERPRINT_RE = /^# gen-preset: host=([0-9a-f]{64})/m

/** Health verdict served to the settings card. All fields are plain strings. */
export interface HelmdHealth {
  /** OK | HOST_UPGRADED | STALE | LEGACY_PRESET | NOT_GENERATED | UNKNOWN */
  status: string
  /** Human-readable one-liner supporting the status. */
  detail: string
  /** sha256 of the installed host standard, first 12 hex chars ('' if unreadable). */
  hostFingerprint: string
  /** Fingerprint recorded inside the generated preset patch ('' if absent). */
  presetFingerprint: string
  /** Absolute path of this package's generated preset patch ('' if not found). */
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

/** Preset-patch tails per host generation, newest first (mirrors gen-preset.mjs). */
const HOST_STANDARD_TAILS: string[][] = [
  ['@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-web-app', 'presets', 'standard.patch.yml'],
  ['@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-agent-presets', 'presets', 'standard', 'agent.cordis.yml'],
  ['@deepseek-ai', 'dsh', 'config', 'agent-presets', 'standard', 'agent.cordis.yml'],
]

/**
 * Locate the installed dsh's shipped standard preset without spawning npm
 * (this runs on the session server). Same probe order as scripts/gen-preset.mjs.
 */
function locateHostStandard(): string | null {
  const env = process.env.DSH_HOST_STANDARD_YML
  if (env && existsSync(env)) return env
  const bases = [
    process.env.APPDATA ? join(process.env.APPDATA, 'npm', 'node_modules') : '',
    '/usr/local/lib/node_modules',
    '/usr/lib/node_modules',
  ]
  // The official installer puts dsh beside its own binary, so a PATH entry is a
  // candidate install prefix as well.
  const sep = process.platform === 'win32' ? ';' : ':'
  for (const raw of (process.env.PATH ?? '').split(sep)) {
    const dir = raw.replace(/[\\/]+$/, '')
    if (dir !== '') bases.push(join(dir, 'node_modules'), join(dir, 'lib', 'node_modules'))
  }
  for (const b of bases) {
    if (b === '') continue
    for (const tail of HOST_STANDARD_TAILS) {
      const c = join(b, ...tail)
      if (existsSync(c)) return c
    }
  }
  return null
}

/**
 * This package's generated preset patch — the artifact the host actually loads
 * through `dsh.bundle.patch`. `HELMD_PRESET_PATCH` redirects it for tests.
 */
function presetPatchPath(): string {
  const env = process.env.HELMD_PRESET_PATCH?.trim()
  if (env) return resolve(env)
  try {
    return fileURLToPath(new URL('../preset.generated.patch.yml', import.meta.url))
  } catch {
    return ''
  }
}

const HEALABLE = new Set(['HOST_UPGRADED', 'STALE', 'LEGACY_PRESET'])

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

/**
 * Top-level plugin-row ids of either preset shape (mirrors gen-preset.mjs):
 * ids directly under a `plugins:` list (0.1.7 — group children sit deeper and
 * are skipped), or column-0 `- id:` rows of a legacy agent.cordis.yml.
 */
function rowIds(text: string): string[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const pi = lines.findIndex((l) => /^\s*plugins:\s*$/.test(l))
  if (pi < 0) return [...text.matchAll(/^- id: (.+)$/gm)].map((m) => m[1].trim())
  const pIndent = lines[pi].length - lines[pi].trimStart().length
  const base = pIndent + 2
  const out: string[] = []
  for (let i = pi + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    const ind = line.length - line.trimStart().length
    if (ind <= pIndent) break
    if (ind !== base) continue
    const m = line.trimStart().match(/^-\s+id:\s*(.+)$/)
    if (m) out.push(m[1].trim())
  }
  return out
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
  if (!deployed.includes('- id: preset-helmd') || !deployed.includes('id: helmd')) {
    return { ok: false, detail: 'the preset entry is not retargeted at helmd (`- id: preset-helmd` / `id: helmd`)' }
  }
  if (!deployed.includes("'@deepseek-ai/dsh-agent-preset'")) {
    return { ok: false, detail: 'the entry does not declare @deepseek-ai/dsh-agent-preset' }
  }
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
 * Regenerate this package's preset patch from the installed host standard. The caller has
 * already decided (via {@link shouldRepair}) that writing is allowed; this only performs it
 * and keeps the previous file as `.bak` first.
 */
function autoHealPreset(): { healed: boolean; verdict: string } {
  const gen = resolveGenerator()
  if (gen === null) return { healed: false, verdict: 'unavailable (no generator)' }
  const target = presetPatchPath()
  if (target === '') return { healed: false, verdict: 'failed (preset patch path is unresolved)' }
  try {
    if (existsSync(target)) {
      try {
        copyFileSync(target, `${target}.bak`)
      } catch {
        // A failed backup must not block the repair; the exit status below still reports it.
      }
    }
    const res = spawnSync(process.execPath, [gen, '--out', target], {
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
  let hostHash = ''
  try {
    hostHash = createHash('sha256').update(readFileSync(hostPath, 'utf8'), 'utf8').digest('hex')
    base.hostFingerprint = hostHash.slice(0, 12)
  } catch {
    base.status = 'UNKNOWN'
    base.detail = `host standard at ${hostPath} is unreadable`
    return base
  }

  const presetPath = presetPatchPath()
  base.presetPath = presetPath
  if (presetPath === '' || !existsSync(presetPath)) {
    base.status = 'NOT_GENERATED'
    base.detail = `this package ships no generated preset patch (${presetPath || 'unresolved path'}); run node scripts/gen-preset.mjs or repack, then restart`
    return base
  }

  let text = ''
  try { text = readFileSync(presetPath, 'utf8') } catch {
    base.status = 'UNKNOWN'
    base.detail = `preset patch ${presetPath} is unreadable`
    return base
  }
  const m = text.match(FINGERPRINT_RE)
  if (!m) {
    base.presetFingerprint = ''
    base.status = 'LEGACY_PRESET'
    base.detail = 'preset patch carries no gen-preset fingerprint header, so it is not this generator\'s output; regenerate (repack / gen-preset), or set HELMD_AUTO_HEAL=1 to overwrite it (a .bak is kept)'
    return base
  }
  base.presetFingerprint = m[1].slice(0, 12)
  if (m[1] !== hostHash) {
    base.status = 'HOST_UPGRADED'
    base.detail = `preset patch targets dsh ${base.presetFingerprint} but the host now hashes ${base.hostFingerprint}; regenerate (repack / gen-preset), or HELMD_AUTO_HEAL=1 + restart`
    return base
  }
  // Same host standard, so the header says nothing more: the remaining question is
  // whether the artifact still satisfies the structural assertion. It can fail with
  // the header unmoved — a hand-edit, or a persona change that was never re-synced —
  // which is the drift the badge exists for.
  const artifact = artifactVerdict(base)
  if (!artifact.startsWith('artifact check OK')) {
    base.status = 'STALE'
    base.detail = `preset patch matches the host fingerprint ${base.hostFingerprint} but fails its structural assertion; ${artifact}; regenerate with repack / gen-preset, or HELMD_AUTO_HEAL=1 + restart`
    return base
  }
  base.status = 'OK'
  // The structural half of MAINTENANCE §8 is cheap and worth stating on every boot: it is
  // the assertion that would have caught the 2026-08-26 crippled-catalog preset.
  base.detail = `preset patch matches installed dsh standard (${base.hostFingerprint}); ${artifact}`
  return base
}

/**
 * Evaluate the preset patch fingerprint and, when it drifted, optionally regenerate it
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
 * Bundle row apply. Evaluates health once per boot and exposes it over HTTP.
 * @param ctx - the host composition context this row was plugged into.
 */
export function apply(ctx: Context): void {
  // tools 必须在列：api-routes 的 /api/helmd/tools 读 ctx.tools，cordis 的注入守卫
  // 会对未声明的服务抛 `cannot get property "tools" without inject`（路由处理器
  // 接住后对外表现为 HTTP 500）。
  ctx.inject(['webServer', 'tools'], (webCtx) => {
    try {
      // Once per boot — the standing-mount semantics make boot the only
      // moment this verdict is true (see module comment).
      const health = evaluateHealth()
      registerHelmdApi(webCtx, () => health)
    } catch (e) {
      console.error(`[helmd-health] webServer route registration failed: ${String((e as Error)?.message ?? e)}`)
    }
  })
}
