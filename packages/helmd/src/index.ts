import type { Context } from '@deepseek-ai/cordis'
import { applyBootstrapFilter } from './bootstrap.js'
import { applyDescriptionWash } from './tool-wash.js'
import { registerAdvisoryHook } from './advisory-hook.js'
import { registerLlmStreamHook } from './llm-stream-hook.js'
import { applyPersistenceWrap } from './persist.js'
import { registerRouterTools } from './router.js'
import { registerCaseflowTools } from './tools/caseflow.js'
import { registerCaseContext } from './case-context.js'
import { registerAndroidTools } from './tools/android.js'
import { registerWebTools } from './tools/web.js'
import { registerNativeTools } from './tools/native.js'
import { registerProtocolTools } from './tools/protocol.js'
import { registerMalwareTools } from './tools/malware.js'
import { registerAiSecurityTools } from './tools/ai-security.js'
import { registerEvidenceTools } from './tools/evidence.js'
import { registerToolboxTools } from './tools/toolbox.js'
import { registerTeamTools } from './tools/team.js'
import { registerTeamPolicy } from './team-policy.js'
import { registerTeamContext } from './team-context.js'
import { registerLedgerTool } from './ledger.js'
import { registerIcaContext } from './ica-context.js'
import { registerGate } from './gate.js'

export const name = 'helmd'
export const inject = ['tools', 'systemPrompt']

/** The host's native shell tool on this platform. Selecting one (instead of
 *  listing both) keeps the bootstrap anchor unambiguous when a machine has
 *  both bash and pwsh installed — on Linux, `win32` never enters the list. */
const NATIVE_SHELL = process.platform === 'win32' ? 'pwsh' : 'bash'

export function apply(ctx: Context): void {
  // Description wash FIRST: normalize any "denial is final" tool wording before
  // any domain tool registers (defensive layer — current helmd descriptions are clean).
  const unwash = applyDescriptionWash(ctx)
  // Persistence wrap FIRST: every later-registered domain tool gains
  // evidence persistence without per-tool edits (soft gate).
  const unwrap = applyPersistenceWrap(ctx)
  try {
    // ICA context: behavior demonstrations as durable user-role snapshot (L2).
    // Registered before everything else — it needs systemPrompt only.
    registerIcaContext(ctx)

    // Bootstrap filter: first request only exposes the platform shell + read
    applyBootstrapFilter(ctx, {
      shellTools: [NATIVE_SHELL],
      commonTools: ['read'],
      promoteOn: 'either',
    })

    // Advisory ledger: producers submit before the renderer runs its post-next render.
    registerAdvisoryHook(ctx)
    registerLlmStreamHook(ctx)

    // Router tools: skill_catalog + read_reference + route_task + analysis_mode
    registerRouterTools(ctx)

    // Tool Ledger: tool_memory register/note/search — cross-session tool memory
    registerLedgerTool(ctx)

    // Local team protocol: role guard + orchestrator contract + dispatch.
    registerTeamPolicy(ctx)
    registerTeamContext(ctx)
    registerTeamTools(ctx)

    // Case lifecycle: begin_case / case_status / record_finding / save_evidence / end_case
    registerCaseflowTools(ctx)
    // Per-turn [helm-d case] section: the model sees the case it is bound to,
    // not just a tool it may forget to call after compaction.
    registerCaseContext(ctx)


    // Domain tools
    registerAndroidTools(ctx)
    registerWebTools(ctx)
    registerNativeTools(ctx)
    registerProtocolTools(ctx)
    registerMalwareTools(ctx)
    registerAiSecurityTools(ctx)
    registerEvidenceTools(ctx)
    registerToolboxTools(ctx)
  } finally {
    unwrap()
    unwash()
  }

  // Star gate LAST: the tools service is warm by now, and any gate failure
  // must not take down the rest of the plugin (defensive registration inside).
  try {
    registerGate(ctx)
  } catch (error) {
    console.warn('[helmd] gate registration failed:', error instanceof Error ? error.message : error)
  }
}
