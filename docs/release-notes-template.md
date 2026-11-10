# Release Notes 模板（helm-d）

> 用法：发版时复制下方模板填入内容，作为 `gh release create --notes-file` 的输入，发布后删除临时文件。
> 规范出处：`MAINTENANCE.md` §2、`CONTRIBUTING.md` §8、`docs/development.md` §5。
> 整改基线：2026-11-06 releases 格式审计（20 个 release / 20 个 tag 全量核对）。

## 硬性规则（违反即打回）

1. **tag 必须合法 SemVer**，等于 `v<package.json version>`。禁止 `v0.5.1fix` 式自造后缀；prerelease 用 `-alpha.N` / `-rc.N` 并加 `--prerelease` 标记，不靠"撤回"下架。
2. **title 统一 `helm-d vX.Y.Z — 主题`**：产品名 + `v` + 版本 + em dash（`—`）+ 一句话主题。禁止裸版本号（`0.4.0 — …`）、禁止漏 `v`（`helm-d 0.4.1`）、禁止旧产品名（`helmd v…`）。
3. **正文标题用单个 H1**（`# helm-d vX.Y.Z …`），章节用 H2；不要整篇 H2（v0.5.1fix / v0.5.1 / v0.5.0 / v0.4.0 的历史写法）。
4. **资产恰好 3 个 tgz**：`adwmc-helm-d-X.Y.Z.tgz` + `helm-d.tgz` + `helmd.tgz`，三者内容一致（sha256 相同，正文照实标注）。不上传 installer；v0.2.2–v0.4.1 的 installer 三件套是历史形态。
5. **发布后不得替换已上传 asset**。GitHub 允许同名单币覆盖，页面 `published_at` 不变、用户无法察觉——v0.5.1（+2 天）、v0.5.2（+2.7h）、v0.4.0（+1.7h）、v0.4.2（+21min）均属静默重传，只有 v0.5.1fix 在正文留了记录。确需修正：发新版本，或在正文顶部保留「覆盖重打」注记（日期 + 原因 + 「请重新下载」）。
6. **安装/升级命令一律版本化 URL**（`releases/download/vX.Y.Z/...`）。`releases/latest/download/*` 禁止出现在正文、README 与 profile 依赖（Issue #5：滚动资产导致 pnpm lockfile sha512 失配）。
7. **结论必须可核验**：检查结果写命令与数字（`pnpm test:checks` → `33 PASS`），不写「通过」「正常」；未跑的项写「未验证」并说明缺什么。
8. **正文与 CHANGELOG 同源**：从 `CHANGELOG.md` 对应版本段复制，可精简，不得引入 CHANGELOG 没有的结论；About 页「更新日志」直接消费本正文。

## 模板

````markdown
# helm-d vX.Y.Z — <一句话主题>

> 发布日期：YYYY-MM-DD · 许可：AGPL-3.0-or-later · Node >= 22.19 · DSH 0.2.x（本版在 <宿主版本> 验证）
>
> 完整逐条日志：[CHANGELOG.md](https://github.com/ADWMC/helm-d/blob/main/CHANGELOG.md)

<一两段概述：本版解决什么问题、用户可见变化、工具数 / 检查集 / references 数量变化。>

## 升级前必读

- <破坏性变更 / 迁移动作 / 已知不兼容；没有可整节删除>

## 新功能

### <主题分组>

- <变化 + 证据：文件名 / 工具名 / 命令 / 数字>

## 修复

- <bug + 根因 + 证据>

## 验证

| 门禁 | 结果 |
|---|---|
| `pnpm build` / `pnpm typecheck` | 通过 |
| `pnpm test:checks` | <N> PASS |
| `verify-pack --require-sealed` | PASS（<N> 个封印 payload 文件） |
| 隔离宿主冷启动 | <health OK / 未验证：缺宿主> |
| 真实模型 E2E | <证据链 ID / 未验证：缺端点> |

## 资产

三个 tgz 内容相同，sha256 均为：

```
<sha256>
```

- `adwmc-helm-d-X.Y.Z.tgz`
- `helm-d.tgz`
- `helmd.tgz`
````

## 发布后核验（三条都要绿）

```powershell
# tag 与版本一致、资产数 = 3
gh api repos/ADWMC/helm-d/releases/tags/vX.Y.Z -q '.tag_name, (.assets|length)'

# 资产未被覆盖重传：updated_at 应贴近 published_at（分钟级），不是几天后
gh api repos/ADWMC/helm-d/releases/tags/vX.Y.Z -q '.published_at, (.assets[].updated_at)'

# 版本化 URL 可达（勿用 latest/download 代替）
Invoke-WebRequest -Method Head "https://github.com/ADWMC/helm-d/releases/download/vX.Y.Z/helmd.tgz"  # 200
```

## 历史格式问题对照（为什么定这些规则）

> 2026-11-06 已对下表全部问题完成整改（title / 正文 H1 / URL 全量规范化）；保留本表作为规则出处。

| 问题 | 样本（均已核验） |
|---|---|
| title 漏产品名 / 漏 `v` / 旧名 / 裸版本 | `v0.5.2 — …`、`helm-d 0.4.1`、`0.4.0 — …`、`helmd v0.1.6` |
| 正文标题层级混用 H1/H2 | v0.5.1fix、v0.5.1、v0.5.0、v0.4.0 全篇 `##` |
| 非 SemVer tag | `v0.5.1fix`（应为 v0.5.2） |
| 静默替换已上传 asset | v0.5.1、v0.5.2、v0.4.0、v0.4.2 |
| 正文写 `latest/download` | v0.5.1fix、v0.5.2 |
| 资产超出 3 tgz / 挂错版本 | v0.2.2–v0.4.1 带 installer 三件套；v0.5.0 的 `helmd.tgz` 实为 0.5.1 旧字节（`744ea3f9…`），且挂着一份 0.5.1 资产 |
