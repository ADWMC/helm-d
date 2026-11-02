# r2pipe 速查手册

> radare2 Python API，通过 r2pipe 连接 r2 实例进行自动化分析

## 安装与连接

```python
import r2pipe

# 打开文件
r2 = r2pipe.open("target.bin")

# 打开并自动分析
r2 = r2pipe.open("target.bin", flags=["-2"])  # -2 = quiet mode
r2.cmd("aaa")  # 全量分析

# 连接远程 r2
r2 = r2pipe.open("http://localhost:9090")

# 连接后清理
r2.quit()
```

## 基础分析

```python
# 获取文件信息
info = r2.cmdj("ij")
print(info["core"]["file"], info["bin"]["arch"], info["bin"]["bits"])

# 全量分析
r2.cmd("aaa")

# 分析函数
r2.cmd("af @ main")  # 分析 main 函数
r2.cmd("af @@ sym.*")  # 分析所有符号函数
```

## 函数操作

```python
# 列出所有函数
funcs = r2.cmdj("aflj")
for f in funcs:
    print(f"0x{f['offset']:x}  {f['name']}  size={f['size']}")

# 获取当前函数信息
func = r2.cmdj("afij")
# 获取函数边界
bounds = r2.cmd("afi")

# 搜索函数
r2.cmd("aflj | grep keyword")
```

## 反汇编

```python
# 反汇编 20 条指令
disasm = r2.cmd("pd 20 @ main")

# 反汇编并获取 JSON
disasm_json = r2.cmdj("pdj 20 @ main")

# 获取当前地址的指令
insn = r2.cmdj("aoj")[0]
print(insn["opcode"], insn["type"])

# 反编译 (需要 r2ghidra)
decomp = r2.cmd("pdg @ main")  # Ghidra decompiler
```

## 字符串操作

```python
# 获取所有字符串
strings = r2.cmdj("izj")
for s in strings:
    print(f"0x{s['vaddr']:x}  {s['string']}")

# 搜索字符串
r2.cmd("/ password")

# 字符串 XREF
r2.cmd("axt @ str.password")
```

## 内存读写

```python
# 读取字节
byte_val = r2.cmdj("pv1 @ addr")  # 1 byte
word_val = r2.cmdj("pv4 @ addr")  # 4 bytes
qword_val = r2.cmdj("pv8 @ addr")  # 8 bytes

# 读取 hex
hex_data = r2.cmd("p8 16 @ addr")

# 写入字节 (Patch)
r2.cmd("wx 90909090 @ addr")  # NOP x4
r2.cmd("wa nop @ addr")  # 单条 NOP
r2.cmd("wa b 0x1234 @ addr")  # 写入跳转

# 批量 NOP
r2.cmd(f"wx {'90' * length} @ {addr}")
```

## 段/节信息

```python
# 获取所有段
sections = r2.cmdj("iSj")
for s in sections:
    print(f"{s['name']:10s}  0x{s['vaddr']:x}  {s['vsize']} bytes")

# 获取所有段
segments = r2.cmdj("iSj")
```

## 导入/导出

```python
# 导入表
imports = r2.cmdj("iij")
for imp in imports:
    print(f"{imp['name']} @ 0x{imp['plt']:x}")

# 导出表
exports = r2.cmdj("iEj")
for exp in exports:
    print(f"{exp['name']} @ 0x{exp['vaddr']:x}")
```

## XREF 追踪

```python
# 获取引用到 addr 的所有位置
xrefs = r2.cmdj(f"axtj @ {addr}")
for ref in xrefs:
    print(f"  <- 0x{ref['from']:x} ({ref.get('fcn_name', 'unknown')})")

# 获取从 addr 出发的引用
xrefs = r2.cmdj(f"axfj @ {addr}")
```

## 控制流图

```python
# 获取函数 CFG (JSON)
cfg = r2.cmdj("agfj @ main")

# 导出 DOT
dot = r2.cmd("agfd @ main")

# 导出 SVG
svg = r2.cmd("agfs @ main")
```

## 搜索

```python
# 字节搜索
hits = r2.cmdj("/xj 90909090")
for hit in hits:
    print(f"NOP sled at 0x{hit['offset']:x}")

# 字符串搜索
hits = r2.cmdj("/sj password")

# ROP gadget
rops = r2.cmdj("/Rj pop; ret")
```

## 调试

```python
# 设置断点
r2.cmd("db main")
r2.cmd("db 0x1234")

# 运行
r2.cmd("dc")  # continue
r2.cmd("ds")  # step
r2.cmd("dso 10")  # step over 10 instructions

# 寄存器
regs = r2.cmdj("drj")
print(regs["rax"], regs["rsp"])

# 栈
stack = r2.cmd("pxr 64 @ rsp")
```

## 批量分析模板

```python
import r2pipe
import os
import json

def analyze_binary(target):
    r2 = r2pipe.open(target, flags=["-2"])
    r2.cmd("aaa")

    result = {
        "file": target,
        "arch": r2.cmdj("ij")["bin"]["arch"],
        "functions": len(r2.cmdj("aflj") or []),
        "strings": len(r2.cmdj("izj") or []),
        "imports": len(r2.cmdj("iij") or []),
        "exports": len(r2.cmdj("iEj") or []),
    }

    # Extract key functions
    for func in (r2.cmdj("aflj") or [])[:10]:
        decomp = r2.cmd(f"pdg @ {func['offset']}")
        if decomp:
            result[f"func_{func['name']}"] = decomp[:500]

    r2.quit()
    return result

# Batch process
for f in os.listdir("samples/"):
    if f.endswith((".bin", ".elf", ".exe")):
        r = analyze_binary(os.path.join("samples/", f))
        print(json.dumps(r, indent=2))
```

## YARA 集成 (需要 r2yara)

```python
# 加载 YARA 规则
r2.cmd("yr rules.yar")

# 扫描
matches = r2.cmdj("yrsj")
for m in matches:
    print(f"Rule: {m['rule']}")
```
