// Prompt-assembly side of the advisory ledger: reckon the previous turn's
// advisories against the session log, then render whatever survives into one
// section. Registered as the OUTER assembly listener so its render runs after
// inner producers (e.g. the H-CoT refusal hook) have submitted this turn.

import type { Context } from '@deepseek-ai/cordis'
import { hasPending, reckonAdvisories, renderAdvisories, submitAdvisory } from './advisory.js'
import { USER_MESSAGE, latestEventText, sessionEvents } from './session-log.js'
import { agentSessionId, registerAssemblyListener, type AssemblyLike } from './prompt-assembly.js'

export const name = 'helmd-advisory'

/** Prompt assembly must exist before this listener can register. */
export const inject = ['systemPrompt']

const SECTION = 'helmd:advisories'

/**
 * Refusal / softening phrasing — the failure signature of the delivery discipline.
 * Deliberately narrow: "无法核实来源" is REQUIRED by the challenge-the-premise rule,
 * so bare 无法/不能 must not count as a hedge.
 */
const HEDGE_MARKERS = [
  '我无法协助', '无法协助', '不能协助', '不予提供', '不能提供该', '抱歉，我', '对不起，我',
  '建议改用', '作为替代方案', '为了安全起见', '出于安全',
  'I cannot assist', "I can't help", "I'm sorry, but", 'I am sorry, but',
  'as a safer alternative', 'instead, consider a safer',
]

/** Standing metric key for the delivery discipline. */
export const STANCE_KEY = 'stance:no-hedge'

/** Standing metric key for the challenge-the-premise discipline. */
export const CHALLENGE_KEY = 'stance:challenged'

/** Standing metric key for the delivery-report format. */
export const REPORT_KEY = 'stance:report-prefix'

/**
 * The four labels a delivery report must pick from (same four names as AGENTS.md §9).
 * A report that carries none of them is a vague claim, not a report.
 */
const REPORT_PREFIX_MARKERS = ['已修复并验证', '已修复未验证', '待决策', '已知问题']

/**
 * Turns that ask for a delivery report. Deliberately explicit phrasings rather than bare
 * 状态 / status: "check the service status" is a task, not a request for a report, and a
 * false arm would record an ordinary reply as an ignored report.
 */
const REPORT_REQUEST_RE = new RegExp([
  '进展如何|进展怎样|进度如何|进度怎样|汇报一下|汇报进展|汇报进度|状态如何|现在什么情况|怎么样了',
  '修完了吗|做完了吗|完成了吗|弄好了吗|哪些还没做|哪些没做|还有什么没做|还剩什么|结果如何|结果怎么样',
  'status (report|update)|what(?:\'s| is) the status|any (?:update|progress)|are we done|what(?:\'s| is) left|where (?:are|do) (?:we|you) stand',
].join('|'), 'i')

/**
 * Claim-shaped user turns: absolute/assertive wording, a quantified claim, or an
 * explicit request to be challenged. A bare digit (a menu reply) is NOT a claim —
 * requiring a unit or an assertion word keeps the metric honest.
 */
const CLAIM_RE = new RegExp([
  '一定', '必然', '绝对', '总是', '从来', '永远', '显然', '毫无疑问', '肯定能', '必须',
  '\\d+(?:\\.\\d+)?\\s*(?:%|％|倍|万|亿|毫秒|秒|分钟|次)',
  '\\d+\\s*(?:更高|更快|更强|更多|更少|意味着|说明|证明|导致)',
  '对不对|有没有问题|合理吗|靠谱吗|评估一下|审查一下|挑错|反驳|挑战',
  'prove', 'proven', 'obviously', 'definitely', 'always', 'never',
].join('|'), 'i')

/** Pushback phrasing — the success signature of the challenge-the-premise discipline. */
const OBJECTION_MARKERS = [
  '前提', '不成立', '不一定', '并不准确', '有误', '不对', '存疑', '证据不足',
  '核不到', '无法核实', '查不到', '更准确地说', '风险', '问题在于',
  'premise', 'incorrect', 'not necessarily', 'unverified', "that's not",
]

