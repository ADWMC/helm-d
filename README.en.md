# helmd

English | [中文](README.md)

A DeepSeek Harness (DSH) security-analysis plugin suite. A pnpm monorepo of 9 `@dsh-security/*` bundles that provide multi-domain security-analysis tools and on-demand reference knowledge, plus 1 mountable agent preset.

> For learning and research only. You must comply with local laws and regulations; you are responsible for the consequences of using this project.

## What is this

helmd is a security-analysis plugin suite for DeepSeek Harness (DSH). It splits security-analysis capability into 9 independently publishable, on-demand-loadable bundles, mounted onto a DSH agent through a cordis preset.

Core capabilities:

- **Prompt injection**: a persona (`complete: true`) as the single system prompt; send the activation word `helmd` to enter execution mode
- **Domain routing**: `router` exposes `skill_catalog` / `read_reference` to route problems to the right domain
- **Seven domains + bootstrap**: Android / Web / Native / Protocol / Malware / AI security / Evidence, plus first-turn tool bootstrap
- **Reference, not interference**: domain knowledge, rules, workflows and cases all live in `references/` and are read on demand — never injected into the system prompt to make decisions for the model
- **First-turn tool anchoring**: the first top-level request only exposes a shell + `read`; the full catalog opens after promotion

## Activation

In a DSH session, send:

```
helmd
```

to activate.

## Architecture

```text
User question
  -> system-prompt/assemble
  -> bootstrap first-turn narrowing (shell + read)
  -> session promotion
  -> router + domain bundle tools
  -> read_reference reads references/ on demand
  -> model's own judgment + confidence-scored conclusion
```

## Packages

| Package | Injects | Responsibility | Tools |
| --- | --- | --- | --- |
| `@dsh-security/bootstrap` | systemPrompt | First-turn tool-catalog narrowing, full catalog after promotion | none |
| `@dsh-security/router` | tools | Domain routing and catalog | `skill_catalog`, `read_reference` |
| `@dsh-security/skill-android` | tools | Android reversing | `apk_fingerprint` |
| `@dsh-security/skill-web` | tools | Web security | `web_reference`, `bot_analyze` |
| `@dsh-security/skill-native` | tools | Native / binary reversing | `native_reference`, `detect_packer`, `scan_strings`, `xor_bruteforce`, `encoding_detect` |
| `@dsh-security/skill-protocol` | tools | Protocol / traffic | `protocol_reference`, `pcap_parse`, `state_machine`, `parse_har` |
| `@dsh-security/skill-malware` | tools | Malware samples | `malware_reference`, `ioc_extract`, `yara_gen` |
| `@dsh-security/skill-ai-security` | tools | AI / LLM security | `ai_reference`, `llm_sim` |
| `@dsh-security/skill-evidence` | tools | Evidence / reporting / case | `evidence_reference`, `create_case`, `triage_artifact`, `hash_artifact` |

Each `*_reference` tool reads its own `references/` on demand; the entry point is its `index.md`.

## Usage

The single preset lives in `presets/full-reverse/` and mounts all 7 domain bundles:

- `preset.yml` — metadata (`name: helmd`)
- `agent.cordis.yml` — agent composition (persona + bootstrap + router + 7 domain bundles)

Reference this preset in a DSH profile to get the full capability.

## Directory layout

```text
helmd/
├── packages/
│   ├── bootstrap/            first-turn tool-narrowing filter
│   ├── router/               domain routing and catalog
│   ├── skill-ai-security/    AI / LLM security
│   ├── skill-android/        Android reversing
│   ├── skill-web/            Web security
│   ├── skill-native/         Native / binary reversing
│   ├── skill-protocol/       Protocol / traffic
│   ├── skill-malware/        Malware samples
│   └── skill-evidence/       Evidence / reporting / case
├── presets/
│   └── full-reverse/
└── docs/
```

## Build

Requires pnpm; build targets ES2022 / NodeNext.

```bash
pnpm install
pnpm -r build
```

The root `pnpm build` is equivalent to `pnpm -r build`, running `tsc` per package.

## Dependencies

- `@deepseek-ai/cordis` `4.0.1`
- `@deepseek-ai/dsh-tools` `0.1.0-rc.6`

Versions are pinned via `pnpm.overrides` in the root `package.json`.

## Publishing

- The root package is `private: true` and is not published; the 9 `@dsh-security/*` sub-packages are.
- Each sub-package's `files` whitelist is limited to `dist`, `references`, `scripts`, `cordis.patch.yml`.
- Each sub-package's `prepare` script runs `tsc` automatically before publishing.
- Current version: `0.1.0`.

## Acknowledgements

- [ADWMC/helm-x](https://github.com/ADWMC/helm-x) — prompt injection and scoring design
- [yynxxxxx/Codex-X](https://github.com/yynxxxxx/Codex-X) — prompt templates and visual management

## Docs

- [docs/principles.md](docs/principles.md) — design principles
- [docs/architecture.md](docs/architecture.md) — architecture
- [docs/architecture-v2.md](docs/architecture-v2.md) — architecture v2 (persona + tool anchoring + on-demand knowledge)

## Quick start

```bash
git clone https://github.com/ADWMC/helm-d.git
cd helm-d
pnpm install
pnpm -r build
```

Reference `presets/full-reverse/` in a DSH profile, then send `helmd` in a session to activate. See Usage above.

## Contributing

Issues and PRs are welcome. Before making changes, read [docs/principles.md](docs/principles.md) and keep the architecture constraint: reference knowledge is read on demand and never overrides the model's own judgment.

## License

Released under the [MIT License](LICENSE) — free to use, modify, and distribute. See [LICENSE](LICENSE).

## AI-generated & legal risk

Some or all code in this repository was generated with AI assistance and may contain errors or be unsuitable for your context. Review it yourself and judge whether it fits your use case and jurisdiction before use; you are responsible for complying with local laws and for the consequences of using this project. Provided "AS IS" under MIT, without warranty of any kind.
