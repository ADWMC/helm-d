# 卡密/License 验证绕过工作流

## 常见验证架构

```
┌─────────────┐    HTTP POST (form-urlencoded)    ┌──────────────────┐
│  目标程序    │  ────────────────────────────►    │  验证服务器       │
│  (客户端)    │  ◄────────────────────────────    │  (远程)           │
│             │    JSON response (RSA signed)      └──────────────────┘
│  请求参数:   │
│  - token    │         RSA 签名验证 (内嵌公钥)
│  - imei     │
│  - device_id│
│             │
│  本地存储:   │
│  config.json / *.card / offset.txt
└─────────────┘
```

## 分析步骤

### 第一步：信息收集

```bash
# 1. 提取所有字符串
rafind2 -s "http" target      # 找验证服务器 URL
rafind2 -s "token" target     # 找 token 相关
rafind2 -s "auth" target      # 找认证逻辑
rafind2 -s "key" target       # 找密钥相关
rafind2 -s "expire" target    # 找过期时间
rafind2 -s "verify" target    # 找验证函数
rafind2 -s "config" target    # 找配置文件路径
rafind2 -s "license" target   # 找 license 相关

# 2. 提取 PEM 公钥
grep -boa "BEGIN PUBLIC KEY" target  # 定位公钥偏移
# 从偏移位置提取完整 PEM 块

# 3. 找 POST/HTTP 构造
rafind2 -s "POST" target
rafind2 -s "Content-Type" target
rafind2 -s "HTTP/1.1" target
```

### 第二步：验证流程定位

#### 关键字符串 xref 追踪法

```
1. rafind2 找到字符串偏移
2. r2 -q -c 'aaa; axt @ 0xOFFSET' 找引用代码
3. 从引用代码反汇编上下文，理解验证逻辑
4. 识别：请求构造 → 服务器通信 → 响应解析 → 签名验证 → 结果分支
```

#### 典型验证函数特征

| 特征 | 说明 |
|------|------|
| RSA 公钥加载 | `adrp x1, key_addr; bl PEM_load` |
| HTTP POST 构造 | `Content-Type: application/x-www-form-urlencoded` |
| JSON 解析 | nlohmann/json (`"token"`, `"expire"`, `"sign"`) |
| 签名验证 | `RSA_verify` 或自定义验证函数 |
| 结果分支 | `tbz w0, #0, fail_label` / `cbz w0, fail_label` |

### 第三步：绕过方案选择

#### 方案 A：配置文件/偏移文件劫持（最简单）

**原理**：程序读取本地配置文件决定是否跳过验证。

```bash
# 找配置文件路径
rafind2 -s ".json" target
rafind2 -s ".card" target
rafind2 -s ".txt" target
rafind2 -s "config" target
rafind2 -s "offset" target

# 分析配置文件格式（看 sscanf/fscanf 的格式字符串）
rafind2 -s "%llx" target
rafind2 -s "%s" target
rafind2 -s "%d" target
```

**常见绕过**：
- 写入 `offset.txt` 使 bit 0 = 1（跳过验证分支）
- 写入伪造的 config.json（包含有效 token）
- 创建空的 license 文件

#### 方案 B：二进制 Patch（确定性绕过）

**原理**：NOP 掉验证分支跳转，或改为无条件跳转。

```
# 在 r2 中 patch
r2 -q -c '
s 0xADDR_OF_BRANCH;    # 跳转指令地址
wao nop;               # NOP 掉
w -                    # 保存
' target

# 常见 patch 模式：
# tbz w0, #0, fail  → nop        (强制通过)
# b.ne fail          → nop        (强制通过)
# cbz w0, fail       → nop        (强制通过)
# bl RSA_verify      → mov w0, 1  (强制返回成功)
```

**在 IDA 中 patch**：
1. 找到验证分支地址
2. Edit → Patch program → Assemble
3. 输入 `nop` 或 `mov w0, #1`

#### 方案 C：Frida Hook（动态绕过）

```javascript
// Hook RSA 验证函数
// Frida 17.x API: 先 getModuleByName 再 getExportByName
const rsaModule = Process.getModuleByName("libcrypto.so");
Interceptor.attach(rsaModule.getExportByName("RSA_verify"), {
    onLeave: function(retval) {
        retval.replace(1);  // 强制返回验证成功
    }
});

// Hook HTTP 请求构造
Interceptor.attach(ptr("0xADDR"), {
    onEnter: function(args) {
        // 修改请求参数或拦截请求
    }
});

// Hook 结果检查函数
Interceptor.attach(ptr("0xVERIFY_FUNC"), {
    onLeave: function(retval) {
        retval.replace(1);  // 强制返回成功
    }
});
```

#### 方案 D：本地代理劫持（中间人）

**原理**：拦截对验证服务器的请求，返回伪造的成功响应。

```python
# 伪代码
from mitmproxy import http

def response(flow: http.HTTPFlow):
    if "verification-server.com" in flow.request.pretty_url:
        flow.response = http.Response.make(
            200,
            '{"status":1,"token":"...","expire":"2099-12-31","sign":"..."}',
            {"Content-Type": "application/json"}
        )
```

配合 `/etc/hosts` 或 iptables 将验证域名指向本地。

### 第四步：验证绕过效果

```bash
# 1. 运行目标程序，观察是否跳过验证
# 2. 检查功能是否正常激活
# 3. 如果有时间限制，验证是否仍然生效
```

## 关键地址记录格式

分析完成后，记录以下信息供后续使用。以下是一个真实案例的记录示例（来自 bt 内核卡密验证绕过）：

