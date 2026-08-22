# Patterns — 安全分析模式速查

> 常见保护器签名、反分析技术、Patch 编码速查表。

## 保护器/加壳器签名

| 保护器 | 签名特征 | 策略 |
|--------|---------|------|
| UPX | `UPX!` magic、节名 `UPX0`/`UPX1` | `upx -d` 直接脱壳 |
| VMProtect | PE: `.winlice` + `.boot` 节；ELF: `.vmp0`/`.vmp1` | 仅动态分析，无法静态脱壳 |
| Themida | PE: `.themida` 节、高熵区域 | 动态 dump + 修复导入表 |
| TUSI | `UPX_BySpra` + trailer `TUSI-Obfus` | Frida 动态脱壳 |
| Jiagu (360) | `libjiagu.so` + `libjiagu_art.so` | `adb shell am start` + attach dump |
| OLLVM | 扁平化 CFG、虚假块、控制流混淆 | IDA + 脚本去混淆 |
| SHVMP | 自定义 VM、ChaCha20 按页加密 | Unicorn 模拟执行 |
| ZKM | 字符串加密、Indy 指令混淆 | Fernflower + 字符串还原脚本 |

## 反分析技术速查

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
| `cbz x0, loc` | `nop` | `0x1F2003D5` | 禁止条件跳转 |
| `cbnz x0, loc` | `nop` | `0x1F2003D5` | 禁止条件跳转 |
| `ret` | `mov x0, #1; ret` | `0x200080D2 + 0xC0035FD6` | 强制返回 1 |
| `bl func` | `nop` | `0x1F2003D5` | 禁止函数调用 |

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
