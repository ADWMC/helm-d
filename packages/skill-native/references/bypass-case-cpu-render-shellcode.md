# 案例：Shellcode 加载型验证（cpu_render）

> 日期：2026-06-23
> 二进制：ARM64 ELF 16MB，同 t3yanzheng.com 验证体系

## 核心发现

字符串（`.t3card`、`https://w.t3yanzheng.com/`、`dec_jumpout_offset.txt`）存在于 .rodata，但 **ADRP+ADD 搜索结果为零** — 没有静态代码引用这些字符串。

## 原因

验证逻辑在运行时加载的 shellcode 中，不在主二进制。特征：
- `[dec-v2] dec_context ok shellcode=0x%llx` — shellcode 加载成功
- `[dec-v2] parse shellcode failed` — 加载失败
- `com.tencent.tmgp.dfm` + `/proc/%d/mem` — 读取游戏进程内存
- 大量游戏物品名（SCAR-H、AKM 等）— shellcode 数据

## 静态分析死胡同

| 尝试 | 结果 |
|------|------|
| ADRP+ADD 搜索关键字符串 | 0 hits |
| LDR literal 搜索 | 0 hits |
| 指针表搜索 | 0 hits |
| RELA relocation 搜索 | 0 hits |
| aaa + axt | 超时 |

## 结论

当静态 ADRP+ADD 分析对关键字符串完全失效时：
1. 检查是否有 `[dec-v2]`/`[dec-v3]` 前缀字符串 → shellcode 加载框架
2. 检查 `/proc/%d/mem` → 进程内存读写
3. 转 Frida 动态分析：hook `connect`/`sendto` 拦截验证请求
