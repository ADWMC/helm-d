# 模型/数据文件解密密钥运行时捕获

## 触发条件

目标程序包含加密的模型/数据文件（如 `.aes`、`.enc`、`.bin`），静态分析无法提取密钥时加载本文档。

## 问题特征

```
256.aes: 22,333,843 bytes, first 32: 6b52da8e17a3db08080ae231f99f896a567708f50b602304218a628a802f98cb
320.aes: 22,341,403 bytes, first 32: 6b52da8e17a3db08080ae231f99f896a567708f503272304218a628a802f98cb
```

- 文件很大（>10MB），头部一致，高熵（~7.9）
- 不是已知格式（非 ZIP/ONNX/protobuf 直接可见）
- 静态分析 DLL 找不到密钥（密钥隐藏在混淆代码或运行时派生）

## 密钥分离原则

**同一程序可能包含多组独立 AES 密钥：**

| 用途 | 密钥长度 | 调用频率 | 触发时机 |
|------|---------|---------|---------|
| License 通信 | 128-bit | 频繁 | 每次网络请求 |
| 配置加密 | 128/256-bit | 中等 | 读写配置时 |
| **模型/数据解密** | 256-bit | **极少（1-2次）** | **加载模型时** |

Hook `AES_set_encrypt_key` 会捕获所有调用。根据以下特征区分：
- **密钥长度**：数据解密通常用 256-bit
- **调用时机**：仅在用户点击"加载模型"时出现
- **输入大小**：加密调用后紧跟大量数据处理

## 分步捕获策略

### Step 1: Minimal Hook（验证目标 API 可达）

先用最小脚本确认 OpenSSL 是否被使用：

```javascript
// gh_key_only.js - 极简版，只 hook 关键函数
var base = null;
Process.enumerateModules().forEach(function(m) {
    if (m.path.indexOf("TARGET_DLL") !== -1) base = m.base;
});

// Apply any bypass first (silent)
// Memory.patchCode(...)

function findExp(dll, name) {
    try {
        var mod = Process.findModuleByName(dll);
        if (!mod) return null;
        var e = mod.enumerateExports();
        for (var i = 0; i < e.length; i++) if (e[i].name === name) return e[i].address;
    } catch(ex) {}
    return null;
}

// Hook AES_set_encrypt_key
var aesKey = findExp("libcrypto-1_1-x64.dll", "AES_set_encrypt_key");
if (aesKey) {
    Interceptor.attach(aesKey, {
        onEnter: function(args) {
            var bits = args[1].toInt32();
            var k = new Uint8Array(args[0].readByteArray(bits / 8));
            console.log("[AES KEY] bits=" + bits + " " + 
                Array.from(k).map(b => ("0"+b.toString(16)).slice(-2)).join(""));
        }
    });
}

// Hook EVP_CipherInit_ex (captures key + iv)
var evpCipher = findExp("libcrypto-1_1-x64.dll", "EVP_CipherInit_ex");
if (evpCipher) {
    Interceptor.attach(evpCipher, {
        onEnter: function(args) { this.key = args[2]; this.iv = args[3]; },
        onLeave: function(retval) {
            if (retval.toInt32() >= 0) {
                if (!this.key.isNull()) {
                    var k = new Uint8Array(this.key.readByteArray(32));
                    console.log("[MODEL KEY] " + 
                        Array.from(k).map(b => ("0"+b.toString(16)).slice(-2)).join(""));
                }
                if (!this.iv.isNull()) {
                    var v = new Uint8Array(this.iv.readByteArray(16));
                    console.log("[MODEL IV] " + 
                        Array.from(v).map(b => ("0"+b.toString(16)).slice(-2)).join(""));
                }
            }
        }
    });
}
```

```bash
frida -p <PID> -l gh_key_only.js 2>&1
```

**然后让用户执行触发操作**（如点击"加载模型"）。

### Step 2: 如果 Minimal Hook 无输出 → Full Crypto Hook

如果 Step 1 完全无输出，可能加解密不走 OpenSSL。换装全量 hook：

```javascript
// gh_full_crypto.js - 全量 hook
var evpFuncs = [
    "EVP_CipherInit_ex", "EVP_CipherInit", "EVP_CipherUpdate", "EVP_CipherFinal_ex",
    "EVP_DecryptInit_ex", "EVP_DecryptInit", "EVP_DecryptUpdate", "EVP_DecryptFinal_ex",
    "EVP_EncryptInit_ex", "EVP_EncryptInit", "EVP_EncryptUpdate", "EVP_EncryptFinal_ex",
    "EVP_BytesToKey", "EVP_CIPHER_CTX_new", "EVP_CIPHER_CTX_reset"
];

evpFuncs.forEach(function(name) {
    var addr = findExp("libcrypto-1_1-x64.dll", name);
    if (addr) {
        Interceptor.attach(addr, {
            onEnter: function(args) {
                this.name = name;
                this.args2 = args[2]; // key
                this.args3 = args[3]; // iv
            },
            onLeave: function(retval) {
                var msg = "[EVP] " + this.name + " ret=" + retval.toInt32();
                if (!this.args2.isNull()) {
                    var k = new Uint8Array(this.args2.readByteArray(32));
                    msg += " key=" + Array.from(k).map(b => ("0"+b.toString(16)).slice(-2)).join("");
                }
                if (!this.args3.isNull()) {
                    var v = new Uint8Array(this.args3.readByteArray(16));
                    msg += " iv=" + Array.from(v).map(b => ("0"+b.toString(16)).slice(-2)).join("");
                }
                console.log(msg);
            }
        });
    }
});

// Also hook memory allocations to detect model loading
var va = Module.findExportByName("kernel32.dll", "VirtualAlloc");
if (va) {
    Interceptor.attach(va, {
        onEnter: function(args) { this.size = args[2].toInt32(); },
        onLeave: function(retval) {
            if (this.size > 1000000) {
                console.log("[MEM] VirtualAlloc size=" + this.size + " addr=" + retval);
            }
        }
    });
}
```

