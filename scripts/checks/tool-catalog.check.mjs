// Subject: the declared tool count. MAINTENANCE.md states a count that reviewers and the
// registry-facing description both repeat; this check makes that claim mechanical by
// comparing it with what the plugin actually registers under a mock context.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { pluginEntry, repoRoot } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const entry = pluginEntry()
if (entry === null) skip('tool-catalog', 'need packages/helmd/dist (run pnpm build)')
const report = createReporter('tool-catalog')

/** Minimal cordis stand-in: capture every registered tool name. */
const names = []
const ctx = new Proxy({}, {
  get(target, prop) {
    if (prop === 'tools') {
      target.tools ??= { register: (def) => { if (def?.name) names.push(def.name) } }
      return target.tools
    }
    if (prop === 'on') return () => {}
    if (prop === 'get') return () => undefined
    if (typeof prop === 'string') return target[prop]
  },
  set() { return true },
})
const { apply } = await import(pathToFileURL(entry).href)
apply(ctx)

const declaredText = readFileSync(join(repoRoot, 'MAINTENANCE.md'), 'utf8')
const declared = Number(/当前计数基准：(\d+) 个工具/.exec(declaredText)?.[1] ?? NaN)

await report.check('the count declared in MAINTENANCE.md matches the registered catalog', () => {
  assert.ok(Number.isFinite(declared), 'MAINTENANCE.md must state "当前计数基准：<n> 个工具"')
  assert.equal(names.length, declared, `registered ${names.length} tools, doc says ${declared}`)
})

await report.check('no tool is registered twice', () => {
  const seen = new Set()
  for (const name of names) {
    assert.ok(!seen.has(name), `duplicate tool registration: ${name}`)
    seen.add(name)
  }
})

await report.check('the load-bearing tool names are all present', () => {
  for (const name of ['begin_case', 'case_status', 'record_finding', 'save_evidence', 'end_case', 'find_tool', 'tool_memory', 'route_task', 'hcot_attack']) {
    assert.ok(names.includes(name), `missing tool: ${name}`)
  }
})

report.finish()
