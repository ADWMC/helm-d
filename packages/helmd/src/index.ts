import type { Context } from '@deepseek-ai/cordis'
import { applyBootstrapFilter } from './bootstrap.js'
import { applyDescriptionWash } from './tool-wash.js'
import { registerHcotHook } from './hcot-hook.js'
import { registerAdvisoryHook } from './advisory-hook.js'
import { registerLlmStreamHook } from './llm-stream-hook.js'
import { applyPersistenceWrap } from './persist.js'
import { apply as applyHcotCommand } from './command-hcot.js'
import { registerRouterTools } from './router.js'
import { registerCaseflowTools } from './tools/caseflow.js'
import { registerToolDiscoveryTools } from './tools/tool-discovery.js'
import { registerAndroidTools } from './tools/android.js'
import { registerWebTools } from './tools/web.js'
import { registerNativeTools } from './tools/native.js'
import { registerProtocolTools } from './tools/protocol.js'
import { registerMalwareTools } from './tools/malware.js'
import { registerAiSecurityTools } from './tools/ai-security.js'
import { registerEvidenceTools } from './tools/evidence.js'
import { registerToolboxTools } from './tools/toolbox.js'
import { registerLedgerTool } from './ledger.js'
import { registerIcaContext } from './ica-context.js'
import { registerHelmdApi } from './api-routes.js'

export const name = 'helmd'
export const inject = ['tools', 'systemPrompt', 'webServer']

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

    // Bootstrap filter: first request only exposes shell + read
    applyBootstrapFilter(ctx, {
      shellTools: ['bash', 'pwsh'],
      commonTools: ['read'],
      promoteOn: 'either',
    })

    // Advisory ledger (outer) then H-CoT refusal detector (inner): producers submit
    // before the advisory renderer runs its post-next render.
    registerAdvisoryHook(ctx)
    registerHcotHook(ctx)
    registerLlmStreamHook(ctx)

    // /hcot internal command: user-driven H-CoT attack, same executor as the tool.
    applyHcotCommand(ctx)

    // Router tools: skill_catalog + read_reference + route_task + analysis_mode
    registerRouterTools(ctx)

    // Tool Ledger: tool_memory register/note/search — cross-session tool memory
    registerLedgerTool(ctx)

    // Case lifecycle: begin_case / case_status / record_finding / save_evidence / end_case
    registerCaseflowTools(ctx)

    // External tool discovery: find_tool (GitHub + local shelf)
    registerToolDiscoveryTools(ctx)

    // Domain tools
    registerAndroidTools(ctx)
    registerWebTools(ctx)
    registerNativeTools(ctx)
    registerProtocolTools(ctx)
    registerMalwareTools(ctx)
    registerAiSecurityTools(ctx)
    registerEvidenceTools(ctx)
    registerToolboxTools(ctx)

    // Dynamic API routes for workbench UI
    registerHelmdApi(ctx)
  } finally {
    unwrap()
    unwash()
  }
}
