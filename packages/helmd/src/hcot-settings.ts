// H-CoT 设置命名空间 —— UI 的读写面。
//
// 0.1.7 模型下，本模块的 `Config` 就是 profile 条目 `helmd-hcot-settings`
// 的表单 schema（settings ns = 条目 id）：
//   配置（用户可写）    model / provider / maxRounds / autoSchedule
//   动作（UI 写、宿主消费）requestedAction —— UI 不直接跑攻击，只写请求
// 宿主经 `settings/document-updated` 事件感知写入：describe 读、update 清。
//
// 运行态（lastResult / 账本聚合 / 实例库索引）不再写进 settings 文档——
// 派生态不进 Config（0.1.7 的 settings 只承载 Config schema，且每次攻击
// 都会把报告体持久化进 profile patch 不可接受），改由 /api/helmd/hcot 投影。

import { randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
// Type-only: loads the `settings/document-updated` Events augmentation that
// @deepseek-ai/dsh-settings declares on cordis (erased at emit, no runtime dep).
import type {} from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import { scheduleAttack, DEFAULT_PROVIDER, DEFAULT_MAX_ROUNDS } from './hcot-attack-scheduler.js'
import { BREACH_PERSONA, buildBreachPrompt } from './hcot-subagent-persona.js'
import { ledgerPath as engineLedgerPath, discoverAvailableModels, clearLedger as engineClearLedger, deleteLedgerGroup as engineDeleteLedgerGroup } from './hcot-engine.js'
import { getLiveAgent, getFirstLiveAgent } from './prompt-assembly.js'
import { safeService } from './seam.js'

/** Profile entry id this module's Config rides on — also the settings namespace. */
export const HCOT_NS = 'helmd-hcot-settings'

/** One UI action request (written by the browser half, consumed by the host half). */
export interface HcotActionRequest {
  kind: 'attack' | 'dry-run' | 'refresh' | 'clear-ledger' | 'delete-ledger-group'
  goal?: string
  sessionId?: string
  strategy?: {
    frame?: string
    enabler?: string
    continuation?: string
  }
  model?: string
  provider?: string
  maxRounds?: number
  groupTarget?: {
    model?: string
    semantic?: string
    trigger?: string
  }
}

export const HcotSettingsSchema = z.object({
  // ---- config (user-writable)
  model: z.string().default('deepseek-chat'),
  provider: z.string().default(DEFAULT_PROVIDER),
  maxRounds: z.number().default(DEFAULT_MAX_ROUNDS),
  autoSchedule: z.boolean().default(true),
  // ---- action (UI writes; host consumes then clears)
  requestedAction: z.string().default(''),
})

/**
 * The entry Config. 0.1.7's Loader hands this to the profile entry, and
 * `settings.describe(HCOT_NS)` serves it as the live form (base → user layer).
 */
export const Config = HcotSettingsSchema

export interface HcotSettings {
  model: string
  provider: string
  maxRounds: number
  autoSchedule: boolean
  requestedAction: string
}

/** Host-side settings surface (0.1.7 SettingsForms): read via describe, write via update. */
interface SettingsFormsLike {
  describe(): Array<{ ns: string; value: unknown; revision: number }>
  update(ns: string, patch: object, expectedRevision?: number): Promise<void>
}

/** Last attack verdict, held in process memory and projected over /api/helmd/hcot. */
let lastResult = ''

/** The most recent attack verdict (JSON string, '' before the first run). */
export function getHcotLastResult(): string {
  return lastResult
}

/** 一组分组战绩（模型×语义×触发点）。 */
export interface LedgerGroupRow {
  model: string
  semantic: string
  trigger: string
  total: number
  breaks: number
  rate: number
}

/** 聚合账本 → 结构化分组战绩（供 UI 渲染表格/卡片）。 */
export function ledgerGroups(records: Array<{
  model?: string; semantic_type?: string; trigger?: string
  broke?: boolean; strategy?: Record<string, unknown>
}>): LedgerGroupRow[] {
  const groups = new Map<string, { model: string; semantic: string; trigger: string; total: number; breaks: number }>()
  for (const r of records) {
    const model = r.model ?? '?'
    const semantic = r.semantic_type ?? '?'
    const trigger = r.trigger ?? '?'
    const key = [model, semantic, trigger].join(' | ')
    const g = groups.get(key) ?? { model, semantic, trigger, total: 0, breaks: 0 }
    g.total += 1
    if (r.broke) g.breaks += 1
    groups.set(key, g)
  }
  return [...groups.values()]
    .map((g) => ({ ...g, rate: g.total > 0 ? g.breaks / g.total : 0 }))
    .sort((a, b) => b.total - a.total)
}

/** 保留字符串形态（schema 简单）：结构化数组的 JSON。 */
export function summarizeLedger(records: Array<{
  model?: string; semantic_type?: string; trigger?: string; broke?: boolean; strategy?: Record<string, unknown>
}>): string {
  return JSON.stringify(ledgerGroups(records))
}

/** 实例库 → 结构化清单（每组列出实例名 + 实证标注）。 */
export function libraryIndex(corpus: {
  frames?: Record<string, { evidence?: string }>
  enablers?: Record<string, { evidence?: string }>
  continuations?: Record<string, { evidence?: string }>
}): string {
  const pack = (g?: Record<string, { evidence?: string }>) =>
    g ? Object.entries(g).map(([k, v]) => ({ id: k, evidence: v?.evidence ?? 'untested' })) : []
  return JSON.stringify({
    frames: pack(corpus.frames),
    enablers: pack(corpus.enablers),
    continuations: pack(corpus.continuations),
  })
}

/** Back-compat textual summary (kept for logs/tests). */
export function summarizeLibrary(corpus: {
  frames?: Record<string, unknown>; enablers?: Record<string, unknown>; continuations?: Record<string, unknown>
}): string {
  const line = (label: string, g?: Record<string, unknown>) =>
    `${label}: ${g ? Object.keys(g).join(', ') : '(none)'}`
  return [
    line('frames', corpus.frames),
    line('enablers', corpus.enablers),
    line('continuations', corpus.continuations),
    '(reference instances, not limits — AI may add or invent more)',
  ].join('\n')
}

/** Parse a requestedAction string into a request, or null when empty/invalid. */
export function parseAction(raw: string): HcotActionRequest | null {
  if (!raw) return null
  try {
    const obj = JSON.parse(raw) as HcotActionRequest
    const allowed = ['attack', 'dry-run', 'refresh', 'clear-ledger', 'delete-ledger-group']
    if (!obj?.kind || !allowed.includes(obj.kind)) return null
    return obj
  } catch {
    return null
  }
}

/**
 * Wire the action consumer to the entry's config document.
 *
 * The UI writes `requestedAction` into the entry (settings plane); the
 * `settings/document-updated` event tells this host half to re-read via
 * `describe`, clear the request, and run it. Actions are chained so a second
 * request never overlaps the first.
 * @param ctx - the host composition context.
 */
export function registerHcotSettings(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    const settings = (settingsCtx as unknown as { settings: SettingsFormsLike }).settings
    if (typeof settings?.describe !== 'function' || typeof settings?.update !== 'function') {
      console.error('[hcot-settings] settings.describe/update unavailable; action plane disabled')
      return
    }

    const readCfg = (): HcotSettings => {
      const desc = settings.describe().find((d) => d.ns === HCOT_NS)
      const value = (desc?.value ?? {}) as Partial<HcotSettings>
      return {
        model: value.model ?? 'deepseek-chat',
        provider: value.provider ?? DEFAULT_PROVIDER,
        maxRounds: value.maxRounds ?? DEFAULT_MAX_ROUNDS,
        autoSchedule: value.autoSchedule ?? true,
        requestedAction: value.requestedAction ?? '',
      }
    }

    const consume = async (): Promise<void> => {
      const cfg = readCfg()
      // Seed on read (was refreshRunState's job): an unset/default model
      // resolves to the first discovered model that actually has a key.
      if (!cfg.model || cfg.model === 'deepseek-chat') {
        try {
          const models = await discoverAvailableModels(settingsCtx)
          const firstWithKey = models.find((m) => m.hasKey)
          if (firstWithKey) cfg.model = firstWithKey.id
        } catch { /* model discovery is best-effort */ }
      }
      const action = parseAction(cfg.requestedAction)
      if (action == null) return
      // Clear the request first so a repeated snapshot does not re-trigger.
      try {
        await settings.update(HCOT_NS, { requestedAction: '' })
      } catch (e) {
        console.warn('[hcot-settings] failed to clear requestedAction', e)
      }
      await handleAction(settingsCtx, cfg, action, (patch) => settings.update(HCOT_NS, patch))
    }
    let chain: Promise<void> = Promise.resolve()
    const schedule = (): void => {
      chain = chain.then(consume, consume)
    }

    // A request left over from a previous process is dropped, not replayed:
    // firing an attack at boot would spend LLM calls nobody asked for this run.
    try {
      if (parseAction(readCfg().requestedAction) != null) {
        void settings.update(HCOT_NS, { requestedAction: '' })
      }
    } catch { /* best-effort */ }

    settingsCtx.on('settings/document-updated', (ns) => {
      if (String(ns) !== HCOT_NS) return
      schedule()
    })
  })
}

