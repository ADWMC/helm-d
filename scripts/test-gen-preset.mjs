import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = mkdtempSync(join(tmpdir(), 'helmd-gen-preset-'))
const host = join(root, 'standard', 'agent.cordis.yml')
const out = join(root, 'helmd')

try {
  mkdirSync(join(root, 'standard'), { recursive: true })
  writeFileSync(host, [
    '- id: persona',
    "  name: '@deepseek-ai/dsh-persona'",
    '  config:',
    '    text: >-',
    '      host persona',
    '',
    '- id: tool-example',
    "  name: '@example/tool'",
    '',
  ].join('\n'))

  const env = { ...process.env, DSH_HOST_STANDARD_YML: host }
  const run = () => execFileSync(process.execPath, ['scripts/gen-preset.mjs', '--out', out], {
    cwd: join(import.meta.dirname, '..'),
    env,
    encoding: 'utf8',
  })

  const first = run()
  const outputPath = join(out, 'agent.cordis.yml')
  assert.match(first, /generated:/)
  const generated = readFileSync(outputPath, 'utf8')
  assert.match(generated, /^# gen-preset: host=[0-9a-f]{64}/)
  assert.deepEqual([...generated.matchAll(/^- id: (.+)$/gm)].map((m) => m[1]), ['persona'])
  assert.doesNotMatch(generated, /@dsh-security\/helmd/)
  assert.doesNotMatch(generated, /@deepseek-ai\/dsh-tool-/)

  const firstMtime = statSync(outputPath).mtimeMs
  await new Promise((resolve) => setTimeout(resolve, 1100))
  const second = run()
  const secondMtime = statSync(outputPath).mtimeMs
  assert.match(second, /unchanged:/)
  assert.equal(firstMtime, secondMtime)
  console.log('preset generator idempotency: PASS')
} finally {
  rmSync(root, { recursive: true, force: true })
}
