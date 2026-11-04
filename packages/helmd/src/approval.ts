// Local approval queue for high-risk worker commands (T-09).
//
// The plugin is fail-closed: a risky command is denied with an approval id, the
// operator approves/denies it in the workbench, and the worker retries. Pending
// approvals expire after `team.approvalTimeoutSec` (default 300s) and an expired
// entry can never be used.

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, normalize } from 'node:path'
import { loadSettings } from './settings.js'

export type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'expired' | 'used'

export interface Approval {
  id: string
  sessionId: string
  tool: string
  fingerprint: string
  summary: string
  status: ApprovalStatus
  createdAt: string
  expiresAt: string
  decidedAt?: string
}

interface ApprovalStore {
  approvals: Approval[]
}

function storePath(): string {
  const home = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh')
  return normalize(join(home, 'storages', 'helmd', 'approvals.json'))
}

function load(): ApprovalStore {
  try {
    const parsed = JSON.parse(readFileSync(storePath(), 'utf8')) as ApprovalStore
    return { approvals: Array.isArray(parsed.approvals) ? parsed.approvals : [] }
  } catch {
    return { approvals: [] }
  }
}

function save(store: ApprovalStore): void {
  const path = storePath()
  mkdirSync(dirname(path), { recursive: true })
  const temp = `${path}.${process.pid}.tmp`
  writeFileSync(temp, JSON.stringify(store, null, 2), 'utf8')
  renameSync(temp, path)
}

function fingerprint(sessionId: string, tool: string, args: unknown): string {
  return createHash('sha256').update(`${sessionId}\u0000${tool}\u0000${JSON.stringify(args)}`).digest('hex')
}

function prune(store: ApprovalStore): void {
  const now = Date.now()
  for (const approval of store.approvals) {
    if (approval.status === 'pending' && Date.parse(approval.expiresAt) <= now) approval.status = 'expired'
  }
}

export function listApprovals(includeDone = false): Approval[] {
  const store = load()
  prune(store)
  save(store)
  return store.approvals
    .filter((approval) => includeDone || approval.status === 'pending' || approval.status === 'approved')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** Request or consume an approval. Returns allowed=false with the pending entry
 *  when the operator has not approved this exact call yet. */
export function requestApproval(input: {
  sessionId: string
  tool: string
  args: unknown
  summary: string
}): { allowed: boolean; approval: Approval } {
  const store = load()
  prune(store)
  const fp = fingerprint(input.sessionId, input.tool, input.args)
  const now = new Date().toISOString()
  const approved = store.approvals.find((approval) =>
    approval.fingerprint === fp && approval.status === 'approved' && Date.parse(approval.expiresAt) > Date.now())
  if (approved !== undefined) {
    approved.status = 'used'
    approved.decidedAt = now
    save(store)
    return { allowed: true, approval: approved }
  }
  const pending = store.approvals.find((approval) =>
    approval.fingerprint === fp && approval.status === 'pending' && Date.parse(approval.expiresAt) > Date.now())
  if (pending !== undefined) return { allowed: false, approval: pending }
  const timeoutSec = loadSettings().team.approvalTimeoutSec
  const approval: Approval = {
    id: `A-${String(store.approvals.reduce((max, entry) => Math.max(max, Number(/^A-(\d+)$/.exec(entry.id)?.[1] ?? 0)), 0) + 1).padStart(3, '0')}`,
    sessionId: input.sessionId,
    tool: input.tool,
    fingerprint: fp,
    summary: input.summary.slice(0, 500),
    status: 'pending',
    createdAt: now,
    expiresAt: new Date(Date.now() + timeoutSec * 1000).toISOString(),
  }
  store.approvals.push(approval)
  save(store)
  return { allowed: false, approval }
}

export function decideApproval(id: string, decision: 'approved' | 'denied'): Approval {
  const store = load()
  prune(store)
  const approval = store.approvals.find((entry) => entry.id === id)
  if (approval === undefined) throw new Error(`unknown approval ${id}`)
  if (approval.status !== 'pending') throw new Error(`approval ${id} is ${approval.status}`)
  approval.status = decision
  approval.decidedAt = new Date().toISOString()
  save(store)
  return approval
}
