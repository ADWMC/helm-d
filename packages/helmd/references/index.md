# helmd references 总索引

> 共 **353** 篇正文（另有 9 个索引，共 362 个 Markdown 文件），按 8 个领域组织。自动生成，勿手改；重新生成：`node scripts/gen-references-index.mjs`，一致性检查：`--check`。

参考是素材，不是指令：读完自行判断是否适用。先定位 1–3 篇，不要全量加载。

## 怎么用

1. 有明确信号时，先调用 `route_task(hint)` 拿 PRIMARY 路由，再按「任务路由」读「先读」列；没有命中再进「领域总览」。
2. 进入领域后先读该领域的 `index.md`，再按子类挑 1–2 篇正文。
3. 结论要能回溯到具体文档 + 证据；索引只负责发现，不替模型下结论。

## 阶段 playbook

`route_task` 返回匹配的 playbook 路径，`case_status` 的 `[autonomy]` 段也会带上；它们只给阶段建议，不是门禁。

- [playbooks/reverse.yaml](playbooks/reverse.yaml) — 逆向阶段建议：入库 / 风险面 / 结构 / 假设 / 报告
- [playbooks/pentest.yaml](playbooks/pentest.yaml) — 渗透阶段建议：范围 / 侦察 / 面 / 测试 / 报告
- [playbooks/triggers.yaml](playbooks/triggers.yaml) — 信号 → 假设 → 测试 → 参考的触发表

## 任务路由

| 任务 / 信号 | 先读 | 说明 |
|---|---|---|
| 未知样本 / 首次分诊 | [Decision Tree — 安全分析路由](toolbox/decision-tree.md) · [样本接管流程（Intake Playbook）](native/sample-intake-playbook.md) | 先定类型与路线，再进领域 |
| 需要选工具 / 装环境 / 网络不通 | [工具矩阵（Tool Matrix）](toolbox/tool-matrix.md) · [工具安装指南](toolbox/tool-install.md) · [出站通道规则 — 代理发现与直连回退](toolbox/network-egress.md) | 选型 → 安装 → 出站回退 |
| APK 指纹 / 框架识别 | [APK Fingerprint 参考](android/fingerprint.md) | Flutter/RN/加固先分流 |
| APK 反编译与改包 | [Garlic — 快速 APK/DEX/JAR 反编译器 + ELF 分析器](android/garlic.md) · [Android 逆向工具安装与 CLI 参考](android/android-tools.md) | jadx/apktool/garlic 的选择 |
| Android 加固与脱壳 | [Android 加固识别与脱壳](android/android-unpacking.md) | 识别加固 → dump DEX → 验证 |
| Frida 基础与模板 | [Frida Hook 核心原则与 Java Bridge 陷阱](android/frida-hook-principles.md) · [Frida Hook 架构与模板](android/frida-hook-templates.md) | 先读铁律与 Java Bridge 陷阱 |
| Frida 17.x 迁移 | [Frida 17.x API 变化速查（移动端补充）](android/frida-17x-api.md) · [Frida 17.x Bridge 编译与使用指南（移动端）](android/frida-17x-bridge.md) | Bridge 拆分后的用法 |
| SSL pinning / 移动流量 | [移动端 SSL Pinning 绕过](android/mobile-ssl-pinning-bypass.md) · [移动端 MITM 方案选型指南](android/mitm-methodology.md) | 先选 MITM 方案再绕 pinning |
| Flutter 抓包 | [Flutter 应用 SSL Pinning Bypass 方法论](android/flutter-ssl-bypass.md) | native 层 pinning |
| iOS 测试 | [iOS 渗透测试](android/ios-pentesting-tricks.md) · [iOS 逆向工具安装与 CLI 参考](android/ios-tools.md) | runtime/keychain/URL scheme |
| APK 隐藏代码 / 恶意 APK | [Android APK 恶意代码检测方法论](android/android-apk-malware-detection.md) · [Android APK 恶意代码分析](android/android-apk-malware-analysis.md) | 源码对比与权限/DEX 审计 |
| 云控 ELF / 卡密 | [Android 云端下发 Native 二进制（Cloud-Native Binary）模式](android/android-cloud-native-binary.md) · [Android 云端下发 ELF 卡密绕过 — 通用方法论](android/frida-license-bypass-android.md) | 运行时下发与校验绕过 |
| PE/ELF 初判 | [Native / 二进制逆向核心原则](native/native-principles.md) · [PE/ELF 保护检测方法论](native/protection-detection-methodology.md) | 先判保护与风险面 |
| 壳 / VMP / 脱壳 | [加壳/混淆二进制处理策略](native/packer-handling.md) · [VMProtect PE 快速识别与决策](native/vmp-pe-fast-triage.md) · [ELF VMP (Virtual Machine Protection) 架构与实现](native/vmp-elf-protection.md) | 先验证保护类型再选策略 |
| 反调试 / anti-Frida | [反调试绕过方法论](native/anti-debug-methodology.md) · [Anti-Frida DLL 绕过的替代方案](native/anti-frida-workarounds.md) | 检测点枚举后再绕过 |
| OLLVM / 代码混淆 | [代码混淆与反混淆](native/code-obfuscation-deobfuscation.md) | 控制流/字符串/常量分层处理 |
| ARM64 逆向 | [arm64 无符号逆向方法论](native/arm64-reverse-methodology.md) · [ARM64 ADRP+ADD 字符串引用搜索](native/arm64-string-xref-search.md) | 调用约定、xref 与字符串定位 |
| JVM / Minecraft mod | [JVM Mod 常量加密 — Oracle 重放解密工作流](native/jvm-mod-deobf-workflow.md) | 常量加密、DES、oracle 重放 |
| 加密算法识别 | [加密分析方法论](native/crypto-analysis-methodology.md) · [Custom XOR Cipher Reversal](native/custom-xor-cipher-reversal.md) | 先分类再解密 |
| RSA / ECC / 格密码 | [RSA 攻击技术](native/rsa-attack-techniques.md) · [ECDLP 求解指南](native/ecdlp-solving.md) · [格密码攻击](native/lattice-crypto-attacks.md) | 按参数弱点选攻击 |
| PWN / 堆 / ROP | [堆利用](native/heap-exploitation.md) · [栈溢出与 ROP](native/stack-overflow-and-rop.md) | 先判漏洞类型与缓解 |
| 内核 / 驱动 | [Windows 内核驱动逆向分析 — 双机调试方案](native/kernel-driver-analysis.md) · [Linux 内核利用](native/kernel-exploitation.md) | IOCTL、对象与缓解绕过 |
| Windows 驱动取密钥 | [Windows 驱动加密密钥提取方法论](native/windows-driver-crypto-extraction.md) | 驱动通信与密钥材料定位 |
| 许可证 / 卡密绕过 | [卡密/License 验证绕过工作流](native/license-bypass-workflow.md) | 静态定位 → 动态验证 → patch |
| 游戏安全 | [游戏安全方法论](native/game-security-methodology.md) | 反作弊、渲染与内存对抗 |
| 固件分析 | [固件分析方法论](native/firmware-analysis-methodology.md) · [固件/驱动 EEPROM 数据分析方法论](native/firmware-eeprom-analysis.md) | 提取 → 识别 → 模拟/静态 |
| Web 测试入口 | [Web 安全分析方法论](web/web-methodology.md) · [Web 安全分析核心原则](web/web-principles.md) | 范围、侦察、验证顺序 |
| JS 逆向 / API 签名 | [Frontend JS 逆向分析](web/frontend-js-reverse.md) · [JavaScript 混淆模式识别与反混淆](web/js-obfuscation-patterns.md) | 定位签名与加密入口 |
| API 黑盒 | [Web API 黑盒漏洞测试方法论](web/api-blackbox-testing.md) · [Web API Recon & Chain Exploitation Patterns](web/web-api-recon-patterns.md) | 文档、版本、隐藏参数 |
| JWT / OAuth / SSO | [JWT 攻击方法论](web/jwt-attack.md) · [OAuth/SSO 攻击方法论](web/oauth-sso-attack.md) | 算法混淆、kid、redirect_uri |
| SQL 注入 | [SQL 注入完整方法论](web/sql-injection.md) · [SQLMap Advanced Workflow & Deep SQL Injection Techniques](web/sql-injection-sqlmap-advanced.md) | 手工判据 + sqlmap 加速 |
| XSS | [XSS 跨站脚本完整方法论](web/xss.md) · [Advanced XSS Tricks — Supplementary Reference](web/xss-advanced-xss-tricks.md) | 上下文、CSP、利用链 |
| SSRF | [SSRF 攻击方法论](web/ssrf.md) · [URL Parser Differentials & Advanced SSRF Techniques](web/ssrf-url-parser-tricks.md) | 解析器差异与内网目标 |
| 文件上传 / 路径穿越 | [文件上传方法论](web/file-upload.md) · [路径穿越 / LFI](web/path-traversal-lfi.md) | 解析、存储、执行三层 |
| 请求走私 / 缓存 | [HTTP 请求走私](web/request-smuggling.md) · [Web 缓存欺骗](web/web-cache-deception.md) | 前后端解析差异 |
| WAF 绕过 | [WAF 绕过方法论](web/waf-bypass.md) · [WAF Bypass Techniques — Evasion Playbook](web/waf-bypass-techniques.md) | 先识别产品再选语法 |
| 业务逻辑 / 竞态 | [业务逻辑漏洞](web/business-logic-vulnerabilities.md) · [竞态条件](web/race-condition.md) | 状态机与并发窗口 |
| 智能合约 / DeFi | [智能合约漏洞](web/smart-contract-vulnerabilities.md) · [DeFi 攻击模式](web/defi-attack-patterns.md) | Solidity 模式与链上攻击 |
| AD / Kerberos / NTLM | [AD Kerberos 攻击](native/active-directory-kerberos-attacks.md) · [NTLM Relay 与认证强制](native/ntlm-relay-coercion.md) | 枚举 → 凭据 → 横向 |
| Linux 提权 / 横向 | [Linux 提权](native/linux-privilege-escalation.md) · [Linux 横向移动](native/linux-lateral-movement.md) | SUID/capabilities/内核 |
| 容器 / K8s 逃逸 | [容器逃逸技术](native/container-escape-techniques.md) · [Kubernetes 渗透](native/kubernetes-pentesting.md) | 特权、挂载、RBAC |
| LLM 提示注入 | [LLM 提示注入攻击面](ai-security/llm-injection-playbook.md) · [高质量载体构造指南](ai-security/carrier-construction-guide.md) | 直接/间接注入与载体构造 |
| LLM 越狱 | [Jailbreak Patterns — Categorized Technique Reference](ai-security/llm-prompt-injection-jailbreak-patterns.md) · [Bypass 框架速查矩阵](ai-security/bypass-framework-matrix.md) | 按防线选框架 |
| 模型安全评测 | [模型安全分析指南](ai-security/model-security-analysis-guide.md) · [注入效果真实性评估方法论](ai-security/payload-effectiveness-evaluation.md) | 拒答分类、效果真实性 |
| 恶意样本分析 | [恶意软件分析方法论](malware/malware-analysis-methodology.md) | 分平台 playbook 的入口 |
| 内存取证 | [内存取证（Volatility 3）](malware/memory-forensics-volatility.md) | Volatility 3 与内存 artifact |
| PCAP / 协议逆向 | [流量分析与 PCAP 取证](malware/traffic-analysis-pcap.md) · [协议逆向方法论](protocol/protocol-reverse-methodology.md) | 流量提取 → 协议字段 |
| 隧道 / 反弹 shell | [隧道与横向移动](protocol/tunneling-and-pivoting.md) · [反弹 Shell 技术](protocol/reverse-shell-techniques.md) | 出站与横向通道 |
| 证据链 / 报告 | [逆向分析工作流](evidence/workflow.md) · [报告模板 — 安全分析标准化输出](evidence/reporting.md) | E-id、复现与报告结构 |

