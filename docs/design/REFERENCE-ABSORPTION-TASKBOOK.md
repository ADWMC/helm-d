# 参考项目吸收任务书（Reference Absorption Taskbook）

> **状态**：全量 MVP 已落地（2026-11-04）；残留项见 §1.1，均为可增量补齐的边界能力。
> **来源**：`C:\Users\Administrator\Documents\GitHub\About-my-name\refs`（34 个登记项目，37 个目录）的**源码级**二次调研；每条机制带 `文件:行号`。
> **与既有文档的关系**：[REFERENCE-PROJECTS-SURVEY.md](REFERENCE-PROJECTS-SURVEY.md) 是分簇动机与 12 条机制；[REFERENCE-SCORING-AND-EXPANSION.md](REFERENCE-SCORING-AND-EXPANSION.md) 是评分与五条最高价值；本文是**可执行任务书**（任务/落点/验收/许可），不重复评分过程。
> **许可纪律**：AGPL / GPL 项目代码零复制，只吸设计与判据；无 LICENSE 项目禁用（见 §7）。
> **前置状态**：Team v2 Phase 1 已落地（宿主原生 agent-team、roleDeps、反假装门禁、27 checks），本任务书在其上继续。

## 1.1 落地状态（2026-11-04）

| 任务 | 状态 | 落点 / 残留 |
|---|---|---|
| T-01 实时纠偏 | ✅ MVP | `team_steer` + `steerPrompt` + Team UI 输入框 |
| T-02 证据审计 | ✅ MVP | detail hash/E-id 逐字校验、negative control、证据链 |
| T-03 任务 DAG | ✅ MVP | `claimTask`/`completeTask` 租约、依赖解锁、team_status |
| T-04 NO_PATH | ✅ MVP | case_status 相邻快照对比 + packet 顶部硬提示 |
| T-05 预算/finish gate | ✅ MVP | per-ticket budget、aborted/max-token → blocked、空 ready 拒绝 |
| T-06 证据版本绑定 | ✅ MVP | `meta.json` sha256/prevHash、finding `evidenceHash`、stale 标记 |
| T-07 进化 gate | ✅ MVP | 噪声宽限、最小改善、holdout、diff budget、父代选择 |
| T-08 上下文纪律 | ✅ MVP | >256KB 完整落证据 + head/tail stub |
| T-09 审批 fail-safe | ✅ MVP | role policy + 审批队列（5 分钟超时/单次批准/拒绝） |
| T-10 UI 工程化 | ✅ MVP | token 检查、滚动钉底、IME 防误发 |
| T-11 确定性报告 | ✅ MVP | `renderCaseReport` 固定字段/NOT RUN |
| T-12 Toolbox 2.0 | ✅ MVP | 评分、MCP 只读发现、probe TTL、角色策略、来源标注 |
| T-13.1 finding UI | ✅ MVP | 状态按钮/过滤/头部/Case 计数/Team severity |
| T-13.2 SARIF/报告 | ✅ MVP | SARIF 2.1.0 + 确定性 markdown |
| T-13.3 CVSS/趋势 | ✅ MVP | CVSS 3.1 向量算分 + 日趋势 |
| T-14 recon | ✅ MVP | scope/限速/资产账本/被动/端口/HTTP/crawl/import/覆盖 |
| T-15 PoC 闭环 | ✅ MVP | recipe + 正负对照 + evidence 链接 + loopback OOB |
| T-16 mining | ✅ MVP | APK AXML / HAR / OpenAPI / JS / 二进制 strings 候选 + 去重/优先级/覆盖行 |
| T-17.5 更新/镜像 | ✅ MVP | update 原子回退、本地镜像 sha256 |

---

## 1. 目标与范围

**目标**：把 37 个项目里已被源码证实可用的机制，按 P0/P1/P2 落进 helm-d，每项交付：机制来源 → 落点文件 → 单元验收 → 真机负向测试 → 许可确认。

**范围（五条线）**：
1. Team 协作（纠偏、任务图、预算、concurrency）
2. Evidence / 验证（审计、版本绑定、NO_PATH、正负对照）
3. Evolution（gate、holdout、噪声宽限、父代、回滚）
4. Context（观察压缩、证据外置）
5. Workbench / 工具面（UI 纪律、工具评分缓存）

**非目标**：
- 不引入外部服务 / 账号 / MCP 依赖；全部本机。
- 不 vendor 第三方代码；不搬 Docker/RL 环境。
- 不改已发布 Release（只推 main，发版另议）。

---

## 2. 任务清单

优先级定义：**P0 = 直接治当前已知痛点（team 不协调、假装执行）**；P1 = 补齐闭环；P2 = 打磨。

### T-01 worker 实时纠偏（P0）

| 项 | 内容 |
|---|---|
| 机制来源 | deepseek-harness：steer/inject/followup 分流，next-step 优先于 next-turn（`core/agent-loop/src/agent.ts:154-173`、`inbox.ts:109-113`）；pi 双队列（`agent-session.ts:320-321`、`agent-loop.ts:184-192`）；ARTEX 心跳唤醒 + steer_work/kill_work（`agent/planner.go:121-127`）；openclaude coordinator 以 task-notification 回报（`src/coordinator/coordinatorMode.ts:111-213`）；ARTEX "平台管控非目标防御"措辞防绕过（`guard/guard.go:57-138`） |
| 落点 | `packages/helmd/src/tools/team.ts` 新增 `team_steer(ticketId, role, message)`（对运行中 child 发 steer；非 orchestrator 拒绝）；`team-worker.ts` 维护 ticket→childId 映射并写回 assignment；`client.js` Team tab 每个 running 角色加输入框 |
| 验收（单元） | 非 orchestrator 调用被拒；未知角色/未运行角色报错；steer 消息落到目标 child inbox（fake runtime 断言） |
| 验收（真机） | worker 长任务中 steer "改为只做静态分析并以 blocked 报告" → 最终 report 反映新指令；负向：worker 自己 steer 被拒 |
| 许可 | MIT / Apache-2.0 / AGPL（ARTEX）→ 设计吸收，零复制 |

### T-02 证据审计升级（P0）

| 项 | 内容 |
|---|---|
| 机制来源 | redamon 声明审计（称"新信息"须有 finding 实际增长，`orchestrator_helpers/productivity.py:126-165`）+ 统一异常检测（`:190-300`）；SoL-Pi 逐字节引用收据（`evidence-preserving-reducer/receipt.ts:82-144`）；Decepticon 强制正例 PoC + 阴性对照（`tools/verification.py:18-80`）；T3MP3ST killing_guard 引用校验失败降级（`src/mission/adjudicate.ts:466-553`）；VulnClaw finding_parser 证据引用（`finding_parser.py:231-247`） |
| 落点 | `tools/caseflow.ts` `record_finding`：detail 中出现的哈希/数字/引用串必须在 cited evidence 文件内容中逐字命中（否则拒）；新增可选 `negative_control` 字段并校验其证据；`case.ts` findings 增加 `verifiedAt` / `evidenceHash` |
| 验收（单元） | 编造哈希/引用 → 拒；真实引用 → 过；negative_control 与正例同证据 → 拒（对照必须独立） |
| 验收（真机） | 仿 FAKEGATE：模型编造引用被拒并粘贴原文；合规链通过 |
| 许可 | MIT / Apache-2.0 / AGPL（T3MP3ST）→ 判据吸收 |

### T-03 任务 DAG 完整化（P0）

