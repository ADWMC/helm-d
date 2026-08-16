---
name: information-disclosure-methodology
description: "Web 应用敏感信息泄露检测与利用。当发现 .git/.svn 目录、备份文件路径(.bak/.zip/.tar.gz)、.env 配置文件、Swagger/OpenAPI 文档、debug 页面等信息泄露点时使用。也适用于发现源码泄露后的深入利用：git 历史审计（git log -p -S 搜索已删除的密码和 flag）、svn wc.db 文件列表提取、.DS_Store 目录枚举。优先于漏洞利用——信息泄露可直接提供凭据和攻击路径，往往比直接挖漏洞更快进入系统"
metadata:
  tags: "information_disclosure,information disclosure,source-code,backup,debug,credentials,ssh,.git,.svn,.env,git-dumper,svn-extractor,源码泄露"
  category: "exploit"
---

# 信息泄露方法论

## ⛔ 深入参考（必读）

- .git 完整利用链（dump → 历史审计 → stash/分支 → 凭据提取）→ [references/source-recovery.md](references/source-recovery.md)
- .svn 利用（entries 文件 / wc.db SQLite 查询 / pristine 文件恢复）→ [references/source-recovery.md](references/source-recovery.md)
- .DS_Store 解析、Swagger 利用、凭据搜索 → [references/source-recovery.md](references/source-recovery.md)
- API 参数操控泄露（query=%通配符、info→list变换、pageSize放大、空数组绕过）→ [references/api-param-tricks.md](references/api-param-tricks.md)

## Phase 1: 源码和配置文件
直接请求常见敏感路径（逐一测试或批量扫描）：
```
/.git/HEAD          /.env              /config.py         /Dockerfile
/.svn/entries       /.svn/wc.db        /.DS_Store         /robots.txt
/WEB-INF/web.xml    /package.json      /app.py            /backup.sql
/.dockerenv         /composer.json     /Gemfile           /requirements.txt
```
1. 使用 `curl -s -o /dev/null -w '%{http_code}' http://TARGET/<path>` 批量检测状态码
2. 对 200 响应进一步检查内容是否为真实文件（排除自定义 404 页面）
3. `.git/HEAD` 返回 200 → git-dumper 整体 dump → git log 审计历史提交找密码/flag！
4. `.svn/entries` 或 `.svn/wc.db` 返回 200 → svn-extractor dump → 提取文件列表和内容
5. `.env` 返回 200 → 直接读取数据库连接串、API Key、SECRET_KEY 等敏感配置
→ 源码恢复详细步骤 → [references/source-recovery.md](references/source-recovery.md)

## Phase 2: 调试信息
1. 发送畸形请求触发 500 错误页面（缺少参数、类型不匹配、非法字符）
2. Flask `debug=True` 显示完整源码和交互式 debugger（可能直接 RCE）
3. Django DEBUG=True 显示 settings、URL 路由、SQL 查询
4. Stack Trace 中提取：文件绝对路径、框架版本、数据库类型、变量值
5. 检查响应 Header：`Server`、`X-Powered-By`、`X-Debug-Token`、`X-Request-Id`
6. 尝试访问 `/debug`、`/trace`、`/actuator`（Spring Boot）、`/elmah.axd`（.NET）

## Phase 3: API 文档泄露
1. 逐一请求文档端点：`/docs`、`/swagger`、`/swagger.json`、`/swagger-ui.html`
2. 补充路径：`/openapi.json`、`/redoc`、`/api-docs`、`/graphql`、`/graphiql`
3. 检查 `/v1/docs`、`/v2/docs` 等带版本前缀的路径
4. API 文档中提取：所有端点列表、参数类型和示例值、认证方式、数据模型定义
5. 重点关注管理接口（`/admin/*`）、用户管理（`/users`）、文件操作（`/upload`、`/download`）
6. GraphQL introspection 查询：`{__schema{types{name,fields{name}}}}`

## Phase 4: 备份和日志
1. 扫描备份文件：`/backup.zip`、`/backup.tar.gz`、`/app.py.bak`、`/web.config.old`
2. 文件名变体：`index.php.bak`、`index.php~`、`index.php.swp`、`.index.php.swp`
3. 日志文件：`/access.log`、`/error.log`、`/debug.log`、`/app.log`
4. 使用 `spray` 或 `ffuf` 配合备份字典扫描更多路径
5. 数据库备份：`/dump.sql`、`/db.sql`、`/database.sql`、`/backup.sql`
6. 版本控制残留：`/.hg/`（Mercurial）、`/.bzr/`（Bazaar）

## Phase 5: API 参数操控
1. 发现 API 接口后，对查询参数做四种操控：置空、`%` 通配符、null、删除参数
2. `pageSize=9999` 放大分页，获取更多数据
3. `info` → `list` 端点变换，寻找列表接口
4. 空数组 `[]` → 删除 Token，测试认证绕过
5. 添加 `verbose=true`、`debug=1` 参数，检查是否返回额外信息
→ 详细技巧和案例 → [references/api-param-tricks.md](references/api-param-tricks.md)

## Phase 6: 凭据搜索
1. 在已获取的源码/配置中搜索：`password`、`secret`、`api_key`、`token`、`mysql://`
2. 检查 `.env` 文件中的数据库连接串和第三方 API 密钥
3. 搜索 SSH 私钥：`/.ssh/id_rsa`、`/home/*/.ssh/id_rsa`
4. Base64 编码的凭据：解码所有 Base64 字符串检查内容
5. **找到凭据后立即使用**：登录 Web、SSH 连接、数据库直连
6. Git 历史中搜索已删除的密码：`git log -p -S 'password'`