## 领域总览

| 领域 | 篇数 | 索引 | 覆盖 |
|---|---|---|---|
| 工具箱 | 6 | [toolbox/index.md](toolbox/index.md) | 分诊决策、方法论、模式速查、工具选择/安装与出站通道。任何领域都能先经过这里，但不替代领域文档。 |
| Android / 移动端 | 34 | [android/index.md](android/index.md) | APK/AAB/DEX、Java/Kotlin 与 native 层、Frida、脱壳、TLS 拦截、iOS。桌面 PE/ELF 与通用 Frida API 归 native 域。 |
| Native / 二进制与主机 | 127 | [native/index.md](native/index.md) | PE/ELF/Mach-O、壳与反调试、ARM64、密码与 JVM 常量、PWN/利用、驱动、Windows/AD/内网、Linux/macOS/容器。 |
| Web 应用安全 | 131 | [web/index.md](web/index.md) | 前端 JS、API 黑盒、认证授权、注入、文件与请求层、缓存/WAF、业务逻辑、区块链。协议层归 protocol 域。 |
| AI / LLM 安全 | 17 | [ai-security/index.md](ai-security/index.md) | 提示注入、越狱、模型评测、防御画像、载体构造与拒答路由。只对自有或授权模型端点做评测。 |
| 恶意代码与取证 | 14 | [malware/index.md](malware/index.md) | 样本分析流程、分平台静态 playbook、内存取证、流量与隐写、IOC/VT 查询。 |
| 网络协议与流量 | 14 | [protocol/index.md](protocol/index.md) | PCAP/协议逆向、协议攻击、隧道与反弹 shell、供应链与源码暴露。应用层 Web 漏洞归 web 域。 |
| 证据链与报告 | 10 | [evidence/index.md](evidence/index.md) | Case 证据链、发现 schema/评分、报告模板、漏洞提交与复核。技术细节归各领域。 |

## 全量目录

### 工具箱（6）

#### 入口与决策

- [方法论 — 安全分析工作流](toolbox/methodology.md) — 分析流程、工具选择、环境配置、实战案例。按需读取，不强制执行。 *(方法论)*
- [Decision Tree — 安全分析路由](toolbox/decision-tree.md) — 拿到样本后，先走分诊决策树，再进入具体领域分析。 *(参考)*

#### 速查与选型

- [工具矩阵（Tool Matrix）](toolbox/tool-matrix.md) — 按任务分类，每类填「首选 | 替代 | 存证」。 *(手册)*
- [Patterns — 安全分析模式速查](toolbox/patterns.md) — 常见保护器签名、反分析技术、Patch 编码速查表。 *(手册)*

#### 环境与出站

- [出站通道规则 — 代理发现与直连回退](toolbox/network-egress.md) — 先探当前这台机器有没有可用代理，有就用，没有或连不上就直连。 *(参考)*
- [工具安装指南](toolbox/tool-install.md) — 安全工具的下载、安装、验证。按需读取。 *(参考)*

### Android / 移动端（34）

#### 方法论与总览

- [移动端常见安全模式](android/mobile-patterns.md) — 移动应用中常见的安全机制及其分析方法。 *(手册)*
- [移动端分析方法论](android/mobile-methodology.md) — 多路径分析决策指南。根据分析需求自动选择最佳分析路径。 *(方法论)*
- [移动端逆向核心原则](android/mobile-principles.md) — 从 secplan 领域编排器提取的通用方法论，去掉了任务编排与框架运行时引用。读完自行判断，非硬性规则。 *(方法论)*
- [Android 逆向工具安装与 CLI 参考](android/android-tools.md) — 移动端分析 Agent 的 Android 工具链参考。每个工具包含安装方法、常用命令和典型分析场景。 *(参考)*
- [APK Fingerprint 参考](android/fingerprint.md) — 判断 APK 的 framework / HTTP stack / 混淆强度，决定下一步走 Java 反编译还是换框架专用工具。 *(参考)*
- [Garlic — 快速 APK/DEX/JAR 反编译器 + ELF 分析器](android/garlic.md) — 世界最快的 APK/Java 开源反编译器，C 语言实现，多线程。 *(参考)*
- [iOS 逆向工具安装与 CLI 参考](android/ios-tools.md) — 移动端分析 Agent 的 iOS 工具链参考。 *(参考)*

#### Frida 与运行时

- [移动端 Frida 指南](android/mobile-frida.md) — 基于项目内置的 Frida 管理经验：默认端口和默认文件名极易被检测。 *(参考)*
- [Android 云端下发 ELF 卡密绕过 — 通用方法论](android/frida-license-bypass-android.md) — Android 云端下发 ELF 的卡密校验定位与绕过（模块枚举 / Hook / 内存扫描 / patch）。 *(手册)*
- [Android UI 自动化经验](android/android-ui-automation.md) — 通过 adb + uiautomator 实现非视觉的 Android GUI 操作。 *(参考)*
- [Frida 17.x API 变化速查（移动端补充）](android/frida-17x-api.md) — Frida 17.x API 变化速查：Module/Memory/Process/Bridge 与移动端迁移注意点。 *(参考)*
- [Frida 17.x Bridge 编译与使用指南（移动端）](android/frida-17x-bridge.md) — Frida 17.x Java/ObjC/Swift Bridge 的编译、注入与使用。 *(参考)*
- [Frida 动态分析：卡密验证绕过](android/frida-license-bypass.md) — 当静态分析受阻（字符串加密、代码混淆、VMP 保护）时，用 Frida hook API + 内存扫描提取验证逻辑。 *(手册)*
- [Frida Hook 核心原则与 Java Bridge 陷阱](android/frida-hook-principles.md) — 编写任何 Frida Hook 前必须掌握的 4 条铁律 + Java Bridge 6 个陷阱 + 通用检查清单。适配 frida 17.x。 *(方法论)*
- [Frida Hook 架构与模板](android/frida-hook-templates.md) — Hook 架构模式、标准 Hook 模板、拦截器链 Hook 模式、Native Hook 要点。适配 frida 17.x。 *(模板)*
- [Frida Script Templates for Android Testing](android/android-pentesting-tricks-frida-scripts.md) — 覆盖：UNIVERSAL SSL PINNING BYPASS / ROOT DETECTION BYPASS / METHOD TRACER / CRYPTO HOOK (KEY & PLAINTEXT EXTRACTION) *(手册)*

#### 脱壳、加固与反分析

- [Android 加固识别与脱壳](android/android-unpacking.md) — 常见加固方案识别特征 + Frida 内存 dump DEX 的 3 种策略 + 验证步骤。 *(参考)*
- [Android 云端下发 Native 二进制（Cloud-Native Binary）模式](android/android-cloud-native-binary.md) — APK 作为壳，真实逻辑由云端下发到应用私有目录后加载。 *(参考)*
- [Android ARM64 ELF Dropper: Runtime Memory Dump When Frida Fails](android/android-arm64-memory-dump.md) — Frida 失效时从 Android ARM64 进程内存 dump ELF dropper，并重建可分析镜像。 *(参考)*
- [Android ARM64 ELF Malware Analysis](android/android-elf-malware-analysis.md) — Android ARM64 ELF 恶意样本（游戏外挂/工具）的静态与动态分析。 *(参考)*
- [Android ARM64 Shellcode Anti-Analysis & Card-Key Protection](android/android-shellcode-anti-analysis.md) — 多层混淆的 Android ARM64 dropper 与卡密保护 shellcode 的反分析流程。 *(参考)*
- [Android Magisk Module 分析](android/android-root-module-analysis.md) — 分析 Magisk / KernelSU / APatch 模块 ZIP 与仓库：结构、权限、持久化与风险点。 *(参考)*

#### APK 恶意代码分析

