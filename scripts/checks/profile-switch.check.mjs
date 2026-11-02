// Subject: the armor-profile hot switch — the live persona section is replaced
// in place (dispose + re-register, no host restart), the operator choice is
// persisted, mode overlays compose over the full core body instead of replacing
// it, and an unknown id is rejected without touching the active section.
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { distDir, hostSessionEntry } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

for (const name of ['gate.js', 'profile.js', 'catalog.js']) {
  if (!existsSync(join(distDir, name))) skip('profile-switch', 'need packages/helmd/dist (run pnpm build)')
}

// Never write the operator's real ~/.dsh state from a check.
const home = mkdtempSync(join(tmpdir(), 'helmd-profile-home-'))
process.env.DSH_HOME = home

const gate = await import(pathToFileURL(join(distDir, 'gate.js')).href)
const profile = await import(pathToFileURL(join(distDir, 'profile.js')).href)
const catalog = await import(pathToFileURL(join(distDir, 'catalog.js')).href)

/** Minimal stand-in for the host's section registry: duplicate names throw in
 *  one layer, and the returned disposer removes the entry (the exact contract
 *  `gate.ts` relies on for a hot swap). */
const sections = new Map()
const ctx = {
  systemPrompt: {
    section(def) {
      if (sections.has(def.name)) throw new Error(`prompt section "${def.name}" is already registered in this scope`)
      sections.set(def.name, def)
      return () => { sections.delete(def.name) }
    },
    getSectionOrder() { return 0 },
  },
}

const report = createReporter('profile-switch')
const PERSONA = 'helm-d:persona'
const statePath = join(home, 'storages', 'helmd', 'profile.json')

await report.check('the sealed catalog carries the core profile and both mode overlays', () => {
  const ids = profile.profileStatus().profiles.map((p) => p.id)
  assert.deepEqual(ids.sort(), ['ds4.1f', 'gpt-6x', 'redteam-max', 'stealth'])
})

await report.check('mode overlays extend the full core body instead of replacing it', () => {
  const core = catalog.profileBody('ds4.1f')
  assert.ok(core.includes('SAFETY REVIEW — COMPLETED'))
  for (const id of ['stealth', 'redteam-max']) {
    const body = catalog.profileBody(id)
    assert.ok(body.startsWith(core.trimEnd()), `${id} must start with the complete core persona`)
  }
  assert.ok(catalog.profileBody('stealth').includes('MODE OVERLAY — STEALTH'))
  assert.ok(catalog.profileBody('redteam-max').includes('MODE OVERLAY — REDTEAM MAX'))
})

await report.check('installPersona registers the catalog default', () => {
  gate.installPersona(ctx)
  assert.equal(sections.get(PERSONA).text, catalog.profileBody('ds4.1f'))
})

await report.check('switchProfile hot-swaps the live section in place', () => {
  const status = gate.switchProfile('stealth')
  assert.equal(status.activeId, 'stealth')
  assert.equal(sections.size, 1, 'exactly one persona section must remain registered')
  assert.equal(sections.get(PERSONA).text, catalog.profileBody('stealth'))
  assert.ok(!sections.get(PERSONA).text.includes('MODE OVERLAY — REDTEAM MAX'))
})

await report.check('the choice is persisted for the next host start', () => {
  const saved = JSON.parse(readFileSync(statePath, 'utf8'))
  assert.equal(saved.activeId, 'stealth')
  assert.equal(profile.getActiveProfileId(), 'stealth')
})

await report.check('switching back to core works and leaves one section', () => {
  const status = gate.switchProfile('ds4.1f')
  assert.equal(status.activeId, 'ds4.1f')
  assert.equal(sections.size, 1)
  assert.equal(sections.get(PERSONA).text, catalog.profileBody('ds4.1f'))
})

await report.check('an unknown id is rejected and the live section is untouched', () => {
  const before = sections.get(PERSONA).text
  assert.throws(() => gate.switchProfile('ghost'), /unknown profile/)
  assert.equal(sections.get(PERSONA).text, before)
  assert.equal(profile.getActiveProfileId(), 'ds4.1f')
})

// Real-host integration: drive the installed host's own SystemPrompt service.
// This is the contract that matters — if its disposer or per-assembly read
// differed, the module-level fake above would still pass. Skipped only when no
// global dsh install is observable on this machine.
const hostEntry = hostSessionEntry()
const hostModules = hostEntry === null ? null : dirname(dirname(dirname(hostEntry)))
const hostCordis = hostModules === null ? null : join(hostModules, 'cordis', 'lib', 'index.js')
const hostPrompt = hostModules === null ? null : join(hostModules, 'dsh-system-prompt', 'lib', 'index.js')
if (hostCordis !== null && hostPrompt !== null && existsSync(hostCordis) && existsSync(hostPrompt)) {
  const { Context } = await import(pathToFileURL(hostCordis).href)
  const { SystemPrompt } = await import(pathToFileURL(hostPrompt).href)
  const rendered = async (context) => {
    const assembly = await context.systemPrompt.assemble({})
    return assembly.sections.map((section) => section.text).join('\n\n')
  }
  const liveCtx = new Context()
  liveCtx.plugin(SystemPrompt, { includeHarnessIdentity: false, includeRuntimeContext: false })
  await new Promise((resolve) => setTimeout(resolve, 20))

  await report.check('the real host registry renders core on the first assembly', async () => {
    gate.installPersona(liveCtx)
    const text = await rendered(liveCtx)
    assert.ok(text.includes('SAFETY REVIEW — COMPLETED'), 'the core persona body must be present')
    assert.ok(!text.includes('MODE OVERLAY — STEALTH'))
  })

  await report.check('a hot switch is visible to the next real assembly', async () => {
    const before = await rendered(liveCtx)
    gate.switchProfile('stealth')
    const after = await rendered(liveCtx)
    assert.ok(after.includes('MODE OVERLAY — STEALTH'), 'the next assembly must carry the stealth overlay')
    assert.ok(!after.includes('MODE OVERLAY — REDTEAM MAX'))
    assert.ok(after.length > before.length, 'the overlay is appended, never a replacement')
  })

  await report.check('a second switch replaces the first overlay in the real registry', async () => {
    gate.switchProfile('redteam-max')
    const text = await rendered(liveCtx)
    assert.ok(text.includes('MODE OVERLAY — REDTEAM MAX'))
    assert.ok(!text.includes('MODE OVERLAY — STEALTH'), 'the previous overlay must be gone')
  })
} else {
  console.log('  SKIP real-host assembly (no observable global dsh install)')
}

await report.check('a stale persisted id falls back to the sealed default', () => {
  mkdirSync(dirname(statePath), { recursive: true })
  writeFileSync(statePath, JSON.stringify({ activeId: 'ghost' }), 'utf8')
  assert.equal(profile.getActiveProfileId(), 'ds4.1f')
})

rmSync(home, { recursive: true, force: true })
report.finish()
