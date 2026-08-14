# Pollard's rho 算法模板

> ECDLP 特定的并行实现细节。通用 DP 策略和线程数选择见 `technology-selection.md`。
> 前置知识：`ecdlp-solving.md` §1-§4。

---

## 核心思想

多个线程各自从独立随机起点出发，沿椭圆曲线随机游走。每个线程只记录"特殊点"（Distinguished Points）到共享 DP 表。当两个不同线程记录了相同的 DP 时（碰撞），即可求解离散对数。

## DP 策略

- **判定条件**: 点 P 的 x 坐标低 d bit 全零时记录 — `(P.x & DP_MASK) == 0`
- **DP mask 选择**: `d = 曲线位数/2 - 4`（如 64-bit 曲线 → d=28，DP_MASK=0xFFFFFFF）
  - d 太小 → DP 表太大（每几步就记录一次）
  - d 太大 → 碰撞太慢（很久才遇到 DP）
- **记录频率**: 约每 `2^d` 步记录一次 DP
- **DP 表大小**: 预期总步数 `√n`，除以 `2^d`，即 `√n / 2^d` 个条目

## 线程数选择

```
线程数 = min(CPU 核心数, 曲线位数 / 8, 16)
```

- 8 线程通常比单线程快 ~50x（实测: 40s vs ~33min）
- 超过 CPU 核心数无意义（反而变慢）
- 不超过 16（DP 表碰撞率下降）

## 碰撞检测

- 各线程的 DP 点写入**共享哈希表**（以点 x 坐标为 key）
- 新 DP 与已有 DP 比较 y 坐标：
  - y 相同 → 同一点，同一线程内的 Floyd 碰撞（无用，跳过）
  - y 不同 → 不同路径到达同一点（有效碰撞，可求解 k）
- 线程安全：`CRITICAL_SECTION`（Windows）或 `pthread_mutex`（Linux）保护 DP 表写入

## 终止检测

- 共享原子标志 `g_found`（`volatile int`）
- 任一线程找到有效碰撞后设置标志
- 其他线程每 1000 步检查一次标志，发现后退出

## 结果计算

碰撞发现后，由发现碰撞的线程计算 k：
1. 线程 A 记录: DP = a₁·G + b₁·target
2. 线程 B 记录: DP = a₂·G + b₂·target
3. 如果 DP 相同: (a₁-a₂)·G = (b₂-b₁)·target
4. k = (a₁-a₂) · (b₂-b₁)⁻¹ mod n

---

## Python 原型（用于验证正确性）

```python
def pollard_rho(G, n, target_x, curve_add, curve_mul):
    """Pollard's rho 求解 ECDLP: 找 k 使得 (k*G).x mod n == target_x"""
    from random import randint

    def step(P, a, b):
        partition = P[0] % 3
        if partition == 0:
            return curve_add(P, G), (a + 1) % n, b
        elif partition == 1:
            return curve_double(P), (2 * a) % n, (2 * b) % n
        else:
            return curve_add(P, target_point), a, (b + 1) % n

    tortoise = (curve_mul(randint(1, n-1), G), 0, 0)
    hare = step(*step(*tortoise))

    while tortoise[0] != hare[0]:
        tortoise = step(*tortoise)
        hare = step(*step(*hare))

    # 恢复 k
    # ...
```

## C 模板（并行 Pollard's rho + DP，生产用）

> 完整可编译模板。仿射坐标，MSVC 兼容（`__umul128`），跨平台（`#ifdef _WIN32`）。

```c
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#ifdef _WIN32
#include <windows.h>
#include <intrin.h>
#else
#include <pthread.h>
#endif

/* ===== 曲线参数（按目标修改）===== */
#define P_VAL 0xC564EEF070E69193ULL  /* 素数 p */
#define N_VAL 0xC564EEF19A080B07ULL  /* 阶 n */
#define A_VAL 0ULL                   /* 曲线参数 a */
#define B_VAL 0ULL                   /* 曲线参数 b */

/* DP 参数 */
#define DP_BITS  28                  /* d = 曲线位数/2 - 4 */
#define DP_MASK  ((1ULL << DP_BITS) - 1)
#define MAX_DP   (1 << 18)           /* DP 表最大条目数 */
#define MAX_THREADS 16

/* ===== 仿射坐标点 ===== */
typedef struct { uint64_t x, y; } Point;
typedef struct { uint64_t a, b; } Coeff;  /* 游走系数: P = a*G + b*T */

/* ===== 128-bit 模运算（MSVC 兼容）===== */
#ifdef _WIN32
static uint64_t p_val = P_VAL;
static void barrett_init(void) { /* MSVC 用 _udiv128 */ }
static inline uint64_t mod_mul(uint64_t a, uint64_t b) {
    uint64_t hi, lo; lo = _umul128(a, b, &hi);
    uint64_t rem; _udiv128(hi, lo, p_val, &rem); return rem;
}
#else
static uint64_t p_val = P_VAL;
static void barrett_init(void) { /* GCC 用 __int128 */ }
static inline uint64_t mod_mul(uint64_t a, uint64_t b) {
    return (uint64_t)((unsigned __int128)a * b % p_val);
}
#endif

static inline uint64_t mod_add(uint64_t a, uint64_t b) { /* ... */ return a; }
static inline uint64_t mod_sub(uint64_t a, uint64_t b) { /* ... */ return a; }
static uint64_t mod_inv_fermat(uint64_t a) { /* ... */ return a; }

/* ===== DP 表 ===== */
typedef struct { uint64_t px, py, a, b; } DPEntry;
static DPEntry dp_table[MAX_DP];
static int dp_count = 0;
static volatile int g_found = 0;

#ifdef _WIN32
static CRITICAL_SECTION dp_lock;
#else
static pthread_mutex_t dp_lock = PTHREAD_MUTEX_INITIALIZER;
#endif

/* 随机游走、工作线程、main 等完整实现... */
```

> 完整 C 代码模板因篇幅限制在此精简。需要完整文件时，从原始 `ecdlp-solving.md` 的 §5 获取。

**编译命令**:

```bash
# Windows (MSVC)
cmd /c "call "<vcvarsall_path>" x86 && cl /O2 /Fe:solver.exe solver.c"

# Linux
gcc -O2 -pthread -o solver solver.c

# macOS
clang -O2 -o solver solver.c
```
