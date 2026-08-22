# 案例：TUSI-ObfuscatorClang 保护的 Android .so 卡密分析

> 来源实战：网易云 1.5 版 .so，ARM64 native 库，含卡密验证  \
> 日期：2026-06-23  \
> 工具链：radare2 + Python capstone + strings (mingw) + Frida  \
> 架构：ARM64 (AArch64), PIE, stripped, statically linked

---

## 一、目标特征

```
文件类型:  ELF 64-bit LSB shared object, ARM aarch64
链接:      静态链接, stripped, 无 section headers
保护器:    TUSI-ObfuscatorClang (商业级)
壳类型:    UPX_BySpra (定制 UPX 变体, NRV2B 压缩)
文件大小:  ~15MB
导出符号:  无 (无 dynamic section, 无 symtab)
```

---

## 二、TUSI 识别标志（关键！）

在文件末尾 trailer 区域（最后 ~700 字节）搜索以下标记：

```
偏移 (相对文件末尾)   内容                      含义
──────────────────────────────────────────────────────────
-0x29C               "Linker: LLD 19.0"        伪造链接器字符串
-0x289               "TUSI-Obfus"              ← 核心标识！
-0x27F               "catorClang vJsionI1Magic" TUSI 版本+魔数
-0x263               "(https://t.me/..."        作者联系方式
-0x220~              ".text", ".bss", ".dynstr"  原始 ELF section 名残留
```

**快速检测命令**：
```bash
# 方法 1: rafind2
rafind2 -s "TUSI" target.so
rafind2 -s "UPX_By" target.so
rafind2 -s "Linker: LLD" target.so

# 方法 2: strings
strings -n 8 target.so | grep -iE 'TUSI|UPX_By|Linker: LLD'

# 方法 3: 查看 ELF header padding (offset 0xBE 附近)
xxd -s 0xBE -l 32 target.so
# 正常 UPX: "UPX!" (4 bytes)
# TUSI 变体: "UPX_BySpra" (10 bytes, 用 0x0a 填充)
```

### TUSI vs 标准 UPX 区别

| 特征 | 标准 UPX | TUSI-ObfuscatorClang |
|------|----------|---------------------|
| 签名 | `UPX!` | `UPX_BySpra` |
| 压缩算法 | NRV2B/2D/9D 或 LZMA | NRV2B (定制修改) |
| `upx -d` | ✅ 可解压 | ❌ "not packed by UPX" |
| 字符串 | 明文可搜索 | 全部加密 |
| 反调试 | 无 | ptrace/TracerPid 检测 |
| 解壳方式 | 原地解压 | /dev/shm + mmap |

---

## 三、TUSI 运行时解壳流程

```
Entry (TUSI stub)
  │
  ├─ skip 函数: 跳过 NULL 指针数组
  │
  ├─ mmap(NULL, BSS_size, RW, MAP_ANON, -1, 0)  ← 分配解压缓冲区
  │
  ├─ NRV2B 解压函数
  │   ├─ bit reader (大端位流, 32-bit 缓冲)
  │   ├─ read_number (变长编码)
  │   └─ 主循环: literal byte + back-reference copy
  │
  ├─ openat(AT_FDCWD, "/dev/shm", O_RDWR|O_CREAT, 0700)
  │   → 在 /dev/shm 创建临时文件（覆盖同名目录/文件）
  │
  ├─ write(fd, decompressed_code, size)
  │   → 写入解压后的原始 ELF 代码
  │
  ├─ mmap(NULL, size, PROT_READ|PROT_EXEC, MAP_SHARED, fd, 0)
  │   → 映射为可执行内存
  │
  ├─ close(fd)
  │
  └─ br (mapped_code + 0x14)  ← 跳转到原始 OEP
```

### 解壳代码地址映射 (本案)

