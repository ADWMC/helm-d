# 方法论 — 安全分析工作流

> 分析流程、工具选择、环境配置、实战案例。按需读取，不强制执行。

## 工具选择策略

拿到二进制后，按以下优先级选择工具：

| 优先级 | 工具 | 适用场景 | 调用方式 |
|--------|------|---------|---------|
| 1 | **garlic** | APK/DEX/JAR 快速反编译、字符串搜索、aarch64 ELF 分析 | `garlic target.apk -o output/` |
| 2 | **IDA Pro** | 静态反汇编、结构识别、Patch | GUI 或 headless-ida + idalib |
| 3 | **Ghidra** | 开源替代、headless 批处理 | `analyzeHeadless` |
| 4 | **radare2** | 快速字符串搜索、粗略反汇编 | `r2 -A target` |
| 5 | **Frida** | 动态 Hook、运行时分析 | `frida -U -f package -l script.js` |
| 6 | **jadx** | APK/JAR 深度反编译（交叉引用） | `jadx -d output/ target.apk` |
| 7 | **helmd 工具** | 自动化分析、脚本调用 | 通过 DSH 工具调用 |

工具安装详见 `tool-install.md`。

### helmd 工具调用机制

helmd 工具通过 DSH 工具框架调用，底层使用 `runSeam()` 函数：

```
用户请求 → DSH 工具框架 → defineTool.execute() → runSeam() → 子进程
```

**调用链示例**:
```
detect_packer --file target.exe
    ↓
src/tools/native.ts → execute(args)
    ↓
runSeam(ctx, ['python', 'scripts/native/protection/detect_packer.py', 'target.exe'], cwd)
    ↓
resolveCommand('python') → 查找 python/py/python3
    ↓
subprocess.spawn() 或 execFileAsync()
    ↓
返回输出文本
```

### helmd 工具速查

| 工具 | 用途 | 调用示例 |
|------|------|---------|
| `detect_packer` | 检测 PE/ELF 加壳 | `detect_packer --file target.exe` |
| `scan_strings` | 提取 ASCII/UTF-16LE 字符串 | `scan_strings --path target.bin --min 4` |
| `xor_bruteforce` | XOR 单字节暴力破解 | `xor_bruteforce --data "encrypted_hex"` |
| `encoding_detect` | Base64/Hex/ROT13/XOR 解码 | `encoding_detect --text "encoded_string"` |
| `apk_fingerprint` | APK 框架/HTTP/混淆检测 | `apk_fingerprint --apk target.apk` |
| `pcap_parse` | PCAP TCP/UDP 流提取 | `pcap_parse --file capture.pcap` |
| `ioc_extract` | IOC 提取 (IP/URL/域名/哈希) | `ioc_extract --file malware.bin` |
| `yara_gen` | YARA 规则生成 | `yara_gen --file target.bin` |
| `create_case` | 创建逆向 case 工作区 | `create_case --case-name my-case --out D:\Reverse\case` |
| `triage_artifact` | 离线分诊 (魔数/熵/字符串) | `triage_artifact --artifact target.bin --out D:\Reverse\triage` |
| `hash_artifact` | SHA-256 哈希 | `hash_artifact --path target.bin` |
| `llm_sim` | LLM 应用模拟测试 | `llm_sim --system-prompt "..." --input "..."` |

## 通用逆向流程

```
1. 分诊 (Triage)
   file target                      # 识别类型
   hash_artifact --path target      # SHA-256
   triage_artifact --artifact target # 魔数、熵、字符串
   detect_packer --file target      # 检测加壳

2. 字符串搜索
   scan_strings --path target --min 4
   # 或手动: strings target | grep -i "keyword"

3. 静态分析
   # IDA Pro (首选)
   ida target
   # 或 Ghidra
   analyzeHeadless Project target -postScript script.java
   # 或 radare2
   r2 -A target

4. 动态分析 (按需)
   frida -U -f package -l hook.js
   # 或 Frida attach
   frida -p PID -l hook.js

5. Patch 验证
   # IDA: Patch → Patch program → Apply patches
   # r2: r2 -q -c 's 0xADDR; wa b 0xTARGET; w -' target
```

## 分析阶段详解

### Phase 0: 分诊 (必做)

**目标**: 确定样本类型、保护器、风险面

```powershell
# 1. 建立 case 工作区
create_case --case-name my-case --out D:\Reverse\my-case

# 2. 获取哈希
hash_artifact --path target.bin

# 3. 分诊
triage_artifact --artifact target.bin --out D:\Reverse\my-case\triage

# 4. 检测保护器
detect_packer --file target.bin
```

**输出**: 文件类型、熵值、保护器、关键字符串

### Phase 1: 静态分析

**目标**: 理解程序结构、找到关键函数、识别算法

