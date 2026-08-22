# Ghidra Python 脚本速查

> 适用于 Ghidra 12.x headless 模式和 Ghidra GUI 内置脚本管理器

## Headless 模式

```bash
# 基本用法
analyzeHeadless /tmp/projects MyProject -import target.bin -postScript script.py

# 带参数
analyzeHeadless /tmp/projects MyProject -import target.bin -postScript script.py arg1 arg2

# 指定脚本路径
analyzeHeadless /tmp/projects MyProject -import target.bin \
  -postScript ExportFunctions.java \
  -scriptPath /path/to/scripts

# 批量分析多个文件
for f in *.bin; do
  analyzeHeadless /tmp/projects "$f" -import "$f" -postScript DecompileAll.java -deleteProject
done
```

## GhidraScript API (Java)

### 获取当前程序信息

```java
Program prog = currentProgram;
String name = prog.getName();
Address entry = prog.getSymbolTable().getEntryPoint();
Language lang = prog.getLanguage();
CompilerSpec spec = prog.getCompilerSpec();
```

### 遍历函数

```java
FunctionManager fm = currentProgram.getFunctionManager();
for (Function f : fm.getFunctions(true)) {
    String name = f.getName();
    Address addr = f.getEntryPoint();
    int size = (int) f.getBody().getNumAddresses();
    boolean external = f.isExternal();
    boolean thunk = f.isThunk();
}
```

### 获取反编译结果

```java
DecompInterface decomp = new DecompInterface();
decomp.openProgram(currentProgram);
DecompiledResults res = decomp.decompileFunction(func, 10, monitor);
if (res.decompileCompleted()) {
    String c_code = res.getDecompiledFunction().getC();
    ClangNode root = res.getCCodeMarkup();
}
decomp.dispose();
```

### 字符串搜索

```java
Listing listing = currentProgram.getListing();
for (Data data : listing.getDefinedData(true)) {
    if (data.hasStringValue()) {
        String val = data.getDefaultValueRepresentation();
        Address addr = data.getAddress();
    }
}
```

### 交叉引用

```java
ReferenceManager rm = currentProgram.getReferenceManager();
Reference[] refs = rm.getReferencesTo(addr);
for (Reference ref : refs) {
    Address from = ref.getFrom();
    Function f = getFunctionContaining(from);
}
```

### 内存读写

```java
Memory mem = currentProgram.getMemory();
byte[] buf = new byte[16];
mem.getBytes(addr, buf);
mem.setByte(addr, (byte) 0x90);  // NOP
mem.setInt(addr, 0x1400001234);  // Write 4 bytes
```

### Patch 操作

```java
// NOP fill
for (int i = 0; i < len; i++) {
    setByte(addr.add(i), (byte) 0x90);
}

// 写入指令
setInt(addr, 0x1400001234);  // b 0x1234
```

## Jython (Ghidra GUI 内置 Python)

```python
# 获取当前程序
prog = currentProgram
fm = prog.getFunctionManager()

# 遍历函数
for func in fm.getFunctions(True):
    print(hex(func.getEntryPoint().getOffset()), func.getName())

# 获取反编译
from ghidra.app.decompiler import DecompInterface
decomp = DecompInterface()
decomp.openProgram(prog)
res = decomp.decompileFunction(func, 10, monitor)
print(res.getDecompiledFunction().getC())

# 内存读取
mem = prog.getMemory()
buf = mem.getBytes(addr, 16)

# Patch
mem.setByte(addr, 0x90)
```

## 常用脚本模板

### 导出函数列表 (CSV)

```java
PrintWriter pw = new PrintWriter(new FileWriter("functions.csv"));
pw.println("address,name,size,external");
for (Function f : currentProgram.getFunctionManager().getFunctions(true)) {
    pw.printf("0x%x,%s,%d,%s%n",
        f.getEntryPoint().getOffset(),
        f.getName(),
        f.getBody().getNumAddresses(),
        f.isExternal());
}
pw.close();
```

### 批量反编译

```java
DecompInterface decomp = new DecompInterface();
decomp.openProgram(currentProgram);
for (Function f : fm.getFunctions(true)) {
    DecompiledResults res = decomp.decompileFunction(f, 10, monitor);
    if (res.decompileCompleted()) {
        // res.getDecompiledFunction().getC()
    }
}
decomp.dispose();
```

### 字符串 + XREF 导出

```java
PrintWriter pw = new PrintWriter(new FileWriter("strings.csv"));
pw.println("string_addr,string,xref_from,function");
for (Data data : currentProgram.getListing().getDefinedData(true)) {
    if (data.hasStringValue()) {
        for (Reference ref : getReferencesTo(data.getAddress())) {
            Function f = getFunctionContaining(ref.getFrom());
            pw.printf("0x%x,%s,0x%x,%s%n",
                data.getAddress().getOffset(),
                data.getDefaultValueRepresentation(),
                ref.getFrom().getOffset(),
                f != null ? f.getName() : "");
        }
    }
}
pw.close();
```
