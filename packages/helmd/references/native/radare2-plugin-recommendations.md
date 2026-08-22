# radare2 插件推荐清单

> 更新时间: 2026-07-17 | 环境: Windows 10 + Git Bash (MSYS2)

## 已安装

| 插件 | 版本 | 路径 | 用途 | 状态 |
|------|------|------|------|------|
| **r2ghidra** | 6.1.8 | scoop/apps/radare2/current/lib/plugins/core_r2ghidra.dll | Ghidra 反编译（`pdg` 命令） | ✅ 已安装 |
| **r2ghidra_sleigh** | 6.1.8 | scoop/apps/radare2/current/lib/radare2/6.1.8/r2ghidra_sleigh/ | sleigh 处理器定义文件 | ✅ 已安装 |

## 推荐但未安装

以下插件通过 `r2pm` 管理，但**大部分不原生支持 Windows**（缺少 `R2PM_INSTALL_WINDOWS` 指令），需要手动从源码编译。

### 反编译类

| 插件 | 用途 | 手动安装难度 | 替代方案 |
|------|------|-------------|---------|
| **r2dec** | 基于 QuickJS 的轻量反编译 | 中 | IDA/Ghidra |
| **r2jadx** | JADX Java 反编译集成 | 高 | jadx CLI |
| **r2apktool** | APK 反编译 | 高 | apktool CLI |
| **r2retdec** | RetDec 反编译 | 高 | IDA/Ghidra |
| **r2snow** | Snowman 反编译 | 中 | IDA/Ghidra |
| **decai** | LLM 驱动反编译（需 API key） | 中 | - |
| **ilspycmd** | .NET 反编译 | 中 | dnSpy |
| **pdq** | 快速 ESIL 反编译 | 低 | - |

### 安全分析类

| 插件 | 用途 | 手动安装难度 | 替代方案 |
|------|------|-------------|---------|
| **r2yara** | YARA 规则扫描 | 高（缺 MSVC .lib） | YARA CLI |
| **r2graph** | 递归函数调用图可视化 | 中 | IDA/Ghidra graph |
| **r2angr** | Angr 符号执行集成 | 高 | angr Python |
| **esilsolve** | Z3 符号执行（ESIL 层） | 中 | angr |
| **r2diaphora** | Diaphora 二进制 diffing | 中 | Diaphora CLI |
| **warrp** | Binary Ninja WARP 签名匹配 | 中 | - |
| **machoke** | CFG 模糊哈希，恶意软件分类 | 中 | - |

### 签名/解析类

| 插件 | 用途 | 手动安装难度 | 替代方案 |
|------|------|-------------|---------|
| **r2kaitai** | Kaitai Struct 签名 | 中 | - |
| **signapk** | APK 签名 | 低 | apksigner |
| **ldid2** | iOS 二进制签名 | 低 | - |
| **r2msdn** | annotate PE/COFF Windows 函数参数 | 中 | - |

### 其他

| 插件 | 用途 | 手动安装难度 | 替代方案 |
|------|------|-------------|---------|
| **r2wakare** | 执行 trace 记录/重放 | 中 | - |
| **gnuboy** | Game Boy 模拟器 | 低 | - |
| **modality** | 集成 angr 与 radare2 | 高 | - |

## 推荐安装顺序

### 1. 必装（立即）

```bash
# r2ghidra 已安装，无需额外操作
```

### 2. 推荐（按需）

```bash
# r2yara（YARA CLI 替代方案）
# 如果不需要在 r2 shell 内直接用 YARA，yara CLI 已足够
yara rules.yar target

# 如果必须在 r2 内用 YARA：
# 需要 Visual Studio Build Tools + r2 源码编译
# 或者使用 PyGhidra 替代
```

### 3. 可选

```bash
# r2dec（QuickJS 反编译）
# 需要从源码编译
cd /tmp && git clone --depth 1 https://github.com/radareorg/r2dec.git
cd r2dec && make && make install

# r2graph（调用图可视化）
# 需要从源码编译
```

## 关键坑

### r2ghidra 使用方式

```bash
# 必须 cd 到 radare2 目录
cd $SCOOP/apps/radare2/current

# 反编译当前函数
./bin/r2.exe -q -c 's main; af; pdg' target.exe

# 反编译指定地址
./bin/r2.exe -q -c 'af; pdg @ 0x401000' target.exe
```

### r2yara 编译受阻

r2 Windows 版只提供 `.lib`（MSVC 格式），MinGW gcc 无法链接。编译 `r2yara.dll` 需要：
- Visual Studio Build Tools + r2 源码
- 或从源码构建完整 r2（耗时）

**替代方案**：YARA CLI + r2 外部命令：
```bash
# 扫描单个文件
yara rules.yar target.bin

# 结合 r2
r2 -q -c '!yara rules.yar target.bin' target.bin
```

### scoop shim 是 PE 复制

scoop 的 `r2` shim 是 `r2.exe` 的 PE 副本，不是 bash 脚本。不要覆盖为 bash 脚本。

```
# 正确
scoop/shims/r2.exe target.exe

# 错误（会导致 "No such file or directory"）
echo '#!/bin/bash ...' > scoop/shims/r2
```

### r2pm 包大多不支持 Windows

```bash
# 典型报错
r2pm -i r2yara
# ERROR: This package does not have R2PM_INSTALL_WINDOWS instructions
```

遇到此类报错，放弃 r2pm，改用手动编译或替代工具。

## 替代工具矩阵

| 需求 | radare2 插件 | 替代方案 |
|------|-------------|---------|
| 伪代码反编译 | r2ghidra/r2dec | IDA Pro / Ghidra |
| YARA 扫描 | r2yara | YARA CLI |
| Java 反编译 | r2jadx | jadx CLI |
| APK 反编译 | r2apktool | apktool CLI |
| 符号执行 | r2angr/esilsolve | angr Python |
| 二进制 diffing | r2diaphora | Diaphora CLI |
| 调用图可视化 | r2graph | IDA/Ghidra graph |
| APK 签名 | signapk | apksigner |

> **建议**：安全分析以 IDA Pro + Ghidra 为主力，radare2 仅作为快速字符串搜索和粗略反汇编的补充。
