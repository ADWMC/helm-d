# 代码混淆与去混淆

> 来源提炼: yaklang/hack-skills (code-obfuscation-deobfuscation)
> 覆盖垃圾代码、不透明谓词、SMC、控制流平坦化、movfuscator、VM 保护、字符串加密、导入隐藏、反反汇编

## 快速识别

| IDA/Ghidra 症状 | 疑似混淆 | 起步 |
|----------------|---------|------|
| 扁平 CFG、单一巨型 switch | 控制流平坦化 | 符号执行恢复 CFG |
| 仅 `mov` 指令 | movfuscator | demovfuscation / trace lifting |
| pushad/pushfd → VM 入口 | VM 保护 | handler 表提取 |
| 执行前 XOR 循环 | SMC / 字符串加密 | 动态分析，解码后断点 |
| 不可能条件(不透明谓词) | 垃圾代码 | 模式移除 |
| 字符串全不可读 | 字符串加密 | hook 解密函数或模拟 |
| IAT 无导入 | 导入隐藏 | trace GetProcAddress / hash 解析 |

## 垃圾代码与不透明谓词

- 垃圾代码: 写后不读的寄存器/内存、返回值丢弃无副作用调用、不变边界无用循环。用 def-use 链标记死代码。
- 不透明谓词类型:

| 类型 | 示例 | 恒为 |
|------|------|------|
| 算术 | `x² ≥ 0` | True |
| 数论 | `x*(x+1) % 2 == 0` | True |
| 指针 | `ptr == ptr` | True |
| 哈希 | `CRC32(constant) == known` | True |

去混淆: 抽象解释、符号执行(Z3 证明 `∀x`)、模式匹配、动态 trace。

```python
import z3
x = z3.BitVec('x', 32)
s = z3.Solver(); s.add(x * (x + 1) % 2 != 0)
print(s.check())  # unsat → 恒真
```

## 自修改代码 (SMC)

```asm
lea esi, [encrypted_code]
mov ecx, code_length
mov al, xor_key
decrypt_loop: xor byte [esi], al ; inc esi ; loop decrypt_loop
jmp encrypted_code
```

策略: 定位解密例程 → 循环后断点 → dump 解密内存 → 重新分析。多层重复。用 Unicorn 模拟自动化解包。

## 控制流平坦化 (CFF)

原始 `A→B→C→D` 变 dispatcher 循环，每块设 `state=next` 跳回。

恢复: angr/Triton/miasm 符号执行、Pin/DynamoRIO trace 重建、D-810(IDA 插件)。

## movfuscator

所有计算化为 `mov`(内存映射计算表)。识别: 仅 mov、数据段大查找表、内存映射标志寄存器。恢复: demovfuscator / trace+taint / 符号执行。

## VM 保护 (VMProtect / Themida / Code Virtualizer)

```
受保护代码 → 字节码编译器 → 自定义字节码
运行时: VM 入口(pushad/pushfd) → fetch → decode → execute → 退出(popad/popfd)
```

- 入口识别: pushad + pushfd + mov ebp,esp + sub esp + mov esi,bytecode_addr + jmp dispatcher
- handler 表提取: 找 dispatcher(巨型 switch/间接跳转)，每个 case=一个 VM handler，分析操作数、寄存器、字节码指针推进。
- 去虚拟化: 手工 handler 映射、REVEN/Pin trace、Triton/miasm 符号 lifting、模式匹配。
- VMProtect 特性: 不透明谓词、handler 变异、多层 VM、内置反调试+完整性检查。

## 字符串加密

| 模式 | 恢复 |
|------|------|
| XOR 循环 | hook 或模拟 XOR 函数 |
| 栈字符串(`mov [esp+0],'H'`) | FLIRT/Ghidra 脚本重组 |
| RC4 | 提取密钥离线解密 |
| AES | hook 解密后 |
| 自定义(Base64+XOR+reverse) | trace decode 函数复现 |

## 导入隐藏

GetProcAddress + hash 查表(遍历 PEB→LDR→模块列表，遍历导出表 hash 比较)。

常见 hash 算法: ROR13(Metasploit shellcode)、djb2、CRC32、FNV-1a。恢复: 识别算法 → 对已知 API 名算 hash → 建查表 → 标注调用。

## 反反汇编技巧

| 技巧 | 机制 | 修复 |
|------|------|------|
| 重叠指令 | `jmp $+2; db 0xE8` | 正确偏移重新分析 |
| 未对齐跳转 | 跳进多字节指令中部 | 目标处强制重新分析 |
| 条件跳转对 | `jz $+5; jnz $+3` | 转无条件 jmp |
| 返回地址操纵 | `push addr; ret` | 识别为跳转 |
| 异常流 | 真代码在异常处理器 | 分析处理器链 |
| call+add [esp] | 计算跳转 | 算实际目标 |

IDA: U(undefine) → C(code) 在正确偏移 → 必要时 patch。

## 工具

| 工具 | 用途 |
|------|------|
| IDA Pro + Hex-Rays | 反汇编/反编译/脚本 |
| Ghidra | 免费替代 |
| D-810 | CFF 去平坦化 |
| miasm / Triton | 符号去混淆 / 不透明谓词 |
| REVEN | 全系统 trace(VM 保护) |
| demovfuscator | mov 专用 |
| Unicorn / Capstone | 模拟 / 反汇编库 |
| x64dbg | 动态分析 |