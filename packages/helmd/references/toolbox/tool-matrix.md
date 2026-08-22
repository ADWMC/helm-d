# 工具矩阵（Tool Matrix）

按任务分类，每类填「首选 | 替代 | 存证」。

## 快速导航

| 文档 | 内容 |
|------|------|
| [decision-tree.md](decision-tree.md) | 分诊决策树 — 拿到样本后先走这里 |
| [methodology.md](methodology.md) | 方法论 — 分析流程、工具选择、实战案例 |
| [patterns.md](patterns.md) | 模式速查 — 保护器签名、反分析技术、Patch 编码 |
| [tool-matrix.md](tool-matrix.md) | 本文 — 工具推荐矩阵 |

## 总则：工具获取

**旅程：环境判断 → 下载 → 调用测试 → 记录可用性**

1. **环境判断**：先查本机是否已有该工具（`where` / `Get-Command` / `--version` / `pip show`），有则直接调用，记录版本与路径。
2. **本机没有**：选除 C 盘外剩余空间最大的盘，创建 `X:\Reverse\` 放工具，不往 C 盘堆大文件。
3. **下载尽量走代理**（如 `http://127.0.0.1:7897`）；GitHub / PyPI 超时先挂代理再试。
4. **调用测试**：脚本类 `--help` 试跑；构建类先查工具链（cargo / cmake / maven / gcc）；跑不起来记录原因。
5. **记录结果**：可用 / 需构建 / 需修复，写回本表「本机工具状态」。

### 本机工具状态（2026-08-16 检测 + 调用测试）

| 工具 | 状态 |
|------|------|
| jadx / apktool / radare2 / frida / frida-ps / adb / gdb / scrapling / nook-cli | 已装 (scoop/pip) |
| androguard 4.1.4 / headless-ida 0.6.7 / capstone / unicorn / angr / keystone / lief | 已装 (pip) |
| IDA Pro 9.4 (E:) / Ghidra (E:) / obscura (E:) / Android SDK+NDK r29 (G:) | 已装 (目录) |
| ip_checker | 可用 (--help 通过) |
| WeakPassDetect | 可用 (--help 通过, v1.2.0) |
| pe-inspector | 可用 (--help 通过, 完整跑需模型文件) |
| CipherBridge | 可用 (引擎初始化成功) |
| VMPStaticUnpacker | 已修复可用 (加 future annotations) |
| WeChat-lm | 已装 (pip install wechat-lm 2.0.0) |
| HashDump-BypassEDR | 可用 (BootKey.exe: release 下载 + gcc 编译) |
| fernflower | 已构建可用 (JDK21 gradlew build, 反编译测试通过) |
| x64dbg-mcp | 已装 (release dp32/dp64 → x64dbg plugins) |
| unidbg | 已构建 (mvnw package, 修复 pom+Module import) |
| rustFrida | 已下载 (release rustfrida, ELF ARM64, adb push 到设备) |
| x64dbg | 已装 (release snapshot 解压, x64dbg.exe + x64gui.dll) |

## 1. 分诊（Triage）

| 任务 | 首选 | 替代 | 存证 |
|---|---|---|---|
| 文件类型识别 | `file` 命令 | `triage_artifact` | 文件类型 |
| SHA-256 哈希 | `hash_artifact` | `sha256sum` / `Get-FileHash` | 哈希值 |
| 离线分诊 | `triage_artifact` | 手动 `xxd` / `strings` | 魔数/熵/字符串 |
| 加壳检测 | `detect_packer` | `Detect It Easy` / `exepipe` | 保护器类型 |
| 字符串提取 | `scan_strings` | `strings` / `rafind2` | ASCII/UTF-16LE 字符串 |

## 2. Android

