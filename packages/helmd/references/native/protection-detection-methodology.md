# PE/ELF 保护检测方法论

> 检测和分析常见二进制保护器：UPX, VMProtect, Themida, OLLVM, TUSI

## 一、快速检测

### 1.1 文件头检查
```bash
# 文件类型
file target.bin

# PE 段名
objdump -h target.exe | grep -E "\.vmp|\.winlice|\.boot|\.upx|\.ndata"

# ELF 段名
readelf -S target.elf | grep -E "\.vmp|\.upx|\.tusi"
```

### 1.2 签名检测
```bash
# UPX 签名
strings target.bin | grep -i "UPX!"
rafind2 -s "UPX!" target.bin

# VMProtect 签名
strings target.bin | grep -i "VMProtect"
strings target.bin | grep -i "vmp"

# Themida 签名
strings target.bin | grep -i "Themida"
strings target.bin | grep -i "WinLicense"

# TUSI 签名
strings target.bin | grep -i "TUSI-ObfuscatorClang"
strings target.bin | grep -i "UPX_BySpra"
```

### 1.3 熵分析
```python
import math
from collections import Counter

def section_entropy(data):
    """计算数据熵"""
    if not data:
        return 0
    freq = Counter(data)
    length = len(data)
    return -sum((c/length) * math.log2(c/length) for c in freq.values())

def detect_packer_by_entropy(sections):
    """通过段熵检测保护器"""
    for name, data in sections.items():
        ent = section_entropy(data)
        if ent > 7.5:
            print(f"  {name}: entropy={ent:.2f} (HIGH - possibly packed/encrypted)")
        elif ent < 1.0:
            print(f"  {name}: entropy={ent:.2f} (LOW - possibly null/padding)")
        else:
            print(f"  {name}: entropy={ent:.2f}")
```

## 二、保护器识别

### 2.1 UPX
```bash
# 检测
strings target | grep "UPX!"
xxd target | grep "UPX!"

# 脱壳
upx -d target

# 失败? 检查是否修改了签名
xxd -s 0xBE -l 32 target  # ELF header padding
# 如果有 "UPX_BySpra" → TUSI 定制 UPX
```

### 2.2 VMProtect
```bash
# PE 段名
objdump -h target.exe | grep -E "\.vmp|\.winlice|\.boot"

# ELF 段名
readelf -S target.elf | grep -E "\.vmp0|\.vmp1"

# 字符串
strings target | grep -i "VMProtect"

# 特征: 所有字符串加密，静态分析几乎不可能
# 必须转动态分析 (Frida/x64dbg)
```

### 2.3 Themida
```bash
# 段名
objdump -h target.exe | grep -E "\.themida|\.winlice"

# 字符串
strings target | grep -i "Themida"
strings target | grep -i "WinLicense"

# 特征: 代码虚拟化，类似 VMP
```

### 2.4 OLLVM (Obfuscator-LLVM)
```bash
# 特征: 控制流平坦化
# 反汇编中看到:
# - 大量 switch-case 结构
# - 变量名如 "switch.table"
# - 不自然的控制流

# 检测方法: 查找 LLVM IR 特征
strings target | grep -i "obfuscator"
strings target | grep -i "ollvm"
```

### 2.5 TUSI-ObfuscatorClang
```bash
# 签名
strings target | grep "TUSI-ObfuscatorClang"
strings target | grep "UPX_BySpra"

# 特征:
# - 定制 UPX 壳 (修改了 NRV2B 算法)
# - /dev/shm mmap 运行时解壳
# - 静态不可解压

# 脱壳: 必须用 Frida 动态 dump
```

## 三、自动检测脚本

```python
import struct

def detect_pe_packer(data):
    """检测 PE 保护器"""
    # 检查 PE 头
    if data[:2] != b'MZ':
        return "Not PE"
    
    pe_offset = struct.unpack_from('<I', data, 0x3C)[0]
    if data[pe_offset:pe_offset+4] != b'PE':
        return "Invalid PE"
    
    num_sections = struct.unpack_from('<H', data, pe_offset + 6)[0]
    opt_size = struct.unpack_from('<H', data, pe_offset + 20)[0]
    section_offset = pe_offset + 24 + opt_size
    
    sections = []
    for i in range(num_sections):
        sec = data[section_offset + i * 40 : section_offset + (i + 1) * 40]
        name = sec[:8].rstrip(b'\x00').decode('ascii', errors='ignore')
        sections.append(name)
    
    # 检测保护器
    if any('.vmp' in s for s in sections):
        return "VMProtect"
    if any('.winlice' in s for s in sections):
        return "VMProtect or Themida"
    if any('.themida' in s for s in sections):
        return "Themida"
    if any('.boot' in s for s in sections):
        return "VMProtect boot"
    
    return "Unknown"

def detect_elf_packer(data):
    """检测 ELF 保护器"""
    if data[:4] != b'\x7fELF':
        return "Not ELF"
    
    # 检查段名
    sections = []
    # 简单搜索段名
    for name in [b'.vmp0', b'.vmp1', b'.upx', b'.tusi']:
        if name in data:
            sections.append(name.decode())
    
    if '.vmp0' in sections or '.vmp1' in sections:
        return "VMProtect"
    if '.upx' in sections:
        return "UPX"
    
    # 检查字符串
    if b'TUSI-ObfuscatorClang' in data:
        return "TUSI-ObfuscatorClang"
    if b'UPX_BySpra' in data:
        return "TUSI (Modified UPX)"
    
    return "Unknown"
```

## 四、脱壳策略

| 保护器 | 静态脱壳 | 动态脱壳 | 难度 |
|--------|---------|---------|------|
| UPX (标准) | `upx -d` | Frida dump | 简单 |
| UPX (TUSI) | 不可能 | Frida hook /dev/shm | 中等 |
| VMProtect | 不可能 | Frida spawn + dump | 困难 |
| Themida | 不可能 | x64dbg + ScyllaHide | 困难 |
| OLLVM | 反混淆脚本 | - | 中等 |