```powershell
# 1. 提取字符串
scan_strings --path target.bin --min 4

# 2. 反编译 (选择合适工具)
# IDA Pro: 打开 target.bin，分析函数
# Ghidra: analyzeHeadless ...
# jadx: jadx -d output/ target.apk

# 3. 找关键函数
# 搜索: license, check, verify, decrypt, encrypt, key, password
# 跟踪调用链: main → check_license → decrypt → verify

# 4. 识别算法
# XOR: 循环异或、单字节/多字节密钥
# AES: S-Box 常量 63 7C 77 7B F2...
# RSA: 大数运算、公钥指数 65537
```

**输出**: 函数列表、调用链、算法识别、密钥位置

### Phase 2: 动态分析 (按需)

**目标**: 运行时验证、提取密钥、绕过检查

```powershell
# 1. Frida Hook Java 层
frida -U -f com.example.app -l hook_java.js

# 2. Frida Hook Native 层
frida -U -f com.example.app -l hook_native.js

# 3. 内存 Dump
# Frida: Memory.readByteArray(addr, size)
# procdump: procdump -ma PID dump.bin

# 4. 提取密钥
# Hook 加密函数，记录输入/输出
# 扫描内存中的密钥候选
```

**输出**: 运行时行为、密钥、加密数据、校验逻辑

### Phase 3: Patch/绕过 (按需)

**目标**: 绕过校验、提取功能、修改行为

```powershell
# 1. 找 Patch 点
# 条件跳转: je/jne/beq/bne
# 返回值: mov eax, 0/1; ret
# 函数调用: call/bl → nop

# 2. Patch
# IDA: Edit → Patch program → Change byte
# r2: r2 -q -c 's 0xADDR; wa nop; w -' target
# Python: 直接修改二进制文件

# 3. 验证
# 冷启动: 重新运行程序
# 热启动: 运行时 patch
# 重复运行: 确认稳定性
```

**输出**: Patch 后的二进制、验证结果

## PE Loader/DLL 注入分析

### 典型结构

```
Loader.exe
├── 资源段 (.rsrc)
│   ├── RCDATA/100 → 加密的 DLL
│   └── RCDATA/101 → 加密的配置
├── 解密函数
│   └── XOR/AES 解密资源
└── 注入逻辑
    ├── FindResourceW → LoadResource
    ├── VirtualAllocEx → WriteProcessMemory
    └── CreateRemoteThread → 执行 DLL
```

### 分析流程与实战案例

分析流程、GH_Loader 完整案例与 XOR-24 有状态算法详解单点维护在 [native-casebook.md](../native/native-casebook.md)（「PE Loader/DLL 注入分析」与「实战案例」章节），本节不再重复列表。

## JVM/JAR 字节码 Patch

### 适用场景

- Minecraft Mod 改配置默认值、上限、常量
- Java 应用绕过 License 校验
- 修改硬编码常量

### 流程

1. **识别**: `jar tf` 解压；优先 `*Config*.class`
2. **反汇编**: `javap -c -p <fqcn>` 看 `<clinit>` 与 `load`
3. **Constant Pool 解析**: long/double 占两个 CP 槽
4. **选 Patch 策略**: 优先等长 patch
5. **重打包**: 只替换改过的 `.class`

### Patch 策略

| 目标范围 | 指令 | 改法 |
|---------|------|------|
| -128..127 | `bipush` | 只改 1 字节立即数 |
| -32768..32767 | `sipush` | 改 2 字节 big-endian |
| 任意 int | `ldc`/`ldc_w` Integer | 改 CP Integer 或换索引 |

## 加壳二进制分析决策树

完整决策树（含 TUSI/VMProtect 分支、卡密后门检查与脱壳验证）单点维护在 [native-casebook.md](../native/native-casebook.md) 的「加壳二进制分析决策树」章节，本节不再重复。保护器类型识别命令：`detect_packer --file target` + `scan_strings --path target --min 4`。

## 置信度评估

| 级别 | 定义 | 验证方式 |
|------|------|---------|
| **高** | 多源交叉验证、实际执行确认 | 复现、多工具验证、源码确认 |
| **中** | 单源验证、经验推断 | 单工具验证、模式匹配 |
| **低** | 假设性结论、需要进一步确认 | 需要更多数据或动态验证 |
| **未知** | 缺乏证据，明确说明缺失项 | 需要采集更多数据 |

## 常见陷阱

| 陷阱 | 后果 | 正确做法 |
|------|------|---------|
| 跳过分诊直接分析 | 漏掉保护器、浪费时间 | 先跑分诊再深挖 |
| 假设已知保护器 | 自定义版本打破假设 | 先验证再选策略 |
| 只做静态分析 | 加壳/混淆代码隐藏行为 | 高熵 → 升级动态分析 |
| 只 patch 一处 | 多处校验点存在 | 枚举所有校验点 |
| 没有产物 | 结论丢失 | 始终写报告或保存产物 |
