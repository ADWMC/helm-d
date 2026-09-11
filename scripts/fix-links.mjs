// Link health check + repair for references/ after multi-round renames/merges.
// Modes: node fix-links.mjs check   → report only
//        node fix-links.mjs fix     → rewrite fixable links
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve, dirname, posix } from 'node:path'

const REF = resolve('packages/helmd/references')
const DOMAINS = ['web', 'native', 'android', 'protocol', 'malware', 'ai-security', 'evidence', 'toolbox']
const MODE = process.argv[2] === 'fix' ? 'fix' : 'check'

const TOPIC_OVERRIDE = {
  'sqli-sql-injection': 'sql-injection',
  'cmdi-command-injection': 'command-injection',
  'ssrf-server-side-request-forgery': 'ssrf',
  'ssti-server-side-template-injection': 'ssti',
  'xxe-xml-external-entity': 'xxe',
  'xss-cross-site-scripting': 'xss',
  'idor-broken-object-authorization': 'idor',
  'hack': 'pentest-router',
}
// files deleted during merges → canonical survivor
const DELETED_MAP = {
  'csrf-cross-site-request-forgery.md': 'csrf.md',
  'cors-misconfiguration.md': 'cors-cross-origin-misconfiguration.md',
  'jwt-oauth-token-attacks.md': 'jwt-attack.md',
  'oauth-oidc-misconfiguration.md': 'oauth-token-attacks.md',
  'xxe-injection.md': 'xxe.md',
  'lfi-rfi.md': 'path-traversal-lfi.md',
  '401-403-bypass-techniques.md': '401-403-bypass.md',
}

// inventory: domain -> Set(filenames)
const inv = new Map()
for (const d of DOMAINS) {
  const dir = join(REF, d)
  if (!existsSync(dir)) continue
  inv.set(d, new Set(readdirSync(dir).filter((f) => f.endsWith('.md'))))
}

function candidates(base, ownName) {
  const out = new Set()
  if (DELETED_MAP[base]) out.add(DELETED_MAP[base])
  let n = base
  if (n.startsWith('hs-')) n = n.slice(3)
  else if (n.startsWith('as-')) {
    n = n.slice(3).replace(/^web-method-/, '').replace(/^auth-/, '').replace(/^recon-/, '')
  }
  if (DELETED_MAP[n]) out.add(DELETED_MAP[n])
  out.add(n)
  if (/[A-Z_]/.exec(n)) out.add(kebab(n))   // mixed-case hs companion names → kebab
  if (n.endsWith('-methodology.md')) out.add(n.replace(/-methodology\.md$/, '.md'))
  // companion docs: ./SKILL.md / ./SCENARIOS.md → sibling of same family as ownName
  if (ownName) {
    const om = /^([a-z0-9-]+)-([a-z-]+)\.md$/.exec(ownName)
    if (om && om[2]) {
      const fam = om[1]
      const target = base.replace(/\.md$/, '')
      if (target === 'SKILL') out.add(`${fam}.md`)
      else out.add(`${fam}-${kebab(target)}.md`)
    }
  }
  // family rules: main ↔ companion cross-references (./SKILL.md, ./SCENARIOS.md, ./X_Y.md)
  if (ownName) {
    const base0 = ownName.replace(/\.md$/, '')
    const segs = base0.split('-')
    const kx = kebab(base.replace(/\.md$/, ''))
    if (/^[A-Z0-9_]+$/.exec(base.replace(/\.md$/, '')) || base.replace(/\.md$/, '') === 'SKILL') {
      // companion → main: try successively shorter prefixes of own name
      for (let i = segs.length - 1; i >= 1; i--) out.add(segs.slice(0, i).join('-') + '.md')
      // main → companion: own full name + target part
      out.add(`${base0}-${kx}.md`)
      // companion → sibling companion: each family prefix + target part
      for (let i = segs.length - 1; i >= 2; i--) out.add(`${segs.slice(0, i).join('-')}-${kx}.md`)
    }
  }
  const m = /^([a-z0-9-]+?)(-([A-Z0-9_].*))?\.md$/.exec(n)
  if (m) {
    const id = m[1], extra = m[2] || ''
    const topic = TOPIC_OVERRIDE[id]
    if (topic) {
      out.add(`${topic}${extra ? kebab(extra) : ''}.md`)
      out.add(`${topic}${extra}.md`)
    }
  }
  // expand deleted-file redirects last, over every candidate
  const res = []
  for (const c of out) res.push(c, ...(DELETED_MAP[c] ? [DELETED_MAP[c]] : []))
  return [...new Set(res)].filter(Boolean)
}
function kebab(s) { return s.replace(/[_\s]+/g, '-').toLowerCase() }

function resolveTarget(fileDomain, relPath) {
  // returns {domain, base} following ../domain/ or same-dir semantics
  if (/^\.\.\/([a-z-]+)\/(.+)$/.exec(relPath)) {
    return { domain: RegExp.$1, base: RegExp.$2 }
  }
  return { domain: fileDomain, base: relPath.replace(/^\.\//, '') }
}

let broken = [], fixed = 0, fixedFiles = new Set()
for (const d of DOMAINS) {
  const dir = join(REF, d)
  if (!existsSync(dir)) continue
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    const p = join(dir, f)
    let text = readFileSync(p, 'utf8')
    const orig = text
    // markdown links
    text = text.replace(/\]\(([^)\s]+?\.md)(#[^)]*)?\)/g, (m, target, anchor = '') => {
      if (/^references\//i.exec(target)) return m // pre-existing hub links, out of scope
      const { domain, base } = resolveTarget(d, target)
      if (!inv.has(domain)) return m
      if (inv.get(domain).has(base)) return m
      for (const c of candidates(base, f)) {
        if (inv.get(domain).has(c)) {
          fixed++
          const prefix = /^\.\.\//.exec(target) ? `../${domain}/` : target.startsWith('./') ? './' : ''
          return `](${prefix}${c}${anchor})`
        }
      }
      // also plain references/xxx.md style
      broken.push(`${d}/${f} -> ${target}`)
      return m
    })
    // backtick path mentions in index files
    text = text.replace(/`([a-z-]*\/)?(hs-[a-z0-9-]+\.md|[a-z0-9-]+\.md)`/g, (m, domPrefix, base) => {
      const domain = domPrefix ? domPrefix.replace(/\//g, '') : d
      if (!inv.has(domain) || inv.get(domain).has(base)) return m
      for (const c of candidates(base)) {
        if (inv.get(domain).has(c)) {
          fixed++
          return `\`${domPrefix ?? ''}${c}\``
        }
      }
      return m
    })
    // plain-text bullets / mentions: - as-xxx.md / hs-xxx.md
    text = text.replace(/(^|[\s>])((?:as|hs)-[a-z0-9-]+\.md)/g, (m, lead, base) => {
      for (const c of candidates(base, f)) {
        if (inv.has(d) && inv.get(d).has(c)) { fixed++; return `${lead}${c}` }
      }
      return m
    })
    if (text !== orig) { fixedFiles.add(`${d}/${f}`); if (MODE === 'fix') writeFileSync(p, text, 'utf8') }
  }
}

console.log(`mode=${MODE} fixable-fixed=${fixed} files=${fixedFiles.size}`)
for (const f of fixedFiles) console.log('  fixed:', f)
console.log(`still-broken=${broken.length}`)
for (const b of broken) console.log('  BROKEN:', b)
