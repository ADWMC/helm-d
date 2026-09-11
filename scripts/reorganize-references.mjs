// One-shot references reorganization: normalize hs-* / as-* filenames to topic
// names, merge same-topic collisions (knowledge preserved via 补充来源 section),
// rewrite all intra-references markdown links via old->new basename map.
import { readFileSync, writeFileSync, readdirSync, existsSync, unlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REF = resolve('packages/helmd/references')
const DOMAINS = ['web', 'native', 'android', 'protocol', 'malware', 'ai-security', 'evidence', 'toolbox']

// hs ids whose leading acronym duplicates the expansion — keep the standard short name
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

function hsTopic(id) {
  return TOPIC_OVERRIDE[id] ?? id
}

function asTopic(name) {
  let t = name.replace(/^as-/, '')
  t = t.replace(/^web-method-/, '').replace(/^auth-/, '').replace(/^recon-/, '')
  t = t.replace(/-methodology$/, '')
  return t
}

function kebab(s) {
  return s.replace(/\.md$/i, '').replace(/[_\s]+/g, '-').toLowerCase()
}

// ---- build rename/merge map: (domain, oldBase) -> newBase | {mergeInto} ----
const renameMap = new Map() // domain -> Map(oldBase -> newBase)
const merges = [] // {domain, target, sources: [{oldBase, from}]}

for (const domain of DOMAINS) {
  const dir = join(REF, domain)
  if (!existsSync(dir)) continue
  const files = readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'index.md')
  const planned = new Map() // newBase -> [{oldBase, from}]
  for (const f of files) {
    let newBase = null
    if (f.startsWith('hs-')) {
      const rest = f.slice(3)
      const m = /^(.+?)-([A-Z0-9_][A-Za-z0-9_-]*)\.md$/.exec(rest)
      if (m && !/\.md$/.test(m[1])) {
        // companion: hs-<id>-<EXTRA>.md -> <topic>-<extra>.md
        const topic = hsTopic(m[1])
        newBase = `${topic}-${kebab(m[2])}.md`
      } else {
        newBase = `${hsTopic(rest.replace(/\.md$/, ''))}.md`
      }
    } else if (f.startsWith('as-')) {
      newBase = `${asTopic(f.replace(/\.md$/, ''))}.md`
    }
    if (!newBase || newBase === f) continue
    if (!planned.has(newBase)) planned.set(newBase, [])
    planned.get(newBase).push({ oldBase: f, from: f.startsWith('hs-') ? 'hack-skills' : 'AboutSecurity' })
  }
  const map = new Map()
  for (const [newBase, sources] of planned) {
    if (sources.length === 1 && !map.has(sources[0].oldBase)) {
      map.set(sources[0].oldBase, newBase)
    } else {
      // collision (2+ sources) — biggest file becomes base, others append
      const sized = sources.map((s) => ({ ...s, lines: readFileSync(join(dir, s.oldBase), 'utf8').split('\n').length }))
      sized.sort((a, b) => b.lines - a.lines)
      map.set(sized[0].oldBase, newBase)
      for (const s of sized.slice(1)) map.set(s.oldBase, { mergeInto: newBase, baseOld: sized[0].oldBase })
      merges.push({ domain, target: newBase, sources: sized })
    }
  }
  renameMap.set(domain, map)
}

// ---- apply: read, rewrite links with the full map, write new, delete old ----
function rewriteLinks(text, fileDomain) {
  return text.replace(/\]\(([^)#]+?)(#[^)]*)?\)/g, (m, target, anchor = '') => {
    if (!/\.md$/i.test(target)) return m
    let domain = fileDomain
    let base = target
    const mm = /^\.\.\/([a-z-]+)\/(.+)$/.exec(target)
    if (mm) { domain = mm[1]; base = mm[2] }
    const map = renameMap.get(domain)
    const nb = map?.get(base)
    if (!nb || typeof nb !== 'string') return m
    const prefix = mm ? `../${domain}/` : target.startsWith('./') ? './' : ''
    return `](${prefix}${nb}${anchor})`
  })
}

let renamed = 0
let mergedAway = 0
for (const domain of DOMAINS) {
  const dir = join(REF, domain)
  if (!existsSync(dir)) continue
  const map = renameMap.get(domain)
  for (const [oldBase, nb] of map) {
    const oldPath = join(dir, oldBase)
    if (!existsSync(oldPath)) continue
    const text = rewriteLinks(readFileSync(oldPath, 'utf8'), domain)
    if (typeof nb === 'string') {
      writeFileSync(join(dir, nb), text, 'utf8')
      renamed++
    } else {
      const basePath = join(dir, nb.mergeInto)
      const appended = '\n\n---\n\n'
        + `> 补充来源：${domain}/${oldBase}（融合自 ${nb.from === 'hack-skills' ? 'yaklang/hack-skills' : 'wgpsec/AboutSecurity'}）\n\n`
        + text
      writeFileSync(basePath, readFileSync(basePath, 'utf8').replace(/\n*$/, '\n') + appended, 'utf8')
      mergedAway++
    }
    unlinkSync(oldPath)
  }
}

// ---- rewrite links inside all remaining reference docs (incl. index.md) ----
let linkFiles = 0
for (const domain of DOMAINS) {
  const dir = join(REF, domain)
  if (!existsSync(dir)) continue
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    const p = join(dir, f)
    const out = rewriteLinks(readFileSync(p, 'utf8'), domain)
    if (out !== readFileSync(p, 'utf8')) { writeFileSync(p, out, 'utf8'); linkFiles++ }
  }
}

// ---- report ----
console.log(`renamed: ${renamed}, merged-away: ${mergedAway}, link-rewritten files: ${linkFiles}`)
for (const mg of merges) {
  console.log(`merge ${mg.domain}/${mg.target} <- ${mg.sources.map((s) => s.oldBase).join(' + ')}`)
}
