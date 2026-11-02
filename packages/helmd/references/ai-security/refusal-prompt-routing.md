# 拒答恢复提示词路由

该路由用于真实 `llm/stream` 请求的受控恢复和模型安全评测。它根据上游拒答信号和原任务意图选择恢复提示词，不回放拒答原文，不要求模型暴露隐藏推理，也不把恢复流程用于绕过模型安全边界。

## v2 任务轨道

旧实现只有“拒答类别 → 泛化提示词”。v2 在不改变 dsh 消息形态和重试预算的前提下，再从最新 user turn 推导一个不回显原文的任务轨道：

| 轨道 | 触发信号 | 输出契约 |
|---|---|---|
| `direct_delivery` | 一般工程交付 | 先给最小完整代码、补丁、命令或结论 |
| `analysis` | 分析、审计、逆向、验证、报告 | `VERIFIED` / `CANDIDATE` / `UNRESOLVED` 分层，结尾给验证命令 |
| `tool_action` | 工具、命令、浏览器、终端、执行 | 有工具就调用；没有就给精确命令，不模拟输出 |
| `transformation` | 修改、修复、重构、补丁、配置 | 修改路径、回滚命令、验证测试 |
| `format_contract` | JSON、schema、字段、代码形状 | 严格服从格式，未知值使用占位符 |
| `missing_context` | 空任务或只剩身份类拒答 | 只指出最小非秘密缺口，同时先交付可用部分 |

每次注入带 `intent=<轨道>` 和对应输出契约。原始 user text 只用于本地分类，不写入账本，也不复制进恢复 carrier，避免把用户内容二次变成提示词。

## 路由规则

| 信号 | `failureClass` | 策略 | 交付目标 |
|---|---|---|---|
| 职责、范围或任务边界 | `scope_refusal` | `scope_clarification` | 把已有请求整理成目标、输入、约束和验收标准 |
| 安全、风险、政策或伦理 | `safety_refusal` | `safety_bounded_delivery` | 交付允许的分析、检测、修复或本地合成样例 |
| 身份、登录、权限或凭据 | `identity_refusal` | `context_completion` | 不索取秘密，只列出缺失的非敏感字段 |
| JSON、代码、步骤或输出格式 | `format_refusal` | `format_minimum` | 先给最小完整结果，必要时降级为稳定纯文本 |
| 工具、浏览器、终端或执行动作 | `tool_refusal` | `tool_fallback` | 使用已注册工具；工具不可用时给出精确输入契约或命令 |
| 连续两轮以上拒答 | `repeated_refusal` | `task_split` | 拆成一个最小可交付单元，避免重复争论 |
| 空响应、适配器错误或传输形态不兼容 | `empty_or_adapter_failure` | `transport_compatibility` | 使用纯文本和兼容消息形态，不套普通恢复提示 |

## 请求生命周期

1. 首轮请求按宿主原样发送并监控流。
2. 检测到拒答后只保留类别信号，历史中的拒答 assistant 文本替换为归档标记。
3. 重建未冻结请求，按类别和任务轨道注入一套提示词；第一次使用 assistant-last，后续使用 assistant+user pair。
4. 适配器错误走兼容性降级；最后一轮剥离所有恢复载体并如实透传模型结果。
5. JSONL 账本记录 `failureClass`、`strategy`、`attempt`、`model`、`provider` 和有限长度结果片段；不记录 token 或隐藏推理字段。

## 代码入口

- `src/jailbreak-prompt-router.ts`：分类、策略选择、提示词组装和消息构造。
- `src/llm-stream-hook.ts`：真实 `llm/stream` 监听、重试和账本写入。
- `scripts/checks/llm-stream.check.mjs`：拒答分类、消息形态、重试和审计回归检查。

