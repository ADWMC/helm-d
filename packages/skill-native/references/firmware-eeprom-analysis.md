# 固件/驱动 EEPROM 数据分析方法论

> 分析驱动包中的加密 EEPROM 数据、固件 blob、校准文件的通用思路。适用于 WiFi/BT/网卡等外设驱动。

## 典型场景

- 用户拿到驱动包，想修改 MAC 地址、校准参数、region 等硬件级配置
- 需要判断数据文件是否加密、用什么加密、能否解密修改

## 分析流程

### 1. 识别文件类型

```bash
file *.dat *.bin           # 基本类型检测
xxd file.dat | head -20    # 查看 header/magic
ls -la *.dat               # 文件大小分布
```

常见文件角色：
| 文件模式 | 典型用途 |
|---------|---------|
| `mtkwl*.dat` / `mtkbt*.dat` | MTK WiFi/BT EEPROM 校准数据（通常加密） |
| `*_RAM_CODE_*.bin` | 芯片运行固件（加载到 RAM 执行） |
| `*_patch_mcu_*.bin` | MCU 补丁固件 |
| `EEPROM_*.bin` | 明文 EEPROM 镜像（罕见，通常是厂商内部） |

### 2. 判断是否加密

**Shannon 熵分析**（最关键指标）：

```python
import math
from collections import Counter

def block_entropy(data):
    counts = Counter(data)
    length = len(data)
    return -sum((c/length) * math.log2(c/length) for c in counts.values())

# 分块检查
for offset in range(0, len(data), 0x1000):
    block = data[offset:offset+0x1000]
    print(f'0x{offset:05x}: entropy={block_entropy(block):.3f}')
```

| 熵值 | 含义 |
|------|------|
| < 5.0 | 可能是填充/压缩数据 |
| 5.0-7.5 | 有结构的数据（明文配置、固件代码） |
| 7.5-7.99 | 强压缩或轻度加密 |
| **≈ 8.0** | **强加密（AES 等）或高熵固件** |

**辅助判断**：
- `strings` 能提取出可读文本 → 未加密或仅压缩
- 所有 block 熵值均匀 ≈ 8.0 → AES-ECB/CBC 等强加密
- 头部低熵 + 后续高熵 → 可能是明文 header + 加密 body

### 3. 从驱动二进制提取加密信息

```bash
# 关键函数名搜索
strings driver.sys | grep -iE "Decrypt|AES|encrypt|key|cipher|BCrypt|CryptoAPI"
strings driver.sys | grep -iE "EEPROM|eeprom|ee_data|dat_file|LoadFirmware"
strings driver.sys | grep -iE "MAC|addr|PermanentAddress|NetworkAddress|LocalMAC"

# 源码路径泄露（关键！）
strings driver.sys | grep -iE "\\\\.*\\.c$|\\\\.*\\.cpp$"
# → 暴露内部模块名和加密实现文件

# 检查 Windows 驱动的 PE section
python3 -c "
import struct
data = open('driver.sys', 'rb').read()
pe_off = struct.unpack('<I', data[0x3c:0x40])[0]
nsec = struct.unpack('<H', data[pe_off+6:pe_off+8])[0]
opt_size = struct.unpack('<H', data[pe_off+20:pe_off+22])[0]
sec_start = pe_off + 24 + opt_size
for i in range(nsec):
    s = sec_start + i*40
    name = data[s:s+8].rstrip(b'\x00').decode()
    va = struct.unpack('<I', data[s+12:s+16])[0]
    ro = struct.unpack('<I', data[s+20:s+24])[0]
    rs = struct.unpack('<I', data[s+16:s+20])[0]
    print(f'{name}: VA=0x{va:x} RawOff=0x{ro:x} RawSize=0x{rs:x}')
"
```

### 4. MTK 驱动特殊模式

MTK WiFi/BT 驱动的 DAT 文件特征：
- **Magic**: `77 63 36 BE` (LE: 0xBE366377)
- **加密**: AES（Windows 驱动用 BCrypt API）
- **源码参考**: `skudecrypt.c`（SKU 数据解密模块）
- **密钥**: 硬编码在驱动 .rdata section 中，需逆向 `DecryptDATfile` 函数定位
- **MAC 地址位置**: EEPROM offset 0x04（标准 MTK 格式，6 字节）

MTK EEPROM 文件名映射（驱动 strings 中可见）：
```
EEPROM_MT7961_1.bin  → mtkwl1.dat / mtkwl1_2.dat
EEPROM_MT7922_1.bin  → mtkwl2.dat / mtkwl2_2.dat / mtkwl2s.dat
EEPROM_MT7902_1.bin  → 对应 mtkwl3/mt7902 的 DAT
EEPROM_MT7920_1.bin  → mtkwl4.dat
```

### 5. MAC 地址修改方案评估

| 方案 | 持久性 | 难度 | 适用场景 |
|------|--------|------|---------|
| OS 层覆盖（Windows 设备管理器 / Linux ip link） | 重启失效 | ★☆☆ | 临时测试 |
| 注册表 NetworkAddress | 驱动更新失效 | ★☆☆ | Windows 长期使用 |
| Linux mt76 debugfs 写 EEPROM | **永久** | ★★☆ | 有 Linux 环境 |
| 解密 DAT → 修改 → 重新加载 | 取决于实现 | ★★★ | 无 Linux / 需批量 |
| CH341A 编程器直接写 SPI Flash | **永久** | ★★★ | 外置 EEPROM 芯片 |

**Linux mt76 写 EEPROM（最推荐的硬件级方案）**：
```bash
# 读取当前 EEPROM
cat /sys/kernel/debug/ieee80211/phy0/mt76/eeprom | xxd | head
# MAC 通常在 offset 0x04-0x09
# 写入（需要 mt76 工具或自定义脚本）
```

### 6. 解密 DAT 文件的逆向要点

当必须解密 DAT 时：

1. **定位解密函数**: 搜索 `Decrypt`、`AES`、`BCrypt` 相关字符串
2. **追踪密钥来源**: 
   - Windows 驱动用 BCrypt API → 密钥通过 `BCryptGenerateSymmetricKey` 导入
   - 密钥通常在 .rdata section 中硬编码（16/32 字节）
   - 用 IDA/r2 追踪解密函数中的 LEA 指令找到密钥地址
3. **判断加密模式**: AES-ECB（每块独立）vs AES-CBC（有 IV）
4. **校验机制**: 修改后需通过驱动的完整性校验（签名/CRC）

## 常见陷阱

| 问题 | 原因 | 解决 |
|------|------|------|
| DAT 修改后驱动加载失败 | 驱动有签名校验或 CRC | 需要同时 patch 校验逻辑 |
| 熵值 ≈ 8.0 但不是加密 | 固件本身高熵（压缩/随机填充） | 检查 magic header 和 strings |
| 找不到 AES 密钥 | 密钥经过派生（PBKDF2 等） | 追踪完整密钥派生链 |
| MAC 修改后被还原 | 驱动从 EEPROM 重新读取 | 需要修改 EEPROM 本身 |
| Linux mt76 debugfs 无权限 | 需要 root + 内核 debugfs 启用 | `sudo mount -t debugfs none /sys/kernel/debug` |
