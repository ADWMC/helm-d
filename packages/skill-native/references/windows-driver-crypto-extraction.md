# Windows 驱动加密密钥提取方法论

## 适用场景

Windows 内核驱动（.sys）中硬编码了加密密钥（AES/DES/XOR），用于保护固件、配置文件、EEPROM 数据等。需要提取密钥以解密受保护数据。

## 通用方法

### 1. 字符串定位加密函数

```bash
# 提取驱动中的加密相关字符串
strings driver.sys | grep -iE 'AES|encrypt|decrypt|key|cipher|BCrypt|CryptoAPI'

# 常见 Windows 加密 API 字符串
# BCryptDecrypt, BCryptGenerateSymmetricKey, BCryptOpenAlgorithmProvider
# CIPHER_AES, DecryptDATfile, CreateSymmetricKey
```

### 2. 定位密钥派生函数

大多数驱动不直接存储明文密钥，而是通过密钥派生函数（KDF）生成：

```
常见模式:
  1. 固定字符串 → SHA1/SHA256 → 取前 N 字节作为 AES 密钥
  2. 硬编码种子 + 设备特定数据 → HMAC → 密钥
  3. 嵌入式证书/公钥中提取对称密钥
```

**Capstone 反汇编追踪流程**：

```python
from capstone import *
import struct, re

data = open('driver.sys', 'rb').read()
md = Cs(CS_ARCH_X86, CS_MODE_64)

# 1. 找到加密函数名字符串的文件偏移
str_offset = data.find(b'DecryptDATfile\x00')

# 2. 计算 VA（需要解析 PE 段表）
# .text: VA=0x1000, RawOff=0x400
str_va = 0x1000 + (str_offset - 0x400)

# 3. 找到引用该字符串的 LEA 指令（XREF）
for i in range(0, len(data) - 6):
    if data[i] in (0x48, 0x4c) and data[i+1] == 0x8d:
        modrm = data[i+2]
        if (modrm & 0xc7) == 0x05:  # RIP-relative
            disp = struct.unpack('<i', data[i+3:i+7])[0]
            inst_va = 0x1000 + (i - 0x400)
            target = inst_va + 7 + disp
            if target == str_va:
                print(f'XRef at VA=0x{inst_va:08x}')

# 4. 从 XREF 反汇编上下文，追踪密钥加载
# 关注 LEA 指令加载的数据地址 → 可能是密钥或 KDF 参数
```

### 3. 追踪 BCrypt API 调用链

Windows 驱动常用 BCrypt API 做加密。调用链：

```
BCryptOpenAlgorithmProvider  → 打开算法（AES/SHA1）
BCryptGetProperty            → 获取 BlockLength/ObjectLength
BCryptGenerateSymmetricKey   → 从密钥材料生成密钥对象
BCryptDecrypt / BCryptEncrypt → 执行加解密
```

**关键参数追踪**：
- `BCryptGenerateSymmetricKey` 的 `pbKeyMaterial` 参数 = 密钥材料（通常是 SHA1/SHA256 哈希输出）
- `BCryptHashData` 的输入 = KDF 的输入数据（可能是硬编码字符串）

### 4. 提取 KDF 输入

```python
# 找到 BCryptHashData 调用前的数据加载
# LEA rdx, [rip+disp]  → 数据指针
# mov r9d, size         → 数据大小

# 读取目标地址的数据
target_foff = raw_offset + (target_va - section_va)
kdf_input = data[target_foff:target_foff+data_size]
print(f"KDF input: {kdf_input} ({kdf_input.hex()})")
```

### 5. 验证密钥

```python
from Crypto.Cipher import AES
import hashlib

# 尝试不同 KDF
candidates = [
    hashlib.sha1(b"HARDCODED_STRING").digest()[:16],  # SHA1 取前16字节
    hashlib.sha256(b"HARDCODED_STRING").digest()[:16], # SHA256 取前16字节
    b"\x01\x02\x03\x04..."  # 直接硬编码的密钥
]

encrypted_data = open('encrypted_file', 'rb').read()

for key in candidates:
    cipher = AES.new(key, AES.MODE_ECB)
    decrypted = cipher.decrypt(encrypted_data[:16])
    # 检查解密结果是否有已知魔数（文件头、签名等）
    if b'KnownMagic' in decrypted or is_printable(decrypted):
        print(f"Key found: {key.hex()}")
        break
```

## 案例：MTK WiFi 驱动 DAT 文件解密

