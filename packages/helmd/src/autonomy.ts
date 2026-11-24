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
  status?: string
  assessment?: { evidenceCheck: string }
}

export interface EvidenceView {
  id: string
  file: string
}

export interface PathCall {
  name: string
  args: string
}

export interface AutonomyInput {
  mode: string
  goal?: string
  hypotheses: HypothesisView[]
  findings: FindingView[]
  evidence: EvidenceView[]
  /** Case scope and observed recon assets, not inferred from the goal text. */
  scope?: string[]
  assets?: { kind: string; value: string; evidenceId?: string }[]
  deadEnds?: string
  noPath?: string
}

/** T-04: three consecutive identical tool+args calls with no evidence growth
 *  are a dead path. The caller supplies whether evidence grew since the last
 *  snapshot; absence of that snapshot never triggers. */
export function detectNoPath(calls: PathCall[], evidenceGrew: boolean): string | undefined {
  if (evidenceGrew || calls.length < 3) return undefined
  const tail = calls.slice(-3).map((call) => `${call.name}\u0000${call.args}`)
  if (tail.every((key) => key === tail[0])) {
    return `same tool+args repeated 3x (${calls[calls.length - 1].name}) with no new evidence; switch path or report blocked`
  }
  return undefined
}

const PENTEST_INTENT = /(?:\bpentest\b|penetration test|security assessment|漏洞测试|漏洞挖掘|渗透测试|渗透|内网|横向|域控|kerberos|活动目录|攻击面测试)/i
const ATTACK_METHOD = /\b(?:sqli|xss|ssrf|ssti|xxe|idor|csrf|sql injection|auth bypass)\b|越权测试|注入测试/i
const REVERSE_INTENT = /\b(?:reverse engineering|unpack|decompile|binary|apk|firmware)\b|逆向|脱壳|反编译|固件|样本分析/i

/** Pick the playbook that fits the case goal. Discovery only — no phase gate. */
export function playbookFor(goal: string): string {
  return isPentestGoal(goal) ? 'references/playbooks/pentest.yaml' : 'references/playbooks/reverse.yaml'
}

export function isPentestGoal(goal: string, scope?: string[]): boolean {
  if (REVERSE_INTENT.test(goal)) return false
  if (PENTEST_INTENT.test(goal)) return true
  return ATTACK_METHOD.test(goal) && ((scope?.length ?? 0) > 0 || /\b(?:on|against|target)\b|目标|靶机/i.test(goal))
}

/** A small route portfolio is useful only if routes are materially different.
 * Compare normalized statements as a cheap duplicate guard; this is not semantic dedup. */
export function pentestRouteAdmission(existing: HypothesisView[], statement: string): string | undefined {
  const open = existing.filter((h) => h.status === 'open')
  const normalized = statement.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  if (normalized.length === 0) return 'route statement is empty'
  if (existing.some((h) => h.statement.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim() === normalized)) {
    return 'same route already recorded; add a materially different target or mechanism'
  }
  if (open.length >= 3) return 'at most 3 open pentest routes; resolve or block one before adding another'
  return undefined
}

function pentestNext(input: AutonomyInput): string {
  if (!input.scope?.length) return 'No explicit network scope: obtain the target/scope before network recon; do not infer hosts from the goal.'
  if (input.noPath?.trim()) return 'No new evidence after repeated identical calls: stop that probe, record its blocker; choose a different observed surface or mechanism only if justified by evidence, otherwise report the limit.'
  const assets = input.assets ?? []
  if (assets.length === 0 && input.evidence.length === 0) return 'Map one in-scope target with a specialist scanner or reviewed request; save raw output with save_evidence. Record actual endpoints and identity boundaries before choosing routes.'
  const open = input.hypotheses.find((h) => h.status === 'open')
  if (open) return `Test ${open.id} (${open.statement}) with baseline and negative control where possible; then update_hypothesis using actual E ids. Do not report a vulnerability from a single indicator.`
  const candidate = input.findings.find((f) => f.status === 'candidate' || f.assessment?.evidenceCheck === 'mismatch' || f.assessment?.evidenceCheck === 'stale')
  if (candidate) return `Recheck finding "${candidate.title}": compare raw proof with a control, test reachability and actual impact; keep candidate if unproven. Do not treat a matching quote as exploit verification.`
  if (input.hypotheses.length === 0) return 'From observed assets or imported raw output, record 2-3 distinct testable routes with record_hypothesis (target, expected observation, test and negative control); execute one route at a time.'
  if (input.hypotheses.some((h) => h.status === 'confirmed')) return 'Review confirmed observations against actual impact and alternative explanations. Record a candidate only if there is a specific weakness; otherwise report the observed fact. Do not infer a finding from shared E ids.'
  return 'No open route remains: review measured scope coverage and blocked/refuted evidence; if another observed surface warrants a distinct test, record that route, otherwise report limits and close as inconclusive/blocked. Do not force a finding.'
}

