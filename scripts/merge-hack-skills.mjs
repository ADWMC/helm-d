// One-shot migration: flatten yaklang/hack-skills into domain references/ dirs.
// Precedent: AboutSecurity integration (as-* prefix, flat files, per-domain index sections).
import { readFileSync, writeFileSync, readdirSync, existsSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const SRC = resolve(process.argv[2]) // extracted skills/ dir
const JSON_PATH = process.argv[3] // skills.json
const DST = resolve('packages/helmd/references')
const PREFIX = 'hs-'

// zip category -> existing helmd reference domain
const DOMAIN = {
  recon: 'web', api: 'web', auth: 'web', injection: 'web', advweb: 'web',
  logic: 'web', file: 'web', blockchain: 'web',
  pwn: 'native', re: 'native', crypto: 'native', macos: 'native',
  windows: 'native', linux: 'native',
  mobile: 'android',
  infra: 'protocol',
  forensics: 'malware',
  ai: 'ai-security',
}

const meta = JSON.parse(readFileSync(JSON_PATH, 'utf8'))
const byId = new Map(meta.skills.map((s) => [s.id, s]))
const domainOf = new Map() // skill id -> domain
for (const cat of meta.categories) {
  for (const s of cat.skills) domainOf.set(s.id, DOMAIN[cat.id] ?? 'web')
}

// actual dirs on disk win (json may lag)
const ids = readdirSync(SRC).filter((d) => existsSync(join(SRC, d, 'SKILL.md')))
for (const id of ids) if (!domainOf.has(id)) domainOf.set(id, 'web')

// link rewriting table: (skill dir, relative target) -> flattened markdown link path
function flatName(id, file) {
  return file === 'SKILL.md' ? `${PREFIX}${id}.md` : `${PREFIX}${id}-${file}`
}
function linkPath(fromId, targetId, file) {
  const from = domainOf.get(fromId)
  const to = domainOf.get(targetId)
  const name = flatName(targetId, file)
  return from === to ? `./${name}` : `../${to}/${name}`
}

function rewriteLinks(fromId, text) {
  // ../<id>/SKILL.md  |  ../<id>/<EXTRA>.md  |  ./<EXTRA>.md  (markdown links only)
  return text.replace(/\]\((\.\.\/|\.)\/?([^)#]+?)(#[^)]*)?\)/g, (m, lead, target, anchor = '') => {
    const seg = target.split('/')
    if (lead === '../' && seg.length === 2 && domainOf.has(seg[0])) {
      return `](${linkPath(fromId, seg[0], seg[1])}${anchor})`
    }
    if (lead === '../' && seg.length === 2 && /\.(md|png|jpg|jpeg|svg)$/i.test(seg[1]) === false) {
      return m // unknown dir — leave untouched
    }
    if (lead === './' && seg.length === 1 && /\.md$/i.test(seg[0])) {
      return `](${linkPath(fromId, fromId, seg[0])}${anchor})`
    }
    return m
  })
}

const touched = new Map() // domain -> [{file, desc}]
for (const id of ids) {
  const domain = domainOf.get(id)
  const dir = join(SRC, id)
  const desc = (byId.get(id)?.description || '').replace(/\s+/g, ' ').trim()
  if (!touched.has(domain)) touched.set(domain, [])
  touched.get(domain).push({ id, desc })

  for (const file of readdirSync(dir)) {
    const text = readFileSync(join(dir, file), 'utf8')
    writeFileSync(join(DST, domain, flatName(id, file)), rewriteLinks(id, text), 'utf8')
  }
}

// per-domain index section
const CAT_NAME = new Map(meta.categories.map((c) => [c.id, c.name]))
for (const [domain, list] of touched) {
  const idxPath = join(DST, domain, 'index.md')
  if (!existsSync(idxPath)) continue
  const lines = ['', `## hack-skills 融合（hs-*，源自 [yaklang/hack-skills](https://github.com/yaklang/hack-skills)）`, '']
  for (const { id, desc } of list) {
    const cat = byId.get(id)?.category
    const tag = cat ? ` [${CAT_NAME.get(cat) ?? cat}]` : ''
    lines.push(`- ${PREFIX}${id}.md${tag} — ${desc.slice(0, 150) || '(见文件)'}`)
  }
  writeFileSync(idxPath, readFileSync(idxPath, 'utf8').replace(/\n*$/, '\n') + lines.join('\n') + '\n', 'utf8')
}

const counts = {}
for (const [d, l] of touched) counts[d] = l.length
console.log('merged:', JSON.stringify(counts), 'total skills:', ids.length)
