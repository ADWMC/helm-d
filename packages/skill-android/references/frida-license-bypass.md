# Frida 动态分析：卡密验证绕过

当静态分析受阻（字符串加密、代码混淆、VMP 保护）时，用 Frida hook API + 内存扫描提取验证逻辑。

## 工作流

```
1. 枚举加载模块 → 找到注入/目标 DLL
2. Hook 关键 API → 拦截网络/加密/文件操作
3. 内存扫描 → 提取加密字符串、验证逻辑、HTML UI
4. Patch 验证函数 → 跳过卡密检查
```

## Step 1: 枚举模块

```javascript
// 找到注入的 DLL（非系统 DLL）
var modules = Process.enumerateModules();
for (var i = 0; i < modules.length; i++) {
    var m = modules[i];
    var name = m.name.toLowerCase();
    // 跳过系统 DLL
    if (name.indexOf("api-ms-win") !== -1) continue;
    if (name.indexOf("kernel32") !== -1) continue;
    // ... 更多系统 DLL 过滤
    console.log(m.name + " @ " + m.base + " size=0x" + m.size.toString(16) + " path=" + m.path);
}
```

注入 DLL 特征：
- 路径在非标准位置（如 `C:\ProgramData\`、`%TEMP%`）
- 大小异常（>5MB 通常是 payload）
- 同名 DLL 有两个实例（原始 + 注入）

## Step 2: Hook 关键 API

### 网络通信（WinHTTP / WinINet / Socket）

```javascript
// WinHTTP - 最常见的卡密验证通道
var winhttp_apis = ["WinHttpOpen", "WinHttpConnect", "WinHttpOpenRequest", 
                    "WinHttpSendRequest", "WinHttpReadData", "WinHttpCrackUrl"];
winhttp_apis.forEach(function(name) {
    var addr = Module.findExportByName("winhttp.dll", name);
    if (addr) {
        Interceptor.attach(addr, {
            onEnter: function(args) {
                if (name === "WinHttpConnect") {
                    console.log("[NET] Server: " + args[1].readUtf16String() + ":" + args[2].toInt32());
                } else if (name === "WinHttpOpenRequest") {
                    console.log("[NET] " + args[1].readUtf16String() + " " + args[2].readUtf16String());
                } else if (name === "WinHttpCrackUrl") {
                    console.log("[NET] URL: " + args[0].readUtf16String());
                }
            }
        });
    }
});

// 原始 socket（某些工具用 raw socket 而非 HTTP API）
["connect", "send", "recv"].forEach(function(name) {
    var addr = Module.findExportByName("ws2_32.dll", name);
    if (addr) {
        Interceptor.attach(addr, {
            onEnter: function(args) {
                console.log("[SOCK] " + name + " called from " + this.returnAddress);
            }
        });
    }
});
```

### 加密 API

```javascript
// CryptCreateHash - 哈希算法识别
Interceptor.attach(Module.findExportByName("advapi32.dll", "CryptCreateHash"), {
    onEnter: function(args) {
        var algo = {0x8003:"MD5", 0x8004:"SHA1", 0x800c:"SHA256", 0x800d:"SHA384", 0x800e:"SHA512"};
        console.log("[CRYPT] Hash: " + (algo[args[1].toInt32()] || "0x" + args[1].toInt32().toString(16)));
    }
});
```

### HWID 采集

```javascript
// 网卡 MAC 地址
Interceptor.attach(Module.findExportByName("iphlpapi.dll", "GetAdaptersInfo"), {
    onEnter: function(args) { console.log("[HWID] GetAdaptersInfo"); }
});

// HID 设备
Interceptor.attach(Module.findExportByName("hid.dll", "HidD_GetHidGuid"), {
    onEnter: function(args) { console.log("[HWID] HidD_GetHidGuid"); }
});

// 磁盘序列号
Interceptor.attach(Module.findExportByName("kernel32.dll", "GetVolumeInformationW"), {
    onEnter: function(args) { console.log("[HWID] GetVolumeInformationW"); }
});
```

### 文件操作（license.dat / config.yaml）

```javascript
Interceptor.attach(Module.findExportByName("kernel32.dll", "CreateFileW"), {
    onEnter: function(args) {
        var path = args[0].readUtf16String();
        if (path.indexOf("license") !== -1 || path.indexOf("config") !== -1 || 
            path.indexOf(".dat") !== -1 || path.indexOf(".yaml") !== -1) {
            console.log("[FILE] " + path);
        }
    }
});
```

## Step 3: 内存扫描（核心技巧）

当字符串全部加密时，运行时内存中会有解密后的明文。

### 扫描关键词

```javascript
function scanMemory(base, size, patterns) {
    var chunkSize = 4096;
    for (var off = 0; off < size; off += chunkSize) {
        try {
            var chunk = base.add(off).readByteArray(chunkSize);
            var view = new Uint8Array(chunk);
            var str = "", strStart = -1;
            for (var j = 0; j < view.length; j++) {
                if (view[j] >= 0x20 && view[j] < 0x7f) {
                    if (strStart === -1) strStart = j;
                    str += String.fromCharCode(view[j]);
                } else {
                    if (str.length >= 6) {
                        var lower = str.toLowerCase();
                        for (var p = 0; p < patterns.length; p++) {
                            if (lower.indexOf(patterns[p].toLowerCase()) !== -1) {
                                console.log("  0x" + base.add(off + strStart).toString(16) + ': "' + str.substring(0, 100) + '"');
                                break;
                            }
                        }
                    }
                    str = ""; strStart = -1;
                }
            }
        } catch(e) {}
    }
}

