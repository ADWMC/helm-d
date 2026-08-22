# Android 加固识别与脱壳

> 常见加固方案识别特征 + Frida 内存 dump DEX 的 3 种策略 + 验证步骤。

| 当...时 | 使用本节 |
|---------|---------|
| 需要识别应用是否加固 | §1 常见加固识别特征 |
| 需要选择脱壳策略 | §2 脱壳策略选择 |
| 需要 Frida dump DEX | §3 Frida 内存 dump |
| 需要验证脱壳完整性 | §4 验证步骤 |

## 常见加固识别特征

### AndroidManifest.xml 特征

| 加固方案 | 特征 |
|---------|------|
| **梆梆加固** | `com.secneo.apkwrapper`（Application 类名）+ `libsecexe.so` / `libsecmain.so` |
| **360 加固** | `com.stub.StubApp`（Application 类名）+ `libjiagu.so` / `libjiagu_art.so` |
| **腾讯乐固** | `com.tencent.StubShell.TxAppEntry`（Application 类名）+ `libshell-super.2019.so` / `libshella-2.10.5.1.so` |
| **爱加密** | `com.ijiami.ijmip`（Application 类名）+ `libijiami.so` |
| **网易易盾** | `com.netease.nis.bugrpt.CrashHandler` + `libnesec.so` |
| **百度加固** | `com.baidu.protect.Interceptor` + `libbaiduprotect.so` |
| **阿里聚安全** | `com.alibaba.wireless.security.open.*` + `libmobisec.so` |
| **腾讯御安全** | `com.tencent.bugly.crashreport.CrashReport` + `libtup.so` |
| **梆梆企业版** | `com.secneo.guard.NeoGuardApplication` + `libneoguard-core.so` |

### 通用判断方法

```bash
# 1. 解包 APK
apktool d app.apk -o unpacked/

# 2. 检查 Application 类名
grep -i "application" unpacked/AndroidManifest.xml | head -5

# 3. 检查 lib/ 目录
ls -la unpacked/lib/*/ | grep -v "^d"

# 4. 检查 classes.dex 大小
# 加固 APK 通常只有一个很小的 classes.dex（壳代码），原始 DEX 被加密存储
ls -la unpacked/classes.dex
```

---

## 脱壳方法论

### 策略 1：maps 扫描（推荐）

**原理**：扫描 `/proc/<pid>/maps` 中的 DEX 文件映射，直接从内存读取。

**优点**：稳定，不依赖 Java Bridge。**缺点**：可能漏掉未被 mmap 映射的 DEX。

```
1. 读取 /proc/<pid>/maps
2. 查找包含 "dex" 或 ".odex" 或 ".vdex" 的内存区域
3. 读取每块区域的前 8 字节，检查 DEX magic（"dex\n035\0" 或 "dex\n036\0" 等）
4. 读取 DEX header 中的 file_size 字段
5. 从基址读取完整 DEX 数据
6. 保存到文件
```

### 策略 2：全量扫描

**原理**：扫描进程全部可读内存区域，逐块搜索 DEX magic。

**优点**：最全面，能找到所有 DEX。**缺点**：耗时较长（大进程可能需要 30-60 秒）。

```
1. Process.enumerateRanges('r--')  获取所有可读内存区域
2. 对每个区域执行 Memory.scan 搜索 DEX magic: "64 65 78 0a"（"dex\n"）
3. 对每个匹配地址读取 DEX header，验证完整性
4. 读取完整 DEX 数据并保存
```

### 策略 3：ClassLoader 枚举

**原理**：通过 Java Bridge 枚举 ClassLoader 加载的所有 DEX。

**优点**：精确，直接对应 ClassLoader 的 DEX。**缺点**：依赖 Java Bridge（frida 17.x Python SDK 需 Compiler 编译）。

```javascript
Java.perform(function() {
    // 获取当前应用的 ClassLoader
    var app = Java.use("android.app.ActivityThread").currentApplication();
    var classLoader = app.getClassLoader();

    // 通过反射获取 DexPathList
    var pathList = Java.cast(
        classLoader.loadClass("dalvik.system.BaseDexClassLoader")
            .getDeclaredField("pathList")
            .get(classLoader),
        Java.use("dalvik.system.DexPathList")
    );

    // 遍历 dexElements
    var dexElements = pathList.dexElements.value;
    for (var i = 0; i < dexElements.length; i++) {
        var dexFile = dexElements[i].dexFile.value;
        // 读取 dexFile 的 cookie 获取内存中的 DEX
    }
});
```

---

## 推荐流程

```
1. 识别加固类型（见上表）
2. 启动 frida-server（scripts/manage_frida.py --action start）
3. 启动目标 app（等待加固壳解密 DEX）
4. 使用全量扫描 dump DEX（策略 2，最全面）
5. 验证 dump 结果
```

