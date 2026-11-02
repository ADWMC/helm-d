# PE Loader + DLL 注入逆向分析

## 触发条件

目标为 PE Loader / Dropper（大量资源嵌入）、DLL 注入器（CreateRemoteThread + LoadLibraryW）、卡密验证保护工具时加载本文档。

## 快速识别

```bash
r2 -q -c 'ii' target.exe | grep -iE 'CreateRemoteThread|WriteProcessMemory|VirtualAllocEx|FindResourceW|LoadResource'
```

导入 `CreateRemoteThread` + `WriteProcessMemory` + `FindResourceW` → 资源提取型 DLL 注入器。

## 分析流程

### Phase 1: 资源提取

PE 资源目录手工解析（不依赖工具）：

```python
import struct
with open('target.exe', 'rb') as f:
    data = f.read()

pe = struct.unpack_from('<I', data, 0x3C)[0]
n = struct.unpack_from('<H', data, pe+6)[0]
magic = struct.unpack_from('<H', data, pe+0x18)[0]  # 0x20b = PE32+
opt_off = pe + 0x18 + (0xF0 if magic == 0x20b else 0xE0)

for i in range(n):
    s_off = opt_off + i * 40
    name = data[s_off:s_off+8].rstrip(b'\x00').decode('ascii','ignore')
    vsize = struct.unpack_from('<I', data, s_off+8)[0]
    rva = struct.unpack_from('<I', data, s_off+12)[0]
    rsize = struct.unpack_from('<I', data, s_off+16)[0]
    foff = struct.unpack_from('<I', data, s_off+20)[0]
    print(f"  {name}: RVA=0x{rva:08x} VSize=0x{vsize:08x} RSize=0x{rsize:08x} FOff=0x{foff:08x}")
```

RCDATA 自定义归档格式：

```python
# 格式: num_entries(4) + [name_len(2) + name(ASCII) + data_len(4) + data]
num = struct.unpack_from('<I', data, off)[0]
pos = off + 4
for i in range(num):
    name_len = struct.unpack_from('<H', data, pos)[0]
    pos += 2
    name = data[pos:pos+name_len].decode('ascii')
    pos += name_len
    data_len = struct.unpack_from('<I', data, pos)[0]
    pos += 4
    # data[pos:pos+data_len] = file content
    pos += data_len
```

### Phase 2: XOR 解密算法逆向

定位：r2 追踪 `FindResourceW` → `LoadResource` → 解密函数调用链。

```bash
r2 -q -c 'aaa; axt @ sym.imp.KERNEL32.dll_FindResourceW' target.exe
```

密钥定位：在 .rdata 段搜索高熵数据（紧邻字符串表的 16/24/32 字节块）。

常见 XOR 模式：

```python
# 固定密钥循环 XOR
decrypted = bytes(d ^ key[i % len(key)] for i, d in enumerate(encrypted))

# 带变换的循环 XOR（每字节前变换密钥状态）
key = bytearray(initial_key)
for i in range(len(encrypted)):
    for j in range(key_len):
        key[j] = transform(key[j])  # 通常是模乘+减法
    decrypted[i] = encrypted[i] ^ key[i % key_len]
```

AVX/标量双路径特征（同一变换的两种实现）：

```asm
; AVX 路径: vpmovzxbw + vpmullw + psubb
; 标量路径: imul ecx, eax, 0x53 / mov eax, 0x25 / sub al, cl
```

### Phase 3: 内存 Dump 转 PE

**问题**：打包型 DLL 的 .text/.data 节在磁盘上 RawSize=0，必须从运行时内存提取。

**Frida dump**：

```javascript
var base = null;
Process.enumerateModules().forEach(function(m) {
    if (m.path.indexOf("TARGET") !== -1) { base = m.base; }
});
var file = new File(dumpPath, "wb");
for (var off = 0; off < size; off += 4096) {
    file.write(base.add(off).readByteArray(4096));
}
file.close();
```

