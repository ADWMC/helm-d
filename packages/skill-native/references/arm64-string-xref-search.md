# ARM64 ADRP+ADD 字符串引用搜索

当 r2 `axt` 或 IDA xref 找不到字符串引用时（常见于大文件或 stripped binary），手动搜索 ADRP+ADD 指令对。

## 原理

ARM64 访问远地址字符串的标准模式：
```
ADRP Xn, page_offset    ; 加载页基址 (4KB 对齐)
ADD  Xn, Xn, #page_off  ; 加页内偏移
```

## Python 搜索脚本

```python
import struct

def find_adrp_add_refs(data, target_addr, text_start=0xd01b0, text_end=None):
    """搜索 ADRP+ADD 引用到 target_addr 的指令地址"""
    if text_end is None:
        text_end = len(data)
    
    page = target_addr & ~0xfff
    page_offset = target_addr & 0xfff
    results = []
    
    for addr in range(text_start, text_end, 4):
        insn = struct.unpack_from('<I', data, addr)[0]
        
        # ADRP: 1xx10000 + imm
        if (insn & 0x9f000000) != 0x90000000:
            continue
        
        rd = insn & 0x1f
        immhi = (insn >> 5) & 0x7ffff
        immlo = (insn >> 29) & 0x3
        imm = (immhi << 2) | immlo
        if imm & 0x100000:
            imm -= 0x200000
        
        adrp_page = (addr & ~0xfff) + (imm << 12)
        if adrp_page != page:
            continue
        
        # 检查后续 1-5 条指令是否有 ADD Xn, Xn, #page_offset
        for delta in range(1, 6):
            next_addr = addr + delta * 4
            if next_addr >= text_end:
                break
            next_insn = struct.unpack_from('<I', data, next_addr)[0]
            # ADD imm12: 1001000100 + imm12 + Rn + Rd
            if (next_insn & 0xffc00000) != 0x91000000:
                continue
            add_rn = (next_insn >> 5) & 0x1f
            add_imm = (next_insn >> 10) & 0xfff
            if add_rn == rd and add_imm == page_offset:
                results.append(addr)
                break
    
    return results

# 使用示例
with open('target.so', 'rb') as f:
    data = f.read()

# 搜索引用到 0x7ef0e2 (/proc/self/maps) 的代码
refs = find_adrp_add_refs(data, 0x7ef0e2)
print(f'References: {[hex(r) for r in refs]}')
```

## Ghidra 替代方案

Ghidra headless 按名搜索更可靠（不受 rebasing 影响）：

```java
// 在 Ghidra Java 脚本中
FunctionManager fm = currentProgram.getFunctionManager();
Iterator<Function> funcs = fm.getFunctions(true);
while (funcs.hasNext()) {
    Function func = funcs.next();
    if (func.getName().contains("targetPattern")) {
        // 反编译此函数
    }
}
```

## 适用场景

- r2 `axt` 对 stripped binary 大文件找不到 xref
- Ghidra headless 地址偏移问题（image base 0x100000）
- 需要快速定位字符串引用而不想等全量分析

## 注意事项

- ADRP 范围 ±4GB（±1MB 页），超大二进制可能需要分段
- 部分编译器用 ADRP+LDR 替代 ADRP+ADD（通过 GOT 间接引用）
- `-O0` 编译的代码可能用 MOVZ+MOVK 替代 ADRP
