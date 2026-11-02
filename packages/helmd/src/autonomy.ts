// Autonomy packet: the model-facing state needed to decide the next step.
// Pure functions only — case_status and the post-tool nudge feed them disk state.

export interface HypothesisView {
  id: string
  statement: string
  expected: string
  testCmd: string
  status: string
  observation?: string
  evidenceIds: string[]
}

export interface FindingView {
  title: string
  evidence: string
  repro?: string
}

export interface EvidenceView {
  id: string
  file: string
}

export interface AutonomyInput {
  mode: string
  goal?: string
  hypotheses: HypothesisView[]
  findings: FindingView[]
  evidence: EvidenceView[]
  deadEnds?: string
}

const WEB_RE = /(?:^|[^a-z])(web|http|https|sqli|xss|ssrf|ssti|xxe|rce|lfi|idor|jwt|oauth|csrf|pentest|渗透|内网|横向|域控|kerberos|活动目录)(?:[^a-z]|$)/i

/** Pick the playbook that fits the case goal. Discovery only — no phase gate. */
export function playbookFor(goal: string): string {
  return WEB_RE.test(goal) ? 'references/playbooks/pentest.yaml' : 'references/playbooks/reverse.yaml'
}

/** One line the model can act on now. Never a gate; end_case remains the hard stop. */
export function deriveNextAction(input: AutonomyInput): string {
  const open = input.hypotheses.find((h) => h.status === 'open')
  if (open !== undefined) {
    return `Resolve ${open.id}: run "${open.testCmd}", then update_hypothesis(id="${open.id}", status=..., observation=..., evidence_ids=[...]).`
  }
  if (input.hypotheses.length === 0) {
    if (input.evidence.length > 0) {
      return 'Evidence exists but no hypothesis does: record_hypothesis(statement, expected, test_cmd) before more tools.'
    }
    return 'Triage the sample first (hash/file/strings), then record the first testable hypothesis.'
  }
  if (input.findings.length === 0) {
    return 'Resolved state exists: write the conclusion with record_finding(title, detail, evidence_ids, repro_cmd).'
  }
  const missingRepro = input.findings.find((f) => (f.repro ?? '').trim() === '')
  if (missingRepro !== undefined) {
    return `Add repro_cmd to finding "${missingRepro.title}".`
  }
  if (input.hypotheses.some((h) => h.status === 'blocked')) {
    return 'Review blocked hypotheses: give the blocker and a concrete next path, or refute them with evidence.'
  }
  return 'Check the playbook for uncovered stages and unknowns, then close with end_case(summary).'
}

/** Problems the model should fix before claiming the case is complete. */
export function warningsFor(input: AutonomyInput): string[] {
  const warnings: string[] = []
  if (input.evidence.length > 0 && input.hypotheses.length === 0) {
    warnings.push('Evidence exists without a single hypothesis — record what you are testing.')
  }
  for (const h of input.hypotheses) {
    if (h.status === 'open') warnings.push(`Open hypothesis ${h.id} blocks end_case.`)
    if (h.status === 'blocked' && h.evidenceIds.length === 0) {
      warnings.push(`Blocked hypothesis ${h.id} has no evidence — state the blocker and next path.`)
    }
  }
  const noRepro = input.findings.filter((f) => (f.repro ?? '').trim() === '')
  if (noRepro.length > 0) {
    warnings.push(`${noRepro.length} finding(s) lack repro_cmd: ${noRepro.map((f) => f.title).join(', ')}.`)
  }
  return [...new Set(warnings)]
}

/** Compact packet appended to case_status. The model reads this instead of disk. */
export function renderAutonomyPacket(input: AutonomyInput): string {
  const lines: string[] = [
    '[autonomy]',
    `mode: ${input.mode}`,
    `playbook: ${playbookFor(input.goal ?? '')}`,
    'triggers: references/playbooks/triggers.yaml',
  ]
  const open = input.hypotheses.find((h) => h.status === 'open')
  if (open !== undefined) {
    lines.push(
      `open hypothesis: ${open.id} — ${open.statement}`,
      `  expected: ${open.expected}`,
      `  test: ${open.testCmd}`,
      `  evidence: ${open.evidenceIds.join(', ') || '(none)'}`,
    )
  }
  lines.push(`hypotheses: ${input.hypotheses.length}`)
  for (const h of input.hypotheses.slice(-6)) {
    const observation = h.observation ? ` — ${h.observation.slice(0, 120)}` : ''
    lines.push(`  ${h.id} [${h.status}] ${h.statement}${observation}`)
  }
  lines.push(`findings: ${input.findings.length}`)
  for (const f of input.findings.slice(-4)) {
    lines.push(`  - ${f.title} (evidence: ${f.evidence || '-'}; repro: ${f.repro ? 'yes' : 'MISSING'})`)
  }
  lines.push(
    `evidence: ${input.evidence.length}`
    + (input.evidence.length > 0 ? ` (latest ${input.evidence.slice(-5).map((e) => e.id).join(', ')})` : ''),
  )
  if (input.deadEnds !== undefined && input.deadEnds.trim() !== '') {
    lines.push('dead ends:', input.deadEnds)
  }
  const warnings = warningsFor(input)
  if (warnings.length > 0) {
    lines.push('warnings:', ...warnings.map((w) => `  - ${w}`))
  }
  lines.push(`next: ${deriveNextAction(input)}`)
  return lines.join('\n')
}
