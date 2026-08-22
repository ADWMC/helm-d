# Android ARM64 Shellcode 分析: 反调试 + 直接系统调用 + 自修改代码

> 实战案例: NBG.sh 恶意软件 (Telegram 分发, 游戏外挂投放器)

## 样本结构

```
原始文件 (3.1MB shell script)
  └─ 3层 gzip 嵌套: 每层含 shell dropper 副本 + 下一层 gzip
       └─ ELF64 AArch64 Android PIE (4.23MB)
            ├─ .text (R-X, 3MB): libc 导入 + 普通 C++ 代码
            ├─ .data (RW-, 26KB): 配置数据
            └─ RWX (1.2MB): ARM64 shellcode (入口点) + XOR加密数据
```

### 解嵌套方法

```python
import gzip
# 逐层解压, 每层解压后找 "exit 127;" 分割 shell 代码和下一层 gzip
for layer in range(10):
    decompressed = gzip.decompress(payload)
    marker = b'exit 127;'
    pos = decompressed.find(marker)
    if pos < 0:
        # 最终 payload (ELF binary)
        break
    shell_part = decompressed[:pos]
    payload = decompressed[pos + len(marker) + 1:]  # skip newline
```

## RWX 段布局

```
0x320000-0x330000 (64KB)  → 阶段1 shellcode (明文, 熵 7.60)
  ├─ 0x320050: 入口点 (寄存器保存, sub sp, sp, #0x630)
  ├─ 0x320094: flag检查 → 控制是否执行反分析
  ├─ 0x3200e0-0x321668: 反分析检测链 (8+个 /proc 文件扫描)
  ├─ 0x3268e4: 寄存器恢复 + ret (正常退出)
  ├─ 0x326934: 错误退出函数 (mov w10, #0x12; b #exit)
  ├─ 0x3269b4: cache flush (dc cvau / ic ivau / dsb ish / isb)
  └─ 0x326a18: 密钥派生 + XOR 解密函数 (mul/madd/add/eor/orr/ror 链)

0x330000-0x44e7f0 (1.17MB) → 阶段2 加密 payload (熵 8.00, 完全随机)
```

## 反分析检测 (全部使用直接系统调用)

### 检测链 (按执行顺序)