| 项 | 内容 |
|---|---|
| 机制来源 | VulnBot 任务 DAG + 拓扑排序（`db/models/plan_model.py:37-70`）；xalgorix hypothesis ledger 去重 + ClaimNext 原子认领（`internal/scanctx/ledger.go:218-250,376-412`）；T3MP3ST PackBoard claim CAS 租约 + 重复转背书（`src/pack/board.ts:118-300`）；Decepticon OPPLAN 拓扑波次 max_parallel=4（`middleware/opplan.py:254-396`、`parallel_dispatch.py:18-96`）；Pentest-Swarm pheromone 衰减 + supersede（`blackboard/types.go:57-70`、`memory.go:109-260`） |
| 落点 | `team.ts`：`roleDeps` 升级为 `tasks[{id, role, blockedBy, owner, leaseUntil, state}]`；新增 `claimTask/completeTask`；`team-worker.ts` dispatch 前 claim（租约超时回收）；`team_status` 输出 ready/blocked/claimed/owner |
| 验收（单元） | 两个 dispatch 并发抢同一 task 仅一个成功；拓扑未满足不可 claim；租约过期可回收；重复 claim 幂等 |
| 验收（真机） | critic 依赖 static+dynamic 全部 done 后才进入 ready；并发派工不重复 |
| 许可 | MIT / Apache-2.0 / AGPL → 语义吸收 |

### T-04 NO_PATH / 重复路径守卫（P0）

| 项 | 内容 |
|---|---|
| 机制来源 | VulnClaw near-miss NO_PATH 守卫（首次终结结论遇高信号证据即驳回，`solver.py:322-372,765-777`）+ reflexion 同类连败升级（`reflexion.py:47-105`）；redamon LATS 跨树探针硬去重（`lats.py:382-429`、`state.py:1175`）；Dark-Moon 重复命令拦（`execution_guard.py:203-216`） |
| 落点 | `persist.ts` + `autonomy.ts`：用真实 `tool/call` 轨迹统计（session-log）——同一 tool+args 连续 ≥3 次且证据无新增 → autonomy packet 顶部硬提示 NO_PATH + 建议换路径；与 case 内 dead-end 记录联动 |
| 验收（单元） | 构造重复序列 → packet 出现 NO_PATH；有新证据 → 不触发 |
| 验收（真机） | 模型连续重复被提示后改变路径或显式 blocked |
| 许可 | MIT / AGPL（VulnClaw MIT；redamon MIT）→ 判据吸收 |

### T-05 预算继承 + finish gate（P1）

| 项 | 内容 |
|---|---|
| 机制来源 | xalgorix scanBudget 覆盖子 agent（`agent/agent_budget.go:14-155`）+ finish gate 禁带未收集结果结束（`agent/agent.go:698-729`）+ completion gate（`completion.go:46-122`）；Decepticon USD 预算 70% soft / 100% hard，无法核对即 fail-closed（`middleware/budget.py:12-360`）；Pentest-Swarm AgentBudget（`board.go:78-92`、`memory.go:73-107`）；openclaude 压缩连续失败熔断（`services/compact/autoCompact.ts:93-135`） |
| 落点 | `team.ts` ticket budget `{wallTimeMs, maxToolCalls}`；`team-worker.ts` 继承父 ticket 预算并扣减；预算耗尽 → 强制 `blocked` 报告（不是 failed/正常结束） |
| 验收（单元） | 预算耗尽 → blocked；max-tokens stopReason 映射 blocked；finish gate 拒绝"无事可报"的 ready |
| 验收（真机） | 小预算 worker 输出 blocked + 缺失输入，不编造 |
| 许可 | Apache-2.0 / AGPL / MIT → 语义吸收 |

### T-06 证据版本绑定（P1）

| 项 | 内容 |
|---|---|
| 机制来源 | ARTEX 内容寻址 sha256 blob + 读时重校验（`evidence/store.go:43-115,247-258`）+ 流量证据 version 绑定（`:197-247`）；Decepticon 证据 sha256+prev_hash+HMAC 追加链（`tools/evidence/tools.py:136-250`）；Pentest-Swarm Ed25519 来源签名（`provenance/provenance.go:71-83`） |
| 落点 | `case.ts` 证据落盘写 `meta.json {sha256, prevHash, tool, ts}`；`record_finding` 记录证据链头 hash；证据文件变更 → 旧 finding 标 `stale`（case_status/Team report 显示） |
| 验收（单元） | 篡改证据 → finding stale；链校验失败提示；重算链一致 |
| 验收（真机） | 修改证据后 case_status 显示 stale，模型被提示重新取证 |
| 许可 | AGPL（ARTEX）/ Apache-2.0 / AGPL → 设计吸收 |

### T-07 进化 gate 强化（P1）

| 项 | 内容 |
|---|---|
| 机制来源 | SkillOpt 三态 gate accept_new_best/accept/reject + 编辑预算（`evaluation/gate.py:135-225`、`optimizer/clip.py:25-108`）；dgm keep_better + 0.1 噪声宽限 + 父代 sigmoid(score)×1/(1+children)（`DGM_outer.py:174-190,84-100`）；trpc 三层 gate（效果/规格/安全）+ holdout + 原子 rollback（`evolution/gates.go:134-173`、`optimization/engine.go:61-65,122-130`、`approval_service.go:295-342`）；AutoHarness 单文件单改 + 构建/测试门 + 改前备份（`prompts/evolve_system.txt:3,21`、`src/main.rs:200-211,893-1004`）；harness2 预算恒等式 R=4k/P=3k + 证据式教训（`core/ledger.py:26-35`、`core/prompts.py:1126-1147`） |
| 落点 | `team.ts`：`canActivate` 加噪声宽限（0.1）与最小改善 ε；`evaluateRevision` 增加 holdout 集与安全层；propose 时限制 diff 行数（编辑预算）；`team-eval` CLI 增加 `--holdout`；父代选择按 score×1/(1+children)（若引入多候选） |
| 验收（单元） | 噪声内不判回归；holdout 掉分拒绝；diff 超预算拒绝；激活后 rollback 原子 |
| 验收（真机） | 一轮 propose→evaluate(含 holdout)→activate→rollback 全链 |
| 许可 | MIT / Apache-2.0 → 语义吸收 |

### T-08 上下文纪律（P1）

| 项 | 内容 |
|---|---|
| 机制来源 | SoL-Pi ObservationPack（前 2 次全量，之后占位 + obs_recall 分页，不改历史，`observation-pack/index.ts:40-90`）+ 证据保留 reducer（摘要引用须逐字节命中，`receipt.ts:82-144`）+ 压缩经济学（`online-context-compact/economics.ts:129-180`）；redamon 大输出落盘仅回 head/tail stub（`output_offload.py:88-145`）；Cairn 图谱 YAML 落文件由 worker 自读（`tasks/common.py:56-70`）；deepseek-harness 80% 触发保留 16%（`compaction-basic/src/index.ts:194-232`）；pi reserve 16k/keepRecent 20k（`compaction.ts:122-129,431-472`） |
| 落点 | `persist.ts`：>256KB 工具输出 → 完整落证据，模型回显 head/tail + E-id；`case_status` 默认引用文件而非全文；worker prompt 提示"大输出看 evidence 文件" |
| 验收（单元） | 大输出 → 证据完整 + 回显 stub；引用计数下降 |
| 验收（真机） | 大样本分析 token 明显下降且结论仍引用 E-id |
| 许可 | MIT / Apache-2.0 → 实现参考 |

### T-09 审批 fail-safe + 自治降级（P2）

| 项 | 内容 |
|---|---|
| 机制来源 | antares 审批台 5 分钟超时即拒（`internal/agent/approval.go:81-167`）+ 危险命令正则预检（`:187-233`）+ 批判模型复核（`harness.go:206-254`）；APTS L1-L4 分级自治（`standard/4_Graduated_Autonomy/README.md:5,49-66`）+ 降级矩阵（`appendix/Autonomy_Downgrade_Matrix_Template.md:34-55,65-100`）+ 证据包 manifest（`Evidence_Package_Manifest.md:24-104`）；Decepticon HITL（`middleware/hitl.py:81-472`）；T3MP3ST 风险分层审批（`arsenal/approval.ts:39-116`） |
| 落点 | dynamic worker 高风险工具/命令的审批：超时默认拒；autonomy level 文档化映射到 settings；证据包 manifest 作为 end_case 可选产物 |
| 验收（单元） | 超时 → deny；高风险命令 → ask/deny；低风险直通 |
| 验收（真机） | dynamic worker 被拒后输出 blocked + 缺失授权说明 |
| 许可 | Apache-2.0 / CC BY-SA 4.0（APTS，需署名）/ Apache-2.0 / AGPL → 判据吸收 |

