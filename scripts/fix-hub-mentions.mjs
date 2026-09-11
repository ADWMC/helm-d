// Rewrite remaining `references/X.md` mentions to real sibling files when they exist.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REF = resolve('packages/helmd/references')
const DOM = ['web', 'native', 'android', 'protocol', 'malware', 'ai-security', 'evidence', 'toolbox']
const inv = {}
for (const d of DOM) inv[d] = new Set(readdirSync(join(REF, d)).filter((f) => f.endsWith('.md')))

let fixed = 0
const left = []
const re = /(`?)(\.\.\/[a-z-]+\/)?references\/([a-z0-9.-]+)\.md(`?)/g
for (const d of DOM) {
  for (const f of readdirSync(join(REF, d)).filter((x) => x.endsWith('.md'))) {
    const p = join(REF, d, f)
    let t = readFileSync(p, 'utf8')
    const orig = t
    t = t.replace(re, (m, tq1, up, base, tq2) => {
      const fname = base + '.md'
      for (const dd of DOM) {
        if (inv[dd].has(fname)) {
          fixed++
          const rel = dd === d ? `./${fname}` : `../${dd}/${fname}`
          return `${tq1}${rel}${tq2}`
        }
      }
      left.push(`${d}/${f} -> ${base}`)
      return m
    })
    if (t !== orig) writeFileSync(p, t, 'utf8')
  }
}
console.log('fixed:', fixed)
for (const l of left) console.log('LEFT:', l)
