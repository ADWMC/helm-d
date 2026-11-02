# 参考项目全面评分与方案扩充（2026-10-26）

> **定位**：对 40+ 参考项目的逐家重审，聚焦非工具机制。helm-d 是 DSH 插件；不接外部 MCP；不包 shell 为工具。
> **评分口径**：M 方法论、E 证据/验证、K 知识组织、S 调度/质量门、O 插件贴合（各 1–5，满分 25）。
> **来源**：About-my-name `refs/` + `docs/`、GitHub README/docs、`docs/facts/` 调研笔记。不重跑任何项目。

---

## 0. 结论：五条最高价值机制

| # | 机制 | 来源 | helm-d 落点 | 总分 |
|---|---|---|---|---:|
| 1 | Evidence 逐字验证 + 反幻觉闸门 | VulnClaw / SoL-Pi / xalgorix | `record_finding` 硬门 | 18–20 |
| 2 | Flow→Task→Subtask 状态机 + 单 intent | pentagi / ARTEX / Decepticon | `case_phase` + playbook | 17–19 |
| 3 | 独立 verifier（不能自封 PASS） | xalgorix / OpenHands / reverify | `record_finding(confirmed)` 复验门 | 18 |
| 4 | MVI 知识路由（<200 行/文件、按需加载） | OpenAgentsControl / Dify / SkillOpt | `read_reference` + playbook 路由 | 16–18 |
| 5 | 证据保全的上下文压缩 | SoL-Pi / ZCode / VulnClaw | `CASE.md` resume ledger | 17–18 |

---

## 1. 逐家评分

### 1.1 自主渗透平台

| 项目 | M | E | K | S | O | 总 | 核心机制 | helm-d 吸收 |
|---|---:|---:|---:|---:|---:|---:|---|---|
| pentagi | 5 | 4 | 3 | 4 | 3 | **19** | Flow→Task→Subtask 状态树；evidence_version 乐观锁；primary_agent 无 terminal 权限 | 状态树 + 权限分层 |
| ARTEX | 4 | 5 | 3 | 3 | 2 | **17** | 双图；planner 唯一 intent；evidence_version + 行锁 | 单 intent + 单写者 |
| xalgorix | 4 | 5 | 3 | 3 | 3 | **18** | 独立 Verifier re-exploits；22-phase；三态 | 独立 verifier 复验门 |
| Decepticon | 4 | 4 | 3 | 3 | 3 | **17** | 16 专家按 kill chain；tier 模型 fallback；HMAC 审计 | kill chain 映射 + tier profile |
| RedAmon | 3 | 4 | 4 | 3 | 3 | **17** | Fan-out/fan-in；walkthrough 回放；XBOW 97.1% | walkthrough → report 模板 |
| Pentest-Swarm-AI | 3 | 4 | 2 | 3 | 3 | **15** | Stigmergy 信息素黑板；scope 双层 | scope 双层检查 |
| VulnClaw | 3 | 5 | 3 | 3 | 4 | **18** | Evidence gate 逐字匹配；NO_PATH near-miss；evidence dedup；stall guard | 逐字验证 + near-miss guard |
| T3MP3ST | 3 | 4 | 3 | 3 | 3 | **16** | MITRE 映射；provenance-strict gate；risk-tier approval | MITRE tag + provenance gate |
| Dark-Moon | 3 | 3 | 3 | 4 | 4 | **17** | Execution guard 预检；自然语言 scope | 预检规则 → guard 表 |
| Cairn | 4 | 2 | 2 | 3 | 3 | **14** | Fact/Intent/Hint 黑板；dispatcher 唯一写者；3 任务类型 | 黑板 → CASE.md facts/intents |
| antares | 2 | 3 | 2 | 3 | 3 | **13** | 指纹重复闸；steering queue；第二模型验证 | 失败重复闸 |
| deadend-cli | 2 | 3 | 2 | 2 | 3 | **12** | Confidence bands；approval 可重写参数 | confidence → finding 三态 |
| hexstrike-ai | 2 | 2 | 3 | 2 | 2 | **11** | Target→tool matrix | 借矩阵思想写进 references（不接 MCP） |
| pentestagent | 2 | 2 | 2 | 2 | 3 | **11** | Loop-enforced plan | 计划完成门 |
| VulnBot | 2 | 1 | 2 | 2 | 3 | **10** | 反面：无 finding/severity；LLM 说 yes 即成功 | 反模式 |
| HackSynth | 2 | 1 | 2 | 2 | 3 | **10** | Planner/Summarizer；CTF 200 题 | CTF 基准参考 |
| NetworkAttackSimulator | 1 | 1 | 2 | 2 | 2 | **8** | Gymnasium 仿真 | 仿真参考 |
| OpenHands | 3 | 4 | 4 | 3 | 3 | **17** | Feature map F01-F28；control CLI；evidence ledger；verify 独立 | feature map + ledger + verify |

### 1.2 Agent 框架