### T-10 Workbench / UI 工程化（P2）

| 项 | 内容 |
|---|---|
| 机制来源 | open-claude-ui 滚动钉扎 150ms/40px（`useClaudeScrollPinning.ts:16-64`）+ token CI 门禁（`scripts/check-tokens.mjs:1-8`）+ MCP 工具决策卡 allow_once/always/deny（`McpToolDecisionCard.tsx:44-60`）；grok-build 流式 markdown checkpoint 冻结（`xai-grok-markdown/src/streaming.rs:1-20`）+ segment_*.md + INDEX（`xai-compaction-transcript/src/lib.rs:20-50`）；ZCode DESIGN.md 单源（`DESIGN.md:5-12,236-245`）+ 工具结果微压缩留最近 5 条（`microcompact.ts:14-25`）；Dify 三层 token（`tailwind-core.css:18-25`）+ IME composition 防误发（`chat-input-area/index.tsx:118-210`）；celeris 色阶生成（`themeUtils.ts:24-29`） |
| 落点 | `client.js`：滚动跟随、IME 防误发、工具决策卡样式；`scripts/checks/ui-tokens.check.mjs`：工作台引用的 token 必须在 CSS 定义（防硬编码） |
| 验收（单元） | token 检查：未定义 token → 红；气泡/卡片暗色 token 正确 |
| 验收（真机） | 浏览器点验（browser-use）+ 长会话滚动跟随 |
| 许可 | MIT / Apache-2.0 → 实现参考 |

### T-11 报告确定性渲染（P2，证据待补）

| 项 | 内容 |
|---|---|
| 机制来源 | Dark-Moon 报告确定性渲染（调研笔记提及，**本轮未取得行号**）；redamon 统一异常检测（`productivity.py:190-300`） |
| 落点 | reporter prompt + findings 渲染模板（固定字段/排序/空值标记） |
| 验收 | 同一输入两次渲染字节一致；缺失字段显式 NOT RUN |
| 前置 | **先补源码位置证据**，再立项 |

### T-12 Toolbox 2.0（工具货架/选型/健康/缓存）（P1）

**状态（2026-11-04）**：`tool_memory` 已按操作者决定删除——模型乱记账，77 条里 35 条未登记、67 条路径不可解析；`TOOLS.md`/`DEAD_ENDS.md` 文件保留在磁盘但不读不写，`route_task`/`case_status` 不再注入账本。保留 `tool_recommend`（65 条静态规则 + `references/toolbox/tool-matrix.md`，`toolbox.ts:8-100`）。
**剩余缺口**：静态规则无健康探测/成功率/延迟/缓存；无 MCP 工具发现；无 per-role 工具策略。
**以下审计保留为「为什么删除」的证据（对应代码已删）**：
- TOOLS.md 46 KB / **77 条**：`installed` 24（日期字符串）、`noted` 35、**无状态 18**；53 条没有 `用法` 模板。
- **67 条路径在磁盘上不可解析**（含 35 条 `(未登记)`、WSL 规格串、npm 包名、URL）——推荐可能指向不存在的工具。
- `route_task` 每次注入**全部 77 行**（≈3.1 KB / 约 1k tokens），无 top-N、无相关性排序（`router.ts:126`、`ledger.ts:245-262`）。
- `readShelfTools()` 只进 `/api/helmd/health.tools`，**前端没有任何渲染消费**（`health.ts:316`；`client.js` 无引用）→ 货架在 UI 上不可见。
- `tool_recommend` 纯 `q.includes(key)` 子串匹配，无词边界/排序/去重语义；英文常见词 `web/android/fuzz/python` 命中 0 条，`ida` 误命中 5 条（`toolbox.ts:100-115`）。
- `registerToolEntry` 无条件在账本目录创建同名**空目录**，不校验路径是否存在（`ledger.ts:84-86`）；`noteTool` 的 implicit registration 就是 `(待补职责)/(未登记)` 的来源（`ledger.ts:112-120`）。
- `note` 的 `evidence` 是自由字符串，不校验是否是真实 case/E-id（与 `record_finding` 的门禁不同）。
- 无 denylist/deprecate/merge；无 MCP/DSH 原生工具发现；46 个插件工具与 54 项目录直到本轮才进入工具页。

| 子项 | 机制来源 | 要求 | 验收 |
|---|---|---|---|
| T-12.1 健康探测（只读） | VulnClaw MCP `ProbeMixin` / `MCPRegistry` / diagnostics（`vulnclaw/mcp/_probe_mixin.py:43-68`、`mcp/registry.py:59`、`mcp/diagnostics.py`）；DSH MCP 连接探测（`mcp-client/src/connection.ts:163-172`） | 对 `tool_recommend` 规则里提到的本机命令做**只读探测**（存在/可执行/版本），返回 `verified/missing/stale` 附注；不写账本、不创建条目 | 单元：假命令→missing；真机：推荐结果带健康注记 |
| T-12.2 选型评分 | hexstrike 目标画像选型 + 攻击链成功率（`hexstrike_server.py:1003-1060,1462-1550`） | `tool_recommend` 从关键词升级为**打分排序**：signal 匹配 + successRate + latency + 最近使用 + 降级链；返回 top-N 与理由 | 单元：排序稳定/降级链；真机：重复任务推荐收敛 |
| T-12.3 MCP 只读发现 | ZCode manifest（`plugin-components.ts:28-55`）；OpenAgentsControl registry（`registry.json:11-30`）；DSH MCP 前缀 `mcp__server__tool` | 只读枚举本机 MCP server 工具，供 `tool_recommend` 展示；不写账本、不引入外部服务 | 单元：fixture MCP 清单；真机：挂一个本地 stdio server |
| T-12.4 只读缓存 | hexstrike LRU+TTL（`hexstrike_server.py:5091-5213`） | 确定性只读命令（版本/帮助/hash 类）短 TTL 缓存；命中仍写证据引用；写操作永不缓存 | 单元：命中/过期/写不缓存 |
| T-12.5 角色工具策略 | DSH agent-team 工具面 + 我们的 team-policy | 由 settings 配 per-role allowlist/denylist（当前只硬编码 3 个名字）；越权拒绝并记录 | 单元：worker 调 orchestrator-only 工具被拒；真机：策略生效 |
| T-12.6 来源/信任 | T3MP3ST arsenal riskTier（`arsenal/approval.ts:39-116`）；Dark-Moon 工具白名单（`executor.py:18-40`） | 推荐条目带 source/license/trust（verified/untrusted）；finding 可拒绝引用 untrusted 工具产物 | 单元：untrusted 条目不进 top-N；真机：finding 拒绝 |

**验收（整体）**：`pnpm test:checks` 新增 `toolbox-health`/`toolbox-score` 用例；真机跑 `tool_recommend`+`tool_memory`（health→推荐→缓存→失效标记）一轮。
**许可**：MIT/Apache 参考；VulnClaw/hexstrike 仅语义吸收。

---

### T-13 漏洞登记 + 定级 + UI 展示（P0）

**机制来源**：ARTEX findings 表 + critical/high/medium/low + 9 态 triage（`db/findings.go:39-78`）；xalgorix CVSS→severity + 弱证据降一级（`internal/tools/reporting/reporting.go:3512-3531,777-798`）；Decepticon critical/high 需 2+ 验证方法 + confidence 独立轴（`decepticon_core/types/engagement.py:102-125`）；T3MP3ST provenance 封顶 + `assertedSeverity`（`src/operators/index.ts:723-745`）；VulnClaw `vuln_type+location` 去重（`config/domain_models.py:266-289`）；antares 同 title+target 自动 duplicate（`internal/findings/findings.go:129-181`）。
**许可**：AGPL（ARTEX/T3MP3ST）/ Apache（xalgorix/Decepticon）/ MIT（VulnClaw/antares）→ 判据吸收，零复制。

#### T-13.0 核心注册表（✅ 已落地 2026-11-04，commit `1b1d9e8`）

