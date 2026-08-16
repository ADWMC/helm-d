# 网络空间测绘引擎查询语法

## FOFA

API 地址：`https://fofa.info/api/v1/search/all?email=<email>&key=<key>&qbase64=<base64_query>`

### 基础语法

| 操作符 | 示例 | 说明 |
|---|---|---|
| `=` | `domain="example.com"` | 精确匹配 |
| `==` | `title=="后台管理"` | 完全匹配 |
| `!=` | `status_code!="200"` | 不等于 |
| `&&` | `domain="example.com" && port="8080"` | 与 |
| `\|\|` | `port="3306" \|\| port="6379"` | 或 |

### 常用查询模式

```
# 资产发现
domain="example.com"                              # 所有子域名资产
domain="example.com" && port="8080"               # 非标准端口
domain="example.com" && protocol="https"          # HTTPS 资产
ip="10.0.0.0/8"                                    # 内网段搜索

# 指纹识别
domain="example.com" && app="WordPress"           # 特定 CMS
domain="example.com" && app="Apache Tomcat"       # 中间件
domain="example.com" && app="Spring"              # 框架

# 高价值目标
domain="example.com" && title="login"             # 登录页面
domain="example.com" && title="admin"             # 管理后台
domain="example.com" && title="dashboard"         # 仪表盘
domain="example.com" && (port="3306" || port="6379" || port="27017")  # 数据库

# 特殊搜索
cert="example.com"                                 # SSL 证书包含
header="example.com"                               # 响应头包含
body="example.com"                                 # 页面内容包含
icon_hash="<hash>"                                 # favicon 哈希
```

### API 调用示例

```bash
# 构造查询
QUERY=$(echo -n 'domain="example.com"' | base64)
curl -s "https://fofa.info/api/v1/search/all?email=${FOFA_EMAIL}&key=${FOFA_KEY}&qbase64=${QUERY}&size=100&fields=host,ip,port,title,server"
```

---

## Quake (360)

API 地址：`https://quake.360.net/api/v3/search/quake_service`

### 基础语法

| 操作符 | 示例 | 说明 |
|---|---|---|
| `:` | `domain:"example.com"` | 包含匹配 |
| `AND` | `domain:"example.com" AND port:8080` | 与 |
| `OR` | `port:3306 OR port:6379` | 或 |
| `NOT` | `domain:"example.com" NOT port:80` | 非 |

### 常用查询

```
# 资产发现
domain:"example.com"
domain:"example.com" AND port:8443
ip:"10.0.0.0/24"

# 指纹
domain:"example.com" AND app:"Apache Tomcat"
domain:"example.com" AND app:"Nginx"
domain:"example.com" AND app:"jQuery"

# 高价值
domain:"example.com" AND response:"admin"
domain:"example.com" AND (port:3306 OR port:6379 OR port:9200)
cert:"example.com"                          # 证书域名
```

### API 调用示例

```bash
curl -s -X POST "https://quake.360.net/api/v3/search/quake_service" \
  -H "X-QuakeToken: ${QUAKE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"query":"domain:\"example.com\"","start":0,"size":100}'
```

---

## Hunter (鹰图)

API 地址：`https://hunter.qianxin.com/openApi/search`

### 查询参数

```
api-key: <key>
search: <base64_query>
page: 1
page_size: 100
```

### 常用查询

```
# 资产搜索
domain="example.com"
domain="example.com"&&port="8080"
ip="10.0.0.1"

# 指纹
domain="example.com"&&web.title="后台"
domain="example.com"&&app.name="Tomcat"

# 证书
cert="example.com"
cert.subject="Example Inc"
```

### API 调用示例

```bash
QUERY=$(echo -n 'domain="example.com"' | base64)
curl -s "https://hunter.qianxin.com/openApi/search?api-key=${HUNTER_KEY}&search=${QUERY}&page=1&page_size=100"
```

---

## 引擎特点对比

| 维度 | FOFA | Quake | Hunter |
|---|---|---|---|
| 优势 | 国内资产覆盖最广、更新快 | 深度指纹识别准确 | IP 关联分析、资产聚合 |
| 数据量 | 最大 | 中等 | 中等 |
| 免费额度 | 较少 | 较多 | 较多 |
| 查询语法 | `key="value"` + `&&` | `key:"value"` + `AND` | `key="value"` + `&&` |
| 独特能力 | icon_hash、favicon 搜索 | IP 段关联、AS 号搜索 | C 段聚合、域名关联 |

## 结果分析优先级

```
1. 数据库端口暴露（3306/6379/27017/9200）→ 直接尝试无认证访问
2. 管理后台（title含admin/login/管理/后台）→ 弱密码/默认凭据
3. 开发测试环境（dev/test/staging子域）→ 通常安全措施弱
4. 非标准端口Web（8080/8443/8888/9090）→ 可能是内部服务
5. 过期证书/旧版本组件 → 可能存在已知CVE
```
