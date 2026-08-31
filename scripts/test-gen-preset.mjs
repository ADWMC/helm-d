import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = mkdtempSync(join(tmpdir(), 'helmd-gen-preset-'))
const host = join(root, 'standard', 'agent.cordis.yml')
const out = join(root, 'helmd')

try {
  assert.equal(
    readFileSync(join(import.meta.dirname, 'gen-preset.mjs'), 'utf8'),
    readFileSync(join(import.meta.dirname, '..', 'packages', 'helmd', 'scripts', 'gen-preset.mjs'), 'utf8'),
    'packaged preset generator drifted from the repository source',
  )
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
  assert.deepEqual([...generated.matchAll(/^- id: (.+)$/gm)].map((m) => m[1]), ['persona', 'tool-example', 'helmd'])
  assert.match(generated, /- id: tool-example/)
  assert.equal((generated.match(/@dsh-security\/helmd/g) ?? []).length, 1)
  const bundlePatch = readFileSync(join(import.meta.dirname, '..', 'packages', 'helmd', 'cordis.patch.yml'), 'utf8')
  assert.doesNotMatch(bundlePatch, /name: '@dsh-security\/helmd'$/m)
  assert.match(bundlePatch, /@dsh-security\/helmd\/dist\/health\.js/)
  assert.match(generated, /`pwsh` is the native terminal tool/)
  assert.match(generated, /`wsl\.exe -- bash -lc 'command'`/)

  // The activation protocol has one source of truth: the helmd persona.
  const persona = readFileSync(join(import.meta.dirname, '..', 'packages', 'helmd', 'presets', 'persona.txt'), 'utf8')
  assert.equal((persona.match(/Exact input "helmd"/g) ?? []).length, 1)
  assert.match(persona, /Exact input "helmd" → reply ONLY: "helmd online\. Analyst active\. Awaiting task\."/)
  assert.doesNotMatch(readFileSync(join(import.meta.dirname, '..', 'packages', 'router', 'prompt.md'), 'utf8'), /ACTIVATION|reply ONLY|sends exactly/i)
  for (const script of ['packages/skill-evidence/scripts/create_case.py', 'packages/helmd/scripts/evidence/create_case.py']) {
    const source = readFileSync(join(import.meta.dirname, '..', script), 'utf8')
    assert.doesNotMatch(source, /已进入逆向模式|真心为你|activation protocol|startup prompt/i)
  }

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