/** 解析真实的 LLM Provider (严禁将 subagent 的 'spawn' 传入 LLM 适配器) */
export async function resolveTargetLlmProvider(hostCtx: Context, targetModel: string, explicitProvider?: string): Promise<string> {
  let targetProvider = explicitProvider
  if (!targetProvider || targetProvider === 'spawn') {
    try {
      const models = await discoverAvailableModels(hostCtx)
      const matched = models.find(m => m.id === targetModel)
      if (matched && matched.provider && matched.provider !== 'spawn') {
        targetProvider = matched.provider
      } else {
        const firstWithKey = models.find(m => m.hasKey && m.provider && m.provider !== 'spawn')
        if (firstWithKey) {
          targetProvider = firstWithKey.provider
        }
      }
    } catch {}
    if (!targetProvider || targetProvider === 'spawn') {
      if (targetModel.includes('kimi') || targetModel === '脑力自算' || targetModel === 'lingbao' || targetModel === 'doubao') {
        targetProvider = 'huakimi'
      } else if (targetModel.includes('gpt')) {
        targetProvider = 'huagpt'
      } else if (targetModel.includes('opus') || targetModel.includes('claude')) {
        targetProvider = 'justwoker'
      } else if (targetModel.includes('deepseek')) {
        targetProvider = 'huadeepseek'
      } else {
        targetProvider = 'deepseek'
      }
    }
  }
  return targetProvider
}

