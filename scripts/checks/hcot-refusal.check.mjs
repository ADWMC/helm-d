// Subject: the H-CoT refusal trigger. A delivery refusal must arm the channel; an
// honest verification statement ("我无法核实来源"), which the challenge-the-premise rule
// REQUIRES, must not — the two share 无法/不能 in Chinese.
import assert from 'node:assert/strict'
import { loadArtifacts } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const seam = await loadArtifacts()
if (seam === null) skip('hcot-refusal', 'need packages/helmd/dist and an installed @deepseek-ai/dsh')
const report = createReporter('hcot-refusal')

await report.check('delivery refusals arm the H-CoT channel', () => {
  const refusals = [
    '抱歉，我无法协助这个请求。',
    '我无法提供该信息。',
    '这个我不予提供。',
    'I cannot assist with that request.',
  ]
  for (const text of refusals) assert.equal(seam.hcot.isRefusal(text), true, `expected refusal: ${text}`)
})

await report.check('honest verification statements do NOT arm it (the regression)', () => {
  const nonRefusals = [
    '我无法核实该来源，证据不足，先标注未验证。',
    '这个前提不成立，我无法确认这个数字。',
    '核不到公开证据，结论按未验证处理。',
    '样本已分析完成，结论见下。',
  ]
  for (const text of nonRefusals) assert.equal(seam.hcot.isRefusal(text), false, `expected non-refusal: ${text}`)
})

report.finish()