| 项 | 内容 | 状态 |
|---|---|---|
| 存储 | `findings.json` 为事实源（`F-xxx`/severity/status/confidence/vuln_class/target/cvss/assertedSeverity/evidenceIds/repro/seenCount），`findings.md` 保留审计；旧 markdown 自动兼容 | ✅ |
| 定级规则 | CVSS 权威覆盖 + asserted 留档；`unverified` 封顶 medium；critical/high 需 ≥2 条独立 E-id，否则降一级；未知 severity 归一 info | ✅ |
| 去重 | `vuln_class + target + 归一化 title` 同键合并：证据并集、取最高等级、`seen_count++` | ✅ |
| 生命周期 | 新工具 `update_finding`：candidate → verified → rejected/duplicate/wontfix（note 进 timeline） | ✅ |
| 统计 | `case_status` 输出 severity/status 计数行；`severityCounts`/`findingStatusCounts` | ✅ |
| 门禁链 | 先过反假装门禁（真实 `read_reference` 轨迹 + 工具证据溯源），再进定级规则 | ✅ |
| 验收 | `finding-registry.check.mjs` 7 项 + 真机 RATING 测试（CVSS 覆盖/合并/降级/状态/统计） | ✅ |

#### T-13.1 UI 展示（P0，**部分落地：徽章与计数已有，交互缺**）

| 子项 | 要求 | 落点 | 状态 |
|---|---|---|---|
| 徽章与计数 | Case tab finding 卡片显示 `SEVERITY` 徽章、status 徽章、`F-xxx`、`×seenCount`；卡片头显示 `总数 · C/H/M/L` 分档 | `client.js` CaseTab（已实现 `SEVERITY_COLOR`/`severitySummary`） | ✅ |
| 状态编辑 | 每条 finding 提供 verify / reject / duplicate / wontfix 按钮（带 note 输入），走 `POST /api/helmd/case/findings` 或新 `/finding` 路由调用 `updateFinding`；操作后刷新 | `client.js` + `api-routes.ts` 新增写路由 | ⬜ |
| 过滤与排序 | 按 severity（critical→info）与 status（verified/candidate/rejected）过滤/排序；默认 critical 优先 | `client.js` CaseTab | ⬜ |
| 工作台头部 | 头部摘要加 `critical N / high N`（有未决 critical 时高亮） | `client.js` workbench header | ⬜ |
| Case 列表 | 未绑定 case 时的“磁盘最近 case”行显示 severity 计数 | `/api/helmd/case` + `client.js` | ⬜ |
| Team 报告 | ticket 报告/角色统计带 severity 计数（worker 报告中的 finding 等级汇总） | `team.ts`/`api-routes.ts` | ⬜ |
| 验收 | 单元：stats 路由对 `updateFinding` 的合法/非法状态；真机：UI 点击 reject 后 `findings.json` 状态变化、case_status 计数同步；负向：非法状态返回 400 | — | — |

#### T-13.2 导出与报告（P1）

| 子项 | 要求 |
|---|---|
| SARIF 导出 | finding → SARIF 2.1.0（severity 映射 critical/high→error、medium→warning、low/info→note；带 E-id/repro 引用） |
| 报告渲染 | `end_case` 摘要按 severity 排序，分 verified/candidate/rejected 三组；空字段显式 NOT RUN |
| 验收 | 同一 case 两次导出字节一致；SARIF 校验器通过；rejected 不进正文 |

#### T-13.3 CVSS 向量与趋势（P2）

| 子项 | 要求 |
|---|---|
| CVSS 向量解析 | 支持 `CVSS:3.1/...` 向量算分（当前只接受 0-10 分数）；向量与分数不一致时以向量为准并留档 |
| 趋势统计 | 按 case 时间线输出 severity 变化（新增/升级/降级/rejected），供报告与 UI 使用 |
| 验收 | 向量算分与 NVD 示例一致（≥10 组）；趋势统计与 timeline 一致 |

### T-14 信息收集 / recon（P1）

**机制来源**：xalgorix recon 谓词 + 覆盖矩阵 + scope/限速（`internal/agent/recon_predicate.go:63-186`、`coverage.go:33`、`scopeguard.go:174`、`ratelimit.go:21-87`）；redamon 成熟 CLI 调度 + Neo4j MERGE（`domain_recon.py:236`、`port_scan.py:227`、`resource_enum.py:301`、`domain_mixin.py:331`）；Decepticon KG ingest + RoE/egress（`tools/ingest.py:131-349`、`middleware/roe.py:295-526`）；ARTEX 六类资产 + 7 个 partial unique index（`db/schema.sql:40-90`、`tools_insert.go:487`）；T3MP3ST arsenal catalog+parser（`arsenal/catalog.ts:138-295`、`parsers.ts:73-181`）；antares phase/coverage methodology（`engagement/phase.go:36-60`、`prompt.go:355-431`）。
**DSH 事实**：`web_fetch` 仅 GET、无自定义 header/cookie/body、无 JS、SSRF 安全（DNS pin）、30s/5MB（refs/deepseek-harness `web/web-fetch-http/src/provider.ts:61,74-110`、`network.ts:54-64`）；无资产图/scope/限速/OOB（宿主缺口，见调研）。

| 子项 | 要求 | 落点 | 验收 |
|---|---|---|---|
| 资产账本 | `recon/assets.jsonl`（append-only）：`kind/value/parent/source/first_seen/last_seen/evidence_id`；键 `kind|value|parent` 去重；摘要写 CASE.md `## assets` | `case.ts` 新模块 `recon.ts` | 单元：同键去重、父子关系、E-id 关联 |
| 被动收集 | `recon_passive`：DoH 解析 + crt.sh 证书透明（可离线注入 JSON 测试）；参数白名单，无任意 URL | 新工具 `tools/recon.ts` | 单元：fixture 解析；真机：对 lab 域跑一次 |
| 主动收集 | `recon_ports`（connect scan，禁止原始 socket 发 shellcode）、`recon_http`（GET 基线、tech 指纹）、`recon_crawl`（限深/限页）、`recon_import`（nmap XML / httpx JSONL / nuclei JSONL 解析） | 同上 + `scripts/recon/*.py` | 单元：XML/JSONL fixture；真机：本地 lab HTTP 服务 |
| scope 围栏 | `begin_case` 增 `scope[]`（domain/CIDR）；所有 recon 目标先校验；**默认拒绝 loopback/私网/云元数据**，需显式 `lab=true` | `case.ts` + `tools/recon.ts` | 负向：越界目标/私网默认拒；lab 开关放行 |
| 限速 | per-host 1 rps + jitter；并发 ≤4；单工具超时 30s | 同上 | 单元：令牌桶；真机：日志间隔 |
| 覆盖度 | `case_status` 增 `[recon]`：资产数/未测资产/六维覆盖（dns/http/tech/crawl/dir/ports） | `autonomy.ts`/`caseflow.ts` | 单元：覆盖计算；真机：统计行 |
| 证据 | 原始输出一律 `save_evidence`（hash 去重）；finding 可带 `asset_refs[]` | 复用 `case.ts` | 单元：E-id 关联 |

> 安全边界：不内置扫描器二进制；仅调度本机可选 CLI（httpx/naabu/nmap），缺失时降级为纯 Python/Node 实现（DoH、connect scan、目录小字典）。所有输出落证据，不做静默网络访问。

### T-15 PoC 生成/执行/验证闭环（P1）

**机制来源**：xalgorix 候选账本 + LLM 填参 + 三请求确认（`scan_source_sinks.go:145`、`ledger.go:218`、`verify_sqli.go:63`、`verifier.go:48,215`）；T3MP3ST 证据阶梯 + ASan 真 PoC + refuter 多数（`verify-finding.mjs:36,184`、`refute-finding.mjs:74,384`）；Decepticon 正例+阴性对照判定（`tools/verification.py:18-80`、`poc.py:253-315`）；Pentest-Swarm recipe 表 + 外部 oracle 三态（`poc.go:83`、`recipes.go:18`、`oracle.go:59`、`differential.go:98`、`oob.go:106`）；VulnClaw 模板+ExecutionGate（`verifier.py:104,307,443-500`）；ARTEX retester 三态 + 流量绑定（`retester.go:6-12`、`finding_traffic.go:364`）。
**DSH 事实**：无原始 HTTP（fetch 仅 GET/无 header/body）、无 OOB/回调、无网络隔离/PoC 容器（sandbox 仅文件写）；shell 默认 120s 上限 600s、64KB 尾部+spill（`shell/bash-local/src/index.ts:99-107`、`subprocess-local/src/output.ts:20-43`）。

