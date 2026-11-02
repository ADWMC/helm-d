# ECDLP 求解指南

> AI 编排器在遇到椭圆曲线离散对数问题 (ECDLP) 时按需加载。

| 当...时 | 使用本节 |
|---------|---------|
| 遇到椭圆曲线运算，需要选择算法 | §1 算法选择 |
| 确认必须用 C/C++ 实现 | §2 强制规则 |
| 需要对比不同曲线的性能预期 | §3 性能基准 |
| 实现 Pollard's rho 算法 | 详见 `ecdlp-pollard-rho.md` |
| 遇到非标准 ECDSA 或渐进策略问题 | 详见 `ecdlp-special-cases.md` |
| 求解过程中遇到异常行为 | §6 常见陷阱 |

## 1. 算法选择

| 曲线位数 | 算法 | 预估耗时 | 内存 |
|---------|------|---------|------|
| ≤ 32 bit | 暴力枚举 | < 1s (C) | 极低 |
| 33-64 bit | **并行 Pollard's rho + DP** | 分钟级 (C, 8线程) | 极低+DP表 |
| 33-64 bit | Pollard's rho（单线程） | 分钟-小时级 (C) | 极低 |
| 33-64 bit | Baby-step Giant-step | 分钟级 (C) | O(√n) |
| > 64 bit | 并行 Pollard's rho + DP | 天-年级 | 极低+DP表 |
| > 128 bit | **不可行** | 理论上不可能 | — |

**首选**: 并行 Pollard's rho + DP（低内存、多线程加速、DP 碰撞检测）

## 2. 强制规则

> **64-bit 以上曲线的 ECDLP → 必须用 C/C++ 实现**

- When 曲线位数 > 64, Agent 必须用 C/C++ 实现（Python 太慢）
- When 曲线位数 ≤ 64, Agent 可以用 Python 原型验证正确性后再转 C
- When 编译 C 代码, Agent 必须使用 `/O2`(MSVC) 或 `-O2`(gcc/clang)

## 3. 性能基准

| 曲线位数 | 单线程 C | 8线程+DP | Python 原型 |
|---------|---------|---------|------------|
| 32 bit | < 1s | < 1s | ~10s |
| 64 bit | ~33min | ~40s | >24h |
| 128 bit | >1年 | ~1周 | 不可能 |

## 4. 并行 Pollard's rho + DP 概述

> 完整实现模板见 `ecdlp-pollard-rho.md`。

**核心思想**：多个线程各自从独立随机起点出发，沿椭圆曲线随机游走。每个线程只记录"特殊点"（Distinguished Points）到共享 DP 表。当两个不同线程记录了相同的 DP 时（碰撞），即可求解离散对数。

**线程数选择**：`线程数 = min(CPU 核心数, 曲线位数 / 8, 16)`

**结果计算**：
1. 线程 A 记录: DP = a₁·G + b₁·target
2. 线程 B 记录: DP = a₂·G + b₂·target
3. 如果 DP 相同: (a₁-a₂)·G = (b₂-b₁)·target
4. k = (a₁-a₂) · (b₂-b₁)⁻¹ mod n

## 5. 特殊约束与渐进策略

> 完整内容见 `ecdlp-special-cases.md`。

- When 遇到非标准 ECDSA（如 r=1 约束）, Agent 必须调整目标函数
- When n > p, Agent 必须严格区分 mod n 和 mod p
- When 性能不足, Agent 必须按渐进策略逐步升级：Python 原型 → C 单线程 → C 并行

## 6. 常见陷阱

| 陷阱 | 说明 |
|------|------|
| 忘记 mod n vs mod p | 曲线坐标 mod p，标量运算 mod n，混淆会导致完全错误的结果 |
| 点在曲线上检查 | 每次点运算后检查结果是否在曲线上，帮助发现计算错误 |
| 无穷远点处理 | 点加时两个相同点需要用 point_double 而非 point_add |
| 字节序 | 二进制中的大整数可能是大端序，需要转换 |
| 素性检查 | 曲线参数 n 必须是素数，否则 Pollard's rho 不适用 |
| DP mask 选择 | d 太小 → DP 表爆炸（内存不足）；d 太大 → 碰撞太慢。推荐 d = 曲线位数/2 - 4 |
| MSVC 无 `__int128` | MSVC 用 `__umul128`（`#include <intrin.h>`）实现 64x64→128 |
