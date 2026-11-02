# helm-d 自主逆向升级方案（DSH 插件形态）

> **历史说明（2026-10-26）**：本文的 **REA MCP bridge 方案已废弃**。当前约束是"不接入任何外部 MCP，全部内置"；RE 的当前方案见 [总方案](MASTER-PLAN-PRO-RE-PENTEST.md)。本文保留作参考。
> **状态**：历史设计提案，未实现。
> **相关**：[总方案](MASTER-PLAN-PRO-RE-PENTEST.md) · [评分](REFERENCE-SCORING-AND-EXPANSION.md) · [执行设计](AUTONOMOUS-RE-EXECUTION.md)

---

## 参考

- REA（`morluto/rea`）：MCP server + CLI 自主逆向工具层；Evidence record 结构；provider registry
- `dsh-reverse-mode`：DSH preset 子插件形态；tier；`$defs` inline；doctor；显式降级
- `QNX-Agent`：四套 specialist preset；脚本+`--json` 双入口
- `open-reverselab` / `Rikugan` / `reverser_ai`：背景参考

## 历史方案（已废弃）

原方案通过 REA MCP bridge 在 `helmd-re` preset 中挂载 REA 的 ~170 个逆向工具。因当前约束"不接任何外部 MCP"而废弃。

## 仍然有效的教训

- preset scope 隔离（只有选中 preset 的会话才加载工具面）
- tier 分层（entry/navigate/analyze/all）
- doctor 探测（引擎缺失显式降级）
- Evidence record 结构（coverage/limitations/facet_availability）
- 显式降级不静默断供
- `$defs` inline 防止 strict 模型 400

这些教训已合并进总方案 §4（内置 RE pack）。
