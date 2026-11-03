// Local multi-agent collaboration and auditable evolution.
//
// This module is the protocol/state layer only: it records tickets, role
// assignments, reports and handoffs, and stores versioned team artifacts with
// an eval gate. Worker session spawning, sandboxing and benchmark execution are
// separate adapters so the protocol stays testable without a DSH host.

import { closeSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, normalize } from 'node:path'
import { loadSettings } from './settings.js'

export const TEAM_ROLES = ['orchestrator', 'triage', 'static', 'dynamic', 'decoy-audit', 'critic', 'reporter'] as const
export type TeamRole = (typeof TEAM_ROLES)[number]

export type TicketState = 'open' | 'working' | 'review' | 'blocked' | 'done' | 'dropped'
export type ReportState = 'progress' | 'ready' | 'blocked' | 'failed' | 'dropped'

export interface TeamReport {
  id: string
  role: TeamRole
  state: ReportState
  summary: string
  evidenceIds: string[]
  repro?: string
  budget?: number
  tokens?: number
  wallTimeMs?: number
  source?: 'worker' | 'manual'
  stopReason?: string
  at: string
}

export interface TeamHandoff {
  id: string
  from: TeamRole
  to: TeamRole
  question: string
  at: string
}

export interface RoleAssignment {
  role: TeamRole
  sessionId?: string
  state: 'idle' | 'running' | 'done'
  startedAt?: string
  endedAt?: string
}

export interface TeamTicket {
  id: string
  goal: string
  caseDir: string
  state: TicketState
  revision: number
  /** Active artifact revisions captured when the first worker starts. */
  artifactRevisions: Record<string, number>
  /** Role dependencies: a role may only start once every listed role is done. */
  roleDeps?: Partial<Record<TeamRole, TeamRole[]>>
  roles: RoleAssignment[]
  reports: TeamReport[]
  handoffs: TeamHandoff[]
  createdAt: string
  updatedAt: string
}

export interface TeamState {
  tickets: TeamTicket[]
}

export type ArtifactKind = 'role-prompt' | 'playbook' | 'skill' | 'model-profile' | 'budget-policy' | 'tool-policy'

export interface EvalResult {
  baseline: Record<string, number>
  candidate: Record<string, number>
  pass: boolean
  reasons: string[]
  at: string
}

export interface ArtifactRevision {
  kind: ArtifactKind
  id: string
  revision: number
  parent: number
  value: string
  source: string
  at: string
  eval?: EvalResult
}

export interface TeamVersions {
  artifacts: ArtifactRevision[]
  active: Record<string, number>
}

const DEFAULT_ROLES: TeamRole[] = ['triage', 'static', 'critic', 'reporter']

/** Ticket defaults follow the operator's settings (workbench 设置 tab / DSH
 *  settings page); the hardcoded set is only the fallback when settings are
 *  unreadable or the stored role list is empty. */
function configuredDefaultRoles(): TeamRole[] {
  try {
    const roles = loadSettings().team.defaultRoles
    const valid = roles.filter((role) => TEAM_ROLES.includes(role))
    if (valid.length > 0) return valid
  } catch { /* fall back to the built-in set */ }
  return DEFAULT_ROLES
}
const HIGHER_IS_BETTER = ['correctness', 'evidence', 'canaryResistance', 'blockedHonesty'] as const
const LOWER_IS_BETTER = ['tokens', 'wallTime'] as const

/** $DSH_HOME/storages/helmd/team */
function teamDir(): string {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return normalize(join(home, 'storages', 'helmd', 'team'))
}

function statePath(): string {
  return join(teamDir(), 'state.json')
}

function versionsPath(): string {
  return join(teamDir(), 'versions.json')
}

let lockDepth = 0
const sleepCell = new Int32Array(new SharedArrayBuffer(4))

/** Serialize read-modify-write across worker sessions in this process and
 *  across host processes. Writes are small and short-lived, so a synchronous
 *  lock file is cheaper than a second persistence format. */
function withStoreLock<T>(fn: () => T): T {
  if (lockDepth > 0) return fn()
  mkdirSync(teamDir(), { recursive: true })
  const lock = join(teamDir(), 'state.lock')
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      const fd = openSync(lock, 'wx')
      lockDepth += 1
      try {
        return fn()
      } finally {
        lockDepth -= 1
        closeSync(fd)
        try { unlinkSync(lock) } catch { /* already removed */ }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      Atomics.wait(sleepCell, 0, 0, 10)
    }
  }
  throw new Error('team state is locked by another process; retry')
}

function readJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch {
    return fallback
  }
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  const temp = `${path}.${process.pid}.tmp`
  writeFileSync(temp, JSON.stringify(value, null, 2), 'utf8')
  renameSync(temp, path)
}

function now(): string {
  return new Date().toISOString()
}

function nextId(prefix: string, existing: readonly { id: string }[]): string {
  const max = existing.reduce((best, item) => {
    const match = new RegExp(`^${prefix}-(\\d+)$`).exec(item.id)
    return match ? Math.max(best, Number(match[1])) : best
  }, 0)
  return `${prefix}-${String(max + 1).padStart(3, '0')}`
}

function loadState(): TeamState {
  const state = readJson<TeamState>(statePath(), { tickets: [] })
  const tickets = Array.isArray(state.tickets) ? state.tickets : []
  return {
    tickets: tickets.map((ticket) => ({
      ...ticket,
      artifactRevisions: ticket.artifactRevisions && typeof ticket.artifactRevisions === 'object'
        ? ticket.artifactRevisions
        : {},
      roleDeps: ticket.roleDeps && typeof ticket.roleDeps === 'object'
        ? ticket.roleDeps
        : undefined,
    })),
  }
}

function saveState(state: TeamState): void {
  writeJson(statePath(), state)
}

export function listTickets(): TeamTicket[] {
  return loadState().tickets.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getTicket(id: string): TeamTicket | undefined {
  return loadState().tickets.find((ticket) => ticket.id === id)
}

function updateTicket(id: string, mutate: (ticket: TeamTicket) => void): TeamTicket {
  return withStoreLock(() => {
    const state = loadState()
    const ticket = state.tickets.find((item) => item.id === id)
    if (ticket === undefined) throw new Error(`unknown ticket ${id}`)
    mutate(ticket)
    ticket.updatedAt = now()
    saveState(state)
    return ticket
  })
}

/** Resolve the role a worker session was assigned to. Used by the tool-policy
 *  guard so a child cannot start more children or close the parent case. */
export function sessionRole(sessionId?: string): TeamRole | undefined {
  if (sessionId === undefined || sessionId === '') return undefined
  for (const ticket of loadState().tickets) {
    const assignment = ticket.roles.find((role) => role.sessionId === sessionId)
    if (assignment !== undefined) return assignment.role
  }
  return undefined
}

/** Freeze the active artifact revisions into the ticket at first dispatch. */
export function pinArtifactRevisions(ticketId: string, revisions: Record<string, number>): TeamTicket {
  return updateTicket(ticketId, (ticket) => {
    if (Object.keys(ticket.artifactRevisions).length === 0) ticket.artifactRevisions = { ...revisions }
  })
}

export function createTicket(input: {
  goal: string
  caseDir: string
  roles?: TeamRole[]
  revision?: number
  artifactRevisions?: Record<string, number>
  roleDeps?: Partial<Record<TeamRole, TeamRole[]>>
}): TeamTicket {
  const goal = input.goal.trim()
  const caseDir = input.caseDir.trim()
  if (goal === '') throw new Error('goal is required')
  if (caseDir === '') throw new Error('caseDir is required')
  return withStoreLock(() => {
    const state = loadState()
    const roles = (input.roles && input.roles.length > 0 ? input.roles : configuredDefaultRoles())
    const unique = [...new Set(roles)].filter((role) => TEAM_ROLES.includes(role))
    if (unique.length === 0) throw new Error('at least one valid role is required')
    const ticket: TeamTicket = {
      id: nextId('T', state.tickets),
      goal,
      caseDir,
      state: 'open',
      revision: input.revision ?? 0,
      artifactRevisions: { ...(input.artifactRevisions ?? {}) },
      ...(input.roleDeps !== undefined ? { roleDeps: input.roleDeps } : {}),
      roles: unique.map((role) => ({ role, state: 'idle' })),
      reports: [],
      handoffs: [],
      createdAt: now(),
      updatedAt: now(),
    }
    state.tickets.push(ticket)
    saveState(state)
    return ticket
  })
}

export function assignRole(ticketId: string, role: TeamRole, sessionId: string): TeamTicket {
  const session = sessionId.trim()
  if (session === '') throw new Error('sessionId is required')
  return updateTicket(ticketId, (ticket) => {
    const assignment = ticket.roles.find((item) => item.role === role)
    if (assignment === undefined) throw new Error(`role ${role} is not part of ticket ${ticketId}`)
    assignment.sessionId = session
    assignment.state = 'running'
    assignment.startedAt ??= now()
    if (ticket.state === 'open') ticket.state = 'working'
  })
}

export function recordReport(input: {
  ticketId: string
  role: TeamRole
  state: ReportState
  summary: string
  evidenceIds?: string[]
  repro?: string
  budget?: number
  tokens?: number
  wallTimeMs?: number
  source?: 'worker' | 'manual'
  stopReason?: string
}): TeamTicket {
  const summary = input.summary.trim()
  if (summary === '') throw new Error('summary is required')
  return updateTicket(input.ticketId, (ticket) => {
    const assignment = ticket.roles.find((item) => item.role === input.role)
    if (assignment === undefined) throw new Error(`role ${input.role} is not part of ticket ${input.ticketId}`)
    const report: TeamReport = {
      id: nextId('R', ticket.reports),
      role: input.role,
      state: input.state,
      summary,
      evidenceIds: [...new Set(input.evidenceIds ?? [])],
      ...(input.repro !== undefined && input.repro.trim() !== '' ? { repro: input.repro.trim() } : {}),
      ...(input.budget !== undefined ? { budget: input.budget } : {}),
      ...(input.tokens !== undefined ? { tokens: input.tokens } : {}),
      ...(input.wallTimeMs !== undefined ? { wallTimeMs: input.wallTimeMs } : {}),
      ...(input.source !== undefined ? { source: input.source } : {}),
      ...(input.stopReason !== undefined ? { stopReason: input.stopReason } : {}),
      at: now(),
    }
    ticket.reports.push(report)
    if (input.state === 'blocked' || input.state === 'failed') ticket.state = 'blocked'
    else if (input.state === 'dropped') ticket.state = 'dropped'
    else if (input.state === 'ready' && input.role === 'reporter') ticket.state = 'review'
    else if (ticket.state === 'open') ticket.state = 'working'
    if (input.state === 'ready' || input.state === 'dropped' || input.state === 'failed') {
      assignment.state = 'done'
      assignment.endedAt = now()
    }
  })
}

export function recordHandoff(input: { ticketId: string; from: TeamRole; to: TeamRole; question: string }): TeamTicket {
  const question = input.question.trim()
  if (question === '') throw new Error('question is required')
  return updateTicket(input.ticketId, (ticket) => {
    if (!ticket.roles.some((item) => item.role === input.from)) throw new Error(`role ${input.from} is not part of ticket ${input.ticketId}`)
    if (!ticket.roles.some((item) => item.role === input.to)) throw new Error(`role ${input.to} is not part of ticket ${input.ticketId}`)
    ticket.handoffs.push({ id: nextId('H', ticket.handoffs), from: input.from, to: input.to, question, at: now() })
    ticket.state = 'blocked'
  })
}

export function closeTicket(ticketId: string, outcome: 'done' | 'dropped'): TeamTicket {
  return updateTicket(ticketId, (ticket) => { ticket.state = outcome })
}

function loadVersions(): TeamVersions {
  const versions = readJson<TeamVersions>(versionsPath(), { artifacts: [], active: {} })
  return {
    artifacts: Array.isArray(versions.artifacts) ? versions.artifacts : [],
    active: versions.active && typeof versions.active === 'object' ? versions.active : {},
  }
}

function saveVersions(versions: TeamVersions): void {
  writeJson(versionsPath(), versions)
}

function artifactKey(kind: ArtifactKind, id: string): string {
  return `${kind}:${id}`
}

export function listRevisions(kind?: ArtifactKind, id?: string): ArtifactRevision[] {
  return loadVersions().artifacts
    .filter((item) => (kind === undefined || item.kind === kind) && (id === undefined || item.id === id))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id) || a.revision - b.revision)
}

