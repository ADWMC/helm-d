# Android ARM64 RWX Shellcode 分析实战

## 识别特征

ELF64 AArch64, entry point 落在 RWX LOAD segment (非 .text):
- `readelf -h`: Entry point address 在 RWX 段 vaddr 范围内
- RWX 段通常 >100KB, 熵 <7.0 (未加密) 或 =8.0 (全加密)
- strip 后无 section headers (e_shentsize=0)
- 解释器 `/system/bin/linker64` → Android 目标
- **入口点在 RWX 段 = shellcode，用直接系统调用 (svc #0)，libc hook 全部无效**

## 分析流程

### 1. 确认 RWX 入口

```python
import struct
with open('target', 'rb') as f:
    data = f.read()
e_entry = struct.unpack_from('<Q', data, 24)[0]
# 确认 e_entry 落在 RWX segment vaddr 范围内
```

### 2. 反汇编入口点

```python
from capstone import *
md = Cs(CS_ARCH_ARM64, CS_MODE_ARM)
instructions = list(md.disasm(data[offset:offset+4096], e_entry))
for ins in instructions[:100]:
    marker = " ← SYSCALL" if ins.mnemonic == 'svc' else ""
    print(f"  0x{ins.address:08x}: {ins.mnemonic:8s} {ins.op_str}{marker}")
```

### 3. ARM64 直接系统调用速查

| 编号 | 名称 | 用途 | | 编号 | 名称 | 用途 |
|------|------|------|-|------|------|------|
| 0x38 | openat | 打开文件 | | 0xde | mmap | 内存映射 |
| 0x3f | read | 读文件 | | 0xd2 | mprotect | 改权限 |
| 0x40 | write | 写文件 | | 0xdc | clone | 创建进程 |
| 0x39 | close | 关闭 | | 0xa7 | prctl | 进程控制 |
| 0x42 | writev | 写向量 | | 0xb1 | getpid | 获取PID |
| 0x5e | exit_group | 退出 | | 0x5d | exit | 退出 |

### 4. 解密 XOR 字符串

```python
key = 0xd5  # 从反汇编提取: mov w5, #0xd5; eor w3, w3, w5
for i in range(len(rwx_data)):
    dec = bytes(b ^ key for b in rwx_data[i:i+64])
    null = dec.find(b'\x00')
    if null > 3 and all(0x20 <= b < 0x7f for b in dec[:null]):
        print(f"  0x{i:05x}: {dec[:null].decode()}")
```

### 5. 反分析模式

**多重 /proc 扫描 + 字符串匹配**:

| /proc 文件 | 检查内容 | 目的 |
|------------|---------|------|
| /proc/self/maps | "frida"/"gum"/"gadget" | Anti-Frida |
| /proc/self/smaps | 同上 (第二层) | Anti-Frida |
| /proc/self/fd/ | fd readlink → frida-agent.so | Anti-Frida |
| /proc/self/status | TracerPid != 0 | Anti-ptrace |
| /proc/net/unix | frida-server socket | Anti-Frida |
| /proc/self/task/ | 线程名 | 反分析 |
| /proc/cpuinfo | 硬件信息 | 反模拟器 |
| /proc/uptime | 运行时间 | 反模拟器 |

检测命中 → `b #exit_func` → writev "NBG_EXIT:XX" → exit_group(0)

### 6. Anti-Frida 绕过: NOP 检测分支

**不要 patch 退出函数** — 通过 `b` (无条件跳转) 调用，无返回地址。NOP 后会跳回调用者形成死循环。

**正确方法**: 找所有跳转到退出函数的条件分支，全部 NOP。

#### 中间退出点模式

退出函数入口通常是:
```asm
mov  w10, #0x12    ; 错误码
nop
nop
b    #exit_func    ; → 0x326934 (全局退出)
```

找所有这种模式的地址，然后扫描全部代码找 `cbnz`/`b.cond` 跳转到这些地址的指令:

```python
import struct
NOP = 0xD503201F

# 1. 找中间退出点
intermediate_exits = set()
for i in range(0, rwx_size - 16, 4):
    insn0 = struct.unpack_from('<I', rwx, i)[0]
    insn3 = struct.unpack_from('<I', rwx, i+12)[0]
    if (insn0 & 0xFFE0001F) == 0x5280000A:  # mov w10, #imm
        if (insn3 & 0xFC000000) == 0x14000000:  # b
            intermediate_exits.add(rwx_va + i)

# 2. 扫描 cbnz/b.cond → 中间退出点
for i in range(0, rwx_size - 4, 4):
    insn = struct.unpack_from('<I', rwx, i)[0]
    va = rwx_va + i
    # cbnz: (insn & 0x7F000000) == 0x35000000
    # b.cond: (insn & 0xFF000010) == 0x54000000
    # 提取 imm → 计算目标 → 在 intermediate_exits 中?
    if target in intermediate_exits:
        struct.pack_into('<I', data, file_off, NOP)
```

### 7. Frida 17.x Android 兼容

```javascript
// ❌ 不可用 (17.x Windows+Android 均报 TypeError)
Module.findExportByName('libc.so', 'mprotect')
Module.getExportByName('libc.so', 'mprotect')
Memory.readByteArray(addr, 256)

// ✅ 正确
function findExport(mod, name) {
    var m = Process.findModuleByName(mod); if(!m) return null;
    var r = null;
    m.enumerateExports().forEach(function(e) {
        if (e.name===name && e.type==='function') r = e.address;
    });
    return r;
}
var bytes = new Uint8Array(addr.readByteArray(256));  // 地址对象方法
```

### 8. 多层 gzip 解嵌套 (Shell Dropper)

```python
import gzip
data = open('payload', 'rb').read()
while data[:2] == b'\x1f\x8b':
    decompressed = gzip.decompress(data)
    marker = decompressed.find(b'exit 127;')
    if marker >= 0:
        data = decompressed[marker + len(b'exit 127;\n'):]
    else:
        data = decompressed
```

终止: 前4字节为 `\x7fELF` 或 `MZ`。每层可能夹带 shell 代码副本。

### 9. Android 兼容性问题

- **libicu.so not found**: Android 10+ 拆分为 libicuuc.so + libicui18n.so
  → `ln -sf /apex/com.android.runtime/lib64/libicuuc.so /data/local/tmp/libicu.so`
- **dlopen 库不在 DT_NEEDED**: strings 看到但 readelf -d 看不到 = dlopen 动态加载
- **设备缺少目标库**: shellcode 检测到缺失后静默退出，需创建 stub .so 或安装目标应用

### 关键教训

1. 入口点在RWX段 → 直接系统调用 → libc hook 无效 — 不要换 hook 目标
2. 退出函数通过 `b` 调用无返回地址 → patch 条件分支，不 patch 退出函数
3. 中间退出点模式: `mov w10, #imm; nop; nop; b #exit_func`
4. gzip 嵌套每层夹带 shell 副本，循环直到非 gzip
5. Frida 17.x: `findExportByName`/`getExportByName` 均不可用，必须用 `enumerateExports`
