// H-CoT 客户端工作区验收：
//   1) client.js 的 lazy-CJS factory 契约（exports.inject = slots / sidebarRight / sidebarRightTabs）
//   2) 注册的插槽与条目（settings.plugin.item 健康卡、conversation.session.header.actions 胶囊钮、
//      sidebar.right.pane.tab(.title) 工作台）
//   3) 工作台组件可渲染（不抛），且按新契约轮询 /api/helmd/* HTTP 投影
//      （0.1.7 起 settings 只承载 Config，无 settings scope，派生态走 HTTP 投影）
// 零浏览器依赖：React 用最小 shim，插槽/fetch 用 mock。
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const clientPath = join(here, '..', '..', 'packages', 'helmd', 'client.js')

const modules = new Map()
globalThis.window = {
  __ModuleLoader__: {
    load: (m) => { modules.set(m.id, m) },
    require: (id) => modules.get(id),
  },
}
require(clientPath)
const captured = modules.get('@adwmc/helm-d')
if (!captured || captured.id !== '@adwmc/helm-d') throw new Error('bundle id mismatch')

const effectCleanups = []
const React = {
  // Real React flattens array children; mirror that so the walk is simple.
  createElement: (t, p, ...c) => ({ t, p, c: c.flat(Infinity) }),
  Fragment: 'Fragment',
  useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
  // Run effects synchronously so the workbench's projection poll is observable;
  // keep cleanups so the poll interval can be torn down before the process exits.
  useEffect: (fn) => { if (typeof fn === 'function') effectCleanups.push(fn()) },
}
const mod = captured.factory((n) => (n === 'react' ? React : {}))
if (typeof mod.apply !== 'function') throw new Error('apply is not a function')
if (!mod.inject.includes('slots') || !mod.inject.includes('sidebarRight') || !mod.inject.includes('sidebarRightTabs')) {
  throw new Error('unexpected inject: ' + JSON.stringify(mod.inject))
}

// ---- mock ctx：settings 只承载 Config，派生态走 /api/helmd/* HTTP 投影（fetch 打点）
const fetchCalls = []
globalThis.fetch = (url) => {
  fetchCalls.push(String(url))
  return Promise.resolve({ json: async () => ({ data: null }) })
}
const registered = []
const slotNames = []
const ctx = {
  slots: {
    inject: (name, gen) => { slotNames.push(name); for (const r of gen()) registered.push([name, r]) },
    register: (opts, comp) => ({ opts, comp }),
  },
  sidebarRight: {
    open: () => {},
  },
  sidebarRightTabs: {
    register: (def) => def,
  },
  effect: (fn) => fn(),
}

mod.apply(ctx)

const expect = (cond, msg) => { if (!cond) throw new Error(msg) }
expect(slotNames.includes('settings.plugin.item'), 'settings.plugin.item not injected')
expect(slotNames.includes('conversation.session.header.actions'), 'header actions not injected')
expect(slotNames.includes('sidebar.right.pane.tab'), 'sidebar.right.pane.tab not injected')
expect(slotNames.includes('sidebar.right.pane.tab.title'), 'sidebar.right.pane.tab.title not injected')

const keys = registered.map(([n, r]) => `${n}:${r.opts.key ?? r.opts.id}`)
console.log('slots:', slotNames.join(', '))
console.log('entries:', keys.join(', '))
expect(keys.includes('settings.plugin.item:helmd'), 'health card missing')
expect(keys.includes('sidebar.right.pane.tab:hcot'), 'sidebar workbench tab missing')

// ---- render the workbench component with mock props
const ws = registered.find(([n, r]) => n === 'sidebar.right.pane.tab' && r.opts.key === 'hcot')
const tree = ws[1].comp({})
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
const tabs = texts.filter((t) => ['Tool Shelf', 'Attack Log', 'Jev Decisions', 'Intercept Log'].includes(t))
expect(tabs.length === 4, 'expected 4 page tabs, got ' + tabs.length)
const hasDsToken = JSON.stringify(tree).includes('--dsw-alias-')
expect(hasDsToken, 'workspace does not use host design tokens (--dsw-alias-*)')
console.log('workspace render: OK (sidebar panel + 4 tabs + host design tokens)')

// ---- title component render
const titleEntry = registered.find(([n, r]) => n === 'sidebar.right.pane.tab.title' && r.opts.key === 'hcot')
const titleTree = titleEntry[1].comp()
expect(titleTree && titleTree.t === 'div', 'tab title does not render div')
console.log('tab title: OK')

// ---- the workbench reads the /api/helmd/* HTTP projection (no settings scope exists)
for (const u of ['/api/helmd/tools', '/api/helmd/hcot', '/api/helmd/intercept', '/api/helmd/jev']) {
  expect(fetchCalls.includes(u), 'workbench does not poll projection endpoint: ' + u)
}
for (const c of effectCleanups) if (typeof c === 'function') c()
console.log('HTTP projection path: OK ->', fetchCalls.join(', '))
console.log('ACCEPT: workspace UI contract verified (registration + render + glyph + projection).')
