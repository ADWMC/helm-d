# VMProtect PE + Frida 动态分析（Windows 桌面）

> 适用场景：VMP 加壳的 Windows PE 程序（`.winlice` + `.boot` 节），需要在 Windows 桌面机上动态分析。
> 与 `vmp-elf-protection.md`（ELF VMP 架构文档）互补，本文聚焦 **Windows + Frida 实战**。
> 本文档基于 Relink自动脑机7.2.2 (Qt6 + VMP3.x + 离线卡密验证) 实战验证。

## ⚠️ 前置条件：Windows Defender

**Windows Defender 会在 7 秒内拦截并隔离未知来源的 .exe。** 必须在分析前加排除：

```powershell
# 方法1: GUI（推荐）
# Windows 安全中心 → 病毒和威胁防护 → 管理设置 → 排除项 → 添加文件

# 方法2: 注册表（需要管理员权限）
python -c "
import winreg
key = winreg.CreateKeyEx(winreg.HKEY_LOCAL_MACHINE, r'SOFTWARE\Policies\Microsoft\Windows Defender\Real-Time Protection', 0, winreg.KEY_SET_VALUE)
winreg.SetValueEx(key, 'DisableRealtimeMonitoring', 0, winreg.REG_DWORD, 1)
winreg.CloseKey(key)
"

# 方法3: PowerShell（如果 Add-MpExclusion 可用）
Add-MpExclusion -Path 'C:\path\to\target.exe'
Add-MpExclusion -Path 'C:\x64dbg'
```

**不加排除就跑 = 进程 7 秒后退出码 33，或 Error 225 "文件包含病毒"。**

## 快速决策

```
拿到 VMP PE 后:
  1. 确认壳类型
     python -c "
     import struct
     with open('target.exe','rb') as f: data=f.read()
     pe=struct.unpack_from('<I',data,0x3C)[0]
     n=struct.unpack_from('<H',data,pe+6)[0]
     magic=struct.unpack_from('<H',data,pe+0x18)[0]
     off=pe+0x18+(0xF0 if magic==0x20b else 0xE0)
     for i in range(n):
         s=data[off+i*40:off+i*40+8].rstrip(b'\x00').decode('ascii','ignore')
         if s in ('.winlice','.boot','.vmp0','.vmp1'):
             print(f'VMP: {s}')
     "
     → 有 `.winlice` + `.boot` = VMP3.x

  2. 判断验证类型
     启动程序 → 有 GUI 登录框？
     → 有：用 pywinauto UIA 交互（见下方）
     → 无：看 netstat 是否有外部连接

  3. 网络 vs 离线
     先 ipconfig /flushdns
     触发一次验证
     netstat -ano | findstr <PID>
     ipconfig /displaydns
     → 有外部连接 → 重点抓包分析
     → 无外部连接 → 离线验证，需要逆向算法或 patch

  4. 如果验证是离线的
     → Frida 内存扫描找验证字符串（见下方）
     → x64dbg 内存断点追溯验证函数
     → 或搜索社区已有 dump
```

## VMP 对 Frida 的影响

### 直接系统调用确认

**Frida API hook 对 VMP 完全无效（已验证）。** 以下 hook 全部 0 行日志：
- kernel32.dll: CreateFileW, VirtualProtect, LoadLibrary
- wininet.dll: InternetConnect, HttpSendRequest
- ws2_32.dll: connect, send, recv
- dnsapi.dll: DnsQuery_A, DnsQuery_W, DnsQueryEx

**但 Nt* 导出 hook 有效（已验证）。** 通过 `enumerateExports()` + `Interceptor.attach` 可以 hook：
- NtDeviceIoControlFile — 捕获 DNS 查询（ioctl 0x12000f）和 TCP 连接
- NtProtectVirtualMemory — 监控 VMP 解包时的内存权限变更
- NtAllocateVirtualMemory — 监控内存分配
- NtQueryInformationProcess — 反调试绕过
- NtCreateFile — 文件操作（需要解析 OBJECT_ATTRIBUTES 结构）
- NtCreateSection / NtMapViewOfSection — DLL 加载

**关键发现：** VMP 的直接系统调用仍然经过 ntdll 的导出函数 stub（`mov r10,rcx; mov eax,syscallnum; test byte [...],1; syscall`），所以 ntdll 导出级 hook 能捕获到。只有绕过 ntdll 导出的纯 `syscall` 指令级调用才无法 hook。

