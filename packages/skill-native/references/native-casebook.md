# Native 逆向案例与流程

> 从 secplan methodology 提取的通用逆向流程与实战案例，去掉工具环境配置与框架引用。读完自行判断，非硬性规则。

## General Reverse Engineering Flow

## 通用逆向流程

```
1. 文件识别
   file target                      # 识别类型 (ELF/PE/Mach-O)
   readelf -h target.elf            # ELF 头（Windows 上可能是 pyelftools 的 readelf.py）

2. 字符串搜索
   # Windows 常无 binutils strings：用 Python / r2 替代
   python -c "import re,sys; d=open(sys.argv[1],'rb').read(); print('\n'.join(m.decode('ascii','ignore') for m in re.findall(rb'[\x20-\x7e]{4,}', d) if b'keyword' in m.lower()))" target
   rafind2 -s "keyword" target      # r2 工具链

3. IDA Pro 静态分析 (首选)
   # GUI（人机）
   # 自动化：IDA headless 批处理（禁止 idat -A）

4. Ghidra 静态分析 (开源替代)

5. Patch 验证
   # IDA: Patch → Patch program → Apply patches
   # r2 (备选): r2 -q -c 's 0xADDR; wa b 0xTARGET; w -' target
```

### PE Loader/DLL 注入分析（实战经验）

导入 `CreateRemoteThread` + `WriteProcessMemory` + `FindResourceW` → 资源提取型 DLL 注入器。

#### 分析流程

1. **资源提取**：Python struct 解析 PE 资源目录，提取 RCDATA 节
2. **XOR 解密**：追踪 `FindResourceW→LoadResource→解密函数` 调用链，提取密钥和变换算法
3. **内存 Dump**：Frida 逐 4KB dump 注入的 DLL，修正节表（RawOffset=RVA, RawSize=VirtSize）
4. **验证定位**：字符串引用追踪 LEA [rip+disp32]，找到 `test al,al / je` 分支
5. **Bypass**：patch 标志位（不是 patch 跳转！），NOP 路由条件，修改响应模板
6. **密钥捕获**：hook OpenSSL/BCrypt 时注意区分多组密钥（license 用 vs 数据解密用），根据调用时机和密钥长度判断



## Case Study: GH_Loader (netease_future.exe)

## 实战案例：GH_Loader (netease_future.exe)

**案例背景**: 网易云 AI 自瞄辅助 loader，64MB PE，.rsrc 节占 64.5MB，注入 cloudmusic.exe。

**反调试特征**: 任何 Frida attach 后 9090 端口停止监听，循环崩溃。

**完整分析记录**（`gh-loader-anti-frida-case.md`）：

| 阶段 | 方向 | 结果 |
|------|------|------|
| 资源提取 | Python struct 解析 PE 资源目录 | 找到 RCDATA/100 (22MB DLL) + RCDATA/101 (42MB 归档) |
| 密钥追踪 | 反汇编找 XOR 密钥加载 | `movups` + `movabs` 提取 24 字节密钥 |
| 解密验证 | XOR-24 有状态变换 | 解密后不是 PE，说明密钥可能被捕获时已过变换 |
| 归档解析 | Resource 101 结构分析 | 发现明文归档包含 ONNX 模型 + AES-256 加密模型 |

### XOR-24 有状态算法详解

```python
key = bytearray(initial_key)  # 24 bytes from .rdata
def decrypt_byte(i):
    for j in range(24):
        key[j] = (0x25 - key[j] * 0x53) & 0xFF
    return encrypted[i] ^ key[i % 24]
```

**关键**: 每解密一字节，全部 24 节密钥都变换一次（不是只变换当前使用的字节）。



## Packer/Protector Decision Tree

## 加壳二进制分析决策树