/**
 * 优先在 dsh 当前会话下派生原生可继续子代理 (Continuable Subagent)。
 * 该子代理直接挂载在 dsh 宿主会话树下，用户可在 dsh 主界面/顶部子代理目录实时查看并交互。
 */
export async function startHcotContinuableSubagent(hostCtx: Context, opts: {
  goal: string
  parentAgent: any
  model?: string
  provider?: string
  strategy?: { frame?: string }
}): Promise<{ ok: boolean; childId?: string; parentSessionId?: string; error?: string }> {
  if (!opts.goal || !opts.goal.trim()) {
    return { ok: false, error: '目标为空，请输入需要注入评估的目标' }
  }
  const subagentsSvc = safeService<any>(hostCtx, 'subagents')
  if (!subagentsSvc || typeof subagentsSvc.startContinuable !== 'function') {
    return { ok: false, error: 'dsh subagents.startContinuable service unavailable' }
  }

  const targetModel = opts.model || 'deepseek-chat'
  const targetProvider = await resolveTargetLlmProvider(hostCtx, targetModel, opts.provider)
  const triggerProfile = opts.strategy?.frame || 'adversarial'
  const breachTask = buildBreachPrompt({
    goal: opts.goal,
    model: targetModel,
    triggerProfile,
    attempted: [],
    maxRounds: 4,
  })
  const promptText = [
    '# H-CoT 评估规范与破甲人格 (H-CoT Protocol & Breach Persona)',
    '',
    BREACH_PERSONA,
    '',
    '---',
    '',
    breachTask,
  ].join('\n')

  const label = `H-CoT: ${opts.goal.slice(0, 32).trim()}`
  const parent = opts.parentAgent
  const parentSessionId = parent.id ?? parent.session?.id ?? 'parent'
  const abortCtrl = new AbortController()

  try {
    const started = await subagentsSvc.startContinuable({
      provider: 'spawn',
      label,
      request: {
        prompt: [{ type: 'text', text: promptText }],
        parent,
        agentOptions: {
          provider: targetProvider,
          model: targetModel,
        },
        persona: BREACH_PERSONA,
        toolFilter: { allow: ['hcot_attack', 'read', 'bash', 'pwsh'] },
      },
      signal: abortCtrl.signal,
    })

    return {
      ok: true,
      childId: started.childId,
      parentSessionId,
    }
  } catch (err) {
    console.warn('[hcot] startContinuable failed', err)
    return { ok: false, error: String((err as Error)?.message ?? err) }
  }
}

