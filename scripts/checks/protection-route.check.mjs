import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { distDir } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const entry = join(distDir, 'protection-route.js')
if (!existsSync(entry)) skip('protection-route', 'need packages/helmd/dist (run pnpm build)')
const { chooseProtectionAction: choose } = await import(pathToFileURL(entry).href)
const report = createReporter('protection-route')
const base = {
  targetVisible: false, staticAttempts: 2, runtimeDependent: false, writeExecuteEvidence: false,
  localVmEvidence: false, generatedCodeEvidence: false, signatureOnly: true,
  canRunIsolated: true, observerReady: true, observerFailed: false, discriminatingQuestion: true,
}

await report.check('signature alone never asserts a packer or decryption algorithm', () => {
  const result = choose({ ...base, staticAttempts: 0 })
  assert.equal(result.kind, 'candidate-only')
  assert.equal(result.action, 'static-target')
  assert.equal(result.algorithm, 'unknown')
  assert.equal(result.artifact, 'none')
})

await report.check('visible target wins over unrelated high entropy', () => {
  assert.equal(choose({ ...base, targetVisible: true }).action, 'static-target')
})

await report.check('dynamic requires isolation, a valid observer and a discriminating question', () => {
  const packed = { ...base, writeExecuteEvidence: true }
  assert.equal(choose({ ...packed, canRunIsolated: false }).action, 'collect-environment')
  assert.equal(choose({ ...packed, observerReady: false }).action, 'calibrate-observer')
  assert.equal(choose({ ...packed, observerFailed: true }).action, 'calibrate-observer')
  assert.equal(choose({ ...packed, discriminatingQuestion: false }).action, 'static-transform')
  assert.equal(choose(packed).action, 'dynamic-write-execute')
})

await report.check('VM/bytecode gets a target trace rather than a whole-image dump', () => {
  const result = choose({ ...base, localVmEvidence: true, writeExecuteEvidence: true })
  assert.equal(result.kind, 'local-virtualization')
  assert.equal(result.action, 'dynamic-target')
})

await report.check('broken observations and malformed attempts never gain authority', () => {
  assert.throws(() => choose({ ...base, staticAttempts: -1 }))
  assert.equal(choose({ ...base, observerFailed: true }).action, 'calibrate-observer')
})

report.finish()
