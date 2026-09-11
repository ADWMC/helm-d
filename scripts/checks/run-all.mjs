// Runner: execute every `*.check.mjs` in this directory, in name order, and exit non-zero
// if any failed. One responsibility: run the check set — adding a check must not require
// editing package.json or this file.
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const checks = readdirSync(import.meta.dirname).filter((name) => name.endsWith('.check.mjs')).sort()
if (checks.length === 0) {
  console.log('checks: none found')
  process.exit(0)
}

let failed = 0
for (const check of checks) {
  const result = spawnSync(process.execPath, [join(import.meta.dirname, check)], { stdio: 'inherit' })
  if (result.status !== 0) failed += 1
}

console.log(failed === 0 ? `checks: ${checks.length} PASS` : `checks: ${failed}/${checks.length} FAILED`)
process.exit(failed === 0 ? 0 : 1)
