# Android 云端下发 Native 二进制（Cloud-Native Binary）模式

## 识别特征

APK 本身是壳，真实逻辑在云端下发到 `data/data/<pkg>/files/cloud/` 下。

```
APK (5MB, 小 DEX, R8 混淆)
  └── 安装后自动下载到：
      data/data/<pkg>/files/cloud/Kernel    ← gzip 自解压 ELF (100MB+)
      data/data/<pkg>/files/cloud/Driver    ← gzip 自解压 ELF (50MB+)
```

## 快速识别方法

```bash
adb shell "ls -laR /data/data/<pkg>/files/" 2>&1 | grep -E "Kernel|Driver|cloud|sh."
adb shell "cat /data/data/<pkg>/files/cloud/shared_prefs/*.xml"
```

## 卸载还原管道

云端下发 → gzip 自解压 → ELF 写入 data/adb/ → root 执行

```
#!/system/bin/sh
tail $tail_n +$skip <"$0" | gzip -cd > "$gztmp"   # skip=48
(sleep 5; rm -fr "$gztmpdir") 2>/dev/null &
"$gztmp" ${1+"$@"}; res=$?
```

### ELF 解压与分析

```python
import gzip, io

with open("cloud/Kernel", "rb") as f:
    data = f.read()

pos = data.find(b'\x1f\x8b\x08')  # gzip 魔数，通常在 ~995 字节处
dec = gzip.GzipFile(fileobj=io.BytesIO(data[pos:]))
elf = dec.read()

with open("Kernel.decompressed.elf", "wb") as f:
    f.write(elf)

ei_class = elf[4]    # 2 = 64-bit
e_machine = int.from_bytes(elf[18:20], 'little')
# 0xB7 = ARM64
```

## 防御技术

### 1. syscall 直接调用（绕过 PLT/GOT）

云端 ELF 不经过 libc，直接用 ARM64 `svc` 0x0 指令：

```asm
mov x8, #__NR_mmap
mov x0, #0
mov x1, #size
mov x2, #prot
mov x3, #flags
mov x4, #-1
mov x5, #0
svc #0               ; 直接 syscall，libc mmap 不被调用
```

这意味着 Frida 的 Stalker/Interceptor 在 PLT/GOT 层拦截全部失效。

### 2. Magisk Hide + RootServerMain Hook

APK DEX 包含：
- `com.topjohnwu.superuser.internal.RootServerMain`
- `com.topjohnwu.superuser.internal.IRootServiceManager`

通过 Magisk 的 root IPC 通道获取 `IMountService`，实现 module path 隐藏、云端 ELF 文件不可见。

### 3. Binder IPC 注入 system_server

DEX 中的 IPCMain 通过 Binder 拦截 `ServiceManager.getService()`，注入 loader.so 到 system_server 进程（64 位 + 32 位兼容）。

## 动态分析注意事项

| Hook 目标 | 结果 |
|-----------|------|
| libc mmap/mprotect | 0 hit |
| libc open/read | 0 hit |
| Binder.transact() | 数据加密无可读字段 |

**结论：云端 ELF 不能用常规 Frida hook 分析**

## — 有效策略

```bash
# 用 strace 追踪 syscall
adb shell "strace -f -o /data/local/tmp/strace.log /data/adb/Kernel"
```

```python
# .rodata 中有明文字符串（无加密层）— 直接搜索
rodata_offset = ...  # 从 section header 读取
rodata_data = elf[rodata_offset:rodata_offset+rodata_size]
strings = re.findall(rb'[\x20-\x7e]{8,}', rodata_data)
for s in strings:
    if any(kw in s for kw in [b'proc/', b'maps', b'/data/', b'.so', b'frida']):
        print(s)
```

## 进一步分析路径

