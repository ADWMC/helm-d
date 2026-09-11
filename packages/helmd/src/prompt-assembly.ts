// Prompt-assembly seam — the ONE place helm-d registers on the host
// `system-prompt/assemble` waterfall. It owns two things no consumer may re-derive:
//
//   1. the registration shape: the host passes an `agent`-bearing context built by
//      `assembleContextFor()` (`{ agent, scope, signal? }`), while the published
//      `AssembleContext` type declares only `scope`/`signal`. The untyped cast lives
//      here instead of being repeated at every registration site;
//   2. the ordering contract: earlier registration is OUTER, so its `before` runs
//      before inner listeners and its `after` runs after them. A producer that submits
//      in `before` is therefore always visible to a renderer whose `after` registered
//      first (index.ts relies on this: advisory renderer first, producers after).
//
// A listener's failure policy stays with the listener — this seam only wires it.

import type { Context } from '@deepseek-ai/cordis'
import type { AgentLike } from './session-log.js'

/** Prompt-assembly context as the running host populates it. */
export interface AssembleContextLike {
  agent?: AgentLike
  scope?: unknown
  signal?: AbortSignal
}

/** The assembled-prompt fields helm-d reads or replaces; every other field passes through. */
export interface AssemblyLike {
  sections?: unknown[]
  tools?: Array<{ name?: string }>
  [key: string]: unknown
}

/** One listener's two phases on the waterfall. */
export interface AssemblyListener {
  /** Runs before inner listeners — producers submit their advisory here. */
  before?(context: AssembleContextLike): void
  /** Runs after inner listeners; returns the assembly the turn will use. */
  after?(assembly: AssemblyLike, context: AssembleContextLike): AssemblyLike
}

type WaterfallListener = (
  assembly: unknown,
  context: AssembleContextLike,
  next: () => Promise<AssemblyLike>,
) => Promise<AssemblyLike>

/** Register one listener on the host prompt-assembly waterfall. */
export function registerAssemblyListener(ctx: Context, listener: AssemblyListener): void {
  const host = ctx as unknown as { on(name: string, handler: WaterfallListener): void }
  host.on('system-prompt/assemble', async (_assembly, context, next) => {
    listener.before?.(context)
    const assembled = await next()
    return listener.after ? listener.after(assembled, context) : assembled
  })
}

/** The session identity behind one assembly: agent id first, session id as the fallback. */
export function agentSessionId(context: AssembleContextLike): string | undefined {
  return context.agent?.id ?? context.agent?.session?.id
}
