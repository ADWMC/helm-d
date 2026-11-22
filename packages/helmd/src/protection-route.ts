// Pure protection triage. Input observations are agent-provided and therefore
// provisional; this function constrains recommendations, not execution.
export type ProtectionAction = 'static-target' | 'static-transform' | 'dynamic-target' | 'dynamic-write-execute' | 'calibrate-observer' | 'collect-environment'
export type ProtectionKind = 'candidate-only' | 'whole-image-transform' | 'local-virtualization' | 'runtime-generated' | 'no-transform-observed'

export interface ProtectionSignals {
  targetVisible: boolean
  staticAttempts: number
  runtimeDependent: boolean
  writeExecuteEvidence: boolean
  localVmEvidence: boolean
  generatedCodeEvidence: boolean
  signatureOnly: boolean
  canRunIsolated: boolean
  observerReady: boolean
  observerFailed: boolean
  discriminatingQuestion: boolean
}

export interface ProtectionDecision {
  action: ProtectionAction
  kind: ProtectionKind
  reason: string
  confidence: 'candidate' | 'structural'
  algorithm: 'unknown'
  artifact: 'none'
}

export function chooseProtectionAction(s: ProtectionSignals): ProtectionDecision {
  if (!Number.isInteger(s.staticAttempts) || s.staticAttempts < 0) throw new Error('staticAttempts must be a nonnegative integer')
  const kind: ProtectionKind = s.localVmEvidence ? 'local-virtualization'
    : s.generatedCodeEvidence ? 'runtime-generated'
      : s.writeExecuteEvidence ? 'whole-image-transform'
        : s.signatureOnly ? 'candidate-only' : 'no-transform-observed'
  const base = (action: ProtectionAction, reason: string): ProtectionDecision => ({
    action, kind, reason, confidence: s.localVmEvidence || s.generatedCodeEvidence || s.writeExecuteEvidence ? 'structural' : 'candidate',
    algorithm: 'unknown', artifact: 'none',
  })
  if (s.targetVisible && !s.runtimeDependent) return base('static-target', 'Target is visible; inspect its input/output slice before running a protected sample.')
  if (!s.writeExecuteEvidence && !s.localVmEvidence && !s.generatedCodeEvidence && s.staticAttempts < 2) {
    return base('static-target', 'Only a signature or unresolved target: gather a goal-linked static observation.')
  }
  if (!s.canRunIsolated) return base('collect-environment', 'No isolated execution; continue bounded static transform analysis or obtain an environment.')
  if (s.observerFailed || !s.observerReady) return base('calibrate-observer', 'Observer is unverified or failed; absence of events cannot refute the mechanism.')
  if (!s.discriminatingQuestion) return base('static-transform', 'Specify an observable transition and competing predictions before dynamic execution.')
  if (s.localVmEvidence) return base('dynamic-target', 'Trace the target VM input/output boundary; a whole-image dump is not implied.')
  if (s.writeExecuteEvidence || s.generatedCodeEvidence) return base('dynamic-write-execute', 'Observe bounded write-to-execute transition and map the captured region to this run.')
  return base('dynamic-target', 'Static target remains unresolved; perform a bounded discriminating trace.')
}
