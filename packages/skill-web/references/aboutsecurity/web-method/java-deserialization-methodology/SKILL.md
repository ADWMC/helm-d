---
name: java-deserialization-methodology
description: "Java 反序列化漏洞检测与利用。当目标是 Java 应用（Tomcat/Spring/WebLogic/JBoss/Jenkins）、发现 rO0AB/aced0005 开头的 Base64 数据、HTTP 请求中有 application/x-java-serialized-object Content-Type、或存在 T3/IIOP/RMI/JNDI 协议端口时使用。覆盖 ysoserial gadget chain、JNDI 注入、Fastjson/Jackson 反序列化、Shiro rememberMe、常见中间件 CVE 利用"
metadata:
  tags: "java,deserialization,反序列化,ysoserial,jndi,rmi,ldap,fastjson,jackson,shiro,weblogic,jboss,jenkins,log4j,gadget,rce"
  category: "exploit"
---

# Java 反序列化漏洞方法论

Java 反序列化是 Java 生态中最危险的漏洞类之一——一旦成功通常直接 RCE。

## ⛔ 深入参考（必读）

- 需要 ysoserial gadget chain 优先级表、URLDNS 检测、payload 构造 → [references/ysoserial-gadgets.md](references/ysoserial-gadgets.md)
- 需要 JNDI 注入、Fastjson 版本 payload、Shiro/WebLogic/JBoss/Jenkins 专项 → [references/jndi-fastjson.md](references/jndi-fastjson.md)

---

## Phase 1: 识别 Java 反序列化入口

### 1.1 原生 Java 序列化数据（魔术字节）
- 二进制：`\xac\xed\x00\x05`（hex: `aced0005`）
- Base64 编码后：以 `rO0AB` 开头
- Gzip 压缩后再 Base64：以 `H4sIAAAA` 开头

**检查位置**：Cookie（`rememberMe`/`VIEWSTATE`）、POST Body、自定义 Header、WebSocket、RMI/T3/IIOP 协议端口

### 1.2 JSON 反序列化（Fastjson/Jackson）
- Fastjson：JSON 中含 `@type` 字段 → [references/jndi-fastjson.md](references/jndi-fastjson.md)
- Jackson：启用了 `DefaultTyping` → JSON 中含类名数组 `["com.xxx.Class", {...}]`
- 识别：发送畸形 JSON 观察错误堆栈中的库名

### 1.3 特定中间件端口

| 端口 | 服务 | 漏洞方向 |
|------|------|----------|
| 7001/7002 | WebLogic | T3/IIOP 反序列化 |
| 8009 | AJP (Tomcat) | GhostCat (CVE-2020-1938) |
| 1099 | RMI Registry | RMI 反序列化 |
| 1090/8500 | JBoss JMX | JMXInvokerServlet |
| 50000 | Jenkins | Jenkins CLI 反序列化 |

## Phase 2: 利用决策树

```
发现序列化入口
├─ 原生序列化 (rO0AB/aced0005)?
│   ├─ 先 URLDNS 确认漏洞存在 → [references/ysoserial-gadgets.md](references/ysoserial-gadgets.md)
│   └─ 逐个尝试 CC1-7 → CommonsBeanutils → Spring → Groovy
├─ Fastjson (@type 字段)?
│   └─ 识别版本 → 选择对应 payload → [references/jndi-fastjson.md](references/jndi-fastjson.md)
├─ Shiro (rememberMe=deleteMe)?
│   └─ 默认密钥 kPH+bIxk5D2deZiIxcaaaA== → [references/jndi-fastjson.md](references/jndi-fastjson.md)
└─ Log4j (Java 应用 + 用户输入)?
    └─ ${jndi:ldap://...} → [references/jndi-fastjson.md](references/jndi-fastjson.md)
```

## 注意事项
- **先用 URLDNS 检测**，确认漏洞存在后再尝试命令执行 gadget
- ysoserial 的 `Runtime.exec()` 不支持管道/重定向，需要 Base64 编码命令
- Java 版本影响 JNDI 利用方式（JDK < 8u191 最简单，8u191+ 需本地 Gadget）
- 多个 gadget chain 逐一尝试，不同 classpath 环境适用不同 gadget