**目标**：MediaTek MT7920 WLAN 驱动（mtkwl6ex.sys）的 DAT 配置文件

**发现过程**：
1. `strings mtkwl6ex.sys | grep -i decrypt` → 找到 `DecryptDATfile` 函数名
2. Capstone 反汇编 XREF → 追踪到 BCrypt 调用链
3. 发现 SHA1 算法调用 + `BCryptGenerateSymmetricKey`
4. 追踪 `BCryptHashData` 的输入数据 → VA 0x183610 处 8 字节: `MEDIATEK`
5. 计算: `SHA1("MEDIATEK")[:16] = eed40f5ee97cbb7b8a99157dcaeb3bd0`
6. 验证: AES-ECB 解密第一块 → `____Mediatek____` (MediaTek 魔数头)

**密钥派生**：
```
输入: "MEDIATEK" (8 bytes, ASCII)
KDF:  SHA1
密钥: SHA1("MEDIATEK") 的前 16 字节 (AES-128)
模式: AES-ECB
```

**DAT 文件结构**：
```
偏移 0x00-0x0F: ____Mediatek____ (解密后的魔数头)
偏移 0x10+:     加密的 EEPROM/固件/校准数据
```

**陷阱**：
- DAT 文件不是纯 EEPROM 镜像，MAC 地址不在文件中
- MT7920 的 MAC 存储在芯片 eFuse（一次性编程）中
- MCU 固件直接从 eFuse 读取 MAC，不经过 DAT 文件
- DAT 文件实际是固件+校准数据包，EEPROM 数据由芯片内部提供

## 案例：MTK 芯片 EEPROM 架构

**MT7920/MT7921/MT7922 EEPROM 访问路径**：

```
Linux:  mt76 驱动 → MCU 命令 EFUSE_ACCESS (0x01) → 读 eFuse
Windows: MTK 驱动 → 解密 DAT 文件 → 发送到 MCU → MCU 使用 eFuse 或 SRAM buffer

MCU 命令:
  MCU_EXT_QUERY(EFUSE_ACCESS)       = 0x01  # 读 eFuse
  MCU_EXT_CMD(EFUSE_BUFFER_MODE)    = 0x21  # 切换 eFuse/buffer 模式

Buffer Mode:
  EE_MODE_EFUSE  = 0  # 使用芯片 eFuse（默认，只读）
  EE_MODE_BUFFER = 1  # 使用 MCU SRAM（可写，重启丢失）
```

**EEPROM MAC 地址**：
- 位置: eFuse 内部，由 MCU 固件直接读取
- Linux debugfs: `/sys/kernel/debug/ieee80211/phy0/mt76/eeprom` (只读 0400)
- Windows: 通过 DAT 文件发送到 MCU，但 MAC 不在 DAT 中

**永久修改 MAC 的可行路径**：
1. MCU Buffer Mode（重启丢失，需自启脚本重发）
2. Linux mt76 debugfs 改为可写（需修改内核）
3. CH341A 编程器直接写 SPI Flash（如果有外置 EEPROM）

## PE 文件解析要点

```
# PE 段表解析
pe_offset = struct.unpack('<I', data[0x3c:0x40])[0]
num_sections = struct.unpack('<H', data[pe_offset+6:pe_offset+8])[0]
optional_header_size = struct.unpack('<H', data[pe_offset+20:pe_offset+22])[0]
section_start = pe_offset + 24 + optional_header_size

# VA ↔ 文件偏移转换
def va_to_file_offset(va, sections):
    for name, (sec_va, sec_raw, sec_size) in sections.items():
        if sec_va <= va < sec_va + sec_size:
            return sec_raw + (va - sec_va)
    return None
```

## 常见陷阱

| 问题 | 原因 | 解决 |
|------|------|------|
| 解密后 MAC 地址不在文件中 | DAT 文件不是纯 EEPROM 镜像 | MAC 在芯片 eFuse 中，需 MCU 命令读取 |
| Capstone CALL 目标地址异常 | IAT 间接调用，非直接调用 | 检查 `call [rip+disp]` 模式 |
| SHA1 输入不是密钥本身 | 使用了 KDF（密钥派生函数） | 追踪 BCryptHashData 的输入参数 |
| AES-ECB 解密结果无意义 | 模式错误（可能是 CBC） | 尝试 CBC（前块作 IV）或零 IV |
| eFuse 写入无效 | eFuse 是 OTP（一次性编程） | 只能 0→1，不能 1→0；用 buffer mode 替代 |
