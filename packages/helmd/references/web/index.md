# skill-web references index

知识按需读，模型自主判断，不作为硬性规则。共 68 个文件（22 自研 + 46 AboutSecurity 融合）。

**职责边界**：仅 Web 应用层——前端 JS、API 黑盒、Web 漏洞、WAF / 缓存 / CSP。协议层归 `skill-protocol`，框架源码审计与移动端归各自 skill。

**融合文件 `as-*`**（源自 [wgpsec/AboutSecurity](https://github.com/wgpsec/AboutSecurity)，1.6k star 渗透知识库，平铺保持原架构）：

- `as-web-method-*` — 32 个 Web 漏洞方法论
- `as-auth-*` — 8 个认证授权
- `as-recon-*` — 6 个侦察

## 自研文档

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

## AboutSecurity 融合（Web 漏洞方法论）

- as-web-method-api-fuzz.md
- as-web-method-business-logic-attack.md
- as-web-method-cache-poisoning-smuggling.md
- as-web-method-command-injection-methodology.md
- as-web-method-deserialization-methodology.md
- as-web-method-expression-language-injection.md
- as-web-method-file-upload-methodology.md
- as-web-method-graphql-methodology.md
- as-web-method-http-host-header-attacks.md
- as-web-method-information-disclosure-methodology.md
- as-web-method-java-deserialization-methodology.md
- as-web-method-ldap-injection.md
- as-web-method-lfi-rfi-methodology.md
- as-web-method-nosql-injection.md
- as-web-method-php-bypass.md
- as-web-method-php-type-juggling.md
- as-web-method-privilege-escalation-web.md
- as-web-method-prototype-pollution-exploit.md
- as-web-method-python-prototype-pollution.md
- as-web-method-python-web-debug.md
- as-web-method-sql-injection-methodology.md
- as-web-method-ssrf-methodology.md
- as-web-method-ssti-methodology.md
- as-web-method-subdomain-takeover.md
- as-web-method-waf-bypass-methodology.md
- as-web-method-web-vuln-scan.md
- as-web-method-webshell-deploy.md
- as-web-method-webshell-management.md
- as-web-method-websocket-attack.md
- as-web-method-xslt-injection.md
- as-web-method-xss-methodology.md
- as-web-method-xxe-injection-methodology.md

## AboutSecurity 融合（认证授权）

- as-auth-401-403-bypass.md
- as-auth-cookie-analysis.md
- as-auth-cors-misconfiguration.md
- as-auth-csrf-methodology.md
- as-auth-idor-methodology.md
- as-auth-jwt-attack-methodology.md
- as-auth-mobile-backend.md
- as-auth-oauth-sso-attack.md

## AboutSecurity 融合（侦察）

- as-recon-js-api-extract.md
- as-recon-passive-recon.md
- as-recon-recon-full.md
- as-recon-social-engineering.md
- as-recon-subdomain-deep.md
- as-recon-target-profiling.md

> 注：waf-bypass 的 `parameter-bypass.md` 与 webshell 的 `webshell-payloads.md` 部分内容因本机 Defender 实时扫描误报被拦，需要时见 AboutSecurity 原仓库。