| 任务 | 首选 | Releases 下载 | 存证 |
|---|---|---|---|
| **APK/DEX 快速反编译** | [garlic](https://github.com/neocanable/garlic) (C, 200MB/12s) | [Releases](https://github.com/neocanable/garlic/releases) | Java 源码 |
| **JAR 快速反编译** | [garlic](https://github.com/neocanable/garlic) | [Releases](https://github.com/neocanable/garlic/releases) | Java 源码 |
| **字符串搜索** | garlic `-f "pattern"` (正则) | [Releases](https://github.com/neocanable/garlic/releases) | 匹配结果 |
| **aarch64 ELF 分析** | garlic `-n` | [Releases](https://github.com/neocanable/garlic/releases) | ELF 分析报告 |
| APK 深度反编译 | [jadx](https://github.com/skylot/jadx) | [Releases](https://github.com/skylot/jadx/releases) | Java 源码 + 交叉引用 |
| APK 解包 / 重打包 | [apktool](https://github.com/ibotpeaches/apktool) | [Releases](https://github.com/ibotpeaches/apktool/releases) | smali / 资源 |
| APK 静态分析 | [androguard](https://github.com/androguard/androguard) | pip install | manifest / 调用图 |
| SO 模拟执行 | [unidbg](https://github.com/zhkl0228/unidbg) | [Releases](https://github.com/zhkl0228/unidbg/releases) | 调用序列 / trace |
| Java 字节码反编译 | [fernflower](https://github.com/jetBrains/fernflower) | [Releases](https://github.com/jetBrains/fernflower/releases) | Java 源码 |
| Android ARM64 插桩 | [rustFrida](https://github.com/kkkbbb/rustFrida) | [Releases](https://github.com/kkkbbb/rustFrida/releases) | hook log / stack / 参数 |
| 动态插桩 | rustFrida | [Releases](https://github.com/kkkbbb/rustFrida/releases) | hook log / stack |
| spawn 注入 | rustFrida `--spawn` | [Releases](https://github.com/kkkbbb/rustFrida/releases) | 启动期 hook 点 |

## 3. Web / JavaScript

| 任务 | 首选 | Releases 下载 | 存证 |
|---|---|---|---|
| 网页抓取 / 反爬 | [Scrapling](https://github.com/d4vinci/Scrapling) | pip install | HTML / JSON / 文章 |
| 微信小程序逆向 | [WeChat-lm](https://github.com/HSGQSRGS/WeChat-lm) | pip install | 解包产物 / HTML+JSON 报告 |
| IP 存活检测 | [ip_checker](https://github.com/test692618/ip_checker) | [Releases](https://github.com/test692618/ip_checker/releases) | 存活/不可达结果 + 统计 |
| 加解密 / 签名 | [CipherBridge](https://github.com/CuriousLearnerDev/CipherBridge) | [Releases](https://github.com/CuriousLearnerDev/CipherBridge/releases) | 解密结果 / 密钥 / 算法 |

## 4. Native / 二进制

| 任务 | 首选 | Releases 下载 | 存证 |
|---|---|---|---|
| IDA 无界面脚本 | [headless-ida](https://github.com/DennyDai/headless-ida) | pip install | 反汇编 / 反编译产物 |
| 命令行逆向 | [radare2](https://github.com/radareorg/radare2) | [Releases](https://github.com/radareorg/radare2/releases) | 函数 / xrefs / 段 |
| r2 反编译 | radare2 + r2ghidra | [Releases](https://github.com/radareorg/radare2/releases) | 伪代码 |

## 5. Windows

| 任务 | 首选 | Releases 下载 | 存证 |
|---|---|---|---|
| VMProtect 静态脱壳 | [VMPStaticUnpacker](https://github.com/YuroGod/VMPStaticUnpacker) | [Releases](https://github.com/YuroGod/VMPStaticUnpacker/releases) | unpacked PE |
| Windows 用户态调试 | [x64dbg](https://github.com/x64dbg/x64dbg) | [Releases](https://github.com/x64dbg/x64dbg/releases) | 断点 / 寄存器 / 内存 |
| AI 控制调试 | [x64dbg-mcp](https://github.com/SetsunaYukiOvO/x64dbg-mcp) | [Releases](https://github.com/SetsunaYukiOvO/x64dbg-mcp/releases) | JSON-RPC 会话 |
| EDR 绕过 dump hash | [HashDump-BypassEDR](https://github.com/AabyssZG/HashDump-BypassEDR) | [Releases](https://github.com/AabyssZG/HashDump-BypassEDR/releases) | hive + bootkey + hash |

## 6. 运行时 / Hook

| 任务 | 首选 | 替代 | 存证 |
|---|---|---|---|
| 通用运行时 hook | Frida | rustFrida (Android) | hook log / stack / 参数 |

## 7. 协议 / 流量

| 任务 | 首选 | Releases 下载 | 存证 |
|---|---|---|---|
| 弱口令检测 | [WeakPassDetect](https://github.com/Pick-program/WeakPassDetect) | [Releases](https://github.com/Pick-program/WeakPassDetect/releases) | TXT 报告（端口 + 弱口令） |

## 8. 恶意样本

| 任务 | 首选 | Releases 下载 | 存证 |
|---|---|---|---|
| PE 恶意检测 | [pe-inspector](https://github.com/la-1314/pe-inspector) | [Releases](https://github.com/la-1314/pe-inspector/releases) | JSON+HTML 威胁报告 |
| YARA 规则生成 | `yara_gen` | helmd 内置 | 规则文件 |

## 9. AI / LLM 安全

| 任务 | 首选 | 替代 | 存证 |
|---|---|---|---|
| Prompt 注入测试 | `llm_sim` | 手动测试 | 注入结果 |
| 模型安全评估 | `ai_reference` | 手动分析 | 安全报告 |

## 10. 证据 / 报告

| 任务 | 首选 | 替代 | 存证 |
|---|---|---|---|
| 创建 case 工作区 | `create_case` | 手动创建目录 | case.json |
| 离线分诊 | `triage_artifact` | 手动分析 | 分诊报告 |
| SHA-256 哈希 | `hash_artifact` | `sha256sum` | 哈希值 |
| 报告生成 | `evidence_reference` | 手动编写 | Markdown 报告 |

## 规则

- 记录工具版本、命令、时间戳、输入哈希、环境变量。
- 自动反编译结果是假设，直到运行时或交叉引用证据确认。
