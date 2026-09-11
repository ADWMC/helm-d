import type { Context } from '@deepseek-ai/cordis'
import { ASSISTANT_MESSAGE, TOOL_CALL, hasEventType, sessionEvents, type AgentLike, type SessionLike } from './session-log.js'
import { registerAssemblyListener, type AssemblyLike } from './prompt-assembly.js'

export const name = 'helmd-tool-bootstrap'

/** Prompt assembly must exist before this request filter can register. */
export const inject = ['systemPrompt']

type PromoteMode = 'tool-call' | 'assistant-message' | 'either'

export interface BootstrapConfig {
  shellTools?: string[]
  commonTools?: string[]
  promoteOn?: PromoteMode
}

const PROMOTE_EVENTS: Record<PromoteMode, string[]> = {
  'tool-call': [TOOL_CALL],
  'assistant-message': [ASSISTANT_MESSAGE],
  either: [TOOL_CALL, ASSISTANT_MESSAGE],
}

function stringList(value: unknown, field: string): string[] {
  if (
    !Array.isArray(value)
    || value.length === 0
    || value.some((item) => typeof item !== 'string' || item.length === 0)
  ) {
    throw new TypeError(`${name}: ${field} must be a non-empty array of non-empty strings`)
  }
  return [...new Set(value as string[])]
}

function parsePromoteOn(value: unknown): string[] {
  if (value === undefined || value === 'either') return PROMOTE_EVENTS.either
  if (value === 'tool-call' || value === 'assistant-message') return PROMOTE_EVENTS[value]
  throw new TypeError(`${name}: promoteOn must be one of "tool-call", "assistant-message", "either"; got ${JSON.stringify(value)}`)
}

export function applyBootstrapFilter(ctx: Context, config: BootstrapConfig = {}): void {
  const commonTools = stringList(config.commonTools, 'commonTools')
  const shellTools = stringList(config.shellTools, 'shellTools')
  const promoteEvents = parsePromoteOn(config.promoteOn)

  const promoted = new Set<string>()
  let catalogGuardWarned = false
  const warnCatalogGuard = (message: string): void => {
    if (catalogGuardWarned) return
    catalogGuardWarned = true
    try {
      ;(ctx as { logger?: { warn(message: string): void } }).logger?.warn(message)
    } catch {
      // Logger unavailable — the guard exists only to avoid spamming.
    }
  }

  /**
   * Whether this agent has earned the full catalog: a subagent child, or a session that
   * already produced a promotion event. The memo needs a session identity — an
   * identity-less session must not promote every later session through one shared key.
   */
  const isPromoted = (agent: AgentLike | undefined): boolean => {
    if (agent === undefined || agent === null) return true
    const session: SessionLike | undefined = agent.session
    if (session === undefined || session === null) return true
    // Subagents keep their full catalog from their very first request.
    if ((session.header?.delegationDepth ?? 0) > 0) return true
    const id = session.id ?? agent.id
    if (id !== undefined && promoted.has(id)) return true
    const hit = hasEventType(sessionEvents(agent, name), promoteEvents)
    if (hit && id !== undefined) promoted.add(id)
    return hit
  }

  const applyBootstrap = (assembled: AssemblyLike): AssemblyLike => {
    const tools = Array.isArray(assembled.tools) ? assembled.tools : []
    const available = new Set(tools.map((tool) => tool.name))
    const selectedShells = shellTools.filter((toolName) => available.has(toolName))
    const missingCommon = commonTools.filter((toolName) => !available.has(toolName))
    if (selectedShells.length !== 1 || missingCommon.length > 0) {
      warnCatalogGuard(
        `${name}: expected exactly one bootstrap shell and every common tool; `
        + `shells=${JSON.stringify(selectedShells)}, missing=${JSON.stringify(missingCommon)} — `
        + 'bootstrap disabled, full catalog exposed',
      )
      return assembled
    }
    const bootstrap = new Set([...selectedShells, ...commonTools])
    return {
      ...assembled,
      tools: tools.filter((tool) => bootstrap.has(tool.name ?? '')),
    }
  }

  registerAssemblyListener(ctx, {
    // Downstream errors propagate untouched; only this filter's own logic is guarded.
    after(assembled, context) {
      try {
        if (isPromoted(context.agent)) return assembled
        return applyBootstrap(assembled)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        warnCatalogGuard(`${name}: bootstrap filter failed, exposing the full catalog: ${message}`)
        return assembled
      }
    },
  })
}
