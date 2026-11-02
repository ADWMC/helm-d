# 案例：Android ARM64 卡密验证绕过（宝塔内核 shell）

> 来源实战：`bt内核.sh` — 宝塔面板 Android 端内核组件，含在线卡密验证  
> 日期：2026-06-23  
> 工具链：radare2 + capstone + Python  
> 架构：ARM64 (AArch64), PIE, stripped, Android 28

---

## 一、目标特征

```
文件类型:  ELF 64-bit LSB pie executable, ARM aarch64
编译器:    Android NDK r23c (clang 21.0.0, +pgo +bolt +lto +mlgo)
链接:      动态链接, interpreter /system/bin/linker64
保护:      Stack Canary (canary=true), NX, PIE
strip:     是 (无符号)
文件大小:  ~19MB
```

**嵌入的 RSA 公钥**（RSA-1024，弱密钥）：
```
-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCgd+1OZfGD+V0MOZKGO45jmZsS
oUjr9c9GpJpkccYv9ARO9hf+IVPyIlkosKcrIFQ3rzKqq91mC9oNgkLm/jkGdj3M
Mk5Tu3aWfGQnpI9Zchjb46BaQHp7lttdJqD3Ea/2t7dKEmdZvA1rKnSZTJi4gT/p
fqhc1xXkqAU6ys06hwIDAQAB
-----END PUBLIC KEY-----
```

**验证服务器**: `https://w.t3yanzheng.com/`

---

## 二、关键函数与地址

| 地址 | 函数 | 作用 |
|------|------|------|
| `0xe59dec` | `fcn.00e59dec` | 主入口，菜单交互 + 调用认证 |
| `0xe5a2d8` | `fcn.00e5a2d8` | 在线认证流程（两次调用验证函数） |
| `0xeb0254` | `fcn.00eb0254` | **卡密验证核心**：HTTP 请求 + RSA 签名验证 |
| `0xe6d518` | `fcn.00e6d518` | 完整性校验（比对常量值） |
| `0xe713f8` | `fcn.00e713f8` | 结构体初始化（清零字段） |
| `0xe71474` | `fcn.00e71474` | 结果拷贝（src → dst，含 flag 字节） |
| `0xe71534` | `fcn.00e71534` | 结构体清理 |

**配置文件**: `/data/adb/dec_jumpout_offset.txt`（读取 hex offset，控制是否跳过验证）

---

## 三、验证流程分析

```
fcn.00e59dec (主入口)
  │
  ├─ 读取 /data/adb/dec_jumpout_offset.txt → bit 0 控制跳过
  │
  ├─ [0xe5a218] tbnz w8, #0, 0xe5a22c  ← 条件跳过
  │   └─ (不跳) → [0xe5a21c] bl fcn.00e5a2d8  ← 在线验证
  │       │
  │       ├─ [0xe5a634] bl fcn.00eb0254  ← 第 1 次卡密验证
  │       │   ├─ HTTP POST → https://w.t3yanzheng.com/
  │       │   ├─ RSA-1024 签名验证
  │       │   └─ 检查 JSON: token/expire/amount/sign
  │       │
  │       ├─ [0xe5a960] bl fcn.00eb0254  ← 第 2 次卡密验证
  │       │   └─ (同上)
  │       │
  │       └─ [0xe5a64c] ldrb w8, [sp, 0x120]  ← 读 flag
  │           └─ cbz w8 → 失败路径
  │
  ├─ [0xe5a220] cbz w0, 0xe5a22c  ← 检查返回值
  │   └─ (非0) → w0=1, 成功返回
  │
  └─ [0xe5a22c] → 跳过/失败后的公共路径
```

**关键发现**：`fcn.00eb0254` 被调用 2 次，每次的结果通过 `fcn.00e71474` 拷贝到 `sp+0x120`，最终检查 `[sp+0x120]` 的 flag 字节。

---

## 四-A、最简绕过：`--skip-auth` 启动参数

**这是最简单的绕过方式，无需任何二进制 patch。**

### 命令行参数解析流程

程序在 `0xe59f80` 开始解析 `argv`，循环比较每个参数：

```
0xe59fdc: ldr x28, [x23]           ; x28 = argv[i]
0xe59fe8: bl strcmp(x28, x19)      ; 比较参数 1
0xe59ff8: bl strcmp(x28, x20)      ; 比较参数 2
0xe5a008: bl strcmp(x28, x21)      ; 比较参数 3
0xe5a018: bl strcmp(x28, x22)      ; 比较参数 4
...
0xe5a048: adrp x1, 0xee000
0xe5a050: add  x1, x1, 0xacc       ; x1 = "--skip-auth"
0xe5a054: bl   strcmp(x28, "--skip-auth")
0xe5a058: cbz  w0, 0xe5a0fc        ; 匹配 → 跳转
```

### `--skip-auth` 匹配后的动作

```asm
; 0xe5a0fc:
mov w8, #1
str w8, [sp, 0xc]     ; 设置 skip_auth_flag = 1
b   0xe59fd0           ; 继续解析下一个参数
```

