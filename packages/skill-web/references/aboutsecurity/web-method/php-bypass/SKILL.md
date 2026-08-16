---
name: php-bypass
description: "PHP 安全特性绕过：disable_functions 和 open_basedir 限制突破。当已获取 webshell 但命令执行函数被禁用或文件操作被 open_basedir 限制时使用"
metadata:
  tags: "disable_functions,open_basedir,php,bypass,rce,webshell,LD_PRELOAD,putenv,FFI,iconv,imagick,绕过,沙箱逃逸"
  category: "exploit"
---

# PHP 安全特性绕过方法论


当你已获取 webshell（能执行 PHP 代码）但无法执行系统命令时，本 skill 指导你突破 `disable_functions` 和 `open_basedir` 限制。

## 深入参考

- 方法 A-G 完整绕过代码 → [references/disable-functions-bypass.md](references/disable-functions-bypass.md)
- open_basedir 绕过方法 → [references/open-basedir-bypass.md](references/open-basedir-bypass.md)
- CTF PHP 技巧（OPcache 投毒、多态文件） → [references/ctf-php-tricks.md](references/ctf-php-tricks.md)

---

## Phase 0: 信息收集（30 秒判断）

首先确认限制范围，这决定了攻击路径：

```php
<?php
echo "disable_functions: " . ini_get('disable_functions') . "\n";
echo "open_basedir: " . ini_get('open_basedir') . "\n";
echo "PHP version: " . phpversion() . "\n";
echo "OS: " . PHP_OS . "\n";
echo "Loaded extensions: " . implode(', ', get_loaded_extensions()) . "\n";
// 关键扩展检查
echo "FFI: " . (extension_loaded('ffi') ? 'YES' : 'NO') . "\n";
echo "imagick: " . (extension_loaded('imagick') ? 'YES' : 'NO') . "\n";
echo "iconv: " . (extension_loaded('iconv') ? 'YES' : 'NO') . "\n";
echo "putenv: " . (function_exists('putenv') ? 'YES' : 'NO') . "\n";
echo "mail: " . (function_exists('mail') ? 'YES' : 'NO') . "\n";
echo "error_log: " . (function_exists('error_log') ? 'YES' : 'NO') . "\n";
?>
```

## Phase 1: disable_functions 绕过决策树

```
putenv() 可用？
├─ YES → mail()/error_log() 可用？
│   ├─ YES → 方法 A: LD_PRELOAD 劫持（最稳定，首选）
│   └─ NO → iconv 扩展加载？
│       ├─ YES → 方法 B: iconv + LD_PRELOAD
│       └─ NO → imagick 扩展？
│           ├─ YES → 方法 C: ImageMagick delegate
│           └─ NO → 下一分支
├─ NO → FFI 扩展 (PHP ≥ 7.4)？
│   ├─ YES → 方法 D: FFI 直接调用 system()
│   └─ NO → PHP < 7.4.21 / 8.0 < 8.0.8？
│       ├─ YES → 方法 E: PHP Backtrace UAF (CVE-2019-11043 等)
│       └─ NO → PCNTL 扩展？
│           ├─ YES → 方法 F: pcntl_exec()
│           └─ NO → 方法 G: ShellShock (CVE-2014-6271) / Apache mod_cgi
```

> 每种方法的完整代码见 [references/disable-functions-bypass.md](references/disable-functions-bypass.md)

---

## 实战速查表

| 看到什么 | 方法 | 命令 |
|----------|------|------|
| putenv + mail 可用 | LD_PRELOAD | 上传 .so → putenv → mail() |
| putenv + error_log 可用 | LD_PRELOAD | 同上，用 error_log() 替代 |
| putenv + iconv 可用 | GCONV_PATH | 上传 gconv-modules + .so |
| imagick 已加载 | delegate 注入 | MVG/SVG payload |
| PHP ≥ 7.4 + FFI | FFI::cdef | 直接调 system() |
| pcntl 已加载 | pcntl_exec | fork + exec |
| Bash ≤ 4.3 | ShellShock | putenv 环境变量注入 |
| 全部不行 | UAF exploit | 搜索版本对应的利用脚本 |

## 注意事项

- 优先检查 phpinfo() 确认环境，不要盲试
- LD_PRELOAD 方法需要上传 .so 文件，确保有可写目录
- FFI 方法最简洁但 PHP 版本要求高
- 某些 Docker 环境 `/usr/sbin/sendmail` 不存在 → mail() 不触发 execve → 换 error_log
- 成功执行命令后记得清理上传的 .so 文件
