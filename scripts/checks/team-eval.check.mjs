// Subject: the local evaluation CLI. It must read real run records, refuse a
// candidate that regresses, and only activate a revision after the gate passes.
// The DSH home is throwaway; no host process or model is involved.
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { distDir, repoRoot } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const entry = join(distDir, 'team.js')
if (!existsSync(entry)) skip('team-eval', 'need packages/helmd/dist (run pnpm build)')
const home = mkdtempSync(join(tmpdir(), 'helmd-team-eval-'))
process.env.DSH_HOME = home
const team = await import(pathToFileURL(entry).href)
const fixture = (name) => join(import.meta.dirname, 'fixtures', 'team-eval', name)
const cli = join(repoRoot, 'scripts', 'team-eval.mjs')
const report = createReporter('team-eval')

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], {
    env: { ...process.env, DSH_HOME: home },
    encoding: 'utf8',
  })
}

await report.check('CLI compares two run sets and passes an improving candidate', () => {
  const result = run(['--baseline', fixture('baseline.json'), '--candidate', fixture('candidate.json')])
  assert.equal(result.status, 0, result.stderr)
  const parsed = JSON.parse(result.stdout.slice(0, result.stdout.lastIndexOf('}') + 1))
  assert.equal(parsed.pass, true)
  assert.equal(parsed.candidate.evidence, 1)
})

await report.check('CLI refuses a regressing candidate with exit 2', () => {
  const result = run(['--baseline', fixture('candidate.json'), '--candidate', fixture('baseline.json')])
  assert.equal(result.status, 2)
  assert.match(result.stdout, /"pass": false/)
})

await report.check('CLI refuses records without cost metrics instead of treating them as zero', () => {
  const missing = join(home, 'missing-cost.json')
  writeFileSync(missing, JSON.stringify([{ id: 'x', correct: true }]), 'utf8')
  const result = run(['--baseline', missing, '--candidate', fixture('candidate.json')])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /numeric "tokens"/)
})

await report.check('CLI evaluates a proposed revision and activates only after the gate', () => {
  const revision = team.proposeRevision({ kind: 'role-prompt', id: 'static', value: 'eval-cli', source: 'check' })
  const result = run([
    '--baseline', fixture('baseline.json'),
    '--candidate', fixture('candidate.json'),
    '--kind', revision.kind,
    '--id', revision.id,
    '--revision', String(revision.revision),
    '--activate',
  ])
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /activated role-prompt:static@1/)
  assert.equal(team.activeRevision('role-prompt', 'static').revision, 1)
  assert.equal(team.activeRevision('role-prompt', 'static').value, 'eval-cli')
})

rmSync(home, { recursive: true, force: true })
report.finish()
