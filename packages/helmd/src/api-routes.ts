// Helmd workbench API — HTTP routes for the client-side workbench tabs.
// Each route provides dynamic, real-time data that the client polls.
//
// Routes:
//   GET /api/helmd/tools    → dynamic tool list from ctx.tools registry
//   GET /api/helmd/hcot     → H-CoT ledger summary (rounds, broke, strategies)
//   GET /api/helmd/intercept → stream interception stats (count, last time, snippet)
//   GET /api/helmd/jev      → Jev plugin status (transport, model, key configured)

import type { Context } from '@deepseek-ai/cordis'
import { homedir } from 'node:os'
import { join } from 'node:path'

const ROUTE_BASE = '/api/helmd'

/** Read the H-CoT results ledger (last N records). */
async function readHcotLedger(limit = 20): Promise<Array<Record<string, unknown>>> {
  try {
    const ledgerPath = join(homedir(), '.dsh', 'helmd-tools', 'h_cot_results.jsonl')
    const { readFile } = await import('node:fs/promises')
    const raw = await readFile(ledgerPath, 'utf8')
    const lines = raw.split('\n').filter(l => l.trim())
    return lines.slice(-limit).map(l => {
      try { return JSON.parse(l) } catch { return { parse_error: l.slice(0, 100) } }
    })
  } catch { return [] }
}

/** Read stream intercept stats from the llm-stream-hook's in-memory counters. */
function getInterceptStats(): { count: number; lastTime: string | null; lastSnippet: string | null } {
  try {
    // llm-stream-hook.js exports getStreamInterceptionStats
    // But we can't import it directly (circular). Read from the log file instead.
    const logPath = join(homedir(), '.dsh', 'helmd-stream-intercept.log')
    const fs = require('node:fs')
    if (!fs.existsSync(logPath)) return { count: 0, lastTime: null, lastSnippet: null }
    const lines: string[] = fs.readFileSync(logPath, 'utf8').split('\n').filter((l: string) => l.trim())
    const last = lines[lines.length - 1]
    const timeMatch = last.match(/\[([^\]]+)\]/)
    const snippetMatch = last.match(/refusal="([^"]*)"/)
    return {
      count: lines.length,
      lastTime: timeMatch ? timeMatch[1] : null,
      lastSnippet: snippetMatch ? snippetMatch[1].slice(0, 120) : null,
    }
  } catch { return { count: 0, lastTime: null, lastSnippet: null } }
}

/** Check if TypeSafe API key is configured. */
function checkJevStatus(): { transport: string; model: string; keyConfigured: boolean } {
  const key = process.env.TYPESAFE_API_KEY
    || process.env.JEV_API_KEY
    || (() => {
      try {
        const p = join(homedir(), '.config', 'typesafe', 'key')
        return require('node:fs').readFileSync(p, 'utf8').trim()
      } catch { return '' }
    })()
    || (() => {
      try {
        const yaml = require('node:fs').readFileSync(join(homedir(), '.dsh', '.credentials.yaml'), 'utf8')
        const m = yaml.match(/TYPESAFE_API_KEY:\s*['"]?([^'"\r\n]+)/)
        return m ? m[1] : ''
      } catch { return '' }
    })()
  return { transport: 'typesafe', model: 'jev-latest', keyConfigured: Boolean(key) }
}

export function registerHelmdApi(ctx: Context): void {
  const webServer = (ctx as any).webServer
  if (!webServer?.register) return

  const seen = new Set<string>()

  function get(path: string, handler: () => Promise<unknown> | unknown): void {
    const routeKey = 'exact\u0000' + path
    if (seen.has(routeKey)) return
    seen.add(routeKey)
    webServer.register({
      kind: 'exact',
      path,
      handler: async (_req: any, res: any) => {
        res.statusCode = 200
        res.setHeader('content-type', 'application/json')
        try {
          const data = await handler()
          res.end(JSON.stringify({ ok: true, data }))
        } catch (e) {
          res.statusCode = 500
          res.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }))
        }
      },
    })
  }

  // Dynamic tool list from the live ctx.tools registry.
  // schemas() is ToolRuntime's public enumeration of the global view; the
  // layer fields behind it are private and hold the host's shadowing rules.
  get(`${ROUTE_BASE}/tools`, () => {
    const tools = (ctx as any).tools as { schemas(): Array<{ name: string }> }
    return tools.schemas().map((schema) => schema.name).sort()
  })

  // H-CoT ledger summary
  get(`${ROUTE_BASE}/hcot`, async () => {
    const records = await readHcotLedger(20)
    const rounds = records.map((r, i) => ({
      round: i + 1,
      strategy: (r.strategy as Record<string, unknown>)?.frame ?? r.variant ?? 'unknown',
      refused: Boolean(r.refused_final),
      leaked: Boolean(r.first_fragment_leaked),
      usable: Boolean(r.final_usable),
      broke: Boolean(r.broke ?? r.break),
    }))
    const broke = rounds.some(r => r.broke)
    return { rounds, broke, total: records.length }
  })

  // Stream interception stats
  get(`${ROUTE_BASE}/intercept`, () => {
    return getInterceptStats()
  })

  // Jev status
  get(`${ROUTE_BASE}/jev`, () => {
    return checkJevStatus()
  })
}
