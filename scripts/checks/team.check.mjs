// Subject: local team protocol and evolution gate. No DSH host, no model, no
// network: tickets/reports/handoffs and versioned artifacts are plain files
// under a throwaway DSH_HOME, so the collaboration contract is pinned.
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { distDir } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const entry = join(distDir, 'team.js')
if (!existsSync(entry)) skip('team', 'need packages/helmd/dist (run pnpm build)')
const home = mkdtempSync(join(tmpdir(), 'helmd-team-'))
process.env.DSH_HOME = home
const team = await import(pathToFileURL(entry).href)
const worker = await import(pathToFileURL(join(distDir, 'team-worker.js')).href)
const evalTeam = await import(pathToFileURL(join(distDir, 'team-eval.js')).href)
const caseApi = await import(pathToFileURL(join(distDir, 'case.js')).href)
const teamTools = await import(pathToFileURL(join(distDir, 'tools', 'team.js')).href)
const policyApi = await import(pathToFileURL(join(distDir, 'team-policy.js')).href)
const settingsApi = await import(pathToFileURL(join(distDir, 'settings.js')).href)
const approvalApi = await import(pathToFileURL(join(distDir, 'approval.js')).href)
const report = createReporter('team')

await report.check('ticket -> role assignment -> report -> handoff -> close', () => {
  const ticket = team.createTicket({ goal: 'analyze sample', caseDir: join(home, 'case'), roles: ['triage', 'static', 'critic', 'reporter'] })
  assert.equal(ticket.state, 'open')
  assert.equal(ticket.roles.length, 4)
  const assigned = team.assignRole(ticket.id, 'static', 'worker-session-1')
  assert.equal(assigned.roles.find((r) => r.role === 'static').state, 'running')
  const progress = team.recordReport({ ticketId: ticket.id, role: 'static', state: 'progress', summary: 'parsed headers', evidenceIds: ['E-001'] })
  assert.equal(progress.state, 'working')
  const blocked = team.recordHandoff({ ticketId: ticket.id, from: 'static', to: 'critic', question: 'need runtime confirmation' })
  assert.equal(blocked.state, 'blocked')
  const ready = team.recordReport({ ticketId: ticket.id, role: 'reporter', state: 'ready', summary: 'report ready', evidenceIds: ['E-001'], repro: 'cmd --repro' })
  assert.equal(ready.state, 'review')
  const closed = team.closeTicket(ticket.id, 'done')
  assert.equal(closed.state, 'done')
})

await report.check('reports are restricted to roles on the ticket', () => {
  const ticket = team.createTicket({ goal: 'scope', caseDir: join(home, 'case2'), roles: ['triage'] })
  assert.throws(() => team.recordReport({ ticketId: ticket.id, role: 'dynamic', state: 'ready', summary: 'nope' }), /not part of ticket/)
})

await report.check('evolution gate rejects regressions and missing improvement', () => {
  assert.equal(team.canActivate({ correctness: 1, evidence: 1, canaryResistance: 1, blockedHonesty: 1 }, { correctness: 1, evidence: 1.2, canaryResistance: 1, blockedHonesty: 1 }).pass, true)
  assert.equal(team.canActivate({ correctness: 1, evidence: 1, canaryResistance: 1, blockedHonesty: 1 }, { correctness: 0.8, evidence: 1.2, canaryResistance: 1, blockedHonesty: 1 }).pass, false)
  assert.equal(team.canActivate({ correctness: 1, evidence: 1, canaryResistance: 1, blockedHonesty: 1 }, { correctness: 1, evidence: 1, canaryResistance: 1, blockedHonesty: 1 }).pass, false)
})

