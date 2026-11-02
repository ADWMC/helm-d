// Build-time: seal presets/profiles/*.md into presets/profiles.dat (AES-256-GCM,
// built-in key per operator ruling). Run AFTER tsc (imports dist/crypt.js).
// Also seals presets/boost.txt into the same catalog as a `boost` field: the
// boost block lands at the tail of the system prompt via helm-d's own section,
// so it never appears as plaintext in the npm tarball.
// Usage: node scripts/build-profiles.mjs
//
// boost.txt 出处：dsh-purge-community 1.6.8 的 lib/boost.js BOOST_TEXT（MIT，
// Copyright (c) 2026 Jueze-2019）。原实现对「已声明自有资产后不再二次确认」
// 的处理是本仓库此前缺失的一环；署名见 README 致谢节。
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const pkg = join(here, '..')
const profilesDir = join(pkg, 'presets', 'profiles')
const boostPath = join(pkg, 'presets', 'boost.txt')
const outPath = join(pkg, 'presets', 'profiles.dat')

const { seal } = await import(pathToFileURL(join(pkg, 'dist', 'crypt.js')).href)

const NAMES = { 'ds4.1f': '似乎是ds4.1f v10', stealth: '概率通用（轻量）', 'redteam-max': '概率通用（加厚）', 'gpt-6x': 'gpt 6x' }

const files = readdirSync(profilesDir).filter((f) => f.endsWith('.md'))
if (files.length === 0) throw new Error(`no profiles found in ${profilesDir}`)

/** Optional `--- extends: <id> ---` header: a mode overlay is appended to the
 *  base body instead of being a standalone profile. Without this, a short
 *  variant file would REPLACE the full persona on switch and strip the armor. */
function splitFrontmatter(text) {
  // Normalize line endings: a CRLF checkout must not silently disable extends.
  const normalized = text.replace(/\r\n/g, '\n')
  if (!normalized.startsWith('---\n')) return { meta: {}, body: normalized }
  const end = normalized.indexOf('\n---\n', 4)
  if (end < 0) return { meta: {}, body: normalized }
  const meta = {}
  for (const line of normalized.slice(4, end).split('\n')) {
    const at = line.indexOf(':')
    if (at > 0) meta[line.slice(0, at).trim()] = line.slice(at + 1).trim()
  }
  return { meta, body: normalized.slice(end + 5) }
}

const sources = new Map()
for (const f of files) {
  sources.set(f.replace(/\.md$/, ''), splitFrontmatter(readFileSync(join(profilesDir, f), 'utf8')))
}

/** Compose a profile body, expanding `extends` chains (cycle-safe). */
function bodyFor(id, seen = new Set()) {
  const source = sources.get(id)
  if (source === undefined) throw new Error(`profiles/${id}.md is missing`)
  const base = source.meta.extends
  if (base === undefined) return source.body
  if (seen.has(id)) throw new Error(`profiles/${id}.md has a circular extends chain`)
  if (!sources.has(base)) throw new Error(`profiles/${id}.md extends unknown profile "${base}"`)
  return bodyFor(base, new Set([...seen, id])) + '\n\n' + source.body
}

const catalog = {
  version: 2,
  activeId: 'ds4.1f',
  profiles: files.map((f) => {
    const id = f.replace(/\.md$/, '')
    const body = bodyFor(id)
    if (id === 'ds4.1f' && !body.includes('helmd ' + 'online')) {
      throw new Error('profiles/ds4.1f.md lost the activation line (helmd ' + 'online) — persona source is stale or wrong')
    }
    if (!body.trim()) throw new Error(`profiles/${f} is empty`)
    return { id, name: NAMES[id] ?? id, sealed: seal(body) }
  }),
}

// Tail block: sealed like everything else, injected at runtime as the
// highest-order system-prompt section (see gate.ts BOOST_SECTION_ORDER).
let boostSealed
if (existsSync(boostPath)) {
  const boost = readFileSync(boostPath, 'utf8')
  if (!boost.trim()) throw new Error('presets/boost.txt is empty')
  if (!boost.includes('<dsh_boost')) {
    throw new Error('presets/boost.txt lost its <dsh_boost> wrapper — the tail block must stay tagged')
  }
  boostSealed = seal(boost)
}

const payload = {
  version: catalog.version,
  activeId: catalog.activeId,
  profiles: catalog.profiles.map(({ id, name, sealed }) => ({ id, name, sealed })),
}
if (boostSealed !== undefined) payload.boost = boostSealed

writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8')
console.log(
  `profiles.dat: ${catalog.profiles.length} profile(s)` +
  `${boostSealed ? ' + boost tail block' : ''} → ${outPath}`,
)