```
文件偏移       虚拟地址        功能
──────────────────────────────────────────
0xEDD3BC      0x81dcd3bc     Entry point (TUSI stub 入口)
0xEDD4F8      0x81dcd4f8     skip 函数 (跳过 NULL 数组)
0xEDD504      0x81dcd504     NRV2B 解压主函数
0xEDD544      0x81dcd544     bit reader (32-bit 大端)
0xEDD55C      0x81dcd55C     read_number (变长解码)
0xEDD580      0x81dcd580     解压主循环
0xEDD434      0x81dcd434     openat + write + mmap 序列
0xEDD5E0      0x81dcd5e0     "upx" 字符串 (解压函数附近)
0xEDD7FE      (data)         "/proc/self/exe" 路径
0xEDD428      0x81dcd428     "/dev/shm" 路径
```

---

## 四、绕过策略评估

### ❌ 策略 1: 标准 UPX 解压

```bash
upx -d target.so                    # "not packed by UPX"
upx -d -f target.so                 # 同上，--force 无效
# 修改签名 "UPX_BySpra" → "UPX!" 也不行，算法有定制
```

**结论**: TUSI 的 NRV2B 有定制修改，标准 UPX 无法解压。

### ❌ 策略 2: Python 手动 NRV2B 解压

实现 NRV2B 解压器后扫描整个文件，未找到有效 ELF 输出。

**原因**: TUSI 对 NRV2B 的 bit reader 或 offset 编码做了修改（可能改变了 read_number 的循环条件或 offset 的字节序）。

### ❌ 策略 3: 静态搜索硬编码绕过标志

```bash
# 搜索 --skip-auth / --debug / --no-auth 等
rafind2 -s "skip" target.so         # 无结果
rafind2 -s "debug" target.so        # 无结果
rafind2 -s "auth" target.so         # 无结果
strings target.so | grep -i "kami"  # 无结果
```

**结论**: 所有验证字符串在压缩数据内部，静态不可见。

### ✅ 策略 4: Frida 动态脱壳 + 验证绕过（推荐）

在 Android 设备/模拟器上用 Frida hook：

1. **Hook openat**: 拦截 "/dev/shm" 文件创建
2. **Hook write**: 检测写入大块数据（可能含 ELF magic）
3. **Hook mmap**: 记录 PROT_EXEC 映射地址
4. **Dump 解压后的 .so** → 用 radare2 分析验证逻辑
5. **Hook strcmp/strncmp**: 拦截卡密比较

```javascript
// 核心 Frida hook 片段（Frida 17.x API）
const libc = Process.getModuleByName("libc.so");
Interceptor.attach(libc.getExportByName('openat'), {
    onEnter: function (args) {
        var path = args[1].readUtf8String();
        if (path && path.indexOf('/dev/shm') !== -1) {
            console.log('[TUSI] /dev/shm opened: ' + path);
        }
    }
});

Interceptor.attach(libc.getExportByName('write'), {
    onEnter: function (args) {
        var size = args[2].toInt32();
        if (size > 0x1000) {
            try {
                var header = args[1].readByteArray(4);
                var view = new Uint8Array(header);
                if (view[0]===0x7f && view[1]===0x45 && view[2]===0x4c && view[3]===0x46) {
                    console.log('[TUSI] ELF detected! Dumping...');
                    var fd = new File('/data/local/tmp/unpacked.so', 'wb');
                    fd.write(args[1].readByteArray(size));
                    fd.close();
                }
            } catch(e) {}
        }
    }
});
```

### ⚠️ 策略 5: QEMU 用户模式模拟 (需要 Linux)

```bash
# 在 Linux 上安装 qemu-user-static
apt install qemu-user-static

# 配置 Android ARM64 运行环境 (需要 linker64 + libc.so)
# 运行 .so 并 dump 解压后的内存
qemu-aarch64-static -L /path/to/android-sysroot target.so
```

**限制**: Windows 上只有 qemu-system-aarch64 (系统模式)，无用户模式。

---

## 五、NRV2B 解压算法参考 (标准版)

