# 商业级加固标准 → ELF 保护适配

> 来源：Android APK 加固商业级标准分析。核心理念适用于所有二进制保护场景。

## 6 维度框架

```
1. 静态面 — 反编译看不到完整算法
2. 动态面 — 工具拿不到真实输入输出
3. 失败态 — 错误/fallback 也不泄露 oracle
4. 业务无侵入 — 正常功能不受影响
5. 二次打包 — 改包后 fail-closed
6. 证据闭环 — 可重复验证，不是一次性报告
```

## 核心观点：动态 Oracle 是分水岭

> "工具失败 ≠ 安全成功"
> "失败态输出可能帮助攻击者逐步缩小范围"

### 失败态设计原则

```
所有失败路径的外部可观测行为必须一致：
  - 退出码：0（不是 1）
  - stdout：无输出
  - stderr：无输出（删除所有 fprintf）
  - 擦除：栈上的密钥和中间数据
  - 执行时间：加随机延迟抹平侧信道
```

### 失败态设计矩阵（以 loader 为例）

| 失败场景 | 错误做法 | 正确做法 |
|----------|----------|----------|
| 反调试检测到 | `return 1` | `_exit(0)` + 擦除密钥 |
| HWID 获取失败 | `fprintf(stderr, ...)` + `return 1` | 静默 `_exit(0)` |
| 文件读取失败 | `return 1` | 静默 `_exit(0)` |
| 魔数校验失败 | `return 1` | 静默 `_exit(0)` + 擦除 |
| 解密失败 | `return 1` | 静默 `_exit(0)` + 擦除 |
| CRC 校验失败 | `return 1` | 静默 `_exit(0)` + 擦除密钥 |
| memfd_create 失败 | `return 1` | fallback → `mkstemp` + `unlink` |
| execve 失败 | `return 1` | 静默 `_exit(0)` |

**关键**：不同失败原因 → 相同外部行为。攻击者无法区分"解密失败"和"正常运行"。

## 保护链闭合检查

```
字符串加密 → 代码段加密 → loader 解密 → VM 执行
任何一环断裂 → 整体失效
```

| 环节 | 检查项 |
|------|--------|
| 字符串 | strings 输出是否还有关键字符串 |
| .text | 加密覆盖完整 |
| .rodata | 是否加密（常见遗漏） |
| loader | 是否明文（可直接逆向） |
| VM metadata | 操作码表是否暴露 |
| key | 是否硬编码（dump 即可拿到） |

## 二次打包 Fail-Closed

| 修改目标 | 防御要求 |
|----------|----------|
| .text 段 | 加密 + hash 校验 |
| .rodata | 加密 + hash |
| loader | loader 自身加密 |
| VM bytecode | ChaCha20 + hash |
| ELF header | 加密覆盖（已实现） |

## 证据闭环

每次保护后生成报告：
```json
{
  "input_sha256": "...",
  "output_sha256": "...",
  "cipher": "chacha20",
  "segments_encrypted": [".text"],
  "segments_not_encrypted": [".rodata"],
  "anti_debug": ["ptrace", "tracerpid", "timing"],
  "integrity_check": "crc32",
  "unpack_diff": "PASS",
  "functional_test": "PASS"
}
```

## SHVMP 实施优先级

```
P0（安全基础）:
  - 失败态统一 → _exit(0) + 擦除
  - HWID 绑定启用（删除 dead code）
  - CRC32 完整性校验
  - 加密 .rodata

P1（安全加固）:
  - loader 自身加密（双层解密）
  - VM 字节码升级 XOR → ChaCha20
  - 反 Frida（扫描 frida-agent 特征）
  - 时间侧信道（随机延迟）

P2（工程化）:
  - 保护报告生成（JSON）
  - 回归测试自动化
  - 性能基准（启动 <100ms, 运行时 <5%）
```
