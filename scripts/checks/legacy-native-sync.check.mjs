import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createReporter } from './reporter.mjs'

const root = join(import.meta.dirname, '..', '..', 'packages')
const report = createReporter('legacy-native-sync')
const docs = [
  'packer-handling.md', 'protection-detection-methodology.md', 'dynamic-analysis.md',
  'dynamic-analysis-frida.md', 'native-principles.md', 'sample-intake-playbook.md',
  'verification-patterns.md', 'crypto-validation-patterns.md', 'native-casebook.md',
  'bypass-case-tusi-netease.md', 'vmp-pe-fast-triage.md',
]
await report.check('legacy package protection guidance matches the unified package', () => {
  for (const doc of docs) {
    const current = readFileSync(join(root, 'helmd', 'references', 'native', doc), 'utf8')
    const legacy = readFileSync(join(root, 'skill-native', 'references', doc), 'utf8')
    assert.equal(legacy, current, `stale independent skill-native card: ${doc}`)
  }
  assert.equal(
    readFileSync(join(root, 'skill-native', 'scripts', 'protection', 'detect_packer.py'), 'utf8'),
    readFileSync(join(root, 'helmd', 'scripts', 'native', 'protection', 'detect_packer.py'), 'utf8'),
    'stale independent packer detector',
  )
})
report.finish()