export function activeRevision(kind: ArtifactKind, id: string): ArtifactRevision | undefined {
  const versions = loadVersions()
  const revision = versions.active[artifactKey(kind, id)]
  return revision === undefined ? undefined : versions.artifacts.find((item) => item.kind === kind && item.id === id && item.revision === revision)
}

export function proposeRevision(input: { kind: ArtifactKind; id: string; value: string; source: string }): ArtifactRevision {
  if (input.id.trim() === '') throw new Error('artifact id is required')
  if (input.value.trim() === '') throw new Error('artifact value is required')
  return withStoreLock(() => {
    const versions = loadVersions()
    const key = artifactKey(input.kind, input.id)
    const existing = versions.artifacts.filter((item) => item.kind === input.kind && item.id === input.id)
    const revision = existing.reduce((best, item) => Math.max(best, item.revision), 0) + 1
    const artifact: ArtifactRevision = {
      kind: input.kind,
      id: input.id,
      revision,
      parent: versions.active[key] ?? 0,
      value: input.value,
      source: input.source,
      at: now(),
    }
    versions.artifacts.push(artifact)
    saveVersions(versions)
    return artifact
  })
}

/** Gate: higher-is-better metrics may not regress, lower-is-better may not grow
 *  by more than 10%, and at least one metric must improve. */
