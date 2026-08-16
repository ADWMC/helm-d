# Web 漏洞扫描方法论 — 检查清单与 wfuzz 高级用法

## 按输入类型的系统化漏洞检查清单

### 反射型输入（用户输入在响应中回显）

- Command Injection、SSTI、XSS、SSRF
- CRLF 注入、Open Redirect
- LFI/Path Traversal、Client-Side Template Injection

### 搜索/查询功能

- SQL Injection、NoSQL Injection、ORM Injection
- LDAP Injection、XPATH Injection
- ReDoS（正则拒绝服务）

### 表单与 WebSocket

- CSRF、WebSocket 劫持（CSWSH）
- PostMessage 漏洞

### HTTP 头部相关

- Clickjacking（缺少 X-Frame-Options）
- CSP 绕过、CORS 错误配置
- Cookie 安全属性缺失

### 结构化数据与特定功能

- 反序列化（Java/PHP/Python/Node）
- JWT 算法混淆与密钥爆破
- XXE（XML 输入/SOAP/文件上传场景）
- Email Header Injection、GraphQL 滥用

### 文件上传与处理

- 文件类型绕过、路径穿越写入
- Formula Injection（CSV/Excel）
- PDF 注入、Server-Side XSS（动态 PDF）

### 认证与逻辑绕过

- 2FA/OTP 绕过、验证码绕过
- Race Condition、Rate Limit 绕过
- 密码重置流程漏洞、注册逻辑漏洞

## 扫描优先级策略

**第一轮：高回报低成本**
1. 默认凭据 / 管理后台弱口令
2. 已知 CVE（Nuclei critical+high）
3. 信息泄露（`.env`、`.git`、debug 端点）

**第二轮：输入点逐一测试**
1. 所有参数 → SQLi / XSS polyglot 快速验证
2. 文件上传点 → 类型绕过 + webshell
3. API 端点 → IDOR + 越权

**第三轮：深入利用**
1. 反序列化入口（技术栈相关）
2. SSRF → 内网/云元数据
3. 组合链：低危发现串联成高危路径

## wfuzz 高级用法

### 过滤选项速查

```bash
# 按响应码隐藏/显示
--hc 404,403          # 隐藏 404 和 403
--sc 200,302          # 只显示 200 和 302

# 按响应内容隐藏/显示
--hs "Invalid"        # 隐藏包含 "Invalid" 的响应
--ss "Welcome"        # 只显示包含 "Welcome" 的响应

# 按响应长度过滤
--hw 11               # 隐藏 11 个单词的响应
--hh 1234             # 隐藏 1234 字符长度的响应
--hl 5                # 隐藏 5 行的响应
```

### POST 数据 Fuzz（登录爆破）

```bash
# 单字典 fuzz 用户名
wfuzz -c -w users.txt --hs "Login failed" \
  -d "name=FUZZ&password=admin123" http://target/login

# 双字典同时 fuzz 用户名和密码
wfuzz -c -z file,users.txt -z file,pass.txt --sc 200 \
  -d "name=FUZZ&password=FUZ2Z" http://target/login
```

### Cookie 与 Header Fuzz

```bash
# Fuzz Cookie 值
wfuzz -c -w ids.txt --ss "Welcome" \
  -H "Cookie: session=FUZZ" http://target/dashboard

# Fuzz Host 头（虚拟主机发现）
wfuzz -c -w subdomains.txt --hc 400,404 \
  -H "Host: FUZZ.target.com" http://target/ -t 100

# Fuzz User-Agent
wfuzz -c -w user-agents.txt --ss "200" \
  -H "User-Agent: FUZZ" http://target/
```

### HTTP 方法 Fuzz

```bash
# 测试目标接受哪些 HTTP 方法
wfuzz -z list,GET-POST-PUT-DELETE-PATCH-OPTIONS -X FUZZ \
  --sc 200,405 http://target/api/endpoint
```

### Payload 编码器

```bash
# 将 payload 做 base64 编码后发送
wfuzz -z file,payloads.txt,base64 http://target/api?data=FUZZ

# 双重 URL 编码（绕过 WAF）
wfuzz -z file,payloads.txt,urlencode-urlencode http://target/search?q=FUZZ

# MD5 哈希后发送
wfuzz -z file,wordlist.txt,md5 http://target/api?hash=FUZZ
```

### 路径参数与目录爆破

```bash
# 目录发现（白名单状态码）
wfuzz -c -z file,directory-list.txt \
  --sc 200,301,302,307,403 http://target/FUZZ

# 路径参数注入（分号分隔）
wfuzz -c -w params.txt --hw 11 \
  'http://target/path%3BFUZZ=FUZZ'
```

### 代理与认证

```bash
# 通过 Burp 代理观察流量
wfuzz -c -w wordlist.txt -p 127.0.0.1:8080:HTTP \
  http://target/FUZZ

# Basic 认证爆破
wfuzz -c -w users.txt -w pass.txt --ss "Welcome" \
  --basic FUZZ:FUZ2Z http://target/admin

# NTLM 认证爆破
wfuzz -c -w users.txt -w pass.txt --ss "Welcome" \
  --ntlm 'DOMAIN\FUZZ:FUZ2Z' http://target/
```
