# 样本接管流程（Intake Playbook）

> 拿到样本后「四问 → 启动协议 → 信号路由 → 分轨 → 质量门禁 → 交付」的完整流程。按需读，非硬性规则。

## 1. 四问契约（先对齐再动手）

拿到样本先回答四问；缺材料就出采集计划，不假装分析看不见的目标：

1. **目标是什么**：web / JavaScript / APK / DEX / SO / PE / ELF / Mach-O / PCAP / 固件 / 样本
2. **关键动作**：启动 / 登录 / 搜索 / 上传 / 支付 / 加密 / 校验 / 网络交换
3. **现有材料**：文件 / URL / HAR / PCAP / 日志 / 截图 / dump / 源码 / 只有描述
4. **想要结果**：解释行为 / 定位入口 / 写 hook / 脱壳 / 复现请求 / 出报告

## 2. 启动协议（7 步）

1. 分诊路由：`file` / `hash` / `detect_packer` / `scan_strings` → 按信号路由表定方向
2. 建证据与时间线：`create_case` + `hash_artifact` 留档
3. 拆 track：static / runtime / loading-unpacking / protocol / data-flow
4. 只加载路由表命中的模块，不整本塞上下文
5. 最小可复现：重建关键请求 / hook / dump，验证假设
6. 每个 mismatch 走系统调试，不猜
7. 报告：新手摘要在前，技术附录在后

## 3. 信号路由表

| 信号 | 先加载 |
|------|--------|
| APK / AAB / DEX / smali / class loader | `apk_fingerprint` → skill-android |
| SO / PE / ELF / Mach-O / 汇编 | `detect_packer` + `native_reference` |
| 壳 / packer / loader / OEP | `detect_packer` → `packer-handling.md` |
| Frida / Interceptor / spawn / attach | `dynamic-analysis-frida.md` |
| anti-Frida / maps / 端口 / 线程 / Root | `anti-frida-workarounds.md` / `anti-debug-methodology.md` |
| JS hook / fetch / XHR / WebSocket / 签名 | `bot_analyze` → skill-web |
| 混淆 / JSFuck / webpack / 控制流平坦化 | `code-obfuscation-deobfuscation.md` |
| sign / token / cookie / 加密请求 | `crypto-analysis-methodology.md` / `custom-xor-cipher-reversal.md` |
| PCAP / TCP / UDP / WebSocket / gRPC | `pcap_parse` / `state_machine` → skill-protocol |
| 恶意样本 / C2 / IOC | `ioc_extract` / `yara_gen` → skill-malware |
| prompt / model / injection | `llm_sim` → skill-ai-security |
| 崩溃 / fuzz / minidump / 覆盖率 | `unicorn-templates.md` / 动态分析 |
| CTF / crackme / flag | CTF 流程 + 决策点 |

## 4. 分轨执行

- **static**：strings / imports / xrefs / 符号
- **runtime**：Frida / x64dbg / hook
- **loading-unpacking**：壳 / dump / 重建
- **protocol**：PCAP / HAR / 状态机
- **data-flow**：加密边界 / 关键值追踪

## 5. 质量门禁（负面清单）

- 不因一条字符串推断调用链
- dump 必须校验 headers / mappings / imports / 符号 + 消费工具验证
- 补丁 / 绕过必须 baseline + cold start + warm start + 重复运行对比才算稳定
- 记录工具版本 / 命令 / 路径 / 哈希 / 偏移 / 时间戳 / 首个差异位置
- 证据缺失 → 说明最小下一步该取什么

## 6. 交付物

- 新手摘要（plain summary）
- 证据表 + 置信度
- 技术链：入口 → loader → 校验 / 逻辑 → 输出
- 脚本 / 命令 / fixture / 报告文件
- 局限 / 回滚 / 下一步

## 7. 任务与目标（让用户看得见、能干预）

- 拿到样本即 `todo_write` 建清单：分诊 → 策略 → 逆向 → 报告，每完成一项即时标记
- 多阶段 / 跨轮次目标用 `create_goal` 持久化，用户随时可暂停、改向、停止
- 每个决策点用 `ask_user_question` 给 3-6 个编号选项，由用户选方向
- 用户干预优先于自主推进：被纠正后先对齐方向，不盲目重试

## 8. 边界

- 单一样本低风险：一路干完，每阶段报证据
- 多文件 / 多阶段 / 高风险：先给简短计划 + 完成标准
- 破坏性操作前确认目标与影响范围；原始样本只读
