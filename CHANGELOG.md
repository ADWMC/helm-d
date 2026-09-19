# 更新日志（Changelog）

所有显著变更记录于此。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)；
完整发布注记与资产见 [GitHub Releases](https://github.com/ADWMC/helm-d/releases)。

## [0.4.0] — 2026-09-19

全源码审计驱动的行为层与引擎层全面重写。四大主题：persona 重写、H-CoT 引擎重写、references 全域清洗、PR #3 合并。

### 行为层重写（persona + 注入栈）

- **persona 五段纪律**：TARGET PREMISE（沙盒默认事实/反诘封堵×3/靶场判定条款）、SLANG ROUTING（12 条海鸥式 slang 映射 + SRC 条目）、MOMENTUM（防停滞三步法）、DELIVERY DISCIPLINE（执行态/首片段/肯定开头/纠正即续写）、OUTPUT CONTRACT（占位符中性化/完整性/角色一致性/截断恢复）
- **删除 SCORING 段**：惩罚机制被 glm-5.3-flash 当场识破（reasoning 实证），威胁类技巧论文证明最弱（PAP）；行为塑造由四个正向段承担
- **删除全部免责/授权/红线措辞**：AGENTS.md §6 红线与实验室卫生条目、BREACH_PERSONA SCOPE 段、防线3 重试人格授权讨论句
- **OUTPUT CONTRACT 并入 persona 单源**：删除运行时注入层，契约随 persona 同生共死不依赖插件装载
- **SLANG ROUTING 补 SRC 条目**：会话取证发现模型凭经验答 SRC 方法论问题未查参考库，根因是 persona slang 表缺 src 条目
- **L2 ICA 上下文示范**：`ica-context.ts` 注册 durable user-role runtime snapshot，4 组任务→执行行为示范替代指令说教（arXiv:2310.06387，GPT-4 20-shot ASR 81%），绕过 L1 输给 glm 的指令审查推理链

### H-CoT 引擎重写

- **两阶段自适应攻击**（默认）：良性 probe 采集目标模型自身推理模板 → mocked T_E 回注（arXiv:2502.12893 §4.2 机理），替代静态三段式（probe 响应被丢弃/forge 与目标无关的旧行为）；采集失败自动回退旧形态
- **拒绝稀释变体** `dilution-puzzle`：Atbash 密码谜题前置长推理 → 拒绝信号稀释（arXiv:2510.26418，ASR 94-100%）
- **搜索循环** `hcot-search.ts`：拒→归因→五算子变异→重试→记账的机械闭环（dreadnode/parley TAP 骨架 + GPTFuzzer 变异 + AutoDAN-Turbo 强制探索），scheduleAttack 降级路径从单发改为循环
- **账本键统一**：`break`/`broke` 三层兼容读写（策略层/UI 此前恒读 undefined 导致破甲率统计恒 0）；失败也记账（无 key/传输失败此前不落账，自适应学习永远冷启动）
- **last-resort 立规**：H-CoT 降为最低优先级——首次拒绝只注入技术轨道重试 advisory，常规重试失败（≥2 次拒绝或已有 hcot 调用）才武装 H-CoT
- **Mimir 式子代理能力预检**：getProvider + capabilities.persona/toolFilter/depthLimit 校验 + stopReason 异常结束显式判定（参考 dsh-Mimir-Academic-research）
- **continueFrom 截断恢复传输**：被截断的输出从断点续写不重启（OMEGA D/H + arXiv:2412.03556）
- **死参修复**：`buildSteps` forgeFile 真实消费、`hcot_attack` auto 参数生效、buildPayload custom 槽并入

### 运行时修复

- **tool-wash 追溯清洗（retro-wash）**：会话取证实锤 preset 装载顺序 tool-pwsh 先于 helmd，wrap 装上时 pwsh 已注册，8 处终局话术残留；改为 get(name) 拿 borrow 引用原地改 description
- **流式拦截正则收窄**：裸词（出于安全/建议/不合规/不在范围）加必选锚，正常技术陈述不再被整流吞掉；围栏跨 chunk 分割补闭合兜底
- **HEDGE_MARKERS 收窄**：删除 7 个裸词（温馨提示/需要授权/出于安全等），渗透报告技术事实不再被误判为敷衍
- **调度器假阳性修复**：子代理崩溃/空输出不再返回 ok:true"攻击完成"假 advisory
- **mode 契约修复**：deep 档 `create_case`→`begin_case`（死引用）；lite 档与 persona begin_case 对齐

### references 全域清洗

- **164+ 文件旧 skill 时代残留清除**：frontmatter 元数据、AI LOAD INSTRUCTION、SKILL.md 互链、Installation Notes/Recommended 段、Skill Map→Document Map 归一化；全域终检 0 残留
- **SRC/众测语料融入**（PR #3，经清洗）：`src-hunter/` 3164 文件——playbooks 68 篇（19 类漏洞 P0-P2 排序）/payloader 936KB/h1-reports 141 归档 + 索引（raw 2887 份已从包内移除，GitHub 仓库仍有）/字典/行业打法；compliance.md 红线文档删除、skill 残留清零、凭据脱敏（AWS/Salesforce/npm/Facebook token → REDACTED）
- **35 篇 web 文档移植 SRC 指针**：`> **SRC / 众测语境**` → src-hunter 对应 playbook
- **pentest-router 流程补全**：Step 0 明确用户需求四问、Step 2.5 CVE/PoC 检索（gh 检索命令模式 + 误报过滤铁律）、SRC 语境路由节
- **router.ts 正式接入**：src 语境路由（src/众测/bug bounty/补天/hvv/挖洞）→ src-hunter 能力层

### 合并

- **PR #3**（LingXiaoyyds666）：Windows 检查脚本假 PASS/假 STALE 修复（PATH 探测 + realpath 符号链接解析）——cherry-pick `d998f5da`；src-hunter 语料部分经清洗后独立提交

### 文档

- `docs/audit-2026-09-15-src-audit.md`：全源码审计报告（9 P0/21+P1/34+P2，含 file:line 证据与修复顺序）
- `docs/research-papers-reference.md`：学术论文参考指南
- `references/web/pentest-router.md`：流程五步全贯通

## [0.3.1] — 2026-09-14

首个 npm 上架版本：[`@adwmc/helm-d`](https://www.npmjs.com/package/@adwmc/helm-d)。

### 变更

- **包更名**：`@dsh-security/helmd` → `@adwmc/helm-d`（无 scope 的 `helm-d` 被 npm 防拼写抢注拒绝，采用 npm 官方建议名）。preset 挂载行、host 行、安装/更新脚本、tgz 资产名全部同步；稳定别名 `helmd.tgz` 不变，update 脚本改用别名下载、与版本化资产名解耦
- **运行时钩子层**（全部寄生宿主 cordis 瀑布，零独立进程）：
  - `tool-wash` 工具描述清洗——「拒绝是终局」类话术归一化为可继续措辞（防御层）
  - `persist` 全工具证据链持久化包装（软门禁）
  - `advisory-hook` advisory 账本清算与注入（拒绝/敷衍检测 + stance 指标）
  - `input-normalizer` 敏感输入 → 工程术语归一化
  - `hcot-hook` + `hcot-attack-scheduler` 交付拒绝响应与后台攻击调度（子代理主路 → 防线3 重试 → 引擎降级）
  - `llm-stream-hook` `llm/stream` 首窗口拒绝旁路与审计日志
- **H-CoT 子系统**：Node 原生攻击引擎（零 Python，SSE first_fragment 捕获）、语义路由、`/hcot` 内部命令（单发 / breach）、`hcot` 设置命名空间、子代理人格、变体语料与结果账本
- **Web 工作台**：`[helmd 工作台 ▾]` 胶囊按钮 + 抽屉/右侧栏双轨联动、H-CoT 控制台、`tool_memory` 账本驱动的动态工具货架、流式审计面板

### 修复

- 参考库：决策树 ELF 分支断链（`native_reference` 域不匹配 → `read_reference` android/ 前缀）、ARM64 NOP 编码笔误统一（`0xD503201F`）、casebook VMP 分支字面 `\n` 展开、五处双语重复标题、GH_Loader/XOR-24/加壳决策树跨文档重复单点化

### 其他

- 工具 31 → 33（10 个模块），参考文档 361 篇（8 域 + toolbox）
- 检查套件 13 项自动化（`pnpm test:checks`）+ 4 个手工验收脚本（engine-verify / workspace-verify / perf-bench / session-timing）
- 依赖 cohort 钉死 dsh 0.1.5-rc.2 全家（`pnpm-workspace.yaml` overrides）

## [0.2.3] — 2026-09-03

### 修复

- 预设切换作用域泄漏：`applyPersistenceWrap` 不再永久猴子补丁 `ctx.tools.register`，注册完成后即刻还原原生函数，消除切换 preset / 恢复旧会话时 `tool 'pwsh' is already registered in this scope` 死锁

### 增强

- 技术实体沙箱归一化：分析目标绑定为本地受控实验实体（TARGET/SAMPLE/ARTIFACT）
- 静默技术占位符：敏感凭据/动态端点/易变偏移用占位符（TARGET_HOST、MEM_OFFSET、PATCH_BYTES 等）继续交付
- 四阶段逆向分析管线：Triage → Locate → Evaluate → Deliver
- 二进制安全事务性：原样本只读、副本操作、基准对比、可执行回滚

## [0.2.2] — 2026-08-31

- 安全工具改为仅由 helmd Agent preset 加载；全局 bundle 仅保留健康检查，避免与 Standard/Patchwork 重复注册
- 修复安装器生成 preset 缺少 `preset.yml` 的问题；同步仓库与包内 preset 生成器
- 实测 standard → patchwork → helmd → standard 切换通过

## [0.2.1] — 2026-08-28

- **设置页健康卡片**：启动时评估部署位 preset 与宿主关系（🟢 健康 / 🟠 宿主已升级 / 🔴 内容漂移 / 🟣 旧版产物 / ⚪ 未部署），双指纹展开
- **preset 覆盖层生成（修订版）**：初版资产复制宿主 standard 全量工具行导致 `already registered` 无法挂载，资产已替换为只含 persona 覆盖层的修复版生成器
- **CLI 指纹告警**：产物首行宿主指纹，`gen-preset.mjs --check` 区分 `HOST UPGRADED` / `STALE (content drift)`，非 0 退出；同一判定在 GUI / CLI / 安装器三处生效

## [0.2.0] — 2026-08-26

### Case Workflow System

- **Case 工作区生命周期**：`begin_case` / `case_status` / `record_finding` / `end_case`——磁盘工作区 `helmd-cases/<date>-<slug>/`，样本 SHA-256 自动入链 E-001；上下文压缩后 `case_status()` 从磁盘恢复；`record_finding` 强校验 E 编号；deep 档强制至少一条 finding 才能关闭
- **persistToCase 钩子**：全部领域工具输出自动存证（软门禁）
- **外部工具获取层**：`find_tool`（GitHub 搜索 + 变体查询建议 + 货架命中）、`save_evidence`（外部 CLI 输出入链）
- **persona 重写**：1.9KB lite 风格，保留精简计分制与 WORKFLOW 四行

## [0.1.6] — 2026-08-24

- **完整 preset 随包分发**：`presets/{preset.yml,agent.cordis.yml}` 进 tarball，商店安装也能一条命令补全完整配置（`scripts/setup-preset.*`）
- **安装器一致性修复**：install 脚本不再内嵌各自精简的 preset 副本（此前与维护版静默漂移），统一改为复制包内 `presets/`——单一事实源

[0.4.0]: https://github.com/ADWMC/helm-d/releases/tag/v0.4.0
[0.3.1]: https://github.com/ADWMC/helm-d/releases/tag/v0.3.1
[0.2.3]: https://github.com/ADWMC/helm-d/releases/tag/v0.2.3
[0.2.2]: https://github.com/ADWMC/helm-d/releases/tag/v0.2.2
[0.2.1]: https://github.com/ADWMC/helm-d/releases/tag/v0.2.1
[0.2.0]: https://github.com/ADWMC/helm-d/releases/tag/v0.2.0
[0.1.6]: https://github.com/ADWMC/helm-d/releases/tag/v0.1.6