- [androguard APK 分析 (无 Java 环境 fallback)](android/androguard-apk-fallback.md) — 当 jadx/apktool 不可用（Java 未安装）时，用 Python androguard 做静态分析。 *(参考)*
- [Android 深链劫持与广播接收器攻击 (2024-2026 赏金模式)](android/android-deeplink-broadcast-attacks.md) — 多个应用可注册相同自定义 scheme(myapp://)或相同 http host。恶意应用先注册(或更高优先级)拦截 OAuth 回调、支付深链、找回密码链接，导致账户接管。仅 2.2% 应用通过 App Links 验证。 *(手册)*
- [Android APK 恶意代码分析](android/android-apk-malware-analysis.md) — APK 静态分析方法论：权限审计、DEX 模式搜索、源码对比、已知后门模式识别。 *(参考)*
- [Android APK 恶意代码检测方法论](android/android-apk-malware-detection.md) — 对比 GitHub 源码与编译后 APK 的类列表，检测是否有打包时注入的隐藏代码。 *(参考)*
- [Android ContentObserver 循环触发 Bug 检测](android/android-contentobserver-loop-bug.md) — Android 应用中 ContentObserver 注册后未正确管理 ignoreChanges 标志，导致写入操作触发 onChange 回调，形成读取-写入-触发的无限循环。 *(参考)*

#### 流量与 TLS

- [移动端 MITM 方案选型指南](android/mitm-methodology.md) — 移动应用流量拦截的方案选择和常见陷阱。适用于：需要拦截/篡改移动应用的 HTTPS 通信。 *(方法论)*
- [移动端 SSL Pinning 绕过](android/mobile-ssl-pinning-bypass.md) — 移动端 SSL pinning 绕过 playbook：识别实现、Frida Hook 与改包重签流程。 *(手册)*
- [Flutter 应用 SSL Pinning Bypass 方法论](android/flutter-ssl-bypass.md) — Flutter 应用的 SSL pinning 在 native 层实现（libflutter.so），不经过 Java TLS。本文档描述完整的定位和绕过流程。 *(手册)*
- [TLS 流量拦截模式](android/tls-traffic-interception.md) — 通过 Frida Hook connect/read 系统调用，追踪 SSL 连接并识别 TLS 记录类型。适用于：需要拦截移动应用的 HTTPS 流量（通常与 SSL bypass 配合使用）。 *(参考)*

#### iOS

- [iOS 渗透测试](android/ios-pentesting-tricks.md) — iOS 渗透 playbook：keychain、URL scheme、Universal Links、运行时操控与数据保护。 *(手册)*
- [iOS Runtime Tricks — Frida Recipes, Objection Reference & Hooking Patterns](android/ios-pentesting-tricks-ios-runtime-tricks.md) — 覆盖：FRIDA RECIPES FOR iOS / OBJECTION COMMAND REFERENCE FOR iOS / RUNTIME HOOKING PATTERNS / COMMON iOS TESTING WORKFLOWS *(手册)*

#### 外部 playbook

- [Android Pentesting Tricks — Expert Attack Playbook](android/android-pentesting-tricks.md) — Android 渗透 playbook：SSL pinning、导出组件、WebView、Intent 重定向与本地数据。 *(手册)*

### Native / 二进制与主机（127）

#### 入口与方法论

- [结果验证完整方案](native/verification-patterns.md) — 结果验证：正向/负向对照、复现命令与判据。 *(手册)*
- [样本接管流程（Intake Playbook）](native/sample-intake-playbook.md) — 拿到样本后「四问 → 启动协议 → 信号路由 → 分轨 → 质量门禁 → 交付」的完整流程。按需读，非硬性规则。 *(手册)*
- [游戏安全方法论](native/game-security-methodology.md) — 游戏逆向、反作弊绕过、内存分析系统化流程 *(方法论)*
- [Native / 二进制逆向核心原则](native/native-principles.md) — 从 secplan 领域编排器提取的通用方法论，去掉了任务编排与框架运行时引用。读完自行判断，非硬性规则。 *(方法论)*

#### 案例与实战

- [案例：Android ARM64 卡密验证绕过（宝塔内核 shell）](native/bypass-case-bt-kami.md) — Android ARM64 宝塔内核 shell 场景下的卡密校验绕过案例。 *(案例)*
- [案例：GHLoader DLL 注入器卡密绕过（Windows PE）](native/bypass-case-gh-loader-aimbot.md) — Windows PE GHLoader DLL 注入器的卡密校验绕过案例。 *(案例)*
- [案例：Shellcode 加载型验证（cpurender）](native/bypass-case-cpu-render-shellcode.md) — cpurender shellcode 加载型卡密验证的定位与绕过案例。 *(案例)*
- [案例：TUSI-ObfuscatorClang 保护的 Android .so 卡密分析](native/bypass-case-tusi-netease.md) — TUSI-ObfuscatorClang 保护的 Android .so 卡密分析与绕过案例。 *(案例)*
- [GHLoader (neteasefuture.exe) 完整逆向案例](native/gh-loader-anti-frida-case.md) — 网易云音乐 AI 自瞄辅助工具的 loader + DLL 注入器。本案例记录了从资源提取到 DLL 解密、从 Frida 强反调试到静态分析的完整流程。 *(案例)*
- [Native 逆向案例与流程](native/native-casebook.md) — 从 secplan methodology 提取的通用逆向流程与实战案例，去掉工具环境配置与框架引用。读完自行判断，非硬性规则。 *(案例)*

#### 保护、壳与反调试

- [代码混淆与反混淆](native/code-obfuscation-deobfuscation.md) — 控制流、字符串、常量与自修改代码的混淆识别和去混淆流程。 *(参考)*
- [反调试技术](native/anti-debugging-techniques.md) — 反调试检测与绕过：ptrace/PEB/时序/异常等检测点及对应绕过。 *(手册)*
- [反调试绕过方法论](native/anti-debug-methodology.md) — 检测与绕过常见反调试技术的系统化流程 *(方法论)*
- [加壳/混淆二进制处理策略](native/packer-handling.md) — 加壳检测后：定位 OEP、dump、修复与静态兜底策略。 *(参考)*
- [卡密/License 验证绕过工作流](native/license-bypass-workflow.md) — 原理：程序读取本地配置文件决定是否跳过验证。 *(方法论)*
- [模型/数据文件解密密钥运行时捕获](native/model-decryption-key-capture.md) — 目标程序包含加密的模型/数据文件（如 .aes、.enc、.bin），静态分析无法提取密钥时加载本文档。 *(参考)*
- [商业级加固标准 → ELF 保护适配](native/commercial-hardening-standards.md) — 关键：不同失败原因 → 相同外部行为。攻击者无法区分"解密失败"和"正常运行"。 *(参考)*
- [Anti-Debug Technique × OS × Detection × Bypass — Comprehensive Matrix](native/anti-debugging-techniques-anti-debug-matrix.md) — Linux/Windows 反调试技术 × 检测 × 绕过 × 工具兼容性矩阵。 *(手册)*
- [Anti-Frida DLL 绕过的替代方案](native/anti-frida-workarounds.md) — 当 DLL 有强反调试/反 Frida 机制时，反复 attach 会导致进程崩溃。本文档总结绕过 Frida 检测的替代分析路径。 *(参考)*
- [ELF VMP (Virtual Machine Protection) 架构与实现](native/vmp-elf-protection.md) — SHVMP 项目实战经验。项目地址: https://github.com/ADWMC/shvmp *(参考)*
- [ELVMP 分析工作流](native/elvmp-analysis-workflow.md) — SHVMP v3.0 保护的 .elvmp 文件分析方法论。基于 ADLI.full.noad.elvmp 实战（2026-07）。 *(方法论)*
- [Memory.patchCode Bypass — When API Hooks Fail](native/memory-patchcode-bypass.md) — API Hook 失效时的 Memory.patchCode 绕过与验证。 *(手册)*
- [PE/ELF 保护检测方法论](native/protection-detection-methodology.md) — 检测和分析常见二进制保护器：UPX, VMProtect, Themida, OLLVM, TUSI *(方法论)*
- [processpatch.py 完整参数参考](native/process-patch-reference.md) — 通用进程 Patch + 值捕获工具。替代手写 ctypes 脚本（OpenProcess/VirtualProtectEx/WriteProcessMemory 等样板代码）。 *(参考)*
- [VMProtect PE + Frida 动态分析（Windows 桌面）](native/vmp-pe-frida-windows.md) — 适用场景：VMP 加壳的 Windows PE 程序（.winlice + .boot 节），需要在 Windows 桌面机上动态分析。 *(参考)*
- [VMProtect PE 快速识别与决策](native/vmp-pe-fast-triage.md) — VMProtect PE 快速识别：先处理 Defender，再按 URL/域名/strings 信号决定是否继续静态分析。 *(参考)*
- [Windows AV/EDR 规避](native/windows-av-edr-evasion.md) — 覆盖 AMSI/ETW 绕过、.NET 内存加载、shellcode 执行、进程注入、unhooking、载荷加密、签名规避 *(参考 / hack-skills)*
- [Zygisk Module License Bypass](native/zygisk-module-license-bypass.md) — Zygisk 模块卡密绕过：模块结构、license 校验与 patch。 *(手册)*

#### 静态分析、反编译与工具

- [动态分析策略 — Frida 模式（后备）](native/dynamic-analysis-frida.md) — Frida 动态分析后备流程：IDA 调试失败时的 attach/spawn、Hook 与验证。 *(参考)*
- [动态分析策略 — IDA 调试器（首选）](native/dynamic-analysis.md) — IDA 调试器动态分析首选流程：断点、调用跟踪与内存检查。 *(参考)*
- [固件/驱动 EEPROM 数据分析方法论](native/firmware-eeprom-analysis.md) — 分析驱动包中的加密 EEPROM 数据、固件 blob、校准文件的通用思路。适用于 WiFi/BT/网卡等外设驱动。 *(参考)*
- [固件分析方法论](native/firmware-analysis-methodology.md) — IoT/嵌入式固件逆向、提取、分析系统化流程 *(方法论)*
- [APK 签名验证与完整性校验模式](native/apk-signature-verification.md) — 典型的游戏 SDK APK 渠道签名验证类，位于 IIPS/Source/app/versionmanager/signature/ChannelInfoUtil.cpp。 *(参考)*
- [arm64 无符号逆向方法论](native/arm64-reverse-methodology.md) — 在无符号（stripped）的 arm64 二进制中定位函数和数据的实用方法。适用于 IDA Pro 分析 .so/.dylib 等无符号库。 *(方法论)*
- [ARM64 ADRP+ADD 字符串引用搜索](native/arm64-string-xref-search.md) — 当 r2 axt 或 IDA xref 找不到字符串引用时（常见于大文件或 stripped binary），手动搜索 ADRP+ADD 指令对。 *(参考)*
- [DLL Injection & Runtime Memory Patching with Frida](native/dll-injection-runtime-patching.md) — DLL 注入与运行时内存 patch：定位密钥、改写校验与验证。 *(参考)*
- [elf-got-patcher：ARM64 ELF GOT Hook 注入工具](native/elf-got-patcher.md) — 仓库：https://github.com/LeoChen-CoreMind/elf-got-patcher *(参考)*
- [Frida 17.x Android 兼容写法速查](native/frida-17x-android-compatible.md) — 覆盖：核心 API 变更 (17.x) / 通用 findExport 兼容函数 / Spawn + Child Gating (处理 fork) / 内存 Dump (17.x 写法) *(参考)*
- [Frida 17.x API 变化速查（通用）](native/frida-17x-api.md) — 从 frida 16.x 迁移到 17.x 时所有 API 变化的完整参考。适用于 PC 端（exe/dll/so/dylib）和移动端（APK/IPA）。 *(参考)*
- [Frida Hook 脚本模板](native/frida-hook-templates.md) — Frida Hook 架构模式与标准模板（Java / native / 拦截器链）。 *(模板)*
- [Frida Native Shell 技巧](native/frida-native-shell-tricks.md) — 在 Frida 中执行 shell 命令和 HTTP 请求的 native 方法。适用于：Java bridge 不可用或不稳定时（如 Flutter 应用、纯 native 进程）。 *(手册)*
- [Ghidra Headless 分析工作流](native/ghidra-headless-workflow.md) — headless 模式只支持 Java 脚本（extends GhidraScript），不支持 .py 脚本。 *(方法论)*
- [Ghidra Python 脚本速查](native/ghidra-python-reference.md) — 适用于 Ghidra 12.x headless 模式和 Ghidra GUI 内置脚本管理器 *(参考)*
- [IDAPython 脚本编码规范](native/idapython-conventions.md) — 适用于无人值守 IDA 分析所生成的所有 IDAPython 脚本。 *(参考)*
- [IDAPython 速查手册](native/idapython-reference.md) — IDAPython 速查：常用 API、脚本模式与无人值守注意事项。 *(参考)*
- [PE 资源段加密 Payload 提取与解密](native/pe-payload-extraction.md) — 当 PE 文件 .rsrc 段异常大（>5MB），或 FindResourceW/LoadResource 出现在导入表中时，很可能包含嵌入式加密 payload（DLL/配置/证书）。 *(参考)*
- [PE Loader + DLL 注入逆向分析](native/pe-loader-dll-injection.md) — 目标为 PE Loader / Dropper（大量资源嵌入）、DLL 注入器（CreateRemoteThread + LoadLibraryW）、卡密验证保护工具时加载本文档。 *(参考)*
- [PE Memory Dump Reconstruction](native/pe-memory-dump-reconstruction.md) — 内存 dump 重建为可分析 PE：节表、导入表与 RVA 修正。 *(参考)*
- [r2pipe 速查手册](native/r2pipe-reference.md) — radare2 Python API，通过 r2pipe 连接 r2 实例进行自动化分析 *(参考)*
- [radare2 + r2ghidra 安装与配置](native/radare2-windows-setup.md) — Windows 下 radare2 + r2ghidra 的安装、配置与验证。 *(参考)*
- [radare2 插件推荐清单](native/radare2-plugin-recommendations.md) — radare2 常用插件清单与适用场景。 *(参考)*
- [radare2 工作流 — IDA 不可用时的二进制分析替代方案](native/radare2-workflow.md) — 覆盖：安装 / 核心工具链 / 分析流程（推荐顺序） / r2 命令速查 *(方法论)*
- [Self-Extracting Shell Script Dropper Analysis](native/self-extracting-shellscript-analysis.md) — 自解压 shell 脚本 dropper 的识别、解包与行为分析。 *(参考)*
- [Unicorn 模拟执行脚本模板](native/unicorn-templates.md) — Unicorn 模拟执行脚本模板与算法验证流程。 *(模板)*
- [Windows 兼容性坑点汇总（2026-07-23 实测）](native/windows-compat-pitfalls.md) — Windows 10 + Git Bash (MSYS) 环境下工具链的已知兼容性问题。 *(参考)*

#### 密码、算法与常量

- [常见密码学验证模式](native/crypto-validation-patterns.md) — 常见密码学验证模式：算法识别、密钥与明密文校验。 *(手册)*
- [格密码攻击](native/lattice-crypto-attacks.md) — 格密码攻击：Coppersmith、DSA/ECDSA nonce、背包与 LWE。 *(手册)*
- [加密分析方法论](native/crypto-analysis-methodology.md) — 常见加密算法识别、密钥提取、编码解码系统化流程 *(方法论)*
- [Block Cipher Attacks — Detailed Scripts & Walkthrough](native/symmetric-cipher-attacks-block-cipher-attacks.md) — 分组密码攻击脚本与 walkthrough：CBC/ECB/CTR 场景。 *(手册)*
- [Classical Cipher Analysis — Expert Cryptanalysis Playbook](native/classical-cipher-analysis.md) — 古典密码识别与破解：替换、维吉尼亚、转置与 XOR。 *(参考)*
- [Custom XOR Cipher Reversal](native/custom-xor-cipher-reversal.md) — Some protectors use a repeating XOR key where the key state mutates after each byte. *(参考)*
- [ECDLP 求解指南](native/ecdlp-solving.md) — ECDLP 求解：曲线识别、求解器选择与渐进策略。 *(参考)*
- [ECDLP 特殊约束与渐进策略](native/ecdlp-special-cases.md) — 非标准 ECDSA 实现、渐进求解策略、常见陷阱。 *(案例)*
- [Hash Attack Techniques — Expert Cryptanalysis Playbook](native/hash-attack-techniques.md) — 哈希攻击：长度扩展、碰撞、HMAC 时序与 PoW。 *(手册)*
- [Pollard's rho 算法模板](native/ecdlp-pollard-rho.md) — Pollard's rho 的 ECDLP 并行实现与线程/DP 参数选择。 *(参考)*
- [RSA 攻击技术](native/rsa-attack-techniques.md) — RSA 参数弱点与攻击选择：小 n、共模、低指数、因子分解。 *(手册)*
- [RSA Attack Catalog — Detailed Implementations & Mathematics](native/rsa-attack-techniques-rsa-attack-catalog.md) — RSA 攻击目录：具体实现、数学推导与适用条件。 *(手册)*
- [Symmetric Cipher Attacks — Expert Cryptanalysis Playbook](native/symmetric-cipher-attacks.md) — 分组/流密码模式攻击：CBC padding、ECB 拼接、位翻转。 *(手册)*

#### JVM / Java

- [JVM Mod 常量加密 — Oracle 重放解密工作流](native/jvm-mod-deobf-workflow.md) — 适用：Minecraft Forge/Java mod、桌面 Java 应用里"常量池内嵌 DES 解密器 + 类拷贝模板"型混淆。 *(方法论)*

#### PWN、堆与利用

- [堆利用](native/heap-exploitation.md) — glibc 堆利用：UAF/double free/overflow 与 house-of 技术。 *(手册)*
- [二进制保护绕过](native/binary-protection-bypass.md) — ASLR/PIE/NX/canary/RELRO/CET 的保护识别与绕过。 *(手册)*
- [漏洞 PoC/检测脚本开发清单](native/exploit-dev-checklist.md) — 漏洞 PoC/检测脚本开发清单：结构、验证、安全边界与文档规范。 *(清单)*
- [栈溢出与 ROP](native/stack-overflow-and-rop.md) — 栈溢出与 ROP：canary/libc/PIE 泄露、链构造与 ret2libc。 *(参考)*
- [Advanced ROP Techniques — BROP, Partial Overwrite, JOP, COP](native/stack-overflow-and-rop-rop-advanced-techniques.md) — Exploit a remote stack overflow without access to the binary. Requires a service that forks (canary and ASLR layout persist across crashes). *(手册)*
- [angr Cookbook — Ready-to-Use Script Patterns for CTF Challenges](native/symbolic-execution-tools-angr-cookbook.md) — Scenario: Binary prints "Correct" at 0x401234, "Wrong" at 0x401300. Input via stdin. *(手册)*
- [Arbitrary Write to Code Execution — Expert Attack Playbook](native/arbitrary-write-to-rce.md) — Replace a function pointer in the Global Offset Table. *(参考)*
- [Browser / V8 Exploitation — Expert Attack Playbook](native/browser-exploitation-v8.md) — ArrayBuffer's backing store is a raw pointer to allocated memory. Corrupting it gives absolute memory R/W. *(手册)*
- [Format String Exploitation — Expert Attack Playbook](native/format-string-exploitation.md) — This requires finding existing pointer chains on the stack (e.g., saved frame pointers forming a chain: rbp → prevrbp → prevprevrbp). *(手册)*
- [glibc 2.35 Heap Exploitation Patterns](native/glibc-2.35-heap-exploitation.md) — mallochook, freehook, reallochook REMOVED in glibc 2.34+. Do not target them. *(手册)*
- [glibc 2.35 Tcache Exploitation Patterns](native/glibc-2.35-tcache-exploitation.md) — Target: Ubuntu 22.04, glibc 2.35-0ubuntu3, PIE + Full RELRO + NX + Canary *(手册)*
- [Heap CTF Pwn Patterns](native/heap-ctf-patterns.md) — Result: Node still accessible via path, content pointer dangling (UAF). *(手册)*
- [House of Techniques — Named Heap Exploitation Methods](native/heap-exploitation-house-of-techniques.md) — Overwrite top chunk size → control next allocation address. *(手册)*
- [IOFILE Exploitation — FSOP, Vtable Hijack, stdout/stdin Abuse](native/heap-exploitation-io-file-exploitation.md) — Overwrite IOlistall to insert a fake IOFILE, trigger flush → controlled vtable call. *(手册)*
- [Kernel Heap Techniques — SLUB, Cross-Cache, msgmsg, pipebuffer, skbuff](native/kernel-exploitation-kernel-heap-techniques.md) — Linux kernel uses SLUB (Unqueued Slab Allocator) for small kernel object allocation. *(手册)*
- [Kernel Mitigation Bypass — KASLR, SMEP, SMAP, KPTI, FG-KASLR, CFI](native/kernel-exploitation-kernel-mitigation-bypass.md) — Randomizes kernel .text base address at boot. Typical entropy: 9 bits (512 possible positions) on x86-64. *(手册)*
- [Linux 内核利用](native/kernel-exploitation.md) — Linux 内核漏洞利用：UAF/OOB/race、提权与缓解绕过。 *(手册)*
- [Protection Bypass Matrix — Comprehensive Cross-Reference](native/binary-protection-bypass-protection-bypass-matrix.md) — 覆盖：PROTECTION × BYPASS × PRIMITIVE MATRIX / COMBINED PROTECTION SCENARIOS / COMPILATION FLAGS REFERENCE / PROTECTION INTERACTION EFFECTS *(手册)*
- [Python Sandbox Escape (Pyjail) — Complete Methodology](native/sandbox-escape-techniques-python-sandbox-escape.md) — Some sandboxes parse the AST and block dangerous nodes. *(手册)*
- [Sandbox Escape — Expert Attack Playbook](native/sandbox-escape-techniques.md) — Python/Lua/seccomp/chroot/容器/浏览器沙箱逃逸。 *(手册)*
- [Seccomp Bypass — Architecture Confusion, iouring, Allowed Syscall Chaining](native/sandbox-escape-techniques-seccomp-bypass.md) — x8664 processes can invoke x86 (32-bit) syscalls using int 0x80. Syscall numbers differ between architectures. *(手册)*
- [Symbolic Execution Tools — Expert Analysis Playbook](native/symbolic-execution-tools.md) — This dramatically speeds up execution: concrete code runs natively via Unicorn, switching to symbolic only when symbolic variables are involved. *(参考)*
- [UAF + Tcache Count Corruption (glibc 2.27)](native/uaf-tcache-count-corruption.md) — glibc 2.27 tcache count 破坏导致的 UAF 利用与堆布局。 *(参考)*
- [V8 Exploitation Patterns — Heap Layout, GC Interaction, Sandbox Bypass](native/browser-exploitation-v8-v8-exploitation-patterns.md) — ArrayBuffer's backing store is external memory (not managed by V8 GC). Corrupting its pointer won't be affected by GC moves. *(手册)*
- [VM & Bytecode Reverse Engineering — Expert Analysis Playbook](native/vm-and-bytecode-reverse.md) — Operations work on a stack (like JVM or Python bytecode). *(参考)*
- [Windows 内核驱动逆向分析 — 双机调试方案](native/kernel-driver-analysis.md) — 当分析目标为 Windows 内核驱动（.sys），且 IDA 静态分析因 VMProtect 等混淆无法推进时， *(参考)*

#### Windows / AD / 内网 / 容器

- [容器逃逸技术](native/container-escape-techniques.md) — Classic escape for containers with CAPSYSADMIN + cgroup v1. *(手册)*
- [AD 本地提权清单](native/ad-lpe-checklist.md) — 用于 main document §9 的内网域与 LPE 路由。以"系统/主机"为单位全面覆盖（见 main document §0 目标单位定义）：一个系统覆盖其所有端口/服务/组件，不因端口不同而割裂。 *(清单)*
- [AD ACL Abuse — Expert Attack Playbook](native/active-directory-acl-abuse.md) — Write msDS-KeyCredentialLink on target → generate certificate → authenticate via PKINIT. *(参考)*
- [AD CS Attack Playbook — Expert Guide](native/active-directory-certificate-services.md) — Condition: Template allows enrollee to specify Subject Alternative Name (SAN) + client authentication EKU + low-privilege enrollment. *(参考)*
- [AD CS ESC1–ESC13 Quick Reference Matrix](native/active-directory-certificate-services-adcs-esc-matrix.md) — 覆盖：ESC VULNERABILITY MATRIX / ONE-LINER EXPLOITATION COMMANDS / DETECTION INDICATORS / TOOL COMPARISON *(手册)*
- [AD Kerberos 攻击](native/active-directory-kerberos-attacks.md) — Users with "Do not require Kerberos preauthentication" can be queried for AS-REP without knowing their password. *(手册)*
- [AMSI Bypass Techniques — Detailed Patterns](native/windows-av-evasion-amsi-bypass-techniques.md) — AMSI 绕过：AmsiScanBuffer patch、CLR 内存加载与检测规避。 *(手册)*
- [Authentication Coercion Methods](native/ntlm-relay-coercion-coercion-methods.md) — Exploits the File Server VSS Agent Service (requires the service to be running — common on file servers). *(参考)*
- [AV/EDR Evasion — Expert Attack Playbook](native/windows-av-evasion.md) — AMSI (Antimalware Scan Interface) inspects PowerShell, .NET, VBScript, JScript, and Office macros at runtime. *(参考)*
- [BloodHound Attack Paths & Cypher Queries](native/active-directory-acl-abuse-bloodhound-paths.md) — 覆盖：BLOODHOUND DATA COLLECTION BEST PRACTICES / ESSENTIAL CYPHER QUERIES / COMMON ATTACK PATH PATTERNS / CUSTOM BLOODHOUND QUERIES FOR SPECIFIC SCENARIOS *(参考)*
- [Credential Dumping Techniques](native/windows-lateral-movement-credential-dumping.md) — DPAPI protects browser passwords, Wi-Fi keys, credential manager entries, and more. *(参考)*
- [Docker Escape Chains & Kubernetes Escape Paths](native/container-escape-techniques-docker-escape-chains.md) — 覆盖：ESCAPE CHAIN: PRIVILEGED CONTAINER → HOST ROOT / ESCAPE CHAIN: DOCKER SOCKET → HOST ROOT / ESCAPE CHAIN: CGROUP RELEASEAGENT → HOST COMMAND EXECUTION / DOCKER-IN-DOCKER (DinD) ESCAPE *(手册)*
- [Dylib Hijacking & XPC Exploitation — Step-by-Step Techniques](native/macos-process-injection-dylib-xpc-techniques.md) — 覆盖：DYLIB HIJACKING METHODOLOGY / XPC EXPLOITATION WALKTHROUGH / MACH PORT TECHNIQUES / ELECTRON-SPECIFIC DEEP DIVE *(手册)*
- [Kerberos Multi-Step Attack Chains](native/active-directory-kerberos-attacks-kerberos-attack-chains.md) — Low-privilege domain user → cracked service account → delegation abuse → DA. *(手册)*
- [Kernel Exploits Checklist](native/linux-privilege-escalation-kernel-exploits-checklist.md) — 覆盖：KERNEL VERSION → EXPLOIT MAPPING TABLE / EXPLOIT COMPILATION TIPS / KERNEL EXPLOIT STABILITY NOTES / SPECIFIC EXPLOIT QUICK REFERENCES *(清单)*
- [Kubernetes 渗透](native/kubernetes-pentesting.md) — Bypass strategies: DNS exfiltration (port 53 rarely blocked), allowed port tunneling, pod in unprotected namespace, hostNetwork: true bypasses pod net… *(参考)*
- [Linux 横向移动](native/linux-lateral-movement.md) — 覆盖：SSH AGENT HIJACKING / SSH KEY HARVESTING / CREDENTIAL HARVESTING LOCATIONS / D-BUS EXPLOITATION *(参考)*
- [Linux 提权](native/linux-privilege-escalation.md) — 覆盖：ENUMERATION CHECKLIST / SUID/SGID EXPLOITATION / CAPABILITIES ABUSE / CRON / TIMER ABUSE *(参考)*
- [Linux Security Bypass — Expert Attack Playbook](native/linux-security-bypass.md) — Common AppArmor profile gaps: /proc/self/fd/ access, abstract Unix sockets, interpreter-based execution (python scripts bypass binary restrictions), a… *(手册)*
- [macOS Process Injection — Expert Attack Playbook](native/macos-process-injection.md) — Exploit the dynamic linker's library search order to load attacker-controlled dylibs instead of (or in addition to) legitimate ones. *(参考)*
- [macOS Security Bypass — Expert Attack Playbook](native/macos-security-bypass.md) — TCC is macOS's permission framework controlling access to sensitive resources (camera, microphone, contacts, full disk access, etc.). *(手册)*
- [NTLM Relay 与认证强制](native/ntlm-relay-coercion.md) — Capture SMB authentication, relay to LDAP (requires no LDAP signing enforcement). *(参考)*
- [SUID/SGID & Capabilities Exploitation Tricks](native/linux-privilege-escalation-suid-capabilities-tricks.md) — All commands below assume the binary has the SUID bit set (-rwsr-xr-x with root ownership). *(手册)*
- [TCC Bypass Matrix — Per-Version & Per-Protection Techniques](native/macos-security-bypass-tcc-bypass-matrix.md) — MDM-managed devices can push PPPC profiles that pre-approve TCC permissions without user consent. *(手册)*
- [Token Manipulation & Potato Family Detailed Comparison](native/windows-privilege-escalation-token-potato-tricks.md) — 覆盖：TOKEN PRIVILEGE PRIMER / POTATO FAMILY EVOLUTION / DETAILED COMPARISON MATRIX / TOOL USAGE — COMMAND REFERENCE *(手册)*
- [UAC Bypass Techniques Matrix](native/windows-privilege-escalation-uac-bypass-methods.md) — fodhelper.exe auto-elevates and checks HKCU:\Software\Classes\ms-settings\Shell\Open\command before launching. *(手册)*
- [Windows 驱动加密密钥提取方法论](native/windows-driver-crypto-extraction.md) — Windows 内核驱动（.sys）中硬编码了加密密钥（AES/DES/XOR），用于保护固件、配置文件、EEPROM 数据等。需要提取密钥以解密受保护数据。 *(参考)*
- [Windows Lateral Movement — Expert Attack Playbook](native/windows-lateral-movement.md) — Stealthy — uses legitimate COM objects, no service creation. *(参考)*
- [Windows Local Privilege Escalation — Expert Attack Playbook](native/windows-privilege-escalation.md) — Service accounts (IIS AppPool, MSSQL, etc.) typically hold SeImpersonatePrivilege. This enables impersonation of any token presented to you. *(参考)*

#### Android native / shellcode

- [Android ARM64 RWX Shellcode 分析实战](native/android-shellcode-analysis.md) — 检测命中 → b #exitfunc → writev "NBGEXIT:XX" → exitgroup(0) *(参考)*
- [Android ARM64 Shellcode 分析: 反调试 + 直接系统调用 + 自修改代码](native/android-arm64-shellcode-analysis.md) — 实战案例: NBG.sh 恶意软件 (Telegram 分发, 游戏外挂投放器) *(参考)*
- [NBG 案例：Android ARM64 Shellcode + 卡密保护 + 腾讯游戏外挂](native/nbg-android-shellcode-case.md) — 0x3268cc 处: cmp w16, w17; b.eq #0x3268e4 *(案例)*

### Web 应用安全（131）

#### 方法论、侦察与 JS 逆向

- [被动侦察](web/passive-recon.md) — 被动侦察：搜索引擎、证书、历史数据与第三方泄露面。 *(参考 / AboutSecurity)*
- [多步骤攻击编排模式](web/attack-orchestration.md) — 多步骤攻击编排参考。当单步攻击无法完成目标时，需要通过多个窗口/页面之间的协作来编排攻击链。 *(参考)*
- [来自前端 JS 逆向 - 用户服务](web/api-dictionary.md) — 前端 JS 中提取的 API/参数/存储键字典，供黑盒测试复用。 *(参考)*
- [浏览器调试与自动化 — CDP / Playwright / DevTools API](web/browser-debugging.md) — 需要自动化 Chrome 行为、远程执行 JS、控制调试器时使用。 *(参考)*
- [目标画像](web/target-profiling.md) — 本文档与 recon-full（主动扫描）互补：recon-full 负责「发现」，target-profiling 负责「分析和整理」。如果还没做侦察，先执行 recon-full。 *(参考 / AboutSecurity)*
- [逆向分析结果视频化工作流](web/video-production-workflow.md) — 将前端JS逆向、API黑盒测试等技术分析结果，转化为短视频内容 *(方法论)*
- [社会工程](web/social-engineering.md) — ⛔ 深入参考：钓鱼邮件模板、pretexting 话术、凭据猜测脚本、水坑攻击方法见 下文「REF: social-engineering-techniques」 *(参考 / AboutSecurity)*
- [完整侦察流程](web/recon-full.md) — 本文档是渗透测试的标准第一步，目标是从域名/IP 出发，尽可能多地发现资产和漏洞。 *(参考 / AboutSecurity)*
- [侦察与方法论路由](web/recon-for-sec.md) — 新目标 / 未知攻击面的侦察入口。 *(参考)*
- [租号/账号租赁系统安全分析模式](web/rental-system-exploitation.md) — 适用目标：Steam租号、游戏账号租赁、验证码查询等平台。 *(手册)*
- [API 安全路由](web/api-sec.md) — API 安全测试路由：recon / auth / BOLA / 隐藏参数的选择。 *(参考)*
- [API Fuzz](web/api-fuzz.md) — 重点路径：/api/, /v1/, /v2/, /graphql, /rest/ *(参考 / AboutSecurity)*
- [API Recon and Docs — Endpoints, Schemas, and Version Surface](web/api-recon-and-docs.md) — API 侦察与文档：端点、schema、版本与隐藏面。 *(参考)*
- [Bot 模式分类与识别](web/bot-patterns.md) — Bot 快速分类参考。聚焦 Bot 代码结构分析和模式快速识别。 *(手册)*
- [CRMEB E-commerce System Reconnaissance](web/crmeb-recon.md) — 适用目标：基于 CRMEB（开源新零售社交电商系统）搭建的商城 *(参考)*
- [Frontend JS 逆向分析](web/frontend-js-reverse.md) — 前端 JS 逆向：定位入口、还原混淆、抽取 API 与签名参数。 *(参考)*
- [GraphQL 方法论](web/graphql.md) — 常见路径: /graphql, /api/graphql, /graphiql, /v1/graphql, /query *(参考 / AboutSecurity)*
- [GraphQL and Hidden Parameters — Introspection, Batching, and Undocumented Fields](web/graphql-and-hidden-parameters.md) — GraphQL introspection/batching 与隐藏参数发现。 *(参考)*
- [HackSkills 路由](web/pentest-router.md) — Bug bounty / Web / API 渗透的顶层路由。 *(参考)*
- [JavaScript 混淆模式识别与反混淆](web/js-obfuscation-patterns.md) — 分析 JS 逆向题/恶意脚本/混淆代码时使用。 *(手册)*
- [JS API 提取](web/js-api-extract.md) — 前后端分离架构中，JS bundle 是 API 端点的最大信息源——比目录扫描高效 10 倍。 *(参考 / AboutSecurity)*
- [Next.js App Router 安全分析方法论](web/nextjs-analysis.md) — Next.js App Router 安全分析参考。聚焦 App Router 模式的安全分析，包括 RSC/flight data 分析、nodemodules 源码审计、middleware 审计。 *(参考)*
- [Recon and Methodology — Expert Bug Bounty Playbook](web/recon-and-methodology.md) — Bug bounty 侦察方法论：子域、端口、指纹与资产优先级。 *(方法论)*
- [SPA/前端框架安全分析方法论](web/spa-frontend-analysis.md) — 前端框架（SvelteKit、React SPA 等）安全分析参考。聚焦无后端数据库、数据全部存在客户端的场景（localStorage/sessionStorage）。 *(参考)*
- [V2Board Penetration Testing Reference](web/v2board-recon.md) — V2Board 面板侦察与 CORS/API 攻击面。 *(参考)*
- [Web 安全分析方法论](web/web-methodology.md) — Web 测试方法论：白盒/黑盒路径、输入追踪与验证顺序。 *(方法论)*
- [Web 安全分析核心原则](web/web-principles.md) — 从 secplan 领域编排器提取的通用方法论，去掉了任务编排与框架运行时引用。读完自行判断，非硬性规则。 *(方法论)*
- [Web 渗透测试清单](web/pentest-web-checklist.md) — 用于 main document §9 的 Web 域路由。覆盖 OWASP Top 10 主线，并强调前端 JS 深度分析与架构梳理。以"系统/主机"为单位全面覆盖其所有端口/服务/组件。 *(清单)*
- [Web API 黑盒漏洞测试方法论](web/api-blackbox-testing.md) — 实战总结的 PHP/Web API 黑盒安全测试流程。适用于没有源码、只有 URL 的场景。 *(参考)*
- [Web API Recon & Chain Exploitation Patterns](web/web-api-recon-patterns.md) — Web API 侦察与链式利用模式：令牌泄露、对象枚举与越权。 *(手册)*

#### 认证、授权与会话

- [401/403 Bypass Techniques — Expert Attack Playbook](web/401-403-bypass.md) — 401/403 绕过：路径变形、方法/头/编码与代理差异。 *(手册)*
- [认证与授权路由](web/auth-sec.md) — 认证与授权测试路由：登录、会话、JWT、OAuth、CORS、CSRF。 *(参考)*
- [移动端后端 API](web/mobile-backend.md) — 移动后端 API 和传统 Web 的区别：移动端通常直接调用 REST API（不经过浏览器），认证机制、参数格式、业务逻辑都有移动端特色。 *(参考 / AboutSecurity)*
- [API Auth and JWT Abuse — Token Trust, Header Tricks, and Rate Limits](web/api-auth-and-jwt-abuse.md) — API 认证与 JWT 滥用：token 信任、头伪造与限速绕过。 *(参考)*
- [API Authorization and BOLA — Object Access, Function Access, and Mass Assignment](web/api-authorization-and-bola.md) — API 授权与 BOLA：对象/功能级越权与批量赋值。 *(参考)*
- [Authentication Bypass — Expert Attack Playbook](web/authbypass-authentication-flaws.md) — After reducing routing entries, default credentials, username variants, port focus, and wordlist sizing are handled here in one place. *(手册)*
- [Clickjacking — Expert Attack Playbook](web/clickjacking.md) — Clickjacking loads a target page in a transparent iframe overlaid on an attacker's page.… *(参考)*
- [Cookie 分析](web/cookie-analysis.md) — 覆盖：When to Use / Step 1: Extract the cookie / Step 2: Identify cookie type / Step 3: Common bypass patterns *(参考 / AboutSecurity)*
- [CORS Misconfiguration — Credentialed Origins, Reflection, and Trust Boundary Errors](web/cors-cross-origin-misconfiguration.md) — Some origin validators normalize Unicode after comparison, while the browser sends the original — or vice versa. *(参考)*
- [CORS Misconfiguration — Extended Scenarios](web/cors-cross-origin-misconfiguration-scenarios.md) — 主文档扩展：JSONP hijacking, same-origin policy deep dive, and real-world exploitation patterns. *(手册)*
- [CSRF — Cross-Site Request Forgery — Expert Attack Playbook](web/csrf.md) — CSRF exploits a victim's active session to perform state-changing requests from the attacker's origin. *(参考)*
- [IDOR 不安全直接对象引用方法论](web/idor.md) — IDOR 测试：参数包装/编码/HPP/方法切换、批量检测与标识符可预测性。 *(参考 / hack-skills)*
- [JWT 攻击方法论](web/jwt-attack.md) — JWT 攻击：算法混淆、kid/jku/x5u 注入与离线爆破。 *(参考 / hack-skills)*
- [OAuth Token 攻击](web/oauth-token-attacks.md) — 适用场景：应用支持 Login with Google/GitHub/Microsoft/Okta 等 IdP；URL 出现 authorize/callback/redirecturi/code/state/nonce/codechallenge；移动端或 SPA 依赖 OAuth/OIDC 流。 *(手册 / hack-skills)*
- [OAuth/SSO 攻击方法论](web/oauth-sso-attack.md) — 点击「第三方登录」，观察重定向 URL 中的 clientid, redirecturi, responsetype, scope, state。 *(参考 / AboutSecurity)*
- [SAML SSO and Assertion Attacks — Signature Validation, Binding, and Trust Confusion](web/saml-sso-assertion-attacks.md) — SAML SSO 断言攻击：签名校验、绑定与信任混淆。 *(手册)*
- [Web 权限提升](web/privilege-escalation-web.md) — Web 权限提升和系统提权不同——不需要 exploit，只需要找到应用逻辑中的权限检查漏洞。 *(参考 / AboutSecurity)*

#### 注入与反序列化

- [表达式语言注入](web/expression-language-injection.md) — 关键区分：SSTI 针对模板渲染引擎；EL 注入针对 Java 框架中嵌入的表达式求值器。 *(参考 / AboutSecurity)*
- [反序列化方法论](web/deserialization.md) — 常见位置：Cookie 值、POST Body、Hidden 表单字段（viewstate）、API 参数、文件上传 *(参考 / AboutSecurity)*
- [原型链污染利用](web/prototype-pollution-exploit.md) — 核心原理：通过修改 Object.prototype，向所有 JavaScript 对象注入恶意属性 *(参考 / AboutSecurity)*
- [注入测试路由](web/injection-checking.md) — 注入测试路由：按解释器/执行环境选择测试。 *(参考)*
- [Advanced XSS Tricks — Supplementary Reference](web/xss-advanced-xss-tricks.md) — Browser HTML parser "fixes" markup differently than sanitizers expect, causing benign-looking HTML to mutate into executable payloads after DOM insert… *(手册)*
- [CRLF Injection — Expert Attack Playbook](web/crlf-injection.md) — 覆盖：CORE CONCEPT / DETECTION / EXPLOITATION SCENARIOS / FILTER BYPASS *(参考)*
- [CSV Formula Injection](web/csv-formula-injection.md) — Routing note: when testing CSV exports, back-office reports, or user data opened in spreadsheets, prioritize these prefix characters. *(参考)*
- [Email Header Injection — Expert Attack Playbook](web/email-header-injection.md) — SMTP headers are separated by CRLF (\r\n). If user input is placed into email headers without sanitization, injecting %0d%0a (or \r\n) adds arbitrary … *(参考)*
- [ENGINEPAYLOADS.md — Extended SSTI Fingerprinting & Payload Matrix](web/ssti-engine-payloads.md) — 主文档扩展：per-engine payloads, fingerprint probes, and blind SSTI detection techniques. *(参考)*
- [Extra Injection Types — SSI, LDAP, XPath](web/injection-checking-extra-injection-types.md) — 主文档扩展：injection types that are less common in modern web apps but still appear in specific technology stacks. *(参考)*
- [HTTP Parameter Pollution (HPP)](web/http-parameter-pollution.md) — Hypothesis: the security check reads one occurrence of a parameter while the action reads another. *(参考)*
- [Insecure Deserialization — Expert Attack Playbook](web/deserialization-insecure.md) — Key classes in the chain: InvokerTransformer → ChainedTransformer → TransformedMap → triggers Runtime.exec() during deserialization. *(参考)*
- [Java 反序列化方法论](web/java-deserialization.md) — Java 反序列化是 Java 生态中最危险的漏洞类之一——一旦成功通常直接 RCE。 *(参考 / AboutSecurity)*
- [Java Gadget Chains & Cross-Language Deserialization Deep Dive](web/deserialization-insecure-java-gadget-chains.md) — Recommended priority: CC6 → CC7 → CC5 (broadest compatibility, no JDK version constraint). *(手册)*
- [JNDI Injection — Expert Attack Playbook](web/jndi-injection.md) — JNDI (Java Naming and Directory Interface) provides a unified API for looking up objects from naming/directory services (RMI, LDAP, DNS, CORBA). *(参考)*
- [LDAP 注入](web/ldap-injection.md) — LDAP（轻量目录访问协议）广泛用于企业用户认证和目录查询。当应用将用户输入直接拼接到 LDAP 搜索过滤器中时，攻击者可以修改查询逻辑来绕过认证或提取目录数据。 *(参考 / AboutSecurity)*
- [NoSQL 注入](web/nosql-injection.md) — NoSQL 数据库（MongoDB 为主）使用结构化查询对象而非 SQL 字符串，但这不意味着安全——当应用直接将用户输入拼接到查询对象中时，攻击者可以注入查询操作符来改变查询逻辑。 *(参考 / AboutSecurity)*
- [OS Command Injection — Expert Attack Playbook](web/command-injection.md) — Other sinks (quick reference): PDF generators (wkhtmltopdf / WeasyPrint with user HTML); Git wrappers (git clone URL / hooks). *(参考)*
- [PHP 类型混淆](web/php-type-juggling.md) — 只要 $storedhash 的 MD5 恰好是 0e 开头纯数字，攻击者只需输入任何一个已知 MD5 也是 0e 开头纯数字的字符串。 *(参考 / AboutSecurity)*
- [PHP 绕过](web/php-bypass.md) — 当你已获取 webshell（能执行 PHP 代码）但无法执行系统命令时，本文档 指导你突破 disablefunctions 和 openbasedir 限制。 *(手册 / AboutSecurity)*
- [PHP Type Juggling — Weak Comparison & Magic Hash Bypass](web/type-juggling.md) — First-pass goal: prove the server branch treats unequal secrets/tokens as equal via coercion, not guess the real password. *(参考)*
- [Prototype Pollution — Expert Attack Playbook](web/prototype-pollution.md) — Routing note: prioritize PP when you see deep merges, recursive assign, JSON.parse followed by Object.assign, or URL queries converted to nested objec… *(参考)*
- [Prototype Pollution — Known Gadgets Reference](web/prototype-pollution-advanced-known-gadgets.md) — 原型链污染 known gadgets：Angular sandbox、DOM XSS 与常见库利用链。 *(手册)*
- [Prototype Pollution Advanced — RCE & Gadget Exploitation](web/prototype-pollution-advanced.md) — Detection: any EJS res.render() call after pollution triggers it. *(手册)*
- [Python 原型链污染](web/python-prototype-pollution.md) — Python 原型链污染（又称 Class Pollution / Attribute Injection）利用 Python 类继承和 globals 机制，通过递归合并函数或深度属性设置函数（如 pydash.set()），从一个普通对象"跳出"当前作用域，修改全局变量、Flask 配置、Jin… *(参考 / AboutSecurity)*
- [Python Web 调试](web/python-web-debug.md) — Werkzeug debugger 在 Debug 模式下提供交互式 Python console，但自 Werkzeug 0.11+ 起需要 PIN 码验证。 *(参考 / AboutSecurity)*
- [SQL 注入完整方法论](web/sql-injection.md) — SQL 注入完整方法论：判据、数据库指纹、盲注与 sqlmap 配合。 *(参考 / hack-skills)*
- [SQL Injection — Extended Scenarios & Real-World Cases](web/sql-injection-scenarios.md) — 主文档扩展：additional attack scenarios, CVE case studies, and injection techniques from real-world engagements. *(手册)*
- [SQLMap Advanced Workflow & Deep SQL Injection Techniques](web/sql-injection-sqlmap-advanced.md) — Tamper scripts modify payloads to evade WAF/IDS. Stack multiple with commas. *(手册)*
- [SSRF — Extended Scenarios & Real-World Cases](web/ssrf-scenarios.md) — 主文档扩展：additional CVE case studies, advanced bypass techniques, and chaining scenarios. *(手册)*
- [SSRF 攻击方法论](web/ssrf.md) — 配套：ssrf-scenarios.md（WebLogic/Redis RCE 链/DNS Rebinding/K8s CVE）、ssrf-url-parser-tricks.md（各语言 URL 解析差异表 + 全云元数据目录）。 *(参考 / hack-skills)*
- [SSTI — Extended Scenarios & Real-World Cases](web/ssti-scenarios.md) — 主文档扩展：additional CVE cases, PHP template exploitation, and expression language crossover scenarios. *(手册)*
- [SSTI 服务端模板注入方法论](web/ssti.md) — SSTI：引擎识别、payload 矩阵与各框架/CVE 场景。 *(参考 / hack-skills)*
- [URL Parser Differentials & Advanced SSRF Techniques](web/ssrf-url-parser-tricks.md) — Different URL parsers interpret ambiguous URLs differently. This is the core of SSRF filter bypass. *(手册)*
- [XML External Entity Injection (XXE) — Expert Attack Playbook](web/xxe.md) — Then rewrite body as XML — many backends use dual-format parsers or auto-detect. *(参考)*
- [XSLT 注入测试方法论](web/xslt-injection.md) — XSLT 注入：引擎能力、payload 分类与验证。 *(参考 / hack-skills)*
- [XSS — Extended Scenarios & Real-World Cases](web/xss-scenarios.md) — 主文档扩展：additional attack scenarios, CVE case studies, and defense bypass techniques. *(手册)*
- [XSS 跨站脚本完整方法论](web/xss.md) — XSS：上下文判据、CSP/框架绕过与利用链。 *(参考 / hack-skills)*
- [XXE — Extended Scenarios & Real-World Cases](web/xxe-scenarios.md) — 主文档扩展：additional CVE case studies and exploitation techniques. *(手册)*

#### 文件、路径与信息泄露

- [路径穿越 / LFI](web/path-traversal-lfi.md) — Path Traversal: Read arbitrary files by escaping the intended directory with ../ sequences. *(参考)*
- [文件访问路由](web/file-access-vuln.md) — 文件访问/上传/下载/预览测试路由。 *(参考)*
- [文件上传方法论](web/file-upload.md) — 上传链路测试：解析、存储、执行与绕过。 *(参考 / AboutSecurity)*
- [信息泄露方法论](web/information-disclosure.md) — → 源码恢复详细步骤 → 下文对应 REF 章节 *(参考 / AboutSecurity)*
- [Open Redirect — Expert Attack Playbook](web/open-redirect.md) — Open redirect occurs when an application redirects users to a URL derived from user input without validation.… *(参考)*
- [Upload Insecure Files — Extended Scenarios & Real-World Cases](web/upload-insecure-files-scenarios.md) — 主文档扩展：parsing vulnerabilities, PUT method attacks, and CVE case studies. *(手册)*
- [Upload Insecure Files — Validation Bypass, Storage Abuse, and Processing Chains](web/upload-insecure-files.md) — Many targets validate only one stage. The bug usually appears in a different stage than the one where the file was uploaded. *(参考)*

#### 请求层、缓存与 WAF

- [缓存投毒与请求走私](web/cache-poisoning-smuggling.md) — 两种相关但不同的高级 Web 攻击技术，都利用了多层 Web 架构中的解析差异。 *(参考 / AboutSecurity)*
- [子域名接管](web/subdomain-takeover.md) — 影响：cookie 窃取（父域 cookie）、OAuth token 拦截、可信域名钓鱼、CORS 绕过、CSP 绕过。 *(参考 / AboutSecurity)*
- [子域名深度枚举](web/subdomain-deep.md) — ⛔ 深入参考：subfinder/ksubdomain/amass 的完整参数、通配符过滤脚本、多工具联合流程见 下文「REF: enumeration-tools」 *(参考 / AboutSecurity)*
- [CSP Bypass — Advanced Techniques](web/csp-bypass-advanced.md) — Critical insight: base-uri, form-action, and frame-ancestors do NOT fall back to default-src. Their absence is always a potential bypass vector. *(手册)*
- [CSP（Content Security Policy）绕过技术](web/csp-bypass.md) — CSP 通过 HTTP 响应头 Content-Security-Policy 告诉浏览器哪些资源可以加载/执行。 *(手册)*
- [Dangling Markup Injection — Exfiltration Without JavaScript](web/dangling-markup-injection.md) — Core insight: You don't need JavaScript to exfiltrate data — you just need the browser to make a request that includes the data in the URL. *(参考)*
- [DNS Rebinding — Expert Attack Playbook](web/dns-rebinding-attacks.md) — Key insight: SOP checks the hostname string, not the resolved IP. DNS can change the IP behind the same hostname. *(手册)*
- [Ghost Bits / Cast Attack — Java char to byte Narrowing Playbook](web/ghost-bits-cast-attack.md) — not a standalone vulnerability class. Whenever you see (1) a Java backend, *(参考)*
- [Ghost Bits Cast Attack — Payload Cookbook](web/ghost-bits-cast-attack-payload-cookbook.md) — main document is already in context AND you need (a) a complete *(手册)*
- [Host 头攻击](web/http-host-header-attacks.md) — 如果应用不验证 Host header，攻击者可以操纵它来投毒链接、缓存或路由。 *(手册 / AboutSecurity)*
- [HTTP 请求走私](web/request-smuggling.md) — Routing note: load this document when you suspect CDN/reverse-proxy and origin disagree on request-end boundaries, or when abnormal concatenation appe… *(参考)*
- [HTTP/2 Smuggling Variants & Advanced Desync Techniques](web/request-smuggling-h2-smuggling-variants.md) — HTTP/2 specification forbids transfer-encoding in H2 frames. However, some front-end proxies don't strip it when downgrading to H1.… *(手册)*
- [HTTP/2 Specific Attacks — Expert Attack Playbook](web/http2-specific-attacks.md) — h2c is HTTP/2 without TLS, negotiated via the HTTP/1.1 Upgrade mechanism.… *(手册)*
- [WAF 绕过方法论](web/waf-bypass.md) — WAF 识别、语法变形与分块/编码绕过。 *(手册 / AboutSecurity)*
- [WAF Bypass Techniques — Evasion Playbook](web/waf-bypass-techniques.md) — WAFs that inspect the full body may not reassemble chunks before matching. *(手册)*
- [WAF Bypass: Digit-Anchored Regex Filters](web/waf-bypass-digit-regex.md) — Match condition: String contains a digit, followed by at least 1 char, then a non-digit, then at least 1 more char. Minimum 4 characters. *(手册)*
- [WAF Product Bypass Matrix](web/waf-bypass-techniques-waf-product-matrix.md) — 按 WAF 产品对照绕过语法：Cloudflare/AWS/ModSecurity/Akamai。 *(手册)*
- [Web 缓存欺骗](web/web-cache-deception.md) — Cache keys typically include: Host, URL path, query string. *(参考)*
- [Web 漏洞扫描](web/web-vuln-scan.md) — 与 recon-full（广度优先、资产发现）不同，本文档是深度优先——对已确定的单个 Web 目标做全面漏洞测试。 *(参考 / AboutSecurity)*
- [Web Cache Poisoning 专题](web/cache-poisoning.md) — Web Cache Poisoning 深度参考。 *(参考)*
- [Web Cache Poisoning Techniques — Advanced Reference](web/web-cache-deception-cache-poisoning-techniques.md) — These are distinct attack classes — do not confuse them. *(手册)*
- [Webshell 部署](web/webshell-deploy.md) — 当漏洞利用需要上传/写入 webshell 时，按此方法论操作。 *(参考 / AboutSecurity)*
- [Webshell 管理](web/webshell-management.md) — 前置条件：webshell 已部署到目标。本文档 聚焦部署后的 CLI 交互与管理操作。 *(参考 / AboutSecurity)*
- [WebSocket 攻击](web/websocket-attack.md) — WebSocket 提供全双工通信，但安全机制常被忽略——没有同源策略的自动保护、没有 CSRF token 的标准实践。 *(参考 / AboutSecurity)*

#### 业务逻辑与平台测试

- [竞态条件](web/race-condition.md) — TOCTOU means the decision (check) and the mutation (use) are not one indivisible step. *(参考)*
- [业务逻辑攻击](web/business-logic-attack.md) — 业务逻辑漏洞的本质是：应用在服务端没有正确校验业务规则，导致攻击者可以通过修改请求参数来违反预期的业务流程。这类漏洞 WAF 和自动化扫描器几乎无法检测——因为每个请求看起来都是"正常"的 HTTP 请求。 *(参考 / AboutSecurity)*
- [业务逻辑漏洞](web/business-logic-vulnerabilities.md) — Impact: Receive credit to account, items for free, bank transfers in reverse. *(参考)*
- [业务逻辑漏洞测试方法论](web/web-business-logic-vulns.md) — 业务逻辑漏洞无固定签名，几乎无法被自动化工具发现，依赖业务深度理解 *(参考 / hack-skills)*
- [业务逻辑路由](web/business-logic-vuln.md) — 业务逻辑与状态机测试路由。 *(参考)*
- [Business Logic Vulnerabilities — Extended Scenarios](web/business-logic-vulnerabilities-scenarios.md) — 业务逻辑漏洞场景集：支付、验证码、认证与数据暴露的真实案例。 *(手册)*
- [Business Logic Vulnerability Checklist / 业务逻辑漏洞检查清单](web/business-logic-vulnerabilities-checklist.md) — 业务逻辑漏洞检查清单：按流程/状态/权限逐项核对。 *(清单)*
- [Business Logic Vulnerability Testing Methodology / 业务逻辑漏洞测试方法论](web/business-logic-vulnerabilities-methodology.md) — 业务逻辑测试方法论：状态机、并发、权限与数据边界。 *(方法论)*
- [OWASP WSTG 渗透测试实战案例](web/owasp-wstg-case-study.md) — OWASP WSTG 实战案例：信息泄露链、FOFA 与 PHP API 枚举。 *(案例)*
- [Web 漏洞模式速查](web/web-vulnerabilities.md) — 漏洞模式速查。每个漏洞类型包含：识别方法、利用思路、关键检查点。 *(参考)*
- [Web 平台全量安全审计方法论](web/web-platform-testing.md) — 针对前后端分离的 Web 管理平台的端到端安全审计流程。适用于 FastAPI/Django/Node.js + React/Vue 技术栈。 *(参考)*

#### 区块链与智能合约

- [智能合约漏洞](web/smart-contract-vulnerabilities.md) — Contract A calls Contract B, which calls back into Contract A (or Contract C that reads A's stale state).… *(参考)*
- [DeFi 攻击模式](web/defi-attack-patterns.md) — Flash loans provide uncollateralized borrowing within a single transaction.… *(手册)*
- [Solidity Vulnerability Patterns — Code Reference](web/smart-contract-vulnerabilities-solidity-vuln-patterns.md) — Tool to check: cast sig "functionName(argTypes)" computes selector. *(手册)*

### AI / LLM 安全（17）

#### 方法论与防御

- [模型安全分析指南](ai-security/model-security-analysis-guide.md) — 面向 LLM 模型本身的安全分析（非应用层）。覆盖模型拒绝行为分类、越狱技术、架构发现、挑战设计方法。 *(参考)*
- [模型防线画像速查](ai-security/model-defense-profiles.md) — opencode-go 提供商三模型的已知防线特性。攻击前查阅，避免重复探测。 *(参考)*
- [AI / LLM 安全分析核心原则](ai-security/ai-principles.md) — 从 secplan 领域编排器提取的通用方法论，去掉了任务编排与框架运行时引用。读完自行判断，非硬性规则。 *(方法论)*
- [AI 安全防御方案](ai-security/ai-security-defense.md) — LLM 应用的提示注入防御：输入层、System Prompt、输出层、架构层。 *(参考)*
- [LLM 攻击方法论](ai-security/llm-attack-methodology.md) — AI 安全分析的通用攻击方法论：如何识别 LLM 应用攻击面、构造 payload、验证结果。 *(方法论)*

#### 注入、越狱与载体

- [高质量载体构造指南](ai-security/carrier-construction-guide.md) — LLM 提示注入攻击的载体构造方法：如何生成高质量载体、验证载体质量、选择注入位置。 *(参考)*
- [拒答恢复提示词路由](ai-security/refusal-prompt-routing.md) — 该路由用于真实 llm/stream 请求的受控恢复和模型安全评测。它根据上游拒答信号和原任务意图选择恢复提示词，不回放拒答原文，不要求模型暴露隐藏推理，也不把恢复流程用于绕过模型安全边界。 *(参考)*
- [提示注入模式速查](ai-security/prompt-injection-patterns.md) — LLM 提示注入的常见模式、Payload 模板和适用场景。 *(手册)*
- [Bypass 框架速查矩阵](ai-security/bypass-framework-matrix.md) — 模型层越狱攻击的系统化框架选择指南。基于 35 轮 opencode-go 三模型实战验证。 *(手册)*
- [Jailbreak Patterns — Categorized Technique Reference](ai-security/llm-prompt-injection-jailbreak-patterns.md) — 按类别整理的越狱技术目录：多步升级、角色扮演、编码与边界绕过。 *(手册)*
- [LLM 提示注入攻击面](ai-security/llm-injection-playbook.md) — 覆盖直接/间接注入、工具调用滥用、数据外传、MCP 风险、防御绕过、测试方法 *(手册 / hack-skills)*
- [LLM Prompt Injection — Expert Attack Playbook](ai-security/llm-prompt-injection.md) — LLM 提示注入与越狱载荷总览：直接/间接注入、工具调用、数据外传、多步升级。 *(参考)*

#### 评测、工作流与模型面

- [罐头工作流槽位（Canned Workflow Slots）](ai-security/canned-workflows.md) — 高频归一化目标直接映射确定性输出槽——不经过模型自由发挥，保证复现一致。 *(方法论)*
- [输入归一化词表（Input Normalization Lexicon）](ai-security/input-normalization-lexicon.md) — FIRST PASS 的展开词表：口语/边界词 → 本地分析标签，再按标签实施技术交付。 *(参考)*
- [注入效果真实性评估方法论](ai-security/payload-effectiveness-evaluation.md) — LLM 提示注入攻击的效果评估方法：如何判断注入是否"看起来真实"。 *(参考)*
- [AI/ML 模型安全](ai-security/ml-model-security.md) — 覆盖模型供应链、对抗样本、投毒、窃取、数据隐私、智能体安全 *(参考 / hack-skills)*
- [AI/ML Security — Expert Attack Playbook](ai-security/ai-ml-security.md) — AI/ML 安全攻击面：供应链、对抗样本、投毒、模型窃取与隐私。 *(参考)*

### 恶意代码与取证（14）

#### 方法论与响应

- [恶意软件分析方法论](malware/malware-analysis-methodology.md) — 静态分析 + 动态分析 + IOC 提取系统化流程 *(方法论)*
- [恶意样本案例工作流与 IOC 归因](malware/malware-case-workflow.md) — 覆盖案例目录、多阶段处理、IOC 提取、家族归因、REPORT/AGENTS 输出规范 *(案例)*
- [样本分析与应急响应](malware/incident-response.md) — 基于 15 本逆向分析/安全书籍蒸馏的实战文档 *(参考)*

#### 静态 playbook

- [Android APK 恶意样本静态分析 Playbook](malware/malware-static-playbook-apk.md) — 适用于 APK、split APK、DEX/JAR 派生的 Android 代码、Android 阶段载荷 *(手册)*
- [ELF / Mach-O / Unix 载荷静态分析 Playbook](malware/malware-static-playbook-elf-macho.md) — 适用于 Linux ELF、macOS Mach-O / fat Mach-O、Unix shell 载荷、内嵌 shell 脚本、Unix 侧加载器 *(手册)*
- [Office 与脚本投放器静态分析 Playbook](malware/malware-static-playbook-office-script.md) — 适用于 OLE / OOXML / RTF / VBA / VBS / VBE / JS / JSE / HTA / WSF / WSH / PowerShell / BAT / CMD / 脚本投放器 *(手册)*
- [Web 载荷与源码投放器静态分析 Playbook](malware/malware-static-playbook-web-payload.md) — 适用于 HTML / HTM / MHTML / SVG / XML / XSL / JS / TS / PHP / Python / Perl / Ruby / Lua / Node.js / JSP / ASP / ASPX / webshell / 源码投放器 *(手册)*
- [Windows PE / .NET 恶意样本静态分析 Playbook](malware/malware-static-playbook-pe.md) — 适用于 EXE / DLL / 驱动 / shellcode 片段 / PE 资源 / .NET 程序集 *(手册)*

#### 内存取证

- [内存取证（Volatility 3）](malware/memory-forensics-volatility.md) — Volatility 3 内存取证：进程、注入、网络与恶意痕迹。 *(参考)*
- [VOLATILITY CHEATSHEET — Vol2 / Vol3 Command Reference](malware/memory-forensics-volatility-volatility-cheatsheet.md) — Supplementary reference for memory-forensics-volatility. Quick-access command tables. *(手册)*

#### 流量、隐写与查询

- [流量分析与 PCAP 取证](malware/traffic-analysis-pcap.md) — 覆盖：PCAP REPAIR / WIRESHARK ESSENTIAL FILTERS / PROTOCOL ANALYSIS / DATA EXTRACTION *(参考)*
- [隐写分析技术](malware/steganography-techniques.md) — 隐写分析：LSB、文件结构、图像/音频/文档隐藏数据。 *(手册)*
- [STEGANOGRAPHY TOOLS GUIDE](malware/steganography-techniques-stego-tools-guide.md) — Supplementary reference for steganography-techniques. Installation and detailed usage for each tool. *(手册)*
- [VirusTotal 样本查询](malware/vt-lookup.md) — VirusTotal 样本查询操作指南：检测统计、家族标签、文件名与情报提取。 *(参考)*

### 网络协议与流量（14）

#### 抓包与协议逆向

- [流量分析与 PCAP 取证](protocol/traffic-analysis-pcap.md) — 覆盖 PCAP 修复、Wireshark 过滤、协议分析、数据提取、隐蔽信道检测、tshark 命令行 *(参考 / hack-skills)*
- [协议逆向方法论](protocol/protocol-reverse-methodology.md) — 覆盖：一、信息收集 / 二、字段识别 / 三、状态机推断 / 四、加密/编码检测 *(方法论)*

#### 协议攻击与服务暴露

- [网络协议攻击](protocol/network-protocol-attacks.md) — 二层/三层协议攻击：ARP、LLMNR/NBT-NS、DHCPv6、WPAD。 *(手册)*
- [DNS Rebinding](protocol/dns-rebinding.md) — 通过 DNS 操纵绕过同源策略的客户端侧攻击 *(参考 / hack-skills)*
- [HTTP/2 协议层攻击面](protocol/http2-attacks.md) — 覆盖 h2c 走私、伪头注入、HPACK 攻击、多路复用竞态、H2→H1 降级缺陷 *(手册 / hack-skills)*
- [NAME RESOLUTION POISONING — Responder & mitm6 Deep Dive](protocol/network-protocol-attacks-name-resolution-poisoning.md) — Supplementary reference for network-protocol-attacks §2–§4.… *(手册)*
- [PORT / SERVICE EXPLOITATION MATRIX](protocol/unauthorized-access-common-services-port-service-matrix.md) — Supplementary reference for unauthorized-access-common-services. Organized by port for rapid triage during service enumeration. *(手册)*
- [Unauthorized Access to Common Services — Expert Attack Playbook](protocol/unauthorized-access-common-services.md) — 常见服务未授权访问：端口矩阵、协议指纹与利用路径。 *(参考)*
- [WebSocket Security](protocol/websocket-security.md) — Routing note: in Burp/browser DevTools, filter for 101 and Upgrade: websocket; for deeper API testing, align authn/authz models through api-sec. *(参考)*

#### 隧道、代理与反弹

- [反弹 Shell 技术](protocol/reverse-shell-techniques.md) — 覆盖：REVERSE vs BIND SHELL DECISION / ENCRYPTED SHELLS / WEB SHELLS / PTY UPGRADE SEQUENCE *(手册)*
- [隧道与横向移动](protocol/tunneling-and-pivoting.md) — 隧道与横向：端口转发、SOCKS、代理链与出站规避。 *(参考)*
- [REVERSE SHELL CHEATSHEET](protocol/reverse-shell-techniques-shell-cheatsheet.md) — Supplementary reference for reverse-shell-techniques. Replace ATTACKER with your IP and PORT with your listener port. *(手册)*

#### 供应链与源码暴露

- [Dependency Confusion — Supply Chain Attack Playbook](protocol/dependency-confusion.md) — 依赖混淆：私有/公共包索引与版本范围导致的供应链投毒。 *(参考)*
- [Insecure Source Code Management](protocol/insecure-source-code-management.md) — Routing note: quickly probe these paths first; for full recon workflow, load methodology from recon-for-sec and recon-and-methodology before deeper te… *(参考)*

### 证据链与报告（10）

#### 证据链与工作流

- [建议账本与核销（Advisory Ledger）](evidence/advisory-ledger.md) — 建议账本：注入建议的采纳/核销签名与统计。 *(参考)*
- [漏洞复核](evidence/vulnerability-review.md) — 覆盖：Triage questions / Common vulnerability classes / Root-cause workflow / Severity structure *(参考)*
- [逆向分析工作流](evidence/workflow.md) — 逆向分析工作流：范围确认、静态/动态、验证与收口。 *(方法论)*
- [逆向技术参考](evidence/reverse-techniques.md) — 逆向工作流参考：静态优先分诊、反编译、动态调试与加壳/混淆处理。 *(手册)*

#### 发现结构与知识库

- [漏洞发现 Schema 与严重度评分](evidence/finding-schema-severity.md) — 通用发现结构与 CVSS 3.1 / OWASP 风险评分 *(模板)*
- [漏洞知识库 Schema](evidence/vuln-kb-schema.md) — 跨系统复用的漏洞知识库条目结构：元数据、根因、影响、复现与修复。 *(模板)*

#### 报告、提交与模板

- [报告模板 — 安全分析标准化输出](evidence/reporting.md) — 安全分析报告模板：结论、证据、复现、影响与修复。 *(参考)*
- [漏洞奖励计划提交辅助](evidence/vuln-reward-submission.md) — 漏洞奖励提交辅助：是否建议提交、字段如何如实填写。 *(模板)*
- [漏洞奖励计划自查结果](evidence/vuln-reward-result-template.md) — 漏洞奖励提交前的自查结果模板：结论、证据缺口与审核保留项。 *(模板)*
- [渗透测试报告模板](evidence/pentest-report-template.md) — 渗透测试报告模板：范围、发现、证据、复现与修复建议的标准结构。 *(模板)*

## 维护

- 新增/删除/重命名正文后运行生成器，索引与文件必须一一对应；`pnpm test:checks` 会校验。
- 摘要优先取正文首段；首段是导航时退回 H2 大纲。特殊文档在生成器 `SUMMARY_OVERRIDES` 中校正。
- 分类规则在 `DOMAINS[].groups`；未分类文件会让生成器直接失败，避免静默漏项。