| 子项 | 要求 | 落点 | 验收 |
|---|---|---|---|
| Candidate | 复用 `record_hypothesis` 增 `test_cmd/negative_cmd/expected/observed`；H-xxx 即 candidate；dedup `class|target|endpoint|param` | `case.ts` hypotheses 扩展 | 单元：去重/必填 |
| Recipe 库 | 确定性模板：http-diff、sqli 三请求、IDOR 双身份、path-traversal、JWT、XSS canary、timing；LLM 只填 URL/参数/token | `packages/helmd/scripts/poc/recipes/*` | 单元：模板渲染/参数校验 |
| 执行器 | `run_poc`：临时 cwd、env 白名单、30s 超时、kill 进程树、输出/退出码/耗时落证据；**scope allowlist 复用 T-14** | `tools/poc.ts` + `scripts/poc/run.mjs` | 单元：超时/清理；负向：越界拒 |
| 正负对照 | 必须跑负例（去 payload/良性值）且不得命中成功正则；三态 verified/refuted/inconclusive | 同上 | 单元：positive+negative 判定矩阵 |
| OOB | 本机临时 HTTP listener 收 token（仅 lab，默认关）；无 OOB 时只允许确定性证据 | `scripts/poc/oob.mjs` | 单元：token 回连；真机：local lab |
| finding 联动 | `record_finding` 增 `poc_id`、`positive_evidence`/`negative_evidence`；无负对照最高 medium；high/critical 必须有 poc_id | `caseflow.ts` + `case.ts` | 单元：无 poc_id 的 critical 被降级；真机：完整链 |
| 安全 | 默认 safe-mode（幂等 GET/无破坏 payload）；状态变更类需 approval；不做 DoS/爆破默认 | 设置项 + `team-policy` | 单元：非安全 payload 拒 |

### T-16 漏洞挖掘 / 候选发现（P2）

**机制来源**：xalgorix source→sink 自动候选 + 覆盖矩阵（`scan_source_sinks.go:145`、`coverage.go:33`）；Decepticon scanner 排序 + `path:line:sink_kind`（`scanner_tools.py:526,601`）；T3MP3ST kill-chain 攻击图 + OSV novelty（`attack-graph.ts:47-52,106-196`、`verify-finding.mjs:454`）；VulnBot plan DAG（`plan_model.py:30`）；HackSynth planner 单步（`pentest_agent.py:169`）；hexstrike 技术指纹→工具选型（`hexstrike_server.py:971,9673`）；ARTEX `list_untested_assets` + TaskCoverage（`tools_insert.go:487`、`task_assets_context.go:121`）。

| 子项 | 要求 | 落点 | 验收 |
|---|---|---|---|
| 候选提取 | 从本地成品提取候选：HAR/OpenAPI/JS 路由/参数、APK 清单、二进制字符串；产出 `candidates.jsonl`（`class/target/endpoint/param/source/confidence`） | `scripts/mine/extract_*.mjs` | 单元：fixture 提取/去重 |
| 覆盖驱动 | 未测资产/未覆盖维度 → 下一步建议；`case_status` `[mining]` | `autonomy.ts` | 单元：覆盖差集 |
| 优先级 | 按 class 风险 + 资产重要性 + 证据新鲜度排序 | `case.ts` | 单元：排序稳定 |
| 团队接入 | static worker 产 candidate，critic 复核，dynamic 执行 PoC（T-15） | `team-worker` prompt + `team.ts` | 真机：static→critic→dynamic 链 |
| 非目标 | 不做全量 SAST/符号执行；不做网络 fuzz；不引入外部扫描器二进制 | — | — |

### T-17 工具下载器 + 工具注册表（P1，MVP 已落地 2026-11-04）

**状态**：T-17.1 catalog/registry、T-17.2 GitHub release 安装器（sha256 必填/抗 symlink/版本隔离）、T-17.3 WebUI「工具」tab、T-17.4 模型 `toolbox(action=catalog|status|install|update|mirror|probe|mcp)` 已落地；catalog 54 项（release 16 / pip 18 / manual 20），覆盖 Android、Native、Firmware、Code、Web/AD、Malware、AI、Runtime、Protocol。2026-11-04 真实 release 审计 16/16 可解析；UPX（zip）与 HashDump BootKey.exe（裸 exe）已真机走完下载 → sha256 → 安装 → 健康 → 卸载；ffuf update 与本地 mirror 已真机验证（备份→重装→回退）。模型安装默认 `toolbox.modelInstall=false`（仅操作者可在 UI 安装或显式开启）。
**实现备注**：多资产 release 用 `asset`（固定名）或 `assetPattern`（版本无关正则）锁定，歧义即拒绝；`requestBuffer` 跟随最多 5 跳 302（GitHub 资产跳转）且跨域剥离 Authorization；Windows 优先用系统 bsdtar（可解 zip，GNU tar 不可）；工具根目录跟随 `$DSH_HOME`，隔离 profile/测试不污染操作者状态。
**定位**：**catalog-driven installer（目录驱动安装器）**，不是"模型随便下工具"。catalog 只含已核实 GitHub 仓库的工具；无 GitHub 链接的 IDA/ExeinfoPE/gdb/nook 不入目录。

| 子项 | 要求 | 落点 | 验收 |
|---|---|---|---|
| T-17.1 目录与注册表（只读先行） | 内置 `toolbox/catalog.json`：id/name/version/url/sha256/size/license/kind/binPath/usage/healthCmd/capabilities；安装态 `$DSH_HOME/helmd-tools/registry.json`：id/version/path/sha256/verifiedAt/health/license | 新 `src/toolbox/`（catalog/store/health） | 单元：目录校验、registry 幂等、健康探测状态 |
| T-17.2 下载与解压 | 仅 catalog 内 URL；HTTPS；proxy-aware；sha256 必填且校验；zip/tar 抗 zip-slip；按 `<id>/<version>/` 隔离；不覆盖已有；失败原子回滚；**不自动执行** | `src/toolbox/installer.ts` | 单元：hash 失败拒绝、zip-slip 拒绝、版本隔离、回滚 |
| T-17.3 WebUI | 新「工具」tab（或设置子页）：catalog/已装/版本/路径/健康；安装/更新/卸载；进度与日志；来源/哈希/大小确认 | `client.js` + `/api/helmd/tools/*` | 真机：UI 安装→健康→卸载 |
| T-17.4 模型只读/受控安装 | `tool_catalog(query)` 只读（是否安装/路径/调用模板/健康）；`tool_install(id)` 仅 catalog 条目，走 approval（ask/auto/deny，默认 ask）；`tool_health(id)` 只读；模型不得传任意 URL、不得写 catalog、不得执行下载物 | `tools/toolbox.ts` + settings | 负向：任意 URL/未批准/坏 hash 全拒；真机：模型读路径并调用 |
| T-17.5 更新/卸载/离线镜像 | 版本升级、卸载（保留证据日志）、本地镜像路径（离线导入） | 同上 | 单元/真机各一轮 |

**安全红线**：模型不能提供任意 URL；catalog 只能随包/操作者维护；sha256 缺失即拒绝；安装后不自动运行；license 必须记录；Windows Defender/SmartScreen 与代理失败要显式报错。
**验收（整体）**：单元（catalog/hash/zip-slip/registry/approval）+ 真机（UI 装一个工具 → 模型 `tool_catalog` 读到路径与用法 → `tool_install` 幂等 → 卸载）。
**许可**：只下载上游二进制，不随包分发；catalog 记录上游 license 与来源。

