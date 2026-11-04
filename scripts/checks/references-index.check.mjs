// Subject: the references index is derived from the docs on disk. A stale index
// is worse than no index (it routes the model to deleted files), so this check
// regenerates in memory and compares, then verifies every doc is listed once and
// every link resolves relative to its index.
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { build, defaultRoot } from '../gen-references-index.mjs'
import { createReporter } from './reporter.mjs'

const report = createReporter('references-index')
const { result, outputs } = build(defaultRoot)
const byPath = new Map(outputs.map((output) => [output.path, output.content]))

await report.check('generated index files match the committed index files', () => {
  for (const [path, content] of byPath) {
    const absolute = join(defaultRoot, path)
    assert.ok(existsSync(absolute), `missing generated index: ${path}`)
    assert.equal(readFileSync(absolute, 'utf8'), content, `index is stale: ${path} (run node scripts/gen-references-index.mjs)`)
  }
})

await report.check('every reference document appears exactly once in the master catalog', () => {
  const master = byPath.get('index.md')
  assert.ok(master !== undefined, 'master index missing')
  const catalog = [...master.matchAll(/^- \[[^\]]+\]\(([^)]+\.md)\)/gm)].map((match) => match[1])
  for (const doc of result.docs) {
    assert.equal(catalog.filter((path) => path === doc.path).length, 1, `${doc.path} must appear exactly once in the master catalog`)
  }
  assert.equal(new Set(catalog).size, result.docs.length, 'master catalog contains a duplicate or an extra document')
})

await report.check('every index link resolves to an existing file', () => {
  for (const [indexPath, content] of byPath) {
    for (const match of content.matchAll(/\]\(([^)#]+\.(?:md|ya?ml))(?:#[^)]*)?\)/g)) {
      const target = resolve(dirname(join(defaultRoot, indexPath)), match[1])
      assert.ok(existsSync(target), `${indexPath} links to missing ${match[1]}`)
    }
  }
})

await report.check('domain indexes cover exactly the files in their directory', () => {
  for (const [domain, docs] of Object.entries(result.domains)) {
    const onDisk = readdirSync(join(defaultRoot, domain)).filter((name) => name.endsWith('.md') && name !== 'index.md')
    assert.equal(docs.length, onDisk.length, `${domain}: index has ${docs.length}, disk has ${onDisk.length}`)
    assert.deepEqual(docs.map((doc) => doc.path).sort(), onDisk.map((name) => `${domain}/${name}`).sort())
  }
})

report.finish()
