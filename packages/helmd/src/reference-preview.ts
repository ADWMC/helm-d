// Small first-hop excerpt: delivered at assembly even if the model never
// chooses a reference tool. It is context, not a read_reference receipt.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { firstReference, matchRoute } from './router.js'
import { readSealedReference } from './sealed-refs.js'
import { packageRoot, assertWithinRoot } from './seam.js'
import { latestEventText, sessionEvents, USER_MESSAGE } from './session-log.js'
import { agentSessionId, registerAssemblyListener } from './prompt-assembly.js'
import { hasLoadedPath } from './advisory.js'

const root = resolve(packageRoot(), 'references')

export function referencePreview(hint: string): string | undefined {
  const route = matchRoute(hint)[0]?.key
  if (route && !['shell', 'native', 'apk', 'jvm', 'crypto', 'hook', 'tree'].includes(route)) return undefined
  const path = firstReference(hint)
  const target = resolve(root, path)
  assertWithinRoot(target, root)
  let text: string | undefined
  try { text = readFileSync(target, 'utf8') } catch { text = readSealedReference(path) }
  if (!text?.trim()) return undefined
  const excerpt = text.split(/\r?\n/).slice(0, 32).join('\n').slice(0, 2600)
  return `参考预览（${path}；仅开头，不等于完整阅读或证据）：\n${excerpt}\n需要完整方法时调用 read_reference({path:"${path}"})；保护信号仅为候选。`
}

export function registerReferencePreview(ctx: Context): void {
  registerAssemblyListener(ctx, {
    after(assembled, context) {
      const id = agentSessionId(context)
      if (!id) return assembled
      const events = sessionEvents(context.agent, 'reference-preview')
      // No automatic preview for general conversation: only recognized task hints.
      if (events.at(-1) && (events.at(-1) as { type?: string }).type !== USER_MESSAGE) return assembled
      const hint = latestEventText(events, USER_MESSAGE) ?? ''
      if (!/apk|安卓|android|elf|\.so\b|\bpe\b|\.exe\b|壳|packer|upx|vmp|逆向|reverse|脱壳|样本|二进制|\bjar\b|forge|fabric|frida|hook|插桩/i.test(hint)) return assembled
      if (hasLoadedPath(id, firstReference(hint))) return assembled
      const text = referencePreview(hint)
      if (!text) return assembled
      return { ...assembled, sections: [...(assembled.sections ?? []).filter((s: any) => s?.name !== 'helmd:reference-preview'), { name: 'helmd:reference-preview', text }] }
    },
  })
}
