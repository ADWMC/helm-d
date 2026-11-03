// Helmd workbench API — HTTP routes for the client-side workbench tabs.
// Each route provides dynamic, real-time data that the client polls.
//
// Routes:
//   GET /api/helmd/health   → boot-time preset health verdict (host plane)
//   GET /api/helmd/tools    → dynamic tool list from ctx.tools registry
//   GET /api/helmd/intercept → stream interception stats (count, last time, snippet)
//   GET /api/helmd/profile   → armor profile catalog + active id
//   POST /api/helmd/profile  → hot-switch the active armor profile {"id":"..."}
//   GET /api/helmd/update    → installed vs latest release (GitHub → npm)
//   GET /api/helmd/gate/retry → clear a hold/backoff and request a new device code

import type { Context } from '@deepseek-ai/cordis'
import { homedir } from 'node:os'
import { join } from 'node:path'
import fs from 'node:fs'
import { gateStatus, retryFlow, skipThisLaunch, switchProfile } from './gate.js'
import { profileStatus } from './profile.js'
import { checkForUpdate } from './update-check.js'
import { listCasesOnDisk, loadHypotheses, countEvidence, loadFindings, listEvidence, getCase } from './case.js'
import {
  createTicket, assignRole, recordReport, recordHandoff, closeTicket, teamStatus,
  proposeRevision, evaluateRevision, activateRevision, rollbackRevision, listRevisions,
  type ArtifactKind, type ReportState, type TeamRole,
} from './team.js'
import { startTeamWorker } from './team-worker.js'
import { loadSettings, saveSettings } from './settings.js'

const ROUTE_BASE = '/api/helmd'

/** An error carrying the HTTP status the route should answer with. */
class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

/** Read one small JSON body (localhost workbench calls; 8 KiB is generous). */
function readJsonBody(req: unknown, limit = 8192): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const stream = req as { on?: (event: string, cb: (arg: never) => void) => void } | null | undefined
    if (stream === null || stream === undefined || typeof stream.on !== 'function') {
      reject(new HttpError(400, 'request body unavailable'))
      return
    }
    let size = 0
    const chunks: Buffer[] = []
    stream.on('data', (chunk: Buffer | string) => {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
      size += buf.length
      if (size > limit) {
        reject(new HttpError(413, `request body exceeds ${limit} bytes`))
        return
      }
      chunks.push(buf)
    })
    stream.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8')
        resolve(text.trim() === '' ? undefined : JSON.parse(text))
      } catch {
        reject(new HttpError(400, 'body must be JSON: {"id":"<profile>"}'))
      }
    })
    stream.on('error', (error: Error) => reject(new HttpError(400, error.message)))
  })
}

/** Require a JSON body for state-changing local routes. */
function requireJson(req: unknown): void {
  const contentType = String((req as { headers?: Record<string, unknown> } | null | undefined)?.headers?.['content-type'] ?? '')
  if (!/^application\/json\b/i.test(contentType)) {
    throw new HttpError(415, 'content-type must be application/json')
  }
}

/** Read one query parameter from the request URL (the workbench passes sessionId). */
function queryParam(req: unknown, name: string): string | undefined {
  const url = String((req as { url?: unknown } | null | undefined)?.url ?? '')
  const q = url.indexOf('?')
  if (q < 0) return undefined
  try {
    const value = new URLSearchParams(url.slice(q + 1)).get(name)
    return value !== null && value.trim() !== '' ? value.trim() : undefined
  } catch {
    return undefined
  }
}

