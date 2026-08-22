# NBG 案例：Android ARM64 Shellcode + 卡密保护 + 腾讯游戏外挂

## 目标

- 文件：NBG.sh (3.1MB shell script)
- 最终 payload：ELF64 AArch64 Android (4.23MB)
- 类型：腾讯游戏外挂工具 (RFTools)，卡密保护
- 目标游戏：和平精英、王者荣耀、使命召唤手游等 20+ 款腾讯游戏

## 分析链

```
NBG.sh
  ├─ Lines 1-6: 注释 + find/rm 删除 32 位哈希文件
  ├─ Line 7: Shell dropper (root 检查, 随机路径, chmod 123, 0.5s 自删除, exit 127)
  └─ Lines 8+: Gzip Layer 1
       └─ Shell 代码副本 + Gzip Layer 2
            └─ Shell 代码副本 + Gzip Layer 3
                 └─ ELF64 AArch64 Android (4.23 MB)
```

## ELF 结构

| 属性 | 值 |
|------|-----|
| 格式 | ELF64 ET_DYN (PIE), stripped |
| 架构 | AArch64 (ARM64) |
| 解释器 | `/system/bin/linker64` (Android) |
| 入口点 | `0x320050` (RWX shellcode) |
| RWX 段 | `0x320000`, 1.21 MB |
| DT_NEEDED | libc.so, libm.so, libdl.so, liblog.so, libandroid.so, libicu*.so |
| dlopen 目标 | libil2cpp.so, libunity.so (运行时加载) |

## RWX 段布局

```
0x320000-0x320050  零填充
0x320050-0x3268e4  阶段1: 反分析 + 解密逻辑 (明文 ARM64 shellcode)
0x3268e4-0x326930  寄存器恢复 + ret (正常退出路径)
0x326934-0x3269b0  exit 函数 (错误退出: write NBG_EXIT:XX + exit syscall)
0x3269b4-0x326a14  Cache flush 函数 (dc cvau / ic ivau)
0x326a18-0x327500  密钥派生 + XOR 解密函数
0x327500-0x327600  XOR 加密的 /proc 路径字符串
0x327600-0x327e60  解密密钥常量块
0x327e60-0x330000  阶段1 代码 (更多反分析 + 解密循环)
0x330000-0x44e7f0  阶段2: 加密 payload (1.17MB, 熵 8.00)
```

## 反分析检测链

### 直接系统调用

Shellcode 使用 `svc #0` 直接系统调用，完全绕过 libc hook：

| Syscall | 编号 | 用途 |
|---------|------|------|
| openat | 56 (0x38) | 打开 /proc 文件 |
| read | 63 (0x3f) | 读取文件内容 |
| close | 57 (0x39) | 关闭文件 |
| writev | 66 (0x42) | 写 NBG_EXIT 消息 |
| mprotect | 226 (0xe2) | 修改内存权限 |
| mmap | 222 (0xde) | 内存映射 |
| clone | 220 (0xdc) | 创建子进程 |
| exit_group | 94 (0x5e) | 退出 |

### /proc 文件扫描

XOR 0xd5 加密的检测路径：

| 路径 | 检测目的 |
|------|---------|
| `/proc/self/maps` | 扫描 "frida"/"gum"/"gadget" |
| `/proc/self/smaps` | 同上 |
| `/proc/self/status` | 检查 TracerPid (ptrace) |
| `/proc/self/fd/` | 扫描 frida 相关文件描述符 |
| `/proc/net/unix` | 扫描 frida Unix socket |
| `/proc/self/task/*/comm` | 线程名扫描 |
| `/proc/cpuinfo` | 硬件指纹 (反模拟器) |
| `/proc/uptime` | 运行时间 (反模拟器) |
| `/proc/self/auxv` | 辅助向量分析 |

### 完整性校验

0x3268cc 处: `cmp w16, w17; b.eq #0x3268e4`

