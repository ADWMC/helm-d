# Patterns — 安全分析模式速查

> 候选线索速查；先读 `native/protection-detection-methodology.md`，策略见 `native/packer-handling.md`。名称、字符串和段名不确认保护器或算法。

## 保护器/加壳器签名

| 候选家族 | 线索（可伪造） | 下一项核查 |
|--------|---------|------|
| UPX | `UPX!`、`UPX0`/`UPX1` | 核对块布局与解包器版本；在副本上试解并验证产物，失败不改签名硬试 |
| VMProtect | PE `.winlice`/`.boot`；ELF `.vmp0`/`.vmp1` | 核对入口、目标函数可见性与局部 VM 边界；按目标选静/动态 |
| Themida | `.themida`、高熵区域 | 核对映射、目标数据流和写后执行证据；dump 不是默认产物 |
| TUSI | `UPX_BySpra`、`TUSI-Obfus` | 对照当前 stub/块表与映射；个案 Frida 路径不适用于所有变体 |
| Jiagu (360) | `libjiagu.so`、`libjiagu_art.so` | 确认 DEX 是否隐藏及观察点；dump 需完整性校验 |
| OLLVM | CFG 扁平化、虚假块 | 校验目标调用链，局部去混淆 |
| SHVMP | 个案中的 VM、按页变换 | 定位当前样本 dispatcher 与数据流；不能由名称推出 ChaCha20 |
| ZKM | 字符串变换、Indy 指令 | 定位具体解码调用与输入输出 |

## 反分析技术速查

以下操作不是自动绕过步骤；先定位检测点并对比干预前后行为。Patch 编码还需核实 ISA、指令长度和跳转目标。

| 技术 | 检测方式 | 绕过方法 |
|------|---------|---------|
| Frida 检测 | `/proc/self/maps` 包含 `frida` | 重命名 frida-server、FUSE/bind mount |
| Anti-debug | `ptrace(PTRACE_TRACEME)` | Patch `ptrace` 调用或使用内核调试器 |
| 完整性校验 | 自哈希计算 | 运行时 patch `cmp; b.eq` → `b` |
| 直接 syscall | `svc #0` 替代 libc 调用 | 使用 `process_vm_readv` 或内核模块 |
| 时间检测 | `rdtsc` / `clock_gettime` 检测延迟 | Hook 时间函数返回伪造值 |
| 环境检测 | 检查调试器进程名、窗口类名 | 修改进程名、隐藏窗口 |
| 代码校验 | CRC32/MD5 校验代码段 | 运行时 patch 校验比较指令 |

## Patch 编码速查

### ARM64

| 原始指令 | 修改后 | 编码 | 用途 |
|---------|--------|------|------|
| `b.eq loc` | `b loc` | `0x14000000` | 强制跳转 |
| `b.ne loc` | `nop` | `0xD503201F` | 禁止跳转 |
| `cbz x0, loc` | `nop` | `0xD503201F` | 禁止条件跳转 |
| `cbnz x0, loc` | `nop` | `0xD503201F` | 禁止条件跳转 |
| `ret` | `mov x0, #1; ret` | `0x200080D2 + 0xC0035FD6` | 强制返回 1 |
| `bl func` | `nop` | `0xD503201F` | 禁止函数调用 |

### x86/x64

| 原始指令 | 修改后 | 编码 | 用途 |
|---------|--------|------|------|
| `je loc` | `jne loc` | `74 → 75` | 反转条件 |
| `jne loc` | `je loc` | `75 → 74` | 反转条件 |
| `jz loc` | `jnz loc` | `74 → 75` | 反转条件 |
| `call func` | `nop` | `E8 → 90 90 90 90 90` | 禁止函数调用 |
| `test eax, eax` | `xor eax, eax` | `85 C0 → 31 C0` | 清零 eax（强制 false） |
| `mov eax, 0` | `mov eax, 1` | `B8 00 → B8 01` | 强制返回 1 |

## 常见加密算法识别

| 算法 | 特征 | 工具 |
|------|------|------|
| XOR | 单字节/多字节循环异或 | `xor_bruteforce` |
| Base64 | `A-Za-z0-9+/=` 字符集、4 字节对齐 | `encoding_detect` |
| Hex | `0-9a-f` 字符串、偶数长度 | `encoding_detect` |
| ROT13 | 字母表偏移 13 | `encoding_detect` |
| AES | S-Box 常量 `63 7C 77 7B F2...`、16 字节块 | `native_reference --path crypto-analysis-methodology.md` |
| DES | 初始置换表、16 轮 Feistel | 静态分析找常量表 |
| RSA | 大数运算、公钥指数 65537 | 提取公钥 + factordb.com |

## 常见混淆模式

| 模式 | 特征 | 识别方法 |
|------|------|---------|
| 字符串加密 | 运行时解密、XOR/AES 加密字符串 | 高熵区域 + 解密函数 |
| 控制流扁平化 | switch-case 结构、大量虚假块 | IDA 图视图看扁平化 |
| 虚假控制流 | 不可达分支、opaque predicate | 静态分析找死代码 |
| 指令替换 | 等价指令序列膨胀 | 模式匹配找常见替换 |
| 代码虚拟化 | 自定义 VM、字节码解释器 | 找 VM handler 分发表 |

## 置信度标注规范

| 标注 | 含义 | 使用场景 |
|------|------|---------|
| **[高]** | 基于实际执行结果、源码验证、多源交叉确认 | 已验证的事实 |
| **[中]** | 基于单源证据、经验推断、部分验证 | 需要进一步确认 |
| **[低]** | 基于假设、未验证、需要进一步确认 | 仅供参考 |
| **[未知]** | 缺乏证据，明确说明缺失项 | 需要采集更多数据 |
