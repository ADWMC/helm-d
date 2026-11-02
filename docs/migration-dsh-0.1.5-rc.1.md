# 迁移报告：helm-d → dsh 0.1.5-rc.1

> 日期：2026-09-11（本地时区 +08:00）
> 方法：`dsh-plugin-upgrade` skill 的 **Mode C（作者侧迁移）**——基线 → 版本走廊 →
> 七类触点 → 分组实施 → 六层验证 → 报告。源码与宿主事实全部一手核实，无记忆式改写。
> 状态：**代码与依赖已改完并验证；缺最后一步真机会话（见 §8）**。

## 1. 一句话结论

宿主 dsh 0.1.5-rc.1 的 `Session` 已无 `events` 成员（卡 `DSH-0.1.2-A4-03`），而 helm-d
的会话 hook 全都在读它、又被 `Array.isArray` 守卫吞掉——**bootstrap 永不晋升（每轮只放行
`[pwsh, read]`）、advisory 账本与 H-CoT 自动 hook 静默空转**。同一次核查还发现所有 peer
范围在 semver 语义下**根本不收宿主 cohort**。两项都已修，插件版本 `0.2.4 → 0.3.0`。

## 2. 基线与身份（改动前记录）

| 项 | 值 |
|---|---|
| 源码身份 | git 仓库 `helm-d`，迁移前 HEAD `8fea55b`，工作树干净 |
| 插件包 | `helm-d` 0.2.4（`file:dist-tgz/helmd.tgz` 装进 profile `web`） |
| 宿主 | `@deepseek-ai/dsh` **0.1.5-rc.1**（npm `latest`；`next`=0.1.5-rc.2，`alpha`=0.1.5-alpha.2） |
| 宿主内置 cohort | `@deepseek-ai/dsh-*` 全族 0.1.5-rc.1、cordis 4.0.2、schemastery 3.18.2 |
| 仓库原 cohort | overrides 钉 cordis 4.0.1 / dsh-tools 0.1.0-rc.6；lock 里 dsh-settings 0.1.1-rc.2、schemastery 3.18.1 |
| 工具链 | node v24.16.0、npm 11.16.0、pnpm 11.7.0（`packageManager` 声明） |
| 基线套件 | `pnpm typecheck` / `pnpm build` / `test-gen-preset` / `test-caseflow`(26/0) **全绿** ⇒ 豁免清单为空，后续失败可完全归因于本次迁移 |

## 3. 版本走廊（skill 判定）

- 卡覆盖 `dsh-v0.1.0-rc.8 → dsh-v0.1.3-alpha.2`（顺序表 0–9）。
- 只读规划器（`plan-migration.mjs`，`--root packages/helmd`）：
  - `dsh-v0.1.1-rc.2 → dsh-v0.1.3-alpha.2`：exit 0，命中触点 #2/#3/#4/#5/#6/#7，解出 48 张 applicable 卡；其中 **`DSH-0.1.2-A4-03`（`Session.events` removed）** 正是本次主修项。
  - `dsh-v0.1.3-alpha.2 → dsh-v0.1.5-rc.1`：**exit 2 = no card-set corridor**。该段是官方走廊缺口，按 skill 规则不发明迁移，改用宿主树一手核实，缺口内结论标注来源。
- 未自动写卡（研究活动 ≠ 用户插件改动）。

## 4. 七类触点核实（一手源 = 本机 0.1.5-rc.1 宿主）

