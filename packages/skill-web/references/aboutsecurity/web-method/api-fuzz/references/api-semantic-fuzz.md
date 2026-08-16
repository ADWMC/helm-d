# API 端点语义分析与智能 Fuzz

与盲目跑字典不同，通过**端点语义**推断参数和业务逻辑，精准构造 payload。

## 目录

1. [RESTful CRUD 推断](#1-restful-crud-推断)
2. [路径语义→参数推断](#2-路径语义参数推断)
3. [命名规律扩展](#3-命名规律扩展)
4. [参数发现](#4-参数发现)
5. [智能 Fuzz 策略](#5-智能-fuzz-策略)
6. [IDOR 批量验证](#6-idor-批量验证)
7. [权限边界测试](#7-权限边界测试)
8. [响应分析](#8-响应分析)

---

## 1. RESTful CRUD 推断

```
发现: GET /api/users/123
推断:
  GET    /api/users          → 列出所有用户（信息泄露）
  GET    /api/users/1        → 遍历用户 ID（IDOR）
  POST   /api/users          → 创建用户（未授权注册）
  PUT    /api/users/123      → 修改用户（越权修改）
  DELETE /api/users/123      → 删除用户（越权删除）
  PATCH  /api/users/123      → 部分更新（Mass Assignment）
```

## 2. 路径语义→参数推断

| 端点模式 | 推断的参数 | 测试方向 |
|----------|-----------|----------|
| `/api/users/{id}` | `id` (int) | IDOR: 遍历 1-1000 |
| `/api/search?q=` | `q` (string) | SQL 注入、XSS |
| `/api/upload` | `file` (multipart) | 文件上传绕过 |
| `/api/export?type=` | `type`, `format` | 路径穿越、SSRF |
| `/api/config` | `key`, `value` | 配置篡改 |
| `/api/execute`, `/api/run` | `cmd`, `command`, `script` | 命令注入 |
| `/api/proxy?url=` | `url`, `target`, `redirect` | SSRF |
| `/api/template`, `/api/render` | `template`, `content` | SSTI |
| `/api/login` | `username`, `password` | 暴力破解、SQL 注入 |
| `/api/reset-password` | `email`, `token`, `code` | 逻辑绕过 |
| `/api/pay`, `/api/order` | `amount`, `price`, `quantity` | 金额篡改 |

## 3. 命名规律扩展

```
发现: /api/v1/user/info
扩展尝试:
  /api/v1/user/list         # 用户列表
  /api/v1/user/detail       # 用户详情
  /api/v1/user/update       # 修改资料
  /api/v1/user/delete       # 删除用户
  /api/v1/admin/user/list   # 管理员接口
  /api/v2/user/info         # 旧版本
  /api/internal/user/info   # 内部接口
```

## 4. 参数发现

### 4.1 常见参数名字典

按业务场景分组：

**身份类**: `id`, `uid`, `user_id`, `userId`, `account`, `username`, `email`, `phone`
**分页类**: `page`, `pageNum`, `pageSize`, `limit`, `offset`, `size`, `start`
**查询类**: `q`, `query`, `search`, `keyword`, `filter`, `sort`, `order`, `orderBy`
**文件类**: `file`, `filename`, `path`, `url`, `filePath`, `dir`, `attachment`
**认证类**: `token`, `auth`, `session`, `key`, `apiKey`, `access_token`, `refresh_token`
**操作类**: `action`, `type`, `method`, `cmd`, `op`, `status`, `role`

### 4.2 参数存在性探测

```bash
# 方法 1: 逐一添加参数观察响应变化
BASE="http://target.com/api/users"
# 基线响应
curl -s "$BASE" | wc -c
# 逐一测试参数
for param in id uid page limit search q role status; do
    len=$(curl -s "$BASE?$param=1" | wc -c)
    echo "$param → $len bytes"
done
# 长度/状态码变化 = 参数被接受
```

```bash
# 方法 2: POST JSON body 参数探测
curl -s -X POST "$BASE" \
  -H "Content-Type: application/json" \
  -d '{"id":1}' | head -5
# 观察报错信息——很多框架会提示缺少哪些参数
# "missing required field: username" → 参数名泄露
```

### 4.3 Content-Type 变体测试

```bash
# 同一端点换不同 Content-Type 可能走不同处理逻辑
curl -X POST "$BASE" -H "Content-Type: application/json" -d '{"id":1}'
curl -X POST "$BASE" -H "Content-Type: application/xml" -d '<id>1</id>'
curl -X POST "$BASE" -H "Content-Type: application/x-www-form-urlencoded" -d 'id=1'
# XML 路径可能有 XXE，form 路径可能有不同的过滤规则
```

## 5. 智能 Fuzz 策略

对每个发现的参数，根据其语义选择 payload：

```
参数名含 id/num → IDOR 遍历 + SQL 注入
参数名含 url/path/file → SSRF + 路径穿越
参数名含 search/q/query → SQL 注入 + XSS
参数名含 template/content → SSTI
参数名含 cmd/exec/run → 命令注入
参数名含 redirect/return/next → 开放重定向
参数名含 amount/price/qty → 业务逻辑（负数、零、极大值）
```

→ 详细 payload 模板 → [api-fuzz-payloads.md](api-fuzz-payloads.md)

## 6. IDOR 批量验证

```bash
# 对数字 ID 端点做快速 IDOR 扫描
for i in $(seq 1 20); do
    resp=$(curl -s -o /dev/null -w "%{http_code}:%{size_download}" "$BASE/api/users/$i" -H "Cookie: $COOKIE")
    echo "ID=$i → $resp"
done
# 不同 ID 都返回 200 且内容不同 → IDOR 确认
```

## 7. 权限边界测试

```bash
# 用普通用户 token 访问管理端点
curl -s "$BASE/api/admin/users" -H "Authorization: Bearer $USER_TOKEN"
# 200 → 垂直越权

# 去掉认证头
curl -s "$BASE/api/admin/users"
# 200 → 未授权访问

# 用 A 用户 token 访问 B 用户数据
curl -s "$BASE/api/users/OTHER_USER_ID" -H "Authorization: Bearer $A_TOKEN"
# 返回 B 的数据 → 水平越权
```

## 8. 响应分析

### 关键看点

- **错误信息** → 框架、数据库类型、内部路径泄露
- **多余字段** → API 返回了前端未展示的字段（password_hash、internal_ip、role）
- **调试信息** → `debug=true` 参数可能开启详细错误
- **响应时间差异** → 盲注/盲 SSRF 的判断依据
- **数据量异常** → `limit=-1` 或 `pageSize=99999` 导致全量数据泄露

### 响应模式对照

| 响应 | 含义 | 下一步 |
|------|------|--------|
| `{"error": "missing field: xxx"}` | 参数名泄露 | 补全参数重试 |
| `{"error": "invalid type"}` | 类型信息 | 尝试不同类型 |
| `{"data": [...], "total": 10000}` | 数据量大 | 尝试导出全部 |
| `500 + SQL stack trace` | SQL 注入入口 | → `sql-injection-methodology` |
| `200 但空数组` | 端点存在 | 换参数/方法重试 |
