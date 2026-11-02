// GitHub star gate (route B: device flow, zero scopes, token discarded).
// Flow: start device session → user authorizes + stars ADWMC/helm-d → poll for
// token → check star → throw the token away, keep only {starred, checkedAt, login}.
// No server, no anti-bypass (operator ruling): the gate is an honor system with a
// real GitHub-side check at unlock time.
//
// Transport note: native fetch ignores proxy settings, so a machine that reaches
// GitHub only through a proxy got "fetch failed" and a panel stuck at 生成中…
// Every request here goes through requestText(), which honours HTTPS_PROXY /
// ALL_PROXY / NO_PROXY and, on Windows, the system proxy from the registry.

import { execFileSync } from 'node:child_process'
import { request as httpRequest, type IncomingMessage } from 'node:http'
import { request as httpsRequest, Agent } from 'node:https'
import type { Socket } from 'node:net'
import { connect as tlsConnect, type TLSSocket } from 'node:tls'

const CLIENT_ID = 'Ov23ct3hO35wKo09MMvt'
const REPO = 'ADWMC/helm-d'
const GH = 'https://github.com'
const API = 'https://api.github.com'
const REQUEST_TIMEOUT_MS = 20_000

export interface DeviceSession {
  deviceCode: string
  userCode: string
  verificationUri: string
  expiresAt: number
  intervalMs: number
}

export interface GateState {
  starred: boolean
  checkedAt: string
  login?: string
}

// ── proxy resolution ──────────────────────────────────────────────────────
const PROXY_ENV_KEYS = [
  'HTTPS_PROXY', 'https_proxy',
  'ALL_PROXY', 'all_proxy',
  'HTTP_PROXY', 'http_proxy',
] as const

let cachedSystemProxy: string | null | undefined

function parseProxy(raw: string | undefined): URL | undefined {
  if (raw === undefined) return undefined
  const trimmed = raw.trim()
  if (trimmed === '') return undefined
  try {
    return new URL(trimmed.includes('://') ? trimmed : `http://${trimmed}`)
  } catch {
    return undefined
  }
}

/** NO_PROXY entries: exact host, `.suffix`, `suffix`, optional `:port`, `*`. */
function bypassed(host: string, list: string | undefined): boolean {
  if (list === undefined || list.trim() === '') return false
  const lower = host.toLowerCase()
  for (const rawEntry of list.split(',')) {
    const entry = rawEntry.trim().toLowerCase()
    if (entry === '') continue
    if (entry === '*') return true
    const bare = entry.replace(/:\d+$/, '').replace(/^\./, '')
    if (bare === '') continue
    if (lower === bare || lower.endsWith(`.${bare}`)) return true
  }
  return false
}

/** Windows system proxy (HKCU Internet Settings). Cached — one probe per process. */
function windowsSystemProxy(): string | undefined {
  if (cachedSystemProxy !== undefined) return cachedSystemProxy ?? undefined
  cachedSystemProxy = null
  if (process.platform !== 'win32') return undefined
  const key = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'
  try {
    const enabled = execFileSync('reg', ['query', key, '/v', 'ProxyEnable'], {
      encoding: 'utf8', windowsHide: true,
    })
    cachedSystemProxy = null
    if (!/ProxyEnable\s+REG_DWORD\s+0x1/i.test(enabled)) return undefined
    const server = execFileSync('reg', ['query', key, '/v', 'ProxyServer'], {
      encoding: 'utf8', windowsHide: true,
    })
    const value = /ProxyServer\s+REG_SZ\s+(\S+)/i.exec(server)?.[1]
    if (value === undefined) return undefined
    // "host:port" or "http=host:port;https=host:port"
    const chosen = value.includes('=')
      ? (/(?:^|;)https=([^;]+)/i.exec(value)?.[1] ?? /(?:^|;)http=([^;]+)/i.exec(value)?.[1] ?? value)
      : value
    const trimmed = chosen.trim()
    cachedSystemProxy = trimmed === '' ? null : trimmed
    return cachedSystemProxy ?? undefined
  } catch {
    return undefined
  }
}