| 项目 | M | E | K | S | O | 总 | 核心机制 | helm-d 吸收 |
|---|---:|---:|---:|---:|---:|---:|---|---|
| openclaude | 3 | 3 | 3 | 5 | 4 | **18** | 权限 12 步；denial 3/20；压缩四层+熔断；failure guard | 失败分类 + 重试策略 |
| SoL-Pi | 2 | 5 | 2 | 4 | 4 | **17** | Action Fusion；ObservationPack；Evidence-Preserving Reducer（逐字）；Online Compact | 逐字 quote check |
| ZCode | 3 | 3 | 3 | 5 | 4 | **18** | ToolScheduler parallelGroups；strict schema；reasoning 归一；失败分类表 | 调度元数据 + 失败分类 |
| pi | 3 | 2 | 2 | 4 | 4 | **15** | Append-only session tree；extension taxonomy | 事件流 |
| SkillOpt | 2 | 3 | 4 | 3 | 4 | **16** | Skill 当可训练状态；held-out gate；文本学习率 | playbook 版本化 |
| harness2 | 3 | 2 | 3 | 3 | 3 | **14** | 8 组件 harness；Propose–Probe–Compose；per-domain library | persona/tool 优化 |
| OpenAgentsControl | 2 | 2 | 5 | 3 | 4 | **16** | MVI <200 行；scoped AGENTS；patterns to repo | MVI → read_reference |
| Dify | 2 | 2 | 5 | 3 | 4 | **16** | Scoped AGENTS；skill 路由；P0-P3 review | scoped AGENTS |
| APTS | 4 | 2 | 4 | 2 | 4 | **16** | 173 条/8 域；implemented/partial/N/A | 子集 checklist |
| trpc-agent-go | 3 | 2 | 3 | 3 | 2 | **13** | Graph workflow；evolution gates | typed contracts |
| REA | 3 | 4 | 3 | 3 | 2 | **15** | Evidence record 结构；provider registry；doctor | Evidence 结构 → save_evidence |
| dsh-reverse-mode | 2 | 3 | 3 | 5 | 5 | **18** | Preset scope 隔离；`$defs` inline；tier；doctor；显式降级 | preset scope → helmd-re |
| QNX-Agent | 3 | 3 | 3 | 3 | 3 | **15** | 四套 specialist preset；脚本+`--json` 双入口；结构化 missing-dep | preset 拆分 + 双入口 |

---

## 2. 五层方案扩充

### M 层（方法论）
| 机制 | 来源 | 实现 |
|---|---|---|
| Flow→Task→Subtask 状态树 | pentagi | CASE.md 增加 `## tasks` |
| Planner 唯一 intent；worker 写回即停 | ARTEX | `record_hypothesis` 后 `update_hypothesis` 写回即结束 |
| 独立 verifier | xalgorix | confirmed → 第二次运行复跑 repro_cmd |
| Kill chain 映射 | Decepticon/T3MP3ST | playbook 阶段标 MITRE ID |

### E 层（证据）
| 机制 | 来源 | 实现 |
|---|---|---|
| Evidence gate（逐字匹配） | VulnClaw | finding 关键结论必须逐字出现在 E 文件里 |
| NO_PATH near-miss guard | VulnClaw | near-miss 证据未耗尽不接受判死 |
| Evidence dedup（same_as） | VulnClaw | SHA-256 相同返回 same_as |
| Evidence version lock | ARTEX | evidence 文件记录 version |
| Evidence-Preserving Reducer | SoL-Pi | 截断引文逐字匹配原始输出 |

### K 层（知识）
| 机制 | 来源 | 实现 |
|---|---|---|
| MVI <200 行 | OpenAgentsControl | read_reference 单次限 200 行 |
| Scoped AGENTS | Dify | per-package AGENTS.md |
| Playbook YAML 阶段门 | xalgorix/pentagi | references/playbooks/*.yaml |
| Attack chain 词汇表 | Pentest-Swarm-AI | references/attack-vocab.md |
| Skill 版本化 | SkillOpt | tool_memory 加 version/validated_count |

### S 层（调度）
| 机制 | 来源 | 实现 |
|---|---|---|
| parallelGroups | ZCode | DSH 原生；helm-d 声明 isConcurrencySafe |
| timeoutMs 按工具 | ZCode | DSH defineTool.timeoutMs |
| Execution guard 预检 | Dark-Moon | runSeam 前置命令分类器 |
| 失败不连坐 | ZCode | 不写"失败即停" |

---

## 3. P0 最小可行集

```
1.  case_phase（阶段 gate）
2.  record_hypothesis / update_hypothesis
3.  record_finding（evidence + repro + 逐字验证 + confirmed 复验门）
4.  save_evidence（sha256/bytes/trust/version/same_as）
5.  34 工具补 isConcurrencySafe/timeoutMs
6.  playbook YAML（reverse + pentest + triggers）
7.  read_reference MVI 200 行
8.  no-external-mcp check
9.  tool-metadata check
10. docs/facts/ + docs/BENCHMARK.md
```

---

## 4. 一句话

**40+ 项目里，helm-d 应该吸收的不是工具也不是平台，而是五条机制：逐字验证的证据门、阶段门强制的方法论、MVI 的知识路由、DSH 原生的调度元数据、独立复验。**
