// Case lifecycle tools: begin_case / case_status / record_finding / save_evidence /
// end_case — every one of them reads or writes the session's active case.

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  bindCase, getCase, unbindCase, createCaseDir, loadCaseMd, closeCase,
  validateEvidenceIds, appendFinding, saveEvidence, countEvidence,
  casesRoot, findOpenCaseOnDisk, loadCaseInfoFromDisk, auditCasesRoot,
  listLooseFilesInCase,
  recordHypothesis, updateHypothesis, loadHypotheses, getOpenHypothesisCount,
  listEvidence, loadFindings,
} from '../case.js'
import { getLevel } from '../mode.js'
import { renderAdvisoryStats } from '../advisory.js'
import { getStreamInterceptionStats } from '../llm-stream-hook.js'
import { deadEndsSummary } from '../ledger.js'
import { renderAutonomyPacket } from '../autonomy.js'

interface ExecLike {
  agent?: {
    id?: string
    cwd?: string
    workspace?: string
    session?: {
      header?: {
        cwd?: string
      }
    }
  }
}

function resolveWorkspaceRoot(root?: string, exec?: ExecLike): string | undefined {
  return root?.trim() || exec?.agent?.session?.header?.cwd || exec?.agent?.cwd || exec?.agent?.workspace
}

const RULES = [
  '1. Built-in tools first; missing capability → use shell (gh/curl) to find and install it, then tool_memory(register); custom scripts LAST, only in <case>/scripts/.',
  '2. External CLI output → save_evidence(label, ...) before citing it.',
  '3. Parameters come from prior tool output in evidence/. Findings cite E ids via record_finding.',
  '4. Resume after compaction → case_status(); before compaction, bring the CASE.md `## resume` block up to date.',
  '5. Installed a tool or learned a verified usage → tool_memory(register/note) with evidence id; a tactic failing 3 times in a row on the same target (no new evidence) → tool_memory note target=deadend, and never retry a filed dead end without new evidence.',
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
      root: { type: 'string', description: 'Workspace root; defaults to session cwd, HELMD_CASES_DIR, or process cwd.' },
      force: { type: 'boolean', description: 'Force open a new case even if an uncompleted open case exists on disk.' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { goal: string; samples?: string[]; root?: string; force?: boolean }, exec?: ExecLike) {
      const effectiveRoot = resolveWorkspaceRoot(args.root, exec)
      const existing = getCase(exec?.agent?.id)
      if (existing) {
        return `A case is already active for this session: ${existing.name}\nClose it with end_case() before opening another.`
      }
      if (!args.force) {
        const openCase = await findOpenCaseOnDisk(effectiveRoot)
        if (openCase) {
          return [
            `Notice: an unclosed case is already open on disk: ${openCase.name}`,
            `Goal: ${openCase.goal}`,
            '',
            `Options:`,
            `1. Resume it: call case_status(name: "${openCase.name}")`,
            `2. Close it first: call end_case(summary: "...")`,
            `3. Force new case: call begin_case(goal: "...", force: true)`,
          ].join('\n')
        }
      }
      const mode = getLevel(exec?.agent?.id)
      const info = await createCaseDir({
        goal: args.goal ?? 'unspecified',
        samples: args.samples ?? [],
        mode,
        route: 'pending (route_task)',
        root: effectiveRoot,
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
      'Call this FIRST when resuming a task after context compaction — disk state survives what the conversation loses. ' +
      'Can also resume an existing case by name or inspect cases on disk.',
    parameters: {
      name: { type: 'string', description: 'Optional case folder name to resume (or "open"/"latest" to rebind the most recent open case).' },
      root: { type: 'string', description: 'Optional workspace root directory.' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { name?: string; root?: string }, exec?: ExecLike) {
      const effectiveRoot = resolveWorkspaceRoot(args.root, exec)
      let active = getCase(exec?.agent?.id)

      if (args.name) {
        if (args.name === 'open' || args.name === 'latest') {
          const found = await findOpenCaseOnDisk(effectiveRoot)
          if (found) {
            bindCase(exec?.agent?.id, found)
            active = found
          } else {
            return `No unclosed open case found on disk under ${casesRoot(effectiveRoot)}.`
          }
        } else {
          const fromDisk = await loadCaseInfoFromDisk(args.name, effectiveRoot)
          if (fromDisk) {
            bindCase(exec?.agent?.id, fromDisk)
            active = fromDisk
          } else {
            return `Case '${args.name}' not found under ${casesRoot(effectiveRoot)}.`
          }
        }
      }

      if (!active) {
        const base = casesRoot(effectiveRoot)
        const audit = await auditCasesRoot(effectiveRoot)
        const parts: string[] = [
          `No case bound to this session. Recent case dirs (if any) live under ${base} — inspect and re-run begin_case if resuming.`,
        ]
        if (audit.cases.length > 0) {
          parts.push('\nCases on disk:')
          for (const c of audit.cases.slice(0, 5)) {
            parts.push(`  - ${c.name} [${c.status}] (${c.evidenceCount} evidence): ${c.goal.slice(0, 60)}`)
          }
        }
        if (audit.strays.length > 0) {
          parts.push(`\n[Notice] Non-case items found under helmd-cases: ${audit.strays.join(', ')}`)
        }
        const openCase = audit.cases.find((c) => c.status === 'open')
        if (openCase) {
          parts.push(`\nActive unclosed case: ${openCase.name}. To resume: case_status(name: "${openCase.name}")`)
        }
        return parts.join('\n')
      }

      const md = await loadCaseMd(active.dir)
      const lines = md.split('\n')
      const head = lines.slice(0, lines.indexOf('## timeline') >= 0 ? lines.indexOf('## timeline') : 12).join('\n')
      const timeline = lines.filter((l) => l.startsWith('- [')).slice(-5).join('\n')
      // The resume block is the handoff contract: it must survive a truncated window.
      const resumeAt = lines.findIndex((l) => l.startsWith('## resume'))
      const resume = resumeAt >= 0 ? lines.slice(resumeAt).join('\n').trim() : ''

      const loose = await listLooseFilesInCase(active.dir)
      const looseNotice = loose.length > 0
        ? `\n\n[Warning] ${loose.length} loose unorganized file(s) in case root (will auto-archive to evidence/ on end_case): ${loose.join(', ')}`
        : ''
      const hypotheses = await loadHypotheses(active.dir)
      const findings = await loadFindings(active.dir)
      const evidence = await listEvidence(active.dir)
      const packet = renderAutonomyPacket({
        mode: getLevel(exec?.agent?.id),
        goal: active.goal,
        hypotheses,
        findings,
        evidence,
        deadEnds: deadEndsSummary(3),
      })

      return [
        `case: ${active.name}`,
        `dir: ${active.dir}`,
        '',
        head,
        '',
        'recent timeline:',
        timeline || '  (empty)',
        looseNotice,
        ...(resume ? ['', resume] : []),
        '',
        packet,
        '',
        RULES,
        ...(renderAdvisoryStats() ? ['', renderAdvisoryStats()] : []),
        ...(getStreamInterceptionStats().count > 0
          ? ['', `[流式拒答拦截监控]\n已拦截拒答: ${getStreamInterceptionStats().count} 次 | 最近拦截: ${getStreamInterceptionStats().lastTime || '无'}\n审计日志文件: ${getStreamInterceptionStats().logFile}`]
          : ['', `[流式拒答拦截监控]\n状态: 监控中 (当前会话拦截 0 次) | 审计日志文件: ${getStreamInterceptionStats().logFile}`]),
      ].join('\n')
    },
  }))

  ctx.tools.register(defineTool({
    name: 'record_finding',
    description:
      'Record a conclusion into findings.md. Every evidence id you cite is validated against the evidence/ directory — ' +
      'citing ids that do not exist is rejected. Pass repro_cmd (a command that reproduces the result); ' +
      'DEEP mode requires it before the case can close.',
    parameters: {
      title: { type: 'string', required: true },
      detail: { type: 'string', required: true },
      evidence_ids: { type: 'array', items: { type: 'string' }, required: true, description: 'e.g. ["E-002","E-005"]' },
      repro_cmd: { type: 'string', required: true, description: 'Reusable command/tool call that reproduces the conclusion.' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { title: string; detail: string; evidence_ids: string[]; repro_cmd: string }, exec?: ExecLike) {
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
      if ((args.repro_cmd ?? '').trim() === '') {
        return 'REJECTED — repro_cmd is required: a finding without a reproducible command is not a conclusion.'
      }
      await appendFinding(active.dir, args.title, args.detail, args.evidence_ids ?? [], args.repro_cmd)
      return `finding recorded: ${args.title} [${(args.evidence_ids ?? []).join(', ')}]\nrepro: ${args.repro_cmd.trim()}`
    },
  }))

  ctx.tools.register(defineTool({
    name: 'record_hypothesis',
    description:
      'State a testable hypothesis before running tools. Forces you to think: what do you expect to find, ' +
      'and how will you verify it? Returns H-xxx. Use update_hypothesis after testing.',
    parameters: {
      statement: { type: 'string', required: true, description: 'What you think is true.' },
      expected: { type: 'string', required: true, description: 'What you expect to observe if true.' },
      test_cmd: { type: 'string', required: true, description: 'Shell command or tool call to verify.' },
      evidence_ids: { type: 'array', items: { type: 'string' }, description: 'Supporting evidence already collected.' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { statement: string; expected: string; test_cmd: string; evidence_ids?: string[] }, exec?: ExecLike) {
      const active = getCase(exec?.agent?.id)
      if (!active) return 'No active case. begin_case() first — hypotheses need a case.'
      const all = await loadHypotheses(active.dir)
      const open = all.filter((h) => h.status === 'open')
      if (open.length >= 1) {
        return [
          `REJECTED — ${open.length} open hypothesis already exists: ${open.map((h) => h.id).join(', ')}.`,
          'Resolve it first with update_hypothesis before creating a new one.',
        ].join('\n')
      }
      const h = await recordHypothesis(active.dir, args.statement, args.expected, args.test_cmd, args.evidence_ids ?? [])
      return [
        `hypothesis ${h.id} recorded (open):`,
        `  statement: ${h.statement}`,
        `  expected:  ${h.expected}`,
        `  test_cmd:  ${h.testCmd}`,
        `Run the test, then update_hypothesis(id="${h.id}", status=..., observation=..., evidence_ids=[...])`,
      ].join('\n')
    },
  }))

  ctx.tools.register(defineTool({
    name: 'update_hypothesis',
    description:
      'Resolve a hypothesis after testing. Status must be confirmed / refuted / blocked. ' +
      'confirmed and refuted require an observation and at least one evidence id.',
    parameters: {
      id: { type: 'string', required: true, description: 'Hypothesis id, e.g. "H-001".' },
      status: { type: 'string', required: true, description: 'confirmed | refuted | blocked.' },
      observation: { type: 'string', required: true, description: 'What you actually observed.' },
      evidence_ids: { type: 'array', items: { type: 'string' }, description: 'Evidence supporting the verdict.' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { id: string; status: string; observation: string; evidence_ids?: string[] }, exec?: ExecLike) {
      const active = getCase(exec?.agent?.id)
      if (!active) return 'No active case.'
      if (!['confirmed', 'refuted', 'blocked'].includes(args.status)) {
        return `REJECTED — status must be confirmed | refuted | blocked, got "${args.status}".`
      }
      if (args.status !== 'blocked' && (args.evidence_ids ?? []).length === 0) {
        return `REJECTED — ${args.status} requires at least one evidence id. Run the test first.`
      }
      if (args.evidence_ids && args.evidence_ids.length > 0) {
        const check = await validateEvidenceIds(active.dir, args.evidence_ids)
        if (!check.ok) {
          return `REJECTED — unknown evidence ids: ${check.missing.join(', ')}. Known: ${check.known.join(', ') || '(none)'}.`
        }
      }
      const h = await updateHypothesis(active.dir, args.id, args.status as any, args.observation, args.evidence_ids ?? [])
      if (!h) return `REJECTED — hypothesis ${args.id} not found.`
      return `hypothesis ${h.id} → ${h.status}. ${h.observation?.slice(0, 120) ?? ''}`
    },
  }))

  ctx.tools.register(defineTool({
    name: 'end_case',
    description:
      'Close the active case: stamps CASE.md completed and unbinds the session. ' +
      'In deep mode at least one recorded finding is required, and every finding must carry repro_cmd. ' +
      'Closing also requires at least one evidence entry on disk, unless the summary states why there is none ' +
      'with "(no-evidence: …)".',
    parameters: { summary: { type: 'string', description: 'One-line closing summary.' } },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { summary?: string }, exec?: ExecLike) {
      const active = getCase(exec?.agent?.id)
      if (!active) return 'No active case bound to this session.'
      const mode = getLevel(exec?.agent?.id)
      if (mode === 'deep') {
        const findings = await loadFindings(active.dir)
        if (findings.length === 0) {
          return 'DEEP mode requires at least one record_finding before end_case. Evidence chain incomplete.'
        }
        const missingRepro = findings.filter((finding) => (finding.repro ?? '').trim() === '')
        if (missingRepro.length > 0) {
          return [
            `REJECTED — DEEP mode requires repro_cmd on every finding: ${missingRepro.map((f) => f.title).join(', ')}.`,
            'Re-record the finding with repro_cmd (a command that reproduces it) before closing.',
          ].join('\n')
        }
      }
      // Hypothesis gate: all hypotheses must be resolved before closing.
      const openCount = await getOpenHypothesisCount(active.dir)
      if (openCount > 0) {
        const all = await loadHypotheses(active.dir)
        const open = all.filter((h) => h.status === 'open')
        return [
          `REJECTED — ${openCount} open hypothesis(es) must be resolved before closing:`,
          ...open.map((h) => `  ${h.id}: ${h.statement} (test: ${h.testCmd})`),
          'Use update_hypothesis(id, status, observation, evidence_ids) to resolve each one.',
        ].join('\n')
      }
      // Completion is an external fact, not a self-report: a closed case must point at
      // evidence on disk, or say in words why it has none.
      const evidence = await countEvidence(active.dir)
      if (evidence === 0 && !/\(no-evidence:\s*\S/i.test(args.summary ?? '')) {
        return [
          'REJECTED — 关闭前必须交代证据：evidence/ 里一条 E-xxx 都没有。',
          '两条路径：① 先落地证据（跑工具，或 save_evidence(label, ...)）再关闭；',
          '② 本次确实无证据（纯咨询 / 被阻塞）就在 summary 里写明：',
          '   summary: "… (no-evidence: 用户仅咨询，未接触样本)"。',
        ].join('\n')
      }
      await closeCase(active.dir, args.summary)
      unbindCase(exec?.agent?.id)
      const stats = renderAdvisoryStats()
      return [`case closed: ${active.name}${args.summary ? ` — ${args.summary}` : ''}`, ...(stats ? ['', stats] : [])].join('\n')
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
