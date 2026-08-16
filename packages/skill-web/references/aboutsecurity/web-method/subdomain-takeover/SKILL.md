---
name: subdomain-takeover
description: "子域名接管检测与利用方法论。当目标存在悬挂 CNAME/NS/MX 记录指向已停用的云资源、过期第三方服务或未认领 SaaS 租户时使用。覆盖 CNAME 接管(S3/GitHub Pages/Heroku/Azure/Shopify/Fastly 等 14+ 供应商)、NS 接管(全域控制)、MX 接管(邮件拦截)、通配符 DNS 风险、接管后影响评估(cookie/CORS/CSP/OAuth/TLS)。任何涉及子域名资产清理、DNS 记录审计、域名安全评估的场景都应使用此 skill"
metadata:
  tags: "subdomain takeover,CNAME,NS,dangling DNS,子域名接管,S3,GitHub Pages,Heroku,Azure,cloud资产,域名安全"
  category: "exploit"
---

# 子域名接管检测与利用方法论


---

## 1. 核心概念

子域名接管发生在：

1. `sub.target.com` 有 DNS 记录（CNAME/NS/A）指向外部服务
2. 该外部资源**已被删除/停用**（删除的 S3 bucket、移除的 Heroku app 等）
3. 攻击者可以在该供应商上**注册/认领**同名资源
4. 攻击者控制 `sub.target.com` 下的内容

**影响**：cookie 窃取（父域 cookie）、OAuth token 拦截、可信域名钓鱼、CORS 绕过、CSP 绕过。

---

## 2. 检测方法论

### 2.1 CNAME 枚举

```
1. 收集子域名（amass/subfinder/assetfinder/crt.sh/SecurityTrails）
2. 逐个解析 DNS：
   dig CNAME sub.target.com +short
3. 对每个 CNAME → 检查目标是否返回 NXDOMAIN 或供应商错误页
4. 用指纹表（第 3 节）匹配错误响应
```

### 2.2 关键信号

| 信号 | 含义 |
|---|---|
| CNAME → `xxx.s3.amazonaws.com` + HTTP 404 "NoSuchBucket" | S3 bucket 已删除，可认领 |
| CNAME → `xxx.herokuapp.com` + "No such app" | Heroku 应用已删除 |
| CNAME → `xxx.github.io` + 404 "There isn't a GitHub Pages site here" | GitHub Pages 未认领 |
| CNAME 目标域名本身 NXDOMAIN | 目标域名过期或不存在 |
| CNAME → 供应商但 HTTP 200 + 默认停车页 | 可能可认领 — 需验证 |

### 2.3 自动化工具

| 工具 | 用途 |
|---|---|
| `subjack` | 自动化 CNAME 接管检查 |
| `nuclei -t takeovers/` | Nuclei 接管检测模板 |
| `can-i-take-over-xyz`（GitHub） | 可接管服务参考列表 |
| `dnsreaper` | 多供应商接管扫描器 |
| `subzy` | 快速子域名接管验证 |

---

## 3. 供应商指纹表

| 供应商 | CNAME 模式 | 指纹（HTTP 响应） | 可接管？ |
|---|---|---|---|
| **AWS S3** | `*.s3.amazonaws.com` / `*.s3-website-*.amazonaws.com` | `NoSuchBucket`（404） | ✅ 创建同名 bucket |
| **GitHub Pages** | `*.github.io` | `There isn't a GitHub Pages site here`（404） | ✅ 创建 repo + 启用 Pages |
| **Heroku** | `*.herokuapp.com` / `*.herokudns.com` | `No such app` | ✅ 创建同名 app |
| **Azure** | `*.azurewebsites.net` / `*.cloudapp.azure.com` / `*.trafficmanager.net` | 各种默认页面/NXDOMAIN | ✅ 注册匹配资源 |
| **Shopify** | `*.myshopify.com` | `Sorry, this shop is currently unavailable` | ✅ 创建 shop + 添加自定义域名 |
| **Fastly** | CNAME → Fastly edge | `Fastly error: unknown domain` | ✅ 在 Fastly 添加域名 |
| **Pantheon** | `*.pantheonsite.io` | `404 Site Not Found` + Pantheon 品牌 | ✅ |
| **Tumblr** | `*.tumblr.com` | `There's nothing here` / `Whatever you were looking for doesn't exist` | ✅ |
| **WordPress.com** | CNAME → `*.wordpress.com` | `Do you want to register` | ✅ 在 WP.com 认领 |
| **Zendesk** | `*.zendesk.com` | `Help Center Closed` / Zendesk 品牌错误页 | ✅ |
| **Unbounce** | `*.unbouncepages.com` | `The requested URL was not found` | ✅ |
| **Ghost** | `*.ghost.io` | `404 Not Found` Ghost 错误 | ✅ |
| **Surge.sh** | `*.surge.sh` | `project not found` | ✅ |
| **Fly.io** | CNAME → `*.fly.dev` | Fly.io 默认 404 | ✅ |

---

## 4. 接管步骤 — 常见供应商

### 4.1 AWS S3

```
1. 确认：curl -s http://sub.target.com → "NoSuchBucket"
2. 从 CNAME 提取 bucket 名（如 sub.target.com.s3.amazonaws.com → bucket = "sub.target.com"）
3. aws s3 mb s3://sub.target.com --region <region>
4. 上传 index.html 证明控制
5. 启用静态网站托管
```

