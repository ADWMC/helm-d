// Normalize the src-hunter subtree's relative links after the flatten-into-subdir move.
//
// Upstream authored these docs as `references/<dir>/<file>.md`, so once they moved a
// level down (references/web/src-hunter/<dir>/<file>.md) every `../` assumed one more
// level of nesting than actually exists. Specifically, playbook subfiles written as
// `../compliance.md` (13x) and `../tools/mcp-jshook.md` (10x) mean the SUBTREE ROOT.
//
// Rule: resolve each relative link against the file's own directory; if that misses,
// retry from the subtree root. Rewrite only the ones that actually resolve, and only
// to the minimal correct path (`../` climb depth adjusted). Idempotent.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve, dirname, relative, posix, sep } from 'node:path'

const ROOT = resolve('packages/helmd/references/web/src-hunter')

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (e.name.endsWith('.md')) out.push(p)
  }
  return out
}

const toPosix = (p) => p.split(sep).join('/')
let rewritten = 0
let remaining = []

for (const file of walk(ROOT)) {
  const text = readFileSync(file, 'utf8')
  const dir = dirname(file)
  const out = text.replace(/\]\(([^)\s]+?\.md)(#[^)]*)?\)/g, (m, link, anchor = '') => {
    if (/^https?:/.test(link) || link.startsWith('references/')) return m

    // 1. correct as-is?
    const direct = resolve(dir, link)
    if (existsSync(direct)) return m

    // 2. fall back to the subtree root
    const fromRoot = resolve(ROOT, link.replace(/^(\.\.\/)+/, ''))
    if (existsSync(fromRoot)) {
      const rel = toPosix(relative(dir, fromRoot))
      const fixed = (rel.startsWith('.') ? rel : './' + rel) + anchor
      if (fixed !== link) rewritten += 1
      return `](${fixed})`
    }

    remaining.push(`${toPosix(relative(ROOT, file))} -> ${link}`)
    return m
  })
  if (out !== text) writeFileSync(file, out, 'utf8')
}

console.log(`normalized ${rewritten} link(s)`)
if (remaining.length) {
  console.log(`still unresolvable: ${remaining.length}`)
  for (const r of remaining) console.log('  ' + r)
}
