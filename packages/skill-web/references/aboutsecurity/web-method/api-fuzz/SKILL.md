---
name: api-fuzz
description: "REST/GraphQL API 安全测试方法论。当目标有 API 端点（/api/、JSON 响应）、Swagger/OpenAPI 文档暴露、通过 js-api-extract 或目录扫描获得端点列表时使用。覆盖 API 发现、认证测试、框架识别、语义分析智能 Fuzz（根据端点语义推断参数名/类型/业务含义构造精准 payload）、Prototype Pollution、请求走私。IDOR → idor-methodology | GraphQL → graphql-methodology | CSRF → csrf-methodology。任何涉及 API 端点安全测试、参数发现、权限边界测试的场景都应使用此 skill"
metadata:
  tags: "api,fuzz,rest,json,swagger,openapi,endpoint,认证,原型链污染,semantic,parameter,crud,权限,参数猜测,智能fuzz"
  category: "exploit"
---

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
