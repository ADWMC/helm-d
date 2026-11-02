# Garlic — 快速 APK/DEX/JAR 反编译器 + ELF 分析器

> 世界最快的 APK/Java 开源反编译器，C 语言实现，多线程。

GitHub: https://github.com/neocanable/garlic

## 功能

- 反编译 APK / DEX / CLASS / JAR / WAR 文件
- 分析 aarch64 ELF（control flow / IR / imports / exports / strings / call graph）
- 多线程（默认 4 线程）
- 字符串搜索（支持正则）
- javap 风格反汇编
- dexdump 风格输出

## 速度

反编译微信（200MB+，19 万+个类）：**12 秒**，默认 4 线程。

## 安装

### 从源码编译（推荐）

```bash
# Linux/macOS（无依赖，只需 cmake >= 3.26）
git clone https://github.com/neocanable/garlic.git
cd garlic
cmake -B build
cmake --build build
./build/garlic
```

### Zig 编译（跨平台）

```bash
# 需要 zig >= 0.16.0
git clone https://github.com/neocanable/garlic.git
cd garlic
zig build --release=fast
./zig-out/bin/garlic

# 交叉编译到 Windows
zig build --release=fast -Dtarget=x86_64-windows

# 交叉编译到 Android ARM64
zig build --release=fast -Dtarget=aarch64-linux-musl
```

### Windows

查看 `docs/build-garlic-on-windows.md` 和 `docs/garlic-on-windows.md`。

## 使用方法

### 反编译 APK

```bash
garlic /path/to/android.apk
garlic /path/to/android.apk -o /path/to/save    # 指定输出目录
garlic /path/to/android.apk -t 8                 # 指定线程数
```

### 反编译 DEX

```bash
garlic /path/to/classes.dex
garlic /path/to/classes.dex -o /path/to/save
```

### 反编译 JAR

```bash
garlic /path/to/file.jar
garlic /path/to/file.jar -o /path/to/save
```

### javap 风格反汇编

```bash
garlic /path/to/jvm.class -p
garlic /path/to/dalvik.dex -p
```

### 字符串搜索

```bash
garlic ~/demo.apk -f "windowInfo"           # 搜索字符串
garlic ~/demo.jar -f "[W|w]indow"           # 正则搜索
garlic ~/demo.dex -f "info"                 # 包含搜索
```

### ELF 分析（aarch64）

```bash
garlic /path/to/libnative.so -n             # 分析 ELF
# 输出: control flow, IR, imports, exports, strings, call graph
```

## 典型工作流

### Android APK 快速分析

```
1. garlic target.apk -o output/             # 反编译所有 class
2. garlic target.apk -f "license|key|check" # 搜索关键字符串
3. 查看 output/ 下的 Java 源码
4. 定位关键类和方法
```

### Native SO 快速分析

```
1. garlic libnative.so -n                   # ELF 全量分析
2. 查看 imports/exports/strings/call graph
3. 定位关键函数
4. 用 IDA/Ghidra 深入分析
```

### 与 jadx 对比

| 维度 | garlic | jadx |
|------|--------|------|
| 语言 | C | Java |
| 速度 | 极快（12s/200MB） | 较慢 |
| 依赖 | 无 | JDK |
| ELF 分析 | 支持（aarch64） | 不支持 |
| 字符串搜索 | 内置正则 | 不支持 |
| 输出格式 | Java 源码 | Java 源码 |

### 推荐搭配

- **garlic**: 快速初筛、字符串搜索、ELF 分析
- **jadx**: 深度反编译、交叉引用、调试
- **apktool**: 解包/重打包、smali 调试
- **IDA/Ghidra**: Native SO 深度逆向

## 选项

| 选项 | 说明 |
|------|------|
| `-o <dir>` | 指定输出目录 |
| `-t <n>` | 指定线程数（默认 4） |
| `-p` | javap/dexdump 风格输出 |
| `-f <pattern>` | 字符串搜索（支持正则） |
| `-n` | ELF 分析（aarch64） |