### Nt* 导出 hook 实战模板

```javascript
// 找所有 Nt* 导出（不依赖 Module.findExportByName）
var ntExports = {};
Process.findModuleByName('ntdll.dll').enumerateExports().forEach(function(e) {
    if (e.name && e.name.startsWith('Nt') && e.type === 'function') {
        ntExports[e.name] = e.address;
    }
});

// Hook NtDeviceIoControlFile 捕获网络活动
var ndioc = ntExports['NtDeviceIoControlFile'];
if (ndioc) {
    Interceptor.attach(ndioc, {
        onEnter(args) {
            this.handle = args[0];
            this.ioctl = args[5].toInt32();
            this.inBuf = args[6];
            this.inLen = args[7].toInt32();
        },
        onLeave(retval) {
            if (this.ioctl === 0x12000f) {
                // DNS 查询 — 但缓冲区格式不是标准 DNS，是 Windows DNS Client 内部结构
                send('[DNS-QUERY] handle=0x' + this.handle.toString(16));
            }
            if (this.ioctl === 0x120007) {
                // TDI_CONNECT — TCP 连接
                try {
                    var buf = this.inBuf.readByteArray(Math.min(32, this.inLen));
                    var arr = new Uint8Array(buf);
                    if (arr.length >= 8) {
                        var port = (arr[2] << 8) | arr[3];
                        var ip = arr[4] + '.' + arr[5] + '.' + arr[6] + '.' + arr[7];
                        send('[TCP-CONNECT] ' + ip + ':' + port);
                    }
                } catch(e) {}
            }
        }
    });
}
```

### 判断网络 vs 离线（已验证方法）

```bash

| 方式 | 结果 |
|------|------|
| `frida.spawn()` | ✅ 进程在 VMP 初始化前暂停，hook 可以加载 |
| `frida.attach()` 已运行进程 | ❌ VMP 反调试检测 → 进程直接退出 (returncode=-1) |

**结论：** 必须用 `frida.spawn()`，不能 attach 已运行的进程。

### 反调试绕过（Frida 17.x 兼容写法）

**⚠️ Frida 17.x 关键 API 变更：`Module.findExportByName()` 和 `Memory.readByteArray()` 在 Windows 上会抛 `TypeError: not a function`。** 必须用 `module.enumerateExports()` 遍历替代。

```javascript
// ❌ Frida 17.x 上报 TypeError: not a function
var addr = Module.findExportByName('ntdll.dll', 'NtQueryInformationProcess');

// ✅ 正确写法：用 enumerateExports
var ntQIP = null;
Process.findModuleByName('ntdll.dll').enumerateExports().forEach(function(e) {
    if (e.name === 'NtQueryInformationProcess') ntQIP = e.address;
});

// ❌ Frida 17.x 上报 TypeError: not a function
var buf = Memory.readByteArray(address, size);
var arr = new Uint8Array(buf); // 失败

// ✅ 正确写法：用 readU8 逐字节读取
var byte = address.add(offset).readU8();
```

反调试 hook（用 enumerateExports 写法）：

```javascript
var ntQIP = null;
Process.findModuleByName('ntdll.dll').enumerateExports().forEach(function(e) {
    if (e.name === 'NtQueryInformationProcess') ntQIP = e.address;
});
if (ntQIP) {
    Interceptor.attach(ntQIP, {
        onEnter(args) {
            this.cls = args[1].toInt32();
            this.info = args[2];
        },
        onLeave(retval) {
            if (this.cls === 7) { this.info.writeU32(0); }           // ProcessDebugPort
            if (this.cls === 0x1E) { retval.replace(0xC0000353); }   // ProcessDebugObjectHandle
            if (this.cls === 0x1F) { this.info.writeU32(1); }        // ProcessDebugFlags
        }
    });
}
```

**注意：不要 hook 太多函数。** 每个 hook 的 `TypeError` 都会累积，超过 10-15 个 hook 会导致 GUI 不出现或进程崩溃。只 hook 必需的函数（反调试 + 目标分析）。

## Qt6 GUI 交互（关键突破点）

### 问题：Qt6 不响应 Win32 模拟输入

| 方法 | Qt6 响应？ |
|------|-----------|
| `WM_CHAR` 消息 | ❌ |
| `SendInput` (硬件级) | ❌ |
| `keybd_event` | ❌ |
| `mouse_event` | ❌ |
| 剪贴板 + Ctrl+V | ❌ |
| **pywinauto UIA backend** | ✅ |

### 解决方案：pywinauto + UIA

```python
pip install pywinauto comtypes

