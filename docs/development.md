# 开发指南（helm-d）

> 面向在 `ADWMC/helm-d` 仓库内改代码、改 preset、打发布包的人。
> 贡献流程见 [CONTRIBUTING.md](../CONTRIBUTING.md)；安全边界见 [SECURITY.md](../SECURITY.md)；总方案见 [design/MASTER-PLAN-PRO-RE-PENTEST.md](design/MASTER-PLAN-PRO-RE-PENTEST.md)。

## 环境

| 项 | 要求 |
|---|---|
| Node | `>=22.19.0`（`.nvmrc` 钉 22.19.0） |
| pnpm | `11.7.0`（`package.json#packageManager`） |
| 宿主 | dsh 已安装才能跑全部 `test:checks` |

当前兼容样本覆盖 dsh `0.2.0-rc.1`–`0.2.2-rc.5` 及 `0.2.3-alpha.1/.2`；后两版的宿主依赖、preset 与 UI token 来自已发布 npm 包。alpha.2 的宿主要求 Node `^24.22.3 || >=26.13.1`（高于本项目的 Node 编译下限）；本机 Node 24.21.0 不能做 alpha.2 的真实宿主冷启动。开发依赖仍由 `pnpm-workspace.yaml` 固定在 0.2.1-rc.2，不代表真实宿主已经升级。v0.7.0 发布包的 preset 基线取自 0.2.2-rc.5 的固定 standard fixture，其他宿主安装时依赖指纹校验和自愈重新生成；不应从本机旧宿主标准生成并提交发布基线。

```bash
corepack enable
pnpm install
pnpm build
pnpm typecheck
pnpm test:checks
```

> `pnpm test:checks` 依赖 `packages/helmd/dist/*.js`。刚跑过 `repack.ps1` 时先 `pnpm build`。

## 单一事实源

| 数据 | 唯一编辑点 | 派生 |
|---|---|---|
| 运行时 persona | `presets/profiles/ds4.1f.md`（档位 overlay 以 `--- extends: ds4.1f ---` 头追加） | `build-profiles.mjs` → `profiles.dat` → `gate.ts`（`POST /api/helmd/profile` 热切换） |
| preset 层校验 | `presets/persona.txt` | `gen-preset.mjs` sanity check |
| preset 平台行 | 宿主 `standard.patch.yml` | `gen-preset.mjs` → `preset.generated.patch.yml` |
| 参考知识 | `references/` | `build-sealed.mjs` → `references.dat` |
| 参考索引 | `scripts/gen-references-index.mjs`（正文 + 分类规则 + 任务路由） | `references/index.md`、`references/<domain>/index.md`（禁止手改） |
| 工具清单 | `src/**` 的 `defineTool` | `tool-catalog.check.mjs` |
| 版本号 | `packages/helmd/package.json` | README 安装 URL（版本化）/ Release badge（动态）/ tag / CHANGELOG |

仅修改参考正文时可执行 `node packages/helmd/scripts/build-sealed.mjs --references-only`，只重建 `references.dat`，保留已有 `.real/` 和 `dist-tgz/`；完整发布仍用下方打包流程。

## 参考索引

首次请求可见 `route_task` / `read_reference`；逆向任务由 prompt assembly 提供有限首读预览。预览不计成功读取，`read_reference` 读完所有分页后才发放会话阅读回执，回执随会话持久化；`record_finding` 对当前路由指定文档和分析工具证据分别校验。`route-read:*` 账本按路由指定路径计数。主包打包 `references.dat`；独立 `skill-native` 是历史包，不参与当前 release。

网络调查的 Case `scope` 支持单主机、父域名与 IPv4/IPv6 CIDR；内置 `recon_*` 和 `run_poc` 不再注册。外部专业工具由宿主执行时，插件不自动约束其重定向或请求范围；操作者应在工具配置中限定范围，原始输出用 `save_evidence` 入链。旧 `src/tools/{native,web,recon,poc,...}.ts` 仍为仓库历史源码，不由主插件注册，也不进入主包；独立 `packages/skill-*` 已撤下自写专业分析入口，只保留资料读取（Android 包无注册工具）。历史脚本源码仍在仓库。本轮新版宿主适配只验证 peer、preset 和前端 token，真实新版宿主冷启动与模型行为未验证。

