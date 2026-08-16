# Web 发现与目录/端点枚举

Web 发现的目标不是盲目跑字典，而是把站点实际暴露的文件、目录、历史端点、前端路由和隐藏参数串成攻击面清单。先用低噪声来源建立候选集，再根据技术栈选择字典和验证方式。

---

## 1. 低噪声入口

优先检查不会产生大量请求的公开文件和页面内容：

| 入口 | 价值 | 检查点 |
|---|---|---|
| `/robots.txt` | 被搜索引擎排除的路径 | `Disallow` 是否暴露 admin、backup、staging |
| `/sitemap.xml` | 站点正式 URL 清单 | 旧业务、语言版本、移动端路径 |
| `/.well-known/security.txt` | 安全联系人和组织信息 | 邮箱、PGP、漏洞提交入口 |
| HTML/JS 注释 | 遗留说明和隐藏路径 | `TODO`、`debug`、内网 URL、旧接口 |
| favicon | 关联相同系统 | favicon hash 搜索相似资产 |

```bash
curl -s https://example.com/robots.txt
curl -s https://example.com/sitemap.xml
curl -s https://example.com/.well-known/security.txt
```

---

## 2. 目录与文件枚举

目录枚举要根据技术栈、状态码行为和认证状态调整字典。发现 PHP、Next.js、Spring、WordPress 等技术栈后，优先使用对应技术的目录、参数和备份文件字典，而不是直接使用通用大字典。

```bash
ffuf -H 'User-Agent: Mozilla' -t 30 -w wordlist.txt -u 'https://example.com/FUZZ'
gobuster dir -a 'Mozilla' -e -k -l -t 30 -w wordlist.txt -u 'https://example.com/'
```

结果判断：
- `200/204`：确认内容是否真实，排除软 404。
- `301/302`：跟踪跳转目标，可能暴露登录入口或租户路径。
- `401/403`：端点存在但受限，优先加入后续认证绕过/越权测试。
- `405`：路径存在但方法不匹配，尝试 `POST` / `PUT` / `DELETE`。
- `500`：可能触发异常路径，保留请求样本用于参数测试。

### 备份与临时文件

备份文件经常包含源码、配置和凭据，来源包括编辑器临时文件、手工备份、部署残留和压缩包。

```bash
bfac --url http://example.com/test.php --level 4
bfac --list urls.txt
```

重点后缀：`.bak`、`.old`、`.orig`、`.swp`、`~`、`.zip`、`.tar.gz`、`.7z`、`.sql`。

---

## 3. 爬虫与历史端点

爬虫用于从当前页面扩展攻击面；历史 URL 用于发现已经从前端移除但后端仍可达的接口。

```bash
katana -u https://example.com
echo https://example.com | hakrawler

gau --o example-urls.txt example.com
gau --blacklist png,jpg,gif example.com
```

归并 URL 时要按路径和参数去重，保留：
- 旧版 API：`/api/v1/`、`/legacy/`、`/old/`。
- 管理路径：`/admin/`、`/internal/`、`/manage/`。
- 文件操作：`download`、`export`、`upload`、`import`。
- 回调和跳转：`redirect`、`callback`、`returnUrl`。

---

## 4. 前端框架特定发现

### Next.js

Next.js 会在前端暴露构建清单和页面路由信息。浏览器控制台可直接查看：

```javascript
console.log(window.__BUILD_MANIFEST)
console.log(__BUILD_MANIFEST.sortedPages)
```

重点关注动态路由（如 `/[slug]`、`/user/[id]`）、admin/internal 页面、API route 和旧 chunk 中硬编码的接口。

### SPA / JS Bundle

React、Vue、Angular 等 SPA 的 API 端点常在 JS bundle 中，发现后应转入 `js-api-extract` 技能做系统化提取。

---

## 5. 隐藏参数发现

隐藏参数适合在已经确认端点存在后使用。先选少量高价值端点做验证，避免对全站无差别 fuzz。

```bash
x8 -u "https://example.com/?something=1" -w parameters.txt
```

优先测试：
- 查询类：`search`、`filter`、`sort`、`q`。
- 对象引用：`id`、`user_id`、`account_id`、`file`。
- 调试开关：`debug`、`test`、`preview`、`admin`。
- 跳转回调：`next`、`url`、`return`、`redirect_uri`。

---

## 6. 输出整理

Web 发现阶段的输出应按“可行动”组织：

1. 存活路径和状态码，标注是否需要认证。
2. 参数化端点，按注入/越权/文件操作/跳转分类。
3. 历史端点和备份文件，标注来源和首次发现渠道。
4. 前端框架路由和 JS bundle 清单。
5. 推荐下一步：API fuzz、业务逻辑测试、已知漏洞扫描或手工复测。
