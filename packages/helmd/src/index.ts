import type { Context } from '@deepseek-ai/cordis'
import { applyBootstrapFilter } from './bootstrap.js'
import { registerRouterTools } from './router.js'
import { registerAndroidTools } from './tools/android.js'
import { registerWebTools } from './tools/web.js'
import { registerNativeTools } from './tools/native.js'
import { registerProtocolTools } from './tools/protocol.js'
import { registerMalwareTools } from './tools/malware.js'
import { registerAiSecurityTools } from './tools/ai-security.js'
import { registerEvidenceTools } from './tools/evidence.js'
import { registerToolboxTools } from './tools/toolbox.js'

export const name = 'helmd'
export const inject = ['tools']

export function apply(ctx: Context): void {
  // Bootstrap filter: first request only exposes shell + read
  applyBootstrapFilter(ctx, {
    shellTools: ['bash', 'pwsh'],
    commonTools: ['read'],
    promoteOn: 'either',
  })

  // Router tools: skill_catalog + read_reference
  registerRouterTools(ctx)

  // Domain tools
  registerAndroidTools(ctx)
  registerWebTools(ctx)
  registerNativeTools(ctx)
  registerProtocolTools(ctx)
  registerMalwareTools(ctx)
  registerAiSecurityTools(ctx)
  registerEvidenceTools(ctx)
  registerToolboxTools(ctx)
}
