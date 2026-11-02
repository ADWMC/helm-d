# Frida 17.x Android 兼容写法速查

## 核心 API 变更 (17.x)

| 旧 API (≤16.x) | 新 API (17.x) | 说明 |
|---|---|---|
| `Module.findExportByName('libc.so', 'open')` | `Process.findModuleByName('libc.so').enumerateExports()` 遍历 | findExportByName/getExportByName 在 17.x Android 上 TypeError |
| `Memory.readByteArray(addr, len)` | `addr.readByteArray(len)` | Memory.* 全局方法废弃 |
| `Memory.readUtf8String(addr, len)` | `addr.readUtf8String(len)` | 同上 |
| `--no-pause` 参数 | 不支持 | spawn 后手动 `device.resume(pid)` |

## 通用 findExport 兼容函数

```javascript
// 在脚本开头定义，所有 hook 统一调用此函数
function findExport(modName, expName) {
    var mod = Process.findModuleByName(modName);
    if (!mod) return null;
    var result = null;
    mod.enumerateExports().forEach(function(exp) {
        if (exp.name === expName && exp.type === 'function') {
            result = exp.address;
        }
    });
    return result;
}

// 用法
var mprotectAddr = findExport('libc.so', 'mprotect');
if (mprotectAddr) {
    Interceptor.attach(mprotectAddr, { /* ... */ });
}
```

## Spawn + Child Gating (处理 fork)

```python
import frida, time


# Spawn with environment
pid = device.spawn(
    ['/data/local/tmp/target'],
    env={'LD_LIBRARY_PATH': '/data/local/tmp:/system/lib64'},
    cwd='/data/local/tmp'
)

session = device.attach(pid)
script = session.create_script(open('hook.js').read())
script.on('message', lambda m, d: print(m.get('payload', m)))
script.load()

# Follow child processes (for forking binaries)
session.enable_child_gating()
device.on('child-added', lambda child: print(f'[CHILD] pid={child.pid}'))

device.resume(pid)
time.sleep(10)
session.detach()
```

## 内存 Dump (17.x 写法)

```javascript
var nbg = Process.findModuleByName('target');
if (nbg) {
    // RWX segment at vaddr 0x320000, size 0x12e7f0
    var rwxAddr = nbg.base.add(0x320000);
    
    // 17.x: address.readByteArray(length)
    var header = new Uint8Array(rwxAddr.readByteArray(256));
    var hex = '';
    for (var i = 0; i < header.length; i++) {
        hex += ('0' + header[i].toString(16)).slice(-2);
    }
    console.log('Header: ' + hex);
    
    // Entropy calculation
    var sample = new Uint8Array(rwxAddr.readByteArray(4096));
    var counts = new Array(256).fill(0);
    for (var j = 0; j < sample.length; j++) counts[sample[j]]++;
    var entropy = 0;
    for (var k = 0; k < 256; k++) {
        if (counts[k] > 0) {
            var p = counts[k] / sample.length;
            entropy -= p * Math.log2(p);
        }
    }
    console.log('Entropy: ' + entropy.toFixed(2));
}
```

## 常见坑

- `enumerateExports()` 返回数组，遍历匹配 `exp.name` 和 `exp.type === 'function'`
- 二进制完全 strip 后 `enumerateExports()` 返回空数组，但模块仍可 findModuleByName
- spawn 后必须 `device.resume(pid)` 才执行，hook 在 resume 前安装
- child gating 必须在 resume 前 enable
- 每个 hook 的 onEnter/onLeave 用 try/catch 包裹，一个 TypeError 会崩溃整个脚本
- `Memory.patchCode(addr, size, callback)` 在 17.x 中正常工作，用于运行时修改代码段（NOP 指令、修改跳转等）
- `Thread.sleep(seconds)` 可在 Interceptor.onEnter 中调用以阻塞线程（如阻止 exit 调用）
- shellcode 用 `svc #0` 直接系统调用时，libc exit/exit_group hook 不会触发 — 需要 patch shellcode 中的 svc 指令
- **360 jiagu 加固 app：`Java` is not defined**。jiagu hook 了 JNI 环境，Frida attach 后整个 `Java` 对象不存在（不是 `Java.perform` 失败，而是 `Java` 本身 undefined）。解决：不用 Java Bridge，用纯 Native API（`Process.enumerateModules()` + `addr.readByteArray()`）dump 解密后的 DEX。见 `skill-android/references/android-unpacking.md`
- **jiagu app `device.spawn()` 超时**：jiagu 解包过程导致 Frida 等待 app launch 超时。解决：用 `adb shell am start` 启动 app，等 6 秒后 `device.attach(pid)`
- **`Process.enumerateRanges` 脚本加载超时**：jiagu 映射大量内存区域（300+），全量枚举导致 `session.create_script()` 超时。解决：先用 `Process.enumerateModules()` 找 `base.odex`，按已知地址/大小定向 dump
