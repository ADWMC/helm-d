# ELVMP 分析工作流

> SHVMP v3.0 保护的 .elvmp 文件分析方法论。基于 ADLI.full.noad.elvmp 实战（2026-07）。

## 识别 .elvmp 文件

`.elvmp` 是 SHVMP 保护器的输出格式。本质上是一个 ELF loader + 附加加密 payload。

```bash
file target.elvmp
# 期望: ELF 64-bit LSB pie executable, ARM aarch64, dynamically linked
```

## 快速分析流程

### Step 1: 结构识别

```bash
# ELF 头 + 节表大小
readelf -h target.elvmp          # 入口点、段数、节表偏移
readelf -S target.elvmp          # 节详情，找到最后节的 end offset
readelf -l target.elvmp          # LOAD 段，检查有无 RWX

# 文件大小 vs ELF 大小
wc -c target.elvmp               # 总大小
# 最后节 end offset = ELF 实际大小
# 差值 = 附加加密 payload 大小
```

**关键判断：** 文件大小 >> 节表总大小 → 有附加加密 payload。

### Step 2: 附加数据检测

```python
# Python 熵值检测
import math
with open('target.elvmp', 'rb') as f:
    data = f.read()

# 找到 ELF 节表结束位置（从 readelf -S 输出计算）
elf_end = 0x629a  # 示例
appended = data[elf_end:]

freq = [0]*256
for b in appended[:100000]:
    freq[b] += 1
total = min(len(appended), 100000)
entropy = -sum((f/total) * math.log2(f/total) for f in freq if f > 0)
print(f'Entropy: {entropy:.2f}')  # >7.9 = 强加密

# 搜索已知签名
import re
for m in re.finditer(b'\x1f\x8b', appended[:100000]):
    print(f'Gzip at {hex(elf_end + m.start())}')
for m in re.finditer(b'PK', appended[:100000]):
    print(f'ZIP at {hex(elf_end + m.start())}')
```

### Step 3: 符号表分析

```bash
# Loader 函数（.symtab，若未 strip）
readelf -s target.elvmp | grep -E "FUNC|OBJECT" | grep -v UND
```

**典型 loader 函数：**

| 函数名 | 用途 |
|--------|------|
| `main` | 主入口，orchestration |
| `derive_key` | 本地密钥派生 |
| `decrypt_data` | 核心解密 |
| `decrypt_sensitive_sections` | 敏感节解密 |
| `fetch_key2_from_server` | 网络密钥获取 |
| `aes_ctr_crypt` | AES-CTR 实现 |
| `chacha20_crypt` | ChaCha20 实现 |
| `crc32_calc` | 完整性校验 |

### Step 4: 字符串提取

```bash
# 关键字符串
strings -n 8 target.elvmp | grep -iE "http|server|api|key|nonce|decrypt|aes|chacha|shvmp|loader|fingerprint"

# 混淆路径（/proc 变体）
strings -n 4 target.elvmp | grep "/proc"
```

**常见泄露：**
- 服务端 URL（如 `http://38.76.190.200:8080/api`）
- User-Agent（如 `shvmp-loader/3.0`）
- 请求格式（如 `{"elf_fingerprint":"%s"}`）
- 密钥字段名（如 `"key2"`, `"nonce"`）
- 混淆的 /proc 路径

### Step 5: 依赖库分析

```bash
readelf -d target.elvmp | grep NEEDED
```

**最小 loader 依赖：** 仅 libdl.so + libc.so
**完整应用依赖：** liblog, libandroid, libEGL, libGLESv3, libz 等

### Step 6: 被保护应用识别

从 .symtab 提取 payload 内的应用符号（若 loader 未 strip 且 payload 符号泄露）：

```bash
readelf -s target.elvmp | grep -v UND | grep -v "$" | awk '{print $8}' | sort -u
```

## 攻击面评估

| 方法 | 难度 | 前提 |
|------|------|------|
| HTTP 中间人截获密钥 | 低 | HTTP 明文传输，无需 TLS 绕过 |
| Hook `fetch_key2_from_server` | 低 | loader 未 strip，函数名可见 |
| Hook `decrypt_data` | 低 | dump 解密后 payload |
| Hook `execve` | 低 | 拦截最终执行的 ELF |
| 静态 derive_key 逆向 | 中 | 需反汇编分析密钥派生算法 |
| CRC32 绕过 | 低 | 修改 payload 后重算 CRC32 |

**最大弱点：** HTTP 明文传输密钥 + loader 符号完整。

## 与原始二进制对比

当同时有原始（未保护）和 .elvmp（保护后）版本时：

| 维度 | 原始 | .elvmp |
|------|------|--------|
| 大小 | N MB | ~2N MB (loader + 加密 payload) |
| Strip | 通常已 strip | loader 可能未 strip |
| .text | 全功能代码 | 仅 loader (~15-25KB) |
| 加密 | 无 | AES-CTR + ChaCha20 |
| 网络 | 可能无 | HTTP 到管理平台 |
| 反分析 | 可能有 | /proc 混淆 + ptrace + 进程隐藏 |

## 竞品报告格式

分析 .elvmp 时使用以下结构输出：

1. 基本信息（格式/大小/编译器/strip 状态）
2. 二进制结构（节表/LOAD 段/附加数据）
3. Loader 核心函数
4. 加密/密钥架构
5. 被保护应用内容
6. 反分析能力
7. 关键字符串清单
8. 与参考架构对比
9. 攻击面分析
10. 结论

## 实战案例

### ADLI.full.noad.elvmp

- 13MB ARM64 Android ELF, NDK r27d, loader 未 strip
- 25KB loader + 13.26MB 加密 payload (entropy 7.96)
- 双算法: AES-256-CTR + ChaCha20
- 两阶段密钥: derive_key (本地) + fetch_key2_from_server (HTTP)
- 服务端: http://38.76.190.200:8080/api (shvmp-loader/3.0)
- Payload 内含: C++ GUI 应用 (EGL/Vulkan/ImGui, TimeDriver, Touch, ImageDraw)
- /proc 混淆: `/proc/se/proc/sylf/e`, `/proc/cps/kerneluinf`

### qihuai追踪1.7 (原始版)

- 5.9MB ARM64 Android ELF, 已 strip, 无附加数据
- .text 2.2MB, .rodata 2.7MB — 全功能应用
- 依赖: libEGL, libGLESv3, libandroid, libz
- 功能: 双渲染引擎 (EGL+Vulkan), ImGui overlay, TwT_driver 内核驱动
- 瞄准系统: 多模式 + 陀螺仪 + 触摸瞄准 + 独立线程
- SurfaceComposerClient 系统级覆盖层
- 无任何保护: 无加密、无 HWID、无卡密、无服务端验证