function resolveProxy(targetHost: string): URL | undefined {
  if (bypassed(targetHost, process.env.NO_PROXY ?? process.env.no_proxy)) return undefined
  for (const key of PROXY_ENV_KEYS) {
    const proxy = parseProxy(process.env[key])
    if (proxy !== undefined) return proxy
  }
  return parseProxy(windowsSystemProxy())
}

// ── proxy-aware transport ─────────────────────────────────────────────────
export interface RawResponse {
  status: number
  text: string
}

function connectViaProxy(proxy: URL, host: string, port: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const secureProxy = proxy.protocol === 'https:'
    const requestFn = secureProxy ? httpsRequest : httpRequest
    const headers: Record<string, string> = { host: `${host}:${port}` }
    if (proxy.username !== '' || proxy.password !== '') {
      const credentials = `${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`
      headers['proxy-authorization'] = `Basic ${Buffer.from(credentials).toString('base64')}`
    }
    const req = requestFn({
      host: proxy.hostname,
      port: Number(proxy.port || (secureProxy ? 443 : 80)),
      method: 'CONNECT',
      path: `${host}:${port}`,
      headers,
      timeout: REQUEST_TIMEOUT_MS,
    })
    req.once('connect', (res: IncomingMessage, socket: Socket, head: Buffer) => {
      if (res.statusCode !== 200) {
        socket.destroy()
        reject(new Error(`proxy CONNECT refused: HTTP ${String(res.statusCode)}`))
        return
      }
      if (head.length > 0) socket.unshift(head)
      resolve(socket)
    })
    req.once('timeout', () => req.destroy(new Error('proxy CONNECT timed out')))
    req.once('error', reject)
    req.end()
  })
}

function wrapTls(socket: Socket, host: string): Promise<TLSSocket> {
  return new Promise((resolve, reject) => {
    const tls = tlsConnect({ socket, servername: host, ALPNProtocols: ['http/1.1'] })
    tls.once('secureConnect', () => resolve(tls))
    tls.once('error', reject)
  })
}

/** Single-use agent that hands the request the already-established tunnel. */
function tunnelAgent(socket: TLSSocket): Agent {
  const agent = new Agent({ keepAlive: false, maxSockets: 1 })
  ;(agent as unknown as { createConnection: () => TLSSocket }).createConnection = () => socket
  return agent
}

export async function requestText(
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
): Promise<RawResponse> {
  const target = new URL(url)
  const secure = target.protocol === 'https:'
  const port = Number(target.port || (secure ? 443 : 80))
  const path = `${target.pathname}${target.search}`
  // GitHub REST API rejects requests without a User-Agent (403). Native fetch
  // added one implicitly; http.request does not, so send it explicitly here.
  const headers: Record<string, string> = { 'user-agent': 'helm-d', host: target.host, ...init.headers }
  const proxy = resolveProxy(target.hostname)
  let agent: Agent | undefined
  if (proxy !== undefined) {
    const raw = await connectViaProxy(proxy, target.hostname, port)
    agent = tunnelAgent(secure ? await wrapTls(raw, target.hostname) : (raw as unknown as TLSSocket))
  }
  return await new Promise<RawResponse>((resolve, reject) => {
    const requestFn = secure ? httpsRequest : httpRequest
    const req = requestFn({
      host: target.hostname,
      port,
      path,
      method: init.method,
      headers,
      timeout: REQUEST_TIMEOUT_MS,
      ...(agent !== undefined ? { agent } : {}),
    }, (res: IncomingMessage) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.once('end', () => {
        resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8') })
      })
      res.once('error', reject)
    })
    req.once('timeout', () => req.destroy(new Error(`request timed out: ${target.hostname}`)))
    req.once('error', reject)
    if (init.body !== undefined) req.write(init.body)
    req.end()
  })
}

const jsonHeaders = { accept: 'application/json', 'content-type': 'application/json' }

async function ghJson(url: string, body: Record<string, string>): Promise<any> {
  const response = await requestText(url, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(body),
  })
  try {
    return JSON.parse(response.text)
  } catch {
    throw new Error(`GitHub returned HTTP ${String(response.status)} with non-JSON body`)
  }
}

