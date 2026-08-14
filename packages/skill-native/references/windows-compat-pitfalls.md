# Windows 兼容性坑点汇总（2026-07-23 实测）

Windows 10 + Git Bash (MSYS) 环境下工具链的已知兼容性问题。

## 工具兼容性

| 工具 | 状态 | 说明 |
|------|------|------|
| ghidra-rpc | ❌ 不可用 | `import fcntl` 失败（Unix API）。源码 `ghidra_rpc/session.py` 直接 import fcntl，socket 路径用 `/tmp/*.sock`。已删除。 |
| IDA `idat -A` | ❌ Standard 不可用 | 许可证限制 error code 1/2。用 IDA headless + ida.dll 替代。 |
| scoop `adb` shim | ❌ 崩溃 | `RC3221225781`。已用 SDK `platform-tools/adb.exe` 覆盖 shim。 |
| scoop `binutils` 包 | ❌ 源挂 | SourceForge URL 404。用 mingw binutils 拷贝到 scoop shims 替代。 |
| scoop `jadx` shim | ⚠️ 偶发 | 找不到主类。用 `scoop/apps/jadx/current/bin/jadx.bat` 直接调。 |
| frida 17.x | ⚠️ API 变更 | `findExportByName` / `Memory.readByteArray` 废弃，用 `enumerateExports()` / `addr.readByteArray()`。 |

## 已修复

| 问题 | 修复方式 |
|------|----------|
| 无 binutils strings/objdump/readelf | 从 `scoop/apps/mingw/current/mingw64/bin/` 拷贝到 `scoop/shims/` |

## 终端编码

Git Bash/MSYS 下 Python 脚本输出可能乱码。解决方案：
```python
# execute_code 中运行 Python 时
env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
subprocess.run([sys.executable, script], env=env)
```

## 网络代理

