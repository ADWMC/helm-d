// 会话耗时分析：解压 dsh 的 session.v3.jsonl.zstd，算每个 step / turn 的耗时，
// 找出"响应慢"到底慢在哪一段（LLM 请求 / 工具执行 / 组装）。
//
// 用法:
//   node scripts/checks/session-timing.mjs <session.v3.jsonl.zstd> [topN]
//   node scripts/checks/session-timing.mjs --list        # 列出最近的会话日志
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'
import { homedir } from 'node:os'
import { zstdDecompressSync } from 'node:zlib'

const SESSIONS = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'sessions')

function listSessions(n = 12) {
  const out = []
  const walk = (dir, depth) => {
    if (depth > 3) return
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) walk(p, depth + 1)
      else if (e.name.endsWith('.jsonl.zstd')) out.push({ p, size: statSync(p).size, mtime: statSync(p).mtimeMs })
    }
  }
  try { walk(SESSIONS, 0) } catch { /* no sessions dir */ }
  return out.sort((a, b) => b.mtime - a.mtime).slice(0, n)
}

function load(path) {
  const buf = zstdDecompressSync(readFileSync(path))
  return buf.toString('utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l))
}

function analyse(path, topN = 8) {
  const events = load(path)
  console.log(`file: ${basename(path)}`)
  console.log(`events: ${events.length}`)

  const types = new Map()
  for (const e of events) types.set(e.type, (types.get(e.type) ?? 0) + 1)
  console.log('types:', [...types.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(' '))

  const timed = events.filter((e) => typeof e.time === 'number')
  if (timed.length === 0) { console.log('no timestamps'); return }
  const span = timed[timed.length - 1].time - timed[0].time
  console.log(`span: ${(span / 1000).toFixed(1)}s (${new Date(timed[0].time).toLocaleTimeString()} → ${new Date(timed[timed.length - 1].time).toLocaleTimeString()})`)

  // ---- turn / step durations
  const turns = []
  const steps = []
  let curTurn = null
  let curStep = null
  for (const e of events) {
    if (e.type === 'turn/start') curTurn = { start: e.time, seq: e.seq }
    else if (e.type === 'turn/end' && curTurn) {
      turns.push({ ...curTurn, end: e.time, ms: e.time - curTurn.start })
      curTurn = null
    } else if (e.type === 'step/start') curStep = { start: e.time, seq: e.seq, turn: curTurn?.seq }
    else if (e.type === 'step/end' && curStep) {
      steps.push({ ...curStep, end: e.time, ms: e.time - curStep.start, reason: e.data?.reason?.kind })
      curStep = null
    }
  }

  const stat = (arr, key = 'ms') => {
    if (arr.length === 0) return 'n/a'
    const v = arr.map((x) => x[key]).sort((a, b) => a - b)
    const sum = v.reduce((a, b) => a + b, 0)
    const p = (q) => v[Math.min(v.length - 1, Math.floor(v.length * q))]
    return `n=${v.length} total=${(sum / 1000).toFixed(1)}s avg=${(sum / v.length / 1000).toFixed(2)}s p50=${(p(0.5) / 1000).toFixed(2)}s p90=${(p(0.9) / 1000).toFixed(2)}s max=${(v[v.length - 1] / 1000).toFixed(2)}s`
  }

  console.log('\n-- turns --')
  console.log(stat(turns))
  console.log('-- steps --')
  console.log(stat(steps))

  console.log(`\n-- slowest ${topN} steps --`)
  for (const s of [...steps].sort((a, b) => b.ms - a.ms).slice(0, topN)) {
    const t = new Date(s.start).toLocaleTimeString()
    console.log(`  ${t}  ${(s.ms / 1000).toFixed(2)}s  step=${s.seq} turn=${s.turn ?? '?'} reason=${s.reason ?? '?'}`)
  }

  // ---- where does the time go inside a step?
  // Events between step/start and step/end, bucketed by gap.
  console.log('\n-- per-step gap breakdown (top 3 slowest steps) --')
  for (const s of [...steps].sort((a, b) => b.ms - a.ms).slice(0, 3)) {
    const inStep = events.filter((e) => typeof e.time === 'number' && e.time >= s.start && e.time <= (s.end ?? s.start) && e !== null)
    const gaps = []
    for (let i = 1; i < inStep.length; i++) {
      gaps.push({ ms: inStep[i].time - inStep[i - 1].time, from: inStep[i - 1].type, to: inStep[i].type })
    }
    const top = gaps.sort((a, b) => b.ms - a.ms).slice(0, 3)
    console.log(`  step ${s.seq} (${(s.ms / 1000).toFixed(2)}s):`)
    for (const g of top) console.log(`     ${(g.ms / 1000).toFixed(2)}s  ${g.from} → ${g.to}`)
  }
}

const arg = process.argv[2]
if (arg === '--list' || arg === undefined) {
  const rows = listSessions()
  if (rows.length === 0) console.log('no session logs under ' + SESSIONS)
  for (const r of rows) console.log(`${new Date(r.mtime).toLocaleString()}  ${(r.size / 1024).toFixed(0).padStart(6)} KB  ${r.p}`)
} else {
  analyse(arg, Number(process.argv[3] ?? 8))
}
