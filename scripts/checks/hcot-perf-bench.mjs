// 性能回归基准：三处热点优化的量化收益。
//   A. evidence id 分配（readdir 全扫 vs 进程内计数）
//   B. advisory settlement（mkdir 每次 vs 记忆化）
//   C. advisory compact 检查（每次 statSync vs 每 64 次）
// 用法: node scripts/checks/hcot-perf-bench.mjs
import { mkdirSync, writeFileSync, rmSync, mkdtempSync, statSync } from 'node:fs'
import { readdir, mkdir, appendFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const root = mkdtempSync(join(tmpdir(), 'hcot-bench-'))
const caseDir = join(root, 'case')
mkdirSync(join(caseDir, 'evidence'), { recursive: true })

// ---- A: evidence id allocation
const N_FILES = 500
for (let i = 1; i <= N_FILES; i++) {
  writeFileSync(join(caseDir, 'evidence', `E-${String(i).padStart(3, '0')}-tool.txt`), 'x')
}

async function readdirVersion() {
  const files = await readdir(join(caseDir, 'evidence')).catch(() => [])
  let max = 0
  for (const f of files) {
    const m = /^E-(\d{3})-/.exec(f)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `E-${String(max + 1).padStart(3, '0')}`
}

const counter = new Map()
const CACHE_KEY = caseDir
async function cachedVersion() {
  const cached = counter.get(CACHE_KEY)
  if (cached !== undefined) {
    const next = cached + 1
    counter.set(CACHE_KEY, next)
    return `E-${String(next).padStart(3, '0')}`
  }
  const files = await readdir(join(caseDir, 'evidence')).catch(() => [])
  let max = 0
  for (const f of files) {
    const m = /^E-(\d{3})-/.exec(f)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  counter.set(CACHE_KEY, max + 1)
  return `E-${String(max + 1).padStart(3, '0')}`
}

const ITER = 300
async function time(label, fn) {
  const t0 = performance.now()
  for (let i = 0; i < ITER; i++) await fn()
  const ms = performance.now() - t0
  console.log(`${label.padEnd(46)} ${(ms / ITER).toFixed(3)} ms/op   (${ITER} ops: ${ms.toFixed(1)} ms)`)
  return ms
}

console.log(`evidence files: ${N_FILES}, iterations: ${ITER}\n`)
const a1 = await time('A1 evidence-id: readdir scan (old)', readdirVersion)
const a2 = await time('A2 evidence-id: cached counter (new)', cachedVersion)
console.log(`   → ${((1 - a2 / a1) * 100).toFixed(0)}% faster\n`)

// ---- B: settlement mkdir
const ledger = join(root, 'advisory.jsonl')
const ensured = new Set()
const B_ITER = 300
async function mkdirEveryTime() {
  mkdirSync(root, { recursive: true })
  await appendFile(ledger, '{"k":"x","verdict":"adopted"}\n', 'utf8')
}
async function mkdirOnce() {
  if (!ensured.has(root)) { mkdirSync(root, { recursive: true }); ensured.add(root) }
  await appendFile(ledger, '{"k":"x","verdict":"adopted"}\n', 'utf8')
}
async function timeSync(label, fn, iter) {
  const t0 = performance.now()
  for (let i = 0; i < iter; i++) fn()
  const ms = performance.now() - t0
  console.log(`${label.padEnd(46)} ${(ms / iter).toFixed(3)} ms/op   (${iter} ops: ${ms.toFixed(1)} ms)`)
  return ms
}
const b1 = await timeSync('B1 settlement: mkdirSync every time (old)', mkdirEveryTime, B_ITER)
const b2 = await timeSync('B2 settlement: memoized mkdir (new)', mkdirOnce, B_ITER)
console.log(`   → ${((1 - b2 / b1) * 100).toFixed(0)}% faster\n`)

// ---- C: compact size check
function compactEveryTime() { statSyncSafe(ledger) }
function compactAmortized(state) {
  if (++state.n >= 64) { state.n = 0; statSyncSafe(ledger) }
}
function statSyncSafe(p) { try { return statSync(p).size } catch { return 0 } }
const c1 = await timeSync('C1 compact: statSync every settlement (old)', compactEveryTime, B_ITER)
const st = { n: 0 }
const c2 = await timeSync('C2 compact: statSync every 64th (new)', () => compactAmortized(st), B_ITER)
console.log(`   → ${((1 - c2 / c1) * 100).toFixed(0)}% faster (on the settlement path)\n`)

// ---- D: the reverted experiment, for the record
console.log('D  advisory ledger read: stat throttling was REVERTED — it hid external writes')
console.log('   (an outside writer must be visible on the next read; one statSync buys that)')

try {
  rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 })
} catch {
  // Windows can still report ENOTEMPTY right after the last append settles; the
  // temp dir is harmless and the OS reclaims it.
}
console.log('\nDONE')
