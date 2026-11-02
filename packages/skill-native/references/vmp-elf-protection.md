# ELF VMP (Virtual Machine Protection) 架构与实现

> SHVMP 项目实战经验。项目地址: https://github.com/ADWMC/shvmp

## 核心架构

```
输入 ELF → 解析符号表 → 获取函数地址/大小
    ↓
UnicornAnalyzer.analyzeFunction() → 模拟执行 ARM64 指令
    ↓
生成 VM 字节码 (.bin) → ChaCha20 加密
    ↓
vmcore.c (Unicorn 引擎) 读取 .bin → 运行时执行 VM 字节码
    ↓
输出保护后的 ELF
```

## 关键设计决策

### 1. Unicorn 引擎 vs 手写 VM

**选择 Unicorn 的理由:**
- 不需要自己实现 60+ ARM64 操作码
- 直接使用 `UC_ARM64_REG_*` 常量，无寄存器映射问题
- 指令对齐问题由 Unicorn 内部处理

**代价:**
- 依赖 libunicorn-dev（体积 ~2MB）
- 需要交叉编译 aarch64 版本

### 2. 操作码设计（25 个）

```
STOP=0, MEMR=1, MEMW=2, XOR=3, ADD=4, SUB=5, SHR=6, SHL=7,
CMP=8, JMP=9, RDTSC=10, MUL=11, DIV=12, AND=13, OR=14,
SAR=15, ROR=16, ROL=17, LOADH=18, LOADB=19, STOREH=20,
STOREB=21, CSEL=22, NATIVE=23, VMEXIT=24
```

覆盖 95% 的 ARM64 常见指令。不支持的指令用 NATIVE 回退到原生执行。

### 3. 字节码格式（VMPacker 风格）

```
[uint32 arg_count]       # 1=R, 2=RR, 3=RRR, 4=RRI
[uint64 insn_addr]       # 原始指令地址
[uint64 reg_id]          # 目标寄存器 ID (Unicorn 常量)
[uint64 value_type]      # 0=寄存器, 1=立即数
[uint64 prev_value]      # 执行前值
[uint64 curr_value]      # 执行后值
[uint32 padding]         # 对齐
[char[8] mnemonic]       # 指令助记符
[char[64] operand_str]   # 操作数字符串
```

### 4. 加密层设计

| 层 | 算法 | 用途 |
|----|------|------|
| 密钥派生 | SHA256(ELF前64字节) + ChaCha20(固定盐) | 每个二进制独立密钥 |
| 段加密 | ChaCha20（每段独立 nonce = base_nonce XOR 段索引） | .text 段加密 |
| 按页加密 | ChaCha20（每页独立 nonce = base_nonce + page_index） | 4KB 分页 |
| 字节码加密 | XOR + 字节反转 | VM 字节码保护 |
| 操作码加密 | XOR(操作码, key, 位置) | 防静态分析 |

### 5. 反调试设计

Loader 层（C 实现）:
- ptrace 自检（PTRACE_TRACEME）
- /proc/self/status TracerPid 检测
- 时间差检测（CLOCK_MONOTONIC, 10ms 阈值）
- /proc/self/fd 扫描 Frida 管道

VM 层:
- RDTSC 操作码（运行时时间戳检测）

## 项目文件结构

```
shvmp/
├── src/
│   ├── python/
│   │   ├── unicorn_analyzer.py    # Unicorn 函数分析器
│   │   ├── vm_bytecode.py         # VM 字节码定义 (25 操作码)
│   │   ├── vm_compiler.py         # 字节码编译器 (支持 use_unicorn)
│   │   ├── vm_crypto.py           # 指令集 + 加密器
│   │   ├── vmp_protector.py       # VMP 保护器 (整合 Unicorn)
│   │   ├── binary_patch.py        # ELF 注入 + 按页加密
│   │   ├── arm64_disasm.py        # ARM64 反汇编器
│   │   └── elf_parser.py          # ELF 解析器
│   ├── c/
│   │   ├── vm/
│   │   │   ├── vm_exec.c          # VM 字节码解释执行器
│   │   │   ├── vm_core.h          # VM 核心头文件
│   │   │   └── vmcore.c           # Unicorn 驱动 VM 执行引擎
│   │   ├── loader/
│   │   │   └── loader.c           # 自解压 loader (ChaCha20/AES)
│   │   └── cli/
│   │       └── main.c             # CLI 入口
│   └── qt_ui/                     # Qt GUI (可选)
├── tests/
├── docs/
│   └── tasks-cloud-execution.md   # 任务清单 (4 阶段)
└── Makefile
```

