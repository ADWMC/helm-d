# GH_Loader (netease_future.exe) 完整逆向案例

网易云音乐 AI 自瞄辅助工具的 loader + DLL 注入器。本案例记录了从资源提取到 DLL 解密、从 Frida 强反调试到静态分析的完整流程。

## 文件特征

| 属性 | 值 |
|------|-----|
| 文件名 | netease_future.exe |
| 类型 | PE32+ x86-64 GUI |
| 大小 | 64.8 MB |
| .rsrc 段 | 64.5 MB (占总体 99%) |
| 编译时间 | 2026-06-05 |
| 目标进程 | cloudmusic.exe |

## 执行流程

```
1. 查找 cloudmusic.exe 进程
2. 从 RCDATA/100 解密 DLL (XOR-24, 22MB → 解密后 PE)
3. 从 RCDATA/101 读取明文归档，提取模型文件 (43MB 归档)
4. 写入共享内存 (GH_AIMBOT_ResourceDir)
5. 注入 DLL (LoadLibraryW + CreateRemoteThread)
6. DLL 启动内嵌 HTTP 服务器 (9090 端口)
```

## 资源节结构

| 资源 ID | 大小 | 内容 | 加密 |
|---------|------|------|------|
| RCDATA/100 | 22,828,032 bytes | GH_Rec_AIMBOT.dll | XOR-24 有状态加密 |
| RCDATA/101 | 42,615,276 bytes | 模型/配置文件归档 | 明文归档 |

### Resource 101 归档结构

归档内混合包含两类文件：
1. **ONNX 模型文件** — protobuf 格式，以 `0x08 0x00 0x12/0x1a` 开头（字段1 varint=0, 字段2 opset_import）
2. **AES 加密模型** — 256.aes/320.aes 完整嵌入，首 16 字节 `6b52da8e17a3db08080ae231f99f896a`

归档条目格式（逆向推断）：
```
[... 头部/校验字段 ...] [0x00 分隔符] [文件名 ASCII] [4字节 LE 大小] [数据...]
```

示例：`... 07 00 33 32 30 2e 61 65 73 1b e7 54 01 ...`
- `07` — 标志字节
- `00` — 分隔符
- `33 32 30 2e 61 65 73` — "320.aes"
- `1b e7 54 01` — 小端 0x0154e71b = 22,341,403 (文件大小)

## XOR-24 解密算法

### 密钥组成

密钥 24 字节分两部分加载（从解密函数的汇编追踪）：

```asm
; 函数内 0x61bf:
movups xmm0, xmmword ptr [rip + 0x30482]  ; 加载前16字节（指向 .rdata+0x36A48）
; ...
movabs rax, 0x99b3f18afc6642bc              ; 立即数 = 后8字节（小端 = bc4266fc8af1b399）
```

完整密钥：`7ca818b81fa4db3de4d44565fa3400c8bc4266fc8af1b399`

### 变换函数

```python
key = bytearray(initial_key)  # 24 bytes
def decrypt_byte(i):
    for j in range(24):
        key[j] = (0x25 - key[j] * 0x53) & 0xFF
    return encrypted[i] ^ key[i % 24]
```

**关键**: 每解密一字节，**全部 24 节密钥都变换一次**，不是只变换当前使用的那个字节。

### AVX 优化路径

```asm
; 当剩余字节 >= 16 时用向量化:
vpmovzxbw ymm1, xmm4      ; 扩展密钥字节到字
vpmovzxbw ymm0, xmm0      ; 扩展数据
vpmullw  ymm1, ymm1, ymm0 ; 乘 0x53
vpmovwb  xmm2, ymm1       ; 打包回字节
psubb    xmm3, xmm5, xmm2 ; 0x53 - 乘积
```

## Anti-Frida 强反调试

### 症状

```
attach → 进程存在 → 安装任何 hook → 进程瞬间崩溃/9090 停止监听
```

**确认信号**：
- 端口 9090 在 attach 后几秒内停止监听（DLL 创建的内嵌 HTTP 服务）
- 循环: 开 loader → attach → DLL 崩溃 → 重开 loader → attach → DLL 崩溃
- `Failed to attach: unexpected error allocating memory`（VirtualAllocEx 返回 0x5）
- 全量 hook 脚本比 minimal hook 崩溃更快（TypeError 累积 + hook 本身就是反调试触发点）

### 决策规则

```
Frida attach 成功但 DLL 崩溃:
  → 不是 hook 函数选错了 → 是 DLL 有强反调试
  → 2-3次不同 hook 尝试后如果都崩溃 → 立即停止 Frida
  → 不要继续尝试不同 hook 变体
  → 切换到: Python Win32 API 只读扫描 或 纯静态分析
```

### 实战记录

| 尝试 | 方法 | 结果 |
|------|------|------|
| 1 | minimal hook (仅 EVP_CipherInit_ex + AES_set_encrypt_key) | attach 后 9090 消失 |
| 2 | 全量 EVP hook (12 个函数) | TypeError + 进程崩溃 |
| 3 | 仅 CreateFileW + ReadFile + VirtualAlloc | 进程崩溃 |
| 4 | Interceptor.attach 任何一个函数 | 立即崩溃 |
| 5 | 不 hook，只用 Process.enumerateModules() | **可行** — 只读查询不触发反调试 |
| 6 | Win32 API ReadProcessMemory | **可行** — 用户态只读，不注入代码 |

**结论**: 这个 DLL 的反调试在 DLLMain 中检测 Frida agent，任何 Interceptor.attach 都会触发。只能用 Win32 API 只读操作。

## 已知明文验证

当密钥不完全确定时，用已知结构反推验证：

```python
# ONNX ModelProto 必定以 0x08 (field 1, varint) 0x00 (ir_version=0) 开头
expected = bytes([0x08, 0x00, 0x12, 0x0b])  # 假设 opset_import ~11 bytes
xor_keystream = bytes(a ^ b for a, b in zip(encrypted[:4], expected))
# 对比 xor_keystream 与 key[0:4] 经过 N 次变换后的值
```

**注意**: 因为每字节变换24次，密钥在第 N 字节处已被变换 N*24+j 次。需要逆变换或迭代验证。

## 提取成果

| 文件 | 大小 | 状态 |
|------|------|------|
| resource_100.bin (加密 DLL) | 22.8 MB | 已提取，解密需正确密钥 |
| resource_101.bin (归档) | 42.6 MB | 已提取，明文归档 |
| xor24_key.bin | 24 bytes | 从 .rdata 和代码中提取 |
| decrypted_dll.bin | 22.8 MB | 解密尝试中（key 可能不完整或算法有变体） |
| model_256.aes | 22.3 MB | 在归档内找到，AES-256 加密，密钥未知 |
| model_320.aes | 22.3 MB | 在归档内找到，AES-256 加密，密钥未知 |

## 遗留问题

1. **XOR-24 密钥验证**: 用捕获的密钥解密 resource_100 后不是 PE。可能原因：
   - 密钥捕获时已被变换（需逆变换回初始值）
   - resource_100 使用与 resource_101 不同的密钥
   - 变换函数理解有误（需更深入反汇编）

2. **AES-256 模型密钥**: 隐藏在 DLL 混淆代码中，静态无法提取。Frida 反调试阻止运行时 hook。可能方向：
   - Win32 API 只读扫描 DLL 内存找密钥派生函数的特征常量
   - 分析 loader 写入共享内存前的密钥准备逻辑
   - 在 DLL 解密完成后、加载 ONNX 前 dump 解密数据
