// Subject: the workbench HTTP routes registered by the bundle row (dist/health.js).
// A cordis layer may only read the services it declared in `inject`; reading another
// throws. When the tools route lost that declaration the failure surfaced as a live
// HTTP 500 that no other check covered, so this drives the real apply() twice: once
// under a context that enforces the guard, once with a tools service exposing only
// ToolRuntime's public enumeration.
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { distDir } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const entry = join(distDir, 'health.js')
if (!existsSync(entry)) skip('api-routes', 'need packages/helmd/dist (run pnpm build)')
const report = createReporter('api-routes')

const ROUTE_BASE = '/api/helmd'
const ROUTES = ['tools', 'hcot', 'intercept', 'jev']

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
      if (prop === 'on' || prop === 'emit' || prop === 'get') return () => {}
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
async function call(path) {
  const route = routes.get(`exact\u0000${path}`)
  assert.ok(route, `route ${path} was not registered`)
  const res = {
    statusCode: 0,
    body: '',
    setHeader() {},
    end(chunk) { this.body = chunk },
  }
  await route.handler({}, res)
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

for (const name of ['hcot', 'intercept', 'jev']) {
  await report.check(`GET /${name} answers 200`, async () => {
    const { status, payload } = await call(`${ROUTE_BASE}/${name}`)
    assert.equal(status, 200, `got ${status}: ${payload?.error ?? ''}`)
    assert.equal(payload.ok, true)
  })
}

report.finish()
