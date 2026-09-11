# skill-web references index

知识按需读，模型自主判断，不作为硬性规则。

**职责边界**：仅 Web 应用层——前端 JS、API 黑盒、Web 漏洞、WAF / 缓存 / CSP。协议层归 `skill-protocol`，框架源码审计与移动端归各自 skill。

**来源说明**：自研文档 + 两批外部融合（均已按主题重命名并入，不再带前缀）——[wgpsec/AboutSecurity](https://github.com/wgpsec/AboutSecurity)（原 `as-*`，46 篇）与 [yaklang/hack-skills](https://github.com/yaklang/hack-skills)（原 `hs-*`，56 篇）。同名主题已合并去重，互链同步改写。

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

- api-fuzz.md
- business-logic-attack.md
- cache-poisoning-smuggling.md
- command-injection.md
- deserialization.md
- expression-language-injection.md
- file-upload.md
- graphql.md
- http-host-header-attacks.md
- information-disclosure.md
- java-deserialization.md
- ldap-injection.md
- path-traversal-lfi.md
- nosql-injection.md
- php-bypass.md
- php-type-juggling.md
- privilege-escalation-web.md
- prototype-pollution-exploit.md
- python-prototype-pollution.md
- python-web-debug.md
- sql-injection.md
- ssrf.md
- ssti.md
- subdomain-takeover.md
- waf-bypass.md
- web-vuln-scan.md
- webshell-deploy.md
- webshell-management.md
- websocket-attack.md
- xslt-injection.md
- xss.md
- xxe.md

## AboutSecurity 融合（认证授权）

- 401-403-bypass.md
- cookie-analysis.md
- cors-cross-origin-misconfiguration.md
- csrf.md
- idor.md
- jwt-attack.md
- mobile-backend.md
- oauth-sso-attack.md

## AboutSecurity 融合（侦察）

- js-api-extract.md
- passive-recon.md
- recon-full.md
- social-engineering.md
- subdomain-deep.md
- target-profiling.md

> 注：waf-bypass 的 `parameter-bypass.md` 与 webshell 的 `webshell-payloads.md` 部分内容因本机 Defender 实时扫描误报被拦，需要时见 AboutSecurity 原仓库。

## hack-skills 融合（hs-*，源自 [yaklang/hack-skills](https://github.com/yaklang/hack-skills)）

- 401-403-bypass.md [Advanced Web Security] — 401/403 bypass playbook. Use when encountering access-denied responses on admin panels, API endpoints, or restricted paths. Covers path manipulation, 
- api-auth-and-jwt-abuse.md [API Security] — API authentication and JWT abuse playbook. Use when testing bearer tokens, API keys, claim trust, header spoofing, rate limits, and API auth boundary 
- api-authorization-and-bola.md [API Security] — API authorization and BOLA testing playbook. Use when APIs expose object identifiers, nested resources, hidden writable fields, or weak function-level
- api-recon-and-docs.md [API Security] — API reconnaissance and documentation review playbook. Use when discovering endpoints, schemas, versions, OpenAPI specs, hidden docs, and surface area 
- api-sec.md [API Security] — Entry P1 category router for API security. Use when choosing between API recon, authorization, token abuse, and hidden-parameter workflows before any 
- auth-sec.md [Authentication & Authorization] — Entry P1 category router for authentication and authorization. Use when testing login flows, sessions, object authorization, JWT, OAuth, CORS, CSRF, a
- authbypass-authentication-flaws.md [Authentication & Authorization] — Authentication bypass testing playbook. Use when assessing login flows, password reset logic, account recovery, MFA bypass, token predictability, brut
- business-logic-vuln.md [Business Logic & Session] — Entry P1 category router for business logic testing. Use when workflow abuse, race conditions, pricing flaws, or multi-step state attacks matter more 
- business-logic-vulnerabilities.md [Business Logic & Session] — Business logic vulnerability playbook. Use when reasoning about workflows, race conditions, price manipulation, coupon abuse, state machines, and mult
- clickjacking.md [Business Logic & Session] — Clickjacking playbook. Use when testing whether target pages can be framed, whether X-Frame-Options or CSP frame-ancestors are properly configured, an
- command-injection.md [Injection Attacks] — Command injection playbook. Use when user input may reach shell commands, process execution, converters, import pipelines, or blind out-of-band comman
- cors-cross-origin-misconfiguration.md [Business Logic & Session] — CORS misconfiguration testing playbook. Use when analyzing cross-origin trust, credentialed browser reads, origin reflection, preflight policy bugs, a
- crlf-injection.md [Injection Attacks] — CRLF injection playbook. Use when user input reaches HTTP response headers, Location redirects, Set-Cookie values, or log files where carriage-return/
- csp-bypass-advanced.md [Advanced Web Security] — Advanced Content Security Policy bypass techniques. Use when XSS or data exfiltration is blocked by CSP and you need to find policy weaknesses, truste
- csrf.md [Business Logic & Session] — CSRF testing playbook. Use when reviewing state-changing web flows, anti-CSRF defenses, SameSite behavior, JSON CSRF, login CSRF, and OAuth state hand
- csv-formula-injection.md [Injection Attacks] — CSV/spreadsheet formula injection (DDE, Excel/LibreOffice, Google Sheets IMPORT*). Use when exports, imports, or user fields feed spreadsheets or repo
- dangling-markup-injection.md [Advanced Web Security] — Dangling markup injection playbook. Use when HTML injection is possible but JavaScript execution is blocked (CSP, sanitizer strips event handlers, WAF
- defi-attack-patterns.md [Blockchain & Smart Contract] — DeFi attack pattern playbook. Use when analyzing flash loan attacks, price oracle manipulation, MEV sandwich attacks, governance exploits, bridge vuln
- deserialization-insecure.md [Injection Attacks] — Insecure deserialization playbook. Use when Java, PHP, or Python applications deserialize untrusted data via ObjectInputStream, unserialize, pickle, o
- dns-rebinding-attacks.md [Advanced Web Security] — DNS rebinding attack playbook. Use when testing applications that trust DNS resolution for origin checks, interact with internal services from browser
- email-header-injection.md [Advanced Web Security] — Email header injection and spoofing playbook. Use when testing contact forms, email APIs, password reset flows, or any feature that constructs SMTP me
- expression-language-injection.md [Injection Attacks] — Expression Language injection playbook. Use when Java EL, SpEL, OGNL, or MVEL expressions may evaluate attacker-controlled input in Spring, Struts2, C
- file-access-vuln.md [File & Path Attacks] — Entry P1 category router for file access and upload workflows. Use when testing download endpoints, file paths, local file inclusion, upload flows, pr
- ghost-bits-cast-attack.md — (见文件)
- graphql-and-hidden-parameters.md [API Security] — GraphQL and hidden parameter testing playbook. Use when exploring introspection, batching, undocumented fields, hidden parameters, schema abuse, and G
- pentest-router.md [Reconnaissance & Methodology] — Entry P0 primary router for HackSkills. Use when the task involves web application testing, API security assessment, recon, vulnerability triage, expl
- http-host-header-attacks.md [Advanced Web Security] — HTTP Host header injection and routing abuse playbook. Use when the application trusts the Host header for generating URLs, routing requests, or acces
- http-parameter-pollution.md [Injection Attacks] — HTTP Parameter Pollution (HPP): duplicate query/body keys parsed differently by servers, proxies, WAFs, and app frameworks. Use when filters and appli
- http2-specific-attacks.md [Advanced Web Security] — HTTP/2 protocol-specific attack playbook. Use when the target supports HTTP/2 and you need to exploit binary framing, HPACK compression, h2c upgrade s
- idor.md [Authentication & Authorization] — IDOR and broken object authorization testing playbook. Use when requests expose object identifiers, tenant boundaries, writable fields, or missing obj
- injection-checking.md [Injection Attacks] — Entry P1 category router for injection testing. Use when routing between XSS, SQLi, SSRF, XXE, SSTI, command injection, and NoSQL injection workflows 
- jndi-injection.md [Injection Attacks] — JNDI injection playbook. Use when Java applications perform JNDI lookups with attacker-controlled names, especially via Log4j2, Spring, or any code pa
- jwt-attack.md [Authentication & Authorization] — JWT and OAuth token attack playbook. Use when validating token trust, signing algorithms, key handling, claim abuse, bearer flows, and OAuth account-b
- nosql-injection.md [Injection Attacks] — NoSQL injection playbook. Use when MongoDB-style operators, JSON query objects, flexible search filters, or backend query DSLs may allow data or logic
- oauth-token-attacks.md [Authentication & Authorization] — OAuth and OIDC misconfiguration testing playbook. Use when reviewing redirect URI handling, state and nonce validation, PKCE, token audience, callback
- open-redirect.md [Business Logic & Session] — Open redirect playbook. Use when URL parameters, form actions, or JavaScript sinks control navigation targets and may redirect users to attacker-contr
- path-traversal-lfi.md [File & Path Attacks] — Path traversal and LFI playbook. Use when file paths, download endpoints, include operations, archive extraction, or wrapper behavior may expose files
- prototype-pollution.md [Injection Attacks] — Prototype pollution testing for JavaScript stacks. Use when user input is merged into objects (query parsers, JSON bodies, deep assign), when configur
- prototype-pollution-advanced.md [Advanced Web Security] — Advanced prototype pollution playbook — server-side RCE, client-side gadgets, filter bypasses, and detection techniques. Companion to ../prototype-pol
- race-condition.md [Business Logic & Session] — Race condition and TOCTOU testing for web apps. Use when testing one-time operations, concurrent HTTP abuse, rate-limit bypass, Turbo Intruder gates, 
- recon-and-methodology.md [Reconnaissance & Methodology] — Reconnaissance and methodology playbook. Use when mapping assets, discovering endpoints, fingerprinting technology, and building a structured testing 
- recon-for-sec.md [Reconnaissance & Methodology] — Entry P1 category router for reconnaissance and methodology. Use when mapping scope, discovering assets, fingerprinting technology, building endpoint 
- request-smuggling.md [Injection Attacks] — HTTP request smuggling and desynchronization testing. Use when front proxies, CDNs, or load balancers disagree with the origin on message framing (Con
- saml-sso-assertion-attacks.md [Authentication & Authorization] — SAML SSO assertion attack playbook. Use when testing signature validation, assertion wrapping, audience restrictions, ACS handling, XML trust boundari
- smart-contract-vulnerabilities.md [Blockchain & Smart Contract] — Smart contract vulnerability playbook. Use when auditing Solidity/EVM contracts for reentrancy, integer overflow, access control, delegatecall, flash 
- sql-injection.md [Injection Attacks] — SQL injection playbook. Use when input reaches SQL queries, authentication logic, sorting, filtering, reporting, or DB-specific blind and out-of-band 
- ssrf.md [Injection Attacks] — SSRF playbook. Use when the server fetches URLs, resolves hostnames, imports remote content, or can be driven toward internal networks, cloud metadata
- ssti.md [Injection Attacks] — SSTI playbook. Use when template expressions, server-side rendering, preview features, or templating engines may evaluate attacker-controlled content.
- subdomain-takeover.md [Advanced Web Security] — Subdomain takeover detection and exploitation playbook. Use when targets have dangling CNAME/NS/MX records pointing to deprovisioned cloud resources, 
- type-juggling.md [Injection Attacks] — PHP type juggling and weak comparison (`==`) bypass. Use when authentication, HMAC/signature checks, or token validation uses loose equality, numeric 
- upload-insecure-files.md [File & Path Attacks] — Insecure file upload playbook. Use when testing upload validation, storage paths, processing pipelines, preview behavior, overwrite risks, and upload-
- waf-bypass-techniques.md [Advanced Web Security] — WAF bypass methodology and generic evasion techniques. Use when a web application firewall blocks injection payloads (SQLi, XSS, RCE) and you need to 
- web-cache-deception.md [Business Logic & Session] — Web cache deception and poisoning playbook. Use when CDN, reverse proxy, or application caching may serve sensitive authenticated content to other use
- xslt-injection.md [Injection Attacks] — XSLT injection testing: processor fingerprinting, XXE and document() SSRF, EXSLT write primitives, PHP/Java/.NET extension RCE surfaces. Use when user
- xss.md [Injection Attacks] — XSS playbook. Use when user-controlled content reaches HTML, attributes, JavaScript, DOM sinks, uploads, or multi-context rendering paths.
- xxe.md [Injection Attacks] — XXE playbook. Use when XML, SVG, OOXML, SOAP, or parser-driven imports may resolve external entities, files, or internal network resources.

- pentest-web-checklist.md — 授权渗透 Web 域清单（OWASP Top 10 + 前端 JS 深度分析，authorized-pentest-framework）
- api-dictionary.md — API 字典累积规范