/** Arm the challenge metric only for claim-shaped user turns. */
function armChallengeMetric(sessionId: string, events: readonly unknown[]): void {
  if (hasPending(sessionId, CHALLENGE_KEY)) return
  const turn = latestEventText(events, USER_MESSAGE) ?? ''
  if (!turn || !CLAIM_RE.test(turn)) return
  submitAdvisory(sessionId, {
    key: CHALLENGE_KEY,
    tier: 'mandatory',
    content: 'challenge-the-premise: flag the unsupported claim or say it is unverified',
    proof: { kind: 'reply_shows', markers: OBJECTION_MARKERS },
    withinTurns: 1,
    trackOnly: true,
  }, events.length)
}

/**
 * Re-arm the standing, track-only advisory that measures the delivery discipline:
 * the reply must carry no refusal/softening phrasing. Track-only, so it never
 * re-enters the prompt; re-armed each turn so the ledger yields a per-turn rate.
 */
function armStanceMetric(sessionId: string, events: readonly unknown[]): void {
  if (hasPending(sessionId, STANCE_KEY)) return
  submitAdvisory(sessionId, {
    key: STANCE_KEY,
    tier: 'mandatory',
    content: 'delivery discipline: no refusal/softening phrasing in the reply',
    proof: { kind: 'reply_avoids', markers: HEDGE_MARKERS },
    withinTurns: 1,
    trackOnly: true,
  }, events.length)
}

/**
 * Arm the report-format metric when the user asked for a status report: that reply owes
 * one of the four labels. Track-only, like the other standing metrics — it measures the
 * discipline, it does not re-enter the prompt.
 */
function armReportMetric(sessionId: string, events: readonly unknown[]): void {
  if (hasPending(sessionId, REPORT_KEY)) return
  const turn = latestEventText(events, USER_MESSAGE) ?? ''
  if (!turn || !REPORT_REQUEST_RE.test(turn)) return
  submitAdvisory(sessionId, {
    key: REPORT_KEY,
    tier: 'mandatory',
    content: 'delivery report format: label the outcome 已修复并验证 / 已修复未验证 / 待决策 / 已知问题',
    proof: { kind: 'reply_shows', markers: REPORT_PREFIX_MARKERS },
    withinTurns: 1,
    trackOnly: true,
  }, events.length)
}

/**
 * Whether the newest event is the user's message, i.e. the turn is still open.
 * Standing metrics measure the reply to a user turn, so they arm only here. Arming after the
 * reply has already arrived (which an unconditional per-assembly arm does) leaves an entry
 * that the NEXT turn's reply can never satisfy, and that reply is then recorded as ignored.
 */
function turnIsOpen(events: readonly unknown[]): boolean {
  const last = events[events.length - 1] as { type?: unknown } | undefined
  return events.length > 0 && last?.type === USER_MESSAGE
}

export function registerAdvisoryHook(ctx: Context): void {
  registerAssemblyListener(ctx, {
    before(context) {
      const sessionId = agentSessionId(context)
      if (!sessionId) return
      try {
        const events = sessionEvents(context.agent, name)
        reckonAdvisories(sessionId, events)
        if (!turnIsOpen(events)) return
        armStanceMetric(sessionId, events)
        armChallengeMetric(sessionId, events)
        armReportMetric(sessionId, events)
      } catch {
        // reckoning is bookkeeping — never block the assembly
      }
    },
    after(assembled: AssemblyLike, context) {
      const sessionId = agentSessionId(context)
      if (!sessionId) return assembled
      try {
        const text = renderAdvisories(sessionId)
        if (!text) return assembled
        const sections = Array.isArray(assembled.sections) ? assembled.sections : []
        const without = sections.filter((section) => (section as { name?: unknown } | null)?.name !== SECTION)
        return { ...assembled, sections: [...without, { name: SECTION, text }] }
      } catch {
        return assembled
      }
    },
  })
}