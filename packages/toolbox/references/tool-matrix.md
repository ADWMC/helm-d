# 工具矩阵（Tool Matrix）

按任务分类，每类填「首选 | 替代 | 存证」。

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
| 待填充 | | | |

## 2. Android

| 任务 | 首选 | 替代 | 存证 |
|---|---|---|---|
| DEX / APK → Java | [jadx](https://github.com/skylot/jadx) | Fernflower | Java 源码 |
| APK 解包 / 重打包 | [apktool](https://github.com/ibotpeaches/apktool) | apktool.jar | smali / 资源 |
| APK 静态分析 | [androguard](https://github.com/androguard/androguard) | jadx | manifest / 调用图 |
| SO 模拟执行 | [unidbg](https://github.com/zhkl0228/unidbg) | Frida | 调用序列 / trace |
| Java 字节码反编译 | [fernflower](https://github.com/jetBrains/fernflower) | CFR / Procyon | Java 源码 |
| Android ARM64 插桩 / Java hook | [rustFrida](https://github.com/kkkbbb/rustFrida) | Frida (frida-server) | hook log / stack / 参数 |
| SO 加载监控 | rustFrida `--watch-so` (eBPF) | Frida `Module.load` 事件 | SO 加载点 / 时间线 |

## 3. Web / JavaScript

| 任务 | 首选 | 替代 | 存证 |
|---|---|---|---|
| 网页抓取 / 反爬 | [Scrapling](https://github.com/d4vinci/Scrapling) | Playwright / obscura | HTML / JSON / 文章 |
| 微信小程序逆向 | [WeChat-lm](https://github.com/HSGQSRGS/WeChat-lm) | 手动 wxapkg 解包 | 解包产物 / HTML+JSON 报告 |
| IP 存活检测 | [ip_checker](https://github.com/test692618/ip_checker) | nmap -sn / fping | 存活/不可达结果 + 统计 |
| 加解密 / 签名 | [CipherBridge](https://github.com/CuriousLearnerDev/CipherBridge) | CyberChef / 手写 hook | 解密结果 / 密钥 / 算法 |

## 4. Native / 二进制

| 任务 | 首选 | 替代 | 存证 |
|---|---|---|---|
| IDA 无界面脚本 | [headless-ida](https://github.com/DennyDai/headless-ida) | Ghidra analyzeHeadless | 反汇编 / 反编译产物 |
| 命令行逆向 | [radare2](https://github.com/radareorg/radare2) | Ghidra / IDA | 函数 / xrefs / 段 |

## 5. Windows

| 任务 | 首选 | 替代 | 存证 |
|---|---|---|---|
| VMProtect 静态脱壳 | [VMPStaticUnpacker](https://github.com/YuroGod/VMPStaticUnpacker) | 动态 dump | unpacked PE |
| Windows 用户态调试 | [x64dbg](https://github.com/x64dbg/x64dbg) | WinDbg / OllyDbg | 断点 / 寄存器 / 内存 |
| AI 控制调试 | [x64dbg-mcp](https://github.com/SetsunaYukiOvO/x64dbg-mcp) | 手动 x64dbg | JSON-RPC 会话 |
| EDR 绕过 dump hash | [HashDump-BypassEDR](https://github.com/AabyssZG/HashDump-BypassEDR) | mimikatz / procdump | hive + bootkey + hash |

## 6. 运行时 / Hook

| 任务 | 首选 | 替代 | 存证 |
|---|---|---|---|
| 通用运行时 hook | Frida | rustFrida (Android) | hook log / stack / 参数 |

## 7. 协议 / 流量

| 任务 | 首选 | 替代 | 存证 |
|---|---|---|---|
| 弱口令检测 | [WeakPassDetect](https://github.com/Pick-program/WeakPassDetect) | hydra / medusa | TXT 报告（端口 + 弱口令） |

## 8. 恶意样本

| 任务 | 首选 | 替代 | 存证 |
|---|---|---|---|
| PE 恶意检测 | [pe-inspector](https://github.com/la-1314/pe-inspector) | ClamAV / YARA 手动 | JSON+HTML 威胁报告 |

## 9. AI / LLM 安全

| 任务 | 首选 | 替代 | 存证 |
|---|---|---|---|
| 待填充 | | | |

## 10. 证据 / 报告

| 任务 | 首选 | 替代 | 存证 |
|---|---|---|---|
| 待填充 | | | |

## 规则

- 记录工具版本、命令、时间戳、输入哈希、环境变量。
- 自动反编译结果是假设，直到运行时或交叉引用证据确认。
