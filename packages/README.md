# packages 说明

每个 `packages/<name>` 是一个 dsh bundle：

- `package.json` — `dsh.bundle.patch` 指向 `cordis.patch.yml`
- `cordis.patch.yml` — 挂载插件行
- `src/index.ts` — 插件入口（`apply(ctx)`）
- `references/` — 参考文档（按需读，不注入 prompt）
- `scripts/` — 工具脚本

## 依赖解析

`@deepseek-ai/cordis` / `@deepseek-ai/dsh-tools` 等 `@deepseek-ai/*` 依赖由 dsh 宿主安装时解析（bare specifier 会送到宿主 base），不发布到公共 npm。本仓库骨架不包含这些依赖的实现，需在 dsh 宿主环境里 `dsh plugin add` 安装后构建。

## 本地打包与安装

这里的每个子包都是 **bundle**，不是 profile。bundle 通过 `dsh.bundle.patch` 声明自己贡献的 host patch；profile 由 dsh 在 `$DSH_HOME/profiles/<name>` 下维护。`helm-d` 的安全工具是例外：包作为依赖安装，全局 patch 只挂**裸包名** `helm-d`（导出指向 `dist/health.js`，只注册设置命名空间，不暴露工具），工具主入口是子路径 `@adwmc/helm-d/agent`（`dist/index.js`），由 helmd Agent preset 挂载。裸包名是硬要求：宿主 `client-modules` 只从"行名恰为 `@scope/name`"的 Loader 行发现 `dsh.client`，深路径行会让设置卡片永远不进模块图。

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
