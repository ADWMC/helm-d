# Native / 二进制与主机 参考索引

> 自动生成，勿手改。共 **127** 篇；总索引：[../index.md](../index.md)。重新生成：`node scripts/gen-references-index.mjs`。

**职责边界**：PE/ELF/Mach-O、壳与反调试、ARM64、密码与 JVM 常量、PWN/利用、驱动、Windows/AD/内网、Linux/macOS/容器。

**先读**：[样本接管流程（Intake Playbook）](./sample-intake-playbook.md) · [Native / 二进制逆向核心原则](./native-principles.md) · [PE/ELF 保护检测方法论](./protection-detection-methodology.md) · [加壳/混淆二进制处理策略](./packer-handling.md) · [反调试绕过方法论](./anti-debug-methodology.md)

## 入口与方法论（4）

| 文档 | 讲什么 | 类型 |
|---|---|---|
| [结果验证完整方案](./verification-patterns.md) | 结果验证：正向/负向对照、复现命令与判据。 | 手册 |
| [样本接管流程（Intake Playbook）](./sample-intake-playbook.md) | 拿到样本后「四问 → 启动协议 → 信号路由 → 分轨 → 质量门禁 → 交付」的完整流程。按需读，非硬性规则。 | 手册 |
| [游戏安全方法论](./game-security-methodology.md) | 游戏逆向、反作弊绕过、内存分析系统化流程 | 方法论 |
| [Native / 二进制逆向核心原则](./native-principles.md) | 从 secplan 领域编排器提取的通用方法论，去掉了任务编排与框架运行时引用。读完自行判断，非硬性规则。 | 方法论 |

## 案例与实战（6）

| 文档 | 讲什么 | 类型 |
|---|---|---|
| [案例：Android ARM64 卡密验证绕过（宝塔内核 shell）](./bypass-case-bt-kami.md) | Android ARM64 宝塔内核 shell 场景下的卡密校验绕过案例。 | 案例 |
| [案例：GHLoader DLL 注入器卡密绕过（Windows PE）](./bypass-case-gh-loader-aimbot.md) | Windows PE GHLoader DLL 注入器的卡密校验绕过案例。 | 案例 |
| [案例：Shellcode 加载型验证（cpurender）](./bypass-case-cpu-render-shellcode.md) | cpurender shellcode 加载型卡密验证的定位与绕过案例。 | 案例 |
| [案例：TUSI-ObfuscatorClang 保护的 Android .so 卡密分析](./bypass-case-tusi-netease.md) | TUSI-ObfuscatorClang 保护的 Android .so 卡密分析与绕过案例。 | 案例 |
| [GHLoader (neteasefuture.exe) 完整逆向案例](./gh-loader-anti-frida-case.md) | 网易云音乐 AI 自瞄辅助工具的 loader + DLL 注入器。本案例记录了从资源提取到 DLL 解密、从 Frida 强反调试到静态分析的完整流程。 | 案例 |
| [Native 逆向案例与流程](./native-casebook.md) | 从 secplan methodology 提取的通用逆向流程与实战案例，去掉工具环境配置与框架引用。读完自行判断，非硬性规则。 | 案例 |

## 保护、壳与反调试（18）

