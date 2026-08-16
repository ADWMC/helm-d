---
name: idor-methodology
description: "IDOR 不安全直接对象引用与未授权访问检测与利用。当 API/URL 中出现 user_id、account、订单号、文件名等可预测标识符，或需要测试水平越权（访问他人数据）、垂直越权（普通用户获取 admin 管理员权限）、接口越权时使用。覆盖 ID 遍历、绕过技巧（参数污染/编码/方法切换）、多步 IDOR 链、文件资源 IDOR、批量操作越权、间接引用枚举、框架特征利用、UUID 猜测、响应对比分析、写操作越权、JWT Claims 篡改、token/session 权限校验绕过、role/permission 检查缺失。发现 API 端点后务必加载本 skill 检查越权和未授权访问问题"
metadata:
  tags: "idor,insecure direct object reference,privilege_escalation,authorization,access-control,bola,越权,水平越权,垂直越权,权限绕过,对象引用,绕过,hpp,文件越权,批量操作,api,permission,role,admin,user_id,account,权限,token,session,jwt,接口越权,未授权访问"
  category: "exploit"
---

# IDOR 不安全直接对象引用方法论

IDOR 是最常见的 API 漏洞之一——开发者检查了"你是否登录"但没检查"你是否有权访问这条数据"。改一个数字就能拿到别人的数据，改一个 role 就能变成管理员。

## ⛔ 深入参考

- 绕过技巧（参数包装、编码、HPP、方法切换）→ [references/idor-bypass-techniques.md](references/idor-bypass-techniques.md)
- 高级模式（多步链、文件IDOR、批量操作、间接引用、框架特征、证据规范）→ [references/idor-advanced-patterns.md](references/idor-advanced-patterns.md)
- 批量检测脚本、写操作越权、标识符可预测性表 → [references/idor-techniques.md](references/idor-techniques.md)

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

→ 批量检测脚本 → [references/idor-techniques.md](references/idor-techniques.md)

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

→ 完整绕过 payload 和脚本 → [references/idor-bypass-techniques.md](references/idor-bypass-techniques.md)

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

→ 详细猎杀流程 → [references/idor-advanced-patterns.md](references/idor-advanced-patterns.md)

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

→ 详细模式 → [references/idor-advanced-patterns.md](references/idor-advanced-patterns.md)

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
