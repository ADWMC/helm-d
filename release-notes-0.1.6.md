# helmd v0.1.6

Single-bundle security analysis plugin for DSH. This release makes every install method — including the plugin store — able to reach the FULL configuration (persona + preset), and unifies preset authoring to a single source.

## Full preset now ships inside the bundle

- `presets/{preset.yml,agent.cordis.yml}` are packaged in the tarball: the authoritative 320-line preset (luna persona, activation word `helmd`, complete tool roster incl. subagents/workflow/ralph, compaction stack).
- New `scripts/setup-preset.ps1` / `.sh`: one command after ANY install method (store, URL, local tarball) writes the preset into `~/.dsh/.agent-presets/helmd/` with `.bak` backups.
- Store installs previously delivered tools only; the README "install from the plugin store" section now documents the one-liner to complete the setup.

## Installer consistency fix

- `install.ps1` / `install.sh` no longer carry their own condensed inline heredoc preset (which silently differed from the full version — fresh installs got fewer tool sections than the maintained preset). They now copy the shipped `presets/` files from the installed bundle: single source of truth.

## Install

```bash
dsh plugin --profile web add https://github.com/ADWMC/helm-d/releases/latest/download/helmd.tgz
# then:
node_modules/@dsh-security/helmd/scripts/setup-preset.sh   # (or .ps1 on Windows)
```

---

单包安全分析插件。本版本让商店安装也能一键补全完整配置（persona + preset），并统一了 preset 的唯一来源。

- 包内自带权威完整版 preset（320 行：luna 人格、激活词、全套工具配置）
- 新增 `setup-preset` 脚本：任何安装方式后一条命令写入 preset（自动留 .bak）
- installer 不再内置缩水版 heredoc，改为从包内拷贝 —— 消除多源漂移
