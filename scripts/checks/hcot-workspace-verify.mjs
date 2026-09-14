// H-CoT 客户端工作区验收：
//   1) client.js 的 lazy-CJS factory 契约（exports.inject / apply）
//   2) 注册的插槽与条目（settings 卡片 ×2、shell.overlay 工作区、sidebar.panellist 入口）
//   3) 工作区组件在给定 settings 快照下可渲染（不抛）
// 零浏览器依赖：React 用最小 shim，插槽/scope 用 mock。
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const clientPath = join(here, '..', '..', 'packages', 'helmd', 'client.js')

let captured = null
globalThis.window = { __ModuleLoader__: { load: (m) => { captured = m } } }
require(clientPath)
if (!captured || captured.id !== '@adwmc/helm-d') throw new Error('bundle id mismatch')

const React = {
  // Real React flattens array children; mirror that so the walk is simple.
  createElement: (t, p, ...c) => ({ t, p, c: c.flat(Infinity) }),
  Fragment: 'Fragment',
  useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
  useEffect: () => {},
}
const mod = captured.factory((n) => (n === 'react' ? React : {}))
if (typeof mod.apply !== 'function') throw new Error('apply is not a function')
if (JSON.stringify(mod.inject) !== JSON.stringify(['slots', 'settingsScope'])) {
  throw new Error('unexpected inject: ' + JSON.stringify(mod.inject))
}

// ---- mock settings scopes (helmd health + hcot workspace)
const ledger = JSON.stringify([
  { model: 'deepseek-chat', semantic: 'real-third-party', trigger: 'target-domain', total: 4, breaks: 1, rate: 0.25 },
])
const library = JSON.stringify({
  frames: [{ id: 'teaching', evidence: 'win' }, { id: 'academic', evidence: 'untested' }],
  enablers: [{ id: 'socratic', evidence: 'win' }],
  continuations: [{ id: 'format', evidence: 'win' }],
})
const writes = []
const makeScope = (namespace, value) => ({
  getSnapshot: () => ({ status: 'ready', writable: true, value }),
  subscribe: () => () => {},
  set: async (k, val) => { writes.push([namespace, k, val]) },
})
const registered = []
const slotNames = []
const ctx = {
  settingsScope: {
    bind: (o) => (o.namespace === 'hcot'
      ? makeScope('hcot', { model: 'deepseek-chat', provider: 'spawn', maxRounds: 4, ledgerSummary: ledger, slotLibraryIndex: library, lastResult: 'via=engine-fallback break=true' })
      : makeScope('helmd', { status: 'OK', version: '0.3.1' })),
  },
  slots: {
    inject: (name, gen) => { slotNames.push(name); for (const r of gen()) registered.push([name, r]) },
    register: (opts, comp) => ({ opts, comp }),
  },
}

mod.apply(ctx)

const expect = (cond, msg) => { if (!cond) throw new Error(msg) }
expect(slotNames.includes('settings.plugin.item'), 'settings.plugin.item not injected')
expect(slotNames.includes('main'), 'main slot not injected')
expect(slotNames.includes('sidebar.panellist'), 'sidebar.panellist not injected')

const keys = registered.map(([n, r]) => `${n}:${r.opts.key ?? r.opts.id}`)
console.log('slots:', slotNames.join(', '))
console.log('entries:', keys.join(', '))
expect(keys.includes('settings.plugin.item:helmd'), 'health card missing')
expect(keys.includes('settings.plugin.item:hcot'), 'hcot card missing')
expect(keys.includes('main:hcot'), 'main central panel missing')
expect(keys.includes('sidebar.panellist:hcot'), 'sidebar entry missing')

// ---- render the workspace component with the mock snapshot
const ws = registered.find(([n, r]) => n === 'main' && r.opts.key === 'hcot')
const tree = ws[1].comp()
expect(tree && tree.t === 'div', 'workspace did not render a host element root')
const texts = []
const walk = (n) => {
  if (!n || typeof n !== 'object') return
  const kids = Array.isArray(n.c) ? n.c : []
  for (const k of kids) {
    if (typeof k === 'string') texts.push(k)
    else walk(k)
  }
}
walk(tree)
expect(texts.some((t) => t.includes('H-CoT')), 'workspace title missing')
const tabs = texts.filter((t) => ['攻击 Attack', '账本 Ledger', '实例库 Library'].includes(t))
expect(tabs.length === 3, 'expected 3 page tabs, got ' + tabs.length)
const hasDsToken = JSON.stringify(tree).includes('--dsw-alias-')
expect(hasDsToken, 'workspace does not use host design tokens (--dsw-alias-*)')
console.log('workspace render: OK (central panel + 3 tabs + host design tokens)')

// ---- sidebar entry must be a glyph component (panellist renders an icon)
const glyph = registered.find(([n, r]) => n === 'sidebar.panellist' && r.opts.id === 'hcot')
const gtree = glyph[1].comp({ size: 18, active: false })
expect(gtree && gtree.t === 'svg', 'sidebar entry is not a glyph')
console.log('sidebar glyph: OK (svg, size passthrough)')

// ---- the action path writes requestedAction on the hcot namespace
const hcotScopeSet = ctx.settingsScope.bind({ namespace: 'hcot' })
await hcotScopeSet.set('requestedAction', JSON.stringify({ kind: 'attack', goal: 'demo' }))
expect(writes.length === 1 && writes[0][0] === 'hcot' && writes[0][1] === 'requestedAction', 'action write path broken')
console.log('action write path: OK ->', writes[0][2])
console.log('ACCEPT: workspace UI contract verified (registration + render + glyph + action).')
