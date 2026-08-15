# packages 说明

每个 `packages/<name>` 是一个 dsh bundle：

- `package.json` — `dsh.bundle.patch` 指向 `cordis.patch.yml`
- `cordis.patch.yml` — 挂载插件行
- `src/index.ts` — 插件入口（`apply(ctx)`）
- `references/` — 参考文档（按需读，不注入 prompt）
- `scripts/` — 工具脚本
- `skills/` — 由 bundle 自己注册的内置 skill（仅 `skill-native` 当前使用）

## 依赖解析

`@deepseek-ai/cordis` / `@deepseek-ai/dsh-tools` 等 `@deepseek-ai/*` 依赖由 dsh 宿主安装时解析（bare specifier 会送到宿主 base），不发布到公共 npm。本仓库骨架不包含这些依赖的实现，需在 dsh 宿主环境里 `dsh plugin add` 安装后构建。

## 本地打包与安装

这里的每个子包都是 **bundle**，不是 profile。bundle 通过 `dsh.bundle.patch` 声明自己贡献的 patch；profile 由 dsh 在 `$DSH_HOME/profiles/<name>` 下维护，记录 bundle 的顺序和用户自己的 `cordis.patch.yml`。

`skill-native` 还在自身插件入口挂载一个隔离的 `dsh-skill-filesystem` provider（`helmd-skill-native-bundled`），其 `bundledSkillDir` 指向包内 `skills/`；因此内置 skill 不依赖项目或用户的 filesystem skill 根。

本地交付使用已构建的 tarball：

```powershell
pnpm install
pnpm -r build
.\scripts\repack.ps1
dsh plugin --profile web add .\dist-tgz\*.tgz
```

在 profile 中生效的层顺序是：bundle（按 `dsh.profile.bundles` 顺序）→ profile 的 `cordis.patch.yml` → `$DSH_HOME/cordis.patch.yml` → 命令行传入的 `--patch`。后应用的层按行覆盖前面的层，`config` 按整行替换而不是深度合并。

源码 checkout 不作为安装产物；需要从 Git 安装时，应为包提供自包含的 `prepare` 构建，并在目标 profile 的 `pnpm-workspace.yaml` 中显式允许该包的构建脚本。对本仓库优先使用上面的 tarball 流程，避免在用户机器上执行未锁定的源码构建。

## 当前状态

- `bootstrap`：首轮工具锚定（`system-prompt/assemble` 过滤）。
- `router`：`skill_catalog` / `read_reference` 路由工具。
- `skill-android` / `skill-web` / `skill-native` / `skill-protocol` / `skill-malware` / `skill-ai-security` / `skill-evidence`：领域 bundle。
