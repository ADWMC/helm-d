# 贡献指南（Contributing）

> 面向本仓库的代码、文档、preset、references 与测试改动。
> 开发环境、架构与打包细节见 [docs/development.md](docs/development.md)；安全边界与漏洞报告见 [SECURITY.md](SECURITY.md)。

## 1. 先选对改动类型

- **Bug / 回归**：先写最小复现，说明环境（OS、Node、dsh 版本、插件版本）、实际结果、期望结果。
- **文档修正**：指出具体段落/命令与错误点；能给出验证命令的优先。
- **新能力 / 架构调整**：先开 issue 说明问题、边界与验证方式，再动代码；不要用一个大 PR 混入无关重构。
- **references / preset / persona**：说明影响哪个域、哪条路由、是否需要重新打包；不要手改生成物。

## 2. 环境与必跑检查

```bash
corepack enable
pnpm install
pnpm build
pnpm typecheck
pnpm test:checks
```

- `pnpm test:checks` 需要 `packages/helmd/dist/*.js`；刚 `repack` 后先 `pnpm build`。
- 没有安装 dsh 宿主时，依赖宿主的检查会 SKIP；CI 中属预期。
- 涉及打包时追加：

```bash
.\scripts\repack.ps1
node scripts/verify-pack.mjs --require-sealed
```

报告结果时写清"跑了什么、看到什么、还有什么没验证"。不要把未运行的检查写成 PASS。

## 3. 代码规则

- **最小改动**：只改完成任务所需的内容；不顺手重构无关代码、格式、命名、依赖。
- **单一事实源**：运行时 persona 在 `packages/helmd/presets/profiles/core.md`；`persona.txt` 只做 preset sanity；preset 平台行由 `gen-preset.mjs` 从宿主 standard 派生。
- **禁止手改生成物**：`preset.generated.patch.yml`、`dist/`、`.real/`、`payload.dat`、`references.dat`、`profiles.dat`。改源，然后重新生成。
- **路径安全**：所有由模型/用户参数拼出的文件路径必须经过 `assertWithinRoot()` 或等价围栏；新增 case 工具时尤其注意。
- **错误处理**：不要用空 `catch` 吞掉会影响结论的错误；可降级的地方返回原结果 + 明确警告，不把成功工具调用变成异常。
- **类型**：`strict` 已开；新增 `any` 要能解释为什么无法收窄。`tsconfig` 已启用 `noUnusedLocals` / `noUnusedParameters` / `noImplicitOverride` / `noFallthroughCasesInSwitch`。
- **注释**：只写代码本身看不出的约束、失败模式、外部契约；不要写"下一行做什么"或变更历史。
- **依赖**：优先标准库与已装依赖；新增依赖必须说明不可替代性，并更新 lockfile。

## 4. 测试规则

- 行为改动必须带一个能在错误实现上变红的检查；只断言"文件存在/命令成功"不算。
- 优先用 `node:test` 或现有 `scripts/checks/*.check.mjs`，不要为一个小改动引入新测试框架。
- 涉及 runtime hook（bootstrap / persist / stream / gate）的改动，至少覆盖：正常路径、失败路径、幂等/重复调用。
- 涉及打包/发布的改动，必须跑 `scripts/verify-pack.mjs`，并检查 tarball 不含明文 persona/references/scripts。
- 无法验证的边界（真实宿主、真实模型、真实代理）在 PR 里明确写 `未验证`，不要用 mock 结果替代。

## 5. 文档同步

同一个 PR 内同步：

| 改动 | 必须同步 |
|---|---|
| 工具增删/改名 | README 工具表、`tool-catalog` check、商店描述 |
| 版本号 | `packages/helmd/package.json`、README 徽章、CHANGELOG、tag |
| persona / preset | `profiles/core.md`、`persona.txt`（仅 sanity）、生成物、README 多破甲表 |
| 打包白名单 | `README.en.md` Publishing、`MAINTENANCE.md` §8、`verify-pack.mjs` |
| 开发命令 | `docs/development.md`、本文件、CI workflow |

## 6. AI 辅助贡献

- 允许使用 AI 辅助，但必须有一个**人类 owner** 对完整改动负责（代码、测试、文档、结论）。
- PR 描述里说明哪些部分由 AI 生成、哪些验证由人实际执行。
- 不得替人类勾选"已审查/已批准"声明；不得伪造命令输出、测试结果或时间戳。
- 变更涉及攻击性 references / persona 时，确认用途与分发边界符合仓库免责声明与所在地法律。

## 7. 提交与 PR

- 提交信息建议使用 Conventional Commits：`fix:`、`feat:`、`docs:`、`test:`、`chore:`、`release:`。
- 一个 PR 只做一件事；把"格式修正"和"行为修正"分开。
- PR 描述至少包含：问题、改动、验证命令与结果、未验证项、文档同步情况。
- 合入前确认 `git status` 干净、没有把 `cookie.txt` / `helmd-cases/` / `_refs/` / `dist-tgz/` 带进来。
- 提交即表示你同意以 `AGPL-3.0-or-later` 授权该贡献，并确认你有权披露其中的全部内容。

## 8. 发布（维护者）

发布 checklist 在 [MAINTENANCE.md](MAINTENANCE.md) §2 与 [docs/development.md](docs/development.md) §5；标题 / 正文格式与模板在 [docs/release-notes-template.md](docs/release-notes-template.md)。要点：

- 版本必须是合法 SemVer，tag 必须等于 `v${package.json.version}`；禁止 `v0.5.1fix` 式自造后缀，prerelease 用 `-alpha.N` / `-rc.N` 并标 `--prerelease`。
- release title 统一 `helm-d vX.Y.Z — 主题`，正文从 CHANGELOG 对应段复制（可精简，不得引入 CHANGELOG 没有的结论）。
- 发布资产当前是 3 个 tgz（版本化 tgz + `helm-d.tgz` + `helmd.tgz`，内容一致）；不要照旧文档上传不存在的 installer。
- **发布后不得替换已上传 asset**：GitHub 同名单币覆盖后页面 `published_at` 不变，用户无法察觉（v0.5.1 / v0.5.2 / v0.4.0 / v0.4.2 均有静默重传史）。确需修正就发新版本，或在正文顶部保留「覆盖重打」注记。
- 正文安装命令一律版本化 URL；`releases/latest/download/*` 禁止出现（Issue #5）。
- `@adwmc/helm-d` 的 `prepublishOnly` 会再次跑 `verify-pack --require-sealed`；未封印的 dev `dist/` 不能直接 publish。
- 发布后在隔离 profile 冷启动一次，确认 preset 行与一个核心工具可用。
