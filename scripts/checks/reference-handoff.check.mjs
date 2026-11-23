import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { distDir } from './artifacts.mjs'
import { createReporter } from './reporter.mjs'

const dir = mkdtempSync(join(tmpdir(), 'helmd-ref-handoff-'))
process.env.HELMD_TOOLS_DIR = dir
const advisory = await import(pathToFileURL(join(distDir, 'advisory.js')).href)
const router = await import(pathToFileURL(join(distDir, 'router.js')).href)
const preview = await import(pathToFileURL(join(distDir, 'reference-preview.js')).href)
const report = createReporter('reference-handoff')
const tools = new Map()
router.registerRouterTools({ tools: { register: (def) => tools.set(def.name, def) }, get: () => undefined })
const agent = { id: 'handoff', session: { snapshotEvents: () => [] } }

try {
  await report.check('first-hop preview is real but never counts as a full read', () => {
    const text = preview.referencePreview('UPX 壳')
    assert.match(text, /PE\/ELF|保护迹象/)
    assert.match(text, /仅开头/)
    assert.equal(advisory.hasLoadedReference(agent.id), false)
    assert.ok(text.includes(readFileSync(join(distDir, '..', 'references', 'native', 'protection-detection-methodology.md'), 'utf8').split(/\r?\n/)[0]))
  })

  await report.check('route metric ignores a domain tool and a wrong reference', async () => {
    await tools.get('route_task').execute({ hint: 'UPX 壳' }, { agent })
    const wrong = await tools.get('read_reference').execute({ path: 'native/index.md' }, { agent })
    assert.match(wrong, /Native|native|逆向/)
    assert.equal(advisory.hasLoadedReference(agent.id), true)
    assert.equal(advisory.reckonAdvisories(agent.id, []).length, 0)
  })

  await report.check('only the routed successful document read settles route-read', async () => {
    const text = await tools.get('read_reference').execute({ path: 'native/protection-detection-methodology.md' }, { agent })
    assert.match(text, /候选|保护/)
    const settled = advisory.reckonAdvisories(agent.id, [])
    assert.deepEqual(settled.map(({ key, verdict }) => [key, verdict]), [['route-read:shell', 'adopted']])
  })

  await report.check('missing or empty-offset content cannot forge a read receipt', async () => {
    const second = { id: 'missing', session: { snapshotEvents: () => [] } }
    const missing = await tools.get('read_reference').execute({ path: 'native/not-here.md' }, { agent: second })
    assert.match(missing, /未找到/)
    assert.equal(advisory.hasLoadedReference(second.id), false)
    const traversal = await tools.get('read_reference').execute({ path: '../private.txt' }, { agent: second })
    assert.match(traversal, /out of scope/)
    assert.equal(advisory.hasLoadedReference(second.id), false)
    await tools.get('read_reference').execute({ path: 'native/index.md', offset: 999999 }, { agent: second })
    assert.equal(advisory.hasLoadedReference(second.id), false)
  })

  await report.check('long references require all pages and completed receipts survive a restart', async () => {
    const reader = { id: 'paged', session: { snapshotEvents: () => [] } }
    const path = 'native/code-obfuscation-deobfuscation.md'
    const first = await tools.get('read_reference').execute({ path }, { agent: reader })
    assert.match(first, /truncated/)
    assert.equal(advisory.hasLoadedPath(reader.id, path), false)
    const last = await tools.get('read_reference').execute({ path, offset: 200 }, { agent: reader })
    assert.match(last, /continued/)
    assert.equal(advisory.hasLoadedPath(reader.id, path), true)
    const restarted = await import(pathToFileURL(join(distDir, 'advisory.js')).href + '?restart=receipt')
    assert.equal(restarted.hasLoadedPath(reader.id, path), true)
    assert.equal(restarted.routedReference(agent.id), 'native/protection-detection-methodology.md')
  })

  await report.check('JVM and Frida hints receive the same preview as ELF hints', async () => {
    let listener
    preview.registerReferencePreview({ on: (name, callback) => { if (name === 'system-prompt/assemble') listener = callback } })
    for (const hint of ['jar 字符串解密', 'Frida hook', '分析 ELF']) {
      const agent = { id: `preview-${hint}`, session: { snapshotEvents: () => [{ type: 'user/message', data: { message: { content: hint } } }] } }
      const assembled = await listener({}, { agent }, async () => ({ sections: [] }))
      assert.ok(assembled.sections.some((section) => section.name === 'helmd:reference-preview'), hint)
    }
  })

  await report.check('prompt assembly previews a new reverse task but not unrelated chat', async () => {
    let listener
    preview.registerReferencePreview({ on: (_event, callback) => { listener = callback } })
    const events = []
    const context = { agent: { id: 'new-turn', session: { snapshotEvents: () => events } } }
    const assemble = () => listener({}, context, async () => ({ sections: [], tools: [] }))
    events.push({ type: 'user/message', data: { message: { content: '分析 ELF 保护' } } })
    const first = await assemble()
    assert.match(first.sections[0]?.text ?? '', /参考预览/)
    events.push({ type: 'assistant/message', data: { message: { content: 'working' } } })
    const later = await assemble()
    assert.equal(later.sections.length, 0, 'old user text must not be injected in unrelated assemblies')
  })
} finally {
  rmSync(dir, { recursive: true, force: true })
}
report.finish()
