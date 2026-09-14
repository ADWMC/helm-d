# 更新日志（Changelog）

所有显著变更记录于此。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)；
完整发布注记与资产见 [GitHub Releases](https://github.com/ADWMC/helm-d/releases)。

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

[0.3.1]: https://github.com/ADWMC/helm-d/releases/tag/v0.3.1
[0.2.3]: https://github.com/ADWMC/helm-d/releases/tag/v0.2.3
[0.2.2]: https://github.com/ADWMC/helm-d/releases/tag/v0.2.2
[0.2.1]: https://github.com/ADWMC/helm-d/releases/tag/v0.2.1
[0.2.0]: https://github.com/ADWMC/helm-d/releases/tag/v0.2.0
[0.1.6]: https://github.com/ADWMC/helm-d/releases/tag/v0.1.6