### flag 如何控制验证跳过

```asm
; 0xe5a120:
ldr w8, [sp, 0xc]      ; 读取 skip_auth_flag
; 0xe5a124:
tbz w8, #0, 0xe5a21c   ; 如果 flag=0 → 调用验证函数
; 如果 flag=1 → 跳过，直接到 0xe5a22c（成功路径）
b   0xe5a22c
```

### 使用方式

```bash
# 直接启动，跳过卡密验证
chmod +x bt内核.sh
./bt内核.sh --skip-auth

# 无需 patch 二进制，无需 root
```

### 完整参数表

通过逆向 `0xe59fe0-0xe5a0d0` 的 strcmp 链，识别出以下参数：

| 参数 | 比较地址 | 匹配后动作 |
|------|---------|-----------|
| `--skip-auth` | `0xeeacc` | `w8=1 → [sp+0xc]`（跳过验证） |
| 其他参数 | `x19/x20/x21/x22` 指向的字符串 | 设置 `w24`/`w25`/`w27` 标志位 |

### 为什么 --skip-auth 存在？

这很可能是**开发者调试后门**。在开发/测试阶段，开发者不想每次都走在线验证，所以预留了这个参数。发布时应该删除但忘了。

---

## 四-B、绕过方案演进（二进制 patch）

### ❌ v1/v2：直接 patch `fcn.00eb0254` 函数体

**思路**：替换整个验证函数为「初始化结构体 + 设置 flag = 1 + 返回 0」

```asm
; 补丁后的 fcn.00eb0254
stp x29, x30, [sp, #-0x10]!
mov x29, sp
mov x9, x8            ; 保存 x8
mov x0, x8            ; 传给 sub_E713F8
bl  sub_E713F8        ; 初始化结构体
mov w0, #1
strb w0, [x9]         ; flag = 1
mov w0, #0
ldp x29, x30, [sp], #0x10
ret
```

**结果**：Bus error → Segfault

### ❌ v3：修复 bl 编码

**发现**：bl 指令编码差 1 字节

| | 字节 | 目标 | 问题 |
|---|---|---|---|
| 错误 | `64 04 ff 97` | `0xe713f4` | 跳到指令中间 |
| 正确 | `65 04 ff 97` | `0xe713f8` | 正确函数入口 |

**修复后**：Segfault（仍崩溃）

### 🔍 根因分析：x8 不是结构体指针！

```asm
; 原始函数 fcn.00eb0254 开头
0xeb0278: mov x19, x8          ; x19 = 调用者的 x8 (保存)
0xeb027c: ldr x8, [x23, 0x28]  ; x8 = stack canary (覆盖!)
0xeb0280: mov x20, x0          ; x20 = arg1
0xeb0284: mov x0, x19          ; x0 = 原始 x8 → 传给 sub_E713F8
0xeb0294: bl  sub_E713F8
```

**真相**：`x8` 在调用者中被设置为 `sp + 0x10`（栈上 buffer 指针），但紧接着 `ldr x8, [x23, 0x28]` 将 x8 **覆盖为 stack canary**。

patch 假设 x8 是结构体指针，在函数入口处 `mov x9, x8` 保存的是原始 x8（`sp+0x10`）。`sub_E713F8` 接收的是 x19（=原始 x8），这部分正确。

**但 `strb w0, [x9]` 写入的地址取决于 x9 的值**。如果 x8 在调用时不是有效的结构体指针（或结构体布局不匹配），写入会崩溃。

### ✅ v4：Patch 调用者分支（最终方案）

**思路**：完全不动 `fcn.00eb0254`，改为 patch 调用者的条件跳转，永远跳过验证。

```python
# 补丁 1: 跳过第一个验证调用
#   0xe5a218: tbnz w8, #0, 0xe5a22c  →  b 0xe5a22c
addr1 = 0xe5a218
patch1 = bytes.fromhex('05000014')  # b +0x14 (5 instructions)

# 补丁 2: 跳过第二个验证调用
#   0xe5a920: tbz w0, #0, 0xe5a93c  →  b 0xe5a93c
addr2 = 0xe5a920
patch2 = bytes.fromhex('07000014')  # b +0x1c (7 instructions)

# 补丁 3: 完整性校验始终通过
#   0xe6d518: → mov w0, #1; ret
addr3 = 0xe6d518
patch3 = bytes.fromhex('20008052' 'c0035fd6')
```

**原理**：
- `tbnz w8, #0, target` → 如果 bit 0 = 1 则跳转（条件跳）
- `b target` → 无条件跳转（永远跳）
- 改为 `b` 后，验证函数**永远不会被调用**

---

## 五、关键教训

### 0. 先找启动参数，再找 patch 点

