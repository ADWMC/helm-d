// Prompt-assembly side of the advisory ledger: reckon the previous turn's
// advisories against the session log, then render whatever survives into one
// section. Registered as the OUTER assembly listener so its render runs after
// inner producers (e.g. the H-CoT refusal hook) have submitted this turn.

import type { Context } from '@deepseek-ai/cordis'
import { hasPending, reckonAdvisories, renderAdvisories, submitAdvisory } from './advisory.js'

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

function latestUserText(events: readonly unknown[]): string {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i] as { type?: string; data?: { message?: { content?: unknown } } } | undefined
    if (e?.type !== 'user/message') continue
    const content = e.data?.message?.content
    if (typeof content === 'string') return content
    if (!Array.isArray(content)) return ''
    return content.map((b) => (typeof b === 'string' ? b : ((b as { text?: unknown } | null)?.text ?? ''))).join('\n')
  }
  return ''
}

/** Arm the challenge metric only for claim-shaped user turns. */
function armChallengeMetric(sessionId: string, events: readonly unknown[]): void {
  if (hasPending(sessionId, CHALLENGE_KEY)) return
  const turn = latestUserText(events)
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

export function registerAdvisoryHook(ctx: Context): void {
  ;(ctx as any).on('system-prompt/assemble', async (_assembly: any, context: any, next: any) => {
    const session = context?.agent?.session
    const sessionId: string | undefined = context?.agent?.id ?? session?.id
    const events: unknown[] = Array.isArray(session?.events) ? session.events : []
    if (sessionId) {
      try {
        reckonAdvisories(sessionId, events)
        armStanceMetric(sessionId, events)
        armChallengeMetric(sessionId, events)
      } catch {
        // reckoning is bookkeeping — never block the assembly
      }
    }
    const assembled = await next()
    if (!sessionId) return assembled
    try {
      const text = renderAdvisories(sessionId)
      if (!text) return assembled
      const sections = Array.isArray(assembled?.sections) ? assembled.sections : []
      const without = sections.filter((section: any) => section?.name !== SECTION)
      return { ...assembled, sections: [...without, { name: SECTION, text }] }
    } catch {
      return assembled
    }
  })
}