# Decision Tree — 安全分析路由

> 拿到样本后，先走分诊决策树，再进入具体领域分析。

## 核心原则

1. **Risk-First**: 优先关注认证、加密、价值转移、外部调用
2. **Evidence-Based**: 每个结论必须有文件偏移、内存 dump、pcap 等证据
3. **Progressive Disclosure**: 只加载当前任务需要的 reference 文件
4. **Honest**: 明确说明覆盖范围和置信度
5. **Output-Driven**: 始终生成结构化报告或产物

## 反理性化（不要跳过基线）

| 借口 | 为什么错 | 必须做 |
|------|---------|--------|
| "先快速看一眼" | 跳过基线 = 漏回归 | 先跑分诊再深挖 |
| "我知道这个壳" | 自定义/更新版保护器会打破假设 | 先用 `detect_packer` 验证保护类型 |
| "静态分析够了" | 加壳/混淆代码隐藏行为 | 高熵或无字符串 → 升级动态分析 |
| "Frida 能搞定" | 反 Frida 机制会 crash | 2-3 次失败 → 切换 Win32 API / ptrace / 静态提取 |
| "改一处就行" | 校验点多处存在 | 枚举所有校验点再打补丁 |
| "口头解释下" | 没有产物 = 结论丢失 | 始终写报告或保存提取的 payload |

## 分诊决策树

```
拿到样本？
├─ 文件类型识别
│  ├─ file target                      # 识别类型 (ELF/PE/Mach-O/JAR/APK)
│  ├─ hash_artifact --path target      # SHA-256 哈希
│  └─ triage_artifact --artifact target # 魔数、熵、字符串
│
├─ Windows PE (.exe/.dll)?
│  ├─ 加壳/保护？→ detect_packer --file target
│  │  ├─ UPX → upx -d
│  │  ├─ VMProtect → 动态分析 only
│  │  ├─ Themida → 动态 dump
│  │  └─ OLLVM → IDA + 脚本去混淆
│  ├─ License 绕过？→ native_reference --path license-bypass-workflow.md
│  ├─ DLL 注入？→ native_reference --path pe-loader-dll-injection.md
│  └─ 恶意样本？→ malware_reference --path index.md + ioc_extract
│
├─ Android APK (.apk/.xapk)?
│  ├─ 快速初筛？→ garlic target.apk -o output/ (首选，200MB/12s)
│  ├─ 字符串搜索？→ garlic target.apk -f "pattern"
│  ├─ 加固/脱壳？→ apk_fingerprint + android references
│  ├─ API 提取？→ garlic 快速反编译 + jadx 深度分析
│  ├─ Root 模块？→ android references
│  └─ Native SO？→ 走 ELF 分支
│
├─ Android/Linux ELF (.so/.elf)?
│  ├─ Shellcode/RWX？→ native_reference --path android-shellcode-analysis.md
│  ├─ 反分析？→ native_reference --path android-elf-malware-analysis.md
│  ├─ 内存 Dump？→ native_reference --path android-arm64-memory-dump.md
│  └─ VMP 保护？→ native_reference --path vmp-elf-protection.md
│
├─ JVM/JAR (.jar/.class)?
│  ├─ Minecraft Mod？→ 字节码 patch（bipush/sipush/ldc）
│  ├─ ZKM 混淆？→ 字符串还原 + Indy 分析
│  └─ License 校验？→ Fernflower 反编译 + 定位校验点
│
├─ Web 应用？
│  ├─ 管理后台？→ web_reference --path web-methodology.md
│  ├─ API 黑盒？→ web_reference --path api-blackbox-testing.md
│  └─ 缓存投毒？→ web_reference --path cache-poisoning.md
│
├─ 协议/流量？
│  ├─ PCAP？→ pcap_parse + protocol_reference
│  ├─ HAR？→ parse_har
│  └─ 自定义协议？→ state_machine 推断
│
├─ AI/LLM？
│  ├─ Prompt 注入？→ ai_reference --path llm-attack-methodology.md
│  ├─ 模型安全？→ ai_reference --path model-defense-profiles.md
│  └─ 测试？→ llm_sim 模拟
│
├─ 恶意样本？
│  ├─ IOC 提取？→ ioc_extract
│  ├─ YARA 规则？→ yara_gen
│  └─ 行为分析？→ malware_reference --path index.md
│
├─ 加密/编码？
│  ├─ XOR？→ xor_bruteforce
│  ├─ Base64/Hex/ROT13？→ encoding_detect
│  └─ AES 密钥？→ native_reference --path crypto-analysis-methodology.md
│
└─ 不确定？
   └─ tool_recommend --query "描述你的任务"
```

## 工具选择策略

| 优先级 | 工具 | 适用场景 | 注意事项 |
|--------|------|---------|---------|
| 1 | IDA Pro | 静态反汇编、结构识别、Patch | headless-ida + idalib，禁止 `idat -A` |
| 2 | Ghidra | 开源替代、headless 批处理 | Java 路径用 Windows 反斜杠 |
| 3 | radare2 | 快速字符串搜索、粗略反汇编 | 配合 r2ghidra 反编译 |
| 4 | Frida | 动态 Hook、运行时分析 | 注意反 Frida 检测 |
| 5 | Python 脚本 | 自动化、批量处理 | 通过 `runSeam` 调用 |

## Patch 编码速查

| 架构 | 类型 | 原始 | 修改后 | 字节 |
|------|------|------|--------|------|
| ARM64 | `b.eq` → `b` | `B.eq loc` | `B loc` | `0x14000000` |
| ARM64 | `cbz` → `nop` | `CBZ Xn, loc` | `NOP` | `0x1F2003D5` |
| ARM64 | `b.ne` → `nop` | `B.ne loc` | `NOP` | `0xD503201F` |
| x86 | `je` → `jne` | `74 xx` | `75 xx` | — |
| x86 | `jne` → `je` | `75 xx` | `74 xx` | — |
| x86 | `call` → `nop` | `E8 xx xx xx xx` | `90 90 90 90 90` | — |
| x86 | `test` → `xor` | `85 C0` | `31 C0` | 清零 eax |

## 置信度标注

| 标注 | 含义 |
|------|------|
| **高** | 基于实际执行结果、源码验证、多源交叉确认 |
| **中** | 基于单源证据、经验推断、部分验证 |
| **低** | 基于假设、未验证、需要进一步确认 |
| **未知** | 缺乏证据，明确说明缺失项 |
