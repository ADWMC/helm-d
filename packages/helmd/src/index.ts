import type { Context } from '@deepseek-ai/cordis'
import { applyBootstrapFilter } from './bootstrap.js'
import { registerHcotHook } from './hcot-hook.js'
import { registerAdvisoryHook } from './advisory-hook.js'
import { applyPersistenceWrap } from './persist.js'
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

export const name = 'helmd'
export const inject = ['tools']

export function apply(ctx: Context): void {
  // Persistence wrap FIRST: every later-registered domain tool gains
  // evidence persistence without per-tool edits (soft gate).
  const unwrap = applyPersistenceWrap(ctx)
  try {
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
  } finally {
    unwrap()
  }
}