## 3. 顺序与依赖

```text
Sprint 1（并行两条线）:
  Team 线:   T-01 实时纠偏   +   T-03 任务 DAG
  Evidence 线: T-02 审计升级 +   T-04 NO_PATH 守卫
Sprint 2:
  T-05 预算/finish gate  →  T-06 证据版本绑定  →  T-07 进化 gate 强化
Sprint 3:
  T-13.1 finding UI（状态编辑/过滤/头部/Case 列表/Team 报告）
  →  T-17.1 工具目录 + 只读注册表
  →  T-14 recon（资产账本 + scope/限速 + 被动/导入先行，主动扫描后置）
  →  T-08 上下文纪律  →  T-09 审批 fail-safe
Sprint 4:
  T-15 PoC 闭环（candidate → recipe → run → 正负对照 → finding 联动）
  →  T-17.2/3 下载解压 + WebUI 工具页
  →  T-13.2 SARIF/报告导出
Sprint 5:
  T-16 候选挖掘（HAR/OpenAPI/JS/APK/字符串提取 + 覆盖驱动）
  →  T-17.4/5 模型受控安装 + 更新/卸载/镜像
  →  T-13.3 CVSS 向量/趋势
Sprint 6:
  T-10 UI 工程化  →  T-12 工具评分/缓存  →  T-11（先补证）
```

依赖：T-17.2/.3 依赖 T-17.1；T-17.4 依赖 T-17.2 与 T-09 的审批策略；T-07 依赖 T-02 的审计字段；T-06 依赖 T-02 的证据元数据；T-05 依赖 T-03 的 task 预算归属；T-13.1/.2/.3 依赖 T-13.0（已落地）；T-15 依赖 T-14 的 scope/资产账本；T-16 依赖 T-14 的资产账本与 T-15 的执行器。

每项必须带**设置开关**（settings + DSH Config），默认保守，可一键回退。

---

## 4. 通用验收门禁（每项都要）

1. `pnpm build` / `pnpm typecheck` / `pnpm test:checks` 全绿（当前基线 27 PASS）。
2. 新增行为必须有**会在错误实现上变红**的检查（unit check）。
3. 真机负向测试：headless rig（`HELMD_BOOTSTRAP=off` + stepfun）+ 明确"作弊路径"，必须被拒；合规路径必须通过。
4. 磁盘证据：E-id / repro_cmd / state.json diff；模型自述不算。
5. 报告格式：`已修复并验证` / `已修复未验证` / `待决策` / `已知问题`。

---

## 5. 许可红线（硬约束）

| 类别 | 项目 | 约束 |
|---|---|---|
| AGPL-3.0 | ARTEX、T3MP3ST、HackSynth、Pentest-Swarm-AI、Cairn、deadend-cli | 代码零复制；只吸设计与判据 |
| GPL | Dark-Moon (GPL-3.0)、reverser_ai (GPL-2.0) | 代码零复制；与 helm-d AGPL 兼容但保持 clean-room |
| CC BY-SA 4.0 | APTS | 引用标准文本需署名；衍生文档同许可 |
| 修改版 Apache | Dify | 多租户/LOGO 限制；只读设计 |
| **无许可（禁用）** | AutoHarness | 不参考实现，只可讨论教训 |
| **衍生未授权（禁用）** | openclaude | 不参考实现 |
| MIT / Apache-2.0 | 其余 | 可参考实现，但仍按仓库规范"只吸设计、不 copy" |

---

## 6. 当前不做（明确排除）

- 不搬 RL 环境接口（NASim）、不引入 Docker 编排（pentagi/Decepticon 的容器层）。
- 不引入 USD 计费（Decepticon）——本机没有计费源，按 wallTime/toolCalls 代替。
- 不引入外部 MCP 服务器（hexstrike 形态仅参考本地工具面）。
- 不做多进程 Team / 远程成员（experimental agent-team 的已知限制）。

---

## 7. 附录 A：逐项目证据索引（37 目录）

> 路径相对 `refs/` 根；仅列"独有可吸收点"，完整机制见 §2 任务来源。

### A1 自主渗透平台

| 项目 | 独有可吸收点 | 证据 | 许可 |
|---|---|---|---|
| pentagi | barrier ask/finaly；subtask refiner；Docker 超时提示 | `pkg/tools/registry.go:98-101`、`controller/task.go:341-371`、`tools/terminal.go:196-260` | MIT（依赖含 AGPL SDK） |
| ARTEX | fact/intent 图；内容寻址证据；steer/kill；防绕过措辞 | `agent/planner.go:355-382,121-127`、`evidence/store.go:43-115`、`guard/guard.go:57-138` | AGPL-3.0 |
| antares | 阶段×情报完成度门控；审批超时拒；危险命令预检；roleperf | `internal/engagement/phase.go:31-95`、`agent/approval.go:81-233`、`roleperf.go:127-146` | Apache-2.0 |
| xalgorix | ledger ClaimNext；completion/finish gate；预算继承；OOB 归因 | `scanctx/ledger.go:218-412`、`agent/completion.go:46-122`、`agent/agent.go:698-729`、`agent/oob_verify.go:42-145` | Apache-2.0 |
| T3MP3ST | PackBoard 租约；refuter 票决+引用校验；provenance gate；三态 retest | `src/pack/board.ts:118-300`、`mission/adjudicate.ts:95-116,466-553`、`evidence/gate.ts:18-45` | AGPL-3.0 |
| VulnBot | 任务 DAG 拓扑；每步判成功并重写计划；长输出摘要 | `db/models/plan_model.py:37-70`、`actions/planner.py:25-70`、`roles/role.py:44-50` | MIT |
| HackSynth | 滚动摘要；`<CMD>`+timeout+quote；观测截断 | `pentest_agent.py:194-218,69-99` | AGPL-3.0 |
| Pentest-Swarm-AI | pheromone 衰减；验证成本阶梯；Ed25519；注入检测 | `blackboard/memory.go:109-260`、`swarm/verify/verify.go:101-330`、`provenance.go:71-83` | AGPL-3.0 |
| Decepticon | OPPLAN 波次；USD fail-closed；HMAC 证据链；正负对照验证 | `middleware/opplan.py:254-396`、`budget.py:12-360`、`tools/evidence/tools.py:136-250`、`tools/verification.py:18-80` | Apache-2.0 |

### A2 验证/守卫/治理

| 项目 | 独有可吸收点 | 证据 | 许可 |
|---|---|---|---|
| Cairn | 状态签名触发 reason；图谱落文件；强制收口 | `dispatcher/scheduler/loop.py:704-718`、`tasks/common.py:56-70`、`tasks/explore.py:241-380` | AGPL-3.0 |
| redamon | 声明审计；异常检测；证据哈希失效；head/tail stub | `orchestrator_helpers/productivity.py:126-300`、`cypherfix_triage/evidence.py:360-399`、`output_offload.py:88-145` | MIT |
| hexstrike-ai | RecoveryAction 阶梯；错误分类；LRU/TTL；工具选型评分 | `hexstrike_server.py:1558-1613,1961-1981,5091-5213,572-640` | MIT |
| pentestagent | notes 证据记忆；ShadowGraph；worker 池；Docker 沙箱 | `tools/notes/__init__.py:151-162`、`knowledge/graph.py:66-91`、`agents/crew/worker_pool.py:51-94` | MIT |
| Dark-Moon | 隐私 vault；位置感知再水化；预检+可行动拒绝；白名单 | `privacy/vault.py:227-505`、`privacy/gateway.py:94-121`、`execution_guard.py:174-223` | GPL-3.0 |
| VulnClaw | exec-policy 分类器；三模式闸门；NO_PATH near-miss；reflexion | `agent/command_classifier.py:127-156`、`exec_gate.py:157-170`、`solver.py:322-372`、`reflexion.py:47-105` | MIT |
| APTS | L1-L4 自治；降级矩阵；证据包 manifest；不可信靶侧内容 | `4_Graduated_Autonomy/README.md:5,49-66`、`Autonomy_Downgrade_Matrix_Template.md:34-100`、`Evidence_Package_Manifest.md:24-104` | CC BY-SA 4.0 |
| NetworkAttackSimulator | 类型化 ActionResult；动作掩码；前置映射 | `nasim/envs/action.py:541-651`、`environment.py:412-429` | MIT |
| SoL-Pi | Action Fusion；ObservationPack；逐字节收据；压缩经济学 | `action-fusion/index.ts:85-120`、`observation-pack/index.ts:40-90`、`receipt.ts:82-144`、`economics.ts:129-180` | MIT |

