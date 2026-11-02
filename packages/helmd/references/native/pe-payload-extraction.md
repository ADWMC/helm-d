# PE 资源段加密 Payload 提取与解密

当 PE 文件 `.rsrc` 段异常大（>5MB），或 `FindResourceW`/`LoadResource` 出现在导入表中时，很可能包含嵌入式加密 payload（DLL/配置/证书）。

## 快速识别

```python
# Python: 检查 .rsrc 段大小和可疑导入
import struct
with open('target.exe', 'rb') as f:
    data = f.read()
pe = struct.unpack_from('<I', data, 0x3C)[0]
n = struct.unpack_from('<H', data, pe+6)[0]
magic = struct.unpack_from('<H', data, pe+0x18)[0]
is64 = magic == 0x20b
opt_off = pe + 0x18 + (0xF0 if is64 else 0xE0)

for i in range(n):
    name = data[opt_off+i*40:opt_off+i*40+8].rstrip(b'\x00').decode('ascii','ignore')
    rsize = struct.unpack_from('<I', data, opt_off+i*40+16)[0]
    if rsize > 5*1024*1024:
        print(f"Suspicious section: {name} ({rsize/1024/1024:.1f}MB)")
```

可疑导入关键词：`FindResourceW`, `LoadResource`, `LockResource`, `SizeofResource`, `CreateRemoteThread`, `WriteProcessMemory`, `VirtualAllocEx`

## 资源目录解析

### 结构

```
.rsrc section
├── RT_ICON (3)
├── RT_RCDATA (10)        ← 嵌入式数据通常在这里
│   ├── ID 100
│   │   └── Lang 1033 → Data Entry (RVA, Size)
│   └── ID 101
│       └── Lang 1033 → Data Entry (RVA, Size)
├── RT_GROUP_ICON (14)
└── RT_MANIFEST (24)
```

### 解析脚本

```python
import struct

def parse_rsrc(data, rsrc_section_rva, rsrc_section_foff):
    """解析 PE 资源目录，返回 [(name, file_offset, size), ...]"""
    BASE = rsrc_section_foff
    results = []
    
    def rsrc_to_foff(rva_offset):
        return BASE + rva_offset
    
    # 根目录
    root_off = BASE
    num_named = struct.unpack_from('<H', data, root_off + 12)[0]
    num_id = struct.unpack_from('<H', data, root_off + 14)[0]
    
    RT_TYPES = {1:'CURSOR',2:'BITMAP',3:'ICON',4:'MENU',5:'DIALOG',6:'STRING',
                7:'FONTDIR',8:'FONT',9:'ACCELERATOR',10:'RCDATA',11:'MESSAGETABLE',
                12:'GROUP_CURSOR',14:'GROUP_ICON',16:'VERSION',24:'MANIFEST'}
    
    def parse_dir(offset, level=0, prefix=""):
        off = offset + 16
        nn = struct.unpack_from('<H', data, offset + 12)[0]
        ni = struct.unpack_from('<H', data, offset + 14)[0]
        
        for i in range(nn + ni):
            name_val = struct.unpack_from('<I', data, off)[0]
            child_val = struct.unpack_from('<I', data, off + 4)[0]
            
            # 获取名称
            if name_val & 0x80000000:
                name_off = rsrc_to_foff(name_val & 0x7FFFFFFF)
                name_len = struct.unpack_from('<H', data, name_off)[0]
                name = data[name_off+2:name_off+2+name_len*2].decode('utf-16-le', errors='ignore')
            else:
                name = RT_TYPES.get(name_val, f"ID_{name_val}") if level == 0 else str(name_val)
            
            if child_val & 0x80000000:
                # 子目录
                parse_dir(rsrc_to_foff(child_val & 0x7FFFFFFF), level+1, prefix + f"{name}/")
            else:
                # 数据条目
                de_off = rsrc_to_foff(child_val)
                d_rva = struct.unpack_from('<I', data, de_off)[0]
                d_size = struct.unpack_from('<I', data, de_off + 4)[0]
                d_foff = rsrc_section_foff + (d_rva - rsrc_section_rva)
                results.append((f"{prefix}{name}", d_foff, d_size))
            
            off += 8
    
    parse_dir(root_off)
    return results

# 使用示例
# .rsrc: RVA=0x62000, FileOff=0x4ce00
entries = parse_rsrc(data, rsrc_section_rva=0x62000, rsrc_section_foff=0x4ce00)
for name, foff, size in entries:
    print(f"{name}: offset=0x{foff:x} size=0x{size:x}({size/1024/1024:.1f}MB)")
```

## 常见加密模式

### 模式 1: 简单 XOR（密钥在代码中）

```python
# 密钥通常作为 mov/movabs 指令的立即数嵌入代码
# r2 定位: 搜索 "LoadDllFromResource" 等字符串，追踪 xref 找到解密函数
# 从解密函数的 mov 指令提取密钥

key = bytes.fromhex('aabbccdd...')  # 从代码中提取
decrypted = bytes(data[i] ^ key[i % len(key)] for i in range(size))
```

### 模式 2: 有状态 XOR（密钥逐字节变换）

**案例: GH_Loader (网易云future.exe)**

