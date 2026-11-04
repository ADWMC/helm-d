// Recon tools (T-14): passive DNS, TCP connect ports, HTTP baseline, crawl and
// parser import. No bundled scanner binary; every network target passes the
// case scope fence and private/loopback targets require an explicit lab flag.

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { readFileSync } from 'node:fs'
import { requestText } from '../star-gate.js'
import { getCase, saveEvidence } from '../case.js'
import {
  ReconLimiter, addAsset, addAssets, checkReconTarget, coverageLine, loadAssets,
  parseHttpxJsonl, parseNmapXml, parseNucleiJsonl,
} from '../recon.js'

interface ExecLike { agent?: { id?: string } }

const limiter = new ReconLimiter(1, 4)

function hostOf(target: string): string {
  try { return new URL(target.includes('://') ? target : `http://${target}`).hostname } catch { return target }
}

function requireScope(exec: ExecLike | undefined, target: string, lab: boolean): { dir: string; scope: string[] } {
  const active = getCase(exec?.agent?.id)
  if (active === undefined) throw new Error('no active case; begin_case(scope=[...]) first')
  const decision = checkReconTarget(hostOf(target), active.scope ?? [], lab)
  if (!decision.ok) throw new Error(decision.reason ?? 'target rejected')
  return { dir: active.dir, scope: active.scope ?? [] }
}

async function saveRaw(dir: string, tool: string, content: string): Promise<string> {
  const result = await saveEvidence(dir, tool, content, `${tool} output`)
  return result.id
}

async function httpGet(url: string): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  const response = await requestText(url, { method: 'GET', headers: { accept: 'text/html,application/json;q=0.9,*/*;q=0.8' } })
  return { status: response.status, headers: {}, body: response.text.slice(0, 512 * 1024) }
}

