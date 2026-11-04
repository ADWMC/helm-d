// Orchestrator contract for the local team. The host's native team tools and
// our ticket tools are both mounted for helmd sessions; without a written
// contract the model defaults to polling or doing everything itself, which is
// exactly the failure mode "autonomy" is supposed to remove.

import type { Context } from '@deepseek-ai/cordis'

export const TEAM_LOOP_CONTEXT = 'helmd:team-loop'

const TEAM_LOOP_TEXT = [
  '[helm-d team loop]',
  '- Event-driven: worker reports and teammate messages arrive on their own as messages. Never wait with sleep, polling or repeated status calls; when nothing is pending, end the turn — a finished worker wakes you.',
  '- Two rails: `spawn_teammate` / `send_message` / `wait_agent` / `team_task_*` are the host-native team (named continuable teammates, durable mailbox, shared task DAG) for standing collaboration; `team_create` / `team_dispatch` / `team_status` / `team_report` are the helmd ticket rail for case-bound one-shot workers with evidence ids and pinned artifact revisions. Pick per job; do not duplicate the same work on both.',
  '- Orchestrator discipline: dispatch workers — do not do their analysis yourself, and never reimplement plugin internals, fake runtimes or hand-driven tool definitions to substitute for a missing tool; report the gap instead. After a worker wakes you, verify via one `team_status`, then advance the dependency chain.',
  '- Hold workers to the evidence contract: their claims must cite E-ids from the case ledger and follow the route_task → read_reference → evidence order; a report without evidence ids or with invented repro is rejected, not merged. Findings carry severity/status; critical/high without two evidence ids is downgraded by the register, so ask for the missing proof instead of asserting it.',
  '- Evidence discipline is unchanged: every factual claim cites E-ids from the case ledger; workers never call begin_case/end_case/team_dispatch.',
  '- Respect role dependencies (a role refuses to start until its prerequisites are done). Blocked work must be reported: team_report(state=blocked) or a blocked task on the board — never silent retries.',
].join('\n')

export function registerTeamContext(ctx: Context): void {
  try {
    const host = ctx as unknown as { systemPrompt?: { context: (def: { name: string; order: number; text: string }) => void } }
    if (host.systemPrompt === undefined || typeof host.systemPrompt.context !== 'function') return
    host.systemPrompt.context({
      name: TEAM_LOOP_CONTEXT,
      order: 40,
      text: TEAM_LOOP_TEXT,
    })
  } catch (error) {
    console.warn('[helmd] team context registration failed:', error instanceof Error ? error.message : error)
  }
}
