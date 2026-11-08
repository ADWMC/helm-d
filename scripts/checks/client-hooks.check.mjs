// Subject: the header capsule must declare every React hook before it can
// return early. The preset projection resolves asynchronously, so a capsule
// that returns null while `preset` is undefined and later renders with more
// hooks crashes React with "Rendered more hooks than during the previous
// render" (React error #300) and takes the workbench entry down with it.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { repoRoot } from './artifacts.mjs'
import { createReporter } from './reporter.mjs'

const source = readFileSync(join(repoRoot, 'packages', 'helmd', 'client.js'), 'utf8')
const report = createReporter('client-hooks')

const start = source.indexOf('function HelmdPresetCapsuleButton(props)')
const end = source.indexOf('// Keep the official agent-preset label', start)
assert.ok(start >= 0, 'HelmdPresetCapsuleButton must exist')
assert.ok(end > start, 'the capsule boundary must be locatable')
const body = source.slice(start, end)

await report.check('the capsule declares every React hook before its early returns', () => {
  const hooks = [...body.matchAll(/React\.(?:useState|useRef|useEffect|useMemo|useCallback|useLayoutEffect)\s*\(/g)]
  const firstReturn = body.search(/\breturn\s+null\b/)
  assert.ok(hooks.length >= 5, `expected at least five hook calls, found ${hooks.length}`)
  assert.ok(firstReturn > 0, 'the capsule must keep its preset guard')
  for (const hook of hooks) {
    assert.ok(hook.index < firstReturn, `${hook[0]} at offset ${hook.index} must precede the first conditional return at offset ${firstReturn}`)
  }
})

report.finish()