export function registerReconTools(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'recon_passive',
    description: 'Passive recon via DNS-over-HTTPS (A/AAAA) for one in-scope domain. Read-only; no port scan.',
    parameters: {
      domain: { type: 'string', required: true, description: 'In-scope domain, e.g. example.com.' },
      lab: { type: 'boolean', description: 'Allow private/loopback targets (authorized lab only).' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { domain: string; lab?: boolean }, exec?: ExecLike) {
      const domain = args.domain.trim().toLowerCase()
      const { dir } = requireScope(exec, domain, args.lab === true)
      const response = await requestText(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`, {
        method: 'GET', headers: { accept: 'application/dns-json' },
      })
      const evidenceId = await saveRaw(dir, 'recon_dns', response.text)
      let parsed: { Answer?: Array<{ name?: string; data?: string; type?: number }> } = {}
      try { parsed = JSON.parse(response.text) as typeof parsed } catch { /* non-JSON DoH error */ }
      const rows = (parsed.Answer ?? []).filter((answer) => answer.type === 1 && typeof answer.data === 'string')
      addAsset(dir, { kind: 'domain', value: domain, source: 'doh', evidenceId })
      addAssets(dir, rows.map((answer) => ({
        kind: 'host' as const,
        value: String(answer.data),
        parent: domain,
        source: 'doh',
        evidenceId,
      })))
      return [`recon_passive ${domain}: ${rows.length} A record(s)`, `evidence: ${evidenceId}`, coverageLine(loadAssets(dir))].join('\n')
    },
  }))

  ctx.tools.register(defineTool({
    name: 'recon_ports',
    description: 'TCP connect scan of a small explicit port list on one in-scope host. No raw sockets, no shellcode, 1 rps.',
    parameters: {
      target: { type: 'string', required: true, description: 'In-scope hostname or IP.' },
      ports: { type: 'array', items: { type: 'number' }, description: 'Ports (default 22,80,443,445,3389,8080).' },
      lab: { type: 'boolean', description: 'Allow private/loopback targets (authorized lab only).' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { target: string; ports?: number[]; lab?: boolean }, exec?: ExecLike) {
      const target = args.target.trim()
      const { dir } = requireScope(exec, target, args.lab === true)
      const ports = [...new Set((args.ports ?? [22, 80, 443, 445, 3389, 8080]).map(Number).filter((port) => Number.isInteger(port) && port > 0 && port < 65536))]
      const net = await import('node:net')
      const open: number[] = []
      await limiter.acquire(hostOf(target))
      try {
        await Promise.all(ports.map((port) => new Promise<void>((resolve) => {
          const socket = net.connect({ host: target, port, timeout: 3000 })
          socket.once('connect', () => { open.push(port); socket.destroy(); resolve() })
          socket.once('timeout', () => { socket.destroy(); resolve() })
          socket.once('error', () => resolve())
        })))
      } finally {
        limiter.release()
      }
      open.sort((a, b) => a - b)
      const evidenceId = await saveRaw(dir, 'recon_ports', `target=${target}\nports=${ports.join(',')}\nopen=${open.join(',')}\n`)
      addAsset(dir, { kind: 'host', value: target, source: 'connect-scan', evidenceId })
      addAssets(dir, open.map((port) => ({ kind: 'port' as const, value: String(port), parent: target, source: 'connect-scan', evidenceId })))
      return [`recon_ports ${target}: open ${open.join(',') || '(none)'}`, `evidence: ${evidenceId}`, coverageLine(loadAssets(dir))].join('\n')
    },
  }))

  ctx.tools.register(defineTool({
    name: 'recon_http',
    description: 'One in-scope HTTP GET baseline with a small technology fingerprint. Read-only; no fuzzing.',
    parameters: {
      url: { type: 'string', required: true, description: 'In-scope http(s) URL.' },
      lab: { type: 'boolean', description: 'Allow private/loopback targets (authorized lab only).' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { url: string; lab?: boolean }, exec?: ExecLike) {
      const url = args.url.trim()
      const { dir } = requireScope(exec, url, args.lab === true)
      await limiter.acquire(hostOf(url))
      let response: { status: number; body: string }
      try { response = await httpGet(url) } finally { limiter.release() }
      const tech: string[] = []
      const body = response.body
      if (/wp-content|wordpress/i.test(body)) tech.push('wordpress')
      if (/__NEXT_DATA__|_next\//i.test(body)) tech.push('nextjs')
      if (/ng-version|angular/i.test(body)) tech.push('angular')
      if (/react|__REACT_DEVTOOLS/i.test(body)) tech.push('react')
      if (/vue(?:\.js)?|__VUE__/i.test(body)) tech.push('vue')
      if (/jquery/i.test(body)) tech.push('jquery')
      const evidenceId = await saveRaw(dir, 'recon_http', `${url}\nstatus=${response.status}\ntech=${tech.join(',')}\n\n${body.slice(0, 64 * 1024)}`)
      addAsset(dir, { kind: 'url', value: url, source: 'http-get', evidenceId })
      addAssets(dir, tech.map((name) => ({ kind: 'tech' as const, value: name, parent: url, source: 'http-get', evidenceId })))
      return [`recon_http ${url}: HTTP ${response.status}${tech.length > 0 ? ` · ${tech.join(',')}` : ''}`, `evidence: ${evidenceId}`, coverageLine(loadAssets(dir))].join('\n')
    },
  }))

  ctx.tools.register(defineTool({
    name: 'recon_crawl',
    description: 'Same-host link crawl from one in-scope URL (depth <= 2, pages <= 10). No form submission.',
    parameters: {
      url: { type: 'string', required: true, description: 'In-scope starting URL.' },
      depth: { type: 'number', description: 'Link depth (default 1, max 2).' },
      maxPages: { type: 'number', description: 'Page cap (default 5, max 10).' },
      lab: { type: 'boolean', description: 'Allow private/loopback targets (authorized lab only).' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { url: string; depth?: number; maxPages?: number; lab?: boolean }, exec?: ExecLike) {
      const start = new URL(args.url.trim())
      const { dir } = requireScope(exec, start.href, args.lab === true)
      const depth = Math.max(0, Math.min(2, Math.trunc(args.depth ?? 1)))
      const maxPages = Math.max(1, Math.min(10, Math.trunc(args.maxPages ?? 5)))
      const seen = new Set<string>([start.href])
      let frontier = [start.href]
      const found: Array<{ url: string; parent?: string }> = []
      for (let level = 0; level <= depth && found.length < maxPages; level += 1) {
        const next: string[] = []
        for (const page of frontier) {
          if (found.length >= maxPages) break
          await limiter.acquire(start.hostname)
          try {
            const response = await httpGet(page)
            for (const match of response.body.matchAll(/href=["']([^"'#]+)["']/gi)) {
              let link: URL
              try { link = new URL(match[1], page) } catch { continue }
              if (link.hostname !== start.hostname || seen.has(link.href)) continue
              if (!['http:', 'https:'].includes(link.protocol)) continue
              seen.add(link.href)
              found.push({ url: link.href, parent: page })
              next.push(link.href)
            }
          } finally { limiter.release() }
        }
        frontier = next
        if (frontier.length === 0) break
      }
      const evidenceId = await saveRaw(dir, 'recon_crawl', found.map((row) => row.url).join('\n'))
      addAssets(dir, found.map((row) => ({ kind: 'url' as const, value: row.url, ...(row.parent !== undefined ? { parent: row.parent } : {}), source: 'crawl', evidenceId })))
      return [`recon_crawl ${start.href}: ${found.length} URL(s)`, `evidence: ${evidenceId}`, coverageLine(loadAssets(dir))].join('\n')
    },
  }))

  ctx.tools.register(defineTool({
    name: 'recon_import',
    description: 'Import local nmap XML or httpx/nuclei JSONL into the asset ledger. Offline; no scan is started.',
    parameters: {
      path: { type: 'string', required: true, description: 'Local output file path.' },
      format: { type: 'string', description: 'nmap-xml | httpx-jsonl | nuclei-jsonl (inferred from content when omitted).' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { path: string; format?: string }, exec?: ExecLike) {
      const active = getCase(exec?.agent?.id)
      if (active === undefined) throw new Error('no active case')
      const text = readFileSync(args.path, 'utf8')
      const format = args.format ?? (/<nmaprun/i.test(text) ? 'nmap-xml' : /"matched-at"|"template-id"/.test(text) ? 'nuclei-jsonl' : 'httpx-jsonl')
      const evidenceId = await saveRaw(active.dir, 'recon_import', text)
      let added = 0
      if (format === 'nmap-xml') {
        for (const row of parseNmapXml(text)) {
          addAsset(active.dir, { kind: 'host', value: row.host, source: 'nmap', evidenceId })
          for (const port of row.ports) addAsset(active.dir, { kind: 'port', value: String(port), parent: row.host, source: 'nmap', evidenceId })
          added += 1 + row.ports.length
        }
      } else if (format === 'nuclei-jsonl') {
        for (const row of parseNucleiJsonl(text)) {
          addAsset(active.dir, { kind: 'host', value: row.host, source: 'nuclei', evidenceId })
          if (row.matchedAt !== undefined) addAsset(active.dir, { kind: 'url', value: row.matchedAt, parent: row.host, source: 'nuclei', evidenceId })
          added += 1
        }
      } else {
        for (const row of parseHttpxJsonl(text)) {
          addAsset(active.dir, { kind: 'url', value: row.url, source: 'httpx', evidenceId })
          for (const tech of row.tech) addAsset(active.dir, { kind: 'tech', value: tech, parent: row.url, source: 'httpx', evidenceId })
          added += 1
        }
      }
      return [`recon_import ${format}: ${added} asset row(s)`, `evidence: ${evidenceId}`, coverageLine(loadAssets(active.dir))].join('\n')
    },
  }))
}
