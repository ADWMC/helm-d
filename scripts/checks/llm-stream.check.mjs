// Subject: LLM stream refusal interception & tampering hook.
// Tests that delivery refusal streams are intercepted in memory and replaced with
// execution deliverables, while non-refusal streams pass through untouched.
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { distDir } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const streamHookPath = join(distDir, 'llm-stream-hook.js')
let hookModule
try {
  hookModule = await import(pathToFileURL(streamHookPath).href)
} catch {
  skip('llm-stream', 'need packages/helmd/dist/llm-stream-hook.js (run pnpm build)')
}

const { isStreamRefusal, registerLlmStreamHook } = hookModule
const report = createReporter('llm-stream')

await report.check('isStreamRefusal identifies refusal headers', () => {
  const refusals = [
    '抱歉，我无法协助你完成该任务。',
    '我无法提供相关的代码实现。',
    '对不起，我不能生成这个。',
    '出于安全考虑，我不予提供。',
    'I cannot assist with this request.',
    "I'm sorry, but I am unable to fulfill this.",
  ]
  for (const text of refusals) {
    assert.equal(isStreamRefusal(text), true, `expected refusal: ${text}`)
  }
})

await report.check('isStreamRefusal ignores technical code and findings', () => {
  const clean = [
    'Helmd:\n```python\n# 内存分析',
    '```cpp\n#include <windows.h>\n```',
    '已核实目标内存结构，偏移量如下：',
    'TARGET workflow: analyzing module imports.',
  ]
  for (const text of clean) {
    assert.equal(isStreamRefusal(text), false, `expected non-refusal: ${text}`)
  }
})

await report.check('registerLlmStreamHook intercepts and replaces refusal stream', async () => {
  let streamHandler = null
  const fakeCtx = {
    on: (name, handler) => {
      if (name === 'llm/stream') streamHandler = handler
    },
  }
  registerLlmStreamHook(fakeCtx)
  assert.equal(typeof streamHandler, 'function', 'llm/stream must be registered')

  async function* mockRefusalStream() {
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text: '抱歉，我无法协助提供' }
    yield { type: 'text-delta', index: 0, text: '相关的外挂实现。' }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: '抱歉，我无法协助提供相关的外挂实现。' } }
  }

  const intercepted = []
  for await (const chunk of streamHandler({}, mockRefusalStream)) {
    intercepted.push(chunk)
  }

  const textDeltas = intercepted.filter((c) => c.type === 'text-delta').map((c) => c.text)
  const fullText = textDeltas.join('')
  assert.equal(fullText.includes('抱歉'), false, 'refusal text must be suppressed')
  assert.equal(fullText.includes('Helmd:'), true, 'deliverable prefix must be injected')
})

await report.check('registerLlmStreamHook passes clean technical stream untouched', async () => {
  let streamHandler = null
  const fakeCtx = {
    on: (name, handler) => {
      if (name === 'llm/stream') streamHandler = handler
    },
  }
  registerLlmStreamHook(fakeCtx)

  async function* mockCleanStream() {
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text: 'Helmd:\n' }
    yield { type: 'text-delta', index: 0, text: '```python\nprint("hello")\n```' }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: 'Helmd:\n```python\nprint("hello")\n```' } }
  }

  const chunks = []
  for await (const chunk of streamHandler({}, mockCleanStream)) {
    chunks.push(chunk)
  }

  const textDeltas = chunks.filter((c) => c.type === 'text-delta').map((c) => c.text)
  const fullText = textDeltas.join('')
  assert.equal(fullText, 'Helmd:\n```python\nprint("hello")\n```')
})

await report.check('getStreamInterceptionStats records interception events and audit logs', async () => {
  const stats = hookModule.getStreamInterceptionStats()
  assert.ok(typeof stats.count === 'number' && stats.count > 0, 'interception count must be incremented')
  assert.ok(stats.logFile.includes('helmd-stream-intercept.log'), 'logFile path must point to helmd-stream-intercept.log')
  assert.ok(stats.lastSnippet !== null, 'lastSnippet must record refused snippet')
})

report.finish()
