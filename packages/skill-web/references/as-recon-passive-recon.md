# passive-recon

> 来源: wgpsec/AboutSecurity (recon) | 融合进 skill-web


# 被动 OSINT 情报收集方法论

> **⛔ 深入参考**：各引擎的完整查询语法和 API 调用方式见 `references/search-engine-syntax.md`

被动侦察的核心优势是**零接触**——不会在目标日志中留下痕迹。适合渗透前期预研、红队侦察、或在授权范围外只能做被动收集的场景。

## Phase 1: 多引擎资产搜索

### FOFA
通过 `http_request` 或 `curl` 查询 FOFA API（`https://fofa.info/api/v1/search/all?...`）— 国内最大的网络空间测绘引擎，适合发现国内资产。

常用查询模式：
- 域名资产：`domain="example.com"`
- IP 段：`ip="192.168.1.0/24"`
- 特定服务：`domain="example.com" && port="8080"`
- 特定组件：`domain="example.com" && app="WordPress"`

### Quake
通过 `http_request` 或 `curl` 查询 Quake API（`https://quake.360.net/api/v3/search/quake_service`）— 360 网络空间测绘，擅长深度指纹识别。

常用查询模式：
- 域名：`domain:"example.com"`
- 服务：`domain:"example.com" AND port:8443`
- 组件：`domain:"example.com" AND app:"Apache Tomcat"`

### Hunter
通过 `http_request` 或 `curl` 查询 Hunter API（`https://hunter.qianxin.com/openApi/search`）— 鹰图平台，擅长 IP 关联分析和资产聚合。

## Phase 2: 结果交叉比对

三个引擎各有侧重，交叉比对才能获取完整视图：

| 维度 | 分析方法 |
|------|----------|
| IP/域名清单 | 三引擎去重合并，标注仅单一引擎发现的（可能是新上线/已下线） |
| 端口分布 | 统计高危端口（22/3306/6379/9200），标注非标准端口 |
| 技术栈 | 汇总 Web 框架、中间件、CMS 版本 |
| 管理后台 | 搜索 title 含 "login"/"admin"/"dashboard" 的资产 |
| 证书信息 | SSL 证书中的 CN/SAN 可能泄露内部域名 |
| 历史数据 | 对比不同时间点数据，发现新增/下线资产 |

## Phase 3: 高价值目标识别

从被动收集结果中优先标注：
1. **暴露的管理后台** — 通常是最短攻击路径
2. **过期/未维护的服务** — 旧版本组件更可能有已知漏洞
3. **内部系统误暴露** — OA/VPN/GitLab/Jenkins 等不应公网可达的服务
4. **数据库端口暴露** — Redis/MongoDB/Elasticsearch 无认证是常见问题
5. **开发/测试环境** — dev/test/staging 子域通常安全措施较弱

## 注意事项
- 纯被动收集，**不要**直接访问或扫描目标
- 搜索引擎数据有时效性，最新资产可能未收录
- 不同引擎查询语法不同，注意区分

## 多引擎交叉验证
- 单引擎独有的结果可能新上线或已下线
- 数据时效性：各引擎收录时间不同、更新频率不同
- 标注来源：标记仅单一引擎发现的资产，需进一步验证
- 注意：不能扫描、不能直接访问目标、不能端口扫描

## 其他被动信息源
- WHOIS 查询域名注册信息
- DNS 历史记录
- GitHub 搜索泄露代码/凭据
- 其他公开来源（社交媒体、论坛等）


---

## REF: search-engine-syntax

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
