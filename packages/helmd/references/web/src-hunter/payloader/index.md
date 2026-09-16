# Payload 知识库（结构化）

> 来源：src-hunter `references/payloader/`。原 markdown 为乱码（GBK 字节被当 latin1），
> 此处全部由 `scripts/build-src-hunter-payloader.mjs` 从原始 JSON 重建，内容完整可读。

- Web 攻击 payload: **177** 条 / 23 类
- 内网渗透 payload: **128** 条 / 11 类
- 工具命令速查: **114** 条 / 14 类
- WAF/EDR 绕过变体：见 [waf-bypass.md](waf-bypass.md)（6502 行）

---

## Web 攻击分类（177 条）

| 类别 | 数量 | 文件 |
|------|----:|------|
| 框架漏洞 | 18 | [by-category/web/framework-vulnerabilities.md](by-category/web/framework-vulnerabilities.md) |
| SQL/NoSQL注入 | 17 | [by-category/web/sql-nosql-injection.md](by-category/web/sql-nosql-injection.md) |
| API安全 | 12 | [by-category/web/api-security.md](by-category/web/api-security.md) |
| LFI/RFI文件包含 | 12 | [by-category/web/lfi-rfi.md](by-category/web/lfi-rfi.md) |
| RCE远程代码执行 | 12 | [by-category/web/rce.md](by-category/web/rce.md) |
| SSRF服务端请求伪造 | 12 | [by-category/web/ssrf.md](by-category/web/ssrf.md) |
| XSS跨站脚本 | 12 | [by-category/web/xss.md](by-category/web/xss.md) |
| SSTI模板注入 | 10 | [by-category/web/ssti.md](by-category/web/ssti.md) |
| 认证漏洞 | 10 | [by-category/web/authentication.md](by-category/web/authentication.md) |
| XXE实体注入 | 9 | [by-category/web/xxe.md](by-category/web/xxe.md) |
| CSRF跨站请求伪造 | 8 | [by-category/web/csrf.md](by-category/web/csrf.md) |
| 文件漏洞 | 7 | [by-category/web/file-vulnerabilities.md](by-category/web/file-vulnerabilities.md) |
| 业务逻辑漏洞 | 5 | [by-category/web/business-logic.md](by-category/web/business-logic.md) |
| AI安全 | 4 | [by-category/web/ai-security.md](by-category/web/ai-security.md) |
| JWT安全 | 4 | [by-category/web/jwt.md](by-category/web/jwt.md) |
| 云安全漏洞 | 4 | [by-category/web/cloud-security.md](by-category/web/cloud-security.md) |
| 请求走私 | 4 | [by-category/web/request-smuggling.md](by-category/web/request-smuggling.md) |
| WebSocket安全 | 3 | [by-category/web/websocket.md](by-category/web/websocket.md) |
| 供应链攻击 | 3 | [by-category/web/supply-chain.md](by-category/web/supply-chain.md) |
| 原型链污染 | 3 | [by-category/web/prototype-pollution.md](by-category/web/prototype-pollution.md) |
| 开放重定向 | 3 | [by-category/web/open-redirect.md](by-category/web/open-redirect.md) |
| 缓存与CDN安全 | 3 | [by-category/web/cache-and-cdn.md](by-category/web/cache-and-cdn.md) |
| 点击劫持 | 2 | [by-category/web/clickjacking.md](by-category/web/clickjacking.md) |

## 内网渗透分类（128 条）

| 类别 | 数量 | 文件 |
|------|----:|------|
| 凭证窃取 | 20 | [by-category/intranet/credential-theft.md](by-category/intranet/credential-theft.md) |
| 横向移动 | 16 | [by-category/intranet/lateral-movement.md](by-category/intranet/lateral-movement.md) |
| 权限提升 | 15 | [by-category/intranet/privilege-escalation.md](by-category/intranet/privilege-escalation.md) |
| 免杀与规避 | 14 | [by-category/intranet/evasion.md](by-category/intranet/evasion.md) |
| 域渗透攻击 | 14 | [by-category/intranet/domain-pentest.md](by-category/intranet/domain-pentest.md) |
| 隧道代理 | 13 | [by-category/intranet/tunneling.md](by-category/intranet/tunneling.md) |
| 信息收集 | 12 | [by-category/intranet/recon.md](by-category/intranet/recon.md) |
| 权限维持 | 12 | [by-category/intranet/persistence.md](by-category/intranet/persistence.md) |
| ADCS攻击 | 5 | [by-category/intranet/adcs.md](by-category/intranet/adcs.md) |
| Exchange攻击 | 5 | [by-category/intranet/exchange.md](by-category/intranet/exchange.md) |
| SharePoint攻击 | 2 | [by-category/intranet/sharepoint.md](by-category/intranet/sharepoint.md) |

## 工具命令分类（114 条）

| 类别 | 数量 | 文件 |
|------|----:|------|
| 信息收集 | 20 | [tools/recon.md](tools/recon.md) |
| 内网渗透 | 19 | [tools/intranet-pentest.md](tools/intranet-pentest.md) |
| Web渗透 | 16 | [tools/web-pentest.md](tools/web-pentest.md) |
| 反弹Shell | 12 | [tools/reverse-shell.md](tools/reverse-shell.md) |
| 密码攻击 | 11 | [tools/password-attack.md](tools/password-attack.md) |
| 漏洞利用 | 11 | [tools/exploitation.md](tools/exploitation.md) |
| 系统命令 | 8 | [tools/system-commands.md](tools/system-commands.md) |
| 编码解码 | 6 | [tools/encoding-decoding.md](tools/encoding-decoding.md) |
| 凭证窃取 | 3 | [tools/credential-theft.md](tools/credential-theft.md) |
| 权限提升 | 3 | [tools/privilege-escalation.md](tools/privilege-escalation.md) |
| 隧道代理 | 2 | [tools/tunneling.md](tools/tunneling.md) |
| Windows渗透 | 1 | [tools/windows-pentest.md](tools/windows-pentest.md) |
| 域渗透 | 1 | [tools/domain-pentest-tools.md](tools/domain-pentest-tools.md) |
| 红队工具 | 1 | [tools/red-team-tools.md](tools/red-team-tools.md) |
