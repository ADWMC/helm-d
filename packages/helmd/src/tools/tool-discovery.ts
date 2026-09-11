// External tool discovery: find_tool searches GitHub for an existing tool instead of
// writing a script, then surfaces what is already on the local shelf. Case-independent —
// it reads no case state — so it lives apart from the case lifecycle tools.

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ledgerDir } from '../ledger.js'

export function registerToolDiscoveryTools(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'find_tool',
    description:
      'Search GitHub for an existing tool instead of writing a script. Feed it any named artifact from the sample: ' +
      'packer name, section name (.vmp0), mutex, copyright string, VM handler keyword. Returns top repos by stars, ' +
      'variant query suggestions (<name> unpacker/devirtualizer/dump/fix), and already-installed matches from helmd-tools/TOOLS.md.',
    parameters: {
      query: { type: 'string', required: true, description: 'Tool keywords or a named artifact from the sample.' },
      context: { type: 'string', description: 'Optional provenance note, e.g. "section .vmp0 from E-003".' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { query: string; context?: string }) {
      const query = (args.query ?? '').trim()
      if (!query) return 'empty query'
      const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
      const headers: Record<string, string> = {
        'User-Agent': 'helmd-find-tool',
        Accept: 'application/vnd.github+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      }
      let lines: string[] = []
      try {
        const resp = await fetch(
          `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=5`,
          { headers },
        )
        if (resp.status === 403 || resp.status === 429) {
          lines = ['[rate limited — set GH_TOKEN to raise the limit]']
        } else if (!resp.ok) {
          lines = [`[github search failed: HTTP ${resp.status}]`]
        } else {
          const data = await resp.json() as { items?: Array<Record<string, unknown>> }
          const items = data.items ?? []
          lines = items.length
            ? items.map((it, i) => {
                const stars = typeof it.stargazers_count === 'number' ? it.stargazers_count : 0
                const pushed = typeof it.pushed_at === 'string' ? it.pushed_at.slice(0, 10) : '?'
                const desc = typeof it.description === 'string' ? it.description.slice(0, 120) : ''
                return `${i + 1}. ${it.full_name}  ★${stars}  pushed ${pushed}\n   ${it.html_url}\n   ${desc}`
              })
            : ['(no repositories matched)']
        }
      } catch (e) {
        lines = [`[network error: ${(e as Error).message}]`]
      }
      const variants = ['unpacker', 'devirtualizer', 'dump', 'fix', 'writeup']
        .map((s) => `"${query} ${s}"`)
        .join(' | ')
      let installed = ''
      // Same file tool_memory writes: the shelf is machine-global, not workspace-local.
      const shelfFile = join(ledgerDir(), 'TOOLS.md')
      if (existsSync(shelfFile)) {
        const hits = (await readFile(shelfFile, 'utf8'))
          .split('\n').filter((l) => l.toLowerCase().includes(query.toLowerCase()))
        if (hits.length) installed = `\nalready on shelf:\n${hits.join('\n')}`
      }
      return [
        `find_tool: "${query}"${args.context ? ` (${args.context})` : ''}`,
        ...lines,
        '',
        `variant queries: ${variants}`,
        installed,
        `logging target: tool_memory register(tool_name, path, purpose) — the shelf is ${shelfFile}, shared across workspaces`,
      ].filter(Boolean).join('\n')
    },
  }))
}