1. unidbg 模拟器重放 .text 节（不需要真机，可 hook 任意 ARM64 指令）
2. 控制流平坦化检测（OLLVM 特征）
3. 识别间接跳转表（ARM64 `adrp + add + br` 模式）
4. 砸章 .symtab / .strtab（去掉符号仍可分析）

## DFMTools 案例分析 (com.tongshuai.launcher.dfm2)

### 架构总览

```
APK (5.96MB)
├── classes.dex (4.8MB) — R8 混淆, Material3 UI, CloudUpdate 下载器
├── classes2.dex (5.4MB) — R8 混淆, MainActivity + Magisk RootServer IPC
├── classes3.dex (1.3MB) — R8 混淆, OkHttp 网络层 + HTTP/2 + TLS
└── assets/main.jar
    └── classes.dex (6.7KB) — IPCMain 入口, Binder 注入 system_server

云端下发 (data/data/com.tongshuai.launcher.dfm2/files/cloud/)
├── Kernel (24MB gz → 124MB ELF) — Unicorn CPU 模拟器 + OpenSSL + json
└── Driver (15MB gz → 83MB ELF) — Binder IPC 加密 + system_server 注入
```

### 关键类和方法

| 类 | 功能 |
|----|------|
| `com.tongshuai.launcher.dfm2.CloudUpdate` | 云端下载 Kernel/Driver |
| `com.tongshuai.launcher.dfm2.CloudUpdate$AppUpdateInfo` | 包含 `isLicensed` 字段 |
| `com.tongshuai.launcher.dfm2.CloudUpdate$ConfigInfo` | 配置信息 |
| `com.tongshuai.launcher.dfm2.util.RC4Util` | RC4 流量加密 |
| `com.tongshuai.launcher.dfm2.ipc.IRootIPC` | Magisk IPC 接口 |
| `com.tongshuai.launcher.dfm2.ipc.IRootService` | Root 服务接口 |
| `com.tongshuai.launcher.dfm2.ipc.ag/ah/ai` | IPC 辅助类 (R8 混淆) |

### SharedPrefs 结构

```xml
<!-- /data/data/com.tongshuai.launcher.dfm2/shared_prefs/dfm2_prefs.xml -->
<string name="key">1555</string>          <!-- 卡密标识 -->
<string name="driver">HOOK</string>       <!-- 驱动模式 -->
```

### 验证逻辑位置

**核心发现**: 卡密验证不在 Java 层，而在 Kernel.elf 的 Unicorn 模拟执行中。

- `.rodata` 中无明文字符串（无 license/key/card 等）
- 所有验证逻辑在 Unicorn CPU 模拟器内执行
- 通过 syscall 直调绕过 libc，Frida PLT/GOT hook 全部失效
- 仅 RC4Util (Java 层) 可见，用于加密网络流量

### 绕过策略 (7 层)

```javascript
// Layer 1: SharedPrefs 注入 — 覆盖本地缓存
// Layer 2: OkHttp 拦截器 — 伪造 auth/login/key/card/verify 响应
// Layer 3: CloudUpdate.hook — checkUpdates/checkRootThenProceed return
// Layer 4: MainActivity.hook — onCreate 后覆盖 prefs
// Layer 5: Binder.transact — 拦截 system_server IPC
// Layer 6: IPC 接口 hook — IRootIPC/IRootService/ag/ah/ai 返回 true
// Layer 7: RC4Util 日志 — 追踪加密流量
```

### 有效绕过路径

由于验证在 Unicorn 模拟层，Java 层 hook 可能无效。推荐:

1. **Frida Stalker** — 追踪 `svc` 指令，定位验证逻辑
2. **unidbg 模拟器** — 重放 Kernel.elf 的 .text 节，hook 任意 ARM64 指令
3. **内存 patch** — 运行时 dump 验证结果，定位 flag 地址

### 相关脚本

- `templates/frida-dfmtools-bypass.js` — 7 层 Java 绕过脚本
- `frida-license-bypass-android.md` — 通用 Android 卡密绕过