/** Reverse engineering is goal-directed artifact analysis, not a search for
 * vulnerabilities. The ledger cannot infer protection type or program behavior
 * from a filename, so the decision stays an explicit experiment request. */
function reverseNext(input: AutonomyInput): string {
  if (input.noPath?.trim()) return 'Reverse path stalled: record the failed command and first difference; change the target slice, input or observation method only with a new discriminating question. If no observer is available, report the unresolved boundary.'
  const open = input.hypotheses.find((h) => h.status === 'open')
  if (open) return `Resolve ${open.id}: run "${open.testCmd}" on the goal-relevant slice with a specialist tool, save raw output, check a competing explanation and record observations with E ids via update_hypothesis. If target logic is hidden, use the protection methodology to decide bounded static vs isolated dynamic analysis; a signature alone is not a switch.`
  const candidate = input.findings.find((f) => f.status === 'candidate' || f.assessment?.evidenceCheck === 'mismatch' || f.assessment?.evidenceCheck === 'stale')
  if (candidate) return `Recheck reverse conclusion "${candidate.title}": match offsets/mappings and raw E evidence, validate the specific goal output with an independent method. For recovered artifacts verify structural, analyzable and behavioral levels separately; a matching quote is not program behavior.`
  if (input.hypotheses.length === 0 && input.evidence.length === 0) return 'Triage the original sample first: hash, file format, architecture, entry/mappings and goal-relevant strings/imports. Preserve the original; do not identify a packer from entropy alone.'
  if (input.hypotheses.length === 0) return 'From triage evidence, record one goal-linked hypothesis with an observable prediction and discriminating test. Check whether the target code is visible before choosing static slicing or a bounded dynamic experiment.'
  const confirmed = input.hypotheses.find((h) => h.status === 'confirmed')
  if (confirmed && input.findings.length === 0) return `Assess whether ${confirmed.id} answers the stated reverse goal; independently verify its behavior or recovered artifact before recording a conclusion. A confirmed observation is not automatically a vulnerability, a decrypted algorithm, or a successful unpack. If it answers the goal, report the evidence and limits; otherwise form the next goal-linked test.`
  const missingRepro = input.findings.find((f) => (f.repro ?? '').trim() === '')
  if (missingRepro) return `Add a reproducible command or a clearly stated unrepeatable observation for reverse conclusion "${missingRepro.title}"; do not invent a command.`
  if (input.hypotheses.some((h) => h.status === 'blocked' || h.status === 'refuted')) return 'Review blocked/refuted reverse hypotheses against the target goal: choose a different goal-linked slice or observation if justified, otherwise report what remains unknown and close as inconclusive/blocked.'
  return 'Review goal coverage and independently validated outputs; state offsets, sample hash, tool versions and limits. Close only with the achieved result or an explicit inconclusive boundary.'
}

/** One line the model can act on now. Never a gate; end_case remains the hard stop. */
export function deriveNextAction(input: AutonomyInput): string {
  if (isPentestGoal(input.goal ?? '', input.scope)) return pentestNext(input)
  return reverseNext(input)
}

/** Problems the model should fix before claiming the case is complete. */
export function warningsFor(input: AutonomyInput): string[] {
  const warnings: string[] = []
  if (isPentestGoal(input.goal ?? '', input.scope) && !input.scope?.length) warnings.push('Pentest case has no explicit scope; network recon requires a target.')
  if (isPentestGoal(input.goal ?? '', input.scope) && input.findings.some((f) => f.status === 'candidate')) warnings.push('Candidate finding(s) are not proven vulnerabilities.')
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
  const lines: string[] = []
  if (input.noPath !== undefined && input.noPath.trim() !== '') {
    lines.push(`[NO_PATH] ${input.noPath.trim()}`)
  }
  lines.push(
    '[autonomy]',
    `mode: ${input.mode}`,
    `playbook: ${isPentestGoal(input.goal ?? '', input.scope) ? 'references/playbooks/pentest.yaml' : playbookFor(input.goal ?? '')}`,
    'triggers: references/playbooks/triggers.yaml',
  )
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
  if (isPentestGoal(input.goal ?? '', input.scope)) {
    lines.push(`pentest routes: open ${input.hypotheses.filter((h) => h.status === 'open').length}/3; scope ${input.scope?.join(', ') || '(missing)'}; observed assets ${input.assets?.length ?? 0}`)
    lines.push('decision rule: a route is a hypothesis, not a verified finding; never close a goal on a CVE match or a quote alone.')
  } else {
    lines.push('reverse focus: sample identity → goal-linked target slice → discriminating observation → independent validation; protection signatures and artifact capture are not completion.')
  }
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
