# VMProtect PE 快速识别与决策

> 本文是 PE 个案观察点，不能由节名或字符串缺失确认 VMProtect、完整加密或 API hook 失效。先读 `protection-detection-methodology.md`；目标不可见时按 `packer-handling.md` 设计实验。

## 快速识别（3步内形成候选）

### Step 1: PE 节名检测
```bash
python -c "
import struct
with open('target.exe', 'rb') as f:
    data = f.read()
pe = struct.unpack_from('<I', data, 0x3C)[0]
n = struct.unpack_from('<H', data, pe+6)[0]
magic = struct.unpack_from('<H', data, pe+0x18)[0]
off = pe + 0x18 + (0xF0 if magic==0x20b else 0xE0)
for i in range(n):
    name = data[off+i*40:off+i*40+8].rstrip(b'\x00').decode('ascii','ignore')
    print(f'  {name}')
"
```

**VMP 特征节名**：
- `.winlice` / `.boot` / `.vmp0` / `.vmp1` — 曾见于特定构建；均可改名或伪造，需进一步验证入口、映射与数据流

### Step 2: 确认加密
```bash
# 搜索目标相关的静态线索；命中或未命中均不单独证明加密状态
python -c "
import re
with open('target.exe', 'rb') as f:
    data = f.read()
urls = re.findall(rb'https?://[\x20-\x7e]{8,}', data)
print(f'URLs found: {len(urls)}')
domains = re.findall(rb'[a-zA-Z0-9\-]{2,30}\.(?:com|cn|net|org|io)', data)
print(f'Domains found: {len(domains)}')
"
```

如果 URLs=0 且 Domains=0，仅说明当前搜索未命中；继续核查目标函数、资源、编码形式及静态可见性。仅当目标不可见且有相关运行时变换证据时才评估受控动态。

### Step 3: 入口点确认
```python
import struct
pe = struct.unpack_from('<I', data, 0x3C)[0]
entry_rva = struct.unpack_from('<I', data, pe+0x28)[0]
img_base = struct.unpack_from('<Q', data, pe+0x30)[0]
# entry RVA 落在候选节内只是装载入口线索，不能证明是 VM dispatcher
```

## 决策树

```
目标静态不可见且受控动态条件成立后（以下是个案候选观察手段，需校准）：
├─ 有 GUI 服务器（能运行 .exe）
│  ├─ 方案 A: Frida spawn + Nt* 导出 hook（先确认目标确实经过这些导出）
│  │  → 用 enumerateExports() 找 NtDeviceIoControlFile / NtCreateFile 等
│  │  → 捕获 DNS 查询（ioctl 0x12000f）、TCP 连接（ioctl 0x120007）
│  │  → 某些路径可绕开 Win32 API hook；需用正对照校准覆盖
│  ├─ 方案 B: Frida 内存扫描（离线验证场景）
│  │  → setTimeout 等 10-12 秒让 VMP 解包
│  │  → 扫描 UTF-16LE 中文字符串找验证消息
│  │  → pywinauto UIA 交互触发验证（Qt6 不响应 SendInput/WmChar）
│  ├─ 方案 C: Fiddler/Charles 抓包（如果有网络验证）
│  │  → 无需调试器，直接看 HTTP(S) 请求
│  │  → ⚠️ VMP 可能用直接系统调用绕过 WinHTTP/WinINET
│  └─ 方案 D: x64dbg + ScyllaHide（VMP3.x 基本不可行）
│     → ScyllaHide 插件和 CLI 注入器均被 VMP 检测
│     → 仅在 VMP 反调试较弱时可能有效
│
└─ 无 GUI 服务器（headless）
   ├─ 让用户在本地运行 + 抓包，把请求内容发回来
   ├─ 搜索社区已有 dump/patch（搜索引擎/GitHub/论坛）
   └─ 分析服务端端点（如果用户提供了域名/IP）
```

**⚠️ 前置条件：必须先处理 Windows Defender，否则进程 7 秒后退出码 33。** 见 `vmp-pe-frida-windows.md` 前置条件章节。

## 常见 VMP 保护的软件类型

- 游戏外挂/辅助工具
- 付费软件的 license 保护
- 自动化工具（如本例 "Relink自动脑机"）

这类软件通常有网络验证（卡密系统），突破口在服务端而非客户端。