```python
# 初始密钥通过 movups + movabs 从 .rdata 段加载
# 每次 XOR 前，全部密钥字节执行累积变换
key_init = bytes.fromhex('7ca818b81fa4db3de4d44565fa3400c8') + b'\xbc\x42\x66\xfc\x8a\xf1\xb3\x99'

def transform_byte(b):
    return (0x25 - (b * 0x53)) & 0xFF

def decrypt_stateful_xor(encrypted, key_init):
    key = bytearray(key_init)
    out = bytearray(len(encrypted))
    for i in range(len(encrypted)):
        for j in range(len(key)):
            key[j] = transform_byte(key[j])
        out[i] = encrypted[i] ^ key[i % len(key)]
    return bytes(out)
```

**识别特征：**
- 解密函数内有双层循环（外层遍历数据，内层遍历密钥字节）
- 密钥变换使用 `imul` + `sub` 模式（如 `imul ecx, eax, 0x53; mov eax, 0x25; sub al, cl`）
- AVX 路径使用 `vpmullw` + `psubb` 做向量化变换

**提取密钥方法：**
1. `rafind2` 搜索 "LoadDllFromResource" / "decrypted" 等字符串
2. `axt` 找到解密函数
3. 函数入口附近找 `movups xmm, [rip+disp]`（加载16字节）+ `movabs rax, imm64`（加载8字节）
4. `movups` 的 RIP-relative 地址指向 .rdata 中的16字节初始密钥
5. `movabs` 的立即数是密钥后8字节

### 模式 3: AES-256（密钥在共享内存/环境变量中）

```python
# 头部特征: 自定义头 + "256.aes" 文件名
# 02 00 00 00 07 00 "256.aes" <encrypted_data>
# 密钥通常通过 CreateFileMapping + MapViewOfFile 传递
# 或通过 SetEnvironmentVariableW 设置
# 需要动态分析或逆向密钥派生函数
```

### 模式 4: RC4

```python
# 特征: 256 字节 S-box 初始化 + KSA + PRGA
# 常见于轻量级保护
def rc4(key, data):
    S = list(range(256))
    j = 0
    for i in range(256):
        j = (j + S[i] + key[i % len(key)]) % 256
        S[i], S[j] = S[j], S[i]
    i = j = 0
    out = bytearray()
    for byte in data:
        i = (i + 1) % 256
        j = (j + S[i]) % 256
        S[i], S[j] = S[j], S[i]
        out.append(byte ^ S[(S[i] + S[j]) % 256])
    return bytes(out)
```

## DLL 注入器分析流程

```
1. 快速识别
   file target.exe                    → PE32+ GUI, 大 .rsrc 段
   r2 -q -c 'ii' target.exe          → FindResourceW, CreateRemoteThread, WriteProcessMemory
   r2 -q -c 'iz' target.exe          → "cloudmusic.exe", "LdrInject", "GH_Loader"

2. 确定注入目标
   iz 搜索目标进程名                    → "cloudmusic.exe", "target_process.exe"
   iz 搜索 DLL 路径                    → "C:\ProgramData\XXX\payload.dll"

3. 定位加密 payload
   解析资源目录                         → 找 RCDATA 类型的大数据块
   检查前几个字节                       → MZ 头(未加密) / 高熵(加密) / 已知头格式

4. 提取密钥
   iz 搜索 "decrypt"/"LoadDll"         → 找到解密相关字符串
   axt 追踪到解密函数                   → 定位密钥加载指令
   pd 查看函数前几十条指令              → 提取 movups/movabs 立即数

5. 解密并分析 payload
   解密后 file 命令检查类型             → PE DLL / ELF / ZIP
   r2 -q -c 'ii' payload.dll          → 查看导入判断功能
   iz 搜索 payload 字符串              → 可能全部加密（强混淆）

6. 判断用途
   导入 D3D/DXGI                       → overlay 渲染
   导入 WS2_32/WinHTTP                 → 网络通信
   导入 CryptCreateHash                → 许可证验证
   导入 IPHLPAPI/HID                   → HWID 绑定
```

## Pitfalls

| 问题 | 原因 | 解决 |
|------|------|------|
| 解密后不是 PE/ELF | XOR 密钥错误或变换算法理解有误 | 用已知明文验证（如 MZ 头 `4d 5a`）反推密钥前2字节 |
| 资源目录解析 offset 越界 | RVA 到文件偏移转换错误 | 确认 .rsrc 段的 RVA 和 FileOff 正确对应 |
| 有状态 XOR 解密太慢 | 21MB 数据逐字节+逐密钥字节变换 | 用 C 扩展或 numpy 向量化；或只解密前 4KB 验证类型 |
| AVX 路径和标量路径结果不同 | 两条路径的变换公式可能有细微差异 | 优先信任标量路径（更易读），AVX 是优化版本 |
| RCDATA/101 有 "256.aes" 但无法解密 | AES 密钥不在文件中，需要动态获取 | 需要运行时 hook 或逆向密钥派生函数 |
| 资源段中的数据不是 RCDATA | 某些打包器用 RT_STRING 或自定义类型 | 遍历所有资源类型，检查每个数据块的前几个字节 |
