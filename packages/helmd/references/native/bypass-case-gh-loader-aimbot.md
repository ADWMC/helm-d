# 案例：GH_Loader DLL 注入器卡密绕过（Windows PE）

> 来源实战：网易云 future.exe + 驱动.exe，Windows PE32+ x86-64
> 日期：2026-07-07/08
> 工具链：radare2 + Python Capstone + Frida 17.x
> 架构：x86-64, PE32+, DLL injection, embedded HTTP server

---

## 一、目标特征

```
Loader:  PE32+ GUI, 64.8MB, 7 sections, .rsrc=64.5MB
DLL:     PE32+ DLL, 22.8MB (解密后), 11 sections, 字符串全部加密
保护:    自定义 XOR + AES-256, 节名随机化(.zL6, .=\i, .XFQ)
目标:    cloudmusic.exe (网易云音乐)
功能:    AI 自瞄辅助 (YOLOv8, D3D12 overlay, Makcu 硬件鼠标控制)
```

---

## 二、架构分析

### Loader (future.exe)

```
执行流程:
  1. 枚举 cloudmusic.exe 进程
  2. 从 .rsrc 提取 RCDATA/100 (21.77MB, XOR 加密 DLL)
  3. 从 .rsrc 提取 RCDATA/101 (42.61MB, 含 256.aes + 320.aes)
  4. 解密 DLL → 写入 C:\ProgramData\GH_Rec_AIMBOT\bi_log_wrapper.dll
  5. 创建共享内存 (GH_AIMBOT_ResourceDir 环境变量)
  6. CreateRemoteThread → LoadLibraryW 注入
  7. 清理 DLL 文件 (force-delete / reboot-delete)
```

### 资源结构

| 资源 | 大小 | 内容 |
|------|------|------|
| RCDATA/100 | 21.77MB | XOR 加密的 DLL |
| RCDATA/101 | 42.61MB | 归档文件 (256.aes 21.3MB + 320.aes 21.3MB) |

### RCDATA/101 归档格式

```
[num_entries: 4 bytes]
For each entry:
  [name_len: 2 bytes]
  [name: name_len bytes, ASCII]
  [data_len: 4 bytes]
  [data: data_len bytes]
```

提取:
```python
# num_entries=2, entry0="256.aes"(21.3MB), entry1="320.aes"(21.3MB)
# 两个文件首16字节相同: 6b52da8e17a3db08080ae231f99f896a
# 熵 7.81/7.82 → AES-256 加密的 YOLO 模型文件
```

---

## 三、DLL 解密算法

### XOR 密钥提取

```python
# 从 Loader .rdata 段提取
key_part1 = bytes.fromhex('7ca818b81fa4db3de4d44565fa3400c8')  # 16 bytes @ 0x140036648
key_part2 = struct.pack('<Q', 0x99b3f18afc6642bc)               # 8 bytes constant
key_init = key_part1 + key_part2  # 24 bytes total
```

### 有状态 XOR 解密

```python
def decrypt(data, key_init):
    key = bytearray(key_init)
    result = bytearray(len(data))
    for i in range(len(data)):
        # 每字节变换所有 24 个密钥字节
        for j in range(24):
            key[j] = (0x25 - key[j] * 0x53) & 0xFF
        result[i] = data[i] ^ key[i % 24]
    return bytes(result)
```

**关键**: 这是**有状态** XOR — 每解密一个字节，密钥都会变化。不是简单重复 XOR。

### AVX/SSE 路径

```python
# AVX 路径 (CPU feature >= 6):
# multiplier = 0x53535353... (16 bytes)
# base = 0x25252525... (16 bytes)
# key[i] = base[i] - (multiplier[i] * initial_key[i])  # vpmullw + psubb
# 结果与标量路径相同
```

---

## 四、DLL 内嵌 HTTP 服务器

### 服务器架构

```
端口 9090: 主 HTTP 服务器 (配置面板 + API)
端口 20017: 辅助端口 (可能用于内部通信)

路由:
  GET  /              → 验证页 或 配置页 (根据 license flag)
  POST /api/verify    → 卡密验证
  POST /api/unbind    → 解绑设备
  GET  /api/config    → 获取配置 (需 license)
  GET  /api/models    → 获取模型列表
  POST /api/init_model → 加载模型
  GET  /api/bot_ready → 机器人就绪状态
```

### License 检查机制

```
页面路由:
  test al, al         ; al = license_check()
  je verify_page      ; al=0 → 验证页, al=1 → 配置页

API 路由:
  movzx eax, [license_flag]  ; 全局变量
  test al, al
  jne success_path            ; flag=1 → 处理请求
  ; fall-through → 返回 "Forbidden"
```

**关键发现**: License flag 是一个全局字节变量，通过 RIP-relative 寻址访问。

---

## 五、绕过方案

### 需要 Patch 的 3 个位置