保护分流的历史纯函数仍在 `packages/helmd/src/protection-route.ts`，但 `protection_route` 已不注册。逆向决策读取 `native/protection-detection-methodology.md` 与 `native/packer-handling.md`，专业工具在外部执行；Case 中的 E-id 只证明已保存资料，不替代理解验证。

`references/index.md` 与 8 个领域索引是**生成物**，不要手改。新增/删除/重命名正文后：

```bash
pnpm gen:refs    # 重建总索引与领域索引
pnpm check:refs  # 只校验是否漂移（test:checks 也会跑）
```

生成器负责标题/摘要提取、领域子类归类、任务路由；未归类的文件会直接报错，避免静默漏项。`SUMMARY_OVERRIDES` 用于修正首段是导航/技术片段的文档。索引不写时间戳，保证 diff 可复现。

## 更新日志与版本同步

- 单一事实源：根目录 `CHANGELOG.md`。开发中的变更写 `[Unreleased]`，发布时改成 `[<version>] — YYYY-MM-DD`。
- 版本号只在 `packages/helmd/package.json` 改；About 页“检查更新”读取这个版本，与 GitHub Release tag（去掉 `v`）比较。
- README / README.en 的安装与更新命令必须用 `releases/download/v<version>/...`；每次发版同步这两个 URL。禁止把 `releases/latest/download/*` 写进 profile 依赖（Issue #5，pnpm lockfile 的 sha512 会失配）。About 页用当前版本动态拼 URL，不需要手改。
- 每次发布同步三处工具清单：
  - `MAINTENANCE.md` 的“当前计数基准：N 个工具”；
  - `README.md` / `README.en.md` 的工具数与工具表；
  - `scripts/checks/tool-catalog.check.mjs` 的必需工具名。
- GitHub Release 的正文从 `CHANGELOG.md` 当前版本段复制，格式遵循 `docs/release-notes-template.md`（title 统一 `helm-d vX.Y.Z — 主题`、正文单 H1、资产 3 tgz 照实标 sha256）；About 页“更新日志”优先显示 Release body 的 bullet（`/api/helmd/update` 返回 `releaseNotes`），拉不到时回退到内置摘要。
- **发布后不得替换已上传 asset**：GitHub 允许同名单币覆盖且页面 `published_at` 不变，用户无法察觉（v0.5.1 / v0.5.2 / v0.4.0 / v0.4.2 均有静默重传史）。确需修正就发新版本，或在正文顶部保留「覆盖重打」注记。
- 发布顺序：改 CHANGELOG → 改版本 → `pnpm build` / `typecheck` / `test:checks` → `repack.ps1` → `verify-pack --require-sealed` → tag + Release。

## 打包

```powershell
node scripts/gen-preset.mjs
.\scripts\repack.ps1
node scripts/verify-pack.mjs --require-sealed
```

tarball 12 文件（封印形态）；`payload.dat` 仅含两个入口的运行时依赖闭包与预设/安装脚本，旧领域工具和领域分析模块不进入 tarball 的明文 dist 或 payload，首次导入解压。release 资产 3 个 tgz。

## 发布门禁

1. `git status` 干净
2. `pnpm build` + `typecheck` + `test:checks`
3. `repack.ps1`
4. `verify-pack --require-sealed`
5. 隔离 profile 安装 + 冷启动
6. `git tag v<version>`；版本合法 SemVer（禁止 `fix` 后缀；prerelease 用 `-alpha.N` 并标 `--prerelease`）
7. Release 上传 3 tgz；title = `helm-d v<version> — 主题`，正文照 `docs/release-notes-template.md`
8. 发布后核验：`releases/tags/v<version>` 的 `assets[].updated_at` 贴近 `published_at`（未发生覆盖重传），版本化 URL HEAD 200

## 常见故障

| 症状 | 原因 | 处理 |
|---|---|---|
| `test:checks` ERR_MODULE_NOT_FOUND | 刚 repack，dist 只剩 stub | 先 `pnpm build` |
| preset-heal SKIP | 无 dsh 宿主 | 接受 SKIP |
| gen-preset HOST UPGRADED | 宿主 standard 指纹变 | 重新 gen-preset |
| star 面板卡 | 代理不可达 | 设 `HTTPS_PROXY` |