```
逆向优先级:
  1. 检查字符串表中的 "--xxx" / "--skip" / "--debug" / "--no-auth" 等参数
  2. 搜索 strcmp/strncmp 的调用集群（通常是参数解析器）
  3. 确认参数对应的 flag 存储位置和控制逻辑
  4. 如果存在 → 直接用参数绕过，零成本
  5. 如果不存在 → 再考虑二进制 patch
```

**本案中**：`--skip-auth` 参数完全绕过验证，但我们直到最后才发现。如果一开始就搜索 `rafind2 -s "skip" target`，能在 5 分钟内找到这个最简方案。

### 1. 不要假设寄存器用途

```
错误假设: x8 = 调用者传入的结构体指针
实际:     x8 被 ldr x8, [x23, 0x28] 覆盖为 stack canary
教训:     入口处 x8 的值 ≠ 函数内部 x8 的值
```

**正确做法**：追踪寄存器在整个函数中的生命周期，不要只看入口。

### 2. 条件分支 → 无条件分支是最安全的绕过

```
复杂度:  patch 函数体 > patch 分支跳转
风险:    patch 函数体需要理解完整调用约定
         patch 分支只需确认跳转目标正确
```

| 方案 | 需要理解 | 风险 | 可靠性 |
|------|---------|------|--------|
| patch 函数体 | 调用约定 + 结构体布局 + 子函数行为 | 高 | 低 |
| patch 条件分支 | 分支目标地址 | 低 | 高 |

### 3. Bus error → Segfault 的诊断路径

```
Bus error (SIGBUS)
  └─ 通常: 访问未对齐地址 / 跳到非指令边界
      └─ 检查: bl 编码是否正确？跳转目标是否在指令边界？

Segfault (SIGSEGV)
  └─ 通常: 写入只读内存 / 空指针 / 越界
      └─ 检查: 写入地址是否有效？寄存器值是否符合假设？
```

### 4. radare2 快速分析工作流

```bash
# 1. 字符串定位关键函数
rafind2 -s "token" target
rafind2 -s "auth" target
rafind2 -s "verify" target

# 2. xref 追踪
r2 -q -c 'aaa; axt @ str.xxx' target

# 3. 反汇编验证
r2 -q -c 'pd 30 @ addr' target

# 4. 直接 patch（用于快速验证）
r2 -q -c 's 0xADDR; wa b 0xTARGET; w -' target
```

### 5. ARM64 指令编码速查

```
b  target:    0x14 | (imm26 & 0x3FFFFFF)     # 无条件跳转
bl target:    0x94 | (imm26 & 0x3FFFFFF)     # 带链接跳转
cbz  w0, T:   0x34 | (imm19 << 5) | Rt       # 条件跳转
tbnz w8, #0, T: 0x37 | (imm14 << 5) | (b5<<31) | Rt
tbz  w0, #0, T:  0x36 | (imm14 << 5) | (b5<<31) | Rt
```

---

## 六、验证服务器交互

```
客户端 (bt内核)                    服务器 (w.t3yanzheng.com)
    │                                      │
    │  POST / (form-urlencoded)            │
    │  参数: token, imei, device_id, ...   │
    │  ──────────────────────────────►     │
    │                                      │
    │  ◄──────────────────────────────     │
    │  响应: JSON                          │
    │  { "status": 200,                    │
    │    "token": "...",                   │
    │    "expire": "...",                  │
    │    "amount": "...",                  │
    │    "sign": "RSA签名..." }            │
    │                                      │
    │  RSA-1024 公钥验证签名               │
    │  检查 HTTP 状态码 == 200             │
    │  逐字段验证 JSON 响应                │
```

---

## 七、补丁验证清单

补丁后验证步骤：

```bash
# 1. 文件完整性
file bt内核_patched_v4.sh    # 应仍为 ELF 64-bit ARM aarch64
md5sum bt内核_patched_v4.sh  # 确认只有补丁位置变化

# 2. 补丁位置验证
xxd -s 0xe5a218 -l 4 bt内核_patched_v4.sh   # 应为 05 00 00 14
xxd -s 0xe5a920 -l 4 bt内核_patched_v4.sh   # 应为 07 00 00 14
xxd -s 0xe6d518 -l 8 bt内核_patched_v4.sh   # 应为 20 00 80 52 c0 03 5f d6

# 3. radare2 反汇编确认
r2 -q -c 'pd 2 @ 0xe5a218' bt内核_patched_v4.sh  # 应为 b 0xe5a22c
r2 -q -c 'pd 2 @ 0xe5a920' bt内核_patched_v4.sh  # 应为 b 0xe5a93c
r2 -q -c 'pd 2 @ 0xe6d518' bt内核_patched_v4.sh  # 应为 mov w0, 1; ret

# 4. 在 Android 设备上运行
chmod +x bt内核_patched_v4.sh
./bt内核_patched_v4.sh
```

---

## 八、文件清单

| 文件 | 说明 |
|------|------|
| `bt内核.sh` | 原始文件 |
| `bt内核_patched_v4.sh` | 最终补丁版本 |
| `patch_kami_v4.py` | 补丁脚本（可复用） |