计算自身代码 hash (mul+eor+ror+madd chain)，与预期值比较。任何代码修改导致 hash 不匹配 → exit。

### 字符匹配模式

逐字符 case-insensitive 比较 (orr w5, w5, #0x20 后 cmp)：

- "frida": f(0x66) r(0x72) i(0x69) d(0x64) a(0x61) — 5 个检测点
- "gum": g(0x67) u(0x75) m(0x6d) — 3 个检测点
- "gadget": g(0x67) a(0x61) d(0x64) g(0x67) e(0x65) t(0x74) — 6 个检测点
- "TracerPid": T(0x54) r(0x72) a(0x61) c(0x63) e(0x65) r(0x72) P(0x50) i(0x69) d(0x64)

## 解密算法

### XOR 字符串解密

密钥: 0xd5 (单字节)
方法: `decrypted[i] = encrypted[i] ^ 0xd5`

### 阶段2 payload 解密 (自定义流密码)

- 分块: 24 字节 (0x18)
- 密钥来源: RWX 段 0x327d00-0x327e60 内的 32-bit 常量
- 算法: mul + madd + add + eor + orr + ror chain
- 运行时状态: w10, w11, w20, w21, w26 (非静态值)
- 解密后: cache flush (dc cvau / ic ivau) → mprotect(RX) → 跳转执行

## 绕过尝试及结果

| 方案 | 结果 | 原因 |
|------|------|------|
| NOP 所有反分析条件分支 | 进程退出，payload 不解密 | 破坏了解密逻辑的控制流 |
| 篡改 /proc 路径字符串 | 进程退出 | openat 失败 → fail-closed |
| Patch exit 函数为 ret | 无限循环 | `b` 跳转无返回地址，LR 指向调用者 |
| 改名 frida-server | 仍被检测 | frida-agent-64.so (memfd) 仍含 "frida" |
| Frida spawn + 运行时 patch | 进程退出太快 | 反分析在 hook 生效前完成 |
| /proc/PID/mem dump | 0 字节 | 进程 <100ms 退出，shell 脚本太慢 |
| ptrace 拦截 openat | 无编译器 | 设备无 python/gcc |
| Frida gadget (libgadget.so) | 未测试 | gadget 含 "gadget" 字样，预期被检测 |

## 卡密验证

```
• 初始化授权组件 ... OK
• 读取本地授权 ... NONE
卡密Key > [输入任意卡密]
正在连接授权服务器...
• 在线授权 ... OK
授权通过
状态    │ License Verified
到期    │ 2038-01-19 11:14:07
设备    │ 6B7A••••••77A66A
驱动    │ 未连接 / 连接失败
```

- 任意卡密即可通过在线验证（如 "test123"）
- 验证后缓存到本地（第二次自动登录）
- 缓存位置: `/data/adb/modules/niubige/.t3card` (可删除强制重新网络验证)
- "驱动" = 虚拟管道 `/dev/virtpipe-common`, `/dev/virtpipe-render`, `/dev/virtpipe-sec`，需要目标游戏运行
- 辅助脚本 `.android_ios.sh`: IMEI 伪装、游戏 shared_prefs 修改、系统属性伪装、反检测文件清理
- Exit code 0 when driver connection fails (clean exit, not crash)

## 目标游戏包名

```
com.tencent.tmgp.pubgmhd  (和平精英)
com.tencent.tmgp.sgame    (王者荣耀)
com.tencent.tmgp.cod      (使命召唤手游)
com.tencent.KiHan          (王者荣耀国际版)
com.tencent.tmgp.ffom      (和平精英国际版)
... 共 20+ 款腾讯游戏
```

## 外挂功能 (从 .android_ios.sh 推断)

1. IMEI 伪装绕过设备封禁
2. 游戏 shared_prefs 修改 (iOS 模拟标记)
3. 虚拟管道 IPC (`/dev/virtpipe-*`) 与游戏进程通信
4. 系统属性伪装 (build fingerprint, device model 等)
5. 反检测文件清理 (ano_tmp, tdm_tmp 等)

## 使用的工具

本次分析**未使用** radare2/IDA/Ghidra，全部用 Python + 手动解析完成：

| 工具 | 用途 |
|------|------|
| Python `gzip.decompress()` | 3 层 gzip 解嵌套 |
| Python `struct.unpack_from()` | ELF header/program header/dynamic segment 解析 |
| Python `re.findall(rb'[\x20-\x7e]{6,}', data)` | 字符串提取 (替代 strings 命令) |
| Python `math.log2()` Shannon entropy | 熵值计算判断加密区域 |
| Capstone (`Cs(CS_ARCH_ARM64, CS_MODE_ARM)`) | ARM64 反汇编 |
| Python `bytes(b ^ 0xd5 for b in enc)` | XOR 字符串解密 |
| Frida 17.15.3 | spawn/attach/hook 尝试 (被反调试阻止) |
| ADB + su | 设备交互、文件推送、进程管理 |

## 网络通信 (tcpdump 抓包)

| 服务器 | 端口 | 用途 |
|--------|------|------|
| 10.4.150.125:34112 | 自定义协议 | 卡密验证 (SSH-like, 24B packets) |
| 10.4.150.12:49300 | 自定义协议 | 驱动/数据 (567B+2796B+132B encrypted) |
| 103.85.86.98:80 | HTTP | 第三方服务 |

### pcap LINUX_SLL2 解析 (Android tcpdump)

Android tcpdump 使用 LinkType 276 (LINUX_SLL2)，头 20 字节:
- offset 0: protocol_type (2B, big-endian), IPv4=0x0800
- offset 20: IP header
- TCP payload 从 ip_hdr_len + tcp_data_offset 开始

```python
proto_type = struct.unpack_from('>H', pkt, 0)[0]
if proto_type == 0x0800:  # IPv4
    ip_offset = 20
    ihl = (pkt[ip_offset] & 0x0F) * 4
    protocol = pkt[ip_offset + 9]  # 6=TCP, 17=UDP
    # TCP header at ip_offset + ihl
    # payload at ip_offset + ihl + tcp_hdr_len
```

### 卡密验证协议

```
→ POST /{hex_id} (506B): t=encrypted_token&s=encrypted_data
← 200 OK (chunked): Base64 encoded response (128B, status=ac)
→ POST /{hex_id} (506B): t=encrypted_token&s=encrypted_data
← 200 OK (chunked): Base64 encoded response (128B, status=ac)
→ POST /{hex_id} (1048B): kami=encrypted_cardkey&imei=encrypted_imei&t=...&s=...
← 200 OK (chunked): Base64 encoded response (375B, status=200)
```

375B 响应 (熵 7.42) 是解密密钥材料。

## 教训

1. **不要盲目 NOP 所有条件分支** — 反分析和解密逻辑交织在同一路径
2. **完整性 hash 校验必须同时 patch** — 否则任何修改都被检测
3. **直接系统调用让所有 libc hook 无效** — 必须用 Capstone 静态分析或 ptrace
4. **进程退出太快无法 runtime dump** — 需要 C/Python ptrace 程序精确控制
5. **Frida agent 的 memfd 映射名无法隐藏** — 重命名 server 不够
6. **卡密可能任意输入即可通过** — 在线验证可能是弱验证
7. **exit 函数用 `b` 跳转 (非 `bl`)** — 无 LR，patch 为 ret 会回到调用者
8. **dd bs=SIZE skip=ADDR 不等于 dd iflag=skip_bytes** — skip 是块数不是字节数
9. **Android toybox dd 支持 iflag=skip_bytes** — 比 bs=1 快很多
10. **3层 gzip 嵌套** — 每层夹带 shell dropper 副本，需循环直到 ELF 签名