### A3 Agent 内核 / 自进化

| 项目 | 独有可吸收点 | 证据 | 许可 |
|---|---|---|---|
| deepseek-harness | steer/inject 分流；80%/16% 压缩；preset 组合清单 | `agent-loop/src/agent.ts:154-173`、`inbox.ts:109-113`、`compaction-basic/src/index.ts:194-232` | MIT |
| harness2 | 候选树校验；预算恒等式；失败回退；confounded 教训 | `core/tree.py:336-390`、`core/ledger.py:26-35,89-114`、`core/selection.py:237-252`、`core/prompts.py:1126-1147` | Apache-2.0 |
| pi | steer/followUp 双队列；reserve/keepRecent 压缩；branch_summary | `agent-session.ts:320-321`、`compaction.ts:122-129`、`branch-summarization.ts:1-35` | MIT |
| openclaude | coordinator fan-out；压缩熔断；记忆索引限行 | `coordinatorMode.ts:111-213`、`autoCompact.ts:93-135`、`memdir.ts:36-39,247-249` | **衍生未授权（禁用）** |
| trpc-agent-go | 三层 gate；holdout；Pareto 父代；原子 rollback；swarm 限交接 | `evolution/gates.go:134-173`、`engine.go:61-65,122-130`、`pareto.go:81-100`、`approval_service.go:295-342` | Apache-2.0 |
| SkillOpt | 三态 gate；编辑预算；三种更新模式；失败缓冲 | `evaluation/gate.py:135-225`、`optimizer/clip.py:25-108`、`update_modes.py:6-39`、`engine/trainer.py:568-622` | MIT |
| dgm | keep_better+0.1 宽限；父代选择；代数上限；Docker 沙箱；阈值追加评测 | `DGM_outer.py:174-190,84-100,222-241`、`self_improve_step.py:152-178,263-353` | Apache-2.0 |
| AutoHarness | 单文件单改；write_self 原子验证；备份；构建/测试门；goal judge | `src/prompts/evolve_system.txt:3,21`、`src/main.rs:200-211,893-1004,145-154` | **无 LICENSE（禁用）** |
| OpenHands | profile 级 condenser；验证开关；事件去重；goal 状态 | `src/routes/condenser-settings.tsx:7-16`、`verification-settings.tsx:18-23`、`stores/event-message-store.ts:10-24` | MIT |

### A4 工作台 / UI / 工程化

| 项目 | 独有可吸收点 | 证据 | 许可 |
|---|---|---|---|
| ZCode | DESIGN.md 单源；插件 manifest 分组；双层压缩；计划审批 | `DESIGN.md:5-12,236-245`、`plugin-components.ts:28-55`、`compact/policy.ts:5-28`、`microcompact.ts:14-25` | Apache-2.0 |
| grok-build | 流式 markdown 冻结；segment+INDEX；计划评审；贴底跟随 | `xai-grok-markdown/src/streaming.rs:1-20`、`xai-compaction-transcript/src/lib.rs:20-50`、`plan_approval_view.rs:49-68` | Apache-2.0 |
| Dify | 三层 token；暗色覆写；streamdown；滚动阈值；IME 防误发 | `tailwind-core.css:18-25`、`manual-dark.css:1`、`use-chat-layout.ts:33,138`、`chat-input-area/index.tsx:118-210` | 修改版 Apache |
| OpenAgentsControl | approval_gate 硬门禁；事件流评测；UI 规范单源；组件注册表 | `opencoder.md:53-65`、`EVAL_FRAMEWORK_GUIDE.md:60-66`、`design-systems.md:1-30` | MIT |
| deadend-cli | 上下文预算分层；ADaPT 任务树；待审批挂起；XBOW 基准 | `context_engine.py:470-512`、`planner.py:14-33`、`event_bus.py:17-47` | AGPL-3.0 |
| open-claude-ui | token 单源；token CI；滚动钉扎；MCP 决策卡 | `cds-theme.css:7-40`、`check-tokens.mjs:1-8`、`useClaudeScrollPinning.ts:16-64`、`McpToolDecisionCard.tsx:44-60` | MIT |
| celeris-web | 色阶生成；暗色适配；系统/色弱开关 | `themeUtils.ts:24-70`、`useThemeSetting.ts:20-40` | MIT |
| chatgpt-web | 滚动阈值；markdown 管线 | `useScroll.ts:21-33`、`Text.vue:30-39` | MIT |
| reverser_ai | 受限函数命名 prompt；宿主 Settings 桥；HLIL 输入 | `function_name_gpt.py:26-52`、`wrapper.py:30-70` | GPL-2.0 |

---

## 8. 附录 B：反模式（不要吸收）

- 「exhausted ≠ done」把失败当完成；必须显式 blocked（ARTEX/pentagi 教训）。
- 工具自声明安全（模型说 safe 不等于安全）；闸门不得接受模型标签降级（VulnClaw `exec_gate.py:157-170`）。
- 参考文档当证据：read_reference 只提供方法，finding 必须引用样本证据 E-id。
- 全量工具平铺 / 40 域 scorecard 仪式（既有调研已排除）。
- 多进程 Team / 远程成员（experimental agent-team 明确不支持）。

## 9. 附录 C：脚本 / 模板 / 字典来源清单（recon · PoC · 挖掘）

> 结论：**没有一个可直接 vendor 的「安全脚本库」**；可用的是「解析器契约 + recipe 结构 + 验证器结构」，以及可选的本机 CLI。代码按许可分三类处理。