**PE 节表修正**（使 IDA/r2 可直接加载）：

```python
# 原始: RawSize=0, RawOffset=0（打包态）
# 修正: RawSize=VirtSize, RawOffset=RVA（内存布局 = 文件布局）
for i in range(n):
    s_off = opt_off + i * 40
    vsize = struct.unpack_from('<I', dump, s_off+8)[0]
    rva = struct.unpack_from('<I', dump, s_off+12)[0]
    struct.pack_into('<I', new_dump, s_off+16, vsize)  # RawSize = VirtSize
    struct.pack_into('<I', new_dump, s_off+20, rva)    # RawOffset = RVA
```

### Phase 4: 验证逻辑定位

**字符串引用追踪**（在 .text 段搜索 LEA [rip+disp32]）：

```python
for off in range(text_start, text_end):
    if data[off] in (0x48, 0x4C) and data[off+1] == 0x8D:
        b2 = data[off+2]
        if (b2 & 0xC7) == 0x05:  # RIP-relative addressing
            disp = struct.unpack_from('<i', data, off+3)[0]
            target = off + 7 + disp
            if target == string_rva:
                # Found code reference to string
```

**常见验证模式**：

```asm
call verify_func      ; 返回 al=0 失败, al=1 成功
test al, al           ; 检查返回值
je error_path         ; 条件跳转
```

### Phase 5: License Bypass

**方案优先级**（从安全到激进）：

1. **License 标志位 patch**（最安全，不影响程序逻辑）

```javascript
// 找到标志位地址（通过字符串引用追踪），设为有效值
var flag = base.add(flagOffset);
Memory.patchCode(flag, 1, function(p) { p.writeByteArray([0x01]); });
```

2. **路由 NOP**（跳过页面/功能验证）

```javascript
// NOP 掉条件跳转，强制走成功路径
Memory.patchCode(jeAddr, 2, function(p) { p.writeByteArray([0x90, 0x90]); });
```

3. **响应模板 patch**（API 层返回成功）

```javascript
// {"ok":false → {"ok":true （注意保持字节长度一致）
Memory.patchCode(addr.add(6), 5, function(p) {
    p.writeByteArray([0x74, 0x72, 0x75, 0x65, 0x20]); // "true "
});
```

**绝对不要做的事**：

- 不要 patch `je→jne`：成功路径需要有效数据，会导致死锁/crash
- 不要 patch `test al,al` 为 `mov al,1`：同上
- 不要直接 patch 验证函数的返回值：上下文未初始化会导致下游崩溃

**正确做法**：patch 标志位或 NOP 条件跳转，让程序自然走成功路径。

### Phase 6: AES 密钥捕获

当模型/数据文件用 AES 加密时，hook Windows CryptoAPI 或 OpenSSL：

```javascript
// BCrypt API
var genKey = findExport("bcrypt.dll", "BCryptGenerateSymmetricKey");
Interceptor.attach(genKey, {
    onEnter: function(args) { this.pbSecret = args[5]; this.cbSecret = args[6].toInt32(); },
    onLeave: function(retval) {
        if (retval.toInt32() >= 0 && this.pbSecret && this.cbSecret > 0) {
            var hex = Array.from(new Uint8Array(this.pbSecret.readByteArray(this.cbSecret)))
                .map(function(b){return ("0"+b.toString(16)).slice(-2)}).join("");
            console.log("[KEY] len=" + this.cbSecret + " hex=" + hex);
        }
    }
});

// OpenSSL (libcrypto)
var aesInit = findExport("libcrypto-1_1-x64.dll", "AES_set_encrypt_key");
if (aesInit) {
    Interceptor.attach(aesInit, {
        onEnter: function(args) {
            var keyLen = args[1].toInt32();
            var keyBytes = new Uint8Array(args[0].readByteArray(keyLen / 8));
            var hex = Array.from(keyBytes).map(function(b){return ("0"+b.toString(16)).slice(-2)}).join("");
            console.log("[AES KEY] bits=" + keyLen + " hex=" + hex);
        }
    });
}
```

