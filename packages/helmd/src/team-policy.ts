// Role guard for local workers. The host's spawn provider does not accept a
// per-child tool filter at start time, so the protocol enforces the two
// authority boundaries it can enforce without forking a preset:
//   - only an orchestrator may dispatch more workers;
//   - a worker may not open or close the parent case.
// Domain tools remain available to every role; the role prompt narrows intent.

import type { Context } from '@deepseek-ai/cordis'
import { sessionRole } from './team.js'

const ORCHESTRATOR_ONLY = new Set(['team_dispatch', 'begin_case', 'end_case'])

export function registerTeamPolicy(ctx: Context): void {
  const on = (ctx as unknown as { on?: (event: string, listener: (...args: any[]) => unknown) => unknown }).on
  if (typeof on !== 'function') return
  on.call(ctx, 'tools/pre-execute', async (exec: any, next: () => Promise<any>) => {
    const role = sessionRole(exec?.agent?.id)
    if (role !== undefined && role !== 'orchestrator' && ORCHESTRATOR_ONLY.has(String(exec?.name ?? ''))) {
      return { kind: 'deny', reason: `role ${role} may not call ${String(exec.name)}; ask the orchestrator` }
    }
    return next()
  })
}
