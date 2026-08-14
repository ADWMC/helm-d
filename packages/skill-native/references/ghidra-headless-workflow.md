# Ghidra Headless 分析工作流

## 快速启动

```bash
# 设置 JAVA_HOME（Windows 上必须用反斜杠或 MSYS 路径）
export JAVA_HOME="$SCOOP/apps/corretto-jdk/current"

# 首次导入 + 自动分析 + 运行 Java 脚本
  "C:\\path\\to\\project_dir" "project_name" \
  -import "C:\\path\\to\\target.so" \
  -postScript "C:\\path\\to\\script.java" \
  -scriptPath "C:\\path\\to\\scripts_dir"

# 已有项目：重新分析（不重新导入）
  "C:\\path\\to\\project_dir" "project_name" \
  -process "target.so" \
  -noanalysis \
  -postScript "C:\\path\\to\\script.java" \
  -scriptPath "C:\\path\\to\\scripts_dir"
```

## 命令行参数

| 参数 | 说明 |
|------|------|
| `<project_dir>` | 项目目录（必须存在） |
| `<project_name>` | 项目名称 |
| `-import <file>` | 导入新文件（首次） |
| `-process <name>` | 指定已导入的文件（后续） |
| `-noanalysis` | 跳过自动分析（配合 `-process` 使用） |
| `-postScript <file.java>` | 分析后运行的 Java 脚本 |
| `-scriptPath <dir>` | 脚本搜索路径 |

## 关键坑

### 1. PyGhidra 不可用
headless 模式**只支持 Java 脚本**（`extends GhidraScript`），不支持 `.py` 脚本。
错误信息：`Ghidra was not started with PyGhidra. Python is not available`

### 2. `-max-jvm-heap` 无效
Ghidra 12.x headless 不认 `-max-jvm-heap` 参数。
控制堆大小：`export GHIDRA_JAVA_OPTS="-Xmx2G"` 或修改 `support/launch.properties`。

### 3. `-noanalysis` 后 currentProgram 为 null
单独用 `-noanalysis` 时 Ghidra 不打开程序上下文，脚本中 `currentProgram` 为 null。
必须配合 `-process "filename.so"` 指定已有项目中的文件。

### 4. 地址偏移
Ghidra 默认 image base = `0x100000`，而 `readelf` 显示 `0x0`。
转换公式：`ghidra_addr = readelf_addr + 0x100000`

### 5. getFunctionAt 按地址查找失败
由于地址偏移问题，用 `getFunctionAt(toAddr(readelf_addr))` 可能返回 null。
更可靠的方法：用 `FunctionManager.getFunctions(true)` 按名称遍历。

### 6. Java 类名必须匹配文件名
`DecompileIntegrity.java` 内必须是 `public class DecompileIntegrity`。
不匹配时报 `ClassNotFoundException`。

### 7. Ghidra API 常见拼写错误
- `getDecompiledFunction()` 不是 `depiledFunction()`
- `Reference` 在 `ghidra.program.model.symbol` 包，不在 `listing`

### 8. 内存需求
Ghidra headless 分析 11MB ELF 约需 1GB+ 堆内存。
系统空闲内存 < 1GB 时会 JVM 崩溃。

## Java 脚本模板

见 `scripts/ghidra/DecompileAll.java`

基本结构：
```java
import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;

public class MyScript extends GhidraScript {
    @Override
    public void run() throws Exception {
        DecompInterface decomp = new DecompInterface();
        decomp.openProgram(currentProgram);

        Function func = getFunctionAt(toAddr(0x123456));
        DecompileResults result = decomp.decompileFunction(func, 120, monitor);
        if (result.getDecompiledFunction() != null) {
            println(result.getDecompiledFunction().getC());
        }
        decomp.dispose();
    }
}
```

## ADRP+ADD 手动搜索（当 Ghidra XREF 失效时）

```python
import struct

def find_adrp_add_ref(data, target_addr, text_start, text_end):
    """Find ADRP+ADD instructions that load target_addr"""
    page = target_addr & ~0xfff
    page_offset = target_addr & 0xfff
    results = []
    for addr in range(text_start, text_end, 4):
        insn = struct.unpack_from('<I', data, addr)[0]
        # ADRP: 1xx10000
        if (insn & 0x9f000000) == 0x90000000:
            rd = insn & 0x1f
            immhi = (insn >> 5) & 0x7ffff
            immlo = (insn >> 29) & 0x3
            imm = (immhi << 2) | immlo
            if imm & 0x100000:
                imm -= 0x200000
            adrp_page = (addr & ~0xfff) + (imm << 12)
            if adrp_page == page:
                next_insn = struct.unpack_from('<I', data, addr+4)[0]
                if (next_insn & 0xffc00000) == 0x91000000:  # ADD imm12
                    add_rn = (next_insn >> 5) & 0x1f
                    add_imm = (next_insn >> 10) & 0xfff
                    if add_rn == rd and add_imm == page_offset:
                        results.append(addr)
    return results
```

## 性能数据

| 文件大小 | 分析时间 | 内存占用 |
|----------|----------|----------|
| 11 MB ARM64 ELF | ~305 秒 | ~1 GB |
| 1 MB ELF | ~30 秒 | ~300 MB |