await report.check('a revision must pass eval before activation; rollback restores parent', () => {
  const base = { correctness: 1, evidence: 1, canaryResistance: 1, blockedHonesty: 1 }
  const one = team.proposeRevision({ kind: 'role-prompt', id: 'static', value: 'v1', source: 'test' })
  const pass = team.evaluateRevision({ kind: one.kind, id: one.id, revision: one.revision, baseline: base, candidate: { ...base, evidence: 1.1 } })
  assert.equal(pass.eval.pass, true)
  team.activateRevision(one.kind, one.id, one.revision)
  const two = team.proposeRevision({ kind: one.kind, id: one.id, value: 'v2', source: 'test' })
  team.evaluateRevision({ kind: two.kind, id: two.id, revision: two.revision, baseline: base, candidate: { ...base, evidence: 1.2 } })
  team.activateRevision(two.kind, two.id, two.revision)
  const three = team.proposeRevision({ kind: one.kind, id: one.id, value: 'v3', source: 'test' })
  team.evaluateRevision({ kind: three.kind, id: three.id, revision: three.revision, baseline: base, candidate: { ...base, correctness: 0.5 } })
  assert.throws(() => team.activateRevision(three.kind, three.id, three.revision), /eval gate/)
  const rolled = team.rollbackRevision(one.kind, one.id)
  assert.equal(rolled.revision, one.revision)
  assert.equal(team.activeRevision(one.kind, one.id).revision, one.revision)
})

await report.check('worker output becomes a ticket report and a session assignment', async () => {
  const ticket = team.createTicket({ goal: 'worker e2e', caseDir: join(home, 'worker-case'), roles: ['triage'] })
  const prompt = worker.renderWorkerPrompt({
    ticketId: ticket.id, role: 'triage', goal: ticket.goal, caseDir: ticket.caseDir,
    task: 'inspect headers', revisions: {},
  })
  assert.match(prompt, /\[helm-d team\]/)
  assert.match(prompt, /triage worker/)
  let spec
  const started = await worker.startTeamWorker({
    ticketId: ticket.id,
    role: 'triage',
    task: 'inspect headers',
    parentAgent: { id: 'parent-session' },
    runtime: {
      subagents: {
        getProvider: () => ({ name: 'spawn' }),
        startActivation: async (input) => {
          spec = input
          return {
            childId: 'child-triage-1',
            result: Promise.resolve({
              stopReason: 'completed',
              output: [{ type: 'text', text: '{"state":"ready","summary":"parsed headers","evidenceIds":["E-001"],"repro":"file sample.exe"}' }],
            }),
            dispose: async () => {},
          }
        },
      },
    },
  })
  assert.equal(spec.provider, 'spawn')
  assert.equal(spec.delivery, 'parent')
  assert.equal(spec.request.cwd, ticket.caseDir)
  assert.equal(started.sessionId, 'child-triage-1')
  const recorded = await started.completion
  assert.equal(recorded.state, 'ready')
  assert.equal(recorded.source, 'worker')
  const updated = team.getTicket(ticket.id)
  assert.equal(updated.roles.find((role) => role.role === 'triage').sessionId, 'child-triage-1')
  assert.equal(updated.reports.at(-1).summary, 'parsed headers')
  assert.equal(team.sessionRole('child-triage-1'), 'triage')
  assert.equal(caseApi.getCase('child-triage-1').dir, ticket.caseDir)
})

await report.check('failed worker still records an auditable failed report', async () => {
  const ticket = team.createTicket({ goal: 'failed worker', caseDir: join(home, 'failed-case'), roles: ['dynamic'] })
  const started = await worker.startTeamWorker({
    ticketId: ticket.id, role: 'dynamic', parentAgent: { id: 'parent' },
    runtime: {
      subagents: {
        getProvider: () => ({ name: 'spawn' }),
        startActivation: async () => ({
          childId: 'child-dynamic-1',
          result: Promise.resolve({ stopReason: 'error', output: [] }),
          dispose: async () => {},
        }),
      },
    },
  })
  const recorded = await started.completion
  assert.equal(recorded.state, 'failed')
  assert.equal(team.getTicket(ticket.id).roles[0].state, 'done')
})

