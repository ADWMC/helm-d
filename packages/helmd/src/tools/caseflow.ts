// Case workflow tools: begin_case / case_status / record_finding / end_case
// plus find_tool (GitHub/search discovery) and save_evidence (universal
// evidence entry for outputs produced outside registered tools).

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  bindCase, getCase, unbindCase, createCaseDir, loadCaseMd, closeCase,
  validateEvidenceIds, appendFinding, saveEvidence,
  casesRoot, toolsShelfRoot,
} from '../case.js'
import { getLevel } from '../mode.js'

interface ExecLike { agent?: { id?: string } }

const RULES = [
  '1. Built-in tools first; missing capability → find_tool() (GitHub); custom scripts LAST, only in <case>/scripts/.',
  '2. External CLI output → save_evidence(label, ...) before citing it.',
  '3. Parameters come from prior tool output in evidence/. Findings cite E ids via record_finding.',
  '4. Resume after compaction → case_status().',
].join('\n')

export function registerCaseflowTools(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'begin_case',
    description:
      'Start a case workspace for one sample/investigation: creates <workspace>/helmd-cases/<date>-<slug>/ ' +
      '(sample/, evidence/, scripts/, CASE.md), hashes samples as first evidence, routes the goal, and binds it to this session. ' +
      'Call before analyzing a new sample. Pass root = the workspace directory shown in your environment when unsure.',
    parameters: {
      goal: { type: 'string', required: true, description: 'What this investigation must deliver.' },
      samples: { type: 'array', items: { type: 'string' }, description: 'Absolute paths of sample files to ingest.' },
      root: { type: 'string', description: 'Workspace root; defaults to HELMD_CASES_DIR or process cwd.' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { goal: string; samples?: string[]; root?: string }, exec?: ExecLike) {
      const existing = getCase(exec?.agent?.id)
      if (existing) {
        return `A case is already active for this session: ${existing.name}\nClose it with end_case() before opening another.`
      }
      const mode = getLevel(exec?.agent?.id)
      const info = await createCaseDir({
        goal: args.goal ?? 'unspecified',
        samples: args.samples ?? [],
        mode,
        route: 'pending (route_task)',
        root: args.root,
      })
      bindCase(exec?.agent?.id, info)
      return [
        `case opened: ${info.dir}`,
        `mode: ${mode}`,
        '',
        RULES,
      ].join('\n')
    },
  }))

  ctx.tools.register(defineTool({
    name: 'case_status',
    description:
      'Re-read the active case state from disk (CASE.md header, samples, recent timeline). ' +
      'Call this FIRST when resuming a task after context compaction — disk state survives what the conversation loses.',
    parameters: {},
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(_args: Record<string, never>, exec?: ExecLike) {
      const active = getCase(exec?.agent?.id)
      if (!active) {
        const base = casesRoot()
        return `No case bound to this session. Recent case dirs (if any) live under ${base} — inspect and re-run begin_case if resuming.`
      }
      const md = await loadCaseMd(active.dir)
      const lines = md.split('\n')
      const head = lines.slice(0, lines.indexOf('## timeline') >= 0 ? lines.indexOf('## timeline') : 12).join('\n')
      const timeline = lines.filter((l) => l.startsWith('- [')).slice(-5).join('\n')
      return [
        `case: ${active.name}`,
        `dir: ${active.dir}`,
        '',
        head,
        '',
        'recent timeline:',
        timeline || '  (empty)',
        '',
        RULES,
      ].join('\n')
    },
  }))

  ctx.tools.register(defineTool({
    name: 'record_finding',
    description:
      'Record a conclusion into findings.md. Every evidence id you cite is validated against the evidence/ directory — ' +
      'citing ids that do not exist is rejected. This is how conclusions stay guess-free.',
    parameters: {
      title: { type: 'string', required: true },
      detail: { type: 'string', required: true },
      evidence_ids: { type: 'array', items: { type: 'string' }, required: true, description: 'e.g. ["E-002","E-005"]' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { title: string; detail: string; evidence_ids: string[] }, exec?: ExecLike) {
      const active = getCase(exec?.agent?.id)
      if (!active) return 'No active case. begin_case() first — findings need an evidence chain.'
      const check = await validateEvidenceIds(active.dir, args.evidence_ids ?? [])
      if (!check.ok) {
        return [
          `REJECTED — unknown evidence ids: ${check.missing.join(', ')}`,
          `known ids: ${check.known.join(', ') || '(none)'}`,
          'Cite only ids that exist in evidence/. Run the tool that produces the proof first.',
        ].join('\n')
      }
      await appendFinding(active.dir, args.title, args.detail, args.evidence_ids ?? [])
      return `finding recorded: ${args.title} [${(args.evidence_ids ?? []).join(', ')}]`
    },
  }))

  ctx.tools.register(defineTool({
    name: 'end_case',
    description:
      'Close the active case: stamps CASE.md completed and unbinds the session. ' +
      'In deep mode at least one recorded finding is required before closing.',
    parameters: { summary: { type: 'string', description: 'One-line closing summary.' } },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { summary?: string }, exec?: ExecLike) {
      const active = getCase(exec?.agent?.id)
      if (!active) return 'No active case bound to this session.'
      const mode = getLevel(exec?.agent?.id)
      if (mode === 'deep') {
        const fm = await import('node:fs/promises').then((m) => m.readFile(join(active.dir, 'findings.md'), 'utf8'))
        const count = (fm.match(/^## /gm) ?? []).length
        if (count === 0) {
          return 'DEEP mode requires at least one record_finding before end_case. Evidence chain incomplete.'
        }
      }
      await closeCase(active.dir, args.summary)
      unbindCase(exec?.agent?.id)
      return `case closed: ${active.name}${args.summary ? ` — ${args.summary}` : ''}`
    },
  }))

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
      const shelfFile = join(toolsShelfRoot(), 'TOOLS.md')
      if (existsSync(shelfFile)) {
        const hits = (await import('node:fs/promises').then((m) => m.readFile(shelfFile, 'utf8')))
          .split('\n').filter((l) => l.toLowerCase().includes(query.toLowerCase()))
        if (hits.length) installed = `\nalready on shelf:\n${hits.join('\n')}`
      }
      return [
        `find_tool: "${query}"${args.context ? ` (${args.context})` : ''}`,
        ...lines,
        '',
        `variant queries: ${variants}`,
        installed,
        'install target: <workspace>/helmd-tools/<tool-name>/ then log it in TOOLS.md',
      ].filter(Boolean).join('\n')
    },
  }))

  ctx.tools.register(defineTool({
    name: 'save_evidence',
    description:
      'Persist arbitrary output into the active case evidence chain with an E-number. ' +
      'Use for external CLI tools run via shell whose output would otherwise leave no trace. ' +
      'Findings may cite these ids exactly like tool-generated ones.',
    parameters: {
      label: { type: 'string', required: true, description: 'Short source label, e.g. "themida-dump".' },
      content: { type: 'string', description: 'Text to store.' },
      file: { type: 'string', description: 'Path of a file to store instead of inline content.' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { label: string; content?: string; file?: string }, exec?: ExecLike) {
      const active = getCase(exec?.agent?.id)
      if (!active) return 'No active case. begin_case() first — evidence needs a home.'
      let content = args.content ?? ''
      if (!content && args.file) {
        if (!existsSync(resolve(args.file))) return `file not found: ${args.file}`
        content = `<copied from file: ${resolve(args.file)}>\n` +
          await import('node:fs/promises').then((m) => m.readFile(resolve(args.file!), 'utf8'))
      }
      if (!content.trim()) return 'nothing to save (empty content)'
      const { id } = await saveEvidence(active.dir, args.label, content, args.label)
      return `[evidence: ${id} saved to ${active.name}]`
    },
  }))
}
