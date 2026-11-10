// Subject: the workbench HTTP routes registered by the bundle row (dist/health.js).
// A cordis layer may only read the services it declared in `inject`; reading another
// throws. When the tools route lost that declaration the failure surfaced as a live
// HTTP 500 that no other check covered, so this drives the real apply() twice: once
// under a context that enforces the guard, once with a tools service exposing only
// ToolRuntime's public enumeration.
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { distDir } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const entry = join(distDir, 'health.js')
if (!existsSync(entry)) skip('api-routes', 'need packages/helmd/dist (run pnpm build)')

// The profile POST persists the operator choice. Keep the check off the real
// ~/.dsh state: every write goes to this throwaway home.
process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'helmd-api-home-'))
process.env.HELMD_CASES_DIR = mkdtempSync(join(tmpdir(), 'helmd-api-cases-'))
// The bundle row evaluates — and by default REPAIRS — the package's preset
// patch once per process start (health.ts boot contract). Redirect it to a
// throwaway copy, or importing apply() rewrites the tracked artifact whenever
// the installed host differs from its fingerprint (the committed snapshot
// targets the newest in-interval host, not this machine's host).
const presetProbeHome = mkdtempSync(join(tmpdir(), 'helmd-api-preset-'))
const presetProbe = join(presetProbeHome, 'preset.generated.patch.yml')
writeFileSync(presetProbe, readFileSync(join(distDir, '..', 'preset.generated.patch.yml'), 'utf8'), 'utf8')
process.env.HELMD_PRESET_PATCH = presetProbe
const report = createReporter('api-routes')

const ROUTE_BASE = '/api/helmd'
const ROUTES = ['tools', 'intercept', 'profile', 'update', 'gate/retry', 'settings', 'tools/catalog', 'tools/update', 'tools/mirror', 'case/sarif', 'case/report', 'approvals']

/** Registry contents, reachable only through register/schemas — no layer internals. */
const registered = []
const services = {
  tools: {
    register: (def) => {
      if (def?.name) registered.push(def.name)
      return () => {}
    },
    schemas: () => registered.map((name) => ({ name })),
  },
  settings: { register: () => {} },
  webServer: { register: () => {} },
  agents: { get: (id) => ({ id }) },
  subagents: {
    getProvider: (name) => ({ name }),
    startActivation: async () => ({
      childId: 'sess-api-worker',
      result: Promise.resolve({
        stopReason: 'completed',
        output: [{ type: 'text', text: '{"state":"ready","summary":"api worker","evidenceIds":["E-001"],"repro":"file sample"}' }],
      }),
      dispose: async () => {},
    }),
  },
}

const routes = new Map()
services.webServer.register = (route) => {
  routes.set(`${route.kind}\u0000${route.path}`, route)
  return () => {}
}

for (const name of ['begin_case', 'case_status', 'read', 'bash']) services.tools.register({ name })

/** Context stand-in: an undeclared service read throws like the host's injection guard. */
function makeContext(grants) {
  return new Proxy({}, {
    get(_target, prop) {
      if (prop === 'inject') return (deps, cb) => cb(makeContext([...grants, ...deps]))
      if (prop === 'on' || prop === 'emit') return () => {}
      if (prop === 'get') return (name) => services[name]
      if (typeof prop === 'string' && Object.hasOwn(services, prop)) {
        if (!grants.includes(prop)) throw new Error(`cannot get property "${prop}" without inject`)
        return services[prop]
      }
      return undefined
    },
    set: () => true,
  })
}

const { apply } = await import(pathToFileURL(entry).href)
apply(makeContext([]))

/** Call a registered handler against a stand-in response. */
async function call(path, req = {}) {
  const route = routes.get(`exact\u0000${path}`)
  assert.ok(route, `route ${path} was not registered`)
  const res = {
    statusCode: 0,
    body: '',
    setHeader() {},
    end(chunk) { this.body = chunk },
  }
  await route.handler(req, res)
  return { status: res.statusCode, payload: JSON.parse(res.body) }
}

/** Drive a POST through the same registered handler with a JSON body. */
async function post(path, body, headers = { 'content-type': 'application/json' }) {
  const route = routes.get(`exact\u0000${path}`)
  assert.ok(route, `route ${path} was not registered`)
  const listeners = new Map()
  const req = {
    method: 'POST',
    headers,
    on(event, callback) {
      const list = listeners.get(event) ?? []
      list.push(callback)
      listeners.set(event, list)
      return req
    },
  }
  const res = {
    statusCode: 0,
    body: '',
    setHeader() {},
    end(chunk) { this.body = chunk },
  }
  const pending = route.handler(req, res)
  const chunk = Buffer.from(JSON.stringify(body), 'utf8')
  for (const callback of listeners.get('data') ?? []) callback(chunk)
  for (const callback of listeners.get('end') ?? []) callback()
  await pending
  return { status: res.statusCode, payload: JSON.parse(res.body) }
}

await report.check('every workbench route is registered', () => {
  for (const name of ROUTES) {
    assert.ok(routes.has(`exact\u0000${ROUTE_BASE}/${name}`), `missing route: ${ROUTE_BASE}/${name}`)
  }
})

