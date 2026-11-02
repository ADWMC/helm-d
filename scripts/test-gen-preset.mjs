import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = mkdtempSync(join(tmpdir(), 'helmd-gen-preset-'))
// The same trimmed 0.1.7 host `standard.patch.yml` the checks use: a preset is a
// dsh-agent-preset composition row whose config.plugins carries the platform rows.
const hostFixture = join(import.meta.dirname, 'checks', 'fixtures', 'host-standard.patch.yml')
const out = join(root, 'helmd')

try {
  assert.equal(
    readFileSync(join(import.meta.dirname, 'gen-preset.mjs'), 'utf8').replace(/\r\n/g, '\n'),
    readFileSync(join(import.meta.dirname, '..', 'packages', 'helmd', 'scripts', 'gen-preset.mjs'), 'utf8').replace(/\r\n/g, '\n'),
    'packaged preset generator drifted from the repository source',
  )
  mkdirSync(join(root, 'standard'), { recursive: true })
  const host = join(root, 'standard', 'standard.patch.yml')
  writeFileSync(host, readFileSync(hostFixture, 'utf8'))

  const env = { ...process.env, DSH_HOST_STANDARD_YML: host }
  const run = () => execFileSync(process.execPath, ['scripts/gen-preset.mjs', '--out', out], {
    cwd: join(import.meta.dirname, '..'),
    env,
    encoding: 'utf8',
  })

  const first = run()
  const outputPath = join(out, 'preset.generated.patch.yml')
  assert.match(first, /generated:/)
  const generated = readFileSync(outputPath, 'utf8')
  assert.match(generated, /^# gen-preset: host=[0-9a-f]{64}/)
  // Top-level plugin rows (indent 10) are the host's own, in host order, plus helmd.
  assert.deepEqual(
    [...generated.matchAll(/^ {10}- id: (.+)$/gm)].map((m) => m[1]),
    ['persona', 'tool-pwsh', 'tool-fs', 'planning', 'helmd'],
  )
  assert.match(generated, /^ {10}  name: '@deepseek-ai\/dsh-tool-pwsh'$/m, 'platform rows must survive')
  assert.match(generated, /disabled: !!js process\.platform !== 'win32'/, 'host `!!js` expressions must pass through')
  assert.match(generated, /^ {14}- id: plan-mode$/m, 'group children must stay nested in their group')
  // The entry is retargeted at helmd and keeps the preset.yml display metadata.
  assert.match(generated, /^- insert:$/m, 'the patch must stay an insert-patch')
  assert.match(generated, /^ {4}- id: preset-helmd$/m)
  assert.match(generated, /^ {6}name: '@deepseek-ai\/dsh-agent-preset'$/m)
  assert.match(generated, /^ {8}id: helmd$/m)
  assert.match(generated, /^ {8}order: 10$/m, 'preset.yml order must migrate into the entry config')
  assert.match(generated, /^ {8}description: "helmd: /m, 'preset.yml description must migrate into the entry config')
  assert.match(generated, /^ {10}- id: helmd\n {12}name: '@adwmc\/helm-d\/agent'$/m, 'the agent row must sit at the plugins level')
  assert.doesNotMatch(generated, /\{\{model\}\}|\{\{cwd\}\}/, 'host persona templates must not leak')
  assert.match(generated, /\n$/, 'the patch must end with a newline')
  // The agent row is the /agent subpath; the host row must be the BARE package name.
  // The host's client-modules discovers `dsh.client` only from a Loader row whose name is
  // exactly `@scope/name`, so a deep-path host row silently loses the browser half (the
  // settings card never enters the module graph). The host plane must therefore never
  // resolve to the tool entry: the root export carries the health surface only.
  assert.equal((generated.match(/@adwmc\/helm-d/g) ?? []).length, 1)
  assert.match(generated, /name: '@adwmc\/helm-d\/agent'$/m, 'the agent row must be the /agent subpath')
  const bundlePatch = readFileSync(join(import.meta.dirname, '..', 'packages', 'helmd', 'cordis.patch.yml'), 'utf8')
  assert.match(bundlePatch, /name: '@adwmc\/helm-d'$/m, 'the host row must be the bare package name')
  const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'packages', 'helmd', 'package.json'), 'utf8'))
  assert.equal(pkg.exports['.'].default, './dist/health.js', 'the bare name must resolve to the host-plane health entry, never the tool entry')
  assert.equal(pkg.exports['./agent'].default, './dist/index.js', 'the tool entry is reached through the /agent subpath only')
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

  // A pre-0.1.7 host standard carries no `plugins:` list. Emitting a patch the
  // current loader cannot consume would look healthy and mount nothing, so the
  // generator must fail loud and write nothing.
  const legacyHost = join(root, 'standard', 'agent.cordis.yml')
  writeFileSync(legacyHost, "- id: persona\n  name: '@deepseek-ai/dsh-persona'\n  config:\n    prefix: host persona\n\n- id: tool-example\n  name: '@example/tool'\n")
  const legacyDir = join(root, 'legacy')
  let rejected = null
  try {
    execFileSync(process.execPath, ['scripts/gen-preset.mjs', '--out', legacyDir], {
      cwd: join(import.meta.dirname, '..'),
      env: { ...process.env, DSH_HOST_STANDARD_YML: legacyHost },
      encoding: 'utf8',
      stdio: 'pipe',
    })
  } catch (e) {
    rejected = String(e.stderr ?? '') + String(e.message ?? '')
  }
  assert.ok(rejected !== null, 'a pre-0.1.7 host standard must be rejected, not reshaped')
  assert.match(rejected, /no `plugins:` list/)
  assert.equal(existsSync(join(legacyDir, 'preset.generated.patch.yml')), false, 'a rejected run must write nothing')
  console.log('preset generator idempotency: PASS')
} finally {
  rmSync(root, { recursive: true, force: true })
}