| # | 偏移 | 原始 | 修改 | 作用 |
|---|------|------|------|------|
| 1 | +0x2334994 | `00` (invalid) | `01` (valid) | License 标志设为有效 |
| 2 | +0x4b1ac2 | `74 3c` (je) | `90 90` (NOP) | 页面路由跳过验证页 |
| 3 | +0x46f308 等5处 | `{"ok":false` | `{"ok":true ` | API 响应模板 |

### Frida 一键脚本

```javascript
var base = null;
Process.enumerateModules().forEach(function(m) {
    if (m.path.indexOf("GH_Rec_AIMBOT") !== -1) base = m.base;
});
if (!base) { console.log("[-] DLL not found"); } else {
    // 1. License flag -> 1
    Memory.patchCode(base.add(0x2334994), 1, function(p) { p.writeByteArray([1]); });
    // 2. Page routing NOP
    Memory.patchCode(base.add(0x4b1ac2), 2, function(p) { p.writeByteArray([0x90,0x90]); });
    // 3. ok:false -> ok:true
    for (var o = 0x460000; o < 0x480000; o++) {
        try {
            var a = base.add(o);
            if (a.readU8() === 0x7b) {
                var b = new Uint8Array(a.readByteArray(11));
                if (String.fromCharCode.apply(null,b) === '{"ok":false') {
                    Memory.patchCode(a.add(6),5,function(p){p.writeByteArray([0x74,0x72,0x75,0x65,0x20]);});
                }
            }
        } catch(e) {}
    }
    console.log("[*] Done!");
}
```

### License Flag 定位方法

```python
# 1. 找到 API 路由处理代码 (搜 /api/config 字符串的 LEA 引用)
# 2. 找到 movzx eax, byte ptr [rip+disp32] / test al, al / jne 模式
# 3. 计算目标地址: target = next_rip + disp32
# 4. 读取目标字节值

# 在 dump 中搜索:
for off in range(0x4b1000, 0x4b3000):
    if data[off] == 0x0f and data[off+1] == 0xb6 and data[off+2] == 0x05:
        disp = struct.unpack_from('<i', data, off+3)[0]
        target = off + 7 + disp
        val = data[target]
        print(f"+0x{off:x}: flag at +0x{target:x} = {val}")
```

---

## 六、关键教训

### 1. License flag 运行时值 ≠ dump 值

```
dump 中 flag=1 (之前 session 设置过)
运行时 flag=0 (新进程重新初始化)
→ 必须在运行时检查实际值，不能依赖 dump
→ Frida: flagAddr.readU8() 验证
```

### 2. 仅 patch 响应模板不够

```
Patch {"ok":false → {"ok":true 只改变 API 响应格式
但服务器内部 license 状态仍然是 invalid
→ 页面路由仍然返回验证页
→ API 端点仍然返回 Forbidden
→ 必须同时 patch license flag
```

### 3. 仅 patch 页面路由不够

```
NOP je (页面路由) 让配置页 HTML 能加载
但 JS fetch('/api/config') 仍然返回 Forbidden
→ 页面显示 "连接失败 - 请确认 DLL 已成功注入"
→ 必须同时 patch license flag
```

### 4. 直接系统调用 bypass

```
DLL 的 HTTP 服务器用直接系统调用发送响应
所有 socket API hook (send/WSASend/NtWriteFile) 都无反应
→ 放弃 API hook，改用 Memory.patchCode 直接改数据段
→ 参考 memory-patchcode-bypass.md
```

### 5. 多次 patch 导致服务器死锁

```
Patch test al,al → mov al,1 后服务器超时
原因: 成功路径需要 verify 函数填充的数据 (expires_at)
     verify 函数未执行 → 数据未填充 → 成功路径访问未初始化数据 → 死锁
→ 不要 patch 验证函数的返回值
→ 而是 patch license flag + 页面路由 + 响应模板
```

### 6. Packed DLL 分析策略

```
DLL sections: .text RSize=0, .data RSize=0
→ 代码/数据在磁盘上为空，运行时才解包
→ 不能用 r2/IDA 直接分析解密后的 DLL 文件
→ 用 Frida 从运行进程内存 dump
→ 分析 dump 文件找验证逻辑
→ 在运行时用 Memory.patchCode 应用 patch
```

### 7. PyInstaller 应用识别

```
特征: Tcl/Tk splash screen, _PYI_PARENT_PROCESS_LEVEL, MEI\x0c\x0b\x0a\x0b\x0e
分析: 搜索 PyInstaller magic，提取嵌入的 Python 脚本
注意: PyInstaller .exe 可能只是安装器，不是主程序
```

---

## 七、文件清单

| 文件 | 说明 |
|------|------|
| `netease_future.exe` | Loader (64.8MB PE) |
| `driver.exe` | PyInstaller 安装器 (71.2MB) |
| `gh_dll_dump.bin` | DLL 内存 dump (62.1MB) |
| `gh_full_bypass.js` | 一键 Frida 绕过脚本 |
| `gh_capture_key.js` | AES 密钥捕获 hook |
| `gh_rec/256.aes` | 加密 YOLO 模型 (256) |
| `gh_rec/320.aes` | 加密 YOLO 模型 (320) |
