// Subject: the star gate's failure backoff. The device flow is network-bound;
// a failing endpoint used to be retried on every 5s panel poll. The backoff is
// the pure policy that prevents that, so it is checked without any network.
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { distDir } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const entry = join(distDir, 'gate.js')
if (!existsSync(entry)) skip('gate-flow', 'need packages/helmd/dist (run pnpm build)')
const { backoffMs } = await import(pathToFileURL(entry).href)
const report = createReporter('gate-flow')

await report.check('device-flow failures back off exponentially', () => {
  assert.equal(backoffMs(1), 30_000)
  assert.equal(backoffMs(2), 60_000)
  assert.equal(backoffMs(3), 120_000)
  assert.equal(backoffMs(4), 240_000)
})

await report.check('backoff caps at five minutes', () => {
  assert.equal(backoffMs(5), 300_000)
  assert.equal(backoffMs(9), 300_000)
  assert.equal(backoffMs(0), 30_000)
})

report.finish()
