# elf-got-patcher：ARM64 ELF GOT Hook 注入工具

> 仓库：https://github.com/LeoChen-CoreMind/elf-got-patcher
> 用途：纯 C shellcode + JSON 配置驱动的 GOT hook，零侵入修改 ELF
> 架构：ARM64 (AArch64)，PIE 目标

## 触发条件

当用户需要以下操作时加载本文件：
- hook/劫持 ELF 的外部函数调用（GOT hook）
- 注入 shellcode 到 ARM64 二进制
- 替换出站网络数据（如修改 App ID、协议字段）
- 分析 OLLVM 混淆二进制的网络行为
- 在 .init_array 执行初始化时注入自定义逻辑
- 需要绕过代码签名校验（不改代码段，只改 GOT）

## 工具定位

| 场景 | 推荐方案 |
|------|---------|
| 只需跳过一个条件分支 | radare2 手动 patch（更简单） |
| 需要 hook 外部函数/拦截数据流 | elf-got-patcher |
| 目标有 OLLVM GOT 混淆 | elf-got-patcher（内置 got_addend 解混淆） |
| 需要运行时动态 hook | Frida（更灵活但需 root） |

## 快速使用

### 编译

```bash
# 需要 Android NDK（设置 ANDROID_NDK 环境变量）
# Windows: build.bat
# Linux/Mac:
cd shellcode && make NDK=$ANDROID_NDK
cd ../patcher && gcc -O2 -o patcher main.c
```

### Patch 流程

```bash
# 1. 编译 shellcode
build.bat          # 或 make

# 2. 准备 JSON 配置（参考 configs/ 下的模板）

# 3. 运行 patcher
./patcher.exe configs/my_target.json

# 4. 推送到设备
adb push output_patched /data/local/tmp/
adb shell "su -c 'cp /data/local/tmp/output_patched /target/path; chmod 755 /target/path'"
```

## JSON 配置字段速查

| 字段 | 含义 | 获取方式 |
|------|------|----------|
| `input` | 原始 ELF 路径 | — |
| `output` | 输出路径 | — |
| `payload` | shellcode/hook.bin 路径 | — |
| `cave_va` / `cave_off` | code cave 地址 | `readelf -l` 找 r-x PT_LOAD 零填充区 |
| `rela_addend_off` | RELA addend 偏移 | `readelf -r` 找 `.init_array` 的 `R_AARCH64_RELATIVE` |
| `orig_init` | 原始 init VA | RELA addend 原值 |
| `got_sendto` | 目标函数 GOT VA | IDA 跟踪 wrapper → LDR 取 GOT |
| `got_addend` | GOT 混淆常量 | IDA 中 wrapper 的 MOVZ+MOVK×3（0=无混淆） |
| `saved_sendto` | BSS 空闲槽 VA | `readelf -l` 末尾 rw- PT_LOAD 的 BSS 区 |
| `needle` / `replace` | 搜索/替换字符串 | 应用特定（必须等长，≤32字节） |
| `scan_max` | 最大扫描字节数 | 防越界，建议 504 |
| `debug_flag` | 调试开关 | 0=关，1=开 |
| `debug_path` | 日志路径 | 设备上的路径 |

## 工作原理

```
程序启动
  │
  ├─ 动态链接器解析 .init_array
  │   └─ RELA addend 指向 cave → 调用 init_wrapper()
  │       ├─ ① 调用原始 init（保持程序语义）
  │       ├─ ② 读 GOT[target]，减去混淆常量 → 真实函数地址
  │       ├─ ③ 真实地址存入 BSS 槽
  │       └─ ④ hook_func 写入 GOT[target]
  │
  └─ 程序调用 target_func()
      └─ 实际跳转 hook_func()
          ├─ 扫描 buf，替换 needle → replace
          └─ 尾调用真实 target_func()
```

## Hook 其他函数

默认 hook `sendto`。Hook 其他函数：

1. 修改 `hook.c` 中 `[CUSTOMIZE]` 注释处的 typedef 和函数签名
2. 调整 `scan_and_replace` 的 buffer/length 参数
3. JSON 中 `got_sendto` 填目标函数的 GOT VA
4. 参数布局相同的函数（如 `write`、`send`）只改 JSON 地址即可

## 关键设计

| 特性 | 说明 |
|------|------|
| 纯 C shellcode | 不用手编 ARM64 hex，可读可改 |
| `-mcmodel=tiny` | 纯 PC 相对寻址，任意 code cave 都能工作 |
| 哨兵配置池 | `0xCAFEBABE` 标记，patcher 动态填充地址 |
| ASLR 安全 | 运行时计算基址偏移 |
| 零侵入 | 只写 code cave + 改 RELA addend，不动代码段 |

## 常见问题

| 问题 | 解决 |
|------|------|
| code cave 找不到 | `readelf -l` 找 r-x PT_LOAD 段末尾的零填充 |
| GOT 混淆解不开 | IDA 中找 MOVZ+MOVK×3 指令序列，提取 64 位常量 |
| hook 后 crash | 检查 `got_addend` 是否正确，BSS 槽是否真的空闲 |
| 函数参数布局不同 | 修改 hook.c 中的参数顺序和传递方式 |
