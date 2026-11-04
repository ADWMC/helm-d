// Role guard for local workers. The host's spawn provider does not accept a
// per-child tool filter at start time, so the protocol enforces the two
// authority boundaries it can enforce without forking a preset:
//   - only an orchestrator may dispatch more workers;
//   - a worker may not open or close the parent case.
// Domain tools remain available to every role; the role prompt narrows intent.

import type { Context } from '@deepseek-ai/cordis'
import { sessionRole } from './team.js'
import { loadSettings } from './settings.js'
import { requestApproval } from './approval.js'

const ORCHESTRATOR_ONLY = new Set(['team_dispatch', 'begin_case', 'end_case'])
const SHELL_TOOLS = new Set(['bash', 'shell', 'pwsh', 'powershell'])

/** Commands that need an explicit decision even inside the case workspace. */
const RISKY_COMMANDS: RegExp[] = [
  /\brm\s+-[a-z]*r/i,
  /\bdel\s+\/[fsq]/i,
  /\bformat\s+[a-z]:/i,
  /\bshutdown\b/i,
  /\breg\s+add\b/i,
  /\bsc\s+create\b/i,
  /\bnet\s+user\b/i,
  /\bwevtutil\s+cl\b/i,
  /\bsekurlsa\b|\bmimikatz\b|\bmeterpreter\b/i,
  /\b-v?\s*-enc(odedcommand)?\b/i,
  /\binvoke-expression\b|\biex\s*\(/i,
  /\bdownloadstring\b/i,
  /\bcurl[^\n]*\|\s*(ba)?sh\b/i,
  /\bbcdedit\b|\bvssadmin\s+delete\b/i,
  /\bschtasks\s+\/create\b/i,
]

function commandText(exec: any): string {
  const args = exec?.args ?? exec?.arguments
  if (typeof args === 'string') return args
  try { return JSON.stringify(args ?? '') } catch { return '' }
}

/** T-09: worker role boundaries + dynamic high-risk command approval. */
export function registerTeamPolicy(ctx: Context): void {
  const on = (ctx as unknown as { on?: (event: string, listener: (...args: any[]) => unknown) => unknown }).on
  if (typeof on !== 'function') return
  on.call(ctx, 'tools/pre-execute', async (exec: any, next: () => Promise<any>) => {
    const role = sessionRole(exec?.agent?.id)
    const name = String(exec?.name ?? '')
    if (role !== undefined && role !== 'orchestrator' && ORCHESTRATOR_ONLY.has(name)) {
      return { kind: 'deny', reason: `role ${role} may not call ${name}; ask the orchestrator` }
    }
    const policy = role === undefined ? undefined : loadSettings().team.roleToolPolicy[role]
    if (policy !== undefined) {
      if ((policy.deny ?? []).includes(name)) return { kind: 'deny', reason: `role ${role} tool policy denies ${name}` }
      if ((policy.allow ?? []).length > 0 && !(policy.allow ?? []).includes(name)) {
        return { kind: 'deny', reason: `role ${role} tool policy allows only: ${policy.allow?.join(', ')}` }
      }
    }
    if (role === 'dynamic' && SHELL_TOOLS.has(name)) {
      const text = commandText(exec)
      if (RISKY_COMMANDS.some((pattern) => pattern.test(text))) {
        const approval = loadSettings().team.riskApproval
        if (approval === 'deny') {
          return { kind: 'deny', reason: 'dynamic worker high-risk command denied by team.riskApproval=deny' }
        }
        if (approval === 'ask') {
          const pending = requestApproval({
            sessionId: String(exec?.agent?.id ?? ''),
            tool: name,
            args: exec?.args ?? exec?.arguments,
            summary: `${role}/${name}: ${text.slice(0, 300)}`,
          })
          if (pending.allowed) return next()
          return {
            kind: 'deny',
            reason: `approval required: ${pending.approval.id} is pending (expires ${pending.approval.expiresAt}). `
              + 'Approve it in the workbench approval queue, then retry the exact command.',
          }
        }
      }
    }
    return next()
  })
}

export { RISKY_COMMANDS }
