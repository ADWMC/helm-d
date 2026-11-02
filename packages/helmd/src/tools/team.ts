// Model-facing delegation for the local team protocol.
//
// The tool returns as soon as the child Agent is published; the child's final
// output is recorded as a ticket report in the background (team-worker.ts).
// This keeps independent roles concurrent without blocking the orchestrator's
// turn on each child.

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { sessionRole, TEAM_ROLES, type TeamRole } from '../team.js'
import { startTeamWorker } from '../team-worker.js'

interface ExecLike {
  agent?: unknown
  signal?: AbortSignal
}

export function registerTeamTools(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'team_dispatch',
    description:
      'Start one local role worker for a team ticket. The worker is a child DSH Agent in the same profile/workspace; ' +
      'its final output is recorded as a ticket report. Only the orchestrator may dispatch. ' +
      'Returns immediately so several independent roles can run concurrently.',
    parameters: {
      ticketId: { type: 'string', required: true, description: 'Ticket id from the team workbench, e.g. T-001.' },
      role: { type: 'string', required: true, description: `One of: ${TEAM_ROLES.join(', ')}.` },
      task: { type: 'string', description: 'Optional focused task for this worker; defaults to the ticket goal.' },
    },
    output: { schema: { type: 'string' }, render: (_args: unknown, value: string) => [{ type: 'text', text: value }] },
    isConcurrencySafe: () => true,
    async execute(
      args: { ticketId: string; role: string; task?: string },
      exec?: ExecLike,
    ) {
      const callerRole = sessionRole((exec?.agent as { id?: string } | undefined)?.id)
      if (callerRole !== undefined && callerRole !== 'orchestrator') {
        throw new Error(`role ${callerRole} cannot dispatch workers; hand the request back to the orchestrator`)
      }
      if (!TEAM_ROLES.includes(args.role as TeamRole)) throw new Error(`unknown team role: ${args.role}`)
      if (exec?.agent === undefined) throw new Error('team_dispatch requires a live calling agent')
      if (exec.signal === undefined) throw new Error('team_dispatch requires the tool cancellation signal')
      const started = await startTeamWorker({
        ctx,
        ticketId: args.ticketId,
        role: args.role as TeamRole,
        task: args.task,
        parentAgent: exec.agent,
        signal: exec.signal,
      })
      return [
        `worker started: ${started.role}`,
        `ticket: ${started.ticketId}`,
        `session: ${started.sessionId}`,
        'The result will appear as a ticket report; continue with independent work.',
      ].join('\n')
    },
  }))
}
