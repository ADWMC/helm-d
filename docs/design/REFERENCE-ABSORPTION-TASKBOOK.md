# 参考项目吸收任务书（Reference Absorption Taskbook）

> **状态**：待评审（2026-11-04 起草，未开工）
> **来源**：`C:\Users\Administrator\Documents\GitHub\About-my-name\refs`（34 个登记项目，37 个目录）的**源码级**二次调研；每条机制带 `文件:行号`。
> **与既有文档的关系**：[REFERENCE-PROJECTS-SURVEY.md](REFERENCE-PROJECTS-SURVEY.md) 是分簇动机与 12 条机制；[REFERENCE-SCORING-AND-EXPANSION.md](REFERENCE-SCORING-AND-EXPANSION.md) 是评分与五条最高价值；本文是**可执行任务书**（任务/落点/验收/许可），不重复评分过程。
> **许可纪律**：AGPL / GPL 项目代码零复制，只吸设计与判据；无 LICENSE 项目禁用（见 §7）。
> **前置状态**：Team v2 Phase 1 已落地（宿主原生 agent-team、roleDeps、反假装门禁、27 checks），本任务书在其上继续。

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
| 落点 | `persist.ts` + `autonomy.ts`：用真实 `tool/call` 轨迹统计（session-log）——同一 tool+args 连续 ≥3 次且证据无新增 → autonomy packet 顶部硬提示 NO_PATH + 建议换路径；与 `tool_memory` deadend 联动 |
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

### T-12 工具选型评分 + 缓存（P2）

| 项 | 内容 |
|---|---|
| 机制来源 | hexstrike-ai 按目标画像工具效能评分（`hexstrike_server.py:572-640`）+ 命令 TTL/LRU 缓存（`:5085-5140`）；ZCode 插件 manifest 分组枚举（`plugin-components.ts:28-55`） |
| 落点 | `tool_recommend`/`tool_memory` 货架增加 successRate/latency/最近使用；同一命令短 TTL 缓存（仅本地只读命令） |
| 验收（单元） | 缓存命中/过期；评分按最近成功率排序 |
| 验收（真机） | 重复只读命令第二次为缓存命中且证据仍落盘 |
| 许可 | MIT → 语义吸收 |

---

### T-13 漏洞登记 + 定级（P0，**已落地**）

| 项 | 内容 |
|---|---|
| 机制来源 | ARTEX findings 表 + critical/high/medium/low + 9 态 triage（`db/findings.go:39-78`）；xalgorix CVSS→severity + 弱证据降一级（`internal/tools/reporting/reporting.go:3512-3531,777-798`）；Decepticon critical/high 需 2+ 验证方法 + confidence 独立轴（`decepticon_core/types/engagement.py:102-125`）；T3MP3ST provenance 封顶 + `assertedSeverity`（`src/operators/index.ts:723-745`）；VulnClaw `vuln_type+location` 去重（`config/domain_models.py:266-289`）；anatares 同 title+target 自动 duplicate（`internal/findings/findings.go:129-181`） |
| 落点 | `case.ts`：findings.json 注册表 + `recordFinding/updateFinding/severityCounts`；`tools/caseflow.ts`：`record_finding` 新参数 + `update_finding` 工具 + case_status 统计；`client.js` Case tab severity/status 徽章与计数 |
| 验收（单元） | `finding-registry.check.mjs` 7 项：单证据 critical 降级 / 双证据 critical 通过 / CVSS 覆盖 + asserted 审计 / unverified 封顶 / 同键合并 / 状态流转 + 非法枚举 / 旧 findings.md 兼容 |
| 验收（真机） | 定级注册测试：CVSS 覆盖、同键 merge、单证据降级原文、update rejected、case_status 统计行 |
| 状态 | **已实现（2026-11-04，28 checks PASS）**；剩余：UI 状态编辑按钮、SARIF/报告导出（未做） |
| 许可 | AGPL（ARTEX/T3MP3ST）/ Apache（xalgorix/Decepticon）/ MIT（VulnClaw/antares）→ 判据吸收 |

## 3. 顺序与依赖

```text
Sprint 1（并行两条线）:
  Team 线:   T-01 实时纠偏   +   T-03 任务 DAG
  Evidence 线: T-02 审计升级 +   T-04 NO_PATH 守卫
Sprint 2:
  T-05 预算/finish gate  →  T-06 证据版本绑定  →  T-07 进化 gate 强化
Sprint 3:
  T-08 上下文纪律  →  T-09 审批 fail-safe
Sprint 4:
  T-10 UI 工程化  →  T-12 工具评分/缓存  →  T-11（先补证）
```

依赖：T-07 依赖 T-02 的审计字段；T-06 依赖 T-02 的证据元数据；T-05 依赖 T-03 的 task 预算归属。

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