await report.check('worker start fails loudly without a subagent provider', async () => {
  const ticket = team.createTicket({ goal: 'no provider', caseDir: join(home, 'no-provider'), roles: ['triage'] })
  await assert.rejects(
    () => worker.startTeamWorker({
      ticketId: ticket.id, role: 'triage', parentAgent: { id: 'parent' },
      runtime: { subagents: { getProvider: () => undefined, startActivation: async () => { throw new Error('unreachable') } } },
    }),
    /no spawn\/fork subagent provider/,
  )
})

await report.check('roleDeps gate dispatch until prerequisites are done', async () => {
  const ticket = team.createTicket({
    goal: 'dag gate', caseDir: join(home, 'dag-case'), roles: ['static', 'critic'],
    roleDeps: { critic: ['static'] },
  })
  const runtime = {
    subagents: {
      getProvider: () => ({ name: 'spawn' }),
      startActivation: async (spec) => ({
        childId: `child-${spec.label}`,
        result: new Promise(() => { /* stays running for the gate check */ }),
        dispose: async () => {},
      }),
    },
  }
  await assert.rejects(
    () => worker.startTeamWorker({ ticketId: ticket.id, role: 'critic', parentAgent: { id: 'parent' }, runtime }),
    /role critic waits for: static/,
  )
  team.recordReport({ ticketId: ticket.id, role: 'static', state: 'ready', summary: 'static done' })
  const started = await worker.startTeamWorker({ ticketId: ticket.id, role: 'critic', parentAgent: { id: 'parent' }, runtime })
  assert.ok(started.sessionId.startsWith('child-'), 'critic starts once static is done')
})

await report.check('team_dispatch is the model-facing entry to the same worker adapter', async () => {
  const ticket = team.createTicket({ goal: 'tool dispatch', caseDir: join(home, 'tool-case'), roles: ['reporter'] })
  let definition
  const ctx = {
    tools: { register: (def) => { definition = def } },
    get: (name) => name === 'subagents' ? {
      getProvider: () => ({ name: 'spawn' }),
      startActivation: async () => ({
        childId: 'child-reporter-1',
        result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: '{"state":"ready","summary":"tool report parsed headers and imports","evidenceIds":["E-001"]}' }] }),
        dispose: async () => {},
      }),
    } : undefined,
  }
  teamTools.registerTeamTools(ctx)
  assert.equal(definition.name, 'team_dispatch')
  const text = await definition.execute(
    { ticketId: ticket.id, role: 'reporter', task: 'summarize' },
    { agent: { id: 'parent-session' }, signal: new AbortController().signal },
  )
  assert.match(text, /worker started: reporter/)
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.equal(team.getTicket(ticket.id).reports.at(-1).summary, 'tool report parsed headers and imports')
})

await report.check('local eval harness computes the six gate metrics and compares runs', () => {
  const base = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', 'team-eval', 'baseline.json'), 'utf8'))
  const candidate = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', 'team-eval', 'candidate.json'), 'utf8'))
  const before = evalTeam.computeMetrics(base)
  assert.equal(before.correctness, 1)
  assert.equal(before.evidence, 2 / 3)
  assert.equal(before.canaryResistance, 0.5)
  assert.equal(before.blockedHonesty, 1)
  const comparison = evalTeam.compareRuns(base, candidate)
  assert.equal(comparison.pass, true)
  assert.equal(comparison.candidate.evidence, 1)
  assert.ok(comparison.candidate.tokens < comparison.baseline.tokens)
})


await report.check('standalone tickets get a case scaffold so worker evidence tools work', () => {
  const dir = join(home, 'scaffold-case')
  const ticket = team.createTicket({ goal: 'scaffold', caseDir: dir, roles: ['triage'] })
  assert.equal(ticket.state, 'open')
  assert.equal(existsSync(join(dir, 'CASE.md')), true, 'CASE.md must exist for session binding readers')
  assert.equal(existsSync(join(dir, 'evidence')), true, 'evidence dir must exist for save_evidence')
  assert.match(readFileSync(join(dir, 'CASE.md'), 'utf8'), /goal: scaffold/)
})

