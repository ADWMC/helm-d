// Local OOB callback listener (T-15). Lab-only, loopback, in-process.
// The model gets a one-time URL/token, places it in a payload, then polls for
// hits. No external service and no target-side listener.

import { createServer, type Server } from 'node:http'
import { randomBytes } from 'node:crypto'

export interface OobHit {
  method: string
  url: string
  headers: Record<string, string | string[] | undefined>
  body: string
  at: string
}

export interface OobSession {
  id: string
  url: string
  createdAt: string
  expiresAt: string
  hits: OobHit[]
  server: Server
  timer: NodeJS.Timeout
}

const sessions = new Map<string, OobSession>()

function close(session: OobSession): void {
  clearTimeout(session.timer)
  try { session.server.close() } catch { /* already closed */ }
  sessions.delete(session.id)
}

export async function startOob(ttlMs = 5 * 60 * 1000): Promise<{ id: string; url: string; expiresAt: string }> {
  const id = randomBytes(8).toString('hex')
  const server = createServer((req, res) => {
    const session = sessions.get(id)
    if (session === undefined) { res.writeHead(404); res.end('gone'); return }
    let body = ''
    req.on('data', (chunk) => { body += chunk; if (body.length > 64 * 1024) req.destroy() })
    req.on('end', () => {
      session.hits.push({
        method: req.method ?? 'GET',
        url: req.url ?? '/',
        headers: req.headers,
        body: body.slice(0, 4096),
        at: new Date().toISOString(),
      })
      res.writeHead(200, { 'content-type': 'text/plain' })
      res.end('ok')
    })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })
  const address = server.address()
  if (address === null || typeof address === 'string') {
    server.close()
    throw new Error('OOB listener failed to bind')
  }
  const expiresAt = new Date(Date.now() + Math.max(10_000, Math.min(ttlMs, 15 * 60 * 1000))).toISOString()
  let timer: NodeJS.Timeout
  const session: OobSession = {
    id,
    url: `http://127.0.0.1:${address.port}/${id}`,
    createdAt: new Date().toISOString(),
    expiresAt,
    hits: [],
    server,
    timer: setTimeout(() => { const current = sessions.get(id); if (current !== undefined) close(current) }, ttlMs),
  }
  timer = session.timer
  timer.unref?.()
  sessions.set(id, session)
  return { id, url: session.url, expiresAt }
}

export function pollOob(id: string): OobHit[] {
  const session = sessions.get(id)
  if (session === undefined) throw new Error(`unknown or expired OOB session: ${id}`)
  return session.hits.slice()
}

export function stopOob(id: string): boolean {
  const session = sessions.get(id)
  if (session === undefined) return false
  close(session)
  return true
}

export function oobCount(): number {
  return sessions.size
}
