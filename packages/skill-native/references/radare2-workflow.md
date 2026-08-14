# radare2 工作流 — IDA 不可用时的二进制分析替代方案

## 安装

```bash
scoop install radare2   # Windows (已验证可用)
# 或 apt install radare2 / brew install radare2
```

## 核心工具链

| 工具 | 用途 | 速度 |
|------|------|------|
| `rafind2 -s "pattern" file` | 字符串搜索（返回偏移地址） | ⚡ 秒级 |
| `rabin2 -i file` | 导入符号列表 | ⚡ 秒级 |
| `rabin2 -s file` | 导出符号列表 | ⚡ 秒级 |
| `rabin2 -I file` | 文件信息（架构、类型、入口点） | ⚡ 秒级 |
| `r2 -q -c 'aaa; ...' file` | 完整分析（慢，>10MB 文件可能超时） | 🐌 分钟级 |

## 分析流程（推荐顺序）

### 第一步：快速信息收集（不用 r2）

```bash
# 文件类型
file target

# 架构信息
rabin2 -I target

# 导入（找 http/ssl/json/crypto 相关）
rabin2 -i target | grep -iE 'http|ssl|json|rsa|sign|curl|verify'

# 关键字符串搜索
rafind2 -s "token" target
rafind2 -s "auth" target
rafind2 -s "key" target
rafind2 -s "http" target
rafind2 -s "license" target
rafind2 -s "verify" target
```

### 第二步：r2 精准分析（不用 aaa）

```bash
# 直接跳转到字符串地址看上下文
r2 -q -c 's 0x37da51; pd 20' target

# 找 xref（需要先 aaa，但可以只做局部）
r2 -q -c 'aaa 2>/dev/null; axt @ 0x37da51' target

# 已知函数地址直接反汇编
r2 -q -c 'pd 100 @ 0xeb0254' target
```

### 第三步：批量字符串 + xref

```bash
# 用 Python + radare2 的 JSON 输出做批量分析
r2 -q -c 'aaa; izj' target 2>/dev/null | python -c "
import json, sys
data = json.load(sys.stdin)
for s in data:
    if any(k in s.get('string','').lower() for k in ['token','auth','key','verify']):
        print(f\"0x{s['offset']:x}: {s['string']}\")
"
```

## r2 命令速查

| 命令 | 说明 |
|------|------|
| `ie` | 入口点 |
| `ii` | 导入 |
| `is` | 符号 |
| `iz` | 字符串 |
| `/s pattern` | 搜索字符串 |
| `/x DEADBEEF` | 搜索十六进制 |
| `axt @ addr` | 交叉引用（谁引用了这个地址） |
| `axf @ addr` | 函数调用了谁 |
| `pdf @ addr` | 反汇编函数 |
| `pd N @ addr` | 反汇编 N 条指令 |
| `s addr` | 跳转到地址 |
| `wao nop` | 将当前指令 NOP |
| `ww 0x90 @ addr` | 写入字节 |

## 已知陷阱

1. **r2 对大文件（>10MB）的 `aaa` 很慢**：先用 `rafind2`/`rabin2` 做快速搜索，只在必要时用 `aaa`
2. **r2 的 `iz` 不如 `rafind2 -s` 快**：字符串搜索优先用 `rafind2`
3. **r2 的 xref 需要先 `aaa`**：如果 `aaa` 超时，可以手动 `s addr; /x` 搜索 ADRL/ADD 指令模式
4. **Windows 上 r2 通过 scoop 安装**：shim 自动处理 PATH
5. **IDA 和 r2 可以互补**：IDA 做深度分析，r2 做快速验证和字符串搜索
6. **⚠️ `execute_code` vs `terminal` 路径差异**：`execute_code` 用 Windows Python（`C:/` 路径），`terminal` 用 git-bash（`/tmp/`、MSYS 路径）。在 `execute_code` 中用 `r2` 或读取二进制文件时，必须用 Windows 绝对路径（如 `C:/Users/Administrator/Downloads/target.exe`），不要用 `/tmp/`。在 `terminal` 中两种路径都可以。
