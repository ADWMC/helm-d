# 业务逻辑漏洞测试方法论

> 来源提炼: yaklang/hack-skills (business-logic-vulnerabilities/METHODOLOGY.md)
> 业务逻辑漏洞无固定签名，几乎无法被自动化工具发现，依赖业务深度理解

## 五阶段工作流

```
PHASE 1 业务建模: 把产品当状态机读
  ├─ 角色清单 (admin/user/vip/guest/internal/cron/third-party)
  ├─ 资源清单 (订单/余额/优惠券/积分/VIP/资料)
  ├─ 状态字段 (paid/unpaid/refunded/shipped/received)
  └─ 金钱/资产流向 (谁付钱、谁拿钱、谁能撤销)
PHASE 2 状态机/数据流: 每步状态由谁决定
  ├─ happy path 走通 + 抓全跳转请求/响应
  ├─ 标出"前端传的"vs"服务端回写的"字段
  └─ 找跨步骤复用 token/order_id/coupon_id/status
PHASE 3 攻击面分类: 5 类操作 × N 个业务模块
PHASE 4 checklist 逐条复测 (为什么出问题 + 如何复测)
PHASE 5 人脑判断: 服务端真接受? 业务上真占便宜?
```

## 角色枚举要点

很多 Java Web 项目仅依赖 `if (user.role == "admin")` 跳页面，无 Filter/Spring Security 全局拦截，`/teacher/*` 等"按理限制"的 URL guest 直接 GET 也拿到数据。此类系统默认所有非登录页未授权。

## 资产清单 (P0 攻击优先级)

前端可见但请求体可改动的资产字段:

```text
amount/total/price/discount_amount/shipping_fee
balance/points/coupon_balance/gift_card_balance
quantity/stock/max_per_user
vip_level/vip_expire_at/membership_status
real_name/id_card/phone/email/avatar
```

## 钱权流向

```
支付:  user → pay → order
退款:  order → refund → user   (钱回流同时不退货?)
VIP:   user → pay → vip(time)
邀请:  inviter ← reward ← invitee_register  (自己注册刷返佣?)
```

- 订单: 改价/负数/库存冲突/零库存购买/改订单金额
- 结算: 优惠券复用/拦截改金额改支付方式/伪造刷单
- 支付: 伪造第三方确认/窃取付款信息
- 退货: 绕过商家或商品类型限制
- 收货: 绕过客户确认

## 5 类操作分类

| 操作 | 含义 |
|------|------|
| 参数篡改 | 改金额/数量/状态/身份字段 |
| 流程跳跃 | 跳过校验步骤直达后置状态 |
| 重放 | 重复提交同一有效请求(刷券/刷积分) |
| 并发 | 并发请求突破限购/余额校验 |
| 替换身份 | 改 ID/引用他人资源 |

## 关键判断

单个 200/302/`success:true` 不能说明问题，要回到业务判断"它是不是本来就该这样"。发现需用完整复现(请求+响应+业务侧结果)佐证。