| 文档 | 讲什么 | 类型 |
|---|---|---|
| [代码混淆与反混淆](./code-obfuscation-deobfuscation.md) | 控制流、字符串、常量与自修改代码的混淆识别和去混淆流程。 | 参考 |
| [反调试技术](./anti-debugging-techniques.md) | 反调试检测与绕过：ptrace/PEB/时序/异常等检测点及对应绕过。 | 手册 |
| [反调试绕过方法论](./anti-debug-methodology.md) | 检测与绕过常见反调试技术的系统化流程 | 方法论 |
| [加壳/混淆二进制处理策略](./packer-handling.md) | 加壳检测后：定位 OEP、dump、修复与静态兜底策略。 | 参考 |
| [卡密/License 验证绕过工作流](./license-bypass-workflow.md) | 原理：程序读取本地配置文件决定是否跳过验证。 | 方法论 |
| [模型/数据文件解密密钥运行时捕获](./model-decryption-key-capture.md) | 目标程序包含加密的模型/数据文件（如 .aes、.enc、.bin），静态分析无法提取密钥时加载本文档。 | 参考 |
| [商业级加固标准 → ELF 保护适配](./commercial-hardening-standards.md) | 关键：不同失败原因 → 相同外部行为。攻击者无法区分"解密失败"和"正常运行"。 | 参考 |
| [Anti-Debug Technique × OS × Detection × Bypass — Comprehensive Matrix](./anti-debugging-techniques-anti-debug-matrix.md) | Linux/Windows 反调试技术 × 检测 × 绕过 × 工具兼容性矩阵。 | 手册 |
| [Anti-Frida DLL 绕过的替代方案](./anti-frida-workarounds.md) | 当 DLL 有强反调试/反 Frida 机制时，反复 attach 会导致进程崩溃。本文档总结绕过 Frida 检测的替代分析路径。 | 参考 |
| [ELF VMP (Virtual Machine Protection) 架构与实现](./vmp-elf-protection.md) | SHVMP 项目实战经验。项目地址: https://github.com/ADWMC/shvmp | 参考 |
| [ELVMP 分析工作流](./elvmp-analysis-workflow.md) | SHVMP v3.0 保护的 .elvmp 文件分析方法论。基于 ADLI.full.noad.elvmp 实战（2026-07）。 | 方法论 |
| [Memory.patchCode Bypass — When API Hooks Fail](./memory-patchcode-bypass.md) | API Hook 失效时的 Memory.patchCode 绕过与验证。 | 手册 |
| [PE/ELF 保护检测方法论](./protection-detection-methodology.md) | 检测和分析常见二进制保护器：UPX, VMProtect, Themida, OLLVM, TUSI | 方法论 |
| [processpatch.py 完整参数参考](./process-patch-reference.md) | 通用进程 Patch + 值捕获工具。替代手写 ctypes 脚本（OpenProcess/VirtualProtectEx/WriteProcessMemory 等样板代码）。 | 参考 |
| [VMProtect PE + Frida 动态分析（Windows 桌面）](./vmp-pe-frida-windows.md) | 适用场景：VMP 加壳的 Windows PE 程序（.winlice + .boot 节），需要在 Windows 桌面机上动态分析。 | 参考 |
| [VMProtect PE 快速识别与决策](./vmp-pe-fast-triage.md) | VMProtect PE 快速识别：先处理 Defender，再按 URL/域名/strings 信号决定是否继续静态分析。 | 参考 |
| [Windows AV/EDR 规避](./windows-av-edr-evasion.md) | 覆盖 AMSI/ETW 绕过、.NET 内存加载、shellcode 执行、进程注入、unhooking、载荷加密、签名规避 | 参考 / hack-skills |
| [Zygisk Module License Bypass](./zygisk-module-license-bypass.md) | Zygisk 模块卡密绕过：模块结构、license 校验与 patch。 | 手册 |

## 静态分析、反编译与工具（27）

