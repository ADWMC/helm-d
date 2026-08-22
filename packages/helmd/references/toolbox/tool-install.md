# 工具安装指南

> 安全工具的下载、安装、验证。按需读取。

## 安装原则

1. **先查本机**: `where` / `Get-Command` / `--version` / `pip show`，有则直接用
2. **安装位置**: 除 C 盘外最大盘建 `X:\Reverse\`，不往 C 盘堆大文件
3. **下载走代理**: GitHub / PyPI 超时先挂代理（如 `http://127.0.0.1:7897`）
4. **记录版本**: 可用后记录版本号和路径

## Windows 安装 (scoop + pip)

### 1. Scoop 工具

```powershell
# 安装 scoop (如果没有)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression

# 添加 bucket
scoop bucket add extras
scoop bucket add java

# 安装基础工具
scoop install git adb mingw cmake

# 安装安全工具
scoop install apktool          # APK 解包/重打包
scoop install extras/jadx      # APK/DEX 反编译
scoop install radare2          # 命令行逆向框架
scoop install x64dbg           # Windows 调试器
```

### 2. Python 工具 (pip)

```powershell
# 基础工具
pip install frida frida-tools capstone keystone-engine lief

# 逆向工具
pip install pwntools pyelftools ropper ropgadget r2pipe

# 分析工具
pip install androguard         # APK 静态分析
pip install unicorn            # CPU 模拟
pip install angr               # 程序分析框架
pip install mitmproxy          # 代理抓包

# helmd 脚本依赖
pip install yara-python        # YARA 规则匹配
pip install pefile             # PE 文件解析
pip install lief               # 二进制分析库
```

### 3. GitHub Releases 下载（首选）

优先从 Releases 下载预编译二进制，省去编译步骤。

| 工具 | Releases 地址 | 下载方式 |
|------|--------------|---------|
| **garlic** | https://github.com/neocanable/garlic/releases | 选平台二进制（linux/macOS/windows） |
| **radare2** | https://github.com/radareorg/radare2/releases | 选 `radare2-*-w64.zip` 或 `r2-*-w64.zip` |
| **x64dbg** | https://github.com/x64dbg/x64dbg/releases | 选 `snapshot_*-win32.zip` |
| **VMPStaticUnpacker** | https://github.com/YuroGod/VMPStaticUnpacker/releases | 选 `VMPStaticUnpacker.exe` |
| **headless-ida** | https://github.com/DennyDai/headless-ida | `pip install headless-ida` |
| **rustFrida** | https://github.com/kkkbbb/rustFrida/releases | 选 ELF ARM64 → `adb push` 到设备 |
| **HashDump-BypassEDR** | https://github.com/AabyssZG/HashDump-BypassEDR/releases | 选 `BootKey.exe` + gcc 编译其他 |
| **WeakPassDetect** | https://github.com/Pick-program/WeakPassDetect/releases | 选平台二进制 |
| **pe-inspector** | https://github.com/la-1314/pe-inspector/releases | 选平台二进制 |
| **ip_checker** | https://github.com/test692618/ip_checker/releases | 选平台二进制 |
| **CipherBridge** | https://github.com/CuriousLearnerDev/CipherBridge/releases | 选平台二进制 |
| **x64dbg-mcp** | https://github.com/SetsunaYukiOvO/x64dbg-mcp/releases | 选 `dp32`/`dp64` → x64dbg plugins |
| **Ghidra** | https://github.com/NationalSecurityAgency/ghidra/releases | 选 `ghidra_*_PUBLIC.zip` |
| **unidbg** | https://github.com/zhkl0228/unidbg | Releases 或 `mvnw package` 构建 |

### 4. 需要编译的工具

| 工具 | 编译方式 |
|------|---------|
| **garlic** | `cmake -B build && cmake --build build` 或 `zig build --release=fast` |
| **unidbg** | `mvnw package`（需要 JDK 17+） |
| **fernflower** | `gradlew build`（需要 JDK 21+） |

### 5. pip 安装工具

