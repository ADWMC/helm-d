# mobile-backend

> 来源: wgpsec/AboutSecurity (auth) | 融合进 skill-web


# 移动 App 后端 API 安全测试方法论

移动后端 API 和传统 Web 的区别：移动端通常直接调用 REST API（不经过浏览器），认证机制、参数格式、业务逻辑都有移动端特色。

## ⛔ 深入参考（必读）

- 支付篡改、验证码绕过、竞态、数据安全、移动端特有问题 → [references/mobile-logic-bugs.md](references/mobile-logic-bugs.md)

## Phase 1: API 端点发现

```bash
# spray 目录爆破（推荐）
spray -u http://target -d $ABOUTSECURITY_ROOT/Dic/Web/Directory/Fuzz_common.txt
# 或 ffuf
ffuf -u http://target/FUZZ -w $ABOUTSECURITY_ROOT/Dic/Web/Directory/Fuzz_common.txt -mc 200,301,302,403
# /api/v1/, /api/v2/, /mobile/api/, /graphql
```
检查文档：`/docs`, `/swagger`, `/openapi.json`, `/redoc`

App 逆向：抓包（Burp/Charles）| APK 反编译搜索 URL 字符串

## Phase 2: 认证机制测试

| 认证方式 | 特征 | 攻击方向 |
|----------|------|----------|
| JWT | `Bearer eyJ...` | `jwt-attack-methodology` |
| API Key | `X-API-Key` | 泄露检测 |
| OAuth | `/oauth/token` | `oauth-sso-attack` |
| 自定义签名 | `sign=md5(...)` | 签名算法逆向 |

绕过测试：不带 Token 访问 | 过期 Token | 修改 user_id/role | 低权限访问高权限 API

## Phase 3: 业务逻辑漏洞

### 越权访问（IDOR）
```
GET /api/v1/users/1001/profile → 自己
GET /api/v1/users/1002/profile → 别人？→ IDOR！
```

### 支付/验证码/竞态
→ 详细方法和 payload → [references/mobile-logic-bugs.md](references/mobile-logic-bugs.md)

## 注意事项
- 移动 API 通常比 Web 更信任客户端——后端校验更少
- 注意 API 版本差异（v1 可能有漏洞，v2 修复了但 v1 未下线）


---

## REF: mobile-logic-bugs

# 移动后端业务逻辑漏洞详解

## 支付/金额篡改
```json
// 原始请求
{"product_id": 1, "quantity": 1, "price": 99.00}
// 篡改
{"product_id": 1, "quantity": 1, "price": 0.01}
{"product_id": 1, "quantity": -1, "price": 99.00}
```
检查：价格是否由前端传入、数量能否为负数、优惠券能否叠加使用。

## 验证码绕过
- 短信验证码：暴力枚举 4-6 位数字（有无限速？）
- 图形验证码：是否每次请求都刷新、是否可以复用
- 验证码绕过：删除验证码参数、置空、固定值

## 条件竞争
移动端常见场景：
- 优惠券/红包同时使用（参考 `race-condition-methodology`）
- 积分兑换重复提交
- 限购商品超额下单

## 数据安全

### 敏感数据泄露
- API 响应中包含不必要的字段（密码哈希、内部 ID、手机号完整显示）
- 错误信息泄露内部实现（堆栈信息、SQL 语句、文件路径）
- 调试端点暴露（`/debug`, `/actuator`, `/metrics`）

### 接口限速
- 登录接口无限速 → 暴力破解
- 短信发送无限速 → 短信轰炸
- 数据查询无限速 → 数据爬取

### 传输安全
- 是否使用 HTTPS（某些内部 API 可能用 HTTP）
- 证书校验是否可绕过（App 端 SSL Pinning 是否有效）

## 移动端特有问题
- **设备绑定绕过**：修改 `Device-ID` / `IMEI` Header
- **版本降级**：旧版 API（v1）可能有已修复但未下线的漏洞
- **推送通知泄露**：推送内容是否含敏感信息
- **深度链接劫持**：自定义 URL Scheme 可能被恶意 App 拦截