| 文档 | 讲什么 | 类型 |
|---|---|---|
| [动态分析策略 — Frida 模式（后备）](./dynamic-analysis-frida.md) | Frida 动态分析后备流程：IDA 调试失败时的 attach/spawn、Hook 与验证。 | 参考 |
| [动态分析策略 — IDA 调试器（首选）](./dynamic-analysis.md) | IDA 调试器动态分析首选流程：断点、调用跟踪与内存检查。 | 参考 |
| [固件/驱动 EEPROM 数据分析方法论](./firmware-eeprom-analysis.md) | 分析驱动包中的加密 EEPROM 数据、固件 blob、校准文件的通用思路。适用于 WiFi/BT/网卡等外设驱动。 | 参考 |
| [固件分析方法论](./firmware-analysis-methodology.md) | IoT/嵌入式固件逆向、提取、分析系统化流程 | 方法论 |
| [APK 签名验证与完整性校验模式](./apk-signature-verification.md) | 典型的游戏 SDK APK 渠道签名验证类，位于 IIPS/Source/app/versionmanager/signature/ChannelInfoUtil.cpp。 | 参考 |
| [arm64 无符号逆向方法论](./arm64-reverse-methodology.md) | 在无符号（stripped）的 arm64 二进制中定位函数和数据的实用方法。适用于 IDA Pro 分析 .so/.dylib 等无符号库。 | 方法论 |
| [ARM64 ADRP+ADD 字符串引用搜索](./arm64-string-xref-search.md) | 当 r2 axt 或 IDA xref 找不到字符串引用时（常见于大文件或 stripped binary），手动搜索 ADRP+ADD 指令对。 | 参考 |
| [DLL Injection & Runtime Memory Patching with Frida](./dll-injection-runtime-patching.md) | DLL 注入与运行时内存 patch：定位密钥、改写校验与验证。 | 参考 |
| [elf-got-patcher：ARM64 ELF GOT Hook 注入工具](./elf-got-patcher.md) | 仓库：https://github.com/LeoChen-CoreMind/elf-got-patcher | 参考 |
| [Frida 17.x Android 兼容写法速查](./frida-17x-android-compatible.md) | 覆盖：核心 API 变更 (17.x) / 通用 findExport 兼容函数 / Spawn + Child Gating (处理 fork) / 内存 Dump (17.x 写法) | 参考 |
| [Frida 17.x API 变化速查（通用）](./frida-17x-api.md) | 从 frida 16.x 迁移到 17.x 时所有 API 变化的完整参考。适用于 PC 端（exe/dll/so/dylib）和移动端（APK/IPA）。 | 参考 |
| [Frida Hook 脚本模板](./frida-hook-templates.md) | Frida Hook 架构模式与标准模板（Java / native / 拦截器链）。 | 模板 |
| [Frida Native Shell 技巧](./frida-native-shell-tricks.md) | 在 Frida 中执行 shell 命令和 HTTP 请求的 native 方法。适用于：Java bridge 不可用或不稳定时（如 Flutter 应用、纯 native 进程）。 | 手册 |
| [Ghidra Headless 分析工作流](./ghidra-headless-workflow.md) | headless 模式只支持 Java 脚本（extends GhidraScript），不支持 .py 脚本。 | 方法论 |
| [Ghidra Python 脚本速查](./ghidra-python-reference.md) | 适用于 Ghidra 12.x headless 模式和 Ghidra GUI 内置脚本管理器 | 参考 |
| [IDAPython 脚本编码规范](./idapython-conventions.md) | 适用于无人值守 IDA 分析所生成的所有 IDAPython 脚本。 | 参考 |
| [IDAPython 速查手册](./idapython-reference.md) | IDAPython 速查：常用 API、脚本模式与无人值守注意事项。 | 参考 |
| [PE 资源段加密 Payload 提取与解密](./pe-payload-extraction.md) | 当 PE 文件 .rsrc 段异常大（>5MB），或 FindResourceW/LoadResource 出现在导入表中时，很可能包含嵌入式加密 payload（DLL/配置/证书）。 | 参考 |
| [PE Loader + DLL 注入逆向分析](./pe-loader-dll-injection.md) | 目标为 PE Loader / Dropper（大量资源嵌入）、DLL 注入器（CreateRemoteThread + LoadLibraryW）、卡密验证保护工具时加载本文档。 | 参考 |
| [PE Memory Dump Reconstruction](./pe-memory-dump-reconstruction.md) | 内存 dump 重建为可分析 PE：节表、导入表与 RVA 修正。 | 参考 |
| [r2pipe 速查手册](./r2pipe-reference.md) | radare2 Python API，通过 r2pipe 连接 r2 实例进行自动化分析 | 参考 |
| [radare2 + r2ghidra 安装与配置](./radare2-windows-setup.md) | Windows 下 radare2 + r2ghidra 的安装、配置与验证。 | 参考 |
| [radare2 插件推荐清单](./radare2-plugin-recommendations.md) | radare2 常用插件清单与适用场景。 | 参考 |
| [radare2 工作流 — IDA 不可用时的二进制分析替代方案](./radare2-workflow.md) | 覆盖：安装 / 核心工具链 / 分析流程（推荐顺序） / r2 命令速查 | 方法论 |
| [Self-Extracting Shell Script Dropper Analysis](./self-extracting-shellscript-analysis.md) | 自解压 shell 脚本 dropper 的识别、解包与行为分析。 | 参考 |
| [Unicorn 模拟执行脚本模板](./unicorn-templates.md) | Unicorn 模拟执行脚本模板与算法验证流程。 | 模板 |
| [Windows 兼容性坑点汇总（2026-07-23 实测）](./windows-compat-pitfalls.md) | Windows 10 + Git Bash (MSYS) 环境下工具链的已知兼容性问题。 | 参考 |

## 密码、算法与常量（13）