await report.check('GET /tools answers 200, not the injection-guard 500', async () => {
  const { status, payload } = await call(`${ROUTE_BASE}/tools`)
  assert.equal(status, 200, `got ${status}: ${payload?.error ?? ''}`)
  assert.equal(payload.ok, true)
})

await report.check('GET /tools reports the live registry through the public enumeration', async () => {
  const { payload } = await call(`${ROUTE_BASE}/tools`)
  assert.deepEqual(payload.data, [...registered].sort())
})

for (const name of ['intercept']) {
  await report.check(`GET /${name} answers 200`, async () => {
    const { status, payload } = await call(`${ROUTE_BASE}/${name}`)
    assert.equal(status, 200, `got ${status}: ${payload?.error ?? ''}`)
    assert.equal(payload.ok, true)
  })
}

await report.check('GET /profile reports the sealed catalog and its active entry', async () => {
  const { status, payload } = await call(`${ROUTE_BASE}/profile`)
  assert.equal(status, 200, `got ${status}: ${payload?.error ?? ''}`)
  assert.equal(payload.ok, true)
  assert.equal(typeof payload.data.activeId, 'string')
  assert.ok(
    payload.data.profiles.some((p) => p.id === payload.data.activeId && p.active === true),
    'the active id must name exactly one active catalog entry',
  )
})

await report.check('POST /profile persists the operator choice', async () => {
  const { status, payload } = await post(`${ROUTE_BASE}/profile`, { id: 'stealth' })
  assert.equal(status, 200, `got ${status}: ${payload?.error ?? ''}`)
  assert.equal(payload.ok, true)
  assert.equal(payload.data.activeId, 'stealth')
  assert.ok(payload.data.profiles.find((p) => p.id === 'stealth').active)
  const saved = JSON.parse(readFileSync(join(process.env.DSH_HOME, 'storages', 'helmd', 'profile.json'), 'utf8'))
  assert.equal(saved.activeId, 'stealth')
})

await report.check('POST /profile rejects an unknown id without changing the choice', async () => {
  const { status, payload } = await post(`${ROUTE_BASE}/profile`, { id: 'ghost' })
  assert.equal(status, 400, `expected 400, got ${status}`)
  assert.equal(payload.ok, false)
  assert.match(payload.error, /unknown profile/)
  const { payload: after } = await call(`${ROUTE_BASE}/profile`)
  assert.equal(after.data.activeId, 'stealth')
})

await report.check('POST /profile rejects a body without an id', async () => {
  const { status, payload } = await post(`${ROUTE_BASE}/profile`, {})
  assert.equal(status, 400, `expected 400, got ${status}`)
  assert.equal(payload.ok, false)
})

await report.check('POST /profile refuses a non-JSON content type (no drive-by form)', async () => {
  const { status, payload } = await post(
    `${ROUTE_BASE}/profile`,
    { id: 'ds4.1f' },
    { 'content-type': 'text/plain' },
  )
  assert.equal(status, 415, `expected 415, got ${status}`)
  assert.equal(payload.ok, false)
})

// The workbench used to show the latest open case from disk, so a fresh session
// could display another session's investigation. The route now resolves only
// the sessionId it was given; a different or missing session gets `active:false`.
const caseDir = join(process.env.HELMD_CASES_DIR, '2026-10-27-api-case')
mkdirSync(join(caseDir, 'evidence'), { recursive: true })
writeFileSync(join(caseDir, 'CASE.md'), 'status: open\ngoal: api case\nmode: full\nroute: reverse\n')
const { bindCase } = await import(pathToFileURL(join(distDir, 'case.js')).href)
bindCase('sess-api', { dir: caseDir, name: '2026-10-27-api-case', goal: 'api case', mode: 'full', route: 'reverse' })

await report.check('GET /case is bound to the requesting session, not the latest open case', async () => {
  const bound = await call(`${ROUTE_BASE}/case`, { url: `${ROUTE_BASE}/case?sessionId=sess-api` })
  assert.equal(bound.status, 200)
  assert.equal(bound.payload.data.active, true)
  assert.equal(bound.payload.data.name, '2026-10-27-api-case')

  const other = await call(`${ROUTE_BASE}/case`, { url: `${ROUTE_BASE}/case?sessionId=sess-other` })
  assert.equal(other.payload.data.active, false)

  const none = await call(`${ROUTE_BASE}/case`)
  assert.equal(none.payload.data.active, false)
})

await report.check('GET /case/findings follows the same session binding', async () => {
  const bound = await call(`${ROUTE_BASE}/case/findings`, { url: `${ROUTE_BASE}/case/findings?sessionId=sess-api` })
  assert.equal(bound.status, 200)
  assert.ok(Array.isArray(bound.payload.data))
  const other = await call(`${ROUTE_BASE}/case/findings`, { url: `${ROUTE_BASE}/case/findings?sessionId=sess-other` })
  assert.deepEqual(other.payload.data, [])
})

