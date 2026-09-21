# helmd references 总索引

知识按需读，模型自主判断，不作为硬性规则。参考文档涵盖 8 个垂直安全领域与通用决策工具箱。

## 快速导航与通用入口

- [toolbox/decision-tree.md](toolbox/decision-tree.md) — 分诊决策树：拿到未知样本或任务后先走这里
- [toolbox/methodology.md](toolbox/methodology.md) — 分析方法论：标准流程、工具选择与实战案例
- [toolbox/patterns.md](toolbox/patterns.md) — 常见保护器签名、反分析技术与 Patch 模式速查表
- [toolbox/tool-install.md](toolbox/tool-install.md) — 逆向工具安装、环境配置与验证指南
- [toolbox/network-egress.md](toolbox/network-egress.md) — 出站通道：本机代理发现与直连回退（不预设端口，换机器可用）
- [evidence/reporting.md](evidence/reporting.md) — 标准化证据链与分析报告输出模板

## 垂直领域索引

| 领域 | 索引路径 | 核心覆盖范围与触发信号 |
|---|---|---|
| **Android 逆向** | [android/index.md](android/index.md) | APK/AAB/DEX/smali 逆向、Frida 插桩、加壳脱壳、指纹识别、防撤回与协议分析 |
| **Native 二进制** | [native/index.md](native/index.md) | PE/ELF/Mach-O、保护器脱壳(VMP/Themida/OLLVM)、反混淆、JVM 常量解密、PWN/漏洞利用、Hook、Patch |
| **Web 安全** | [web/index.md](web/index.md) | JS 逆向、API 签名、SQLi/XSS/SSRF/RCE/IDOR/XXE/SSTI/认证绕过等渗透测试与利用 Playbook |
| **AI 安全** | [ai-security/index.md](ai-security/index.md) | Prompt 注入、模型越狱、H-CoT 思维链劫持测试与防御、Agent 安全评估、Simulation |
| **恶意代码分析** | [malware/index.md](malware/index.md) | C2 通信与流量、持久化机制、IOC 提取、YARA 规则生成、威胁样本研判 |
| **网络协议** | [protocol/index.md](protocol/index.md) | PCAP 抓包解析、TCP/UDP 流重组、HAR 会话分析、WebSocket/gRPC/Protobuf 协议逆向 |
| **证据与报告** | [evidence/index.md](evidence/index.md) | Case 工作区管理、证据链 E-编号维护、Timeline 生成、Findings 结论记录 |
| **工具箱** | [toolbox/index.md](toolbox/index.md) | 分诊决策树、逆向方法论、常见模式签名、工具推荐矩阵 |

## 按需加载准则

1. **首轮定位**：优先通过 `route_task(hint: "...")` 确定主路由领域，或根据样本特征直接读取对应领域的 `<domain>/index.md`。
2. **最小子集**：从领域索引中选取 1–2 篇与当前目标直接相关的文档深入阅读，不全量加载，控制上下文 token 开销。