```powershell
pip install frida frida-tools          # Frida
pip install headless-ida               # headless-ida
pip install androguard                 # androguard
pip install scrapling                  # Scrapling
pip install wechat-lm                  # WeChat-lm
pip install pwntools capstone lief     # 逆向基础库
```

## Linux/macOS 安装

### 1. 包管理器

```bash
# macOS (Homebrew)
brew install radare2 jadx apktool

# Ubuntu/Debian
sudo apt install radare2 adb

# Arch
sudo pacman -S radare2 android-tools
```

### 2. Python 工具

```bash
pip3 install frida frida-tools capstone keystone-engine lief
pip3 install pwntools pyelftools ropper ropgadget r2pipe
pip3 install androguard unicorn angr mitmproxy
```

## helmd 内置工具调用机制

helmd 的工具通过 `runSeam` 函数调用外部程序：

### 调用链

```
用户请求 → DSH 工具框架 → defineTool.execute() → runSeam() → 子进程
```

### runSeam 工作原理

```typescript
// src/seam.ts
export async function runSeam(ctx: Context, argv: string[], cwd: string): Promise<string> {
  // 1. 解析命令: subprocess seam → PATH → py launcher
  const program = await resolveCommand(ctx, argv[0])
  
  // 2. 优先使用 DSH subprocess seam
  const subprocess = ctx.get('subprocess')
  if (subprocess?.spawn) {
    const handle = subprocess.spawn({ argv, cwd, stdio: {...} })
    const outcome = await handle.done
    return handle.collected?.stdout?.readFrom(0)?.text ?? ''
  }
  
  // 3. 回退到 Node.js child_process
  const { stdout } = await execFileAsync(program, argv.slice(1), { cwd, timeout: 30000 })
  return stdout
}
```

### Python 命令解析

```typescript
// resolveCommand() 按以下顺序查找 Python:
// 1. DSH subprocess seam (如果存在)
// 2. PATH 中的 python / python3
// 3. Windows 的 py launcher
// 4. 最终回退到命令名本身
```

### 路径安全

```typescript
// assertWithinRoot() 确保路径在允许范围内
const abs = resolve(refRoot, args.path)
assertWithinRoot(abs, refRoot)  // 防止路径遍历攻击
```

## 工具验证

安装后必须验证：

```powershell
# 验证 Python 工具
python -c "import frida; print(frida.__version__)"
python -c "import capstone; print(capstone.__version__)"

# 验证命令行工具
radare2 -v
jadx --version
adb version

# 验证 helmd 工具
# 在 DSH 中调用:
detect_packer --file test.exe
scan_strings --path test.bin --min 4
```

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| `python` 找不到 | PATH 未配置 | 用 `py` launcher 或完整路径 |
| `pip install` 超时 | 网络问题 | 挂代理 `pip install --proxy http://127.0.0.1:7897` |
| `radare2` 分析超时 | 文件太大 | 用 `rafind2`/`rabin2` 做快速搜索 |
| `frida` attach 失败 | 反 Frida 检测 | 重命名 frida-server、FUSE/bind mount |
| `unidbg` 构建失败 | JDK 版本 | 用 JDK 17+，`JAVA_HOME` 指向正确路径 |
| `Ghidra` 找不到 Java | 路径格式 | Windows 用反斜杠 `E:\ghidra\...` |
| `headless-ida` 失败 | 许可证问题 | 用 `idalib.dll`，不用 `idat -A` |

## 工具版本记录模板

```markdown
| 工具 | 版本 | 路径 | 状态 |
|------|------|------|------|
| IDA Pro | 9.4 | E:/IDA Professional 9.4/ | 可用 |
| Ghidra | 12.1.2 | E:/ghidra/ghidra_12.1.2_PUBLIC/ | 可用 |
| radare2 | 6.1.8 | scoop/apps/radare2/current/ | 可用 |
| Frida | 16.x | pip | 可用 |
| jadx | 1.5.5 | scoop/apps/jadx/current/ | 可用 |
| ... | ... | ... | ... |
```
