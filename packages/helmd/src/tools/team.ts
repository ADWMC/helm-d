// Model-facing tools for the local team protocol.
//
// The protocol layer (team.ts) holds the state; these four tools close the
// model-side loop: create a ticket, dispatch a role worker, read status, and
// file a report from inside a worker. Dispatch returns as soon as the child
// Agent is published (team-worker.ts records the result in the background), so
// independent roles stay concurrent without blocking the orchestrator's turn.

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import {
  createTicket, getTicket, listTickets, recordReport, recordSteer, sessionRole, TEAM_ROLES,
  type ReportState, type TeamRole,
} from '../team.js'
import { startTeamWorker, type TeamSubagentRuntime } from '../team-worker.js'
import { getCase } from '../case.js'

interface ExecLike {
  agent?: { id?: string; cwd?: string; workspace?: string; session?: { header?: { cwd?: string } } }
  signal?: AbortSignal
}

function isTeamRole(value: string): value is TeamRole {
  return (TEAM_ROLES as readonly string[]).includes(value)
}

/** Default ticket workspace: the session's bound case, else its cwd. */
function defaultCaseDir(exec?: ExecLike): string | undefined {
  const bound = getCase(exec?.agent?.id)
  if (bound?.dir) return bound.dir
  return exec?.agent?.session?.header?.cwd || exec?.agent?.cwd || exec?.agent?.workspace || undefined
}

const REPORT_STATES: ReportState[] = ['progress', 'ready', 'blocked', 'failed', 'dropped']

/** Compact text projection for the model; the workbench renders the full JSON. */
function renderTicket(ticket: NonNullable<ReturnType<typeof getTicket>>): string {
  const roles = ticket.roles
    .map((r) => {
      const deps = ticket.roleDeps?.[r.role] ?? []
      const unmet = deps.filter((dep) => ticket.roles.find((role) => role.role === dep)?.state !== 'done')
      const waits = unmet.length > 0 ? ` [waits: ${unmet.join(', ')}]` : ''
      return `- ${r.role}: ${r.state}${r.sessionId ? ` (${r.sessionId})` : ''}${waits}`
    })
    .join('\n')
  const lastByRole = new Map<string, string>()
  for (const report of ticket.reports) lastByRole.set(report.role, `[${report.state}] ${report.summary}`)
  const reports = [...lastByRole.entries()].map(([role, line]) => `- ${role}: ${line}`).join('\n')
  const tasks = (ticket.tasks ?? []).map((task) =>
    `- ${task.id} ${task.role} [${task.state}]${task.owner ? ` owner=${task.owner}` : ''}${task.leaseUntil ? ` lease=${task.leaseUntil}` : ''}${task.blockedBy.length > 0 ? ` blockedBy=${task.blockedBy.join(',')}` : ''}`,
  ).join('\n')
  const steers = (ticket.steers ?? []).slice(-3).map((steer) => `- ${steer.role}: ${steer.message.slice(0, 120)}`).join('\n')
  return [
    `ticket ${ticket.id} [${ticket.state}] ${ticket.goal}`,
    `case: ${ticket.caseDir}`,
    `roles:\n${roles || '(none)'}`,
    tasks !== '' ? `tasks:\n${tasks}` : '',
    reports !== '' ? `latest reports:\n${reports}` : 'latest reports: (none)',
    steers !== '' ? `recent steers:\n${steers}` : '',
    ticket.revision ? `pinned revisions: ${JSON.stringify(ticket.artifactRevisions)}` : '',
  ].filter((line) => line !== '').join('\n')
}

