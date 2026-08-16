---
name: mobile-backend
description: "移动 App 后端 API 安全测试。当目标是移动应用的后端接口、发现 /api/v1/ 等移动端 API 路径、或需要测试 App 与服务器之间的通信安全时使用。覆盖 API 端点发现、认证机制测试、业务逻辑漏洞、移动端特有的安全问题"
metadata:
  tags: "mobile,api,backend,auth,app,ios,android,移动安全,业务逻辑,支付"
  category: "exploit"
---

# 移动 App 后端 API 安全测试方法论

移动后端 API 和传统 Web 的区别：移动端通常直接调用 REST API（不经过浏览器），认证机制、参数格式、业务逻辑都有移动端特色。

## ⛔ 深入参考（必读）

- 支付篡改、验证码绕过、竞态、数据安全、移动端特有问题 → [references/mobile-logic-bugs.md](references/mobile-logic-bugs.md)

## Phase 1: API 端点发现

```bash
# spray 目录爆破（推荐）
spray -u http://target -d $ABOUTSECURITY_ROOT/Dic/Web/Directory/Fuzz_common.txt
# 或 ffuf
ffuf -u http://target/FUZZ -w $ABOUTSECURITY_ROOT/Dic/Web/Directory/Fuzz_common.txt -mc 200,301,302,403
# /api/v1/, /api/v2/, /mobile/api/, /graphql
```
检查文档：`/docs`, `/swagger`, `/openapi.json`, `/redoc`

App 逆向：抓包（Burp/Charles）| APK 反编译搜索 URL 字符串

## Phase 2: 认证机制测试

| 认证方式 | 特征 | 攻击方向 |
|----------|------|----------|
| JWT | `Bearer eyJ...` | `jwt-attack-methodology` |
| API Key | `X-API-Key` | 泄露检测 |
| OAuth | `/oauth/token` | `oauth-sso-attack` |
| 自定义签名 | `sign=md5(...)` | 签名算法逆向 |

绕过测试：不带 Token 访问 | 过期 Token | 修改 user_id/role | 低权限访问高权限 API

## Phase 3: 业务逻辑漏洞

### 越权访问（IDOR）
```
GET /api/v1/users/1001/profile → 自己
GET /api/v1/users/1002/profile → 别人？→ IDOR！
```

### 支付/验证码/竞态
→ 详细方法和 payload → [references/mobile-logic-bugs.md](references/mobile-logic-bugs.md)

## 注意事项
- 移动 API 通常比 Web 更信任客户端——后端校验更少
- 注意 API 版本差异（v1 可能有漏洞，v2 修复了但 v1 未下线）