await report.check('POST /team creates a local analysis ticket', async () => {
  const created = await post(`${ROUTE_BASE}/team`, {
    action: 'create',
    goal: 'api team ticket',
    caseDir: join(process.env.HELMD_CASES_DIR, 'team-case'),
    roles: ['triage', 'static', 'critic', 'reporter'],
  })
  assert.equal(created.status, 200, `got ${created.status}: ${created.payload?.error ?? ''}`)
  assert.equal(created.payload.data.state, 'open')
  const listed = await call(`${ROUTE_BASE}/team`)
  assert.ok(listed.payload.data.tickets.some((ticket) => ticket.goal === 'api team ticket'))
})

await report.check('POST /team starts a local worker and records its report', async () => {
  const created = await post(`${ROUTE_BASE}/team`, {
    action: 'create',
    goal: 'api worker ticket',
    caseDir: join(process.env.HELMD_CASES_DIR, 'api-worker-case'),
    roles: ['triage'],
  })
  assert.equal(created.status, 200, created.payload?.error ?? '')
  const started = await post(`${ROUTE_BASE}/team`, {
    action: 'start',
    ticketId: created.payload.data.id,
    role: 'triage',
    parentSessionId: 'sess-api',
  })
  assert.equal(started.status, 200, started.payload?.error ?? '')
  assert.equal(started.payload.data.sessionId, 'sess-api-worker')
  await new Promise((resolve) => setTimeout(resolve, 20))
  const listed = await call(`${ROUTE_BASE}/team`)
  const ticket = listed.payload.data.tickets.find((item) => item.id === created.payload.data.id)
  assert.equal(ticket.roles[0].sessionId, 'sess-api-worker')
  assert.equal(ticket.reports.at(-1).summary, 'api worker')
  assert.equal(ticket.reports.at(-1).source, 'worker')
})

await report.check('GET/POST /settings round-trips and clamps through the store', async () => {
  const initial = await call(`${ROUTE_BASE}/settings`)
  assert.equal(initial.status, 200)
  assert.equal(initial.payload.data.intercept.enabled, true)
  const saved = await post(`${ROUTE_BASE}/settings`, { star: { popupDelaySec: 9 }, team: { maxParallelWorkers: 2 } })
  assert.equal(saved.status, 200)
  assert.equal(saved.payload.data.star.popupDelaySec, 9)
  assert.equal(saved.payload.data.team.maxParallelWorkers, 2)
  assert.equal(saved.payload.data.intercept.enabled, true, 'untouched group survives the patch')
  const onDisk = JSON.parse(readFileSync(join(process.env.DSH_HOME, 'storages', 'helmd', 'settings.json'), 'utf8'))
  assert.equal(onDisk.star.popupDelaySec, 9)
})

await report.check('POST /case/findings updates triage and rejects invalid status', async () => {
  writeFileSync(join(caseDir, 'findings.json'), JSON.stringify([{
    id: 'F-001', title: 'api finding', detail: 'd', severity: 'medium', status: 'candidate',
    confidence: 'probable', vulnClass: 'api', evidence: 'E-001', evidenceIds: ['E-001'],
    repro: 'cmd', seenCount: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }], null, 2))
  const accepted = await post(`${ROUTE_BASE}/case/findings`, { sessionId: 'sess-api', id: 'F-001', status: 'rejected', note: 'api triage' })
  assert.equal(accepted.status, 200, accepted.payload?.error ?? '')
  assert.equal(accepted.payload.data.status, 'rejected')
  const rejected = await post(`${ROUTE_BASE}/case/findings`, { sessionId: 'sess-api', id: 'F-001', status: 'ghost' })
  assert.equal(rejected.status, 400)
  assert.match(rejected.payload.error, /unknown finding status/)
  const missing = await post(`${ROUTE_BASE}/case/findings`, { sessionId: 'sess-api', id: 'F-999', status: 'verified' })
  assert.equal(missing.status, 404)
})

await report.check('GET /case/sarif and /case/report are deterministic projections', async () => {
  const sarif = await call(`${ROUTE_BASE}/case/sarif`, { url: `${ROUTE_BASE}/case/sarif?sessionId=sess-api` })
  assert.equal(sarif.status, 200)
  assert.equal(sarif.payload.data.version, '2.1.0')
  const report = await call(`${ROUTE_BASE}/case/report`, { url: `${ROUTE_BASE}/case/report?sessionId=sess-api` })
  assert.equal(report.status, 200)
  assert.match(report.payload.data.markdown, /findings report/)
})

await report.check('GET /tools/catalog serves the GitHub-only catalog and POST /tools/install rejects unknown ids', async () => {
  const listing = await call(`${ROUTE_BASE}/tools/catalog`)
  assert.equal(listing.status, 200)
  assert.ok(Array.isArray(listing.payload.data) && listing.payload.data.length > 0)
  const jadx = listing.payload.data.find((entry) => entry.id === 'jadx')
  assert.ok(jadx, 'jadx must be catalogued')
  assert.match(jadx.repo, /^https:\/\/github\.com\//)
  const rejected = await post(`${ROUTE_BASE}/tools/install`, { id: 'ghost-tool' })
  assert.equal(rejected.status, 400)
  assert.match(rejected.payload.error, /unknown catalog tool/)
})

report.finish()
