# web-vuln-scan

> 来源: wgpsec/AboutSecurity (web-method) | 融合进 skill-web


# 单目标 Web 深度漏洞扫描方法论

与 `recon-full`（广度优先、资产发现）不同，本技能是**深度优先**——对已确定的单个 Web 目标做全面漏洞测试。

## Phase 1: 技术栈驱动的扫描策略

先做指纹识别，然后根据结果选择针对性扫描路线：

```bash
# 指纹识别
curl -sI http://target | grep -i "Server\|X-Powered-By\|X-AspNet"
httpx -u http://target -tech-detect -silent
```

| 技术栈 | 自动化扫描重点 | 手动测试重点 |
|--------|---------------|-------------|
| PHP (WordPress/Laravel/ThinkPHP) | CMS 专用 POC、PHP 反序列化 | LFI/文件上传/`include()` 参数 |
| Java (Spring/Struts/Tomcat) | Log4j/Spring4Shell/Struts2 | 反序列化入口、Actuator 泄露 |
| Python (Flask/Django) | SSTI、Debug 模式 | Pickle 反序列化、Secret Key 泄露 |
| Node.js (Express/Koa) | 原型链污染 | 依赖漏洞、`eval()` 注入 |
| .NET (ASP.NET/IIS) | ViewState 反序列化 | web.config 泄露 |

不同技术栈的漏洞分布差异巨大——盲目全扫浪费时间。

## Phase 2: 自动化扫描

### 2.1 已知漏洞扫描
```bash
# Nuclei 扫描（按严重等级过滤，节省时间）
nuclei -u http://target -severity critical,high
```
如果指纹明确，可以缩小范围：
- WordPress → `nuclei -u http://target -tags wordpress`
- 已知 CVE → `nuclei -u http://target -t cves/`

### 2.2 默认口令检测
```bash
nuclei -u http://target -t default-logins/ -silent
```
很多应用装完就忘改密码——这是最"便宜"的攻击路径。

### 2.3 目录和敏感文件
```bash
# spray 目录爆破（推荐，智能过滤 + 高性能）
spray -u http://target -d /pentest/AboutSecurity/Dic/Web/Directory/Fuzz_common.txt
# 或用 ffuf
ffuf -u http://target/FUZZ -w /pentest/AboutSecurity/Dic/Web/Directory/Fuzz_common.txt -mc 200,301,302,403
```
重点不是跑大字典，而是看结果中有没有：
- **管理后台** (`/admin`, `/manager`, `/console`) → 直接尝试登录
- **配置泄露** (`.env`, `config.php`, `web.config`) → 可能有数据库密码
- **源码泄露** (`/.git`, `.svn`, `backup.zip`)
- **调试端点** (`/actuator`, `/debug`, `/phpinfo.php`) → 大量内部信息

## Phase 3: 手动测试（自动化扫不到的）

自动化工具覆盖不了逻辑漏洞和需要上下文理解的漏洞。对每个功能点做针对性测试：

### 3.1 输入点测试矩阵
| 功能点 | 优先测试 | 参考技能 |
|--------|----------|----------|
| 搜索/查询 | SQL 注入 | `sql-injection-methodology` |
| 登录表单 | 弱密码、SQL注入、暴力破解 | `default-cred-sweep` |
| 文件上传 | 类型绕过、路径穿越 | `file-upload-methodology` |
| 用户输入回显 | XSS、SSTI | `xss-methodology`, `ssti-methodology` |
| 评论/留言 | 存储型 XSS | `xss-methodology` |
| URL/文件路径参数 | LFI/SSRF | `lfi-rfi-methodology`, `ssrf-methodology` |
| XML 输入/SOAP/文件上传 | XXE | `xxe-injection-methodology` |
| API 端点 | IDOR、认证绕过 | `api-fuzz`, `idor-methodology` |
| JWT Token | 算法绕过、密钥爆破 | `jwt-attack-methodology` |

### 3.2 测试优先级
1. **直接可 RCE 的** → 命令注入、反序列化、SSTI、文件上传
2. **可读取敏感数据的** → SQL注入、LFI、IDOR
3. **可获取凭据的** → 默认口令、信息泄露、弱加密
4. **需要用户交互的** → XSS、CSRF（CTF 中通常不考）

## Phase 4: 结果分析与攻击路径规划

扫描完成后，不是列一堆漏洞就完了——要评估**哪些漏洞能组合出攻击路径**：

**直接路径**（一步到位）：
- RCE 漏洞 → 直接拿 shell
- 管理后台弱密码 → 后台功能利用

**组合路径**（多步链式）：
- 信息泄露 → 获取凭据 → 登录后台 → 后台文件上传 → webshell
- SQL 注入 → 读配置文件 → 获取密钥 → 伪造 JWT → 管理员权限
- SSRF → 读取云元数据 → 云凭据

## 注意事项
- 自动化扫描是起点不是终点——真正的高危漏洞往往需要手动发现
- 指纹识别准确度直接影响后续效率，花 1 轮做好指纹值得
- 发现一个低危漏洞时，想想它能不能和其他发现组合出高危攻击链

## 测试优先级
- RCE 优先：命令执行漏洞可直接拿 flag
- 默认凭据第二：后台权限可快速获取更多信息

## 深入参考

- Web 漏洞检查清单与 wfuzz 高级用法 → [references/scan-methodology.md](references/scan-methodology.md)


---

## REF: scan-methodology

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
