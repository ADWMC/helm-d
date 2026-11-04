# Android / 移动端 参考索引

> 自动生成，勿手改。共 **34** 篇；总索引：[../index.md](../index.md)。重新生成：`node scripts/gen-references-index.mjs`。

**职责边界**：APK/AAB/DEX、Java/Kotlin 与 native 层、Frida、脱壳、TLS 拦截、iOS。桌面 PE/ELF 与通用 Frida API 归 native 域。

**先读**：[APK Fingerprint 参考](./fingerprint.md) · [移动端分析方法论](./mobile-methodology.md) · [移动端 SSL Pinning 绕过](./mobile-ssl-pinning-bypass.md) · [Android 加固识别与脱壳](./android-unpacking.md) · [Frida Hook 核心原则与 Java Bridge 陷阱](./frida-hook-principles.md) · [Android 逆向工具安装与 CLI 参考](./android-tools.md)

## 方法论与总览（7）

| 文档 | 讲什么 | 类型 |
|---|---|---|
| [移动端常见安全模式](./mobile-patterns.md) | 移动应用中常见的安全机制及其分析方法。 | 手册 |
| [移动端分析方法论](./mobile-methodology.md) | 多路径分析决策指南。根据分析需求自动选择最佳分析路径。 | 方法论 |
| [移动端逆向核心原则](./mobile-principles.md) | 从 secplan 领域编排器提取的通用方法论，去掉了任务编排与框架运行时引用。读完自行判断，非硬性规则。 | 方法论 |
| [Android 逆向工具安装与 CLI 参考](./android-tools.md) | 移动端分析 Agent 的 Android 工具链参考。每个工具包含安装方法、常用命令和典型分析场景。 | 参考 |
| [APK Fingerprint 参考](./fingerprint.md) | 判断 APK 的 framework / HTTP stack / 混淆强度，决定下一步走 Java 反编译还是换框架专用工具。 | 参考 |
| [Garlic — 快速 APK/DEX/JAR 反编译器 + ELF 分析器](./garlic.md) | 世界最快的 APK/Java 开源反编译器，C 语言实现，多线程。 | 参考 |
| [iOS 逆向工具安装与 CLI 参考](./ios-tools.md) | 移动端分析 Agent 的 iOS 工具链参考。 | 参考 |

## Frida 与运行时（9）

| 文档 | 讲什么 | 类型 |
|---|---|---|
| [移动端 Frida 指南](./mobile-frida.md) | 基于项目内置的 Frida 管理经验：默认端口和默认文件名极易被检测。 | 参考 |
| [Android 云端下发 ELF 卡密绕过 — 通用方法论](./frida-license-bypass-android.md) | Android 云端下发 ELF 的卡密校验定位与绕过（模块枚举 / Hook / 内存扫描 / patch）。 | 手册 |
| [Android UI 自动化经验](./android-ui-automation.md) | 通过 adb + uiautomator 实现非视觉的 Android GUI 操作。 | 参考 |
| [Frida 17.x API 变化速查（移动端补充）](./frida-17x-api.md) | Frida 17.x API 变化速查：Module/Memory/Process/Bridge 与移动端迁移注意点。 | 参考 |
| [Frida 17.x Bridge 编译与使用指南（移动端）](./frida-17x-bridge.md) | Frida 17.x Java/ObjC/Swift Bridge 的编译、注入与使用。 | 参考 |
| [Frida 动态分析：卡密验证绕过](./frida-license-bypass.md) | 当静态分析受阻（字符串加密、代码混淆、VMP 保护）时，用 Frida hook API + 内存扫描提取验证逻辑。 | 手册 |
| [Frida Hook 核心原则与 Java Bridge 陷阱](./frida-hook-principles.md) | 编写任何 Frida Hook 前必须掌握的 4 条铁律 + Java Bridge 6 个陷阱 + 通用检查清单。适配 frida 17.x。 | 方法论 |
| [Frida Hook 架构与模板](./frida-hook-templates.md) | Hook 架构模式、标准 Hook 模板、拦截器链 Hook 模式、Native Hook 要点。适配 frida 17.x。 | 模板 |
| [Frida Script Templates for Android Testing](./android-pentesting-tricks-frida-scripts.md) | 覆盖：UNIVERSAL SSL PINNING BYPASS / ROOT DETECTION BYPASS / METHOD TRACER / CRYPTO HOOK (KEY & PLAINTEXT EXTRACTION) | 手册 |

## 脱壳、加固与反分析（6）

