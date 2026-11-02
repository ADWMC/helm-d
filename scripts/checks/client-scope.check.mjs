// Subject: helm-d's browser surfaces must not leak into sessions running a
// different agent preset. The client module itself is injected globally, so
// the isolation contract lives in three choices: keep the official
// `agent-preset` seat, mount the star gate inside the helmd-only capsule, and
// do not advertise the workbench tab in every session's guide.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { repoRoot } from './artifacts.mjs'
import { createReporter } from './reporter.mjs'

const source = readFileSync(join(repoRoot, 'packages', 'helmd', 'client.js'), 'utf8')
const report = createReporter('client-scope')

await report.check('the header capsule does not shadow the official agent-preset seat', () => {
  assert.ok(!/id:\s*"agent-preset"/.test(source), 'the official header label must keep its seat')
  assert.match(source, /id:\s*"helm-d:workbench"/, 'the workbench capsule needs its own id')
})

await report.check('the star gate is mounted only inside the helmd-only capsule', () => {
  assert.ok(!/name:\s*"shell\.overlay"/.test(source), 'the gate must not register in the global shell overlay')
  assert.match(source, /h\(HelmdGatePanel\)/, 'the gate must be rendered by the capsule')
})

await report.check('non-helmd sessions get no capsule and no guide entry', () => {
  assert.match(source, /if \(preset !== "helmd"\) return null/, 'non-helmd must return null')
  assert.ok(!/guide:\s*\[/.test(source), 'the workbench tab must not be advertised globally')
})

report.finish()