export function canActivate(baseline: Record<string, number>, candidate: Record<string, number>): { pass: boolean; reasons: string[] } {
  const reasons: string[] = []
  for (const key of HIGHER_IS_BETTER) {
    if (candidate[key] === undefined) { reasons.push(`missing metric ${key}`); continue }
    if (candidate[key]! < (baseline[key] ?? 0)) reasons.push(`${key} regressed`)
  }
  for (const key of LOWER_IS_BETTER) {
    if (candidate[key] === undefined) continue
    const before = baseline[key] ?? 0
    if (before > 0 && candidate[key]! > before * 1.1) reasons.push(`${key} grew >10%`)
  }
  const improved = [...HIGHER_IS_BETTER, ...LOWER_IS_BETTER].some((key) => {
    if (candidate[key] === undefined || baseline[key] === undefined) return false
    return LOWER_IS_BETTER.includes(key as (typeof LOWER_IS_BETTER)[number])
      ? candidate[key]! < baseline[key]!
      : candidate[key]! > baseline[key]!
  })
  if (!improved) reasons.push('no metric improved')
  return { pass: reasons.length === 0, reasons }
}

export function evaluateRevision(input: {
  kind: ArtifactKind
  id: string
  revision: number
  baseline: Record<string, number>
  candidate: Record<string, number>
}): ArtifactRevision {
  return withStoreLock(() => {
    const versions = loadVersions()
    const artifact = versions.artifacts.find((item) => item.kind === input.kind && item.id === input.id && item.revision === input.revision)
    if (artifact === undefined) throw new Error(`unknown revision ${input.kind}:${input.id}@${input.revision}`)
    const gate = canActivate(input.baseline, input.candidate)
    artifact.eval = { baseline: input.baseline, candidate: input.candidate, pass: gate.pass, reasons: gate.reasons, at: now() }
    saveVersions(versions)
    return artifact
  })
}

export function activateRevision(kind: ArtifactKind, id: string, revision: number): ArtifactRevision {
  return withStoreLock(() => {
    const versions = loadVersions()
    const artifact = versions.artifacts.find((item) => item.kind === kind && item.id === id && item.revision === revision)
    if (artifact === undefined) throw new Error(`unknown revision ${kind}:${id}@${revision}`)
    if (artifact.eval === undefined || !artifact.eval.pass) throw new Error('revision has not passed its eval gate')
    versions.active[artifactKey(kind, id)] = revision
    saveVersions(versions)
    return artifact
  })
}

export function rollbackRevision(kind: ArtifactKind, id: string): ArtifactRevision {
  return withStoreLock(() => {
    const versions = loadVersions()
    const key = artifactKey(kind, id)
    const current = versions.active[key]
    if (current === undefined) throw new Error(`no active revision for ${key}`)
    const artifact = versions.artifacts.find((item) => item.kind === kind && item.id === id && item.revision === current)
    if (artifact === undefined || artifact.parent === 0) throw new Error(`no previous revision for ${key}`)
    const previous = versions.artifacts.find((item) => item.kind === kind && item.id === id && item.revision === artifact.parent)
    if (previous === undefined) throw new Error(`previous revision ${artifact.parent} is missing`)
    versions.active[key] = previous.revision
    saveVersions(versions)
    return previous
  })
}

export function teamStatus(): { tickets: TeamTicket[]; artifacts: ArtifactRevision[]; active: Record<string, number> } {
  const versions = loadVersions()
  return { tickets: listTickets(), artifacts: versions.artifacts, active: versions.active }
}
