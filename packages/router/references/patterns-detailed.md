# Detailed Patterns

## AES Key Capture at Runtime

## 模型/数据文件 AES 密钥运行时捕获

当目标 DLL 加载加密模型文件（`.aes`/`.enc`）时，密钥隐藏在混淆代码中无法静态提取，需运行时捕获。

**分步策略**：

1. **Install minimal hook**（只 hook AES_set_encrypt_key + EVP_CipherInit_ex）
2. **用户触发**：让程序执行加载操作（点按钮、开功能等）
3. **检查输出**：
   - 有输出 → 捕获成功，根据密钥长度和调用时机区分 license 通信 vs 模型解密
   - 无输出 → 换装全量 hook（所有 EVP_* 函数）
   - 仍无输出 → 目标使用自定义加密（ChaCha20/TEA/XTEA），需 dump 解密后内存
4. **DLL 可能被卸载**：loader 会按需加载/卸载 DLL。发现"DLL not found"时重新注入 loader，检查新 PID 后重装 hook

**关键坑**：
- Frida 脚本 TypeError 可能导致整个会话崩溃，连 DLL 都找不到。每个 hook 用 try/catch 包裹
- 全量 hook 脚本（hook 10+ 个函数）更容易因累积异常崩溃。优先用 minimal hook 验证目标可达
- VirtualAlloc 在 Windows Frida 17.x 中 size 参数是 `args[1]`（不是 args[2]）



## Anti-Frida DLL Patterns

## Anti-Frida DLL：完全无法 hook 时的应对

当 DLL 有强反调试，任何 Frida hook 都会导致进程反复崩溃（不是找不到 DLL，而是 hook 触发反调试机制）时，**立即停止 Frida 尝试**，切换为纯静态分析路径：

### 识别特征
- Frida attach 成功但进程很快消失/服务端口（如9090）停止监听
- 循环：开 loader → attach → DLL 崩溃 → 重开 loader → attach → DLL 崩溃
- 错误信息：`Failed to attach: unexpected error allocating memory`（VirtualAllocEx 被拦截）
- 全量 hook 脚本比 minimal hook 崩溃更快（TypeError 累积 + 反调试检测更多）
- DLL 在 loader 重新注入后可能短暂attach 成功，但任何 Interceptor.attach 都会触发崩溃

### 关键决策点
```
attach 成功
  → 进程消失? → 这是 anti-Frida，不是 hook 问题
  → 立即停止所有 Frida 尝试
  → 切换到 Win32 API 只读扫描或静态分析
  → 不要在同一个方向反复尝试不同 hook 变体
```

### 实战案例：网易云 future.exe loader

特征：64MB PE，.rsrc 节占 64.5MB，注入 cloudmusic.exe，内嵌 HTTP 服务器（9090端口）
- 任何 Frida attach 后，9090 停止监听 → DLL 崩溃
- 反调试在 DLL 加载时即生效，不是特定 hook 触发
- 只能静态分析 loader 资源节，无法运行时 hook

**详细绕过与替代方案**：`skill-native/references/anti-frida-workarounds.md`

### 应对策略：Python Win32 API 替代 Frida

```python
import ctypes, ctypes.wintypes, struct

k32 = ctypes.windll.kernel32

# 只读访问，不触发反调试
hProcess = k32.OpenProcess(
    0x0400 | 0x0010,  # PROCESS_QUERY_INFORMATION | PROCESS_VM_READ
    False, pid
)

class MEMORY_BASIC_INFORMATION(ctypes.Structure):
    _fields_ = [
        ('BaseAddress', ctypes.c_ulonglong),
        ('AllocationBase', ctypes.c_ulonglong),
        ('AllocationProtect', ctypes.c_ulong),
        ('RegionSize', ctypes.c_ulonglong),
        ('State', ctypes.c_ulong),
        ('Protect', ctypes.c_ulong),
        ('Type', ctypes.c_ulong),
    ]

mbi = MEMORY_BASIC_INFORMATION()
address = 0
while k32.VirtualQueryEx(hProcess, ctypes.c_ulonglong(address),
                          ctypes.byref(mbi), ctypes.sizeof(mbi)):
    if mbi.State == 0x1000 and mbi.RegionSize > 10_000_000:
        buf = (ctypes.c_byte * 16)()
        br = ctypes.c_size_t(0)
        k32.ReadProcessMemory(hProcess, ctypes.c_ulonglong(mbi.BaseAddress),
                              buf, 16, ctypes.byref(br))
        if buf[0] == 0x08 and buf[1] == 0x00:  # ONNX/protobuf 签名
            print(f"ONNX at 0x{mbi.BaseAddress:x}, size={mbi.RegionSize}")
    address = mbi.BaseAddress + mbi.RegionSize
k32.CloseHandle(hProcess)
```

### 静态资源提取作为主要手段

当 Frida 完全不可用时，从 loader 的 .rsrc 节提取加密 payload 是唯一路径：

1. 解析 PE 节表 → 定位 .rsrc
2. 解析资源目录三级结构 → 找 RCDATA 类型
3. 提取每个资源数据的 (RVA, Size, 前16字节)
4. 根据熵值/头字节判断类型：
   - 熵 > 7.9 → 强加密（需运行时密钥或自定义算法）
   - 熵 7.0-7.9 → 可能压缩或有弱加密
   - 包含 ASCII 字符串 → 配置/元数据

**注意**：Loader 可能包含多个大资源块（如 22MB DLL + 43MB 模型/配置），需逐一提取后尝试解密。

#### 关键坑汇总

- **不要 patch `je→jne`**：成功路径需要有效数据，会死锁。正确做法 patch 标志位
- **运行时标志 ≠ dump 值**：dump 是验证后的值，重启后为 0。必须运行时 patch
- **页面路由和 API 路由独立**：NOP 页面路由不影响 API，需同时 patch 标志位
- **Frida 17.x**：`findExportByName` 报 TypeError，用 `enumerateExports()`

### 参考

完整案例：`docs/gh-loader-re-full.md`（仓库 gh-aimbot-analysis）
可复用模板：`references/pe-loader-dll-injection.md`

---



## Shell Dropper Analysis

## Shell 脚本恶意软件分析 (自解压 Dropper)

当拿到可疑 shell 脚本（.sh）时，先判断是否为自解压投放器：