| 触点 | helm-d 位置 | 宿主实测 | 结论 |
|---|---|---|---|
| #2 事件 | `bootstrap.ts` / `advisory-hook.ts` / `hcot-hook.ts` / `router.ts` 读 `session.events` | `Session.prototype` 无 `events`（成员仅 `eventAt/snapshotEvents/ownEvents/isOwnSeq/append/seq/surface/requestHeader/…`）；detached 实例 own props 无 `events`，`typeof s.events === 'undefined'` | **必修** |
| #2 事件 | `bootstrap.ts` 读 `session.header.delegationDepth` | `SessionHeader.delegationDepth?` 仍在，宿主自己的 `delegationDepthOf(agent)` 就读它 | 兼容（保留） |
| #3 服务 | `system-prompt/assemble` 的 `context.agent` | 运行时 `assembleContextFor()` 返回 `{agent, scope, signal?}`；但 `AssembleContext` 类型只声明 `scope/signal` | 运行时兼容、类型面有洞 → 用本地窄类型收口 |
| #3 服务 | `settings.register(ns, schema, {base})` | `register<Ns,T>(ns, schema: z<T>, options?)` | 兼容 |
| #3 服务 | `subprocess.spawn({argv,cwd,stdio,graceMs,env})` | `SubprocessSpawnSpec` 一致，`env` 合并进 scrubbed parent base | 兼容 |
| #5 工具 | `defineTool` + `ctx.tools.register(definition)` | 二者仍在；`ToolRuntime.inject = ["systemPrompt"]`（不需要 `sessionProjections`） | 兼容 |
| #5/#6 客户端 | `__ModuleLoader__.load({id,factory})`、`settingsScope.bind().getSnapshot()/subscribe()`、`slots settings.plugin.item` | 宿主同形 | 兼容 |
| #4 宿主文件 | 部署位 preset、`~/.dsh/helmd-tools/` | 路径存在 | 兼容（自动修复的安全面见评审 F1） |
| #7 子进程 | `runSeam` stdout/stderr | 兼容 | 兼容 |
| 打包 | peer 范围与 overrides | **semver 实证**：`0.1.5-rc.1 ∉ >=0.1.0-rc.1 <0.2.0-0`、`∉ ^0.1.1-rc.2`（预发布必须在范围里点名同一 major.minor.patch）；host cohort 包自身 peer 要求 cordis ^4.0.2 / schemastery ^3.18.2 / dsh-* ^0.1.5-rc.1 | **必修** |

## 5. 改动（按提交）

| 提交 | 内容 |
|---|---|
| `16e8f72` | 新增 `src/session-log.ts`（唯一读会话日志 + 抽取文本/工具调用；保留旧宿主 `events` 回退，读不到时一次性告警）与 `src/prompt-assembly.ts`（唯一负责 assemble 注册与 before/after 顺序）；四个消费点改为消费 seam，删掉重复实现；新增 `scripts/checks/` 三份 host-seam 检查 |
| `50803bc` | peer/dev 改宿主 cohort（`dsh-tools`/`dsh-settings` `>=0.1.5-rc.1 <0.2.0-0`、cordis ^4.0.2、schemastery ^3.18.2）；`pnpm-workspace.yaml` overrides 钉 `@deepseek-ai/dsh-*` 全族 + cordis + schemastery（否则 dsh-tools 的自动安装 peer 跨 cohort）；插件 0.2.4 → **0.3.0**；README/MAINTENANCE 同步 |
| `078b513` | MAINTENANCE preset 归属规则改为与实现一致（helmd 行现由 preset 末行声明，host 面 bundle 只挂 health） |
| `0a4eec6` | H-CoT 拒绝正则收窄 + 去掉裸 `劫持` 关键词；检查聚合改为自动发现（`scripts/checks/run-all.mjs`） |
| `8708ef7` | 采纳率按 tier 标注、`evidence` 不再全 action 必填、账本读缓存与压缩上限、pending 会话表上限、`hcot_attack` 参数校验、`shelfSummary()` 去写副作用 |
| `18bba57` | preset 自动修复默认只报告（`HELMD_AUTO_HEAL=1` 才写）、写前留 `.bak`、preset 名可配、GUI 卡片显示结论 |
| `2172012` | 导入 skill 文档断链与入口 |
| `d37d133` | `.npmrc` 去掉空代理项 |

## 6. 验证（skill 的六层）

