// Operator settings for helm-d runtime features.
//
// One store, two editors: the DSH settings page edits the composition row's
// Config (applied at boot by the host row), and the workbench 设置 tab edits
// this file directly through /api/helmd/settings. Boot always merges the row
// config over the file, so the official settings form wins after a restart;
// the workbench wins for the running process.
//
// Every consumer reads through loadSettings() so a missing/corrupt file falls
// back to defaults instead of disabling the feature.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, normalize } from 'node:path'
import { TEAM_ROLES, type TeamRole } from './team.js'

export interface HelmdSettings {
  team: {
    /** begin_case 也自动开一个 team ticket。 */
    autoTicket: boolean
    defaultRoles: TeamRole[]
    /** 每 ticket 同时运行的 worker 上限。 */
    maxParallelWorkers: number
    /** 无 budget-policy artifact 时的默认 worker 超时（分钟）。 */
    defaultWallTimeMin: number
    /** dynamic worker 的高风险命令审批：ask | deny | allow（默认 ask）。 */
    riskApproval: 'ask' | 'deny' | 'allow'
    /** 审批队列超时秒数（1-3600；超时即拒）。 */
    approvalTimeoutSec: number
    /** 每角色工具 allow/deny（deny 优先；allow 非空时只放行列出的工具）。 */
    roleToolPolicy: Record<string, { allow?: string[]; deny?: string[] }>
  }
  intercept: {
    /** 流式拒绝拦截总开关（等价 HELMD_STREAM_MODE=off）。 */
    enabled: boolean
  }
  advisory: {
    /** case_status 是否附 [autonomy] 状态包。 */
    autonomyPacket: boolean
    /** 工具结果后的 L4-lite 下一步建议。 */
    nextActionNudge: boolean
    /** record_finding 前必须真实调用过 read_reference（防“假装读过文档”）。 */
    requireDocRead: boolean
    /** 引用证据至少一条来自真实工具捕获，save_evidence 自编文本不算。 */
    requireToolEvidence: boolean
  }
  star: {
    /** Star 弹窗延迟秒数。 */
    popupDelaySec: number
  }
  toolbox: {
    /** 允许模型通过 toolbox 工具安装 catalog 内的 release（默认仅 UI/操作者安装）。 */
    modelInstall: boolean
  }
}

export const DEFAULT_SETTINGS: HelmdSettings = {
  team: {
    autoTicket: false,
    defaultRoles: ['triage', 'static', 'critic', 'reporter'],
    maxParallelWorkers: 4,
    defaultWallTimeMin: 15,
    riskApproval: 'ask',
    approvalTimeoutSec: 300,
    roleToolPolicy: {},
  },
  intercept: { enabled: true },
  advisory: { autonomyPacket: true, nextActionNudge: true, requireDocRead: true, requireToolEvidence: true },
  star: { popupDelaySec: 2 },
  toolbox: { modelInstall: false },
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] }

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.trunc(n)))
}

function clampBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeSettings(raw: unknown): HelmdSettings {
  const src = (raw !== null && typeof raw === 'object' ? raw : {}) as Record<string, any>
  const team = (src.team !== null && typeof src.team === 'object' ? src.team : {}) as Record<string, any>
  const intercept = (src.intercept !== null && typeof src.intercept === 'object' ? src.intercept : {}) as Record<string, any>
  const advisory = (src.advisory !== null && typeof src.advisory === 'object' ? src.advisory : {}) as Record<string, any>
  const star = (src.star !== null && typeof src.star === 'object' ? src.star : {}) as Record<string, any>
  const roles = Array.isArray(team.defaultRoles)
    ? [...new Set(team.defaultRoles.map(String))].filter((role): role is TeamRole => (TEAM_ROLES as readonly string[]).includes(role))
    : []
  const roleToolPolicy: Record<string, { allow?: string[]; deny?: string[] }> = {}
  if (team.roleToolPolicy !== null && typeof team.roleToolPolicy === 'object') {
    for (const [role, raw] of Object.entries(team.roleToolPolicy as Record<string, unknown>)) {
      if (!(TEAM_ROLES as readonly string[]).includes(role) || raw === null || typeof raw !== 'object') continue
      const policy = raw as { allow?: unknown; deny?: unknown }
      const allow = Array.isArray(policy.allow) ? policy.allow.map(String).filter(Boolean) : undefined
      const deny = Array.isArray(policy.deny) ? policy.deny.map(String).filter(Boolean) : undefined
      if ((allow?.length ?? 0) > 0 || (deny?.length ?? 0) > 0) {
        roleToolPolicy[role] = {
          ...(allow !== undefined && allow.length > 0 ? { allow } : {}),
          ...(deny !== undefined && deny.length > 0 ? { deny } : {}),
        }
      }
    }
  }
  const riskApproval = team.riskApproval === 'deny' || team.riskApproval === 'allow' ? team.riskApproval : 'ask'
  const d = DEFAULT_SETTINGS
  return {
    team: {
      autoTicket: clampBool(team.autoTicket, d.team.autoTicket),
      defaultRoles: roles.length > 0 ? roles : [...d.team.defaultRoles],
      maxParallelWorkers: clampNumber(team.maxParallelWorkers, 1, 8, d.team.maxParallelWorkers),
      defaultWallTimeMin: clampNumber(team.defaultWallTimeMin, 1, 60, d.team.defaultWallTimeMin),
      riskApproval,
      approvalTimeoutSec: clampNumber(team.approvalTimeoutSec, 1, 3600, d.team.approvalTimeoutSec),
      roleToolPolicy,
    },
    intercept: { enabled: clampBool(intercept.enabled, d.intercept.enabled) },
    advisory: {
      autonomyPacket: clampBool(advisory.autonomyPacket, d.advisory.autonomyPacket),
      nextActionNudge: clampBool(advisory.nextActionNudge, d.advisory.nextActionNudge),
      requireDocRead: clampBool(advisory.requireDocRead, d.advisory.requireDocRead),
      requireToolEvidence: clampBool(advisory.requireToolEvidence, d.advisory.requireToolEvidence),
    },
    star: { popupDelaySec: clampNumber(star.popupDelaySec, 0, 60, d.star.popupDelaySec) },
    toolbox: { modelInstall: clampBool(src.toolbox?.modelInstall, d.toolbox.modelInstall) },
  }
}

/** $DSH_HOME/storages/helmd/settings.json */
export function settingsPath(): string {
  const home = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh')
  return normalize(join(home, 'storages', 'helmd', 'settings.json'))
}

export function loadSettings(): HelmdSettings {
  try {
    return normalizeSettings(JSON.parse(readFileSync(settingsPath(), 'utf8')))
  } catch {
    return structuredClone(DEFAULT_SETTINGS) as Mutable<HelmdSettings>
  }
}

/** Deep-merge a patch over the stored settings, clamp, and persist. */
export function saveSettings(patch: unknown): HelmdSettings {
  const current = loadSettings() as Mutable<HelmdSettings>
  const src = (patch !== null && typeof patch === 'object' ? patch : {}) as Record<string, any>
  const merged = {
    team: { ...current.team, ...(src.team !== null && typeof src.team === 'object' ? src.team : {}) },
    intercept: { ...current.intercept, ...(src.intercept !== null && typeof src.intercept === 'object' ? src.intercept : {}) },
    advisory: { ...current.advisory, ...(src.advisory !== null && typeof src.advisory === 'object' ? src.advisory : {}) },
    star: { ...current.star, ...(src.star !== null && typeof src.star === 'object' ? src.star : {}) },
  }
  const next = normalizeSettings(merged)
  try {
    const path = settingsPath()
    mkdirSync(dirname(path), { recursive: true })
    const temp = `${path}.${process.pid}.tmp`
    writeFileSync(temp, JSON.stringify(next, null, 2), 'utf8')
    renameSync(temp, path)
  } catch { /* read-only home: the merged value still governs this process */ }
  return next
}
