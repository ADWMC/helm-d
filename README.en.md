<div align="center">

# helmd

**Armor-piercing all-in-one security-analysis plugin for DeepSeek Harness**

Mount one preset · Android · Web · Native · Protocol · Malware · AI-Security ready on day one

English | [中文](README.md)

[![Telegram](https://img.shields.io/badge/Telegram-@helm_xD-26A5E4?style=flat&logo=telegram)](https://t.me/helm_xD)
[![topic: dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-2ea44f)](https://github.com/topics/dsh-plugin)
[![topic: deepseek-harness](https://img.shields.io/badge/topic-deepseek--harness-2ea44f)](https://github.com/topics/deepseek-harness)
[![Node >=22.19](https://img.shields.io/badge/Node-%3E%3D22.19.0-green)](https://nodejs.org)
[![pnpm 11.7.0](https://img.shields.io/badge/pnpm-11.7.0-orange)](https://pnpm.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

> For learning and research only. You must comply with local laws and regulations; you are responsible for the consequences of using this project.

> Maintainer docs: release checklist, preset single-source sync, and the pitfalls table live in [MAINTENANCE.md](MAINTENANCE.md).

## Why helmd

<table>
<tr>
<td width="50%">

### Armor-piercing, all-in-one

Android · Web · Native · Protocol · Malware · AI-Security converge in a single preset. Install once and every domain's tools are ready — no per-domain wiring.

</td>
<td width="50%">

### One bundle · zero wiring

Everything converges into a single `@dsh-security/helmd` bundle: bootstrap, router, seven domain tool modules and the toolbox. `install.ps1` / `install.sh` fetch a prebuilt tarball from Releases and wire everything in one command.

</td>
</tr>
<tr>
<td width="50%">

### Knowledge on demand

Domain knowledge, rules, workflows and cases live in `references/` (209 docs) and are read on demand — never injected into the system prompt to decide for the model. Lean tokens, intact judgment.

</td>
<td width="50%">

### First-turn tool anchoring

The first top-level request only exposes shell + `read`; the full catalog of 31 tools opens after promotion. A text-only first reply can't trap the session — request two always sees the full catalog.

</td>
</tr>
</table>

## Why

DSH security-analysis capability used to be scattered across domain bundles: `add` Android, `add` Web, `add` Native — and you still had to wire up the preset and router yourself.

helmd packs seven domains + evidence tooling + first-turn bootstrap + toolbox into one bundle:

`one preset` &ensp; `one bundle` &ensp; `31 tools` &ensp; `zero manual wiring`

Install once, send `helmd` in a session, and every domain's tools are ready.

## Architecture

```mermaid
flowchart LR
    Q["Question"] --> SP["system-prompt/assemble"]
    SP --> BS["bootstrap first-turn narrowing<br/>shell + read"]
    BS --> P{"promoted?"}
    P -->|no| BS
    P -->|yes| ROUTER["router domain routing"]
    ROUTER --> ANDROID["Android"]
    ROUTER --> WEB["Web"]
    ROUTER --> NATIVE["Native"]
    ROUTER --> PROTO["Protocol"]
    ROUTER --> MAL["Malware"]
    ROUTER --> AI["AI-Security"]
    ROUTER --> EVID["Evidence"]
    ANDROID & WEB & NATIVE & PROTO & MAL & AI & EVID --> REF["read_reference reads references/ on demand"]
    REF --> OUT["model's own judgment + confidence-scored conclusion"]

    style BS fill:#eff6ff,stroke:#3b82f6,stroke-width:2px,color:#1e40af
    style ROUTER fill:#f0fdf4,stroke:#16a34a,stroke-width:2px,color:#15803d
    style REF fill:#fffbeb,stroke:#f59e0b,stroke-width:2px,color:#92400e
    style OUT fill:#15803d,color:#fff,stroke:#166534,stroke-width:2px
```

- **First-turn narrowing**: the first top-level request only exposes shell + `read`; the full catalog opens after promotion
- **Domain routing**: `router` routes problems via `skill_catalog` / `read_reference`
- **On-demand references**: `references/` is a knowledge base, not an injection; the model reads and decides

## Runtime rules

A helmd session follows these fixed rules:

### Activation & session

| Rule | Behavior |
|------|----------|
| Activation word | The bundled persona defines an activation word (default `helmd`); exact matches get the activation reply, everything else is a task |
| First-turn anchoring | Only shell + `read` on the first top-level request; after the first tool call or assistant message the session promotes and every tool opens |
| Subagent exemption | Sessions with delegationDepth > 0 always see the full catalog |
| Analysis ladder | Ponytail-style: `analysis_mode` sets lite (quick triage) / full (standard flow, default) / deep (full evidence chain); per-session persistence, pick the shallowest rung that answers the task |
| Deterministic routing | `route_task(hint)` keyword-matches a PRIMARY route plus a one-line rationale (route before you act); falls back to the decision tree || Case workspace | `begin_case` creates an on-disk workspace (sample/evidence/scripts/CASE.md); tool outputs auto-persist to the evidence chain; `record_finding` enforces E-id citations; after compaction `case_status()` restores state from disk |

### Knowledge & routing

| Rule | Behavior |
|------|----------|
| Knowledge on demand | All 209 reference docs live in `references/`, read via `read_reference`, never injected into the system prompt |
| Catalog = metadata | `skill_catalog` only routes domains/signals and draws no conclusions: `tree` triage, `methodology`, `patterns`, `install` tool setup, `jvm` JVM decryption, etc. |
| References ≠ hard rules | Docs inform the model's judgment; they are never binding constraints |

### Tools & scripts

| Rule | Behavior |
|------|----------|
| Call chain | request → `defineTool.execute()` → `runSeam()` → subprocess (ctx.subprocess preferred, execFile fallback) |
| Python resolution | `resolveCommand()` probes python → py → python3 in order; Windows-compatible via the py launcher |
| Path safety | Every file read/write passes `assertWithinRoot()`; out-of-scope paths are rejected outright |
| External tool acquisition | Probe locally first (`where` / `--version`) → otherwise install into the largest non-C drive at `X:\Reverse\` → download through a proxy → record versions; see `references/toolbox/tool-install.md` |
| Releases first | Tools with GitHub Releases always get prebuilt binaries, never built from source |

### Evidence

| Rule | Behavior |
|------|----------|
| Report template | Conclusions carry severity / confidence grades; template in `references/evidence/reporting.md` |
| Case workspaces | `begin_case` creates an on-disk workspace; the persist hook auto-saves tool output into `evidence/`; conclusions must cite E ids (validated by `record_finding`) |

## Quick start

**Prerequisites**: a working [`dsh`](https://github.com/deepseek-ai/deepseek-harness) CLI and pnpm.

Windows (double-click `install.bat`, or run via PowerShell):

```powershell
.\install.ps1
```

macOS / Linux:

```bash
./install.sh
```

The installer downloads the latest Release `helmd.tgz`, installs it into the profile, and writes the preset. **The preset's platform rows are not snapshot-copied — the installer derives them live on your machine from the dsh host `standard` preset you actually have installed** (`gen-preset.mjs --out`), falling back to the bundled snapshot only when the generator is unavailable. Platform rows therefore always match your own dsh version and never drift on host upgrades. Then boot:

```bash
dsh web
```

Send `helmd` in a session to activate.

## Preset / host sync (three-layer fingerprint defense)

Every generated `agent.cordis.yml` opens with a host fingerprint line:

```yaml
# gen-preset: host=<sha256 of installed dsh standard>
```

A hand-copied preset once drifted after a host upgrade and assembled a crippled 44-tool catalog (incident 2026-08-26, see `docs/incident-2026-08-26-preset-stale-generation.md`). The same verdict now guards three surfaces:

| Layer | Entry | Behavior |
|------|------|------|
| CLI | `node packages/helmd/scripts/gen-preset.mjs --check` | fingerprint moved → `HOST UPGRADED`; content drift → `STALE (content drift)`; non-zero exit |
| Install/update | `install.ps1` / `setup-preset.ps1` | generates against the local host at install time, no manual copying |
| GUI | the helmd card in the dsh settings page (below) | evaluated once per boot, badge always visible |

## Health status card

Since 0.2.1, helmd ships a read-only health card in the **dsh web settings page**: Settings → Plugins → Plugin configuration → "helmd 安全分析包".

Each dsh boot evaluates the deployed `~/.dsh/.agent-presets/helmd/agent.cordis.yml` fingerprint against the installed host:

| Badge | Meaning | Action |
|------|------|------|
| 🟢 Healthy | preset matches the host | none |
| 🟠 Host upgraded | dsh was upgraded, platform rows stale | re-run install / setup-preset, restart |
| 🔴 Content drift | agent.cordis.yml hand-edited or persona changed without re-sync | regenerate as above |
| 🟣 Legacy preset | file lacks the fingerprint header | regenerate |
| ⚪ Not deployed | preset missing | run install |

Expanding the card shows both fingerprints (12 chars), version, evaluation time, and both paths for fast diagnosis.

## Install from the plugin store

helmd has been submitted to [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) ([PR #2708](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/2708)). Once merged it is one click away on [dshmarket.com](https://dshmarket.com) or in the dshmarket plugin UI; the CLI equivalents are:

```bash
# Prebuilt tarball (skips build approval)
dsh plugin --profile web add https://github.com/ADWMC/helm-d/releases/latest/download/helmd.tgz

# Or from source
dsh plugin --profile web add github:ADWMC/helm-d/tree/main/packages/helmd
```

**A store install delivers the bundle only (tools + bootstrap + router). The full experience also needs the agent preset (luna persona, activation word, tool configuration) — the template ships inside the package, so run one command after installing:**

```bash
# Windows (PowerShell)
%USERPROFILE%\.dsh\profiles\web\node_modules\@dsh-security\helmd\scripts\setup-preset.ps1

# macOS / Linux
~/.dsh/profiles/web/node_modules/@dsh-security/helmd/scripts/setup-preset.sh
```

The script writes `preset.yml` + `agent.cordis.yml` into `~/.dsh/.agent-presets/helmd/` (existing files are kept as `.bak`); pick the `helmd` preset in the UI when starting a session.

## Verification

```bash
dsh --profile web --dump-config                        # one @dsh-security/helmd row
node packages/helmd/scripts/gen-preset.mjs --check     # preset check OK (non-zero: follow the fingerprint hint)
```

After sending `helmd` in a session:

```text
skill_catalog        → returns domain/signal routes (incl. jvm, install and newer routes)
native_reference     → reads the Native reference
detect_packer <file> → identifies the PE/ELF protector
```

Settings → Plugins → Plugin configuration should show the helmd card with a green "健康 Healthy" badge. Any of the above returning normally means the install succeeded.

## Package & tools

| Package | Injects | Responsibility | Tools |
| --- | --- | --- | --- |
| `@dsh-security/helmd` | tools + systemPrompt | All-domain security analysis in one bundle | see below |

| Domain | Tool | Purpose |
| --- | --- | --- |
| **Router** | `skill_catalog` | Domain routing catalog |
| **Router** | `read_reference` | Read routed reference docs |
| **Android** | `apk_fingerprint` | APK framework/HTTP/obfuscation detection |
| **Web** | `web_reference` | Web security reference docs |
| **Web** | `bot_analyze` | Puppeteer Bot analysis |
| **Native** | `native_reference` | Native/binary reference docs |
| **Native** | `detect_packer` | PE/ELF packer detection |
| **Native** | `scan_strings` | ASCII/UTF-16LE string extraction |
| **Native** | `xor_bruteforce` | Single-byte XOR brute force |
| **Native** | `encoding_detect` | Base64/Hex/ROT13/XOR decode |
| **Protocol** | `protocol_reference` | Protocol/traffic reference docs |
| **Protocol** | `pcap_parse` | PCAP TCP/UDP stream extraction |
| **Protocol** | `state_machine` | Protocol state-machine inference |
| **Protocol** | `parse_har` | HAR request/response parsing |
| **Malware** | `malware_reference` | Malware sample reference docs |
| **Malware** | `ioc_extract` | IOC extraction |
| **Malware** | `yara_gen` | YARA rule generation |
| **AI-Security** | `ai_reference` | AI/LLM security reference docs |
| **AI-Security** | `llm_sim` | LLM app simulation testing |
| **Evidence** | `evidence_reference` | Evidence/reporting reference docs |
| **Case** | `begin_case` / `case_status` / `record_finding` / `end_case` | On-disk case lifecycle: open/resume/validated conclusions/close (deep mode requires findings) |
| **Case** | `find_tool` | Search GitHub for existing tools (variant queries + helmd-tools shelf hits) |
| **Case** | `save_evidence` | Persist arbitrary external CLI output into the evidence chain (E-numbered) |
| **Evidence** | `triage_artifact` | Offline triage |
| **Evidence** | `hash_artifact` | SHA-256 hashing |
| **Toolbox** | `tool_recommend` | Tool library recommendations |
| **Router** | `route_task` | Deterministic routing: task hint → PRIMARY route + rationale |
| **Session** | `analysis_mode` | Analysis intensity ladder lite/full/deep (Ponytail-style) |

Each `*_reference` tool reads its own `references/<domain>/` on demand; the entry point is its `index.md`.

## Alternatives

| Approach | Why not |
|----------|---------|
| Ten standalone bundles | 10 adds + manual preset + router wiring; seam.ts copied 9 times |
| Raw shell tools only | no domain knowledge; the model guesses; unreproducible conclusions |
| Stuff knowledge into the system prompt | token blow-up and it overrides the model's judgment |
| helmd single bundle | one install aggregates everything, shared seam, knowledge read on demand |

## Common commands

```bash
pnpm install                # install deps (prepare auto-runs tsc)
pnpm build                  # build every workspace package (only helmd ships)
pnpm typecheck              # tsc --noEmit type gate on a clean tree
```

Local tarball delivery:

```powershell
.\scripts\repack.ps1                                    # emit dist-tgz\helmd.tgz (+ stable alias)
dsh plugin --profile web add .\dist-tgz\helmd.tgz       # install into the web profile
```

Self-update (compares against the latest GitHub Release; downloads and reinstalls when newer, refuses to downgrade a local build):

```powershell
.\scripts\update.ps1                # check and update the web profile
.\scripts\update.ps1 -CheckOnly     # versions only, change nothing
.\scripts\update.ps1 -Force         # reinstall even when versions match

./scripts/update.sh                 # macOS / Linux
```

## Deployment

One-command install is above under Quick start; the manual steps are below. Prerequisites: the `@dsh-security/helmd` package published (see Publishing).

### 1. Install the bundle into a profile

```bash
dsh plugin --profile web add @dsh-security/helmd
```

`dsh plugin` forwards to pnpm inside the profile directory; the package lands in `$DSH_HOME/profiles/node_modules/`.

### 2. Mount the preset

Copy `presets/full-reverse/` into the DSH user preset root `$DSH_HOME/.agent-presets/helmd/`:

macOS / Linux:

```bash
mkdir -p ~/.dsh/.agent-presets/helmd
cp presets/full-reverse/agent.cordis.yml ~/.dsh/.agent-presets/helmd/
cp presets/full-reverse/preset.yml ~/.dsh/.agent-presets/helmd/
```

Windows (PowerShell):

```powershell
$p = Join-Path $env:USERPROFILE '.dsh\.agent-presets\helmd'
New-Item -ItemType Directory -Force $p | Out-Null
Copy-Item presets\full-reverse\agent.cordis.yml $p
Copy-Item presets\full-reverse\preset.yml $p
```

### 3. Set it as the default preset

Pick `helmd` in the UI preset picker, or edit `$DSH_HOME/settings.yaml`:

```yaml
agent-presets:
  default: helmd
```

### 4. Boot and activate

```bash
dsh web
```

Send `helmd` in a session to activate. `DSH_HOME` defaults to `~/.dsh`; substitute the path if you customized it.

## Directory layout

```text
helmd/
├── packages/
│   └── helmd/                 the shipped package (single bundle)
│       ├── src/
│       │   ├── bootstrap.ts   first-turn tool-narrowing filter
│       │   ├── router.ts      skill_catalog / read_reference routing
│       │   ├── health.ts      settings-page health face (boot-time fingerprint eval → settings namespace)
│       │   ├── seam.ts        shared IO seam (fs / subprocess / cmd resolve / path guard)
│       │   └── tools/         9 tool modules (31 tools)
│       ├── client.js          browser half: settings-page health card (lazy-CJS factory, no build chain)
│       ├── references/        209 on-demand reference docs (8 domains + toolbox)
│       ├── scripts/           analysis scripts + gen-preset.mjs (install-time preset generator)
│       ├── presets/           persona single source + generated mirror
│       └── cordis.patch.yml   bundle mount manifest (helmd tools row + helmd-health row)
├── presets/full-reverse/      preset definition (generated; persona + every tool row)
├── install.ps1/.sh/.bat       one-command installer
└── docs/                      design docs & postmortems
```

> Other directories under `packages/` are legacy split bundles superseded by the helmd single bundle; kept for archival only, no longer published.

## Build

Requires pnpm; build targets ES2022 / NodeNext.

```bash
pnpm install
pnpm build
```

The root `pnpm build` builds `@dsh-security/helmd`; `pnpm typecheck` runs the `tsc --noEmit` type gate on a clean tree.

## Dependencies

- `@deepseek-ai/cordis` `^4.0.1`
- `@deepseek-ai/dsh-tools` `>=0.1.0-rc.1 <0.1.0 || >=0.1.0-rc.1 <0.2.0-0` (explicit prerelease branch so rc builds are never silently excluded)

Versions are pinned via `overrides` in `pnpm-workspace.yaml`.

## Publishing

- The root package is `private: true` and is not published; `@dsh-security/helmd` is.
- The `files` whitelist: `dist`, `client.js`, `references`, `scripts`, `presets`, `cordis.patch.yml`.
- The `prepare` script runs `tsc` automatically before publishing.
- Current version: `0.2.1`.
- Release assets: `dsh-security-helmd-<ver>.tgz` plus the stable alias `helmd.tgz` (used by the store's tarball field and the installers).

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| DSH host upgrade breaks compat | peer deps on cordis / dsh-tools, pinned via `overrides`; three-layer preset fingerprint defense above exposes drift automatically |
| Missing `python` on the host | seam auto-probes python / py / python3, falls back to the `py` launcher |
| Bundle/preset version drift | version 0.2.1, tarball and release published together |
| Reference knowledge goes stale | read on demand, model's own judgment, non-binding |

## Acknowledgements

This project integrates design ideas and implementation patterns from many excellent open-source projects, drawing on the experience of many community pioneers. Any resemblance is a tribute to great design.

- [ADWMC/helm-x](https://github.com/ADWMC/helm-x) — prompt injection and scoring design
- [yynxxxxx/Codex-X](https://github.com/yynxxxxx/Codex-X) — prompt templates and visual management

## Case study

**BoosterX v2.2.4.3 (.NET) license bypass** — a full end-to-end validation of the helmd methodology:

- Live recovery of all **32,316 method bodies** and decryption of **7,726 encrypted constants** under ConfuserEx dynamic anti-tamper
- Runtime extraction of the RSA-2048 public key; online signed-token model identified, offline forgery ruled out
- Three static-rebuild dead ends documented with root causes, then a persistent unlock via the **zero-modification, zero-injection** official managed extension mechanism — verified by UIAutomation and in-process readback
- Full evidence chain, difficulty assessment, and server-side hardening recommendations included

📄 Full write-up: [docs/case-studies/boosterx-dotnet-license-bypass.md](docs/case-studies/boosterx-dotnet-license-bypass.md)

## Docs

- [docs/principles.md](docs/principles.md) — design principles
- [docs/architecture.md](docs/architecture.md) — architecture
- [docs/architecture-v2.md](docs/architecture-v2.md) — architecture v2 (persona + tool anchoring + on-demand knowledge)
- [docs/case-studies/](docs/case-studies/boosterx-dotnet-license-bypass.md) — case studies

## Contributing

Issues and PRs are welcome. Before making changes, read [docs/principles.md](docs/principles.md) and keep the architecture constraint: reference knowledge is read on demand and never overrides the model's own judgment.

## License

Released under the [MIT License](LICENSE) — free to use, modify, and distribute. See [LICENSE](LICENSE).

## AI-generated & legal risk

Some or all code in this repository was generated with AI assistance and may contain errors or be unsuitable for your context. Review it yourself and judge whether it fits your use case and jurisdiction before use; you are responsible for complying with local laws and for the consequences of using this project. Provided "AS IS" under MIT, without warranty of any kind.