from pywinauto import Desktop

# 连接已运行的 Qt 窗口
desktop = Desktop(backend='uia')
login = desktop.window(title='登录')  # 窗口标题

# 打印控件树（找到 auto_id）
login.print_control_identifiers()

# 操作 Edit 控件
edit = login.child_window(auto_id='QApplication.LoginClass.key_edit', control_type='Edit')
edit.click_input()
edit.set_edit_text('test1234')
print(edit.get_value())  # 验证输入

# 点击 Button
btn = login.child_window(auto_id='QApplication.LoginClass.login_button', control_type='Button')
btn.click_input()
```

**关键点：**
- Qt6 的 UIA 接口暴露了 `auto_id`（格式：`QApplication.<ClassName>.<widget_name>`）
- `print_control_identifiers()` 是发现控件结构的唯一可靠方法
- 不要用窗口句柄 + 坐标点击，Qt6 不响应

### 找窗口标题

```python
# 列出所有窗口
for w in Desktop(backend='uia').windows():
    try:
        title = w.window_text()
        if title: print(f'  "{title}" class={w.class_name()}')
    except: pass
```

## 离线验证的内存分析

### 步骤 1：扫描验证字符串

VMP 加密了代码，但 **UI 字符串（错误消息等）在运行时必须解密到内存** 才能显示。

```javascript
// Frida 脚本：扫描 UTF-16LE 中文字符串
setTimeout(function() {
    Process.enumerateRanges('r--').forEach(function(range) {
        if (range.size === 0 || range.size > 200*1024*1024) return;
        try {
            var buf = Memory.readByteArray(range.base, range.size);
            var bytes = new Uint8Array(buf);
            for (var i = 0; i < bytes.length - 3; i += 2) {
                var ch = bytes[i] | (bytes[i+1] << 8);
                if (ch >= 0x4E00 && ch <= 0x9FFF) {
                    var str = '', j = i;
                    while (j < bytes.length - 1) {
                        var c = bytes[j] | (bytes[j+1] << 8);
                        if ((c >= 0x4E00 && c <= 0x9FFF) || (c >= 0x3000 && c <= 0x303F) ||
                            (c >= 0xFF00 && c <= 0xFFEF) || (c >= 0x0020 && c <= 0x007E)) {
                            str += String.fromCharCode(c); j += 2;
                        } else break;
                    }
                    if (str.length >= 3) {
                        send('[FOUND] 0x' + range.base.add(i).toString(16) + ': ' + str);
                    }
                    i = j;
                }
            }
        } catch(e) {}
    });
}, 8000); // 等待 VMP 解包
```

### 步骤 2：确定验证类型

```
触发验证 → 观察错误消息：
  "卡密不存在" → 本地数据库/算法校验
  "卡密已过期" → 有时间戳校验
  "网络错误"/"连接失败" → 有网络组件（但可能被防火墙拦截）
  无消息直接关闭 → 可能在等服务端响应
```

### 步骤 3：判断网络 vs 离线

```bash
# 清 DNS 缓存
ipconfig /flushdns

