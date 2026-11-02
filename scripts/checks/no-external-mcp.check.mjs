// Asserts that helm-d does NOT depend on or register any external MCP tools.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { repoRoot } from './artifacts.mjs'
import { createReporter } from './reporter.mjs'

const report = createReporter('no-external-mcp')
const srcDir = resolve(repoRoot, 'packages/helmd/src')
const pkgJson = JSON.parse(readFileSync(resolve(repoRoot, 'packages/helmd/package.json'), 'utf8'))

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(p))
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) out.push(p)
  }
  return out
}

try {
  const deps = JSON.stringify(pkgJson.dependencies ?? {}) + JSON.stringify(pkgJson.peerDependencies ?? {})
  report.check('no MCP client dependency in package.json', () => {
    if (deps.includes('mcp-client') || deps.includes('mcp-sdk') || deps.includes('modelcontextprotocol')) {
      throw new Error('MCP dependency found in package.json')
    }
  })

  report.check('no mcp__ tool prefix in source', () => {
    for (const f of walk(srcDir)) {
      const text = readFileSync(f, 'utf8')
      if (text.includes('mcp__')) throw new Error(`mcp__ found in ${f}`)
    }
  })

  report.check('no MCP server registration in source', () => {
    for (const f of walk(srcDir)) {
      const text = readFileSync(f, 'utf8')
      if (/mcp.*server|McpServer|mcp-server/i.test(text) && !text.includes('// ') && !text.includes('* ')) {
        // Only flag if it looks like actual code, not a comment
        const codeLines = text.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
        if (codeLines.some(l => /mcp.*server|McpServer/i.test(l))) {
          throw new Error(`MCP server registration found in ${f}`)
        }
      }
    }
  })

  report.finish()
} catch (e) {
  console.error(e)
  process.exit(1)
}