export function registerTeamTools(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'team_create',
    description:
      'Create a team ticket for local multi-agent analysis. Prefer this before team_dispatch: dispatch needs a ticketId. ' +
      'caseDir defaults to the session\'s active case (begin_case) or its workspace.',
    parameters: {
      goal: { type: 'string', required: true, description: 'What this team must deliver.' },
      roles: { type: 'array', items: { type: 'string' }, description: `Subset of: ${TEAM_ROLES.join(', ')}. Defaults to the configured default roles.` },
      roleDeps: { type: 'string', description: 'Role dependencies, format "role:dep1,dep2;role2:dep" — e.g. "critic:static,dynamic". A role starts only after its prerequisites are done.' },
      caseDir: { type: 'string', description: 'Ticket workspace directory; defaults to the active case or session cwd.' },
      budgetMinutes: { type: 'number', description: 'Per-worker wall-time budget in minutes (1-60); workers report blocked when exhausted.' },
      maxToolCalls: { type: 'number', description: 'Advisory tool-call budget for workers; recorded on the ticket.' },
    },
    output: { schema: { type: 'string' }, render: (_args: unknown, value: string) => [{ type: 'text', text: value }] },
    async execute(args: { goal: string; roles?: string[]; roleDeps?: string; caseDir?: string; budgetMinutes?: number; maxToolCalls?: number }, exec?: ExecLike) {
      const caseDir = args.caseDir?.trim() || defaultCaseDir(exec)
      if (caseDir === undefined || caseDir === '') {
        throw new Error('no caseDir: bind a case with begin_case or pass caseDir explicitly')
      }
      const roles = (args.roles ?? []).map(String).filter(isTeamRole) as TeamRole[] | []
      // Deps come as "critic:static,dynamic;reporter:critic" — free-form JSON
      // object parameters are not part of the tool schema subset the registry accepts.
      const roleDeps: Partial<Record<TeamRole, TeamRole[]>> = {}
      for (const pair of (args.roleDeps ?? '').split(';')) {
        const [role, deps] = pair.split(':').map((part) => part.trim())
        if (role === undefined || deps === undefined) continue
        if (!isTeamRole(role)) continue
        const valid = deps.split(',').map((dep) => dep.trim()).filter(isTeamRole) as TeamRole[]
        if (valid.length > 0) roleDeps[role] = valid
      }
      const ticket = createTicket({
        goal: args.goal,
        caseDir,
        roles: roles.length > 0 ? roles : undefined,
        roleDeps: Object.keys(roleDeps).length > 0 ? roleDeps : undefined,
        ...(args.budgetMinutes !== undefined || args.maxToolCalls !== undefined
          ? {
            budget: {
              ...(args.budgetMinutes !== undefined ? { wallTimeMs: Math.max(1, Math.min(60, Math.round(args.budgetMinutes))) * 60_000 } : {}),
              ...(args.maxToolCalls !== undefined ? { maxToolCalls: Math.max(1, Math.round(args.maxToolCalls)) } : {}),
            },
          }
          : {}),
      })
      return [
        `ticket created: ${ticket.id}`,
        `goal: ${ticket.goal}`,
        `case: ${ticket.caseDir}`,
        `roles: ${ticket.roles.map((r) => r.role).join(', ')}`,
        'Dispatch roles with team_dispatch(ticketId, role, task).',
      ].join('\n')
    },
  }))

  ctx.tools.register(defineTool({
    name: 'team_status',
    description:
      'Read team ticket state: role assignments, latest report per role, pinned artifact revisions. ' +
      'Omit ticketId to list the most recent tickets.',
    parameters: {
      ticketId: { type: 'string', description: 'Ticket id, e.g. T-001. Omit to list recent tickets.' },
    },
    output: { schema: { type: 'string' }, render: (_args: unknown, value: string) => [{ type: 'text', text: value }] },
    async execute(args: { ticketId?: string }) {
      if (args.ticketId !== undefined && args.ticketId.trim() !== '') {
        const ticket = getTicket(args.ticketId.trim())
        if (ticket === undefined) throw new Error(`unknown ticket ${args.ticketId}`)
        return renderTicket(ticket)
      }
      const tickets = listTickets().slice(0, 5)
      if (tickets.length === 0) return 'no team tickets yet; create one with team_create(goal)'
      return ['recent tickets (newest first):', ...tickets.map(renderTicket)].join('\n\n')
    },
  }))

  ctx.tools.register(defineTool({
    name: 'team_report',
    description:
      'File a report on a team ticket for one of its roles. Workers should call this for interim results or when blocked; ' +
      'the final child output is recorded automatically, so a final JSON summary in the last message is enough.',
    parameters: {
      ticketId: { type: 'string', required: true, description: 'Ticket id.' },
      role: { type: 'string', required: true, description: `One of: ${TEAM_ROLES.join(', ')}; must be part of the ticket.` },
      state: { type: 'string', required: true, description: 'progress | ready | blocked | failed | dropped' },
      summary: { type: 'string', required: true, description: 'What was done / found / blocked. Cite evidence ids inline.' },
      evidenceIds: { type: 'array', items: { type: 'string' }, description: 'Evidence ids backing the report, e.g. ["E-001"].' },
      repro: { type: 'string', description: 'Reproduction command when the report claims a finding.' },
    },
    output: { schema: { type: 'string' }, render: (_args: unknown, value: string) => [{ type: 'text', text: value }] },
    async execute(
      args: { ticketId: string; role: string; state: string; summary: string; evidenceIds?: string[]; repro?: string },
      exec?: ExecLike,
    ) {
      if (!isTeamRole(args.role)) throw new Error(`unknown team role: ${args.role}`)
      const state = args.state as ReportState
      if (!REPORT_STATES.includes(state)) {
        throw new Error(`state must be one of: ${REPORT_STATES.join(' | ')}`)
      }
      const callerRole = sessionRole(exec?.agent?.id)
      if (callerRole !== undefined && callerRole !== args.role) {
        throw new Error(`session is assigned role ${callerRole}; it cannot report as ${args.role}`)
      }
      const updated = recordReport({
        ticketId: args.ticketId,
        role: args.role,
        state,
        summary: args.summary,
        evidenceIds: args.evidenceIds,
        repro: args.repro,
        source: 'manual',
      })
      return `report recorded on ${updated.id} as ${args.role}/${state} (ticket now ${updated.state})`
    },
  }))

  ctx.tools.register(defineTool({
    name: 'team_steer',
    description:
      'Steer a running role worker at its nearest step boundary. Only the orchestrator may steer; the message is ' +
      'recorded on the ticket and delivered through the host subagent manager. Use it to narrow scope or stop a bad path.',
    parameters: {
      ticketId: { type: 'string', required: true, description: 'Ticket id.' },
      role: { type: 'string', required: true, description: `Running role: ${TEAM_ROLES.join(', ')}.` },
      message: { type: 'string', required: true, description: 'Instruction for the worker, e.g. "只做静态分析，然后 blocked 汇报".' },
    },
    output: { schema: { type: 'string' }, render: (_args: unknown, value: string) => [{ type: 'text', text: value }] },
    async execute(args: { ticketId: string; role: string; message: string }, exec?: ExecLike) {
      const callerRole = sessionRole(exec?.agent?.id)
      if (callerRole !== undefined && callerRole !== 'orchestrator') {
        throw new Error(`role ${callerRole} cannot steer workers; hand the request back to the orchestrator`)
      }
      if (!isTeamRole(args.role)) throw new Error(`unknown team role: ${args.role}`)
      if (exec?.agent === undefined) throw new Error('team_steer requires a live calling agent')
      if (exec.signal === undefined) throw new Error('team_steer requires the tool cancellation signal')
      const ticket = getTicket(args.ticketId)
      if (ticket === undefined) throw new Error(`unknown ticket ${args.ticketId}`)
      const assignment = ticket.roles.find((item) => item.role === args.role)
      if (assignment === undefined) throw new Error(`role ${args.role} is not part of ticket ${ticket.id}`)
      if (assignment.state !== 'running' || assignment.sessionId === undefined) {
        throw new Error(`role ${args.role} is not running (state=${assignment.state}); nothing to steer`)
      }
      let subagents: TeamSubagentRuntime | undefined
      try {
        subagents = (ctx as unknown as { get?: (name: string) => TeamSubagentRuntime | undefined }).get?.('subagents')
      } catch { /* host without subagent seam */ }
      if (subagents?.steerPrompt === undefined) {
        throw new Error('host subagent manager does not expose steerPrompt; cannot steer a running worker')
      }
      await subagents.steerPrompt(
        exec.agent,
        assignment.sessionId,
        [{ type: 'text', text: `[helm-d steer ${ticket.id}/${args.role}] ${args.message.trim()}` }],
        { kind: 'user' },
        exec.signal,
      )
      const steer = recordSteer(ticket.id, args.role, args.message)
      return `steer accepted: ${steer.id} → ${args.role} (${assignment.sessionId})`
    },
  }))

  ctx.tools.register(defineTool({
    name: 'team_dispatch',
    description:
      'Start one local role worker for a team ticket created via team_create. The worker is a child DSH Agent in the same ' +
      'profile/workspace; its final output is recorded as a ticket report. Only the orchestrator may dispatch. ' +
      'Returns immediately so several independent roles can run concurrently.',
    parameters: {
      ticketId: { type: 'string', required: true, description: 'Ticket id from team_create, e.g. T-001.' },
      role: { type: 'string', required: true, description: `One of: ${TEAM_ROLES.join(', ')}.` },
      task: { type: 'string', description: 'Optional focused task for this worker; defaults to the ticket goal.' },
    },
    output: { schema: { type: 'string' }, render: (_args: unknown, value: string) => [{ type: 'text', text: value }] },
    isConcurrencySafe: () => true,
    async execute(
      args: { ticketId: string; role: string; task?: string },
      exec?: ExecLike,
    ) {
      const callerRole = sessionRole(exec?.agent?.id)
      if (callerRole !== undefined && callerRole !== 'orchestrator') {
        throw new Error(`role ${callerRole} cannot dispatch workers; hand the request back to the orchestrator`)
      }
      if (!isTeamRole(args.role)) throw new Error(`unknown team role: ${args.role}`)
      if (exec?.agent === undefined) throw new Error('team_dispatch requires a live calling agent')
      if (exec.signal === undefined) throw new Error('team_dispatch requires the tool cancellation signal')
      const started = await startTeamWorker({
        ctx,
        ticketId: args.ticketId,
        role: args.role,
        task: args.task,
        parentAgent: exec.agent,
        signal: exec.signal,
      })
      return [
        `worker started: ${started.role}`,
        `ticket: ${started.ticketId}`,
        `session: ${started.sessionId}`,
        'Check team_status for progress; the result also lands as a ticket report.',
      ].join('\n')
    },
  }))
}
