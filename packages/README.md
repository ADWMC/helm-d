# packages 说明

每个 `packages/<name>` 是一个 dsh bundle：

- `package.json` — `dsh.bundle.patch` 指向 `cordis.patch.yml`
- `cordis.patch.yml` — 挂载插件行
- `src/index.ts` — 插件入口（`apply(ctx)`）
- `references/` — 参考文档（按需读，不注入 prompt）
- `scripts/` — 工具脚本

## 依赖解析

`@deepseek-ai/cordis` / `@deepseek-ai/dsh-tools` 等 `@deepseek-ai/*` 依赖由 dsh 宿主安装时解析（bare specifier 会送到宿主 base），不发布到公共 npm。本仓库骨架不包含这些依赖的实现，需在 dsh 宿主环境里 `dsh plugin add` 安装后构建。

## 骨架状态

- `router`、`skill-android`：有可参照实现。
- `skill-web` / `skill-native` / `skill-protocol` / `skill-malware` / `skill-ai-security` / `skill-evidence`：占位，待实现。
