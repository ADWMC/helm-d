// Subject: Workbench CSS tokens (T-10). Every design token consumed by the
// browser half must be defined by the host stylesheet; an unknown token
// silently falls back to an unstyled color in dark mode. Two layers:
//   * the installed host (when one is present on this machine);
//   * every in-interval host generation's committed token contract
//     (fixtures/host-tokens-*.css, deduplicated by content — see
//     fixtures/dsh-host-manifest.json), so a token client.js starts using is
//     caught when ANY supported host generation never shipped it.
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { repoRoot } from './artifacts.mjs'
import { createReporter } from './reporter.mjs'

const report = createReporter('ui-tokens')
const here = dirname(fileURLToPath(import.meta.url))
const clientPath = join(repoRoot, 'packages', 'helmd', 'client.js')
const client = readFileSync(clientPath, 'utf8')
const used = [...new Set([...client.matchAll(/var\((--dsw-[a-z0-9-]+)/g)].map((match) => match[1]))]
const definedOf = (css) => new Set([...css.matchAll(/(--dsw-[a-z0-9-]+)\s*:/g)].map((match) => match[1]))

const candidates = [
  join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'npm', 'node_modules', '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-web-frontend', 'dist', 'assets'),
  join('/usr/local/lib/node_modules', '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-web-frontend', 'dist', 'assets'),
]
const themeClient = join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'npm', 'node_modules', '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-client-ui-theme', 'lib', 'client.js')
const assets = candidates.find((dir) => existsSync(dir))
const cssFiles = assets === undefined ? [] : readdirSync(assets).filter((name) => name.endsWith('.css'))
const installedCss = [
  ...cssFiles.map((name) => readFileSync(join(assets, name), 'utf8')),
  ...(existsSync(themeClient) ? [readFileSync(themeClient, 'utf8')] : []),
].join('\n')

if (installedCss !== '') {
  await report.check('every --dsw token used by client.js is defined by the installed host CSS', () => {
    assert.ok(used.length > 20, 'expected the workbench to use host tokens')
    const missing = used.filter((token) => !definedOf(installedCss).has(token))
    assert.deepEqual(missing, [], `undefined design tokens: ${missing.join(', ')}`)
  })
} else {
  console.log('  note: no installed host web frontend assets — installed-host layer skipped')
}

// Interval regression: the manifest records each in-interval host generation's
// token contract fixture; adjacent generations often share one, so dedupe.
const manifest = JSON.parse(readFileSync(join(here, 'fixtures', 'dsh-host-manifest.json'), 'utf8'))
const tokenFixtures = [...new Set(manifest.hosts.map((host) => host.tokens.fixture))]

await report.check(`every --dsw token used by client.js is defined by all ${tokenFixtures.length} in-interval host token contracts`, () => {
  assert.ok(tokenFixtures.length > 1, 'the interval must span more than one frontend generation')
  const problems = []
  for (const name of tokenFixtures) {
    const text = readFileSync(join(here, 'fixtures', name), 'utf8')
    const defined = definedOf(text)
    assert.ok(defined.size > 100, `${name} looks truncated (${defined.size} tokens)`)
    const missing = used.filter((token) => !defined.has(token))
    if (missing.length > 0) problems.push(`${name}: ${missing.join(', ')}`)
  }
  assert.deepEqual(problems, [], problems.join('\n'))
})

report.finish()