| 文档 | 讲什么 | 类型 |
|---|---|---|
| [Android 加固识别与脱壳](./android-unpacking.md) | 常见加固方案识别特征 + Frida 内存 dump DEX 的 3 种策略 + 验证步骤。 | 参考 |
| [Android 云端下发 Native 二进制（Cloud-Native Binary）模式](./android-cloud-native-binary.md) | APK 作为壳，真实逻辑由云端下发到应用私有目录后加载。 | 参考 |
| [Android ARM64 ELF Dropper: Runtime Memory Dump When Frida Fails](./android-arm64-memory-dump.md) | Frida 失效时从 Android ARM64 进程内存 dump ELF dropper，并重建可分析镜像。 | 参考 |
| [Android ARM64 ELF Malware Analysis](./android-elf-malware-analysis.md) | Android ARM64 ELF 恶意样本（游戏外挂/工具）的静态与动态分析。 | 参考 |
| [Android ARM64 Shellcode Anti-Analysis & Card-Key Protection](./android-shellcode-anti-analysis.md) | 多层混淆的 Android ARM64 dropper 与卡密保护 shellcode 的反分析流程。 | 参考 |
| [Android Magisk Module 分析](./android-root-module-analysis.md) | 分析 Magisk / KernelSU / APatch 模块 ZIP 与仓库：结构、权限、持久化与风险点。 | 参考 |

## APK 恶意代码分析（5）

| 文档 | 讲什么 | 类型 |
|---|---|---|
| [androguard APK 分析 (无 Java 环境 fallback)](./androguard-apk-fallback.md) | 当 jadx/apktool 不可用（Java 未安装）时，用 Python androguard 做静态分析。 | 参考 |
| [Android 深链劫持与广播接收器攻击 (2024-2026 赏金模式)](./android-deeplink-broadcast-attacks.md) | 多个应用可注册相同自定义 scheme(myapp://)或相同 http host。恶意应用先注册(或更高优先级)拦截 OAuth 回调、支付深链、找回密码链接，导致账户接管。仅 2.2% 应用通过 App Links 验证。 | 手册 |
| [Android APK 恶意代码分析](./android-apk-malware-analysis.md) | APK 静态分析方法论：权限审计、DEX 模式搜索、源码对比、已知后门模式识别。 | 参考 |
| [Android APK 恶意代码检测方法论](./android-apk-malware-detection.md) | 对比 GitHub 源码与编译后 APK 的类列表，检测是否有打包时注入的隐藏代码。 | 参考 |
| [Android ContentObserver 循环触发 Bug 检测](./android-contentobserver-loop-bug.md) | Android 应用中 ContentObserver 注册后未正确管理 ignoreChanges 标志，导致写入操作触发 onChange 回调，形成读取-写入-触发的无限循环。 | 参考 |

## 流量与 TLS（4）

| 文档 | 讲什么 | 类型 |
|---|---|---|
| [移动端 MITM 方案选型指南](./mitm-methodology.md) | 移动应用流量拦截的方案选择和常见陷阱。适用于：需要拦截/篡改移动应用的 HTTPS 通信。 | 方法论 |
| [移动端 SSL Pinning 绕过](./mobile-ssl-pinning-bypass.md) | 移动端 SSL pinning 绕过 playbook：识别实现、Frida Hook 与改包重签流程。 | 手册 |
| [Flutter 应用 SSL Pinning Bypass 方法论](./flutter-ssl-bypass.md) | Flutter 应用的 SSL pinning 在 native 层实现（libflutter.so），不经过 Java TLS。本文档描述完整的定位和绕过流程。 | 手册 |
| [TLS 流量拦截模式](./tls-traffic-interception.md) | 通过 Frida Hook connect/read 系统调用，追踪 SSL 连接并识别 TLS 记录类型。适用于：需要拦截移动应用的 HTTPS 流量（通常与 SSL bypass 配合使用）。 | 参考 |

## iOS（2）

| 文档 | 讲什么 | 类型 |
|---|---|---|
| [iOS 渗透测试](./ios-pentesting-tricks.md) | iOS 渗透 playbook：keychain、URL scheme、Universal Links、运行时操控与数据保护。 | 手册 |
| [iOS Runtime Tricks — Frida Recipes, Objection Reference & Hooking Patterns](./ios-pentesting-tricks-ios-runtime-tricks.md) | 覆盖：FRIDA RECIPES FOR iOS / OBJECTION COMMAND REFERENCE FOR iOS / RUNTIME HOOKING PATTERNS / COMMON iOS TESTING WORKFLOWS | 手册 |

## 外部 playbook（1）

| 文档 | 讲什么 | 类型 |
|---|---|---|
| [Android Pentesting Tricks — Expert Attack Playbook](./android-pentesting-tricks.md) | Android 渗透 playbook：SSL pinning、导出组件、WebView、Intent 重定向与本地数据。 | 手册 |