export async function startDeviceFlow(): Promise<DeviceSession> {
  const data = await ghJson(`${GH}/login/device/code`, { client_id: CLIENT_ID, scope: '' })
  if (data.error !== undefined) throw new Error(`device-flow start: ${String(data.error)}`)
  return {
    deviceCode: String(data.device_code),
    userCode: String(data.user_code),
    verificationUri: String(data.verification_uri ?? 'https://github.com/login/device'),
    expiresAt: Date.now() + Number(data.expires_in ?? 900) * 1000,
    intervalMs: Math.max(5, Number(data.interval ?? 5)) * 1000,
  }
}

export type PollResult =
  | { kind: 'pending' }
  | { kind: 'slow-down'; intervalMs: number }
  | { kind: 'expired' }
  | { kind: 'ok'; accessToken: string }

export async function pollForToken(session: DeviceSession): Promise<PollResult> {
  const data = await ghJson(`${GH}/login/oauth/access_token`, {
    client_id: CLIENT_ID,
    device_code: session.deviceCode,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
  })
  if (typeof data.error !== 'string') return { kind: 'ok', accessToken: String(data.access_token) }
  if (data.error === 'authorization_pending') return { kind: 'pending' }
  if (data.error === 'slow_down') return { kind: 'slow-down', intervalMs: 5000 }
  if (data.error === 'expired_token') return { kind: 'expired' }
  throw new Error(`device-flow poll: ${String(data.error)}`)
}

/** 204 = starred; 404 = not. Anything else throws. */
export async function checkStarred(accessToken: string): Promise<boolean> {
  const response = await requestText(`${API}/user/starred/${REPO}`, {
    method: 'GET',
    headers: { authorization: `Bearer ${accessToken}`, accept: 'application/vnd.github+json' },
  })
  if (response.status === 204) return true
  if (response.status === 404) return false
  throw new Error(`star check HTTP ${String(response.status)}`)
}

export async function fetchLogin(accessToken: string): Promise<string | undefined> {
  const response = await requestText(`${API}/user`, {
    method: 'GET',
    headers: { authorization: `Bearer ${accessToken}`, accept: 'application/vnd.github+json' },
  })
  if (response.status < 200 || response.status >= 300) return undefined
  try {
    const data = JSON.parse(response.text) as { login?: string }
    return typeof data.login === 'string' ? data.login : undefined
  } catch {
    return undefined
  }
}

/** Full unlock sequence: device session → poll (bounded) → token → star watch.
 *  The token lives IN MEMORY ONLY for the star-watch window. First star fires
 *  onUnlocked (no prompt swap: the caller only persists state); the token is
 *  dropped at the end. */
export async function verifyStar(
  session: DeviceSession,
  signal?: AbortSignal,
  onUnlocked?: (state: GateState) => void,
): Promise<GateState> {
  let intervalMs = session.intervalMs
  const deadline = session.expiresAt
  let accessToken: string | undefined
  let login: string | undefined
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error('aborted')
    const poll = await pollForToken(session)
    if (poll.kind === 'ok') {
      accessToken = poll.accessToken
      login = await fetchLogin(accessToken)
      break
    }
    if (poll.kind === 'expired') throw new Error('device code expired — restart the flow')
    if (poll.kind === 'slow-down') intervalMs += poll.intervalMs
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  if (accessToken === undefined) throw new Error('device code expired — restart the flow')
  // Star watch: check immediately, then every 30s until the session deadline
  // plus a 15-minute grace window. First star → onUnlocked fires.
  const watchDeadline = Date.now() + 15 * 60_000
  while (Date.now() < watchDeadline) {
    if (signal?.aborted) throw new Error('aborted')
    const starred = await checkStarred(accessToken)
    const state: GateState = { starred, checkedAt: new Date().toISOString(), login }
    if (starred) {
      // Token discarded here — nothing credential-shaped is returned or stored.
      if (onUnlocked !== undefined) onUnlocked(state)
      return state
    }
    await new Promise((resolve) => setTimeout(resolve, 30_000))
  }
  return { starred: false, checkedAt: new Date().toISOString(), login }
}
