// Asserts that playbook YAML files exist and are valid.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { repoRoot } from './artifacts.mjs'
import { createReporter } from './reporter.mjs'

const report = createReporter('playbook')
const pbDir = resolve(repoRoot, 'packages/helmd/references/playbooks')

try {
  report.check('playbooks directory exists', () => {
    if (!existsSync(pbDir)) throw new Error('references/playbooks/ not found')
  })

  for (const name of ['reverse.yaml', 'pentest.yaml', 'triggers.yaml']) {
    report.check(`${name} exists and has schema`, () => {
      const p = join(pbDir, name)
      if (!existsSync(p)) throw new Error(`${name} not found`)
      const text = readFileSync(p, 'utf8')
      if (!text.includes('schema: 1')) throw new Error(`${name} missing schema: 1`)
    })
  }

  report.check('reverse.yaml has phases', () => {
    const text = readFileSync(join(pbDir, 'reverse.yaml'), 'utf8')
    if (!text.includes('phases:')) throw new Error('reverse.yaml missing phases')
    if (!text.includes('intake')) throw new Error('reverse.yaml missing intake phase')
  })

  report.check('pentest.yaml has phases', () => {
    const text = readFileSync(join(pbDir, 'pentest.yaml'), 'utf8')
    if (!text.includes('phases:')) throw new Error('pentest.yaml missing phases')
    if (!text.includes('scope')) throw new Error('pentest.yaml missing scope phase')
  })

  report.check('triggers.yaml has triggers', () => {
    const text = readFileSync(join(pbDir, 'triggers.yaml'), 'utf8')
    if (!text.includes('triggers:')) throw new Error('triggers.yaml missing triggers')
    if (!text.includes('observe:')) throw new Error('triggers.yaml missing observe entries')
  })

  report.finish()
} catch (e) {
  console.error(e)
  process.exit(1)
}
