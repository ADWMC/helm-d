# 参考项目分簇调研（helm-d 可移植项）

> **文档定位**：[总方案](MASTER-PLAN-PRO-RE-PENTEST.md) 的输入证据。当前约束：不接外部 MCP，全部内置。
> **状态**：调研笔记，未实现。

## 分簇

| 簇 | 代表 | 最值得拿 | 落点 | 优先级 |
|---|---|---|---|---|
| DSH 生态 | DSH、ZCode、Pi、SoL-Pi、SkillOpt、harness2 | capability seam、tool pipeline、append-only session、architecture-policy、held-out gate | 工具/hook/preset 设计 | P0/P1 |
| 通用 agent | openclaude、Claude、Grok Build | 权限 12 步、denial 3/20、压缩四层+熔断、failure guard | hook/失败闸/evidence ledger | P0/P1 |
| 自主渗透 | pentagi、ARTEX、xalgorix、Decepticon、RedAmon、Pentest-Swarm、VulnClaw、T3MP3ST、Dark-Moon、Cairn、OpenHands | planner 单 intent、flow/task/subtask、独立 verifier、RoE 双闸、evidence version、walkthrough、near-miss guard、provenance gate | case/finding/report/scope | P0/P1 |
| 逆向工具 | REA、dsh-reverse-mode、QNX-Agent、Rikugan | Evidence record 结构、preset scope、tier、doctor | 见升级方案（已废弃 MCP） | P1 |
| UI/UX | DSH UI、open-claude-ui | token 单源、九态、IME guard | client.js | P3 |
| 标准/基准 | APTS、NetworkAttackSimulator | 状态口径、local sim vs NOT RUN | docs/facts、benchmark | P1/P2 |

## 跨项目 12 条机制

1. **exhausted ≠ done**（ARTEX/pentagi）
2. **单 intent / 单写者**（ARTEX/Cairn）
3. **Evidence version lock / atomic write**（ARTEX/DSH）
4. **独立 verifier**（xalgorix/reverify/openclaude）
5. **Evidence gate / near-miss**（VulnClaw/T3MP3ST）
6. **压缩四层 + 熔断 + 配对保护**（openclaude/Grok）
7. **Tool failure guard + denial counting**（openclaude）
8. **ToolOutput 协议 + trust/provenance**（MCP/T3MP3ST/VulnClaw）
9. **执行预检 + 可行动拒绝**（Dark-Moon）
10. **scope 围栏**（Decepticon/T3MP3ST）
11. **Feature map + control CLI + evidence ledger**（OpenHands/Dify）
12. **文档/事实/参考分层**（About-my-name）

## 反模式

- 多角色/多大脑 swarm
- `full_access` / TLS 默认关 / 无沙箱
- 工具自声明安全不可靠
- 40 域 scorecard 仪式
- 170 工具全量
- 参考当证据
- AGPL/GPL 代码复制