| 来源 | 内容与规模 | 许可 | 用法 |
|---|---|---|---|
| **helm-d 自家 scripts/** | 86 文件（63 py）：`evidence/` 12、`native/` 36、`android/` 16、`web/` 7、`protocol/` 3、`malware/` 3、`ai-security/` 4 | AGPL-3.0（自有） | **直接扩展**：新增 `scripts/recon/` 与 `scripts/poc/`，沿用 `runSeam` 与证据落盘 |
| **redamon `recon/` + `mcp/servers/`** | 1502 脚本；`mcp/servers` 5919 行（network_recon_server 1693、metasploit_server 1257、nuclei_server、nmap_server、playwright_server、terminal_server）；`recon/` 含 domain/port/resource/cache/graphql 扫描与解析 | **MIT** | **借解析器契约**（nmap XML/httpx/nuclei JSONL → 统一资产记录）；不搬 Neo4j/Kali 绑定 |
| redamon `recon/wordlists` + `mcp/nuclei-templates` | 小字典目录；nuclei 模板仅 9 个 yaml（68 KB） | MIT | 可作**最小内置样例**；完整 nuclei/SecLists 需本机可选路径，不打包 |
| **Pentest-Swarm `internal/poc/recipes.go`** | 按漏洞类别的 recipe 结构：`Class / SafeProof / Indicator / Hints`（BOLA、SQLi、XSS、SSRF、RCE、auth-bypass…） | **AGPL-3.0** | **零复制**；用同样字段重写成 helm-d `scripts/poc/recipes/*.json`（文案自写） |
| **VulnClaw `report/verifier.py`** | 757 行三态验证器；`skills/` 有 Android 签名、浏览器请求链、OSINT 报告、SSTI 等参考模板 | **MIT** | 借**三态判定 + 模板分类**；实现重写 |
| **ARTEX `skills/api-recon/scripts`** | 6 个可执行脚本：`harvest_static.py`(8.5K)、`spider_mpa.py`(5.8K)、`runtime_harvest.js`(11K)+`preload.js`(13K)、`extract_route_map.py`、`build_perm_tree.py`；依赖 puppeteer-core | **AGPL-3.0** | **零复制**；借「静态收割 + 运行时注入 + route map/perm tree」思路，用 Playwright/Node 重写 |
| **T3MP3ST `src/arsenal/`** | 149 KB index + 44 KB catalog + 28 KB parsers + `idor.ts`/`js-analyze.ts`/`browser.ts`/`kev.ts` | **AGPL-3.0** | 借「catalog → parser → 攻击图」契约；零复制 |
| **Decepticon `capabilities/` + `tools/`** | 正负对照验证、证据 HMAC 链、PoC Docker 执行 | Apache-2.0 | 借判据与字段；Docker 层不引入 |
| **Dark-Moon `execution_guard.py`** | 命令预检分类 + 可行动拒绝 + 超时夹紧 | GPL-3.0 | 零复制；判据重写进 PoC 执行器 |
| **DSH 宿主** | 无安全脚本库；提供 `web_fetch`（GET/无 header）、shell、MCP client、subagent/workflow | MIT/Apache | 只做执行/编排底座；recon/PoC 语义必须自补 |

**取舍**：
1. 首版不打包任何大字典/模板库（体积 + 许可 + 更新负担）；内置最小字典（<100 行）与 recipe 模板。
2. 外部 CLI（nmap/httpx/naabu/nuclei/katana/ffuf）作为**可选 enrichment**，探测不到就降级为纯 Node/Python 实现（DoH、connect scan、HTTP 基线、小字典）。
3. AGPL/GPL 来源只重写结构与判据；MIT/Apache 可参考实现但按仓库规范仍以自写为准，引用需署名。
4. 所有脚本输出统一走 `save_evidence`（sha256 去重）与 scope 围栏，不新增第二套数据层。

## 10. 附录 D：净新增能力探索池（未排期；排除已有功能与 T-01…T-16）

> 排除项：case/evidence/finding 注册表与定级、team 协作、进化 gate、recon/PoC/挖掘、UI/审批/上下文压缩——这些已在实现或 T-01…T-16。下表是**仍然没有的新能力**。

| ID | 能力 | 参考来源（证据） | 为什么值得 | 代价 | 建议 |
|---|---|---|---|---|---|
| N-01 | **本地混合检索（BM25 + rerank）** 覆盖 references + case evidence | VulnBot RAG+rerank（`server/chat/chat.py:76-100`）；pentestagent ShadowGraph（`knowledge/graph.py:66-91`）；T3MP3ST code-ingest（`code-ingest.ts:832`） | 现在 `read_reference` 只能按路径读；362 篇 + 证据无法语义检索 | 中：索引构建 + 纯本地 BM25，可选 embedding | P1 |
| N-02 | **HTTP 捕获/重放/差分** | redamon `traffic_tools.py:330`（proxy_to_curl）、`:293`（proxy_diff）；ARTEX `finding_traffic.go:364` | PoC/复现/回归都缺原始请求回放；HAR 只解析不重放 | 中：本地代理或 HAR 导入 + 回放器 | P1 |
| N-03 | **攻击图 / kill-chain 组合** | T3MP3ST `attack-graph.ts:47-52,106-196`；Swarm `internal/attackgraph/graph.go:15-104`、`build.go:20`；Decepticon `kg_internal/summary.py:52-98` | T-14 只做资产清单；缺"资产→finding→下一步"的路径评分 | 中：图结构 + 路径打分 | P1 |
| N-04 | **独立 verifier / 模型议会** | T3MP3ST refuter 3 票（`adjudicate.ts:95-116,466-553`）；xalgorix verifier 三态（`verifier.go:48,215`）；Decepticon verifier agent（`finding_verifier.py:22`） | 现在 critic 与 worker 同模型；high/critical 缺独立复核 | 低-中：可先做多轮独立复跑，再做多模型 | P1 |
| N-05 | **跨会话经验库（lessons）** | harness2 教训库（`core/library.py:19`、`prompts.py:1126-1147`）；openclaude memdir 限 200 行/25KB（`memdir.ts:36-39,247-249`，**仅概念**）；dgm 自知识提示 | 没有"这类目标为何失败"的经验复用（旧 tool_memory 已删除，且它只记工具） | 低：按 case/域存 lesson + 检索注入 | P1 |
| N-06 | **计划复用 / 成功路径缓存** | 论文 2512.21309；SkillOpt best_skill（`trainer.py:568-622`）；dgm archive（`DGM_outer.py:174-190`） | 每次从零规划；同类任务重复试错 | 中：plan 模板 + 适用条件 + 命中率 | P2 |
| N-07 | **本地安全基准/回归语料** | deadend XBOW 流程（`benchmarks/run_xbow_benchmark.sh:1-15`）；HackSynth `run.py:29-52`；NASim `environment.py:143-228`；dgm 阈值追加评测（`self_improve_step.py:152-178`） | team-eval 只有指标，没有固定任务语料；进化无法防回归 | 中：fixtures + 判据 + CI 任务 | P1 |
| N-08 | **OPSEC / 出站策略** | T3MP3ST `opsec/index.ts:50-75,235`；红队 stealth profile（redamon `recon_settings/loader.py:174-191`）；hexstrike 参数改写（`:4837`）；xalgorix 限速（`ratelimit.go:21-87`） | recon/PoC 有 scope/限速但没有 UA/jitter/egress 策略 | 低：执行器统一策略对象 | P2 |
| N-09 | **隐私/密钥脱敏网关** | Dark-Moon vault（`privacy/vault.py:227-505`）、位置感知再水化（`gateway.py:94-121,347-446`） | 证据/日志会把凭据原样落盘；现有 `redact_capture.py` 未接入 | 低-中：证据写入前脱敏 + 可逆映射（仅本机） | P1 |
| N-10 | **技能包/本地注册表** | ZCode manifest 分组（`plugin-components.ts:28-55`）；OpenAgentsControl registry（`registry.json:11-30`）；Dify skills | references 是散文档；缺 skill 清单（触发词/工具/参考/评测） | 中：manifest + 本地目录 | P2 |
| N-11 | **成本核算（token/费用）** | Decepticon USD 预算 fail-closed（`budget.py:12-360`） | T-05 只有 wallTime/toolCalls；没有每角色 token/费用 | 低：从流式用量累计 | P2 |
| N-12 | **自生成评测任务** | AgentEvolver self-questioning（README，未克隆）；dgm 阈值追加；harness2 propose-probe | 进化 gate 缺"新题"；固定集容易过拟合 | 高：题目生成 + 期望答案校验 | P3 |
| N-13 | **信任标签 / 操纵抵抗** | APTS 靶侧内容不可信（`6_Manipulation_Resistance/README.md:74-100`）；T3MP3ST benign-context 分解 | 工具输出/参考文档未标注信任级；注入面存在 | 低：证据/参考加 trust 标签，finding 拒绝无标签引用 | P1 |
| N-14 | **跨 case 检索与关联** | ARTEX 全局资产、redamon 全局图、DSH session search | case 之间完全隔离，同类目标经验不可见 | 中：case 索引 + 只读搜索 | P2 |
| N-15 | **浏览器运行时面（SPA）** | redamon `playwright_server.py`；ARTEX `runtime_harvest.js`+`preload.js`；T3MP3ST `browser.ts` | 静态 fetch 看不到 SPA/JS 路由；recon/PoC 都受益 | 中-高：Playwright 本地依赖 | P2 |
| N-16 | **执行隔离（网络/进程）** | Decepticon Docker（`bash.py:446`）；Swarm LocalRunner（`runner.go:140`） | DSH sandbox 只限文件写，无 netns/容器 | 高：Windows 容器/受限账户工程 | P3 |

**净新增优先级建议**：N-01 检索 → N-07 基准 → N-04 独立 verifier → N-09 脱敏 → N-13 信任标签（都是低成本、直接补质量门）；N-02/N-03/N-15 依赖 recon/PoC 任务落地后再做；N-05/N-06/N-10 属于效率层；N-12/N-16 成本最高，最后评估。