```
拿到加壳二进制后:
  1. 检测保护器类型
     strings target | grep -iE 'TUSI|UPX|VMProtect|Themida|OLLVM|VMP'
     xxd -s 0xBE -l 32 target        # ELF header padding 区域
     strings target | tail -20         # 文件末尾 trailer
     # PE 快速检测 VMP：检查节名
     python -c "
     import struct
     with open('target', 'rb') as f:
         data = f.read()
     pe = struct.unpack_from('<I', data, 0x3C)[0]
     n = struct.unpack_from('<H', data, pe+6)[0]
     magic = struct.unpack_from('<H', data, pe+0x18)[0]
     off = pe + 0x18 + (0xF0 if magic==0x20b else 0xE0)
     for i in range(n):
         name = data[off+i*40:off+i*40+8].rstrip(b'\x00').decode('ascii','ignore')
         if name in ('.winlice','.boot','.vmp0','.vmp1'):
             print(f'VMProtect detected: section {name}')
     "

  2. 根据保护器选择策略
     ┌─ 标准 UPX (签名 "UPX!")
     │  → upx -d target
     │  → 失败则修改签名重试
     │
     ├─ TUSI-ObfuscatorClang (签名 "UPX_BySpra", 文件末尾有 "TUSI-Obfus")
     │  → 静态不可解压 (定制 NRV2B)
     │  → 立即转 Frida 动态脱壳 (hook /dev/shm + write)
     │  → 参考 bypass-case-tusi-netease.md
     │
     ├─ VMProtect (PE 节含 `.winlice` + `.boot`，或 ELF 含 `.vmp0`/`.vmp1`)\n     │  → **静态分析完全无效** — 字符串/代码/URL 全部加密\n     │  → 立即停止静态分析，不尝试 strings/xrefs/反汇编\n     │  → 2 步内必须做出策略选择，不要在静态分析上反复尝试\n     │  → 策略选择：\n     │    1. 有 GUI 服务器 → Frida spawn + pywinauto UIA 交互（见 vmp-pe-frida-windows.md）\n     │    2. 无 GUI 服务器 → 让用户本地抓包(Fiddler/Charles)或 x64dbg\n     │    3. 判断验证类型：netstat + ipconfig /displaydns → 网络 vs 离线\n     │    4. 离线验证 → Frida 内存扫描找验证字符串 → x64dbg 内存断点追溯\n     │  → **关键**：VMP 用直接系统调用，Frida API hook 全部无效，不要浪费时间换 hook 目标\n     │  → 参考 vmp-pe-frida-windows.md（PE 实战）和 vmp-elf-protection.md（ELF 架构）
     │
     ├─ Themida / Enigma / Obsidium
     │  → 类似 VMP，转动态分析
     │
     └─ OLLVM (控制流平坦化)
        → IDA/Ghidra + 反混淆脚本

  3. 如果是卡密验证，再检查:
     rafind2 -s "--skip" target         # 调试后门参数
     rafind2 -s "--debug" target
     rafind2 -s "--no-auth" target
     → 有则零成本绕过，无则继续分析

  4. ADRP+ADD 搜索不到关键字符串？
     → 字符串存在但代码引用它们的方式不是标准 ADRP+ADD
     → 常见原因: 验证逻辑在运行时加载的 shellcode 中
     → 特征: dec-v2/dec-v3 前缀字符串、shellcode 指针、/proc/pid/mem
     → 转 Frida 动态分析: hook connect/sendto 拦截验证请求
```



## Large File Analysis (>10MB)

## 大文件（>10MB）分析

```
问题: IDA/Ghidra 的自动分析在大二进制上较慢
解决: 用字符串搜索替代全量分析

步骤:
  strings -n 8 "关键字符串" target    # 定位字符串地址
  objdump -d -j .text target       # 直接看 .text 节
  避免: 在 IDA/Ghidra 上跑全量 auto analysis (可先取消勾选)
```



## Bypass & Patch Priority

## 绕过与Patch优先级

```
优先级:
  1. 找启动参数（--skip-auth / --debug / --no-auth）
     → 搜索字符串表中的 "--" 开头字符串
     → 搜索 strcmp/strncmp 调用集群
     → 如果存在 → 零成本绕过

  2. 找条件分支跳过验证
     → 找到验证函数的调用点
     → 找调用前的条件判断（cbz/tbz/tbnz）
     → 把条件跳转改为无条件跳转（b target）

  3. 替换函数体
     → 仅在前两种不可行时使用
     → 需要完全理解调用约定和寄存器用途
     → 风险高，容易crash
```
