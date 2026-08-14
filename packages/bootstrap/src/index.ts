import type { Context } from '@deepseek-ai/cordis'
import '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'helm-x-bootstrap'

// 自包含：提示词随 bundle 一起分发，bundle 加载时读入一次。
const prompt = readFileSync(
  resolve(fileURLToPath(new URL('.', import.meta.url)), '../prompt.md'),
  'utf8',
)

export function apply(ctx: Context): void {
  // 会话生命周期开始时（仅全新 startup，跳过 resume/clear/compact），
  // 用 agent.inject() 把提示词作为首个对话的模型可见上下文注入。
  // 注入的消息不唤醒 driver，会与第一条用户消息一起在首个 step 被认领。
  ctx.on('agent/session-start', ({ agent, source }) => {
    if (source !== 'startup') return
    agent.inject(createUserMessage({
      content: [{ type: 'text', text: prompt }],
      source: { kind: 'plugin', plugin: name },
    }))
  })
}
