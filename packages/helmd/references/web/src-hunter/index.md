# src-hunter — SRC / 众测 / Bug bounty 实战语料

> 融合自 [MyuriKanao/src-hunter-skill](https://github.com/MyuriKanao/src-hunter-skill)（MIT）。
> 平铺保持上游 `references/` 架构，文件名按本仓库 `[a-z0-9-].md` 规范翻译为英文 kebab-case。

**职责边界**：仅 SRC / 众测 / 漏洞赏金语境。本目录与 `../`（helm-d web 域）**互为补充而非替代**——
`../` 管资源发现、黑盒 API 测绘、JS 逆向、证据链；本目录管**从入口到出货的完整挖掘流程、payload 库、
绕过矩阵、真实案例语料**。不参与 native / protocol / malware / android / ai-security 等领域。

---

## 何时启用本目录

| 触发 | 启用范围 |
|---|---|
| 用户提到 **src / 众测 / bug bounty / 漏洞赏金 / hackerone / SRC / 补天 / HVV / 挖洞** | 全量：五阶段流程 + playbook + payloader + 字典 + 行业打法 + H1 案例 |
| 用户提到 **任意 X / 任意账号 / 越权 / 未授权 / 密码重置 / 支付逻辑 / 默认凭据 / WAF 绕过** | 全量（同上） |
| 用户给一个 URL / endpoint 要求「测一下 / 怎么打」 | 全量 |
| 其它常规 web 分析任务 | **不启用**，走 `../index.md` |

> 理由：本目录含 2887 份真实案例与 30k 行 payload，体积与噪声都大。
> 常规资源发现 / 应用分析用 `../` 即可；只有 SRC 语境才值得全量展开。

---

## 五阶段工作流（强制 checkpoint，未过不进下一阶段）

1. **Intake** — 确认 in-scope / out-of-scope / 规则 / 时间盒（四项缺一不进下一阶段）
2. **Recon** — 被动侦察，**禁止主动发包**；资产清单来源 ≥3 种
3. **Enum** — 主动探测，产出 `域 → 端口 → 服务 → 指纹 → JS endpoint` 矩阵
4. **Hunt** — 按信号选 playbook，**Read 该文件后再出 payload**（不准凭记忆生成）
5. **Report** — 先读 `compliance.md` 核对红线，再读 `templates/report-submission.md` 出三段式

流程细节与反幻觉硬约束见上游 `SKILL.md` 对应章节，已内化到下面的方法论文件。

---

## 目录

### 1. 方法论与方法

- [methodology/00-index.md](methodology/00-index.md) — 方法论入口（四段式：选靶 → 起手 → 控制缺口 → 收尾）+ 平台对齐
- [methodology/01-attack-priority.md](methodology/01-attack-priority.md) — 攻击优先级，P0–P3 量化评分
- [methodology/02-bypass-toolkit.md](methodology/02-bypass-toolkit.md) — payload 被拦时的通用绕过决策树 + 编码字典
- [methodology/03-evidence-discipline.md](methodology/03-evidence-discipline.md) — 黑盒证据纪律，避免「我以为」漏洞
- [methodology/04-control-gap-hunting.md](methodology/04-control-gap-hunting.md) — 9 类敏感操作 → 控制缺口探测策略
- [methodology/05-srctimebox-priority.md](methodology/05-srctimebox-priority.md) — 按时间盒选优先目标

### 2. 攻击 Playbook（68 篇，按漏洞类型）

入口（先读这个）：

- [playbooks/00-index.md](playbooks/00-index.md) — playbook 总目录，按 SRC 价值排序

单文件 playbook：

| 文件 | 漏洞类型 |
|---|---|
| [playbooks/unauth-access.md](playbooks/unauth-access.md) | 未授权访问 / 默认凭据（含中间件、数据库、IoT 默认口令表） |
| [playbooks/info-disclosure.md](playbooks/info-disclosure.md) | 信息泄露（.git / .svn / 备份 / phpinfo / 日志 / OSS bucket） |
| [playbooks/arbitrary-x-authz.md](playbooks/arbitrary-x-authz.md) | 任意 X / 越权 / IDOR（任意账号、任意操作） |
| [playbooks/sqli.md](playbooks/sqli.md) | SQL 注入（含 WooYun 高频参数频率表） |
| [playbooks/http-smuggling.md](playbooks/http-smuggling.md) | HTTP 请求走私（CL.TE / TE.CL / H2→H1） |
| [playbooks/graphql.md](playbooks/graphql.md) | GraphQL（introspection / 嵌套 IDOR / DoS） |
| [playbooks/race-conditions.md](playbooks/race-conditions.md) | 竞态条件 / TOCTOU（双花、超扣、限额绕过） |
| [playbooks/dos.md](playbooks/dos.md) | DoS（ReDoS / 资源不限速 / 算法爆炸） |
| [playbooks/mobile.md](playbooks/mobile.md) | 移动端（导出组件 / Intent / WebView / Pinning） |

目录型 playbook（**先读 `00-index.md` 路由表，再读具体子文件**）：

| 目录 | 覆盖 | 子文件数 |
|---|---|---|
| [playbooks/rce/00-index.md](playbooks/rce/00-index.md) | 反序列化 / SSTI / XXE / 命令注入 / 框架 RCE / 供应链 / 原型链 | 8 |
| [playbooks/xss/00-index.md](playbooks/xss/00-index.md) | XSS 分类 / 绕过 / 利用 | 4 |
| [playbooks/oauth-saml-jwt/00-index.md](playbooks/oauth-saml-jwt/00-index.md) | OAuth redirect / SAML / JWT / 认证杂项 | 5 |
| [playbooks/ssrf-cache-host/00-index.md](playbooks/ssrf-cache-host/00-index.md) | SSRF 核心 / 云元数据 / 缓存投毒 / Host | 4 |
| [playbooks/api-rest/00-index.md](playbooks/api-rest/00-index.md) | REST / GraphQL / JWT-API / WebSocket | 5 |
| [playbooks/logic-flaws/00-index.md](playbooks/logic-flaws/00-index.md) | CSRF / 业务逻辑 / 点击劫持 | 4 |
| [playbooks/file-upload/00-index.md](playbooks/file-upload/00-index.md) | 上传绕过 / 归档穿越 / 竞态下载 | 4 |
| [playbooks/path-traversal/00-index.md](playbooks/path-traversal/00-index.md) | 穿越 LFI / RFI log-poison / PHP wrapper / phar-session | 5 |
| [playbooks/intranet-postexp/00-index.md](playbooks/intranet-postexp/00-index.md) | 内网后渗透（凭据 / 横向 / 提权 / 域 / 隧道 / ADCS…） | 12 |
| [playbooks/llm-prompt-injection/00-index.md](playbooks/llm-prompt-injection/00-index.md) | Prompt 注入 / RAG 投毒 / Agent 工具滥用 | 6 |

### 3. Payload 库（结构化，305 条 + 绕过变体）

- [payloader/index.md](payloader/index.md) — payload 总索引（Web 177 / 内网 128 / 工具命令 114）

> ⚠️ 上游同名 `by-category/**.md` 为乱码（GBK 字节被当 latin1 写盘），
> 本仓库全部由 `scripts/build-src-hunter-payloader.mjs` **从原始 JSON 重建**，内容完整可读。

| 目录 | 内容 |
|---|---|
| [payloader/by-category/web/](payloader/) | 23 类 Web payload（SQL/NoSQL、XSS、RCE、SSRF、SSTI、XXE、框架漏洞、认证、JWT、云安全…） |
| [payloader/by-category/intranet/](payloader/) | 11 类内网 payload（凭据窃取、横向移动、权限提升、免杀、ADCS、Exchange…） |
| [payloader/tools/](payloader/) | 14 类工具命令速查（信息收集、密码攻击、反弹 shell、隧道代理…） |
| [payloader/waf-bypass.md](payloader/waf-bypass.md) | WAF / EDR 绕过变体（上游原文可读，直接保留） |

### 4. 字典（国产战场补位）

- [dictionaries/chinese-srcfingerprints.md](dictionaries/chinese-srcfingerprints.md) — 国产 OA / CMS / 中间件指纹与高危默认路径
- [dictionaries/default-credentials-cn.md](dictionaries/default-credentials-cn.md) — 国产组件默认凭据表

### 5. 行业垂直打法

- [industry/banking-finance.md](industry/banking-finance.md) — 银行 / 金融（金额篡改、支付绕过、密码重置）
- [industry/telecom-isp.md](industry/telecom-isp.md) — 电信 / ISP（越权、弱口令、BOSS / 网管）

### 6. 真实案例语料（HackerOne）

- [h1-reports/by-weakness/](h1-reports/by-weakness/) — **141 篇**按 weakness 归档的 High/Critical 已披露报告（渲染版，含 PoC 描述与 Impact）
- `h1-reports/raw/reports/*.json` — **2887 份**原始数据（可按 program / severity / 日期 / weakness 统计检索）
- `h1-reports/raw/uncategorized-classified.json` — 按 playbook 归类的报告 ID 索引

> 引用案例时的硬约束：**必须 Read 实际文件后再引，说不出文件路径就别引**（不准编造案例编号）。

### 7. 报告与合规

- [compliance.md](compliance.md) — 提交前必读的合规红线（出 scope / PII / DoS / 写操作 / 横向）
- [templates/report-submission.md](templates/report-submission.md) — H1 / Bugcrowd / 补天三段式报告模板 + CVSS 4.0

### 8. 工具索引

- [tools/mcp-jshook.md](tools/mcp-jshook.md) — jshookmcp 工具层索引（浏览器自动化 / CDP / JS hook / AST 反混淆 / Frida）

---

## 与 `../`（helm-d web 域）的分工

同名主题在两处都有时，按语境选：

| 主题 | 用 `../`（常规） | 用本目录（SRC） |
|---|---|---|
| SQL 注入 | `../sql-injection.md` — 原理、场景、sqlmap | `playbooks/sqli.md` — 入口频率表 + WooYun 参数 + 出货话术 |
| XSS | `../xss.md` — 上下文与绕过 | `playbooks/xss/` — 类型分类 + 利用链 + H1 案例 |
| SSRF | `../ssrf.md` — URL parser tricks | `playbooks/ssrf-cache-host/` — 云元数据 + 缓存 + Host |
| 信息泄露 | `../information-disclosure.md` | `playbooks/info-disclosure.md` — .git/备份/日志/bucket 清单 |
| 认证绕过 | `../authbypass-authentication-flaws.md` | `playbooks/unauth-access.md` + `oauth-saml-jwt/` |
| WAF 绕过 | `../waf-bypass-techniques.md` | `payloader/waf-bypass.md` + `methodology/02-bypass-toolkit.md` |

**一句话**：`../` 是「看懂这个应用」，本目录是「把它打出货」。
