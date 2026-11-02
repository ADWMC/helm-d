# Android 云端下发 ELF 卡密绕过 — 通用方法论

## 问题定义

APK 为壳，真实逻辑在云端下发的 ELF 中（gzip 自解压）。验证在 Unicorn CPU 模拟器内执行，syscall 直调绕过 libc。

## 绕过策略矩阵

| 层级 | 目标 | 方法 | 可行性 |
|------|------|------|--------|
| Java 层 | OkHttp/Activity/Binder | Frida hook | 低（验证不在 Java） |
| Native 层 | libc syscall | Frida Stalker | 中（需定位 svc） |
| 模拟器层 | Unicorn UC_HOOK_MEM | unidbg | 高（推荐） |
| 内存层 | 运行时 dump flag | Frida Memory.scan | 中（需定位地址） |

## 推荐流程

### 1. 先试 Java 层（快速验证）

```bash
frida -U -f com.tongshuai.launcher.dfm2 -l frida-dfmtools-bypass.js
```

观察日志：
- 如果有 `[HTTP]` 日志 → 网络请求被拦截，可伪造响应
- 如果有 `[+]` 日志 → Java 方法被 hook，可能有效
- 如果无任何日志 → 验证不在 Java 层，转下一步

### 2. Frida Stalker 追踪 svc 指令

```javascript
// 追踪所有 svc 调用，定位验证逻辑
Interceptor.attach(Module.findExportByName(null, "svc"), {
    onEnter: function(args) {
        console.log("svc #" + args[0]);
    }
});
```

### 3. unidbg 模拟器（最终方案）

```java
// 用 unidbg 加载 Kernel.elf，hook 任意地址
AndroidEmulator emulator = new AndroidEmulator.Builder()
    .setProcessName("com.tongshuai.launcher.dfm2")
    .build();

// Hook 验证函数
emulator.getBackend().hook_add_new(new HookCallback() {
    @Override
    public void onCall(Backend backend, int size) {
        // 拦截验证逻辑
    }
}, 0xVERIFY_FUNC_ADDR, 0xVERIFY_FUNC_END, null);
```

## DFMTools 特定信息

### 关键路径

```
/data/data/com.tongshuai.launcher.dfm2/
├── shared_prefs/dfm2_prefs.xml  ← key=1555, driver=HOOK
├── files/cloud/
│   ├── Kernel (124MB ELF)  ← Unicorn 模拟器
│   └── Driver (83MB ELF)   ← Binder IPC
└── files/IPC/Main           ← IPC 入口
```

### 验证流程推测

```
App start → MainActivity.onCreate
  → CloudUpdate.checkUpdates (Java)
    → 下载 Kernel/Driver (OkHttp)
    → 写入 /data/data/.../files/cloud/
    → 执行 Kernel (root)
      → Unicorn 模拟执行验证逻辑
        → 读取卡密 (RC4 解密)
        → 与服务器验证 (syscall 直调)
        → 写入验证结果到内存
    → Driver 读取结果
      → Binder IPC 返回给 Java
  → 根据结果决定是否放行
```

### 绕过点

1. **OkHttp 拦截** — 伪造服务器返回 `{"licensed":true}`
2. **SharedPrefs 覆盖** — 设置 `licensed=true`
3. **Unicorn hook** — 拦截验证函数返回 true
4. **内存 patch** — 定位验证结果 flag 地址，写 1

## 相关脚本

- `templates/frida-dfmtools-bypass.js` — 7 层 Java 绕过脚本