```
识别特征:
  - 文件异常大 (>100KB)
  - 头部有注释声称"加密"/"混淆"/"自解压"
  - 包含 `sed -n "$((LINENO+1)),$ p" < "$0"` 等自引用提取命令
  - 包含 `gzip -c -d` / `xz -d` / `base64 -d` 解码管道
  - 包含 `chmod 123` (防读取) 或 `chmod 777`
  - 包含 `rm -f` 自删除 + `exit 127` 掩盖退出码

分析流程:
  1. 识别层数 — `file` + `xxd | head` 查看 gzip magic (1f 8b)
  2. 逐层解嵌套 (Python 循环 gzip.decompress):
     - 搜索 'exit 127;' 或类似 marker 分割 shell 代码与 payload
     - 每次解压后检查前 4 字节是否仍为 gzip magic
     - 循环直到非 gzip 或找到 ELF/PE 签名
  3. `file final_payload` 确认最终格式
  4. 按最终格式走对应分析流程

关键坑:
  - 每层 gzip 解压后可能是 shell+gzip 结构，需循环直到非 gzip
  - 首次 gzip 解压的结果可能是 shell 代码本身（自引用），不是最终 payload
  - `exit 127` 是常用的掩盖退出码，实际 payload 已成功执行
  - `chmod 123` (--x-wx-wx) 防止安全研究人员读取已落盘的 payload
  - gzip 流之间可能有非 gzip 填充数据，需精确分割
  - **循环终止条件**: 解压后前 4 字节为 `\x7fELF` (ELF) 或 `MZ` (PE) 即为最终 payload
  - **marker 分割**: 搜索 `exit 127;` 或 `exit 127;\n` 分割 shell 代码与 gzip 数据
  - **NBG 案例**: 3层嵌套，每层都夹带 shell dropper 副本，最终 payload 在第3层
```

→ 参考 `references/android-shellcode-anti-analysis.md`



## Jiagu (360) APK Detection

## 360 Jiagu APK 加固识别

当 jadx 反编译出 <50 个类，且看到 `com.stub.StubApp` + `assets/libjiagu.so` + `assets/libjgdtc.so` 时，APK 使用 360 Jiagu 加固。

关键特征：
- `com.tianyu.util.DtcLoader` 加载 `libjgdtc.so` DTC 组件
- `com.tianyu.util.C0037a` 是字符串解混淆类（XOR-based，常见 key=16）
- `libsa.so` 做签名校验（JNI_OnLoad + KeyFactory + Cipher + PackageInfo）
- `libturingau.so` 是图灵反篡改 SDK

核心代码全部加密，jadx 只能看到 jiagu stub + 广告 SDK。**必须用 Frida 动态 dump 解密后的 DEX**。

字符串解混淆：已知明文攻击找 XOR key（常见 key: 16, 8, 32, 0x5a）。例：`"q~tb\177yt>q``>QsdyfydiDxbuqt"` XOR 16 = `"android.app.ActivityThread"`。

详见 `reverse-engineering-android-malware-with-jadx` skill 的 `references/jiagu-apk-analysis.md`。



## Android ARM64 RWX Shellcode

## Android ARM64 RWX Shellcode 分析

当拿到 Android ARM64 ELF 且 entry point 落在 RWX LOAD segment 时:

```
识别: readelf -h → entry point 在 RWX 段地址范围内

分析流程:
  1. Capstone 反汇编 RWX 入口点 (不要 hook libc — shellcode 用 svc 直调)
  2. 识别系统调用号 (mov x8, #N; svc #0):
     0x38=openat, 0x3f=read, 0x40=writev, 0x39=close, 0x3f=read
     0xdc=clone, 0xde=mmap, 0xe2=mprotect, 0xe9=membarrier
     0xa7=prctl, 0x75=getpid, 0x71=rt_sigprocmask
     0x5d=exit, 0x5e=exit_group, 0x4e=getdents64, 0x65=nanosleep
  3. 提取 XOR 加密字符串:
     找 eor w3, w3, #KEY 指令 → 提取密钥 → 全段扫描解密
  4. 识别反分析模式:
     /proc/self/maps + "frida"/"gum"/"gadget" → Anti-Frida
     /proc/self/status + "TracerPid" → Anti-ptrace
     /proc/self/smaps + "frida" → Anti-Frida (第二层)
     /proc/self/fd/ + "frida" → Anti-Frida (fd扫描)
     /proc/net/unix → Frida unix socket 检测
     /proc/cpuinfo → 模拟器检测
     /proc/uptime → 模拟器检测
     prctl(PR_SET_NAME, "kworker/...") → 进程伪装
  5. 绕过反调试:
     patch 检测分支 (b.eq → NOP 或 b)，然后用 Frida 正常 hook

关键坑:
  - entry point 在 RWX 段 = shellcode，不要尝试 hook libc 函数
  - Frida hook 全部 0 输出 → 检查 svc #0 直接系统调用
  - XOR 密钥从反汇编中提取 (mov w5, #0xd5; eor w3, w3, w5)
  - dlopen/dlsym 动态加载的库不会出现在 DT_NEEDED 中
  - 设备上缺少目标库 (libil2cpp/libunity) 时 shellcode 静默退出
  - **完整性校验阻止 patch**: shellcode 可能在返回前计算自身 hash (mul/eor/ror/madd chain)
    → 需要运行时 patch (Frida Memory.patchCode) 而非持久化修改文件
  - **exit 函数用直接 syscall**: `mov x8, #0x5d; svc #0` (exit) 和 `mov x8, #0x5e; svc #0` (exit_group)
    → hook libc exit/exit_group 无效。需 patch shellcode 内的 svc 指令为 NOP
  - **exit 函数用 `b` 跳转 (非 `bl`)**: 无保存 LR，patch exit 为 ret 会导致无限循环
    → 不要 patch exit 函数本身，改为 patch 导致 exit 的条件判断
  - **NOP 所有条件分支会跳过解密逻辑**: 反分析检测和 payload 解密在同一执行路径中交织
    → 只 patch 导致 exit 的条件分支，保留正常 fall-through 路径
  - **篡改 /proc 路径字符串 → fail-closed**: openat 失败 → shellcode 视为异常环境 → exit
    → 不要篡改路径。用 ptrace 拦截 openat 返回 /dev/null 的 fd
```

### 完整性校验绕过

当 shellcode 在返回前计算自身 hash 时：

```
识别: 找 cmp w16, w17 后紧跟 b.eq #register_restore / mov w10, #errcode; b #exit
特征: hash 计算涉及 mul + eor + ror + madd 链，输入是运行时状态变量

绕过方案:
  1. 运行时 patch: Frida Memory.patchCode 将 b.eq 改为无条件 b
     → 不能持久化修改文件（会改变 hash）
  2. 保持文件不变 + Frida spawn + 运行时 patch integrity check + 检测分支
     → 需要在 shellcode 执行前完成所有 patch
```

### 反分析检测链模式

典型 Android 恶意 shellcode 的多层检测：

```
Layer 1: /proc/self/maps 扫描 → "frida"/"gum"/"gadget"
Layer 2: /proc/self/smaps 扫描 → 同上
Layer 3: /proc/self/status → "TracerPid" 非零
Layer 4: /proc/self/fd/ → 文件描述符扫描
Layer 5: /proc/net/unix → Frida unix socket
Layer 6: /proc/cpuinfo → 模拟器特征
Layer 7: 字符比较 → 逐字符匹配 (不是 strstr)