```
目标文件: lib/arm64-v8a/libsec.so
架构: ARM64
验证服务器: https://api.bt.cn/api/v1/license/check
RSA 公钥偏移: 0x4A230 (PEM 格式, BEGIN PUBLIC KEY)
验证函数地址: 0x401200 (verify_license)
分支跳转地址: 0x401234 (tbnz w8, #0, 0x401300 → 改为 b 0x401300)
配置文件路径: /www/server/panel/config/config.json
请求参数: token, imei, device_id, timestamp
响应格式: JSON {status: 1, token: "...", expire: 1234567890, sign: "RSA签名"}
```

> 分析新目标时，将上述示例替换为实际值。每个字段必须来自工具输出（IDA 反汇编、r2 字符串搜索、网络抓包），禁止凭推测填写。

## 实战案例

详细案例分析见 `bypass-case-bt-kami.md`（Android ARM64 宝塔内核卡密验证绕过），涵盖：
- RSA-1024 签名验证的完整调用链追踪
- 条件分支 patch vs 函数体 patch 的风险对比
- bl 指令编码错误导致 Bus error 的诊断
- x8 寄存器在函数入口 vs 内部的值变化陷阱

## 已知陷阱

1. **RSA 公钥可能是 RSA-1024（弱密钥）**：可以尝试因式分解
2. **验证可能有两层**：外层检查 HTTP 状态码，内层检查 RSA 签名，都要绕过
3. **配置文件可能有 checksum**：修改后需要更新校验值
4. **二进制可能有 anti-tamper**：修改后校验自身哈希，需要 patch 校验逻辑
5. **offset 文件的 bit 0 语义**：不同程序含义不同，需要通过反汇编确认
6. **⚠️ ARM64 bl 编码差 1 条指令 = Bus error**：手动构造 `bl` 补丁时，imm26 偏移计算必须精确到指令级。差 1 条指令（4 字节）会跳到指令中间，导致 Bus error。修复方法：用 Python 验证 `bl` 编码 — 读取补丁字节，解码 imm26，计算目标地址，确认等于预期函数入口。示例：
   ```python
   import struct
   bl_bytes = patch[bl_offset:bl_offset+4]
   val = struct.unpack('<I', bl_bytes)[0]
   imm26 = val & 0x3FFFFFF
   if imm26 & (1<<25): imm26 -= (1<<26)
   target = patch_addr + imm26 * 4
   assert target == expected_func_addr, f"bl 目标错误: {hex(target)} != {hex(expected_func_addr)}"
   ```
7. **⚠️ 函数替换补丁的调用约定**：替换整个验证函数时，必须确认调用者如何传参（x0-x7）和读取返回值。典型模式：调用者用 `x8` 传结构体指针，补丁需要 `mov x9, x8; ...; strb w0, [x9]` 设置结果标志位。不确认调用约定就写补丁会导致静默错误或崩溃。

8. **⚠️ 不要替换验证函数，改 patch 调用者的分支**：当验证函数有复杂内部逻辑（stack canary、多层调用、结构体初始化）时，替换函数体极其脆弱。正确做法是找到调用者中的条件分支（`tbnz`/`tbz`/`cbz`/`cbnz`），将其改为无条件跳转（`b`），跳过验证函数调用。这比修改验证函数本身安全得多，因为不需要理解函数内部的调用约定和结构体布局。实例：v3 补丁替换 `fcn.00eb0254` 导致 Segfault（x8 被 canary 覆盖不是结构体指针），v4 改为 patch 调用者的 2 条 `tbnz`/`tbz` 分支为 `b`，完美绕过。

9. **⚠️ ARM64 条件分支转无条件跳转编码**：将 `tbnz`/`tbz` 改为无条件 `b` 时，需要计算正确的 imm26 偏移。编码公式：`encoding = (0x5 << 26) | ((target - addr) // 4 & 0x3FFFFFF)`。验证方法：用 Python 读取补丁字节，解码 imm26，计算目标地址确认等于预期。不要凭直觉计算偏移——差 1 条指令就会崩溃。
8. **⚠️ Windows Python 路径陷阱**：`execute_code` 用 Windows Python（`C:/` 路径），`terminal` 用 git-bash（`/tmp/` 路径）。在 `execute_code` 中读取文件时，用 Windows 绝对路径（如 `C:/Users/Administrator/Downloads/target.exe`），不要用 `/tmp/`。验证补丁时，在 `terminal` 中用 `r2 -q -c "pd N @ ADDR" patched_file` 确认反汇编结果。

## 补丁验证清单

完成补丁后，**必须**执行以下验证步骤：

```bash
# 1. ELF 完整性检查
file patched_file          # 确认仍是有效 ELF
md5sum original patched    # 确认只有补丁区域变化

# 2. 补丁指令反汇编验证
r2 -q -c "pd N @ PATCH_ADDR" patched_file  # 逐条确认指令正确

# 3. bl 编码验证（如有 bl 指令）
python3 -c "
import struct
data = open('patched_file','rb').read()
for bl_offset in [0x10]:  # bl 在补丁中的偏移
    addr = PATCH_ADDR + bl_offset
    val = struct.unpack_from('<I', data, addr)[0]
    imm26 = val & 0x3FFFFFF
    if imm26 & (1<<25): imm26 -= (1<<26)
    target = addr + imm26 * 4
    print(f'bl @ {hex(addr)}: target={hex(target)}')
"

# 4. 在 Android 设备上测试运行
adb push patched_file /data/local/tmp/
adb shell chmod +x /data/local/tmp/patched_file
adb shell /data/local/tmp/patched_file
```
