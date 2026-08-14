# IDAPython 速查手册

> IDA Pro 9.x Python API。  
> **禁止** `idat -A -S"script.py" target`（Standard 许可证失败）。

## 启动（IDA headless）

```python

import idc
import idautils
import idaapi
import ida_funcs
import ida_bytes
import ida_name
import ida_xref
import ida_segment
# 每个 ida_* 都要 import_module 后再用
```

CLI：

```bash
```

## 基础 API

```python
# 获取当前数据库信息
print("File:", idc.get_input_file_path())
print("Entry:", hex(idc.get_inf_attr(idc.INF_MIN_EA)))
```

## 函数遍历

```python
for func_ea in idautils.Functions():
    name = idc.get_func_name(func_ea)
    func = ida_funcs.get_func(func_ea)
    size = func.size() if func else 0
    flags = idc.get_func_attr(func_ea, idc.FUNCATTR_FLAGS)
    print(f"0x{func_ea:x}  {name:40s}  size={size}")
```

## 字符串搜索

```python
# 方法1: ida_strlist
slist = ida_strlist.string_list_t()
ida_strlist.setup_string_list(slist)
for s in slist:
    addr = s.ea
    val = idc.get_strlit_contents(addr, s.length, s.strtype)
    if val and b"keyword" in val:
        print(f"0x{addr:x}  {val.decode()}")

# 方法2: 搜索特定字符串
import ida_search
ea = ida_search.find_text(0, 0, 0, "password", ida_search.SEARCH_DOWN)
while ea != idc.BADADDR:
    print(f"Found at 0x{ea:x}")
    ea = ida_search.find_text(ea, 1, 0, "password", ida_search.SEARCH_DOWN)
```

## 交叉引用 (XREF)

```python
# 获取所有引用到 addr 的位置
for xref in idautils.XrefsTo(addr):
    from_addr = xref.frm
    func = ida_funcs.get_func(from_addr)
    func_name = idc.get_func_name(func.start_ea) if func else "unknown"
    print(f"  <- 0x{from_addr:x} ({func_name})")

# 获取从 addr 出发的引用
for xref in idautils.XrefsFrom(addr):
    print(f"  -> 0x{xref.to:x}")
```

## 内存读写

```python
# 读取字节
byte_val = ida_bytes.get_byte(addr)
word_val = ida_bytes.get_dword(addr)
qword_val = ida_bytes.get_qword(addr)
buf = ida_bytes.get_bytes(addr, 16)

# 写入字节 (Patch)
ida_bytes.patch_byte(addr, 0x90)       # NOP
ida_bytes.patch_dword(addr, 0x90909090)  # 4x NOP
ida_bytes.patch_bytes(addr, b"\x90\x90")

# 批量 NOP
for i in range(length):
    ida_bytes.patch_byte(addr + i, 0x90)
```

## 段信息

```python
for seg in idautils.Segments():
    name = idc.get_segm_name(seg)
    start = idc.get_segm_start(seg)
    end = idc.get_segm_end(seg)
    size = end - start
    print(f"{name:10s}  0x{start:x}-0x{end:x}  ({size} bytes)")
```

## 导入/导出表

```python
# 导入表
nimps = idaapi.get_import_module_qty()
for i in range(nimps):
    name = idaapi.get_import_module_name(i)
    def cb(ea, name, ord):
        print(f"  {name or f'ord:{ord}'} @ 0x{ea:x}")
        return True
    idaapi.enum_import_names(i, cb)

# 导出表
for i, (ea, name, ord) in enumerate(idautils.Entries()):
    print(f"  0x{ea:x}  {name}  ord={ord}")
```

## 函数调用图

```python
def get_callers(func_ea):
    callers = []
    for xref in idautils.XrefsTo(func_ea):
        if xref.type == ida_xref.fl_CN or xref.type == ida_xref.fl_CF:
            caller_func = ida_funcs.get_func(xref.frm)
            if caller_func:
                callers.append(caller_func.start_ea)
    return callers

def get_callees(func_ea):
    callees = []
    func = ida_funcs.get_func(func_ea)
    if not func:
        return callees
    for head in idautils.Heads(func.start_ea, func.end_ea):
        if idc.is_call_insn(head):
            for xref in idautils.XrefsFrom(head):
                if xref.type == ida_xref.fl_CN or xref.type == ida_xref.fl_CF:
                    callees.append(xref.to)
    return callees
```

## 导出函数列表到 CSV

```python
import csv

with open("C:/tmp/ida_functions.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["address", "name", "size", "calls_to", "calls_from"])
    for func_ea in idautils.Functions():
        name = idc.get_func_name(func_ea)
        func = ida_funcs.get_func(func_ea)
        size = func.size() if func else 0
        n_callees = len(get_callees(func_ea))
        n_callers = len(get_callers(func_ea))
        w.writerow([f"0x{func_ea:x}", name, size, n_callees, n_callers])

print("Exported to C:/tmp/ida_functions.csv")
idc.qexit(0)
```

## Headless 运行模板（IDA headless）

```python
# 由 IDA headless 加载本脚本，或直接在 IDA headless 初始化后粘贴逻辑


import idc
import idautils
import idaapi

idaapi.auto_wait()

with open(output_file, "w", encoding="utf-8") as f:
    for func_ea in idautils.Functions():
        name = idc.get_func_name(func_ea)
        f.write(f"0x{func_ea:x}  {name}\n")

print(f"Done: {output_file}")
```

> 若脚本在 **已由 IDA headless 打开的数据库内**运行，可省略再次 `IDA headless(...)`，但仍建议用 `hi.import_module` 取得的模块引用。

## Patch 模板

```python
# ARM64 条件跳转 → 无条件跳转
# tbnz w8, #0, addr  →  b addr
def patch_tbnz_to_b(addr, target):
    # b encoding: 0x14 + offset(26 bits)
    offset = (target - addr) >> 2
    insn = 0x14000000 | (offset & 0x03FFFFFF)
    ida_bytes.patch_dword(addr, insn)
    print(f"Patched 0x{addr:x} → b 0x{target:x}")

# x86 NOP
def nop_range(addr, length):
    for i in range(length):
        ida_bytes.patch_byte(addr + i, 0x90)
    print(f"NOPped 0x{addr:x} ({length} bytes)")

# 函数返回 1 (ARM64)
def patch_return_true(addr):
    # mov w0, #1; ret
    ida_bytes.patch_dword(addr, 0x52800020)      # mov w0, #1
    ida_bytes.patch_dword(addr + 4, 0xD65F03C0)  # ret
    print(f"Patched return true at 0x{addr:x}")
```