### 4.2 GitHub Pages

```
1. 确认：curl -s https://sub.target.com → "There isn't a GitHub Pages site here"
2. 创建 GitHub 仓库（任意名称）
3. 添加 CNAME 文件内容为 "sub.target.com"
4. 在仓库设置中启用 GitHub Pages
5. 等待 DNS 传播（GitHub 验证 CNAME 匹配）
```

### 4.3 Heroku

```
1. 确认：curl -s http://sub.target.com → "No such app"
2. heroku create <cname-中的-app-name>
3. heroku domains:add sub.target.com
4. 部署 PoC 页面
```

---

## 5. NS 接管 — 高危

NS 接管比 CNAME 接管**危险得多**：控制该区域的**全部 DNS 解析**。

### 如何发生

```
target.com NS → ns1.expireddomain.com
                 ↓
攻击者注册 expireddomain.com
                 ↓
攻击者控制 target.com 的全部 DNS
（A 记录、MX 记录、TXT 记录 — 一切）
```

### 检测

```
1. 枚举 NS 记录：dig NS target.com +short
2. 检查每个 NS 域名：whois ns1.example.com → 域名是否过期/可注册？
3. 验证：dig A ns1.example.com → NXDOMAIN/SERVFAIL？
4. 检查子委派区域：dig NS sub.target.com
```

### 影响

- 完全域名控制（任意内容、拦截邮件、通过 DNS-01 签发 TLS 证书）
- 从任何 CA 签发 DV 证书
- 修改 SPF/DKIM/DMARC → 以目标身份发送认证邮件

---

## 6. MX 接管 — 邮件拦截

当 MX 记录指向已停用的邮件服务：

```
target.com MX → mail.deadservice.com（服务已停止）
```

如果攻击者可以认领 `mail.deadservice.com` 或邮件租户：
- 接收密码重置邮件
- 拦截敏感通信
- 重置使用邮件认证的账户

### 常见场景

过期的 Google Workspace / Microsoft 365 租户 → MX 仍指向 Google/Microsoft → 攻击者创建新租户并认领该域名。

---

## 7. 通配符 DNS 风险

如果 `*.target.com` 有通配符 CNAME 指向可认领的服务：
- **每个**未定义的子域名都有漏洞
- `anything.target.com` 都可以被接管
- 攻击面大幅增加

检测：`dig A random1234567.target.com` — 如果解析成功，存在通配符。

---

## 8. 决策树

```
发现子域名 (sub.target.com)？
├── 解析 DNS 记录
│   ├── 有 CNAME → 外部服务？
│   │   ├── HTTP 响应匹配已知指纹？（第 3 节）
│   │   │   ├── 是 → 在供应商上尝试认领（第 4 节）
│   │   │   │   ├── 认领成功 → 接管确认
│   │   │   │   └── 认领被阻止（名称保留/区域锁定）→ 记录，尝试变体
│   │   │   └── 否 → 服务活跃，无法接管
│   │   └── CNAME 目标 NXDOMAIN？
│   │       ├── 目标是可注册域名？→ 注册 → 完全控制
│   │       └── 目标是活跃供应商的子域名 → 检查供应商认领流程
│   │
│   ├── 有 NS 记录 → 外部 nameserver？
│   │   ├── NS 域名过期/可注册？→ 注册 → 全域接管
│   │   └── NS 域名活跃 → 无法接管
│   │
│   ├── 有 MX → 外部邮件服务？
│   │   ├── 邮件服务已停用/可认领？→ 认领租户 → 邮件拦截
│   │   └── 邮件服务活跃 → 无法接管
│   │
│   └── 有 A 记录 → IP 地址？
│       ├── IP 属于弹性云（AWS EIP/Azure/GCP）？
│       │   ├── IP 未分配？→ 认领 IP → 提供内容
│       │   └── IP 已分配给其他客户 → 无法接管
│       └── IP 属于专用服务器 → 无法接管
│
└── 接管后影响评估
    ├── 与父域共享 cookie？→ 会话劫持
    ├── CORS 信任 *.target.com？→ 跨域数据窃取
    ├── CSP 白名单 *.target.com？→ 通过接管子域 XSS
    ├── OAuth redirect_uri 允许 sub.target.com？→ Token 窃取
    └── 能为 sub.target.com 签发 TLS 证书？→ 完整 MITM
```

---

## 9. 注意事项

1. **CNAME ≠ 可接管**：CNAME → S3 返回 403（bucket 存在但私有）**不是**漏洞。只有 `NoSuchBucket`（404）才是。
2. **S3 区域问题**：Bucket 名称全局唯一，但网站端点是区域性的。尝试匹配 CNAME 中的区域。
3. **GitHub Pages 验证**：GitHub 已添加域名验证 — 组织验证的域名不能被其他人认领。
4. **边缘情况**：部分供应商（如 CloudFront）需要特定的分发配置，不只是域名认领。
5. **二阶接管**：`sub.target.com CNAME → other.target.com CNAME → dead-service.com` — 必须跟踪完整链。
6. **SPF 子域接管**：如果 SPF 包含 `include:sub.target.com` 且你接管了 `sub.target.com`，可以修改其 SPF TXT 记录授权你的邮件服务器 → 以 `target.com` 身份发送伪造邮件。

---

## 深入参考

- 云服务商接管模式与 DNS 记录类型速查 → [references/takeover-techniques.md](references/takeover-techniques.md)
