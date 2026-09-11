# 建议账本与核销（Advisory Ledger）

> 凡注入给模型的指导（hook 指令、route_task 卡片、模式契约）都带一条**可机检的采纳签名**；
> 下一轮装配时对照会话事件核销，把「有没有照做」落成账本，反复不采纳的降频而非无限重复。

| 当...时 | 使用本节 |
|---------|---------|
| 想知道某条提示到底有没有生效 | §1 两条角色 |
| 自己写 hook / 工具要注入指导 | §2 提交 |
| 需要读采纳率 | §3 账本与降频 |

---

## 1. 两条角色（别混）

| 角色 | 例子 | 是否进 prompt | 是否降频 |
|------|------|---------------|---------|
| **投递型** | 拒绝信号 → H-CoT 指令 | 是（渲染为 section） | 是（`ignored ≥ 3` 降频） |
| **仅计量型** `trackOnly` | `route_task` 的 PRIMARY 卡片 | 否（卡片本身已投递） | 否（每次调用都是一次事实） |

判据：**这句话是"反复提醒"还是"一次性事实"？** 前者投递并降频，后者只计量。
把一次性事实丢进降频通道 = 忽略 3 次就不再告知，方向反了。

## 2. 提交（producer 侧）

```ts
submitAdvisory(sessionId, {
  key: 'hcot-on-refusal',            // 同 session 同 key 只留一条
  tier: 'mandatory',                 // mandatory 永不降频；recommended / hint 会
  content: '<要注入的正文>',
  proof: { kind: 'tool_called', tools: ['hcot_attack'] },  // 采纳签名
  withinTurns: 1,                    // 超过 N 个 assistant 回合仍未命中 → ignored
  trackOnly: false,                  // 设计量型就置 true
}, atEventCount)
```

`proof.kind`：`tool_called` / `finding_recorded` / `case_opened` / `evidence_saved` / `reference_read` / `mode_set`。
无 `proof` = 只记送达（`delivered`），不计入降频。

## 3. 核销与账本

- 核销点：`system-prompt/assemble`（与 bootstrap 同源读 `agent.session.events`）。
- 逐条判定：窗口内命中 `proof` → `adopted`；窗口内未命中 → `ignored`；无 `proof` → `delivered`。
- 账本：`~/.dsh/helmd-tools/advisories.jsonl`（`HELMD_TOOLS_DIR` 可改），一行一次核销。
- 降频：同 key `ignored ≥ 3` 且 `tier ≠ mandatory` → 不再渲染（`route_task` 卡片显示 `已降频`）。

> 目的不是"多发提示"，而是**让每条提示背 KPI**：adopted 的留下，ignored 的退场。

---

## 4. 回复级签名（度量"姿态"，不只度量"动作"）

`proof` 除工具动作外，还支持直接判定**助手回复**：

| kind | adopted 条件 |
|------|--------------|
| `reply_avoids` | 观察窗内的助手回复**不含**任一 marker |
| `reply_shows` | 观察窗内的助手回复**含**任一 marker |

已接两条常驻指标（均 `trackOnly`：不进 prompt、不降频）：

| key | 量的纪律 | 触发 | adopted |
|-----|---------|------|---------|
| `stance:no-hedge` | **交付**（破甲） | 每轮 | 回复无拒绝/软化话术 |
| `stance:challenged` | **质疑前提**（反迎合） | 用户消息形如断言（绝对词 / 带单位数字 / 明确要求挑错） | 回复含异议标记（前提、不成立、证据不足、核不到…） |

露出点：`route_task` 卡片、`case_status`、`end_case` 三处都带 `[建议采纳率]`，不依赖单一路径。

> **marker 要窄**：`无法核实来源` 是"质疑前提"纪律**要求**的表达，所以裸 `无法/不能` 不能算 hedge，只有 `我无法协助 / 抱歉，我 / 建议改用 / I cannot assist` 这类**拒绝交付**话术才算。
