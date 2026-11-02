// Per-turn case context. The case tools bind a case to an agent/session, but
// that binding is invisible to the model unless it calls case_status(); after
// compaction or a restart it would happily start a fresh case. This section
// makes the bound case part of every assembly: name, goal, workspace, mode and
// the two rules that keep a case from being duplicated or closed blindly.
import type { Context } from '@deepseek-ai/cordis'
import { agentSessionId, registerAssemblyListener, type AssemblyLike, type AssembleContextLike } from './prompt-assembly.js'
import { getCase, type CaseInfo } from './case.js'

export const CASE_SECTION = 'helm-d:case'

export function renderCaseContext(info: CaseInfo): string {
  return [
    '[helm-d case]',
    `Active case: ${info.name}`,
    `Goal: ${info.goal}`,
    `Workspace: ${info.dir}`,
    `Mode: ${info.mode}`,
    'This session is already bound to this case. Call case_status() for the current hypotheses, findings and evidence.',
    'Do not open a new case until end_case(summary) closes this one; record_finding requires a repro_cmd.',
  ].join('\n')
}

export function registerCaseContext(ctx: Context): void {
  registerAssemblyListener(ctx, {
    after(assembled: AssemblyLike, context: AssembleContextLike) {
      const sessionId = agentSessionId(context)
      if (!sessionId) return assembled
      const active = getCase(sessionId)
      if (!active) return assembled
      try {
        const sections = Array.isArray(assembled.sections) ? assembled.sections : []
        const without = sections.filter((section) => (section as { name?: unknown } | null)?.name !== CASE_SECTION)
        return {
          ...assembled,
          sections: [...without, { name: CASE_SECTION, text: renderCaseContext(active) }],
        }
      } catch {
        return assembled
      }
    },
  })
}