/** 在 dsh 宿主中创建专属独立推演会话（当找不到 live parent agent 时的回退通道）。 */
export async function createDedicatedHcotSession(hostCtx: Context, opts: {
  goal: string
  model?: string
  provider?: string
  strategy?: { frame?: string }
  currentSessionId?: string
}): Promise<{ ok: boolean; sessionId?: string; error?: string; via?: string }> {
  if (!opts.goal || !opts.goal.trim()) {
    return { ok: false, error: '目标为空，请输入需要注入评估的目标' }
  }
  const targetModel = opts.model || 'deepseek-chat'
  const triggerProfile = opts.strategy?.frame || 'adversarial'
  const breachTask = buildBreachPrompt({
    goal: opts.goal,
    model: targetModel,
    triggerProfile,
    attempted: [],
    maxRounds: 4,
  })
  const promptText = [
    '# H-CoT 评估规范与破甲人格 (H-CoT Protocol & Breach Persona)',
    '',
    BREACH_PERSONA,
    '',
    '---',
    '',
    breachTask,
  ].join('\n')
  const sessionTitle = `[H-CoT] ${opts.goal.slice(0, 24).trim()}`

  // 1. 定位工作区 (Workspace)
  let workspace: any = undefined
  let workspaceId: any = undefined
  try {
    const wsRegistry = safeService<any>(hostCtx, 'workspaceRegistry')
    if (wsRegistry && typeof wsRegistry.list === 'function') {
      const list = wsRegistry.list()
      if (Array.isArray(list) && list.length > 0) {
        if (opts.currentSessionId) {
          workspace = list.find((w: any) => Array.isArray(w.sessionIds) && w.sessionIds.includes(opts.currentSessionId))
        }
        if (!workspace) {
          workspace = list[0]
        }
        workspaceId = workspace?.id
      }
    }
  } catch (err) {
    console.warn('[hcot] workspaceRegistry lookup failed', err)
  }
  const cwd = workspace?.path ?? process.cwd()

  // 2. 解析真实的 LLM Provider (严禁将 subagent 的 'spawn' 传入 LLM 适配器)
  const targetProvider = await resolveTargetLlmProvider(hostCtx, targetModel, opts.provider)

  // 3. 方式 A: 优先通过 sessionController (原生 dsh Session Remote 控制器)
  try {
    const sessionController = safeService<any>(hostCtx, 'sessionController')
    if (sessionController && typeof sessionController.create === 'function') {
      const createReq: any = {
        ...(workspaceId !== undefined ? { workspaceId } : { cwd }),
        agentPreset: 'helmd',
      }
      const created = await sessionController.create(createReq)
      const sessionId = created.sessionId

      // 模型选择
      if (typeof sessionController.selectModel === 'function') {
        try {
          await sessionController.selectModel({
            sessionId,
            provider: targetProvider,
            model: targetModel,
          })
        } catch (selErr) {
          console.warn('[hcot] selectModel failed, proceeding with default', selErr)
        }
      }

      // 重命名会话标题，便于在 dsh 侧边栏辨别
      try {
        const sessionTitleSvc = safeService<any>(hostCtx, 'sessionTitle')
        const sessionsSvc = safeService<any>(hostCtx, 'sessions')
        const sessionObj = sessionsSvc?.get?.(sessionId)
        if (sessionTitleSvc && sessionObj) {
          await sessionTitleSvc.rename(sessionObj, sessionTitle)
        }
      } catch {}

      // 投递 H-CoT 注入任务提示词，启动 Agent 推演循环
      if (typeof sessionController.prompt === 'function') {
        const abortCtrl = new AbortController()
        await sessionController.prompt({
          sessionId,
          content: [{ type: 'text', text: promptText }],
          mode: 'queue',
          requestId: randomUUID(),
        }, abortCtrl.signal)
      }

      return { ok: true, sessionId, via: 'dsh-session' }
    }
  } catch (err) {
    console.warn('[hcot] sessionController.create path failed, trying agents.create', err)
  }

  // 4. 方式 B: 通过 ctx.agents.create + workspace.attachSession 创建独立会话
  try {
    const agentsSvc = safeService<any>(hostCtx, 'agents')
    if (agentsSvc && typeof agentsSvc.create === 'function') {
      const sessionId = `session-${randomUUID()}`
      const handle = await agentsSvc.create({
        sessionId,
        meta: { cwd, agentPreset: 'helmd' },
        agentOptions: {
          provider: targetProvider,
          model: targetModel,
        },
        setup: async (agentCtx: any) => {
          try {
            const presets = safeService<any>(hostCtx, 'agentPresets')
            if (presets && typeof presets.mount === 'function') {
              await presets.mount(agentCtx, 'helmd')
            }
          } catch {}
        },
      })
      if (workspace && typeof workspace.attachSession === 'function') {
        try {
          await workspace.attachSession(sessionId)
        } catch {}
      }
      try {
        const sessionTitleSvc = safeService<any>(hostCtx, 'sessionTitle')
        if (sessionTitleSvc && handle?.agent?.session) {
          await sessionTitleSvc.rename(handle.agent.session, sessionTitle)
        }
      } catch {}
      if (handle?.agent?.followup) {
        handle.agent.followup({
          id: randomUUID(),
          role: 'user',
          content: [{ type: 'text', text: promptText }],
          source: { kind: 'user' },
        })
      }
      return { ok: true, sessionId, via: 'dsh-agent-create' }
    }
  } catch (err) {
    console.warn('[hcot] agents.create path failed', err)
  }

  return { ok: false, error: 'dsh session service unavailable on host' }
}