| 地址范围 | 检测目标 | syscall | 检测内容 |
|----------|----------|---------|----------|
| 0x320198-0x320350 | /proc/self/maps | openat(56) + read(63) | "frida", "gum", "gadget" |
| 0x320360-0x3206f4 | /proc/cpuinfo | openat + read | 模拟器特征 |
| 0x3206f8-0x3208bc | /proc/self/smaps | openat + read | "frida", "gum", "gadget" |
| 0x3208c0-0x320a34 | /proc/self/status | openat + read | TracerPid (ptrace 检测) |
| 0x320a38-0x320c10 | /proc/self/fd/ | openat + readat | frida fd 管道 |
| 0x320c14-0x320dd8 | /proc/self/task/*/comm | openat + read | 线程名 |
| 0x320ddc-0x321668 | 更多 | openat + read | 各种环境检测 |

### XOR 0xd5 加密的路径字符串

```python
# 所有 /proc 路径用 XOR 0xd5 加密存储
key = 0xd5
encrypted = rwx[0x7514:0x7514+16]
path = bytes(b ^ key for b in encrypted)
# → b'/proc/self/maps\x00'
```

关键加密字符串:
- `/proc/self/maps` — Frida 检测
- `/proc/cpuinfo` — 模拟器检测
- `/proc/self/smaps` — Frida 检测
- `/proc/self/status` — TracerPid 检测
- `/proc/self/fd/` — fd 管道检测
- `/proc/net/unix` — Unix socket 检测
- `/proc/self/task/` — 线程名检测
- `/proc/self/auxv` — 辅助向量检测
- `/proc/uptime` — 运行时间检测
- `/proc/sys/kernel/hostname` — 主机名
- `/system/bin/linker64` — 链接器路径

### 退出模式

```
检测到特征 → mov w10, #0x12 (exit code)
           → nop; nop
           → b #0x326934 (全局退出函数)
           → writev(66, stderr, "NBG_EXIT:XX")
           → exit_group(94, 0)
```

全局退出函数有 50+ 个入口点，全部 `b #0x326934`。

## 关键发现: NOP 方案破坏解密流程

**问题**: 直接 NOP 所有条件分支会导致 shellcode 提前返回，跳过解密逻辑。

**原因**: 反分析检测和解密逻辑**交织在同一执行路径中**:
```
入口 → 保存寄存器
     → maps 检测 (NOP'd) → cpuinfo 检测 (NOP'd) → ... → 最后一个检测 (NOP'd)
     → 寄存器恢复 → ret → 链接器 → exit
     [解密代码在检测链中间某处, 被 NOP 跳过了]
```

**教训**: 不能把反分析代码当作独立模块 NOP 掉。必须理解完整控制流, 找到检测和解密的交汇点。

## 直接系统调用号 (AArch64)

| Syscall | 编号 | 用途 |
|---------|------|------|
| openat | 56 (0x38) | 打开文件 |
| read | 63 (0x3f) | 读取文件 |
| close | 57 (0x39) | 关闭文件 |
| writev | 66 (0x40) | 写 (NBG_EXIT 消息) |
| mmap | 222 (0xde) | 内存映射 |
| mprotect | 226 (0xe2) | 修改内存权限 |
| clone | 220 (0xdc) | 创建子进程 |
| prctl | 167 (0xa7) | 进程属性 (PR_SET_NAME) |
| getpid | 177 (0xb1) | 获取 PID |
| exit_group | 94 (0x5e) | 退出进程 |

**识别模式**: `mov x8, #N; svc #0` (不经过 libc, Frida hook 无效)

## ARM64 自修改代码模式

```asm
; 1. 解密 (XOR/ROR 密钥派生)
adr   x16, #key_addr
ldr   w4, [x16]
mul   w4, w18, w4        ; key = w18 * key1
madd  w4, w3, w16, w4    ; key += w3 * key2
add   w4, w4, key3       ; key += key3
eor   w4, w4, key4       ; key ^= key4
; ... 更多 ROR/EOR/ORB 链 ...

; 2. 写入解密后的代码
strb  w4, [x15, x9]      ; 写入目标地址

; 3. 刷新 cache (关键!)
bl    cache_flush
; cache_flush 内部:
dc    cvau, x7            ; Clean data cache
dsb   ish                ; Data synchronization barrier
ic    ivau, x7            ; Invalidate instruction cache
isb                       ; Instruction synchronization barrier

; 4. 修改内存权限
mov   x8, #0xe2          ; mprotect
svc   #0

; 5. 执行解密后的代码
br    x0                  ; 跳转到解密后的代码
```

## Frida 17.x Android 兼容性问题

### Module.findExportByName 不可用

```javascript
// BROKEN in Frida 17.x Android:
var fn = Module.findExportByName('libc.so', 'mprotect');  // TypeError

// WORKING:
function findExport(modName, expName) {
    var mod = Process.findModuleByName(modName);
    if (!mod) return null;
    var result = null;
    mod.enumerateExports().forEach(function(exp) {
        if (exp.name === expName && exp.type === 'function') result = exp.address;
    });
    return result;
}
var fn = findExport('libc.so', 'mprotect');
```

### Memory.readByteArray 不可用

```javascript
// BROKEN:
var bytes = Memory.readByteArray(addr, len);  // TypeError

// WORKING:
var bytes = addr.readByteArray(len);  // 方法调用在 address 对象上
```

### spawn + attach 时序

```python
# 必须在 resume 之前安装 hooks, 否则 shellcode 先执行完
pid = device.spawn([target], env={...})
session = device.attach(pid)
script = session.create_script(hook_code)
script.load()  # hooks 在这里安装
device.resume(pid)  # 然后才恢复执行
```

## 绕过策略 (实战验证)

### 方案1: 篡改加密路径字符串

将 `/proc/self/maps` 等路径的第一个字节从 '/' 改为其他字符，使 openat 失败。

```python
# XOR 0xd5 加密的 '/' (0x2f) = 0xfa
# 改为 XOR 0xd5 加密的 'z' (0x7a) = 0xaf
data[file_offset] = 0xaf
```

**实战结果**: 部分有效。openat 失败后，shellcode 对失败做 fail-closed 处理（视为异常环境 → exit）。不是所有样本都这样，值得一试。

### 方案2: NOP 所有条件分支到退出点

```python
NOP = 0xD503201F
# 找所有 cbnz/b.eq/b.ne 跳转到退出函数的指令
for addr in exit_branch_addresses:
    struct.pack_into('<I', data, file_offset(addr), NOP)
```

**实战结果**: 失败。反分析检测和解密逻辑**交织在同一执行路径中**，盲目 NOP 会跳过解密代码路径，shellcode 提前返回。

### 方案3: Patch 退出函数为寄存器恢复

```python
# 替换退出函数入口为: mov x0, #0; ret
struct.pack_into('<I', data, exit_func_offset, 0xD2800000)  # mov x0, #0
struct.pack_into('<I', data, exit_func_offset+4, 0xD65F03C0)  # ret
```

**实战结果**: 失败。Shellcode 用 `b` (非 `bl`) 跳转退出函数，LR 指向调用者。ret 跳回后再次触发检测，形成无限循环。

### 方案4: 完整性校验绕过

shellcode 在寄存器恢复前计算运行时状态的 hash（mul+eor+ror+madd chain），与期望值比较。

```python
# Patch: cmp w16, w17 → 无条件 b (绕过 hash 校验)
# 0x3268cc: b.eq #0x3268e4 → b #0x3268e4
struct.pack_into('<I', data, offset_0x3268cc, 0x14000006)  # b #+6
```

**实战结果**: 单独 patch 无效。完整性校验只是众多退出路径之一，其他反分析检测仍在触发。

### 方案5: 静态解密 (Python 实现密钥派生)

从 RWX 段提取所有密钥值，用 Python 复现解密算法。

**实战结果**: 密钥派生算法复杂（24字节分块 + mul/madd/eor/ror 链），且调用者传入的初始状态 (w10/w11/w20/w21) 来自服务器响应，无法静态还原。需要 pcap 抓包 + 离线实现。

### 方案6: iptables 封锁验证服务器

```bash
iptables -A OUTPUT -d w.t3yanzheng.com -j DROP
iptables -A OUTPUT -d 106.13.230.94 -j DROP
```

**实战结果**: 进程在网络请求超时期间存活（~10秒），但 `dd if=/proc/PID/mem` 仍返回 0 字节。shell 的 maps 解析 + dd 命令管道太慢。

### 方案7: 自定义 frida-agent (改名)

**实战结果**: 理论可行但需要修改 Frida 源码重编译。`/memfd:frida-agent-64.so (deleted)` 出现在目标进程的 maps 中，重命名 frida-server 不够。

## 完整性校验详解

```asm
; 0x326820-0x3268c8: hash 计算
ldr   x10, [sp, #0x150]     ; 运行时状态值
add   x6, x10, x19
ldr   w16, [x6]             ; 加载待校验值
; ... mul/eor/ror/madd 链 ...
mov   w18, #0x7c15
movk  w18, #0x7f4a, lsl #16 ; 常量 0x7f4a7c15
madd  w16, w17, w18, w16    ; hash = w17 * 0x7f4a7c15 + w16
eor   w16, w16, w16, lsl #13  ; xorshift
eor   w16, w16, w16, lsr #17
eor   w16, w16, w16, lsl #5
ldr   w17, [sp, #0x148]     ; 期望值
cmp   w16, w17              ; 比较
b.eq  #0x3268e4             ; 匹配 → 正常退出
; 不匹配 → exit
```

**关键**: hash 计算的是**运行时状态**（栈上的值），不是代码字节。但代码变更会改变状态初始化，间接影响 hash。

## /proc/PID/mem 时序问题

Shellcode 在 <100ms 内执行完毕并退出。Shell 脚本的 maps 解析 + dd 太慢。

```
尝试过的方案:
- dd if=/proc/PID/mem bs=$SIZE skip=$OFFSET count=1  → 0 bytes (进程已退出)
- cat /proc/PID/mem > file  → 0 bytes
- FIFO 保持 stdin 打开  → 无效 (进程不读更多 stdin)
- (echo test; sleep 30) | nbg  → 无效 (驱动检测后立即 exit)
```

**根本原因**: 进程在"驱动连接失败"后 <10ms 内退出，shell 命令来不及执行。

**可行方案**: 需要 C/Python ptrace 程序精确控制 dump 时机，或用 PTRACE_SYSCALL 在 syscall 层暂停进程。但设备上无编译器。

## pcap 网络抓包分析

当无法运行时 hook 时，用 tcpdump 抓取 C2 通信获取密钥材料：

```bash
# 后台抓包
tcpdump -i any -w /data/local/tmp/nbg.pcap host w.t3yanzheng.com &

# 运行二进制
echo test123 | /data/local/tmp/nbg

# 停止抓包
killall tcpdump

# 拉取分析
adb pull /data/local/tmp/nbg.pcap
```

**pcap 解析要点**:
- LinkType 276 = LINUX_SLL (16字节头), 非标准 Ethernet
- HTTP 请求体: `kami=...&imei=...&t=...&s=...` (URL 编码的十六进制)
- HTTP 响应: chunked encoding, Base64 编码的密钥材料
- 三个 POST 请求对应三个授权阶段 (auth1 + auth2 + key)
- 密钥响应 375 bytes (entropy 7.42) 用于派生解密密钥

## Instrumentation 工具兼容性

- Agent 库名 `libgadget.so` 包含 "gadget"，会被检测
- 注入工具 spawn 通常只支持 package name，不支持任意二进制
- `frida -U -p <PID> -l hook.js` 可附加到运行中进程
- 部分 gadget 需要 root + API 30+ (Android 11+)
- **API 29 (Android 10) 不支持**: `cannot locate symbol "pthread_cond_clockwait"` — 此符号在 API 30+ 的 bionic 中才有
- 进程退出太快导致 attach 来不及
- **重命名 gadget**: `cp libgadget.so libhelper.so` 可避免路径中的 "gadget"，但 ELF 符号表中仍有 C++ mangled name 包含 "gadget"。/proc/self/maps 只显示文件路径，所以重命名应该足以绕过 maps 检查。但 API 29 设备仍不支持。

## Frida-agent memfd 映射问题

当 Frida spawn 或 attach 到进程时，agent 被注入为 memfd 映射：

```
/proc/PID/maps:
7f963cf000-7f97a98000 r-xp /memfd:frida-agent-64.so (deleted)
```

- 映射名包含 "frida"，无法通过重命名 frida-server 消除
- 需要自定义编译 frida-agent (改名) 或用 FUSE/bind mount 替换 /proc/self/maps
- 重命名 frida-server 二进制文件只改变进程名，不改变 agent 映射名
## 卡密保护 + 驱动连接模式

某些 Android 游戏外挂工具采用两阶段授权:

```
1. 卡密验证: 连接授权服务器 (HTTP POST: kami=...&imei=...&t=...&s=...)
   → 任意输入可能通过 (服务器不验证实际卡密)
   → 缓存授权到本地 (后续自动登录)

2. 驱动连接: 通过 /dev/virtpipe-* 管道与目标游戏进程 IPC
   → /dev/virtpipe-common/ (通用管道)
   → /dev/virtpipe-render/ (渲染管道)
   → /dev/virtpipe-sec/ (安全管道)
   → /dev/virtpipe-common-syzsaow/ (特定变体)
   → /dev/awd/ (辅助目录)

3. 驱动连接失败 → 进程立即退出 (<10ms)
   → payload 不解密 → 无法 dump
```

**目标游戏包名** (RFTools 实例):
- `com.tencent.tmgp.pubgmhd` (和平精英)
- `com.tencent.tmgp.sgame` (王者荣耀)
- `com.tencent.tmgp.cod` (使命召唤手游)
- `com.tencent.KiHan` (王者荣耀国际版)
- 等 20+ 款腾讯游戏

**保持进程活跃的思路**:
- 安装目标游戏 → 驱动连接成功 → 进程保持活跃 → dump 解密后 RWX
- 创建 FIFO 管道模拟驱动 → 可能阻塞在 read → 有时间 dump
- tcpdump 抓包获取授权服务器返回的密钥材料 → 离线解密

## 关联文档

- `anti-frida-workarounds.md` — Windows DLL 反 Frida (不同场景)
- `vmp-elf-protection.md` — ELF VMP 保护架构 (防御侧)
- `gh-loader-anti-frida-case.md` — PE loader 反 Frida 案例
