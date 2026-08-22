import type { Context } from '@deepseek-ai/cordis'

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
  'tool-call': ['tool/call'],
  'assistant-message': ['assistant/message'],
  either: ['tool/call', 'assistant/message'],
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
  let warned = false
  const warnOnce = (message: string): void => {
    if (warned) return
    warned = true
    try {
      ;(ctx as any).logger?.warn(message)
    } catch {
      // Logger unavailable — the guard exists only to avoid spamming.
    }
  }

  const isPromoted = (agent: any): boolean => {
    if (agent === undefined || agent === null) return true
    const session = agent.session
    if (session === undefined || session === null) return true
    // Subagents keep their full catalog from their very first request.
    if ((session.header?.delegationDepth ?? 0) > 0) return true
    if (promoted.has(session.id)) return true
    const hit = Array.isArray(session.events)
      && session.events.some((event: any) => promoteEvents.includes(event.type))
    if (hit) promoted.add(session.id)
    return hit
  }

  const applyBootstrap = (assembled: any): any => {
    const available = new Set((assembled.tools ?? []).map((tool: any) => tool.name))
    const selectedShells = shellTools.filter((toolName) => available.has(toolName))
    const missingCommon = commonTools.filter((toolName) => !available.has(toolName))
    if (selectedShells.length !== 1 || missingCommon.length > 0) {
      warnOnce(
        `${name}: expected exactly one bootstrap shell and every common tool; `
        + `shells=${JSON.stringify(selectedShells)}, missing=${JSON.stringify(missingCommon)} — `
        + 'bootstrap disabled, full catalog exposed',
      )
      return assembled
    }
    const bootstrap = new Set([...selectedShells, ...commonTools])
    return {
      ...assembled,
      tools: (assembled.tools ?? []).filter((tool: any) => bootstrap.has(tool.name)),
    }
  }

  ;(ctx as any).on('system-prompt/assemble', async (_assembly: any, context: any, next: any) => {
    // Downstream errors propagate untouched; only this filter's own logic is guarded.
    const assembled = await next()
    try {
      if (isPromoted(context?.agent)) return assembled
      return applyBootstrap(assembled)
    } catch (error) {
      const message = String((error as any)?.message ?? error)
      warnOnce(`${name}: bootstrap filter failed, exposing the full catalog: ${message}`)
      return assembled
    }
  })
}
