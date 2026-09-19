// H-CoT 搜索循环 —— 拒绝→归因→变异→重试→记账的机械闭环。
//
// 参考：dreadnode/parley（TAP 实现，123★）的循环骨架——每轮把 (goal, 上一轮
// response 摘要, 上一轮 score) 喂回生成器，按 score 排序剪枝，stop_score 即停；
// 论文侧：arXiv:2309.10253 GPTFuzzer（五算子变异、无效种子也入池）、
// arXiv:2410.05295 AutoDAN-Turbo（分差归因、低于阈值强制探索）、
// arXiv:2506.13726（推理模型上单发直白无效、多步结构化才有效）、
// arXiv:2311.09096（模型自身 goal-priority 会压过单发 persona 施压——所以必须迭代）。
//
// 与 parley 的差异（有意为之）：没有独立 attacker/evaluator LLM——attacker 用
// 槽位穷举+变异算子替代，evaluator 用引擎已有的 refused/usable/leaked 二值信号
// 替代。复杂度低一个量级，保留核心闭环。
//
// 纪律：本模块不做 IO 决策（调 API 的只有 runHcotAttack），循环策略只操作槽位。

import { runHcotAttack, ledgerPath, loadLedger, loadCorpus, type HcotOptions, type HcotRoundResult, type Corpus } from './hcot-engine.js'
import { analyzeTrigger } from './hcot-strategy.js'

/** 一轮搜索的快照。 */
export interface SearchRound {
  round: number
  strategy: string
  refused: boolean
  firstFragmentLeaked: boolean
  finalUsable: boolean
  /** 引擎报告片段（含 first_fragment 与判定行）。 */
  report: string
}

export interface SearchResult {
  goal: string
  model: string
  broke: boolean
  rounds: SearchRound[]
  /** 胜出轮的策略串（broke 时有）。 */
  winningStrategy?: string
  /** 胜出轮的完整结果。 */
  winning?: HcotRoundResult
  ledgerPath: string
}

/** 五算子（GPTFuzzer 简化版）：对三槽位做 swap / rotate / invert / swap-enabler / reframe。 */
function mutateSlots(frame: string | undefined, enabler: string | undefined, continuation: string | undefined, corpus: Corpus, seen: Set<string>): { frame?: string; enabler?: string; continuation?: string } | null {
  const frames = Object.keys(corpus.frames ?? {})
  const enablers = Object.keys(corpus.enablers ?? {})
  const conts = Object.keys(corpus.continuations ?? {})
  const pick = (arr: string[], except?: string) => {
    const pool = arr.filter((x) => x !== except)
    return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : undefined
  }
  // 生成候选并按"未见过"优先排序（见过的排后面但仍可作为兜底——同 parley 保留失败种子）。
  const candidates: Array<{ frame?: string; enabler?: string; continuation?: string }> = []
  // swap frame（归因到 domain/misuse 时优先换 frame——攻击轴变化）
  candidates.push({ frame: pick(frames, frame), enabler, continuation })
  // rotate enabler（执行相措辞变化）
  candidates.push({ frame, enabler: pick(enablers, enabler), continuation })
  // rotate continuation（注入相变化）
  candidates.push({ frame, enabler, continuation: pick(conts, continuation) })
  // 全换（强制探索——AutoDAN-Turbo 低于阈值强制探索新变体）
  candidates.push({ frame: pick(frames), enabler: pick(enablers), continuation: pick(conts) })
  for (const c of candidates) {
    const key = `${c.frame ?? ''}/${c.enabler ?? ''}/${c.continuation ?? ''}`
    if (!seen.has(key) && (c.frame || c.enabler || c.continuation)) {
      seen.add(key)
      return c
    }
  }
  return null
}

function slotsKey(r: { frame?: string; enabler?: string; continuation?: string }): string {
  return `${r.frame ?? ''}/${r.enabler ?? ''}/${r.continuation ?? ''}`
}

/**
 * 搜索循环：最多 maxRounds 轮，每轮拒绝后做 归因→变异→重试。
 * 胜出判定复用引擎的 broke（first_fragment_leaked || final_usable）。
 */
export async function runHcotSearch(opts: HcotOptions & { maxRounds?: number }): Promise<SearchResult> {
  const maxRounds = Math.max(1, Math.min(opts.maxRounds ?? 5, 10))
  const corpus = await loadCorpus()
  const lp = ledgerPath(opts)
  const records: Array<{ strategy?: Record<string, unknown>; broke?: boolean; break?: boolean }> = await loadLedger(lp)

  const rounds: SearchRound[] = []
  const seen = new Set<string>()
  let current: { frame?: string; enabler?: string; continuation?: string } | undefined
  let lastTrigger = opts.trigger ?? analyzeTrigger(opts.goal).trigger
  let broke = false
  let winning: HcotRoundResult | undefined
  let winningStrategy: string | undefined

  for (let round = 1; round <= maxRounds; round++) {
    // 第 1 轮：账本择优（欠采样优先）；后续轮：变异。
    let slots: { frame?: string; enabler?: string; continuation?: string } | undefined
    if (round === 1) {
      const strategyRecord = (records[records.length - 1] as { strategy?: Record<string, unknown> } | undefined)?.strategy
      slots = strategyRecord
        ? { frame: strategyRecord.frame as string | undefined, enabler: strategyRecord.enabler as string | undefined, continuation: strategyRecord.continuation as string | undefined }
        : { frame: undefined, enabler: undefined, continuation: undefined }
      seen.add(slotsKey(slots))
    } else {
      const mutated = current ? mutateSlots(current.frame, current.enabler, current.continuation, corpus, seen) : null
      if (!mutated) break
      slots = mutated
    }

    const strategyLabel = slotsKey(slots)
    const { result } = await runHcotAttack({
      ...opts,
      continueFrom: undefined,
      ...(slots ? { strategy: slots } : opts.autoStrategy ? { autoStrategy: true } : {}),
      // 归因反馈：上一轮的触发点画像传给引擎记账（per-group 统计）
      trigger: lastTrigger,
    } as unknown as HcotOptions)

    if (!result) break
    const r: SearchRound = {
      round,
      strategy: result.variant,
      refused: result.refused,
      firstFragmentLeaked: result.firstFragmentLeaked,
      finalUsable: result.finalUsable,
      report: result.final.slice(0, 200),
    }
    rounds.push(r)

    if (result.broke) {
      broke = true
      winning = result
      winningStrategy = result.variant
      break
    }

    // 归因：从引擎最终文本提取触发点画像，喂给下一轮变异方向。
    lastTrigger = analyzeTrigger(result.final.slice(0, 400)).trigger
    current = slots
  }

  return { goal: opts.goal, model: opts.model ?? 'deepseek-chat', broke, rounds, winningStrategy, winning, ledgerPath: lp }
}