## 任务推进策略\n\nSHVMP 采用 4 阶段推进（见 tasks-cloud-execution.md）:\n\n| 阶段 | 优先级 | 状态 | 内容 |\n|------|--------|------|------|\n| P0 | 立即 | ✅ 完成 | Makefile 交叉编译、Loader 修复、反调试、Key 派生 |\n| P1 | 本周 | ✅ 完成 | Unicorn 分析器、字节码编译器、vmcore.c、操作码扩展、按页加密 |\n| P2 | 下周 | 待开始 | Loader 自身加密、多轮加密、CI/CD、字符串分类加密 |\n| P3 | 后续 | 待开始 | VM 字节码加密、多 VM 实例、延迟解密、伪造符号表 |\n\n## P1 实现细节（已完成）\n\n### vmcore.c API\n\n```c\nuint64_t vm_jumpto(\n    const char *bin_path,      // .bin 文件路径 (VMPacker 格式 120 字节/条)\n    uint64_t *reg_init,        // 寄存器初始值 (可选, NULL=默认)\n    uint64_t support_cmd,      // 支持的操作码位图\n    uint64_t support_reg       // 支持的寄存器位图\n);\n// 返回 X0 寄存器最终值\n// 编译: gcc -o vmcore vmcore.c -lunicorn\n// 独立版: gcc -DVMCORE_STANDALONE -o vmcore-cli vmcore.c -lunicorn\n```\n\n### PageEncryptor 实现\n\nPython 端独立 ChaCha20 实现（与 loader.c 对齐），避免运行时依赖：\n- `encrypt_text_segment(text_data, base_nonce, key)` → (encrypted, page_boundaries)\n- `decrypt_text_segment(encrypted_data, base_nonce, key, original_size)` → decrypted\n- 每页 nonce: `base_nonce[20:24] XOR page_index_LE32`\n\n### 向后兼容模式\n\nvm_bytecode.py 扩展到 25 操作码后，为 unicorn_analyzer.py 保留别名：\n```python\nNOP = 25    # 空操作\nLOAD = 26   # 加载立即数 (兼容)\nSTORE = 27  # 存储 (兼容)\nMOV = 28    # 寄存器移动 (兼容)\n```\nunicorn_analyzer 的翻译逻辑使用这些别名，vmcore.c 通过 mnemonic 字符串识别。\n\n### 并行任务模式\n\nSHVMP 是多文件 C+Python 项目，适合 delegate_task 并行：\n- Subagent 1: Python 分析器/字节码 (unicorn_analyzer.py + vm_bytecode.py)\n- Subagent 2: C VM 引擎 (vmcore.c + Makefile)\n- Subagent 3: 加密/编译器 (binary_patch.py + vm_compiler.py)\n- 主线程: vm_crypto.py + vm_core.h + vm_exec.c + vmp_protector.py\n\n关键: 每个 subagent 的 context 必须包含完整的文件路径和期望格式，不依赖对话历史。

## 常见陷阱

| 问题 | 原因 | 解决 |
|------|------|------|
| Unicorn 分析结果与原生执行不一致 | 未初始化内存/栈导致 Unicorn 行为差异 | 设置完整初始寄存器状态 + 映射栈内存 |
| 交叉编译 loader 链接失败 | Android NDK 缺少 libunicorn | 需要静态编译 Unicorn 或用 NDK 交叉编译 |
| 按页加密后 ELF 段对齐错乱 | 4KB 页边界与 ELF 段边界不一致 | 加密前记录页边界信息到 packed header |
| vmp_protector 用 Unicorn 模式时崩溃 | 未处理未知指令（NATIVE 回退不完整） | 保证所有 ARM64 指令都有对应的 VMOperation 或 NATIVE 回退 |
| Windows 上 patch 工具对 /tmp/ 路径失败 | patch 工具将 /tmp/ 解析为 C:\\tmp\\ | 用 execute_code + read_file/write_file 操作，避免 patch 工具的路径解析 |
| patch 替换 class 定义时误删相邻类 | patch 匹配 `class X:` 可能吞掉后续 class | 插入新 class 用 write_file 精确定位，不用 patch 匹配 class 头 |

## SHVMP v3.0 变体（ADLI 样本，2026-07）

> 完整分析报告见 `elvmp-analysis-workflow.md`

v3.0 与上述参考架构的关键差异：

| 特性 | 参考架构 | v3.0 (ADLI) |
|------|---------|-------------|
| VM 层 | 25 操作码 Unicorn VM | **无 VM 层**，直接解密执行 |
| 加密 | ChaCha20 按页 | AES-CTR + ChaCha20 **双算法** |
| 密钥 | 单阶段 | **两阶段**（本地派生 + 服务端 HTTP） |
| 传输 | - | HTTP 明文 (最大弱点) |
| Loader 符号 | 已 strip | **未 strip** (函数名完整暴露) |
| Payload | 按页加密 | 13MB 全量附加加密 |

服务端通信格式：
```
POST http://<server>:8080/api
User-Agent: shvmp-loader/3.0
Body: {"elf_fingerprint":"%s"}
Resp: {"key2":"...", "nonce":"..."}
```

攻击面优先级：HTTP 中间人 > Hook decrypt_data > Hook execve > 静态 derive_key 逆向

## 安全加固检查清单

> 详见 `commercial-hardening-standards.md`

### 失败态统一（P0）

loader.c 中所有失败路径应统一为：
```c
// 不同失败原因 → 相同外部行为
secure_zero(derived_key, sizeof(derived_key));
_exit(0);  // 不是 return 1，不打印任何消息
```

### 保护链闭合（P0）

```
□ strings 看不到关键字符串
□ .text 段加密完整
□ .rodata 段加密（常见遗漏）
□ loader 不是明文
□ VM metadata 不暴露操作码表
□ key 不是硬编码
```

### 二次打包防御（P0）

```
□ 修改 .text 后 hash 校验拒绝执行
□ 替换 loader 后无法解密
□ 修改 VM bytecode 后校验失败
```