// 卡密验证关键词
var patterns = [
    "license", "expires_at", "hwid", "key", "verify", "auth",
    "api/verify", "api/unbind", "success", "error", "reject",
    "config.yaml", "license.dat", "token", "server", "http://", "https://",
    "卡密", "激活", "过期", "到期"
];

var mod = Process.findModuleByName("bi_log_wrapper.dll"); // 目标 DLL
scanMemory(mod.base, mod.size, patterns);
```

### 扫描 URL

```javascript
function scanUrls(base, size) {
    var chunkSize = 4096;
    for (var off = 0; off < size; off += chunkSize) {
        try {
            var chunk = base.add(off).readUtf8String(chunkSize);
            var urls = chunk.match(/https?:\/\/[^\s"'<>]{5,100}/g);
            if (urls) urls.forEach(function(u) { console.log("  URL: " + u); });
        } catch(e) {}
    }
}
```

### 扫描嵌入的 HTML/JS（Web UI 配置界面）

某些工具嵌入了 HTML 配置界面，包含完整的验证逻辑：

```javascript
// 搜索 HTML 标签
var htmlPatterns = ["<!DOCTYPE", "<html", "<script", "fetch('/api/", "localStorage"];
scanMemory(mod.base, mod.size, htmlPatterns);
```

嵌入的 HTML 通常包含：
- 卡密输入框 (`<input id="key">`)
- API 调用 (`fetch('/api/verify', {...})`)
- 配置项列表（hotkey、aim_key 等）
- 过期时间显示逻辑

## Step 4: Patch 验证函数

找到验证逻辑后，patch 内存跳过检查：

```javascript
// 方法 1: Hook 验证函数返回值
var verifyAddr = /* 从内存扫描定位的验证函数地址 */;
Interceptor.attach(verifyAddr, {
    onLeave: function(retval) {
        retval.replace(1);  // 强制返回成功
        console.log("[PATCH] Verify forced to return 1");
    }
});

// 方法 2: Patch 条件跳转
// 找到验证后的 je/jne 指令，NOP 掉
var patchAddr = /* 条件跳转地址 */;
Memory.patchCode(patchAddr, 2, function(code) {
    // je → jmp (0x74 → 0xEB) 或 jne → nop (0x75 0xXX → 0x90 0x90)
    code.writeU8(0x90);  // NOP
    code.add(1).writeU8(0x90);  // NOP
});

// 方法 3: 修改返回值（C++ bool 返回）
// 将 "return false" 改为 "return true"
// x86-64: xor eax,eax → mov eax,1
```

## 常见卡密验证模式

### 模式 A: HTTP API 验证

```
POST /api/verify
{"key": "XXXX-XXXX-XXXX", "hwid": "ABC123"}
→ {"ok": true, "expires_at": "2025-12-31"}
```

绕过：Hook WinHTTP 返回假响应，或 patch 验证函数。

### 模式 B: 本地 license.dat

```
license.dat 内容: {"key":"...", "hwid":"...", "expires":"..."}
读取 → 解密 → 校验 HWID + 过期时间
```

绕过：修改 license.dat 中的 expires 字段，或 patch 校验逻辑。

### 模式 C: 共享内存传递

```
Loader 创建 CreateFileMapping → 写入配置/DLL路径
DLL 读取 MapViewOfFile → 获取资源目录
```

绕过：修改 Loader 写入的内容，或 hook DLL 的读取逻辑。

### 模式 D: 嵌入式 Web UI

```
DLL 内嵌 HTML/JS 配置界面
本地 HTTP 服务器 (127.0.0.1:port)
浏览器打开配置页面 → 输入卡密 → fetch('/api/verify')
```

绕过：直接访问配置页面修改 localStorage 中的 license_expires。

## Pitfalls

| 问题 | 原因 | 解决 |
|------|------|------|
| Hook API 后 0 行日志 | DLL 已完成初始化，验证在加载时执行 | 用 `frida.spawn()` 在加载前注入 |
| 内存扫描找不到关键词 | 字符串在运行时才解密，且解密后被覆盖 | `setTimeout(fn, 5000)` 延迟扫描 |
| frida.attach() 后进程消失 | 反调试检测 | 必须用 `frida.spawn()` |
| findExportByName 报 TypeError | Frida 17.x API 变更 | 用 `module.enumerateExports()` 遍历 |
| Patch 后程序 crash | Patch 位置不对或破坏了调用约定 | 先用 Interceptor.attach 修改返回值，确认可行再 patch 内存 |
| 两个同名 DLL 不知道 hook 哪个 | 原始 DLL + 注入的 DLL | 用路径区分（`GH_Rec_AIMBOT` vs 原始路径） |
| 扫描到的 HTML 片段不完整 | 跨页或跨 chunk | 扫描时拼接相邻 chunk 的边界字符串 |