### Step 3: 如果 EVP Hook 全部 0 输出 → 自定义加密

说明程序使用自定义加密算法（非 OpenSSL）。排查方向：

1. **搜索 dll 中的字符串** 查找加密相关常量（ChaCha20 的 "expand 32-byte k"、Salsa20 等）
2. **搜索 MMX/SSE/AVX 指令** 常量（`0x9e3779b9` for TEA/XXTEA、`0x61707865` for ChaCha）
3. **dump 解密后的内存**：让模型加载完成，然后 dump 进程内存搜索 ONNX 签名

### Step 4: 内存 Dump 解密后的数据

当密钥捕获失败时，可选的 fallback 方案：

```javascript
// 1. 等模型加载完成
// 2. 在内存中搜索 ONNX 签名 (protobuf 0x08 或 PK for zip)
Memory.scan(Process.enumerateModules()[0].base, 
    Process.enumerateModules()[0].size, 
    '08 00 00 00 0a 08', { // protobuf: field 1 varint, field 2 len
    onMatch: function(addr, size) {
        console.log("[ONNX] Found at " + addr);
        // dump from addr to file
    }
});
```

## Frida 17.x 兼容性

```javascript
// Windows Frida 17.x: findExportByName 报 TypeError
// 必须用 enumerateExports 遍历
function findExp(dll, name) {
    try {
        var mod = Process.findModuleByName(dll);
        if (!mod) return null;
        var e = mod.enumerateExports();
        for (var i = 0; i < e.length; i++) if (e[i].name === name) return e[i].address;
    } catch(ex) {}
    return null;
}
```

## Pitfalls

| 问题 | 原因 | 解决 |
|------|------|------|
| EVP hook 全部 0 输出 | 加解密不走 OpenSSL | 检查其他加密库（libgcrypt、NSS、CNG），或自定义实现 |
| 抓到 AES-128 但解不开模型 | 抓到的是 license 通信密钥 | 等待加载操作触发，捕获 256-bit 密钥 |
| 加载操作触发时 hook 不输出 | 解密在 DLL 初始化时已完成 | 需要更早 attach（spawn 而非 attach） |
| 多个密钥全像随机数 | 密钥本身是派生值（KDF 输出） | 追踪 `EVP_BytesToKey` / `PKCS5_PBKDF2_HMAC` 的输入 |
| Frida 抓到的密钥是正确的但解密失败 | 使用了错误的算法/模式（如 CTR vs CBC） | 同时捕获 algorithm 参数（`EVP_CIPHER_CTX_set_padding`） |
| Hook 导致进程崩溃 | 脚本异常积累 | 用 minimal hook 开始，逐个添加目标函数 |
| DLL 卸载后 hook 失效 | 目标进程重启或 DLL 被卸载 | 重新注入 loader 后重装 hook，检查新 PID |
| VirtualAlloc hook 报 TypeError | Frida 17.x 参数索引变更 | Windows: size = args[1]（不是 args[2]） |
| 全量 hook 脚本导致 DLL 找不到 | 脚本异常导致 Frida 会话崩溃 | try/catch 包裹每个 hook，避免一个失败全部崩溃 |
| 点"加载模型"后 0 输出 | 解密走的是自定义算法（非 OpenSSL） | 搜索 ChaCha20/TEA/XTEA 常量，或等加载完 dump 内存 |

## 实战案例

**案例: GH_Rec_AIMBOT.dll (网易云 future.exe loader)**

```
环境: 网易云音乐 + GH_Loader (自定义 XOR + AES-256)
模型: 256.aes (21.3MB), 320.aes (21.3MB)
加密: AES-256, 密钥嵌入 DLL 混淆代码
捕获: 
  1. 先用 minimal hook (AES_set_encrypt_key + EVP_CipherInit_ex)
  2. 捕获 license 通信 AES-128 密钥（频繁出现）
  3. 需要用户点击"加载模型"触发数据解密
  4. 捕获 256-bit 密钥
```

## 可复用脚本

- `scripts/frida_model_key_capture.js` — 一键捕获所有 EVP 调用
- `scripts/frida_dump_after_load.js` — 等加载完成后 dump 内存