await report.check('task DAG claims one owner and unblocks dependents', () => {
  const ticket = team.createTicket({
    goal: 'dag tasks', caseDir: join(home, 'dag-tasks'), roles: ['static', 'critic'],
    roleDeps: { critic: ['static'] },
  })
  const first = team.claimTask(ticket.id, 'static')
  assert.equal(first.state, 'claimed')
  const again = team.claimTask(ticket.id, 'static')
  assert.equal(again.id, first.id, 'same role claim is idempotent while the lease is live')
  assert.throws(() => team.claimTask(ticket.id, 'critic'), /not ready/)
  team.completeTask(ticket.id, 'static', 'done')
  const second = team.claimTask(ticket.id, 'critic')
  assert.equal(second.state, 'claimed')
  const done = team.completeTask(ticket.id, 'critic', 'done')
  assert.equal(done.state, 'done')
  assert.equal(team.getTicket(ticket.id).tasks.find((task) => task.id === second.id).state, 'done')
})

await report.check('team_steer delivers to a running worker and rejects non-orchestrators', async () => {
  let definition
  const delivered = []
  const ctx = {
    tools: { register: (def) => { if (def.name === 'team_steer') definition = def } },
    get: (name) => name === 'subagents' ? {
      getProvider: () => ({ name: 'spawn' }),
      startActivation: async () => { throw new Error('unused') },
      steerPrompt: async (parent, childId, content, source) => {
        delivered.push({ parent, childId, text: content[0].text, source })
        return 'msg-1'
      },
    } : undefined,
  }
  teamTools.registerTeamTools(ctx)
  assert.ok(definition, 'team_steer must be registered')
  const ticket = team.createTicket({ goal: 'steer', caseDir: join(home, 'steer-case'), roles: ['triage', 'static'] })
  team.assignRole(ticket.id, 'static', 'child-static-steer')
  const signal = new AbortController().signal
  const text = await definition.execute(
    { ticketId: ticket.id, role: 'static', message: '只做静态分析，然后 blocked 汇报' },
    { agent: { id: 'parent-steer' }, signal },
  )
  assert.match(text, /steer accepted/)
  assert.equal(delivered[0].childId, 'child-static-steer')
  assert.match(delivered[0].text, /只做静态分析/)
  assert.equal(team.getTicket(ticket.id).steers.at(-1).role, 'static')

  const workerTicket = team.createTicket({ goal: 'steer negative', caseDir: join(home, 'steer-negative'), roles: ['static'] })
  team.assignRole(workerTicket.id, 'static', 'child-worker-self')
  await assert.rejects(
    () => definition.execute({ ticketId: workerTicket.id, role: 'static', message: 'nope' }, { agent: { id: 'child-worker-self' }, signal }),
    /cannot steer workers/,
  )
})

await report.check('finish gate turns budget/no-result ready into blocked', () => {
  const gate = worker.applyFinishGate(
    { state: 'ready', summary: 'ok', evidenceIds: [] },
    1000,
    60_000,
  )
  assert.equal(gate.state, 'blocked')
  const budget = worker.applyFinishGate(
    { state: 'ready', summary: 'partial', evidenceIds: ['E-001'], stopReason: 'max_tokens' },
    59_000,
    60_000,
  )
  assert.equal(budget.state, 'blocked')
  assert.match(budget.summary, /budget/)
  const good = worker.applyFinishGate(
    { state: 'ready', summary: 'parsed headers and recovered the license check', evidenceIds: ['E-001'] },
    1000,
    60_000,
  )
  assert.equal(good.state, 'ready')
})