TUSI 使用的 NRV2B 可能有定制，但标准算法如下（供对比）：

```python
def nrv2b_decompress(src, dst_size):
    """标准 NRV2B 解压器（仅供参考，TUSI 版本可能不同）"""
    dst = bytearray(dst_size)
    src_pos, dst_pos = 0, 0
    bits = 0
    bit_count = 0

    def get_bit():
        nonlocal bits, bit_count, src_pos
        bit_count -= 1
        if bit_count < 0:
            bits = struct.unpack_from('>I', src, src_pos)[0]
            src_pos += 4
            bit_count = 31
        return (bits >> bit_count) & 1

    while dst_pos < dst_size:
        if get_bit():  # literal
            dst[dst_pos] = src[src_pos]; src_pos += 1; dst_pos += 1
        else:          # back reference
            m_off = 1
            while True:
                m_off = (m_off << 1) | get_bit()
                if not get_bit(): break
                m_off = (m_off << 1) | get_bit()
                if not get_bit(): break
            if m_off >= 3:
                m_off_hi = src[src_pos]; src_pos += 1
                m_off = ~((m_off_hi | (m_off << 8)) & 0xFFFFFFFF)
                if m_off == 0: break
            else:
                m_off = -1

            b1, b2 = get_bit(), get_bit()
            if b1 or b2:
                m_len = ((b1 << 1) | b2) + 2
            else:
                m_len = 1
                while True:
                    m_len = (m_len << 1) | get_bit()
                    if not get_bit(): break
                    m_len = (m_len << 1) | get_bit()
                    if not get_bit(): break
                m_len += 2
            if m_off < -0xD00: m_len += 1
            for _ in range(m_len + 1):
                if dst_pos >= dst_size: break
                dst[dst_pos] = dst[dst_pos + m_off]
                dst_pos += 1
    return bytes(dst)
```

---

## 六、关键教训

### 0. 先检测保护器类型

```
逆向优先级（加壳二进制）:
  1. strings target | grep -iE 'TUSI|UPX|VMProtect|Themida|OLLVM'
  2. xxd -s 0xBE -l 32 target  (检查 ELF header padding)
  3. rafind2 -s "TUSI" target
  4. 查看文件末尾 trailer 区域

保护器决定绕过策略:
  - 标准 UPX      → upx -d
  - TUSI          → Frida 动态脱壳
  - VMProtect     → 需要专用工具
  - OLLVM         → 控制流反混淆
```

### 1. TUSI 保护的特征组合

```
当同时出现以下特征时，几乎可以确认是 TUSI:
  ✗ "UPX_BySpra" 或 "UPX_By" 在 ELF header padding
  ✗ /dev/shm 和 /proc/self/exe 在代码段
  ✗ "TUSI-ObfuscatorClang" 在文件末尾
  ✗ "Linker: LLD" 伪造链接器字符串
  ✗ 无 section headers, 无 exports, 无 imports
  ✗ 标准 UPX 无法解压
```

### 2. 静态分析极限判断

```
当遇到以下情况时，应放弃静态分析转动态:
  - 保护器检测到 TUSI/VMProtect/Themida
  - 无硬编码调试参数
  - 无明文字符串
  - 标准解压工具失败
  → 立即转 Frida 动态方案，不要在静态上浪费时间
```

### 3. /dev/shm 是 TUSI 的标志性行为

```
TUSI 解壳时创建 /dev/shm 临时文件:
  - 在 Android 上，/dev/shm 可能不存在
  - openat(AT_FDCWD, "/dev/shm", O_CREAT|...) 创建的是文件而非目录
  - 这是 Frida hook 的最佳拦截点
  - 检测到 write 大块数据 + ELF magic → dump 解压后的代码
```

---

## 七、文件清单

| 文件 | 说明 |
|------|------|
| `15e09edebe45176f.so` | 原始 TUSI 保护的 .so |
| `tusi_unpack_bypass.js` | Frida 脱壳+绕过脚本 (通用模板) |