每层有独立的 exit 路径，全部汇聚到全局 exit 函数。
exit 函数: 输出 "NBG_EXIT:XX" → exit_group(0)

绕过策略优先级:
  1. 运行时 patch 所有条件分支 (Frida Memory.patchCode)
  2. patch 比较指令的立即数 (cmp w5, #0x66 → cmp w5, #0x00)
  3. patch 全局 exit 函数的 svc 指令为 NOP
  4. 最后手段: ptrace 拦截 exit syscall
```

### 自定义流密码解密算法

部分 Android shellcode 使用自定义流密码解密 payload：

```
算法特征:
  - 24 字节分块，逐字节 XOR 派生密钥
  - 密钥派生: mul + eor + ror + madd + 恒等变换 (xorshift)
  - 静态密钥存储在 RWX 段内 (固定地址)
  - 运行时状态变量 (w10, w11, w20, w21, w26) 从栈中加载
  - 状态变量在反分析阶段动态计算，无法静态还原

解密难点:
  - 输入参数是运行时栈值 → 纯静态分析无法解密
  - 需要 dump 运行时状态才能还原密钥
  - 或者 hook 解密函数入口获取参数

变种:
  - XOR 0xd5 单字节 (简单字符串加密)
  - XOR-24 有状态变换 (每字节变换全部密钥)
  - mul+eor+ror+madd 复杂流密码 (本文案例)
```

→ 参考 skill-android/references/android-shellcode-anti-analysis.md



## Android ARM64 ELF Quick ID

## Android ARM64 ELF 快速识别

拿到 ARM64 ELF 后的快速判断流程：

```
1. 解释器检查
   readelf -p .interp target
   /system/bin/linker64 → Android
   /lib/ld-linux-aarch64.so.1 → Linux desktop

2. 链接库分类 (readelf -d / DT_NEEDED)
   libunity.so + libil2cpp.so → Unity 游戏 (外挂/mod/作弊器)
   libgui.so + libutils.so → Android GUI 应用
   libart.so + libdexfile.so → Dalvik/ART (Java 层交互)
   libcurl.so / libssl.so → 网络通信

3. RWX 段检查 (Read-Write-Execute LOAD segment)
   熵 > 7.9 → 加密 shellcode (运行时解密执行)
   熵 7.0-7.9 → 可能是 packed code
   熵 < 7.0 → 正常代码/数据

4. 常见恶意模式 (strings 搜索)
   settings get secure android_id → 设备指纹
   /proc/self/mem + ptrace → 反调试/内存注入
   prctl(PR_SET_NAME, "kworker/...") → 进程伪装
   inotify + /data/data/ → 目录监控 (窃取文件)

5. Unity 游戏外挂特征
   - 链接 libil2cpp.so + libunity.so
   - RWX 段包含加密的游戏偏移/函数地址
   - 通常需要 root (ptrace/mmap 注入)
```

→ 参考 skill-android/references/android-elf-malware-analysis.md



## Zygisk Module License Analysis

## Zygisk 模块 License 分析

```
拿到 Zygisk 模块 ZIP 后:
  1. 解压，检查 zygisk/*.so + webroot/js/
  2. strings *.so | grep -iE 'lic_check|license|CPGL|copg'
  3. 找到 companion entry 导出符号 → 反汇编
  4. 搜索 license 文件路径字符串 → 追踪 ADRP+ADD 引用
  5. 追踪: 文件读取 → CPGL magic 校验 → SHA-256 → MAC → flag 存储
  6. 找所有 LDRB [context, #0x1C] + CMP #1 + B.NE → 全部 NOP
  → 参考 zygisk-module-license-bypass.md
```



## Android Root Module Analysis

## Android Root 模块分析（Magisk / KernelSU / APatch）

```
拿到模块 ZIP/仓库后:
  1. 检查 module.prop → id / name / versionCode / updateJson
  2. 检查 customize.sh → root 管理器检测 + 冲突清除逻辑
  3. 检查 service.sh → 模块隐藏 + daemon 启动 + 键箱获取
  4. 检查 post-fs-data.sh → 早期启动行为 + 自删机制
  5. 检查 bin/ → ELF 二进制（Rust/Go/C），用 readelf/file 识别
  6. 检查 prop.sh → 属性伪装列表
  7. 检查 *.rs/*.toml → daemon 配置和任务调度

现代模块特征:
  - Rust daemon 替代 shell（epoll + inotify + 任务调度）
  - 进程伪装为 kworker/0:2（prctl + /proc/self/mem）
  - 点前缀目录隐藏 + 删除 module.prop
  - 远程键箱获取 + 证书链验证 + 吊销检查
  - 安全补丁日期自动同步 Google Pixel 公告
  - 健康监控 + 熔断器 + 指数退避重启

→ 参考 android-root-module-analysis.md
```



## /proc/self/maps Memory Scan

## /proc/self/maps 内存完整性扫描（轻量级）

当二进制包含 `/proc/self/maps` + ` r-xp ` + `%lx-%lx` 字符串组合时，存在内存区域扫描函数。

**典型模式**：
```c
FILE *fp = fopen("/proc/self/maps", "r");
while (fgets(line, sizeof(line), fp)) {
    if (!strstr(line, " r-xp ")) continue;     // 过滤可执行段
    if (!strchr(line, '/')) continue;           // 必须有路径
    sscanf(line, "%lx-%lx", &start, &end);     // 解析地址范围
    if (start <= TARGET && end > TARGET) {
        strcpy(output, strchr(line, '/'));      // 提取库路径
    }
}
```

**用途**：检测目标地址对应的加载库，用于反注入/反调试（但强度弱于完整反分析链）。

**搜索方法**：
```python
# 搜索 /proc/self/maps + r-xp 组合
python -c "
with open('target.so', 'rb') as f:
    data = f.read()
if b'/proc/self/maps' in data and b' r-xp ' in data:
    print('Memory map scanning detected')
    idx = data.find(b'/proc/self/maps')
    print(f'  String at {idx:#x}')
"
```

**与完整反分析链的区别**：
- 轻量级：仅扫描 maps 提取路径，无关键字过滤（不搜 frida/gum/gadget）
- 完整版：扫描 maps + smaps + status + fd/ + net/unix，逐层检测并 exit

→ 参考 `skill-native/references/apk-signature-verification.md`（腾讯 GCloud SDK 案例）



## Common Pitfalls


| 问题 | 原因 | 解决 |
|------|------|------|
| DLL 加载后 Frida 报"DLL not found" | loader 有反注入机制，会卸载 DLL 再重装 | 重新注入 loader，检查新 PID，重装 hook |
| 全量 Frida hook 脚本崩溃 | 一个 hook 失败导致整个脚本异常 | 每个 Interceptor.attach 用 try/catch 包裹 |
| 点击功能按钮后 hook 0 输出 | 解密在 DLL 初始化时已完成，不是按钮触发的 | 更早 hook（在 DLL 加载时），或 dump 解密后的内存 |
| VirtualAlloc size 读取错误 | Frida 17.x Windows 参数索引不同 | args[1] 是 size（不是 args[2]） |
| AES 密钥捕获成功但模型仍无法解密 | 密钥在 DLL 内部被变换过（XOR 混淆） | 追踪密钥使用前后的变换函数 |
| PE Loader patch `je→jne` 导致死锁 | 成功路径需要验证函数返回的有效数据 | 改 patch 标志位或 NOP 条件跳转 |
| Hook BCrypt 无输出 | DLL 用 OpenSSL (`libcrypto`) 而非 BCrypt | 检查 `libcrypto-1_1-x64.dll` 是否加载，hook `AES_set_encrypt_key` / `EVP_CipherInit_ex` |
| 抓到 AES-128 密钥但模型解不开 | **抓到的密钥是 license 通信用的，不是模型解密密钥。同一 DLL 可能有多组独立密钥** | 模型文件用 AES-256 + 独立密钥（嵌入混淆代码）。需 hook `EVP_CipherInit_ex` 的 key/iv 参数，在模型加载时捕获。**关键**：先用 minimal hook 验证目标 API 可达，再扩展。如果 EVP hook 全部 0 输出，说明加解密不走 OpenSSL，需排查自定义实现 |
| **Frida attach 后进程反复崩溃/端口消失** | **DLL 有强反调试/反 Frida 机制，任何 hook 都触发** | **立即停止 Frida，切换 Win32 API 只读扫描**（见 `anti-frida-workarounds.md`） |
| 所有 socket API hook 无反应但 curl 收到响应 | DLL 用直接系统调用绕过 ntdll/ws2_32 | 放弃 API hook，用 `Memory.patchCode` 直接改数据段中的响应模板和 license flag |
| `Memory.patchCode` patch 后 curl 超时 | patch 破坏了 HTTP 服务器内部状态 | 多次累积 patch 会破坏状态。重启进程后一次性应用所有 patch |
| 运行时 license 标志为 0 | dump 是验证后的值，重启后重置 | 必须在运行时用 Frida patch |
| 页面路由 bypass 后 API 返回 Forbidden | 页面路由和 API 路由有独立的 license 检查 | 同时 patch 两处标志位 |
| Frida 17.x `Module.findExportByName` / `Module.getExportByName` 报 TypeError | Frida 17.x **Windows + Android** API 均已变更 | `Process.findModuleByName('libc.so').enumerateExports()` 遍历找目标函数，用 `address` 属性做 Interceptor.attach。**不可用** `findExportByName`/`getExportByName`，这两个在 17.x Android 上同样报错 |
| Frida 17.x `Memory.readByteArray(addr, len)` 报 TypeError | Frida 17.x API 变更，`Memory.*` 全局方法废弃 | 用 `addr.readByteArray(len)` (地址对象方法)，不用 `Memory.readByteArray()` 全局函数。同理 `Memory.readUtf8String()` → `addr.readUtf8String()` |
|| 内存 dump 转 PE 后 r2/IDA 无法加载 | 节表 RawOffset/RawSize 为 0（打包态） | 修正: RawSize=VirtSize, RawOffset=RVA |
| PyInstaller 应用无输出 | 需要 GUI display | 用 `cmd.exe /c start` 启动 |

| 终端输出密码/密钥显示 `***` | **Hermes 自动脱敏敏感数据**（密码、token、API key 等）| 用 `curl -o /tmp/raw.json` 保存原始响应，再用 `read_file` 读取。或用 Python `requests` 写文件后读取。**不要依赖终端输出判断是否拿到敏感数据。** 这是最常见的误判来源——明明拿到了密码，却以为服务端做了脱敏。 |
| 多个 API 请求同时发出后全部超时/429 | 并行请求触发目标限频/WAF | **安全测试必须顺序执行**，一个请求完成后再发下一个。不要用 `&` 并行 curl。 |
| 大量端点返回 404 但目标明显存在 | WAF 拦截或端点名错误 | 区分真 404（nginx 默认页面）和 WAF 404（自定义内容）。先确认已知端点能访问，再批量枚举。 |
| Session Fixation 测试误判 | 服务器接受任意 session ID 但不绑定认证状态 | 需要完整验证：设置固定 session → 登录 → 用同一 session 访问受保护页面，确认能否劫持已认证会话。 |
| 测试命令注入时本地 shell 展开了 payload | bash 展开了 `$(cmd)` 和反引号 | 用单引号包裹 JSON payload，或用 Python `requests` 发送避免 shell 展开。例：`'{"friend_code": "$(id)"}'` |
| Windows 无 `strings` 命令 | git-bash/MSYS 默认不带 binutils | 用 Python `re.findall(rb'[\x20-\x7e]{4,}', data)` 替代 |
| `patch后Segfault` | 寄存器假设错误 | 追踪完整生命周期 |
| Frida attach失败 | SELinux/权限问题 | root + setenforce 0 |
| jadx反编译失败 | 混淆/加壳 | 先脱壳再反编译 |
| jadx/apktool 报 "系统找不到指定的路径" 或无输出 | Java 未安装（scoop shim 调 .bat 失败静默） | `java -version` 验证；无 Java 时用 androguard 做 APK 静态分析（见下方 fallback） |
| 无 Java 环境无法使用 jadx/apktool | Windows 机器未装 JDK | **androguard fallback**：`pip install androguard` → `from androguard.misc import AnalyzeAPK` (androguard 3.3.5+) 获取包名/权限/组件/签名；`from androguard.core.dex import DEX` 加载 DEX 做类/方法枚举；DEX 字符串用 `re.finditer(rb'[\x20-\x7e]{6,}', dex_data)` 提取。**注意**：`from androguard.core.apk import APK` 在 3.3.5 中已失效，必须用 `from androguard.misc import AnalyzeAPK` |
| upx -d 失败 "not packed by UPX" | TUSI 定制 UPX (UPX_BySpra) | 不是标准 UPX，用 Frida 动态脱壳 |
| NRV2B 解压输出无效 | TUSI 修改了 NRV2B 算法 | 放弃静态解压，转 Frida |
| strings 无关键字符串 | 保护器加密了所有字符串 | 只在 trailer 区有元数据，核心逻辑在压缩数据内 |
| /dev/shm mmap 后代码跳转异常 | TUSI 运行时解壳特征 | 用 Frida hook write/mmap dump 解压后的 ELF |
| Windows .sys 驱动需逆向但无 IDA | IDA 不可用或无法加载 | 用 Python + Capstone 反汇编 PE，追踪 XREF 和 API 调用链 |
| 驱动加密数据无法解密 | 密钥不是直接存储，而是通过 KDF 派生 | 追踪 BCrypt/CryptoAPI 调用链，找到 HashData 的输入 |
| VMP 模式下 Unicorn 执行崩溃 | 未映射内存区域或未处理的 ARM64 指令 | 确保 stack/heap/code 区域全部 mem_map，未知指令用 NATIVE 回退 |
| Frida hook 对 VMP PE 全部 0 行日志 | VMP 直接系统调用绕过所有 Windows API hook | **立即停止 hook 尝试**，转 Nt* 导出 hook（enumerateExports + Interceptor.attach），见 `vmp-pe-frida-windows.md` |
| `frida.attach()` 后 VMP 进程消失 | VMP 反调试检测 | 必须用 `frida.spawn()`，不能 attach 已运行进程 |
| **Jiagu (360加固) app `Java` is not defined** | jiagu hook JNI 环境，Frida 无法获取 Java VM | 不用 Java.perform，用纯 Native：`Process.enumerateModules()` 找 base.odex → 按地址/大小 dump。见 `skill-android/references/android-unpacking.md` |
| **Frida `device.spawn()` 超时 (jiagu app)** | jiagu 解包过程慢，Frida 等待 app launch 超时 | 用 `adb shell am start` 启动 app → 等 6s → `device.attach(pid)` |
| **`Process.enumerateRanges` 脚本加载超时 (jiagu)** | jiagu 映射 300+ 内存区域，全量枚举导致 create_script 超时 | 先用 `Process.enumerateModules()` 定位 base.odex，按已知地址/大小定向 dump |
| **第三方注入工具 attach 超时 (jiagu app)** | 第三方 server 不完全兼容 frida attach 协议 | 推官方 frida-server 到设备替代 |
| **云机端口每次重启变化** | 云手机 VM 分配随机端口 | 每次分析前 `adb connect` + `adb devices` 确认，不要依赖历史端口 |
| 进程 7 秒后退出码 33 | Windows Defender 拦截隔离 | 分析前加 Defender 排除（GUI/注册表），见 `vmp-pe-frida-windows.md` |
| DLL 内嵌 HTTP 服务器 hook 全部 0 行日志 | DLL 用直接系统调用绕过 ntdll/ws2_32 | 放弃 API hook，改用 Memory.patchCode 直接改数据段 |
| Patch 条件跳转后服务器超时死锁 | 成功路径需要 verify 函数填充的数据（如 expires_at） | 先 dump 内存分析完整成功路径，一次性 patch 所有检查点 |
| packed DLL (section RSize=0) 无法静态分析 | 代码/数据节在磁盘为空，运行时才解包 | 用 Frida 从运行进程内存 dump，再分析 dump 文件 |
| **License flag 运行时值 ≠ dump 值** | **新进程重新初始化 flag，dump 中的值是旧 session 残留** | **必须用 Frida `flagAddr.readU8()` 验证运行时实际值，不依赖 dump** |
| **仅 patch 响应模板 {"ok":false→true 不够** | **服务器内部 license 状态仍为 invalid，页面路由/API 仍被拦** | **必须同时 patch license flag + 页面路由 + 响应模板，3 个 patch 缺一不可** |
| **仅 NOP 页面路由 je 不够** | **JS fetch('/api/config') 返回 Forbidden，页面显示连接失败** | **页面路由 NOP + license flag 设 1 + 响应模板 patch，三管齐下** |
| **patch 验证函数返回值导致死锁** | **成功路径需要 verify 函数填充的数据（如 expires_at），未执行则访问未初始化数据** | **不 patch 验证函数返回值，而是 patch license flag + 路由 + 响应模板** |
| **HTTP 服务器所有 socket API hook 无反应** | **DLL 用直接系统调用绕过 ntdll/ws2_32** | **放弃 API hook，用 Memory.patchCode 直接改数据段中的响应模板和 license flag** |

**Frida 17.x Android API 兼容** 见 `skill-native/references/frida-17x-android-compatible.md`
| **PyInstaller .exe 启动后无输出** | **需要 GUI 显示，background terminal 无 display** | **用 `cmd.exe /c start` 或让用户手动启动** |
| Frida EVP hook 装好后等"加载模型"但 0 输出 | **解密在 DLL 初始化时已完成，或走的是自定义加密而非 OpenSSL** | **先用 minimal hook 验证目标可达，2 步内确认是否有输出。如果 0 输出立即转自定义加密检测（搜索 ChaCha20/TEA 常量），不死等** |
| 全量 hook 脚本导致 Frida 会话崩溃 | **一个 hook 的 TypeError 累积导致整个脚本失败** | **每个 Interceptor.attach 用 try/catch 包裹；优先用 minimal hook 验证，确认可达后再扩展** |
| DLL 被卸载后 Frida 报"DLL not found" | **loader 按需加载/卸载 DLL，旧 session 找不到了** | **重新注入 loader → 确认新 PID →  hooks 重新安装** |
| hook 太多导致 GUI 不出现 | TypeError 累积导致进程异常 | 只 hook 必需函数（反调试+分析目标），不超过 10 个 |
| Qt6 程序不响应 SendInput/WmChar/keybd_event | Qt6 自绘控件不使用 Win32 消息机制 | 用 `pywinauto` UIA backend：`Desktop(backend='uia').window(title=X).child_window(auto_id=Y)` |
| netstat 看到大量 TIME_WAIT | 历史连接残留 | 只看 ESTABLISHED/SYN_SENT 判断当前活跃连接 |
| Frida 内存扫描 0 结果 | VMP 未解包完成 | `setTimeout(fn, 8000)` 等待解包后再扫描 |
| **Anti-Frida DLL：attach 成功但进程反复崩溃** | **DLL 有强反调试，任何 hook 都触发** | **2-3次失败后立即停止 Frida，切换 Win32 API 只读扫描 + 静态资源提取** |
| **Frida EVP hook 抓到的 AES-128 密钥解不开模型** | **密钥是 license 通信用的，模型解密用独立 AES-256 密钥嵌入混淆代码** | **区分用途：license=128-bit，model=256-bit。静态分析 DLL 找真正模型密钥** |
| **XOR 已知 plaintext 攻击后 entropy 仍 >7.8** | **期望 plaintext 不对，或加密不是简单 XOR** | **不要用已知 plaintext 方法，转向静态分析 loader 解密算法或运行时 dump 内存** |
| 模型文件（`.aes`）静态无法解密 | 密钥隐藏在混淆代码或运行时派生 | 运行时 Frida hook `EVP_CipherInit_ex` 捕获 key/iv，或等加载完成后 dump 内存搜索 ONNX 签名 |
| 所有 socket API hook 都无反应但 curl 能收到响应 | DLL 使用直接系统调用绕过 ntdll/ws2_32 | 用 `Memory.patchCode` 直接修改内存中的响应模板，见 `memory-patchcode-bypass.md` |
| PyInstaller 打包的 .exe 分析 | 叠加数据在 PE 末尾，标准工具无法解析 | 搜索 `MEI\x0c\x0b\x0a\x0b\x0e` magic，用 `pyinstxtractor` 或手动解析 TOC |
| 终端输出显示 `***` 脱敏但实际API返回明文 | AI工具对敏感数据自动脱敏 | 用 `curl -o file` 保存原始响应，再用 `read_file` 查看 |
| "别开代理"指令误解为网络代理 | 用户用"代理"指代AI API请求 | "别开代理" = 不要并发发多个API请求，会限速。一次一个请求 |
| 在被阻塞攻击路径上反复尝试 | 不愿放弃已投入的方向 | 2-3次失败后立即转向。用户说"别死磕"= 立即停止 |
| 用子代理做安全分析任务 | delegate_task 并发调用 AI API | **禁止**。用户要求"别用子代理 ai api会限速"。安全分析在主线程顺序执行，不用 delegate_task。 |
| 并发发多个API请求导致429限速 | 习惯性批量发起请求 | Web安全探测严格顺序执行，每次等响应后再发下一个 |
| **delegate_task 子任务未回传结果** | **subagent 被 429 限流或超时** | **主线程完成关键路径，subagent 只用于独立可丢弃的并行工作** |
| XOR 解密后数据不是 PE/ELF | 密钥不是简单重复 XOR，而是有状态变换（每字节变换密钥）。**或捕获到的密钥是变换后状态，非初始值** | 检查解密函数是否有双层循环（外层数据、内层密钥变换）。见 `pe-payload-extraction.md` 模式 2。**Frida hook 抓到的密钥可能已被变换——需从 loader .rdata 静态提取初始值，或尝试计算逆变换** |
| PE .rsrc 段 >5MB 但 strings 无结果 | 嵌入式 payload 是加密的 | 解析资源目录找 RCDATA，提取后解密。见 `pe-payload-extraction.md` |
| patch 替换 class 定义时误删相邻类 | patch 工具匹配 `class X:` 后可能吞掉后续内容 | 插入新 class 时用 execute_code + write_file 精确控制 |
| git commit 含 Unicode 字符失败 | git bash 对特殊字符处理异常 | commit message 用纯 ASCII，中文可，避免数学符号 |
| VMProtect 加壳 PE 静态分析无结果 | `.winlice` + `.boot` 节 = VMP 全加密，字符串/代码/URL 全不可见 | **立即识别并停止静态分析**，转动态方案（见下方 VMP 快速决策） |
| MSYS/git-bash 下 `python3` 报错 | Windows 上 python3 shim 不靠 | 统一用 `python`，不用 `python3` |
| Ghidra `Unable to prompt user for JDK path, no TTY` | LaunchSupport 需要预保存 JDK 路径 | 先运行 `java -cp LaunchSupport.jar LaunchSupport DIR -jdk_home -save` |
| **Ghidra headless `-max-jvm-heap` 报错 InvalidInputException** | Ghidra 12.x headless 不认 `-max-jvm-heap` 参数 | 去掉该参数。用 `GHIDRA_JAVA_OPTS="-Xmx2G"` 环境变量或 Ghidra 的 `support/launch.properties` 控制堆大小 |
| **Ghidra headless PyGhidra 脚本失败: "Python is not available"** | headless 模式只支持 Java 脚本 (.java)，不支持 PyGhidra (.py) | 改用 `extends GhidraScript` 的 Java 类。模板见 `scripts/ghidra/ExportFunctions.java` |
| **Ghidra headless `-noanalysis` 后 currentProgram 为 null (NullPointerException)** | `-noanalysis` 不打开程序上下文 | 用 `-process "filename.so"` 指定已有项目中的文件；或去掉 `-noanalysis` 让 Ghidra 自动分析 |
| **Ghidra 反编译地址偏移：getFunctionAt 返回 null** | Ghidra image base 默认 0x100000，readelf 显示 0x0 | readelf 地址 +0x100000 = Ghidra 地址。或用 `FunctionManager.getFunctions(true)` 按名遍历查找，不硬编码地址 |
| **Ghidra `getReferencesTo` 返回空** | 符号分析未覆盖某些 XREF | 用 Python `struct` 在二进制中手动搜索 ADRP+ADD 模式（见 `skill-native/references/arm64-string-xref-search.md`），或用 r2 的 `axt` |
| **Ghidra Java 脚本 ClassNotFoundException** | Java 文件名必须与 public class 名完全一致 | 确保 `.java` 文件名 = `public class` 名。例：`DecompileIntegrity.java` 内 `public class DecompileIntegrity` |
| **Ghidra Java 脚本编译错误 `cannot find symbol: depiledFunction()`** | Ghidra API 拼写: 是 `getDecompiledFunction()` 不是 `depiledFunction()` | `DecompileResults.getDecompiledFunction().getC()` 获取反编译 C 代码 |
| **Ghidra Java 脚本 `Reference` 找不到** | `Reference` 在 `ghidra.program.model.symbol` 包，不在 `listing` | `import ghidra.program.model.symbol.Reference;` |
| **Ghidra `analyzeHeadless` 命令行参数顺序** | 项目路径+名称在前，`-process`/`-import`/`-postScript` 在后 | `analyzeHeadless <project_dir> <project_name> -process "file.so" -noanalysis -postScript script.java -scriptPath <dir>` |
| **Ghidra `-process` 必须匹配项目中的文件名** | 文件名是导入时的原始文件名 | 用 `-import` 首次导入时确定文件名，后续用 `-process` 引用同一文件名 |
| scoop shim 调 jadx/apktool 无输出 | .bat/.cmd shim 在 git-bash 下静默失败 | shim 指向原生可执行文件 (jadx) 或用 `java -jar apktool.jar` |
| scoop mingw 有 strings/readelf 但找不到 | scoop 不自动创建 binutils shim | 手动从 `scoop/apps/mingw/current/bin/` 复制到 `scoop/shims/` |
| adb pull 失败 "No such file or directory" | Git Bash/MSYS 自动转换 Windows 路径为 POSIX | Windows 上用 `adb exec-out shell cat /remote/path > local_file`，避免路径转换 |
| pwntools `remote()` 直连被拒 | Windows 防火墙或网络策略阻止出站 TCP | 用 SOCKS5 代理: `s = socks.socksocket(); s.set_proxy(socks.SOCKS5, '127.0.0.1', 7897); s.connect(...); r = remote.fromsocket(s)` |
| tcache key 全零（bytes 8-15 = 0） | glibc 版本编译差异，key 机制可能禁用 | 不能依赖 key 做堆泄露，只能用 fd_encoded。先用 leak 测试 bytes 8-15 是否非零 |
| `read()` 返回0后无法继续交互 | 关闭 stdin write-end 后程序后续 scanf 也收到 EOF | 仅在一次性泄露时使用 `r.shutdown('send')`，之后必须重连 |
| 无 GUI 服务器无法动态分析 GUI 程序 | headless 环境无法运行 Windows GUI 程序 | 让用户在本地抓包（Fiddler/Charles）或用 x64dbg/Frida，把网络请求内容发回来分析 |
| **终端输出显示 `***` 或脱敏数据** | **Hermes 自动脱敏密码/token/密钥等敏感数据** | **用 `curl -o file` 保存原始响应再 `read_file`，或 Python requests 写文件。永远不要依赖终端输出判断敏感数据。** |
| **多个请求并发后全部超时/429** | **并行请求触发目标限频** | **安全测试必须顺序执行，一个完成再发下一个。** |

| **Frida hook 全部 0 行日志 (Android ELF)** | **RWX shellcode 用直接系统调用 (svc #0) 绕过所有 libc hook** | 先用 Capstone 反汇编 RWX 段入口点 (entry point 在 RWX 段 = shellcode)，检查是否包含 `svc #0`。若确认直接系统调用：(1) patch 反调试分支 (如 maps 扫描跳转) 绑定 Frida 重新分析; (2) 纯静态: 解密 XOR 字符串 + Capstone 全量反汇编 |
| Android ELF 入口点在 RWX 段 | 二进制入口点不是 .text 而是 RWX LOAD segment | 这是 shellcode 模式。用 `readelf -h` 看 entry point，若落在 RWX 段地址范围内，直接用 Capstone 反汇编 RWX 段。不要尝试 hook libc 函数——shellcode 用 svc 直调 |
| Android ELF 静态字符串全部正常但运行后无行为 | 二进制通过 `dlopen`/`dlsym` 动态加载游戏/业务库，设备上缺少这些库则静默退出 | 检查 DT_NEEDED 列表 — 若只有标准库但 strings 显示游戏库名 (libil2cpp/libunity)，说明用 dlopen 动态加载。创建 stub .so 或安装目标游戏 |
| Android `libicu.so` not found | Android 10+ 拆分 `libicu.so` 为 `libicuuc.so` + `libicui18n.so` | `ln -sf /apex/com.android.runtime/lib64/libicuuc.so /data/local/tmp/libicu.so` + LD_LIBRARY_PATH 包含 /data/local/tmp |
| **卡密缓存位置未知** | 工具缓存卡密到隐藏位置，删除后强制网络验证（可争取 dump 时间） | 搜索 `/data/adb/modules/<module_name>/` 下的隐藏文件 (如 `.t3card`)。也检查 `/sdcard/.<app>/`, `/data/local/tmp/.<app>*` |
| **Frida hook libc exit 无效** | Shellcode 用 `svc #0` (x8=0x5d/0x5e) 直接退出，不经过 libc exit/exit_group | 需要 patch shellcode 中的 exit svc 指令为 NOP（地址在 exit 函数内），或用 ptrace PTRACE_EVENT_EXIT 拦截 |
| **dd iflag=skip_bytes 读 /proc/PID/mem** | Android toybox 的 dd 支持 `iflag=skip_bytes`，可按字节偏移读取 | `dd if=/proc/$PID/mem of=dump.bin iflag=skip_bytes skip=$START count=$SIZE bs=65536` 比 bs=1 快很多 |
| **Frida 被反分析阻断无法 dump 运行时内存** | Shellcode 读 /proc/self/maps 检测 frida/gum/gadget，使用直接 syscall 绕过 libc hook，进程在 <2s 内退出 | **交叉编译静态 ARM64 dumper**：fork→exec 目标二进制→process_vm_readv 分块读取 RWX 段。`scoop install gcc-aarch64-none-linux-gnu` 编译。详见 `skill-android/references/android-arm64-memory-dump.md` |
| **`process_vm_readv` 成功但 /proc/PID/mem 返回 I/O error** | 进程在内核态等待（nanosleep/do_wait），/proc/mem 不可读 | 用 `process_vm_readv()` 替代 `pread(/proc/PID/mem)`，分 64KB 块读取 |
| **交叉编译 .so 报 `libc.so.6` not found** | glibc vs Android bionic 命名差异 | `-nostdlib -nodefaultlibs -lgcc` 编译共享库 |
| **Cloud phone 设备频繁掉线** | fork+exec 或大量 I/O 导致云手机 VM 不稳定 | 添加 `usleep(50000)` 延迟，多台设备备用 |
| **Frida gadget 被 "gadget" 关键字检测** | `libgadget.so` 路径含 "gadget"，在 /proc/self/maps 可见 | `cp libgadget.so libhelper.so` + `LD_PRELOAD` 加载改名后的库 |
| **dd bs=1 skip=$ADDR 读 /proc/PID/mem 极慢** | bs=1 按字节读，1.2MB 需数秒 | 用 `dd iflag=skip_bytes` 或 `process_vm_readv` |
| **卡密保护工具** | 链接 libil2cpp.so + libunity.so，输出"驱动连接失败" | 游戏外挂工具，需目标游戏运行。卡密可能任意输入即可通过在线验证 |
| **Shell 脚本 gzip 解嵌套** | gzip 流每层含 shell dropper 副本 | 循环 `gzip.decompress()` 直到输出含 `\x7fELF` |
| **完整性校验阻止 patch** | Shellcode 计算自身 hash，代码被改则 hash 不匹配 | 运行时 `Memory.patchCode` 改 `cmp; b.eq` 为无条件 `b` |

| **重命名 frida-server 仍被检测** | **Frida 注入的 `frida-agent-64.so` (memfd) 包含 "frida" 字符串，出现在 /proc/self/maps** | 需要自定义编译 frida-agent（改名）或用 FUSE/bind mount 替换 /proc/self/maps |
| **NOP 反分析分支后 shellcode 不解密第二阶段** | 反分析检测和解密逻辑交织在同一执行路径中，NOP 检测分支会跳过解密代码 | 不要盲目 NOP 所有条件分支。先用 Capstone 全量反汇编 RWX 段，理解完整控制流后再 patch |
| **Patch exit 函数导致无限循环** | Shellcode 用 `b` (非 `bl`) 跳转 exit 函数，LR 指向调用者。Patch exit 为 ret 会跳回再次触发 | 不要 patch exit 函数本身。改为 patch 导致 exit 的条件判断，或从根源阻止检测 |
| **篡改 /proc 路径字符串后 shellcode 仍退出** | openat 失败返回 -1 被 shellcode 视为异常环境 → exit | 不要篡改路径。用 ptrace 拦截 openat syscall，返回合法 fd 指向 /dev/null |
| **完整性校验阻止运行时 patch** | Shellcode 计算自身 hash (mul/eor/ror/madd chain)，被 patch 则 hash 不匹配 → exit | 运行时 patch `cmp w16, w17; b.eq` 为无条件 `b`，绕过 hash 校验 |
| **卡密保护二进制 payload 不解密** | 加密 payload 仅在有效卡密验证后解密。无卡密 → 永远拿不到明文 | 优先获取卡密。否则只能分析到 shellcode + 加密密文层 |
| **Shellcode 完整性 hash 校验阻止 patch** | Shellcode 在寄存器恢复前计算自身 hash (mul+eor+ror+madd chain at 0x3268cc)，任何代码修改导致 hash 不匹配 → exit | 运行时用 Frida Memory.patchCode 将 `cmp w16, w17; b.eq` (0x3268cc) 改为无条件 `b`。不要持久化 patch 二进制文件（会改变 hash） |
| **NOP 所有反分析分支后 payload 不解密** | 反分析检测和解密逻辑在同一执行路径中交织，盲目 NOP 条件分支会跳过解密代码路径 | 先用 Capstone 全量反汇编 RWX 段理解完整控制流。只 patch 导致 exit 的条件分支，保留正常的 fall-through 路径 |
| **篡改加密路径字符串后 fail-closed** | Shellcode 对 openat 失败做 fail-closed 处理（视为异常环境 → exit） | 不要篡改路径。用 ptrace 拦截 openat syscall 返回合法 fd 指向 /dev/null，或 patch 比较指令让检测"通过"而不是"失败" |
| **/proc/PID/mem dump 返回 0 字节** | Shellcode 在 <100ms 内执行完毕并退出，shell 脚本的 maps 解析 + dd 太慢 | 需要 C/Python ptrace 程序精确控制 dump 时机，或用 PTRACE_SYSCALL 在 syscall 层暂停进程 |
| **卡密保护工具 payload 不解密** | 加密 payload 仅在有效卡密验证后解密。无卡密 → 永远拿不到明文 | 优先获取卡密。卡密可能任意输入即可通过在线验证（如 NBG 案例中 "test123" 即可）。否则只能分析到 shellcode + 加密密文层 |
| **腾讯游戏外挂工具识别** | 链接 libil2cpp.so + libunity.so，需要"驱动"(虚拟管道 /dev/virtpipe-*) 连接目标游戏进程 | 输出 "驱动连接失败" = 设备上无目标游戏。安装对应游戏后才能触发完整行为 |

| **Shell 脚本多层 gzip 解嵌套** | gzip 流中每层含 shell dropper 副本，首次解压结果仍是 shell 代码 | 循环解压直到前 4 字节为 `\\x7fELF`。用 `exit 127;\\n` 作为 marker 分割 shell 代码和下一层 gzip |
| **XOR 加密字符串识别** | shellcode 中路径/字符串用单字节 XOR 加密 | 找 `eor w3, w3, #KEY` 指令提取密钥，全段扫描解密。常见密钥: 0xd5 |
| **pcap LINUX_SLL 格式** | tcpdump 在 Android 上使用 LinkType 276 (LINUX_SLL)，非标准 Ethernet | SLL 头 16 字节，协议在 offset 14 (big-endian)。IPv4=0x0800，IPv6=0x86DD |
| **dd if=/proc/PID/mem 返回 0** | 进程在 <100ms 内退出，shell 的 maps 解析 + dd 太慢 | 需要 C/Python ptrace 程序精确控制 dump 时机。或用 tcpdump 抓包获取密钥材料做离线解密 |
| **iptables DROP 导致进程卡死** | 封锁验证服务器后进程在网络请求超时期间卡住 | 可利用这个窗口 dump 内存（如果 dd 能工作的话），但通常 dd 仍返回 0 |

| Magisk 模块 `customize.sh` 中的 `rm -rf` 删除竞争模块 | 不经用户确认直接删除其他模块目录 | 审查冲突列表，确认无模块 ID 误匹配 |
| Rust daemon 进程伪装为 `kworker/0:2` | `prctl` + `/proc/self/mem` 覆写 cmdline | 分析 `/proc/PID/status` 的 Name 字段而非 cmdline |
| 模块自隐藏（点前缀目录） | 删除原始 module.prop，复制到 `.MODULE_ID` | 检查所有 `/data/adb/modules/` 目录包括点前缀 |
| 在线获取 keybox | GitHub raw 文件获取（Base64/Hex） | 需验证 HTTPS + 证书链 + 吊销列表 |
| Health Monitor 熔断器自动重启 | 多次失败后指数退避 | 重启间隔递增，不会无限快速重启 |
| `post-fs-data.sh` 自删机制 | 检测到依赖缺失则自删 | 检查 `TS` 变量指向的核心依赖目录 |



## Heap Exploitation Pitfalls

### 堆利用 CTF Pwn

| 问题 | 原因 | 解决 |
|------|------|------|
| **Tcache poisoning 时 count=0 无法到达目标** | 每次分配消耗 count，目标在 count=0 时成为 head | **Tcache count corruption (glibc<=2.28)**: 释放 N>=2 个同 size chunk，UAF 写最后释放的 chunk 的 fd=target。链缩短为 2 但 count=N。1次分配后 head=target, count=N-1>0，再分配返回 target。**无需 leak**。详见 `skill-native/references/heap-ctf-patterns.md` |
| **虚拟文件系统 rm(path) UAF** | `func_rm` 对 `parent!=cwd && type==file` 只 free(content) 不 free(node) | node 仍可访问，content 指针悬空。echo 触发 memcpy(dangling,data,len)。配合 tcache count corruption 做任意地址写 |
| **UAF 写 0xa8 字节后 get_node 找不到文件** | name 指针被覆盖为 0，strcmp(NULL, "n") 崩溃 | 写 0x90 字节保留 name，或用 PIE .dynstr 0x0569 处的 "n\0" 作为 name 地址 |
| **ASLR 下盲打 libc base 导致服务器限流** | 每次错误地址写入 → SIGSEGV → 进程崩溃 → 服务器限流/封IP | 先 leak libc（unsorted bin fd/bk = main_arena），或用 timing side channel 逐字节探测。不要盲打 |
| **echo 'n' 模式无法泄漏服务端数据** | echo 'n' 打印 sysbuf（用户输入），不是文件内容。不是 read primitive | 需要通过 node/content overlap 控制 content 指向目标地址，再用 echo 'y' 写入 |