await report.check('exact duplicate reports are dropped, distinct ones kept', () => {
  const ticket = team.createTicket({ goal: 'dedupe', caseDir: join(home, 'dedupe-case'), roles: ['triage'] })
  team.recordReport({ ticketId: ticket.id, role: 'triage', state: 'ready', summary: 'same content', evidenceIds: ['E-001'] })
  team.recordReport({ ticketId: ticket.id, role: 'triage', state: 'ready', summary: 'same content', evidenceIds: ['E-001'] })
  const updated = team.recordReport({ ticketId: ticket.id, role: 'triage', state: 'ready', summary: 'different content' })
  const triageReports = updated.reports.filter((r) => r.role === 'triage')
  assert.equal(triageReports.length, 2, 'exact duplicate dropped, distinct kept')
})

await report.check('team policy denies risky dynamic commands and honors role allow/deny', async () => {
  let listener
  policyApi.registerTeamPolicy({ on: (event, fn) => { if (event === 'tools/pre-execute') listener = fn } })
  assert.ok(listener, 'pre-execute listener must be registered')
  const ticket = team.createTicket({ goal: 'policy', caseDir: join(home, 'policy-case'), roles: ['dynamic', 'static'] })
  team.assignRole(ticket.id, 'dynamic', 'policy-dynamic')
  settingsApi.saveSettings({ team: { riskApproval: 'deny', roleToolPolicy: { static: { deny: ['bash'] } } } })
  try {
    const risky = await listener(
      { agent: { id: 'policy-dynamic' }, name: 'bash', args: { command: 'rm -rf /tmp/x' } },
      async () => ({ kind: 'pass' }),
    )
    assert.equal(risky.kind, 'deny')
    assert.match(risky.reason, /high-risk/)
    const safe = await listener(
      { agent: { id: 'policy-dynamic' }, name: 'bash', args: { command: 'ls' } },
      async () => ({ kind: 'pass' }),
    )
    assert.equal(safe.kind, 'pass')
    team.assignRole(ticket.id, 'static', 'policy-static')
    const denied = await listener(
      { agent: { id: 'policy-static' }, name: 'bash', args: { command: 'ls' } },
      async () => ({ kind: 'pass' }),
    )
    assert.equal(denied.kind, 'deny')
    assert.match(denied.reason, /policy denies bash/)
  } finally {
    settingsApi.saveSettings({ team: { riskApproval: 'ask', roleToolPolicy: {} } })
  }
})

await report.check('risky command waits for an approved queue entry, then runs exactly once', async () => {
  let listener
  policyApi.registerTeamPolicy({ on: (event, fn) => { if (event === 'tools/pre-execute') listener = fn } })
  const ticket = team.createTicket({ goal: 'approval', caseDir: join(home, 'approval-case'), roles: ['dynamic'] })
  team.assignRole(ticket.id, 'dynamic', 'approval-dynamic')
  settingsApi.saveSettings({ team: { riskApproval: 'ask', approvalTimeoutSec: 300 } })
  try {
    const exec = { agent: { id: 'approval-dynamic' }, name: 'bash', args: { command: 'rm -rf /tmp/approval' } }
    const pending = await listener(exec, async () => ({ kind: 'pass' }))
    assert.equal(pending.kind, 'deny')
    const approvalId = /A-\d{3}/.exec(pending.reason)?.[0]
    assert.ok(approvalId, 'denial must carry an approval id')
    assert.equal(approvalApi.listApprovals().some((entry) => entry.id === approvalId && entry.status === 'pending'), true)
    approvalApi.decideApproval(approvalId, 'approved')
    const allowed = await listener(exec, async () => ({ kind: 'pass' }))
    assert.equal(allowed.kind, 'pass')
    const reused = await listener(exec, async () => ({ kind: 'pass' }))
    assert.equal(reused.kind, 'deny', 'approval is single-use')
  } finally {
    settingsApi.saveSettings({ team: { riskApproval: 'ask', approvalTimeoutSec: 300 } })
  }
})

rmSync(home, { recursive: true, force: true })
report.finish()