**重要区分**：一个程序可能使用多组 AES 密钥用于不同目的：
- License 通信用密钥（频繁调用，128-bit）
- 配置加密用密钥
- 数据/模型解密用密钥（仅在加载时调用，可能 256-bit）

Hook `AES_set_encrypt_key` 会捕获所有密钥。需要根据调用时机和密钥长度区分用途。数据解密密钥通常只在触发加载操作时出现一次。

**进阶：hook `EVP_CipherInit_ex`**（捕获 key + IV + 算法）：
```javascript
var evpCipher = findExport("libcrypto-1_1-x64.dll", "EVP_CipherInit_ex");
Interceptor.attach(evpCipher, {
    onEnter: function(args) {
        if (!args[2].isNull()) {
            var key = new Uint8Array(args[2].readByteArray(32));
            console.log("[KEY] " + Array.from(key).map(b=>("0"+b.toString(16)).slice(-2)).join(""));
        }
        if (!args[3].isNull()) {
            var iv = new Uint8Array(args[3].readByteArray(16));
            console.log("[IV] " + Array.from(iv).map(b=>("0"+b.toString(16)).slice(-2)).join(""));
        }
    }
});
```

## Frida 17.x 兼容性

`Module.findExportByName()` 在 Windows 上报 TypeError，必须用 `enumerateExports()` 遍历：

```javascript
function findExport(dll, name) {
    try {
        var mod = Process.findModuleByName(dll);
        if (!mod) return null;
        var e = mod.enumerateExports();
        for (var i = 0; i < e.length; i++) if (e[i].name === name) return e[i].address;
    } catch(ex) {}
    return null;
}
```

## 踩坑速查

| 问题 | 原因 | 解决 |
|------|------|------|
| Frida `findExportByName` 报 TypeError | Frida 17.x API 变更 | 用 `enumerateExports()` 遍历 |
| Memory.scan 回调不触发 | 脚本退出后才执行 | 用 `setTimeout` 或写文件 |
| patch `je→jne` 导致死锁 | 成功路径需要有效数据 | 改 patch 标志位 |
| 运行时标志位为 0 | dump 是验证后的值 | 必须运行时 patch |
| 页面通但 API 返回 Forbidden | 两套独立检查 | 同时 patch 标志位 |
| r2 `aaa` 超时 | 大文件全量分析 | 用 `rafind2`/字符串搜索替代 |
| MSYS `/tmp/` Python 找不到 | 路径映射不同 | Python 用 `C:\` 路径 |
| Hook BCrypt 无输出 | DLL 用 OpenSSL 而非 BCrypt | 检查 `libcrypto` 导入，hook OpenSSL |
| 抓到 AES-128 密钥但数据解不开 | 抓到的密钥是 license 通信用的，不是数据解密密钥 | 数据文件可能用 AES-256 + 独立密钥。需 hook `EVP_CipherInit_ex` 的 key/iv 参数，在触发解密的操作时捕获 |
| 所有 socket hook 无反应但 curl 收到响应 | DLL 用直接系统调用 | 放弃 hook，用 `Memory.patchCode` 直接改数据段 |
| 多次 patch 后进程不响应 | 累积 patch 破坏内部状态 | 重启进程后一次性应用所有 patch |
| PyInstaller 应用无输出 | 需要 GUI 或 display | 用 `cmd.exe /c start` 启动 |

## 实战案例

完整案例见仓库 `ADWMC/gh-aimbot-analysis`：
- `docs/gh-loader-re-full.md` — 全流程记录
- `scripts/gh_full_bypass.js` — 一键绕过脚本
- `dump/gh_unpacked.dll` — 无加密版 PE（IDA 可直接加载）