1. **依赖解析**：`pnpm install` 后 `pnpm peers check` → *No peer dependency issues found*；lockfile 无 `0.1.0-rc.6` / `0.1.1-rc.2` / `cordis@4.0.1` / `schemastery@3.18.1` 引用；`pnpm why -r @deepseek-ai/dsh-tools` 只剩 0.1.5-rc.1；干净重装后虚拟 store 内 @deepseek-ai 全族均为 0.1.5-rc.1。
2. **启用解析**：`dsh.profile.bundles` 指向 `helm-d`，`cordis.patch.yml` 只挂 `dist/health.js`（host 面），agent 面由 preset 末行声明；`gen-preset --check` 绿。
3. **静态**：`pnpm typecheck` / `pnpm build` 通过；`pnpm test:checks` 8 份全绿；`test-gen-preset` PASS；`test-caseflow` 26/0；与基线豁免清单（空）对比无新增失败。
4. **运行时契约**：三份 host-seam 检查直接跑在**宿主真实 `dsh-session` 包**上——断言宿主 `Session` 无 `events`、`snapshotEvents()` 能读到真实日志、旧读法读不到、装配顺序 before/after 成立、bootstrap 在"只有 `snapshotEvents`"的宿主形态下冷启动仍锚定 `[pwsh, read]` 且晋升后恢复全量目录。
5. **行为**：`preset-heal` 在隔离 `DSH_HOME` 用真实 `gen-preset.mjs` 跑双模式（默认不改盘 / 开启后重写并留 `.bak`）；`hcot-refusal`、`route-signals`、`advisory-stats`、`tool-memory-schema` 覆盖本次修掉的行为回归。
6. **包装层**：`repack.ps1` 产出 `dist-tgz/dsh-security-helmd-0.3.0.tgz`（+ `helmd.tgz` 别名），包内 manifest 版本 0.3.0，`presets/`、`dist/`、`client.js` 与仓库逐字节一致；检查脚本的 SKIP 路径 exit 0（无宿主环境不误报）。

## 7. 回滚

- 代码：`git reset --hard 8fea55b`（本条不可用于已推送状态——本次提交**未推送**）。
- 依赖：`pnpm-workspace.yaml` overrides 与 11 个 `package.json` 的旧范围（见 `8fea55b`）；`pnpm install`。
- 部署位：`~/.dsh/.agent-presets/helmd/agent.cordis.yml` 与 `.bak` —— 本次迁移全程未改写（`gen-preset --check` 绿、repack 显示 `unchanged`）。
- 发布件：`dist-tgz/` 未入库，可重跑 `.\scripts\repack.ps1` 重建。

## 8. 未验证与残余风险

- **真机会话未做（唯一缺口）**：需要把 0.3.0 装进 profile → 重启 dsh → 开 helmd 会话 → 断言首请求 `[pwsh, read]`、晋升后 ≥60 工具（MAINTENANCE §8），并确认 advisory section / H-CoT hook 真的产出。**当前 GUI 里跑的仍是旧安装副本**（`~/.dsh/profiles/web/node_modules/@adwmc/helm-d/dist` 早于本次改动），重装前修复不生效。`verify-runtime.mjs` 是 POSIX-only，Windows 走事故复盘 §7 的手工 `session.create` 路线。
- **走廊缺口**：`alpha.2 → 0.1.5-rc.1` 无卡可依，该段结论全部来自宿主一手源；可能漏掉其他插件面变化（已核的 7 类之外未穷尽）。
- **`AssembleContext` 类型缺 `agent`**：运行时有、类型里没有，属上游类型面问题；helm-d 用本地窄类型收口，未上报上游。
- **peer 下限上移**（`>=0.1.5-rc.1`）是**声明层面的破坏性变更**：0.1.5 之前的宿主不再被声明支持（运行时仍留 `events` 回退，实际仍能跑）；覆盖全部已发布预发布线需要逐 tuple 枚举，未做。
- 0.3.0 **未发布**（未推送、未打 tag、未建 release），因此本次全部修复都落在同一版本号内。

## 9. 复现