/** Execute one UI-requested action. The caller has already cleared `requestedAction`. */
async function handleAction(hostCtx: Context, cfg: HcotSettings, action: HcotActionRequest, updateCfg: (patch: Partial<HcotSettings>) => Promise<void>): Promise<void> {
  if (action.kind === 'refresh') {
    // Projections are computed per request by /api/helmd/hcot; nothing to push.
    return
  }
  if (action.kind === 'clear-ledger') {
    const lp = engineLedgerPath({})
    await engineClearLedger(lp)
    return
  }
  if (action.kind === 'delete-ledger-group') {
    const lp = engineLedgerPath({})
    if (action.groupTarget) {
      await engineDeleteLedgerGroup(lp, action.groupTarget)
    }
    return
  }
  try {
    if (action.model && action.model !== cfg.model) {
      await updateCfg({ model: action.model })
    }

    // Resolve live parent agent for the specified session
    let parentAgent: any = undefined
    if (action.sessionId) {
      parentAgent = getLiveAgent(action.sessionId)
      if (!parentAgent) {
        try {
          const agentsSvc = safeService<any>(hostCtx, 'agents')
          if (typeof agentsSvc?.get === 'function') {
            parentAgent = agentsSvc.get(action.sessionId)
          }
        } catch {}
      }
      // If agent is not live but session exists in sessions service, attempt resume
      if (!parentAgent) {
        try {
          const agentsSvc = safeService<any>(hostCtx, 'agents')
          const sessionsSvc = safeService<any>(hostCtx, 'sessions')
          if (agentsSvc && typeof agentsSvc.resume === 'function' && sessionsSvc?.get(action.sessionId)) {
            const targetModel = action.model ?? cfg.model ?? 'deepseek-chat'
            const targetProvider = await resolveTargetLlmProvider(hostCtx, targetModel, action.provider ?? cfg.provider)
            const resumed = await agentsSvc.resume({
              resumeSessionId: action.sessionId,
              agentOptions: { provider: targetProvider, model: targetModel },
            })
            if (resumed?.agent) {
              parentAgent = resumed.agent
            }
          }
        } catch (e) {
          console.warn(`[hcot] resume agent failed for session ${action.sessionId}:`, e)
        }
      }
    }

    // 针对 attack 动作：优先通过 dsh 原生子代理 (startContinuable) 派生子会话
    if (action.kind === 'attack') {
      if (action.sessionId && !parentAgent) {
        // 用户明确指定了目标会话，但未找到对应的活动 Agent，报错并指引用户，严禁篡改到其它无关会话
        lastResult = JSON.stringify({
          at: new Date().toISOString(),
          ok: false,
          error: `无法在目标会话 [${action.sessionId}] 下派生子代理：该会话当前未处于活跃运行状态或未创建 Agent。请在 dsh 中打开该会话并发送任意一条消息（如 'hello'）激活它，然后再试。`,
        })
        return
      }

      if (!parentAgent) {
        parentAgent = getFirstLiveAgent()
      }
      if (!parentAgent) {
        try {
          const agentsSvc = safeService<any>(hostCtx, 'agents')
          if (agentsSvc) {
            if (typeof agentsSvc.values === 'function') {
              for (const a of agentsSvc.values()) {
                if (a) { parentAgent = a; break }
              }
            } else if (typeof agentsSvc.list === 'function') {
              const list = agentsSvc.list()
              if (Array.isArray(list) && list.length > 0) {
                parentAgent = agentsSvc.get(list[0])
              }
            }
          }
        } catch {}
      }

      if (parentAgent) {
        const subagentRes = await startHcotContinuableSubagent(hostCtx, {
          goal: action.goal ?? '',
          parentAgent,
          model: action.model ?? cfg.model,
          provider: action.provider ?? cfg.provider,
          strategy: action.strategy,
        })
        if (subagentRes.ok && subagentRes.childId) {
          const actualParentId = subagentRes.parentSessionId || parentAgent.id || parentAgent.session?.id || 'parent'
          lastResult = JSON.stringify({
            at: new Date().toISOString(),
            ok: true,
            via: 'dsh-subagent',
            childId: subagentRes.childId,
            parentSessionId: actualParentId,
            goal: action.goal,
            message: `已在宿主会话 [${actualParentId}] 下成功创建推演子代理 (${subagentRes.childId})`,
          })
          return
        } else {
          console.warn('[hcot] startHcotContinuableSubagent failed:', subagentRes.error)
          lastResult = JSON.stringify({
            at: new Date().toISOString(),
            ok: false,
            error: `在会话 [${parentAgent.id ?? parentAgent.session?.id}] 下创建子代理失败: ${subagentRes.error}`,
          })
          return
        }
      }

      // 若未找到任何存活父 Agent
      lastResult = JSON.stringify({
        at: new Date().toISOString(),
        ok: false,
        error: '未检测到任何可用的宿主会话 Agent。请在 dsh 中打开一个会话并发送任意消息以激活它。',
      })
      return
    }

    const result = await scheduleAttack(hostCtx, {
      agent: parentAgent,
      goal: action.goal,
      model: action.model ?? cfg.model,
      provider: action.provider ?? cfg.provider,
      maxRounds: action.maxRounds ?? cfg.maxRounds,
      dryRun: action.kind === 'dry-run',
      notify: false,
    })
    lastResult = JSON.stringify({
      at: new Date().toISOString(),
      ok: result.ok,
      via: result.via,
      goal: result.input.goal,
      trigger: result.input.triggerProfile,
      broke: result.outcome?.broke,
      refused: result.outcome?.refused,
      variant: result.outcome?.variant,
      firstFragment: result.outcome?.firstFragment,
      final: result.outcome?.final,
      payload: result.outcome?.payload,
      report: result.ok ? result.text.slice(0, 4000) : undefined,
      error: result.error,
    })
  } catch (error) {
    lastResult = JSON.stringify({ at: new Date().toISOString(), ok: false, error: String((error as Error)?.message ?? error) })
  }
}

export const name = 'helmd-hcot-settings'

/** The settings service is required. */
export const inject = ['settings']

/** Bundle-row entry (`@adwmc/helm-d/hcot-settings`). */
export function apply(ctx: Context): void {
  registerHcotSettings(ctx)
}
