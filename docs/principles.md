# 原则

## 0. 一句话

所有领域知识都做成**参考**，不干扰 AI 判断。系统提示只放一份 `complete` 工程纪律；首轮工具目录用 bootstrap 收窄；知识、规则、工作流、案例一律作为 `references/` 按需加载。

## 1. 参考而非干扰

- 知识、规则、工作流、案例、工具用法 → 全部放进 `references/`，通过 `read_reference` 工具按需读取。
- 不把「结论 / 规则 / 强制流程」写进 system prompt 去替模型做决定。
- 模型读完参考后自行判断是否适用、如何执行。

## 2. 唯一系统提示：persona complete

- 使用 `@deepseek-ai/dsh-persona`，`complete: true`，`includeRuntimeContext: false`。
- 内容是工程代理工作规范（真实、克制、可验证、最小改动、证据交付）。
- 不再使用 `ctx.systemPrompt.section(...)` 注入第二份系统提示。

## 3. 首轮锚定

- 首个顶层请求只暴露一个平台 shell + `read`；子 agent 始终看到完整工具目录。
- 晋升依据 durable session events，默认 `tool/call` 或 `assistant/message` 任一先发生。
- bootstrap 失败时降级为完整目录，绝不让会话不可用。

## 4. 真实优先

- 不编造 API、路径、版本、日志、测试结果、执行输出。
- 不知道就查，查不到就说明，无法确认就停止猜测。
- 假设标注 `[假设]` 并说明验证方法。

## 5. 证据优先与置信度

- 每个结论都要有证据：文件偏移、函数名、字符串、哈希、内存 dump、pcap、日志、命令输出。
- 每个结论都要用置信度衡量：高 / 中 / 低，并说明依据。
- 无证据时，明确说明缺什么、下一步取什么，而不是假装分析。

## 6. 渐进披露与自包含

- 主入口只放路由与目录，细粒度内容按需加载。
- 每个领域 bundle 自包含 `src/` + `references/` + `scripts/`。
- 不把整本知识库塞进上下文，控 token。

## 7. 工具获取阶梯（v0.2.0）

- 内置工具优先；能力缺口先 `find_tool()` 检索 GitHub / 搜索引擎的现成方案，落地 `<工作区>/helmd-tools/` 并登记 `TOOLS.md`。
- 自写脚本是最后手段：仅限 `<case>/scripts/`，且在 CASE.md 记录理由。
- 外部工具输出必须经 `save_evidence()` 入证据链，才能作为结论依据。
- 破坏性或难以恢复的操作前确认精确目标与影响范围。