/** Read stream intercept stats from the llm-stream-hook's in-memory counters. */
function getInterceptStats(): { count: number; lastTime: string | null; lastSnippet: string | null } {
  try {
    // llm-stream-hook.js exports getStreamInterceptionStats
    // But we can't import it directly (circular). Read from the log file instead.
    const dshHome = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh')
    const logPath = join(dshHome, 'helmd-stream-intercept.log')
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

export function registerHelmdApi(ctx: Context, getHealth?: () => unknown): void {
  const webServer = (ctx as any).webServer
  if (!webServer?.register) return

  const seen = new Set<string>()

  /** Register one exact route; the handler receives the request so a single
   *  path can branch on method (the host route table keys on path only). */
  function route(path: string, handler: (req: any) => Promise<unknown> | unknown): void {
    const routeKey = 'exact\u0000' + path
    if (seen.has(routeKey)) return
    seen.add(routeKey)
    webServer.register({
      kind: 'exact',
      path,
      handler: async (req: any, res: any) => {
        res.setHeader('content-type', 'application/json')
        try {
          const data = await handler(req)
          res.statusCode = 200
          res.end(JSON.stringify({ ok: true, data }))
        } catch (e) {
          res.statusCode = e instanceof HttpError ? e.status : 500
          res.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }))
        }
      },
    })
  }

  function get(path: string, handler: (req: any) => Promise<unknown> | unknown): void {
    route(path, (req) => handler(req))
  }

  // Boot-time health verdict, evaluated once by the host plane (health.ts).
  // Derived state rides HTTP, not the settings document: 0.1.7 settings only
  // carries Config schemas, and a read-only snapshot is not configuration.
  if (getHealth) {
    get(`${ROUTE_BASE}/health`, () => getHealth())
  }

  // On-demand release check. Network failures come back in `error`, not 500,
  // so the About tab can render the reason and the Releases link.
  get(`${ROUTE_BASE}/update`, () => checkForUpdate())

  // Dynamic tool list from the live ctx.tools registry.
  // schemas() is ToolRuntime's public enumeration of the global view; the
  // layer fields behind it are private and hold the host's shadowing rules.
  get(`${ROUTE_BASE}/tools`, () => {
    const tools = (ctx as any).tools as { schemas(): Array<{ name: string }> }
    return tools.schemas().map((schema) => schema.name).sort()
  })

  // Stream interception stats
  get(`${ROUTE_BASE}/intercept`, () => {
    return getInterceptStats()
  })

  // Star gate: status snapshot + skip-for-this-launch (web gate panel data).
  get(`${ROUTE_BASE}/gate`, () => {
    return gateStatus()
  })
  get(`${ROUTE_BASE}/gate/skip`, () => {
    skipThisLaunch()
    return gateStatus()
  })
  get(`${ROUTE_BASE}/gate/retry`, () => retryFlow())

  // Armor profile switch. GET enumerates the sealed catalog and marks the
  // active entry; POST swaps the live persona section (no host restart).
  route(`${ROUTE_BASE}/profile`, async (req) => {
    const method = String(req?.method ?? 'GET').toUpperCase()
    if (method !== 'POST') return profileStatus()
    // A cross-origin fetch cannot set this header without a CORS preflight we
    // never answer; a plain form cannot send JSON. That keeps a drive-by page
    // from flipping the operator's persona.
    const contentType = String(req?.headers?.['content-type'] ?? '')
    if (!/^application\/json\b/i.test(contentType)) {
      throw new HttpError(415, 'content-type must be application/json')
    }
    const body = await readJsonBody(req)
    const id = (body as { id?: unknown } | undefined)?.id
    if (typeof id !== 'string' || id.trim() === '') {
      throw new HttpError(400, 'body must be JSON: {"id":"<profile>"}')
    }
    try {
      return switchProfile(id.trim())
    } catch (e) {
      throw new HttpError(400, e instanceof Error ? e.message : String(e))
    }
  })

  // Case status: the case bound to THIS session. There is deliberately no
  // "latest open case" fallback — that made the workbench show an unrelated
  // session's investigation. Unbound sessions get a recent-case list instead.
  get(`${ROUTE_BASE}/case`, async (req) => {
    const sessionId = queryParam(req, 'sessionId')
    const active = sessionId ? getCase(sessionId) : undefined
    if (active) {
      const hyps = await loadHypotheses(active.dir)
      const evCount = await countEvidence(active.dir)
      return {
        active: true,
        sessionId,
        name: active.name, dir: active.dir, goal: active.goal, mode: active.mode,
        evidenceCount: evCount,
        hypotheses: hyps.map((h) => ({ id: h.id, statement: h.statement.slice(0, 100), status: h.status, evidenceIds: h.evidenceIds })),
        openHypotheses: hyps.filter((h) => h.status === 'open').length,
      }
    }
    const cases = await listCasesOnDisk()
    return {
      active: false,
      sessionId: sessionId ?? null,
      cases: cases.slice(0, 5).map((c) => ({
        name: c.name, status: c.status, goal: c.goal, evidenceCount: c.evidenceCount,
      })),
    }
  })

  // Team collaboration: local tickets/assignments/reports/handoffs.
  route(`${ROUTE_BASE}/team`, async (req) => {
    const method = String(req?.method ?? 'GET').toUpperCase()
    if (method !== 'POST') return teamStatus()
    requireJson(req)
    const body = await readJsonBody(req) as Record<string, unknown> | undefined
    const action = String(body?.action ?? '')
    try {
      if (action === 'create') {
        // Workbench tickets may exist without a bound case; give them a stable
        // workspace under the helmd storage so child workers still get a cwd.
        let caseDir = String(body?.caseDir ?? '').trim()
        if (caseDir === '') {
          const home = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh')
          caseDir = join(home, 'storages', 'helmd', 'team', 'standalone')
          fs.mkdirSync(caseDir, { recursive: true })
        }
        return createTicket({
          goal: String(body?.goal ?? ''),
          caseDir,
          roles: Array.isArray(body?.roles) ? body.roles.map(String) as TeamRole[] : undefined,
          roleDeps: body?.roleDeps !== null && typeof body?.roleDeps === 'object'
            ? body.roleDeps as Partial<Record<TeamRole, TeamRole[]>>
            : undefined,
          revision: typeof body?.revision === 'number' ? body.revision : undefined,
        })
      }
      if (action === 'assign') {
        return assignRole(String(body?.ticketId ?? ''), String(body?.role ?? '') as TeamRole, String(body?.sessionId ?? ''))
      }
      if (action === 'start') {
        const started = await startTeamWorker({
          ctx,
          ticketId: String(body?.ticketId ?? ''),
          role: String(body?.role ?? '') as TeamRole,
          task: typeof body?.task === 'string' ? body.task : undefined,
          parentSessionId: String(body?.parentSessionId ?? ''),
        })
        return { ticketId: started.ticketId, role: started.role, sessionId: started.sessionId }
      }
      if (action === 'report') {
        return recordReport({
          ticketId: String(body?.ticketId ?? ''),
          role: String(body?.role ?? '') as TeamRole,
          state: String(body?.state ?? 'progress') as ReportState,
          summary: String(body?.summary ?? ''),
          evidenceIds: Array.isArray(body?.evidenceIds) ? body.evidenceIds.map(String) : undefined,
          repro: typeof body?.repro === 'string' ? body.repro : undefined,
          budget: typeof body?.budget === 'number' ? body.budget : undefined,
        })
      }
      if (action === 'handoff') {
        return recordHandoff({
          ticketId: String(body?.ticketId ?? ''),
          from: String(body?.from ?? '') as TeamRole,
          to: String(body?.to ?? '') as TeamRole,
          question: String(body?.question ?? ''),
        })
      }
      if (action === 'close') {
        const outcome = body?.outcome === 'dropped' ? 'dropped' : 'done'
        return closeTicket(String(body?.ticketId ?? ''), outcome)
      }
      throw new Error(`unknown team action: ${action || '(empty)'}`)
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : String(error))
    }
  })

  // Versioned team artifacts + eval gate.
  route(`${ROUTE_BASE}/team/versions`, async (req) => {
    const method = String(req?.method ?? 'GET').toUpperCase()
    if (method !== 'POST') {
      const kind = queryParam(req, 'kind') as ArtifactKind | undefined
      const id = queryParam(req, 'id')
      return { revisions: listRevisions(kind, id), status: teamStatus() }
    }
    requireJson(req)
    const body = await readJsonBody(req, 65536) as Record<string, unknown> | undefined
    const action = String(body?.action ?? '')
    try {
      const kind = String(body?.kind ?? '') as ArtifactKind
      const id = String(body?.id ?? '')
      if (action === 'propose') {
        return proposeRevision({ kind, id, value: String(body?.value ?? ''), source: String(body?.source ?? 'local') })
      }
      if (action === 'evaluate') {
        const revision = Number(body?.revision ?? 0)
        const baseline = body?.baseline
        const candidate = body?.candidate
        if (typeof baseline !== 'object' || baseline === null || typeof candidate !== 'object' || candidate === null) {
          throw new Error('baseline and candidate metric objects are required')
        }
        return evaluateRevision({ kind, id, revision, baseline: baseline as Record<string, number>, candidate: candidate as Record<string, number> })
      }
      if (action === 'activate') {
        return activateRevision(kind, id, Number(body?.revision ?? 0))
      }
      if (action === 'rollback') {
        return rollbackRevision(kind, id)
      }
      throw new Error(`unknown version action: ${action || '(empty)'}`)
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : String(error))
    }
  })

  // Operator settings: the workbench 设置 tab reads and patches this store;
  // the DSH settings page edits the same values through the row Config at boot.
  route(`${ROUTE_BASE}/settings`, async (req) => {
    const method = String(req?.method ?? 'GET').toUpperCase()
    if (method !== 'POST') return loadSettings()
    requireJson(req)
    const body = await readJsonBody(req, 16384)
    return saveSettings(body)
  })

  // Hypotheses for the session-bound case.
  get(`${ROUTE_BASE}/case/hypotheses`, async (req) => {
    const sessionId = queryParam(req, 'sessionId')
    const active = sessionId ? getCase(sessionId) : undefined
    return active ? loadHypotheses(active.dir) : []
  })

  // Findings for the session-bound case.
  get(`${ROUTE_BASE}/case/findings`, async (req) => {
    const sessionId = queryParam(req, 'sessionId')
    const active = sessionId ? getCase(sessionId) : undefined
    return active ? loadFindings(active.dir) : []
  })

  // Evidence list for the session-bound case.
  get(`${ROUTE_BASE}/case/evidence`, async (req) => {
    const sessionId = queryParam(req, 'sessionId')
    const active = sessionId ? getCase(sessionId) : undefined
    return active ? listEvidence(active.dir) : []
  })

}
