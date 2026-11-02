# 多 Agent 协作 + 进化（本地）

## 来源与结论

对照了 `dsh-superagent-prototype` 与 `system_prompts_leaks` 中可参考的公开系统提示词模式：

- **Cursor subagent-debug**：先提 3-5 个假设 → 加运行时日志 → 让调用方复现 → 用日志确认/否定 → 只有 100% 证据才修；修复后保留 instrumentation，验证通过再清理。
- **Cursor Task / Copilot 子代理**：主 agent 从“执行者”变成“工程经理”；子代理按类型分工（explore / shell / browser / debug），委派后拥有该范围；子代理失败则主 agent 自己做；explore 无状态，必须每次给完整上下文。
- **Perplexity Model Council**：并行跑多个独立模型，最终产物是“一致/分歧/差异”的合成，不是单模型答案。
- **Claude Code / MiniMax / Kimi memory**：记忆有 scope（user / agent / project），只在明确需要时写；不能把“提到过”当成“要求记住”。
- **superagent**：orchestrator / worker / subagent + ticket / assignment / report / handoff；prompt、team section、skill、role model 都有版本化与历史，但**没有自动进化引擎**。`src/core/memory.ts` 只是内存 Repository。

结论：协作可以直接移植 superagent 的角色/工单/报告/交接模型；进化必须基于其“版本化 prompt/role model/skill”机制补一个本地 eval gate，不能声称已有自动进化。

## 本地协作模型

角色：

| 角色 | 职责 | 边界 |
|---|---|---|
| Orchestrator | 分诊、计划、分配、汇总 | 只看摘要/卡片，不读原始 canary 样本 |
| Triage | 格式/防御原语/预算 | 只读 |
| Static | 反混淆、结构、静态证据 | 不执行样本 |
| Dynamic | 沙箱执行、trace、dump、差分 | 只在本地沙箱/受限权限 |
| Decoy Audit | canary/假架构/死代码/预算异常 | 独立审计，不产生结论 |
| Critic | E-id/repro/双源校验，可否决 | 只读证据 |
| Reporter | 汇总报告 | 不新增结论 |

协议：

```text
case -> ticket -> assignments(role, session)
worker -> report(role, state, evidenceIds, repro, budget)
worker -> handoff(question) -> orchestrator
critic -> approve/reject finding
reporter -> final report
```

- Ticket = 一个 case；assignment = 一个本地 worker 会话；worker 之间只通过 case 的 evidence 账本共享。
- static/dynamic/decoy 可并行；critic 串行；并发由本机 CPU/内存/模型配额控制。
- 预算耗尽/解析失败 = 结构化 blocked，换 parser/worker，不无限重试。

## 进化模型

版本化 artifact：

- `role-prompt` / `playbook` / `skill` / `model-profile` / `budget-policy` / `tool-policy`
- 每项有 revision、parent、value、source、eval；存本地 `team/versions.json`。

Loop：

1. Collect：case 报告、critic 否决、canary 误报、预算/耗时、blocked 原因。
2. Propose：Evolver 只提出 artifact diff；不改代码、不改宿主。
3. Evaluate：本地 benchmark A/B；指标 = correctness、evidence、canaryResistance、blockedHonesty、tokens、wallTime。
4. Gate：关键指标无回归 + 至少一项改善 + token 不超预算；否则拒绝。
5. Activate：写 active revision；**新会话**绑定新 revision，运行中会话不变。
6. Rollback：保留 history，可回退。

安全边界：进化只改策略/提示/模型/预算，不放松证据门禁，不允许 worker 修改自己的权限或评估标准。

## 当前落地（Phase 0/1a/1b/3 核心）

已实现：

- `packages/helmd/src/team.ts`：本地 ticket/assignment/report/handoff 状态机；版本化 artifact + eval gate + activate/rollback；跨 worker 的锁文件串行化写；`sessionRole()` 反查 worker 角色。
- `packages/helmd/src/team-worker.ts`：通过宿主 `ctx.subagents` 的 `spawn`/`fork` provider 创建本地 child Agent；prompt 由 ticket 第一次 dispatch 时钉住的 revision 组装；结果自动回写 report；失败/超时/abort 也回写 failed；默认 `delivery: parent` 通知 orchestrator。
- `packages/helmd/src/tools/team.ts`：`team_dispatch` 模型工具；只有 orchestrator 能派工。
- `packages/helmd/src/team-policy.ts`：worker 不能 `team_dispatch` / `begin_case` / `end_case`，防止子角色越权开/关父 case 或继续分裂 worker。
- `GET/POST /api/helmd/team`：读取/创建 ticket、写 report/handoff、分配/关闭 ticket；`action:start` 从当前 live session 启动 worker。
- `GET/POST /api/helmd/team/versions`：提出/评估/激活/回滚 artifact revision。
- `packages/helmd/src/team-eval.ts` + `scripts/team-eval.mjs`：本地 A/B harness，消费真实 worker 运行记录（JSON），算六项 gate 指标；pass 后才能 activate。用法：
  ```bash
  pnpm team:eval --baseline before.json --candidate after.json
  pnpm team:eval --baseline before.json --candidate after.json \
    --kind role-prompt --id static --revision 3 --activate
  ```
  记录格式见 `team-eval.ts` 顶部注释；没有真实运行记录时不会生成指标。
- `client.js`：工作台新增 Team tab（ticket、角色、启动、报告、revision、activate/rollback）。
- `scripts/checks/team.check.mjs`：ticket 状态、worker 适配（fake runtime）、失败回写、无 provider 报错、eval 指标。
- `scripts/checks/team-eval.check.mjs`：CLI 正/负例与 activate 门禁。
- `scripts/checks/api-routes.check.mjs`：真实 HTTP 路由创建 ticket + 启动 worker + 回写 report。

当前边界（必须如实说明）：

- **worker 确实走宿主 child Agent**，但测试使用 fake `subagents` runtime；尚未用真实模型对 BLA/VMProtect 样本做端到端跑分。
- `spawn` provider 不接受 per-child tool filter，所以角色隔离目前是“协议 + 三条硬边界”，不是完整工具白名单；完整白名单需要独立 preset 或宿主能力。
- 没有本地沙箱 preset：dynamic worker 的隔离继承父会话的 DSH sandbox/permission；不能声称已实现独立沙箱。
- `team-eval` 不会自己跑模型；它只接受真实运行记录。没有记录时不能伪造 A/B 指标，也不能激活 revision。

下一步：

- Phase 2：static/dynamic/decoy 的真实样本运行、预算/canary quarantine、`adversarial.yaml`、独立 sandbox preset。
- Phase 3 剩余：把 worker 真实运行自动落成 eval record，减少手工 JSON。
- Phase 4：单机效率对比（1/2/4 worker），只有指标改善才默认并发。

## 非目标

- 不引入 GitHub/Feishu/PR/外部面板/外部账号/外部服务。
- 不复制泄漏提示词原文；只使用公开模式作设计参考。
- 不让模型自动修改代码或工具权限；进化只作用于本地 artifact。