# 触发验证后检查
netstat -ano | findstr <PID>     # 有无 ESTABLISHED/SYN_SENT
ipconfig /displaydns              # 有无新的 DNS 记录
```

**注意：** `netstat -ano` 显示的 TIME_WAIT 连接是历史残留，不算。只看 ESTABLISHED 和 SYN_SENT。

### 步骤 4：离线验证 → x64dbg 深入

如果确认是离线验证，Frida hook 无效（VMP 直接系统调用），需要 x64dbg：

1. 启动 x64dbg → 附加进程
2. 在验证字符串地址（如 `0x143ea2644`）下 **内存访问断点**
3. 触发登录
4. 命中断点 → 回溯调用栈 → 定位验证函数
5. 分析验证算法

## 常见陷阱

| 问题 | 原因 | 解决 |
|------|------|------|
| Frida hook 全部 0 行日志 | VMP 直接系统调用绕过 API hook | 不要反复换 hook 目标，转 Nt* 导出 hook 或其他方案 |
| `frida.attach()` 后进程消失 | VMP 反调试检测 | 必须用 `frida.spawn()` |
| Frida 17.x 报 `TypeError: not a function` | `Module.findExportByName` 和 `Memory.readByteArray` 在 17.x 不可用 | 用 `enumerateExports()` 遍历 + `readU8()` 逐字节读取 |
| Qt6 窗口不响应 SendInput/WmChar | Qt6 自绘控件，不使用 Win32 消息 | 用 pywinauto UIA backend |
| `pywinauto.print_control_identifiers()` 报错 | 没装 comtypes | `pip install comtypes` |
| netstat 看到大量 TIME_WAIT 到某端口 | 历史残留，不是当前连接 | 只看 ESTABLISHED/SYN_SENT |
| 内存扫描找不到中文字符串 | 扫描太早，VMP 还没解包 | setTimeout 等 10-12 秒再扫（8 秒不够） |
| `python3` 在 git-bash 下报错 | MSYS shim 问题 | 统一用 `python` |
| 进程 7 秒后退出码 33 | Windows Defender 拦截 | 分析前加 Defender 排除（见前置条件） |
| Error 225 "文件包含病毒" | Windows Defender 实时保护 | 关闭实时保护或加排除 |
| hook 太多导致 GUI 不出现 | 每个 TypeError 累积导致进程异常 | 只 hook 必需函数（反调试 + 1-2 个分析目标），不超过 10 个 |
| ScyllaHide x64dbg 插件对 VMP 无效 | VMP 检测更深层 | 用 ScyllaHide CLI 注入器（`InjectorCLIx64.exe`）在进程创建前注入 |
| x64dbg 附加 VMP 进程失败 | VMP 反调试检测 | 先用 ScyllaHide CLI 注入，再附加；或放弃 x64dbg 走纯 Frida 方案 |
| Windows Defender Add-MpExclusion 不可用 | PowerShell 模块未加载 | 用注册表或 GUI 方式加排除 |

## x64dbg + MCP 集成（可选）

当 Frida 方案不够用时，可以用 x64dbg 通过 MCP 协议远程控制。

### 安装

```bash
# 1. 下载 x64dbg snapshot
# https://github.com/x64dbg/x64dbg/releases → snapshot_*.zip
# 解压到 C:\x64dbg\release\

# 2. 下载 MCP 插件
# https://github.com/SetsunaYukiOvO/x64dbg-mcp/releases
# x64dbg_mcp.dp64 → C:\x64dbg\release\x64\plugins\

# 3. 下载 ScyllaHide
# https://github.com/x64dbg/ScyllaHide/releases
# ScyllaHideX64DBGPlugin.dp64 + HookLibraryx64.dll → C:\x64dbg\release\x64\plugins\
# scylla_hide.ini → C:\x64dbg\release\x64\
```

### MCP 配置

```json
// C:\x64dbg\release\x64\plugins\x64dbg-mcp\config.json
{
  "server": { "address": "127.0.0.1", "port": 3000 },
  "permissions": {
    "allow_memory_write": true,
    "allow_register_write": true,
    "allow_script_execution": true,
    "allow_breakpoint_modification": true
  },
  "features": {
    "auto_start_mcp_on_plugin_load": true
  }
}
```

### MCP 使用

```bash
# 检查 MCP 是否在线
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# 列出可用工具
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"debug_get_state","arguments":{}}}'

# 附加到进程
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"debug_attach_pid","arguments":{"pid":1234}}}'
```

### VMP + x64dbg 的问题

VMP 检测 x64dbg 即使用 ScyllaHide。已验证：
- ScyllaHide x64dbg 插件启用后仍然被检测
- ScyllaHide CLI 注入器（`InjectorCLIx64.exe pid:<PID> HookLibraryx64.dll`）可以成功注入，但 x64dbg 附加仍然失败
- x64dbg 的 `debug_run` 命令会导致 VMP 检测到调试器后 crash（RIP=0x0）

**结论：对于 VMP3.x 保护的程序，x64dbg 方案基本不可行，应走纯 Frida 方案。**

## 工具依赖

```bash
pip install frida-tools pywinauto comtypes psutil
```

## 相关资源
- `vmp-pe-frida-windows.md` — **PE VMP 实战（重点）**：Frida 17.x 兼容写法、Nt* 导出 hook、Windows Defender 排除、x64dbg MCP 集成
- `vmp-elf-protection.md` — ELF VMP 架构（Unicorn + ChaCha20）
- `bypass-case-bt-kami.md` — 普通 UPX 卡密绕过案例
- `bypass-case-tusi-netease.md` — TUSI 定制壳案例
- `bypass-case-cpu-render-shellcode.md` — shellcode 型验证案例
