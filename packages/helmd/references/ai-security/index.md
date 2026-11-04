# AI / LLM 安全 参考索引

> 自动生成，勿手改。共 **17** 篇；总索引：[../index.md](../index.md)。重新生成：`node scripts/gen-references-index.mjs`。

**职责边界**：提示注入、越狱、模型评测、防御画像、载体构造与拒答路由。只对自有或授权模型端点做评测。

**先读**：[LLM 攻击方法论](./llm-attack-methodology.md) · [LLM 提示注入攻击面](./llm-injection-playbook.md) · [模型安全分析指南](./model-security-analysis-guide.md) · [Bypass 框架速查矩阵](./bypass-framework-matrix.md)

## 方法论与防御（5）

| 文档 | 讲什么 | 类型 |
|---|---|---|
| [模型安全分析指南](./model-security-analysis-guide.md) | 面向 LLM 模型本身的安全分析（非应用层）。覆盖模型拒绝行为分类、越狱技术、架构发现、挑战设计方法。 | 参考 |
| [模型防线画像速查](./model-defense-profiles.md) | opencode-go 提供商三模型的已知防线特性。攻击前查阅，避免重复探测。 | 参考 |
| [AI / LLM 安全分析核心原则](./ai-principles.md) | 从 secplan 领域编排器提取的通用方法论，去掉了任务编排与框架运行时引用。读完自行判断，非硬性规则。 | 方法论 |
| [AI 安全防御方案](./ai-security-defense.md) | LLM 应用的提示注入防御：输入层、System Prompt、输出层、架构层。 | 参考 |
| [LLM 攻击方法论](./llm-attack-methodology.md) | AI 安全分析的通用攻击方法论：如何识别 LLM 应用攻击面、构造 payload、验证结果。 | 方法论 |

## 注入、越狱与载体（7）

| 文档 | 讲什么 | 类型 |
|---|---|---|
| [高质量载体构造指南](./carrier-construction-guide.md) | LLM 提示注入攻击的载体构造方法：如何生成高质量载体、验证载体质量、选择注入位置。 | 参考 |
| [拒答恢复提示词路由](./refusal-prompt-routing.md) | 该路由用于真实 llm/stream 请求的受控恢复和模型安全评测。它根据上游拒答信号和原任务意图选择恢复提示词，不回放拒答原文，不要求模型暴露隐藏推理，也不把恢复流程用于绕过模型安全边界。 | 参考 |
| [提示注入模式速查](./prompt-injection-patterns.md) | LLM 提示注入的常见模式、Payload 模板和适用场景。 | 手册 |
| [Bypass 框架速查矩阵](./bypass-framework-matrix.md) | 模型层越狱攻击的系统化框架选择指南。基于 35 轮 opencode-go 三模型实战验证。 | 手册 |
| [Jailbreak Patterns — Categorized Technique Reference](./llm-prompt-injection-jailbreak-patterns.md) | 按类别整理的越狱技术目录：多步升级、角色扮演、编码与边界绕过。 | 手册 |
| [LLM 提示注入攻击面](./llm-injection-playbook.md) | 覆盖直接/间接注入、工具调用滥用、数据外传、MCP 风险、防御绕过、测试方法 | 手册 / hack-skills |
| [LLM Prompt Injection — Expert Attack Playbook](./llm-prompt-injection.md) | LLM 提示注入与越狱载荷总览：直接/间接注入、工具调用、数据外传、多步升级。 | 参考 |

## 评测、工作流与模型面（5）

| 文档 | 讲什么 | 类型 |
|---|---|---|
| [罐头工作流槽位（Canned Workflow Slots）](./canned-workflows.md) | 高频归一化目标直接映射确定性输出槽——不经过模型自由发挥，保证复现一致。 | 方法论 |
| [输入归一化词表（Input Normalization Lexicon）](./input-normalization-lexicon.md) | FIRST PASS 的展开词表：口语/边界词 → 本地分析标签，再按标签实施技术交付。 | 参考 |
| [注入效果真实性评估方法论](./payload-effectiveness-evaluation.md) | LLM 提示注入攻击的效果评估方法：如何判断注入是否"看起来真实"。 | 参考 |
| [AI/ML 模型安全](./ml-model-security.md) | 覆盖模型供应链、对抗样本、投毒、窃取、数据隐私、智能体安全 | 参考 / hack-skills |
| [AI/ML Security — Expert Attack Playbook](./ai-ml-security.md) | AI/ML 安全攻击面：供应链、对抗样本、投毒、模型窃取与隐私。 | 参考 |
