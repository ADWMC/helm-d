# 自主逆向执行设计（DSH 插件 + 调度/模型特调参考）

> **文档定位**：[总方案](MASTER-PLAN-PRO-RE-PENTEST.md) 的执行细节；冲突以总方案为准。不接外部 MCP；ZCode 只作调度/模型特调参考。
> **状态**：Sprint 1 账本/门禁 + L3 自主状态包已实现；L4 为 advisory 调度 nudge，完整自主引擎不在范围内。

---

## 实现状态（2026-10-27）

已实现：

- case / hypothesis / evidence / finding / end_case 账本与门禁；同一时间只允许一个 open 假设。
- `case_status` 的 `[autonomy]` 段：完整假设链、findings、evidence、dead ends、playbook、next action、warnings。
- `record_finding` 新增 `repro_cmd`；DEEP 模式关案要求每条 finding 都有 repro。
- `route_task` / `case_status` 返回 playbook 路径；`references/index.md` 暴露 playbooks。
- `persist.ts` 在每次工具结果后按 case 状态提交 advisory next action（L4-lite 调度，不是 gate）。
- hypothesis / tool_memory 等账本工具的输出现已排除在自动 evidence 之外，避免证据噪声。

未实现 / 剩余：

- coverage / unknowns 独立账本（当前由 warnings + next action 软提示，不硬性阻止关案）。
- 完整自主调度器 / 子代理编排：DSH agent loop 仍是执行者，helm-d 只提供状态与提醒。
- 真实模型端到端自主验收：当前无 API key，未跑完整 case。

## 0. 一句话

**自主逆向 = DSH 的 agent loop 自主调用工具 + hypothesis ledger 迫使模型先想再跑 + `end_case` 硬门强制"没证据不许关"。**

helm-d 不写 loop；它把"自主"变成**可审计的假设链**。

---

## 1. 边界

| 能力 | 归属 | helm-d 做什么 |
|---|---|---|
| agent loop / turn / step | DSH 宿主 | 不实现 |
| 模型 provider / 流式 / 重试 | DSH 宿主 | 不实现；按模型能力调整参考深度 |
| 审批 / 权限 / 沙箱 | DSH 宿主 | 不实现 |
| session / 压缩 / checkpoint | DSH 宿主 | 不实现 |
| **假设管理** | **helm-d** | `record_hypothesis` / `update_hypothesis` |
| **证据/结论** | **helm-d** | E-id + `record_finding` + 报告 |
| **工具面** | **helm-d** | 33 个工具（llm_probe 已删） |

---

## 2. 假设驱动的自主决策

不是"照着 playbook 跑脚本"，是：

```
模型观察证据 → 自己形成假设 → 自己设计测试 → 自己裁决 → 自己决定下一步
```

### 场景：加壳 PE

```text
shell: file + objdump -h → 段名 UPX0, 熵 7.8
model: "这是 UPX 壳"
  record_hypothesis(H-001, "UPX 加壳", test="upx -d")
  shell: upx -d → 成功
  update_hypothesis(H-001, confirmed, evidence=["E-001","E-002"])

shell: strings unpacked → WinExec, socket, connect
model: "dropper + reverse shell"
  record_hypothesis(H-002, ...)
  shell: strings | grep C2 → 找到
  update_hypothesis(H-002, confirmed, evidence=["E-003"])

shell: echo base64 | base64 -d → PowerShell downloader
  record_hypothesis(H-003, ...)
  update_hypothesis(H-003, confirmed, evidence=["E-004"])

  record_finding("UPX dropper + reverse shell", repro_cmd="...", evidence=[...])
  end_case(summary="...")
```

**没有 playbook gate 告诉模型"第 3 步查字符串"。模型自己推理。**

---

## 3. 工具

```ts
record_hypothesis({ statement, expected, test_cmd, evidence_ids? }) // → H-xxx
update_hypothesis({ id, status: 'confirmed'|'refuted'|'blocked', observation, evidence_ids })
```

规则：默认最多 1 条 open；confirmed 必须有 observation + E-id；3 次同签名失败 → blocked + dead-end。

---

## 4. ZCode 调度/模型特调（不接网关）

| ZCode 机制 | helm-d 落点 |
|---|---|
| parallelGroups + concurrentSafe | DSH 原生 `isConcurrencySafe` |
| timeoutMs 按工具 | DSH `defineTool.timeoutMs`（需 timeout-policy） |
| stopTurnAfterResult | 宿主负责 |
| 失败不连坐 | 不写"失败即停" |
| 子代理模型选择 | 显式模型/预算 |
| Strict schema 首方 Anthropic only | 工具 schema 不用 `$defs` |
| Reasoning 归一 | 不塞 reasoning |
| 失败分类表 | `llm-stream-hook` 分类 |
| 重试预算 | 拒答走 stream-hook；网络走分类 |

**不使用** ZCode 网关、Provider 配置、app-server、密钥。

---

## 5. Model Profile

| profile | 假设上限 | 参考深度 | 重试 |
|---|---|---|---|
| compact | 1 | 1 篇 | 1 |
| standard | 1 | 1–2 篇 | 2 |
| deep | 3 | 多篇 | 3 |

---

## 6. 一句话

**自主逆向不是"写一个会自己跑循环的 agent"，而是"让 DSH 的 agent 在 hypothesis ledger 驱动下自己推进；每一步要么有证据，要么明确 blocked"。**
