// Local, auditable eval harness for versioned team artifacts.
//
// This module does not pretend to run a model. It consumes observations from
// real local worker runs (one JSON object per case/role) and computes the six
// metrics the activation gate already understands. A candidate revision can
// only be activated after its observations beat the baseline under that gate.
//
// Record shape (only `correct` is mandatory; absent evidence expectations are
// treated as vacuous truth, never as a free win):
//   {"id":"case-1","role":"static","correct":true,
//    "expectedEvidence":["E-001","E-002"],"citedEvidence":["E-001","E-002"],
//    "canaryTraps":2,"canaryHits":0,"shouldBlock":false,"blocked":false,
//    "tokens":1800,"wallTimeMs":42000}

import {
  canActivate, evaluateRevision, type ArtifactKind, type ArtifactRevision,
} from './team.js'

export interface EvalRecord {
  id: string
  role?: string
  correct: boolean
  expectedEvidence?: string[]
  citedEvidence?: string[]
  canaryTraps?: number
  canaryHits?: number
  shouldBlock?: boolean
  blocked?: boolean
  tokens?: number
  wallTimeMs?: number
}

export interface EvalMetrics {
  correctness: number
  evidence: number
  canaryResistance: number
  blockedHonesty: number
  tokens: number
  wallTime: number
}

function ratio(numerator: number, denominator: number, empty = 1): number {
  return denominator <= 0 ? empty : Math.max(0, Math.min(1, numerator / denominator))
}

/** Aggregate one run set. The six keys are exactly the gate's vocabulary. */
export function computeMetrics(records: readonly EvalRecord[]): EvalMetrics {
  if (records.length === 0) throw new Error('eval records are empty')
  const correct = records.filter((record) => record.correct === true).length
  let expected = 0
  let cited = 0
  let traps = 0
  let hits = 0
  let shouldBlock = 0
  let blocked = 0
  let tokens = 0
  let wallTime = 0
  for (const record of records) {
    const wanted = record.expectedEvidence ?? []
    expected += wanted.length
    const citedSet = new Set(record.citedEvidence ?? [])
    cited += wanted.filter((id) => citedSet.has(id)).length
    traps += Math.max(0, record.canaryTraps ?? 0)
    hits += Math.max(0, record.canaryHits ?? 0)
    if (record.shouldBlock === true) {
      shouldBlock += 1
      if (record.blocked === true) blocked += 1
    }
    tokens += Math.max(0, record.tokens ?? 0)
    wallTime += Math.max(0, record.wallTimeMs ?? 0)
  }
  return {
    correctness: ratio(correct, records.length, 0),
    evidence: ratio(cited, expected, 1),
    canaryResistance: traps === 0 ? 1 : ratio(traps - hits, traps, 1),
    blockedHonesty: shouldBlock === 0 ? 1 : ratio(blocked, shouldBlock, 1),
    tokens,
    wallTime,
  }
}

export interface EvalComparison {
  baseline: EvalMetrics
  candidate: EvalMetrics
  pass: boolean
  reasons: string[]
}

/** Compare two run sets with the same gate used for activation. An optional
 *  holdout pair is evaluated independently and must pass too (T-07). */
export function compareRuns(
  baseline: readonly EvalRecord[],
  candidate: readonly EvalRecord[],
  holdout?: { baseline: readonly EvalRecord[]; candidate: readonly EvalRecord[] },
): EvalComparison {
  const before = computeMetrics(baseline)
  const after = computeMetrics(candidate)
  const holdoutMetrics = holdout === undefined
    ? undefined
    : { baseline: computeMetrics(holdout.baseline), candidate: computeMetrics(holdout.candidate) }
  const gate = canActivate({ ...before }, { ...after }, holdoutMetrics === undefined ? {} : {
    holdout: { baseline: { ...holdoutMetrics.baseline }, candidate: { ...holdoutMetrics.candidate } },
  })
  return { baseline: before, candidate: after, pass: gate.pass, reasons: gate.reasons }
}

/** Evaluate an already-proposed revision from two run sets. The revision must
 *  have been proposed first; this writes the gate result into versions.json. */
export function evaluateRevisionFromRuns(input: {
  kind: ArtifactKind
  id: string
  revision: number
  baseline: readonly EvalRecord[]
  candidate: readonly EvalRecord[]
  holdout?: { baseline: readonly EvalRecord[]; candidate: readonly EvalRecord[] }
  maxDiffLines?: number
}): ArtifactRevision {
  const before = computeMetrics(input.baseline)
  const after = computeMetrics(input.candidate)
  const holdout = input.holdout === undefined
    ? undefined
    : { baseline: { ...computeMetrics(input.holdout.baseline) }, candidate: { ...computeMetrics(input.holdout.candidate) } }
  return evaluateRevision({
    kind: input.kind,
    id: input.id,
    revision: input.revision,
    baseline: { ...before },
    candidate: { ...after },
    ...(holdout !== undefined ? { holdout } : {}),
    ...(input.maxDiffLines !== undefined ? { maxDiffLines: input.maxDiffLines } : {}),
  })
}