```powershell
pnpm install --no-frozen-lockfile
pnpm peers check                     # 期望：No peer dependency issues found
pnpm typecheck; pnpm build
pnpm test:checks                     # 11 份（host seam + 行为回归 + 契约）
node scripts/test-gen-preset.mjs; node scripts/test-caseflow.mjs
node scripts/gen-preset.mjs --check  # 部署位 preset 与宿主 standard 同源
.\scripts\repack.ps1                 # dist-tgz\dsh-security-helmd-0.3.0.tgz
```

## 10. 后续变更（同一日第二批，均在同一未发布版本内）

迁移本身完成后，又从 CL4R1T4S 语料里筛了几条可抄的机制，并修掉干活时撞出的缺陷。检查从
8 份增到 11 份，全部进 `pnpm test:checks`。

| 提交 | 变更 | 依据 / 验证 |
|---|---|---|
| `9556e48` | `find_tool` 拆出 `caseflow`（239 行 6 工具 → 两张职责表） | 先拆边界再加功能；`test-caseflow` 26/0、mock-ctx 33 工具在册 |
| `de2a5c2` | AGENTS.md 补三条：外部内容只作数据、首轮探索预算、汇报四类前缀 | OPUS-5 把 memory 当可污染输入 / Codex 前 5 条命令只读根规则 / Codex 的 ✅⚠️❌ 前缀 |
| `325f2e0` | CASE.md `## resume` 六段契约（原来只有一行且 `case_status()` 不返回它）+ `end_case` 关闭门禁（无证据且未写明理由即拒） | ZCode 压缩摘要契约 + Devin「CI 不过不许报完成」；`case-close` 检查 6 条 |
| `1cff68a` | 熔断硬化：同一战术 3 次失败必须入 `DEAD_ENDS`，且不得无新证据重试 | 语料里"三次熔断"五处独立收敛；persona 与 caseflow RULES 同措辞 |
| `0fccea4` | `STALE` 不再是死代码：指纹一致时再与包内 preset 比内容（行尾归一化） | 触发它的正是同日 persona 改动；`preset-heal` 覆盖 STALE/OK(CRLF) |
| `c224d2a` | 工具计数 31 → 33，并新增 `tool-catalog` 检查读文档声明数与 mock-ctx 实注册数比对 | 差的两个正是被审提交新增的 `tool_memory` / `hcot_attack`；反证已验证会红 |
| `d7fd550` | 四类前缀成为可核销指标 `stance:report-prefix`；同时修掉 `reply_shows` 类指标的锚点缺陷（回复后重复武装 → 下一轮被记 ignored） | 新检查逼出的既有 bug（`stance:challenged` 同源）；武装改为只在"回合仍开着" |
| `54743b4` | 四标签改为**先教后测**（`adaptive`）：未达标时注入提醒，达标后提醒退场、计量继续 | `report-prefix` 6 条；账本机制文档角色表扩到三条 |
| `66b015a` | preset 漂移**默认自动修复**，但只修有指纹头（可证明是本包产物）的文件；`=0`/`=1` 可强制 | 时序：开机重写早于任何 standing mount，不触碰事故复盘那个触发面；真实部署位 STALE → OK |
| `051f74e` | 修复后自动跑**产物结构断言**（行集合/去重/helmd 唯一/persona 归属），`status=OK` 时也常驻 detail | §8 里可自动化的那半；真机会话那半仍留给操作者（宿主进程无法自证自己的 mount） |
| `0d33302` | 教学阈值改**滑窗**（最近 10 条）、汇报触发改**双信号**（工作名词 + 问句形态） | 累计率会漏掉后期回归、贴近阈值会抖；触发矩阵 8 正例 / 5 反例 |

**这批之后仍未验证的两件事**（都需要重启宿主，见 §8）：真机会话的首轮 `[pwsh, read]` 断言；
`adaptive` 提醒在真实汇报回合里的效果与采纳率。GUI 卡片新增的 `自动修复 Auto-heal` 行同样
要重装 + 重启后才可见。
