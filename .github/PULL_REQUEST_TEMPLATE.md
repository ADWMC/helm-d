## What changed

<!-- One or two sentences. Link the issue if there is one. -->

## Verification

Commands actually run (paste the result line, not just the command):

```bash
pnpm build
pnpm typecheck
pnpm test:checks
```

- [ ] `pnpm build` passed
- [ ] `pnpm typecheck` passed
- [ ] `pnpm test:checks` passed (or the skipped checks are named below)
- [ ] If packaging changed: `node scripts/verify-pack.mjs --require-sealed` passed
- [ ] If runtime behavior changed: one real cold-start / core-path check was run

Not verified (be explicit):

<!-- e.g. "No dsh host installed locally; preset-heal/bootstrap checks skipped." -->

## Docs & rules

- [ ] README / README.en counts and links are in sync
- [ ] MAINTENANCE / docs/development updated for command or packaging changes
- [ ] CHANGELOG updated for user-visible changes
- [ ] No generated file was hand-edited (`preset.generated.patch.yml`, `dist/`, `.real/`, `*.dat`)
- [ ] No `cookie.txt`, `helmd-cases/`, `_refs/`, `dist-tgz/`, credentials, or private paths included

## Risk

<!-- What can break, who is affected, and how to roll back. -->
