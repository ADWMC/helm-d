# Anti-Frida DLL 绕过的替代方案

当 DLL 有强反调试/反 Frida 机制时，反复 attach 会导致进程崩溃。本文档总结绕过 Frida 检测的替代分析路径。

## 识别信号

| 特征 | 说明 |
|------|------|
| attach 成功但端口立即消失 | DLL 加载后因反调试崩溃，内嵌 HTTP 服务器（如 9090）停止监听 |
| 循环重启有效 | 关 loader → 开 → attach → DLL 崩溃 → 再开 → attach → 又崩溃 |
| 全量 hook 比 minimal 崩溃更快 | TypeScript TypeError 累积 + 更多监控点触发反调试 |
| VirtualAllocEx 返回 ACCESS_DENIED | `Failed to attach: unexpected error allocating memory` |
| DLL 在内存中不稳定 | loader 可能随时卸载/重载 DLL |

**网易云 future.exe 案例**：64MB PE，.rsrc 节占 64.5MB，注入 cloudmusic.exe，反调试在 DLL 加载时即生效（不是特定 hook 触发），所有 Frida attach 均失败。

**立即决策**：2-3次失败后立即切换，不要继续尝试变体 hook。

## 三种替代方案（按优先级）

### 1. Win32 API 只读内存扫描（Python）

不触发反调试，用 `PROCESS_VM_READ` 权限 `OpenProcess` 后直接读内存：

```python
import ctypes, ctypes.wintypes, struct

k32 = ctypes.windll.kernel32

PROCESS_QUERY_INFORMATION = 0x0400
PROCESS_VM_READ = 0x0010

hProcess = k32.OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, False, pid)

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
        if buf[0] == 0x08 and buf[1] == 0x00:
            print(f"ONNX at 0x{mbi.BaseAddress:x}, size={mbi.RegionSize}")
    address = mbi.BaseAddress + mbi.RegionSize
k32.CloseHandle(hProcess)
```

**优点**：完全静默，反调试难以检测
**限制**：只能读已提交内存，无法追踪解密流程；需要解密时模型已在内存中

### 2. 静态资源提取（纯 Python）

从 loader 的 PE 资源节（.rsrc）提取加密 payload，不运行目标程序。

```python
import struct

with open('loader.exe', 'rb') as f:
    data = f.read()

# 1. 定位 .rsrc 节
pe_offset = struct.unpack_from('<I', data, 0x3C)[0]
num_sections = struct.unpack_from('<H', data, pe_offset + 6)[0]
opt_hdr_size = struct.unpack_from('<H', data, pe_offset + 20)[0]
section_table = pe_offset + 24 + opt_hdr_size

for i in range(num_sections):
    off = section_table + i * 40
    name = data[off:off+8].rstrip(b'\x00').decode('ascii', 'ignore')
    if name == '.rsrc':
        rsrc_vaddr = struct.unpack_from('<I', data, off+12)[0]
        rsrc_size = struct.unpack_from('<I', data, off+16)[0]
        rsrc_off = struct.unpack_from('<I', data, off+20)[0]
        break

rsrc_data = data[rsrc_off:rsrc_off+rsrc_size]

# 2. 解析三级资源目录（Type → Name → Language）
# 见主 skill references/pe-loader-dll-injection.md

# 3. 提取每个 RCDATA 资源的 (RVA, Size, 前16字节)
#    根据熵值判断内容：>7.9=强加密, 7.0-7.9=弱加密/压缩, 包含字符串=配置
```

**优点**：完全离线，不触发任何保护
**限制**：只能拿到加密数据，无法获取解密密钥

### 3. 条件竞争 + Stalker

在 DLL 加载但反调试代码执行前的窗口期进行追踪（成功率最低）：

```javascript
Process.addModuleLoadListener(function(mod) {
    if (mod.path.indexOf("GH_Rec") !== -1) {
        // 立即 Stalker.follow（不使用 Interceptor.attach）
        Stalker.follow(Process.getCurrentThreadId(), {
            transform: function(iterator) { ... }
        });
    }
});
```

**问题**：Stalker 本身的执行开销也会被反调试检测。

## 多次 Frida 失败后的止损点

```
尝试 1: minimal hook（只 hook 2-3 个函数）
  → 进程崩溃
尝试 2: 全量 hook（验证不是某个特定 hook 触发）
  → 进程崩溃更快（TypeError 累积）
尝试 3: 最小化脚本（只读 DLL 基址，不 attach）
  → 如果这个也崩溃 → 确定是反 Frida

立即停止，切换到：
  1. Win32 API 只读扫描
  2. 静态资源提取
  3. 告知用户无法绕过（需要 IDA 静态分析 loader）
```

## 扩展：已知明文分析无效的情况

如果 XOR 加密的 ciphertext[0:16] XOR 期望明文(ONNX 0x08 0x00 ...) 得到的"密钥"重复 XOR 后数据 entropy 仍然 >7.8，说明：
- 期望明文不对（ONNX 头部不是 0x08 0x00 0x00...）
- 或加密不是简单 XOR（可能是 AES-CTR + 随机 nonce）

**验证方法**：
- XOR 解密后 entropy 7.86（高）→ 不是真正的 ONNX
- 真正的 ONNX 模型 entropy 应 < 6.0（大量结构化重复）

此时不要用已知 plaintext 方法，转向：
- 搜索抓包中模型加载的 API 调用
- 长期路线：静态逆向 loader 找真正解密算法

## Android ARM64 Shellcode 反 Frida

当目标是 Android ARM64 ELF 且使用**直接系统调用** (svc #0) 时，所有 libc hook 均无效。详细分析方法、检测链、绕过策略见 `android-arm64-shellcode-analysis.md`。

**关键教训**:
- 反分析检测和解密逻辑可能交织在同一执行路径中，不能简单 NOP 掉反分析分支
- Frida 17.x Android 上 `Module.findExportByName` 不可用，必须用 `enumerateExports` 遍历
- `/memfd:frida-agent-64.so` 会出现在目标进程的 maps 中，重命名 frida-server 不够
- 进程可能在 <100ms 内退出，shell 脚本的 `/proc/PID/mem` dump 来不及执行
- 用 `tcpdump` 抓取 C2 通信可获取密钥材料用于离线解密
- 注入工具的 gadget 库（`libgadget.so`）也包含 "gadget" 字符串，同样会被检测
- 详细的绕过策略实验记录和卡密保护模式见 `android-arm64-shellcode-analysis.md`
