# radare2 + r2ghidra 安装与配置

> Windows 10 + Git Bash | 更新时间: 2026-07-17

## 安装 radare2

```bash
scoop install radare2
```

scoop 安装后只有 DLL，缺少 `radare2.exe` / `r2.exe` 可执行文件。需要从官方 release 补充：

```bash
# 下载官方 Windows release
curl -L -o $TMP/r2.zip "https://github.com/radareorg/radare2/releases/download/6.1.8/radare2-6.1.8-w64.zip"
cd /h/tmp && unzip -q r2.zip

# 复制可执行文件到 scoop apps 目录
R2_OFFICIAL="/h/tmp/radare2-6.1.8-w64/bin"
R2_SCOOP="$SCOOP/apps/radare2/current/bin"
cp "$R2_OFFICIAL/radare2.exe" "$R2_SCOOP/"
cp "$R2_OFFICIAL/r2.exe" "$R2_SCOOP/"
# 复制其他工具
for tool in r2pm rabin2 radiff2 rafind2 ragg2 rahash2 rarun2 rasign2 rasm2 ravc2 rax2 r2agent r2r; do
  cp "$R2_OFFICIAL/$tool.exe" "$R2_SCOOP/" 2>/dev/null
done
```

## 安装 r2ghidra

r2ghidra 是 radare2 的 Ghidra 反编译插件（`pdg` 命令）。

### 安装步骤

```bash
# 1. 下载预编译 Windows 插件
curl -L -o $TMP/r2ghidra-w64.zip "https://github.com/radareorg/r2ghidra/releases/download/6.1.8/r2ghidra-6.1.8-w64.zip"
cd /h/tmp && unzip -q r2ghidra-w64.zip -d r2ghidra_ex

# 2. 复制到 radare2 plugins 目录
cp r2ghidra_ex/*.dll $SCOOP/apps/radare2/current/lib/plugins/

# 3. 下载 sleigh 文件
curl -L -o $TMP/r2ghidra_sleigh.zip "https://github.com/radareorg/r2ghidra/releases/download/6.1.8/r2ghidra_sleigh-6.1.8.zip"
cd /h/tmp && unzip -q r2ghidra_sleigh.zip -d r2ghidra_sleigh_ex

# 4. 复制 sleigh 文件
mkdir -p $SCOOP/apps/radare2/current/lib/radare2/6.1.8/r2ghidra_sleigh
cp -r r2ghidra_sleigh_ex/r2ghidra_sleigh-6.1.8/* $SCOOP/apps/radare2/current/lib/radare2/6.1.8/r2ghidra_sleigh/
```

### 使用方式

```bash
# 必须 cd 到 radare2 目录（r2 查找 sleigh home 用相对路径 ./lib/radare2/...）
cd $SCOOP/apps/radare2/current

# 反编译当前函数
./bin/r2.exe -q -c 's main; af; pdg' target.exe

# 反编译指定地址
./bin/r2.exe -q -c 'af; pdg @ 0x401000' target.exe
```

### 关键坑

1. **必须 cd 到 radare2 目录**：r2 查找 sleigh home 用相对路径 `./lib/radare2/6.1.8/r2ghidra_sleigh`，不在当前目录会报 `Cannot find the sleigh home`
2. **scoop shim 是 PE 复制**：scoop 的 `r2` shim 是 `r2.exe` 的 PE 副本，不是 bash 脚本。不要覆盖为 bash 脚本。
3. **r2pm 很多包不支持 Windows**：报 `This package does not have R2PM_INSTALL_WINDOWS instructions`。r2ghidra 需要手动安装。

## 推荐插件

| 插件 | 用途 | 安装方式 |
|------|------|---------|
| **r2ghidra** | Ghidra 反编译 | 手动（见上方） |
| **r2yara** | YARA 规则扫描 | 手动编译（需 yara.h） |
| **r2graph** | 调用图可视化 | 手动编译 |
| **r2dec** | QuickJS 反编译 | 手动编译 |
| **r2jadx** | JADX Java 反编译 | 手动编译 |

> 大多数 r2pm 包没有 Windows 安装指令。安全分析建议用 IDA/Ghidra 替代。

## YARA CLI 安装

```bash
scoop install main/yara
# 提供 yara.exe + yarac.exe，但无 dev 头文件（yara.h）
```

需要 `yara.h` 编译 r2yara 时，从 VirusTotal/yara 源码获取：

```bash
git clone --depth 1 https://github.com/VirusTotal/yara.git
# yara.h 在 include/ 目录
# 编译 libyara.a 需要 VS 或 MinGW + libyara 源码
```

## 验证

```bash
cd $SCOOP/apps/radare2/current
./bin/r2.exe -v                    # 版本
./bin/r2.exe -q -c 'pdg' target    # r2ghidra 反编译
yara --version                     # YARA CLI
```
