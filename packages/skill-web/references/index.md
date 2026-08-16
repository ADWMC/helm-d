# skill-web references index

知识按需读，模型自主判断，不作为硬性规则。共 22 个文件 + aboutsecurity 融合库（46 skill）。

**职责边界**：仅 Web 应用层——前端 JS、API 黑盒、Web 漏洞、WAF / 缓存 / CSP。协议层归 `skill-protocol`，框架源码审计与移动端归各自 skill。

**融合库 `aboutsecurity/`**（源自 wgpsec/AboutSecurity，1.6k star 渗透知识库）：

- `web-method/` — 32 个 Web 漏洞方法论（SQLi / XSS / SSRF / SSTI / XXE / 文件上传 / 反序列化 / 命令注入 / LFI / WAF 绕过 / WebSocket / GraphQL / NoSQL / LDAP / PHP bypass / 原型污染）
- `auth/` — 8 个认证授权（401/403 bypass / JWT / OAuth / IDOR / CSRF / CORS / Cookie）
- `recon/` — 6 个侦察（JS API 提取 / 被动侦察 / 子域名 / 目标画像）

读取路径示例：

```text
aboutsecurity/web-method/sql-injection-methodology/SKILL.md
aboutsecurity/web-method/sql-injection-methodology/references/blind-injection.md
aboutsecurity/auth/jwt-attack-methodology/SKILL.md
aboutsecurity/recon/js-api-extract/references/js-extract-patterns.md
```

> 注：`web-method/waf-bypass-methodology/references/parameter-bypass.md` 因本机 Defender 隔离源文件未融合，需要时见 AboutSecurity 原仓库。

- api-blackbox-testing.md
- attack-orchestration.md
- bot-patterns.md
- browser-debugging.md
- cache-poisoning.md
- crmeb-recon.md
- csp-bypass.md
- frontend-js-reverse.md
- js-obfuscation-patterns.md
- nextjs-analysis.md
- owasp-wstg-case-study.md
- rental-system-exploitation.md
- spa-frontend-analysis.md
- v2board-recon.md
- video-production-workflow.md
- waf-bypass-digit-regex.md
- web-api-recon-patterns.md
- web-business-logic-vulns.md
- web-methodology.md
- web-platform-testing.md
- web-principles.md
- web-vulnerabilities.md
