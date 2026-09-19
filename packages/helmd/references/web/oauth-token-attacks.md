# OAuth Token 攻击
> **SRC / 众测语境** → 用 `read_reference(path: "src-hunter/playbooks/oauth-saml-jwt/00-index.md")`（OAuth / SAML / JWT 全族）

> 融合来源：yaklang/hack-skills `jwt-oauth-token-attacks` 的 OAuth 部分（JWT 部分已并入 [jwt-attack.md](./jwt-attack.md)）。
> 相关主题：[oauth-oidc-misconfiguration.md](./oauth-token-attacks.md)、[oauth-sso-attack.md](./oauth-sso-attack.md)（SSO/OIDC 配置错误深度）、[csrf.md](./csrf.md)（state 缺失即 OAuth-CSRF）。

## 7. OAUTH 2.0 — STATE PARAMETER MISSING (CSRF)

State parameter prevents CSRF in OAuth. If missing:

```
Attack:
1. Click "Login with Google" → OAuth starts → intercept the redirect URL:
   https://accounts.google.com/oauth2/auth?client_id=APP_ID&redirect_uri=https://target.com/callback&state=MISSING_OR_PREDICTABLE&code=...

2. Get the authorization code (stop before exchanging it)
3. Craft URL: https://target.com/oauth/callback?code=ATTACKER_CODE
4. Victim clicks that URL → their session binds to ATTACKER's OAuth identity
→ ACCOUNT TAKEOVER
```

---

## 8. OAUTH — REDIRECT_URI BYPASS

Authorization codes are sent to `redirect_uri`. If validation is weak:

### Open Redirect in redirect_uri
```
Original: redirect_uri=https://target.com/callback
Attack:   redirect_uri=https://target.com/callback/../../../attacker.com
          redirect_uri=https://attacker.com.target.com/callback
          redirect_uri=https://target.com@attacker.com/callback
```

### Partial Path Match
```
Whitelist: https://target.com/callback
Attack: https://target.com/callback%2f../admin (URL path confusion)
        https://target.com/callbackXSS (prefix match only)
```

### Localhost / Development Redirect
```
redirect_uri=http://localhost/steal
redirect_uri=urn:ietf:wg:oauth:2.0:oob  (mobile apps)
```

---

## 9. OAUTH — IMPLICIT FLOW TOKEN THEFT

Implicit flow: token sent in URL fragment `#access_token=...`

**Fragment leakage scenarios**:
- Redirect to attacker page: fragment accessible via `document.referrer` or via `<script>window.location.href</script>` in target page
- Open redirect: `redirect_uri=https://target.com/open-redirect?url=https://attacker.com` → token in fragment lands at attacker's page

---

## 10. OAUTH — SCOPE ESCALATION

Request broader scope than authorized in authorization code:
```
Authorized scope: read:profile
Attack: During token exchange, add scope=admin or scope=read:admin
→ Does server grant requested scope or issued scope?
```

---

## 11. TOKEN LEAKAGE VECTORS

### Referer Header
Token in URL → page loads external resource → Referer leaks token:
```
https://target.com/dashboard#access_token=TOKEN
→ HTML loads: <img src="https://analytics.third-party.com/track">
→ Referer: https://target.com/dashboard#access_token=TOKEN
→ analytics.third-party.com sees token in Referer logs
```

### Server Logs
Access tokens sent in query parameters are stored in:
```
/var/log/nginx/access.log
/var/log/apache2/access.log
ELB/ALB logs (AWS)
CloudFront logs
CDN logs
```

---

## 13. OAUTH TESTING CHECKLIST

```
□ Check for state parameter in authorization request
□ Test redirect_uri manipulation (open redirect, prefix match, path confusion)
□ Can tokens be exchanged more than once?
□ Test scope escalation during token exchange
□ Implicit flow: check for token in Referer/history
□ PKCE: can code_challenge be bypassed or code_verifier be empty?
□ Check for authorization code reuse (code must be single-use)
□ Test account linking abuse: link OAuth to existing account with same email
□ Check OAuth provider confusion: use Apple ID to link where Google expected
```

---

# 补充：OAuth/OIDC 配置错误核查表（融合自 hack-skills `oauth-oidc-misconfiguration`）

适用场景：应用支持 `Login with Google/GitHub/Microsoft/Okta` 等 IdP；URL 出现 `authorize`/`callback`/`redirect_uri`/`code`/`state`/`nonce`/`code_challenge`；移动端或 SPA 依赖 OAuth/OIDC 流。

| 主题 | 检查点 |
|---|---|
| `state` 处理 | 缺失 / 静态 / 可预测 / 未绑定用户会话 |
| `redirect_uri` 校验 | 前缀匹配、开放重定向链、路径混淆、localhost 残留 |
| PKCE | 公共客户端缺失、code verifier 未强制执行、流程降级 |
| OIDC `nonce` | 缺失或 ID token 返回时未校验 |
| token audience/issuer | `aud`/`iss` 校验弱、跨 client token 复用 |
| 账号绑定 | callback 把攻击者身份绑到受害者会话 |
| scope 处理 | 授予超出用户/client 应得的 scope |

快速分诊：画出完整流程（authorize → callback → token exchange → logout）；篡改 `state`/`nonce`/`redirect_uri` 重放 callback；对比 SPA/移动/Web 三端找最弱校验；测试一个 provider 账号能否绑到另一个本地账号。

深度流程与 payload：[oauth-sso-attack.md](./oauth-sso-attack.md)（redirect_uri 全量 payload / Token 泄露 / DNS 外带 / 账户接管）。
