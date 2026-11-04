// Subject: Workbench CSS tokens (T-10). Every design token consumed by the
// browser half must be defined by the installed host stylesheet; an unknown
// token silently falls back to an unstyled color in dark mode.
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { repoRoot } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const report = createReporter('ui-tokens')
const clientPath = join(repoRoot, 'packages', 'helmd', 'client.js')
const client = readFileSync(clientPath, 'utf8')
const used = [...new Set([...client.matchAll(/var\((--dsw-[a-z0-9-]+)/g)].map((match) => match[1]))]

const candidates = [
  join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'npm', 'node_modules', '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-web-frontend', 'dist', 'assets'),
  join('/usr/local/lib/node_modules', '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-web-frontend', 'dist', 'assets'),
]
const themeClient = join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'npm', 'node_modules', '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-client-ui-theme', 'lib', 'client.js')
const assets = candidates.find((dir) => existsSync(dir))
if (assets === undefined && !existsSync(themeClient)) skip('ui-tokens', 'host web frontend assets not installed')
const cssFiles = assets === undefined ? [] : readdirSync(assets).filter((name) => name.endsWith('.css'))
const css = [
  ...cssFiles.map((name) => readFileSync(join(assets, name), 'utf8')),
  ...(existsSync(themeClient) ? [readFileSync(themeClient, 'utf8')] : []),
].join('\n')
const defined = new Set([...css.matchAll(/(--dsw-[a-z0-9-]+)\s*:/g)].map((match) => match[1]))

await report.check('every --dsw token used by client.js is defined by the host CSS', () => {
  assert.ok(used.length > 20, 'expected the workbench to use host tokens')
  const missing = used.filter((token) => !defined.has(token))
  assert.deepEqual(missing, [], `undefined design tokens: ${missing.join(', ')}`)
})

report.finish()
