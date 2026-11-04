#!/usr/bin/env node
// Local A/B eval for versioned team artifacts.
//
// Inputs are observations from real worker runs, not synthetic model output:
//   node scripts/team-eval.mjs --baseline before.json --candidate after.json
//   node scripts/team-eval.mjs ... --kind role-prompt --id static --revision 3
//   node scripts/team-eval.mjs ... --kind role-prompt --id static --revision 3 --activate
//
// Exit codes: 0 gate passed (or comparison only), 2 gate failed, 1 usage/input error.
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const dist = resolve(import.meta.dirname, '..', 'packages', 'helmd', 'dist')
const evalEntry = resolve(dist, 'team-eval.js')
const teamEntry = resolve(dist, 'team.js')
if (!existsSync(evalEntry) || !existsSync(teamEntry)) {
  console.error('build first: pnpm build')
  process.exit(1)
}
const { compareRuns, evaluateRevisionFromRuns } = await import(pathToFileURL(evalEntry).href)
const { activateRevision } = await import(pathToFileURL(teamEntry).href)

function usage() {
  console.error('usage: node scripts/team-eval.mjs --baseline <json> --candidate <json>')
  console.error('       [--holdout-baseline <json> --holdout-candidate <json>]')
  console.error('       [--kind <artifact-kind> --id <artifact-id> --revision <n> [--activate]]')
}

const args = process.argv.slice(2)
const flags = {}
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i]
  if (!arg.startsWith('--')) fail(`unexpected argument: ${arg}`)
  const key = arg.slice(2)
  if (key === 'activate') flags.activate = true
  else if (i + 1 < args.length) flags[key] = args[++i]
  else fail(`missing value for --${key}`)
}

function fail(message) {
  console.error(message)
  usage()
  process.exit(1)
}

function readRecords(path) {
  let parsed
  try {
    parsed = JSON.parse(readFileSync(resolve(path), 'utf8'))
  } catch (error) {
    fail(`cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`)
  }
  const records = Array.isArray(parsed) ? parsed : parsed?.records
  if (!Array.isArray(records) || records.length === 0) fail(`${path} must be a non-empty JSON array or {"records":[...]}`)
  for (const record of records) {
    if (record === null || typeof record !== 'object' || typeof record.correct !== 'boolean') {
      fail(`${path}: every record needs a boolean "correct" field`)
    }
    // Missing cost fields must not look like an improvement to zero.
    if (typeof record.tokens !== 'number' || !Number.isFinite(record.tokens) || record.tokens < 0) {
      fail(`${path}: every record needs a non-negative numeric "tokens" field`)
    }
    if (typeof record.wallTimeMs !== 'number' || !Number.isFinite(record.wallTimeMs) || record.wallTimeMs < 0) {
      fail(`${path}: every record needs a non-negative numeric "wallTimeMs" field`)
    }
  }
  return records
}

if (!flags.baseline || !flags.candidate) fail('--baseline and --candidate are required')
const baseline = readRecords(flags.baseline)
const candidate = readRecords(flags.candidate)
let holdout
if (flags['holdout-baseline'] !== undefined || flags['holdout-candidate'] !== undefined) {
  if (flags['holdout-baseline'] === undefined || flags['holdout-candidate'] === undefined) {
    fail('--holdout-baseline and --holdout-candidate must be supplied together')
  }
  holdout = {
    baseline: readRecords(flags['holdout-baseline']),
    candidate: readRecords(flags['holdout-candidate']),
  }
}
const comparison = compareRuns(baseline, candidate, holdout)
console.log(JSON.stringify(comparison, null, 2))

const wantsVersion = flags.kind !== undefined || flags.id !== undefined || flags.revision !== undefined
if (wantsVersion) {
  if (!flags.kind || !flags.id || flags.revision === undefined) fail('--kind, --id and --revision must be supplied together')
  const revision = Number(flags.revision)
  if (!Number.isInteger(revision) || revision <= 0) fail('--revision must be a positive integer')
  if (!comparison.pass) {
    console.error('eval gate failed; revision was not evaluated as passing')
    process.exit(2)
  }
  const artifact = evaluateRevisionFromRuns({
    kind: flags.kind,
    id: flags.id,
    revision,
    baseline,
    candidate,
    ...(holdout !== undefined ? { holdout } : {}),
  })
  console.log(`evaluated ${artifact.kind}:${artifact.id}@${artifact.revision} pass=${artifact.eval?.pass}`)
  if (flags.activate) {
    const active = activateRevision(artifact.kind, artifact.id, artifact.revision)
    console.log(`activated ${active.kind}:${active.id}@${active.revision}`)
  }
}

process.exit(comparison.pass ? 0 : 2)