---

## 验证步骤

### 1. 检查 DEX 文件数量和大小

```bash
ls -la output_dir/*.dex
# 预期：多个 DEX，总大小与原 APK 的 classes*.dex 差异大（脱壳后更大）
```

### 2. 验证 DEX 头部

```bash
# 每个 DEX 应以 "dex\n" 开头
xxd output_dir/classes.dex | head -2
# 00000000: 6465 780a 3337 00...  dex.37.
```

### 3. 使用 jadx 反编译验证

```bash
jadx -d java_src output_dir/classes.dex
# 检查反编译结果中是否有业务代码（不是壳代码）
```

### 4. 检查类数量

```bash
# 使用 dexdump
dexdump -f output_dir/classes.dex | grep "class_def" | wc -l
```

---

## 360 加固 (jiagu) 特殊行为

360 jiagu 不仅加密 DEX，还主动干扰 Frida 的 Java Bridge：

| 症状 | 原因 | 解决 |
|------|------|------|
| `Java` is not defined（脚本 attach 后） | jiagu hook 了 JNI 环境，阻止 Frida 获取 Java VM | 不用 Java Bridge，改用纯 Native 策略 1/2 |
| `device.spawn()` 超时 | jiagu 解包过程耗时长，Frida 等待 app launch 超时 | 用 `adb shell am start` 先启动 app，再 `device.attach(pid)` |
| `Process.enumerateRanges` 脚本加载超时 | jiagu 映射大量内存区域（300+），全量扫描导致 `session.create_script` 超时 | 先 `Process.enumerateModules()` 找 `base.odex`，按已知地址/大小 dump |
| 第三方注入工具 attach 超时 | 第三方 server 不完全兼容 frida spawn/attach 协议 | 换官方 frida-server |
| 云机端口变化 | 云手机 VM 每次重启分配新端口 | 每次分析前 `adb connect` + `adb devices` 确认 |

### jiagu 推荐 dump 流程（不依赖 Java Bridge）

```python
import frida, subprocess, time

# 1. 启动 app（不用 frida spawn）
subprocess.run(["adb", "-s", SERIAL, "shell", "am", "start",
                "-n", "com.example/.MainActivity"])
time.sleep(6)  # 等 jiagu 解包

# 2. 获取 PID
result = subprocess.run(["adb", "-s", SERIAL, "shell", "pidof", "com.example"],
                      capture_output=True, text=True)
pid = int(result.stdout.strip())

# 3. Attach
session = device.attach(pid)

# 4. 用纯 Native JS dump（不依赖 Java.perform）
dump_script = """
// 先枚举模块找到 base.odex
var modules = Process.enumerateModules();
var baseOdex = null;
for (var i = 0; i < modules.length; i++) {
    if (modules[i].name === "base.odex") {
        baseOdex = modules[i];
        break;
    }
}
if (baseOdex) {
    // base.odex 是 OAT 格式，DEX 嵌入其中
    // 读取头部验证 magic
    var hdr = new Uint8Array(baseOdex.base.readByteArray(8));
    // 然后按模块大小 dump 整个 odex
    var CHUNK = 64 * 1024;
    var offset = 0;
    while (offset < baseOdex.size) {
        var toRead = Math.min(CHUNK, baseOdex.size - offset);
        var chunk = baseOdex.base.add(offset).readByteArray(toRead);
        send({type: 'chunk', offset: offset}, chunk);
        offset += toRead;
    }
    send({type: 'done', size: offset});
}
"""
# 5. 收集 dump 数据并保存
```

**关键点**：`Process.enumerateModules()` 在 jiagu 下正常工作（纯 Native），但 `Process.enumerateRanges()` 可能因范围太大导致脚本加载超时。优先用模块枚举。

### DEX magic 识别

| Magic | 含义 |
|-------|------|
| `64 65 78 0a 30 33 35 00` | DEX 035 (Android ≤12) |
| `64 65 78 0a 30 33 37 00` | DEX 037 (Android 13+) |
| `6f 61 74 0a` | OAT (包含嵌入式 DEX) |
| `64 65 79 0a` | DEY (优化 DEX) |

读取 DEX file_size：偏移 32 处 4 字节小端序。

## frida 17.x 注意事项

- **frida CLI**：可直接加载 JS 脚本（策略 1/2 的 Native 代码不需要 Java bridge）
- **Python SDK**：
  - 策略 1/2（纯 Native）：可用纯 JS 字符串 `session.create_script(js)`
  - 策略 3（Java Bridge）：需用 `frida.Compiler` 编译 TypeScript（详见 `frida-17x-bridge.md`）
- 使用 `scripts/dex_dump.py` 自动化 dump