| 文档 | 讲什么 | 类型 |
|---|---|---|
| [常见密码学验证模式](./crypto-validation-patterns.md) | 常见密码学验证模式：算法识别、密钥与明密文校验。 | 手册 |
| [格密码攻击](./lattice-crypto-attacks.md) | 格密码攻击：Coppersmith、DSA/ECDSA nonce、背包与 LWE。 | 手册 |
| [加密分析方法论](./crypto-analysis-methodology.md) | 常见加密算法识别、密钥提取、编码解码系统化流程 | 方法论 |
| [Block Cipher Attacks — Detailed Scripts & Walkthrough](./symmetric-cipher-attacks-block-cipher-attacks.md) | 分组密码攻击脚本与 walkthrough：CBC/ECB/CTR 场景。 | 手册 |
| [Classical Cipher Analysis — Expert Cryptanalysis Playbook](./classical-cipher-analysis.md) | 古典密码识别与破解：替换、维吉尼亚、转置与 XOR。 | 参考 |
| [Custom XOR Cipher Reversal](./custom-xor-cipher-reversal.md) | Some protectors use a repeating XOR key where the key state mutates after each byte. | 参考 |
| [ECDLP 求解指南](./ecdlp-solving.md) | ECDLP 求解：曲线识别、求解器选择与渐进策略。 | 参考 |
| [ECDLP 特殊约束与渐进策略](./ecdlp-special-cases.md) | 非标准 ECDSA 实现、渐进求解策略、常见陷阱。 | 案例 |
| [Hash Attack Techniques — Expert Cryptanalysis Playbook](./hash-attack-techniques.md) | 哈希攻击：长度扩展、碰撞、HMAC 时序与 PoW。 | 手册 |
| [Pollard's rho 算法模板](./ecdlp-pollard-rho.md) | Pollard's rho 的 ECDLP 并行实现与线程/DP 参数选择。 | 参考 |
| [RSA 攻击技术](./rsa-attack-techniques.md) | RSA 参数弱点与攻击选择：小 n、共模、低指数、因子分解。 | 手册 |
| [RSA Attack Catalog — Detailed Implementations & Mathematics](./rsa-attack-techniques-rsa-attack-catalog.md) | RSA 攻击目录：具体实现、数学推导与适用条件。 | 手册 |
| [Symmetric Cipher Attacks — Expert Cryptanalysis Playbook](./symmetric-cipher-attacks.md) | 分组/流密码模式攻击：CBC padding、ECB 拼接、位翻转。 | 手册 |

## JVM / Java（1）

| 文档 | 讲什么 | 类型 |
|---|---|---|
| [JVM Mod 常量加密 — Oracle 重放解密工作流](./jvm-mod-deobf-workflow.md) | 适用：Minecraft Forge/Java mod、桌面 Java 应用里"常量池内嵌 DES 解密器 + 类拷贝模板"型混淆。 | 方法论 |

## PWN、堆与利用（26）

| 文档 | 讲什么 | 类型 |
|---|---|---|
| [堆利用](./heap-exploitation.md) | glibc 堆利用：UAF/double free/overflow 与 house-of 技术。 | 手册 |
| [二进制保护绕过](./binary-protection-bypass.md) | ASLR/PIE/NX/canary/RELRO/CET 的保护识别与绕过。 | 手册 |
| [漏洞 PoC/检测脚本开发清单](./exploit-dev-checklist.md) | 漏洞 PoC/检测脚本开发清单：结构、验证、安全边界与文档规范。 | 清单 |
| [栈溢出与 ROP](./stack-overflow-and-rop.md) | 栈溢出与 ROP：canary/libc/PIE 泄露、链构造与 ret2libc。 | 参考 |
| [Advanced ROP Techniques — BROP, Partial Overwrite, JOP, COP](./stack-overflow-and-rop-rop-advanced-techniques.md) | Exploit a remote stack overflow without access to the binary. Requires a service that forks (canary and ASLR layout persist across crashes). | 手册 |
| [angr Cookbook — Ready-to-Use Script Patterns for CTF Challenges](./symbolic-execution-tools-angr-cookbook.md) | Scenario: Binary prints "Correct" at 0x401234, "Wrong" at 0x401300. Input via stdin. | 手册 |
| [Arbitrary Write to Code Execution — Expert Attack Playbook](./arbitrary-write-to-rce.md) | Replace a function pointer in the Global Offset Table. | 参考 |
| [Browser / V8 Exploitation — Expert Attack Playbook](./browser-exploitation-v8.md) | ArrayBuffer's backing store is a raw pointer to allocated memory. Corrupting it gives absolute memory R/W. | 手册 |
| [Format String Exploitation — Expert Attack Playbook](./format-string-exploitation.md) | This requires finding existing pointer chains on the stack (e.g., saved frame pointers forming a chain: rbp → prevrbp → prevprevrbp). | 手册 |
| [glibc 2.35 Heap Exploitation Patterns](./glibc-2.35-heap-exploitation.md) | mallochook, freehook, reallochook REMOVED in glibc 2.34+. Do not target them. | 手册 |
| [glibc 2.35 Tcache Exploitation Patterns](./glibc-2.35-tcache-exploitation.md) | Target: Ubuntu 22.04, glibc 2.35-0ubuntu3, PIE + Full RELRO + NX + Canary | 手册 |
| [Heap CTF Pwn Patterns](./heap-ctf-patterns.md) | Result: Node still accessible via path, content pointer dangling (UAF). | 手册 |
| [House of Techniques — Named Heap Exploitation Methods](./heap-exploitation-house-of-techniques.md) | Overwrite top chunk size → control next allocation address. | 手册 |
| [IOFILE Exploitation — FSOP, Vtable Hijack, stdout/stdin Abuse](./heap-exploitation-io-file-exploitation.md) | Overwrite IOlistall to insert a fake IOFILE, trigger flush → controlled vtable call. | 手册 |
| [Kernel Heap Techniques — SLUB, Cross-Cache, msgmsg, pipebuffer, skbuff](./kernel-exploitation-kernel-heap-techniques.md) | Linux kernel uses SLUB (Unqueued Slab Allocator) for small kernel object allocation. | 手册 |
| [Kernel Mitigation Bypass — KASLR, SMEP, SMAP, KPTI, FG-KASLR, CFI](./kernel-exploitation-kernel-mitigation-bypass.md) | Randomizes kernel .text base address at boot. Typical entropy: 9 bits (512 possible positions) on x86-64. | 手册 |
| [Linux 内核利用](./kernel-exploitation.md) | Linux 内核漏洞利用：UAF/OOB/race、提权与缓解绕过。 | 手册 |
| [Protection Bypass Matrix — Comprehensive Cross-Reference](./binary-protection-bypass-protection-bypass-matrix.md) | 覆盖：PROTECTION × BYPASS × PRIMITIVE MATRIX / COMBINED PROTECTION SCENARIOS / COMPILATION FLAGS REFERENCE / PROTECTION INTERACTION EFFECTS | 手册 |
| [Python Sandbox Escape (Pyjail) — Complete Methodology](./sandbox-escape-techniques-python-sandbox-escape.md) | Some sandboxes parse the AST and block dangerous nodes. | 手册 |
| [Sandbox Escape — Expert Attack Playbook](./sandbox-escape-techniques.md) | Python/Lua/seccomp/chroot/容器/浏览器沙箱逃逸。 | 手册 |
| [Seccomp Bypass — Architecture Confusion, iouring, Allowed Syscall Chaining](./sandbox-escape-techniques-seccomp-bypass.md) | x8664 processes can invoke x86 (32-bit) syscalls using int 0x80. Syscall numbers differ between architectures. | 手册 |
| [Symbolic Execution Tools — Expert Analysis Playbook](./symbolic-execution-tools.md) | This dramatically speeds up execution: concrete code runs natively via Unicorn, switching to symbolic only when symbolic variables are involved. | 参考 |
| [UAF + Tcache Count Corruption (glibc 2.27)](./uaf-tcache-count-corruption.md) | glibc 2.27 tcache count 破坏导致的 UAF 利用与堆布局。 | 参考 |
| [V8 Exploitation Patterns — Heap Layout, GC Interaction, Sandbox Bypass](./browser-exploitation-v8-v8-exploitation-patterns.md) | ArrayBuffer's backing store is external memory (not managed by V8 GC). Corrupting its pointer won't be affected by GC moves. | 手册 |
| [VM & Bytecode Reverse Engineering — Expert Analysis Playbook](./vm-and-bytecode-reverse.md) | Operations work on a stack (like JVM or Python bytecode). | 参考 |
| [Windows 内核驱动逆向分析 — 双机调试方案](./kernel-driver-analysis.md) | 当分析目标为 Windows 内核驱动（.sys），且 IDA 静态分析因 VMProtect 等混淆无法推进时， | 参考 |

## Windows / AD / 内网 / 容器（29）

| 文档 | 讲什么 | 类型 |
|---|---|---|
| [容器逃逸技术](./container-escape-techniques.md) | Classic escape for containers with CAPSYSADMIN + cgroup v1. | 手册 |
| [AD 本地提权清单](./ad-lpe-checklist.md) | 用于 main document §9 的内网域与 LPE 路由。以"系统/主机"为单位全面覆盖（见 main document §0 目标单位定义）：一个系统覆盖其所有端口/服务/组件，不因端口不同而割裂。 | 清单 |
| [AD ACL Abuse — Expert Attack Playbook](./active-directory-acl-abuse.md) | Write msDS-KeyCredentialLink on target → generate certificate → authenticate via PKINIT. | 参考 |
| [AD CS Attack Playbook — Expert Guide](./active-directory-certificate-services.md) | Condition: Template allows enrollee to specify Subject Alternative Name (SAN) + client authentication EKU + low-privilege enrollment. | 参考 |
| [AD CS ESC1–ESC13 Quick Reference Matrix](./active-directory-certificate-services-adcs-esc-matrix.md) | 覆盖：ESC VULNERABILITY MATRIX / ONE-LINER EXPLOITATION COMMANDS / DETECTION INDICATORS / TOOL COMPARISON | 手册 |
| [AD Kerberos 攻击](./active-directory-kerberos-attacks.md) | Users with "Do not require Kerberos preauthentication" can be queried for AS-REP without knowing their password. | 手册 |
| [AMSI Bypass Techniques — Detailed Patterns](./windows-av-evasion-amsi-bypass-techniques.md) | AMSI 绕过：AmsiScanBuffer patch、CLR 内存加载与检测规避。 | 手册 |
| [Authentication Coercion Methods](./ntlm-relay-coercion-coercion-methods.md) | Exploits the File Server VSS Agent Service (requires the service to be running — common on file servers). | 参考 |
| [AV/EDR Evasion — Expert Attack Playbook](./windows-av-evasion.md) | AMSI (Antimalware Scan Interface) inspects PowerShell, .NET, VBScript, JScript, and Office macros at runtime. | 参考 |
| [BloodHound Attack Paths & Cypher Queries](./active-directory-acl-abuse-bloodhound-paths.md) | 覆盖：BLOODHOUND DATA COLLECTION BEST PRACTICES / ESSENTIAL CYPHER QUERIES / COMMON ATTACK PATH PATTERNS / CUSTOM BLOODHOUND QUERIES FOR SPECIFIC SCENARIOS | 参考 |
| [Credential Dumping Techniques](./windows-lateral-movement-credential-dumping.md) | DPAPI protects browser passwords, Wi-Fi keys, credential manager entries, and more. | 参考 |
| [Docker Escape Chains & Kubernetes Escape Paths](./container-escape-techniques-docker-escape-chains.md) | 覆盖：ESCAPE CHAIN: PRIVILEGED CONTAINER → HOST ROOT / ESCAPE CHAIN: DOCKER SOCKET → HOST ROOT / ESCAPE CHAIN: CGROUP RELEASEAGENT → HOST COMMAND EXECUTION / DOCKER-IN-DOCKER (DinD) ESCAPE | 手册 |
| [Dylib Hijacking & XPC Exploitation — Step-by-Step Techniques](./macos-process-injection-dylib-xpc-techniques.md) | 覆盖：DYLIB HIJACKING METHODOLOGY / XPC EXPLOITATION WALKTHROUGH / MACH PORT TECHNIQUES / ELECTRON-SPECIFIC DEEP DIVE | 手册 |
| [Kerberos Multi-Step Attack Chains](./active-directory-kerberos-attacks-kerberos-attack-chains.md) | Low-privilege domain user → cracked service account → delegation abuse → DA. | 手册 |
| [Kernel Exploits Checklist](./linux-privilege-escalation-kernel-exploits-checklist.md) | 覆盖：KERNEL VERSION → EXPLOIT MAPPING TABLE / EXPLOIT COMPILATION TIPS / KERNEL EXPLOIT STABILITY NOTES / SPECIFIC EXPLOIT QUICK REFERENCES | 清单 |
| [Kubernetes 渗透](./kubernetes-pentesting.md) | Bypass strategies: DNS exfiltration (port 53 rarely blocked), allowed port tunneling, pod in unprotected namespace, hostNetwork: true bypasses pod net… | 参考 |
| [Linux 横向移动](./linux-lateral-movement.md) | 覆盖：SSH AGENT HIJACKING / SSH KEY HARVESTING / CREDENTIAL HARVESTING LOCATIONS / D-BUS EXPLOITATION | 参考 |
| [Linux 提权](./linux-privilege-escalation.md) | 覆盖：ENUMERATION CHECKLIST / SUID/SGID EXPLOITATION / CAPABILITIES ABUSE / CRON / TIMER ABUSE | 参考 |
| [Linux Security Bypass — Expert Attack Playbook](./linux-security-bypass.md) | Common AppArmor profile gaps: /proc/self/fd/ access, abstract Unix sockets, interpreter-based execution (python scripts bypass binary restrictions), a… | 手册 |
| [macOS Process Injection — Expert Attack Playbook](./macos-process-injection.md) | Exploit the dynamic linker's library search order to load attacker-controlled dylibs instead of (or in addition to) legitimate ones. | 参考 |
| [macOS Security Bypass — Expert Attack Playbook](./macos-security-bypass.md) | TCC is macOS's permission framework controlling access to sensitive resources (camera, microphone, contacts, full disk access, etc.). | 手册 |
| [NTLM Relay 与认证强制](./ntlm-relay-coercion.md) | Capture SMB authentication, relay to LDAP (requires no LDAP signing enforcement). | 参考 |
| [SUID/SGID & Capabilities Exploitation Tricks](./linux-privilege-escalation-suid-capabilities-tricks.md) | All commands below assume the binary has the SUID bit set (-rwsr-xr-x with root ownership). | 手册 |
| [TCC Bypass Matrix — Per-Version & Per-Protection Techniques](./macos-security-bypass-tcc-bypass-matrix.md) | MDM-managed devices can push PPPC profiles that pre-approve TCC permissions without user consent. | 手册 |
| [Token Manipulation & Potato Family Detailed Comparison](./windows-privilege-escalation-token-potato-tricks.md) | 覆盖：TOKEN PRIVILEGE PRIMER / POTATO FAMILY EVOLUTION / DETAILED COMPARISON MATRIX / TOOL USAGE — COMMAND REFERENCE | 手册 |
| [UAC Bypass Techniques Matrix](./windows-privilege-escalation-uac-bypass-methods.md) | fodhelper.exe auto-elevates and checks HKCU:\Software\Classes\ms-settings\Shell\Open\command before launching. | 手册 |
| [Windows 驱动加密密钥提取方法论](./windows-driver-crypto-extraction.md) | Windows 内核驱动（.sys）中硬编码了加密密钥（AES/DES/XOR），用于保护固件、配置文件、EEPROM 数据等。需要提取密钥以解密受保护数据。 | 参考 |
| [Windows Lateral Movement — Expert Attack Playbook](./windows-lateral-movement.md) | Stealthy — uses legitimate COM objects, no service creation. | 参考 |
| [Windows Local Privilege Escalation — Expert Attack Playbook](./windows-privilege-escalation.md) | Service accounts (IIS AppPool, MSSQL, etc.) typically hold SeImpersonatePrivilege. This enables impersonation of any token presented to you. | 参考 |

## Android native / shellcode（3）

| 文档 | 讲什么 | 类型 |
|---|---|---|
| [Android ARM64 RWX Shellcode 分析实战](./android-shellcode-analysis.md) | 检测命中 → b #exitfunc → writev "NBGEXIT:XX" → exitgroup(0) | 参考 |
| [Android ARM64 Shellcode 分析: 反调试 + 直接系统调用 + 自修改代码](./android-arm64-shellcode-analysis.md) | 实战案例: NBG.sh 恶意软件 (Telegram 分发, 游戏外挂投放器) | 参考 |
| [NBG 案例：Android ARM64 Shellcode + 卡密保护 + 腾讯游戏外挂](./nbg-android-shellcode-case.md) | 0x3268cc 处: cmp w16, w17; b.eq #0x3268e4 | 案例 |
