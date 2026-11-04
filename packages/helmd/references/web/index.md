# Web 应用安全 参考索引

> 自动生成，勿手改。共 **131** 篇；总索引：[../index.md](../index.md)。重新生成：`node scripts/gen-references-index.mjs`。

**职责边界**：前端 JS、API 黑盒、认证授权、注入、文件与请求层、缓存/WAF、业务逻辑、区块链。协议层归 protocol 域。

**先读**：[Web 安全分析方法论](./web-methodology.md) · [Web 安全分析核心原则](./web-principles.md) · [Frontend JS 逆向分析](./frontend-js-reverse.md) · [Web API 黑盒漏洞测试方法论](./api-blackbox-testing.md) · [WAF 绕过方法论](./waf-bypass.md)

## 方法论、侦察与 JS 逆向（30）

| 文档 | 讲什么 | 类型 |
|---|---|---|
| [被动侦察](./passive-recon.md) | 被动侦察：搜索引擎、证书、历史数据与第三方泄露面。 | 参考 / AboutSecurity |
| [多步骤攻击编排模式](./attack-orchestration.md) | 多步骤攻击编排参考。当单步攻击无法完成目标时，需要通过多个窗口/页面之间的协作来编排攻击链。 | 参考 |
| [来自前端 JS 逆向 - 用户服务](./api-dictionary.md) | 前端 JS 中提取的 API/参数/存储键字典，供黑盒测试复用。 | 参考 |
| [浏览器调试与自动化 — CDP / Playwright / DevTools API](./browser-debugging.md) | 需要自动化 Chrome 行为、远程执行 JS、控制调试器时使用。 | 参考 |
| [目标画像](./target-profiling.md) | 本文档与 recon-full（主动扫描）互补：recon-full 负责「发现」，target-profiling 负责「分析和整理」。如果还没做侦察，先执行 recon-full。 | 参考 / AboutSecurity |
| [逆向分析结果视频化工作流](./video-production-workflow.md) | 将前端JS逆向、API黑盒测试等技术分析结果，转化为短视频内容 | 方法论 |
| [社会工程](./social-engineering.md) | ⛔ 深入参考：钓鱼邮件模板、pretexting 话术、凭据猜测脚本、水坑攻击方法见 下文「REF: social-engineering-techniques」 | 参考 / AboutSecurity |
| [完整侦察流程](./recon-full.md) | 本文档是渗透测试的标准第一步，目标是从域名/IP 出发，尽可能多地发现资产和漏洞。 | 参考 / AboutSecurity |
| [侦察与方法论路由](./recon-for-sec.md) | 新目标 / 未知攻击面的侦察入口。 | 参考 |
| [租号/账号租赁系统安全分析模式](./rental-system-exploitation.md) | 适用目标：Steam租号、游戏账号租赁、验证码查询等平台。 | 手册 |
| [API 安全路由](./api-sec.md) | API 安全测试路由：recon / auth / BOLA / 隐藏参数的选择。 | 参考 |
| [API Fuzz](./api-fuzz.md) | 重点路径：/api/, /v1/, /v2/, /graphql, /rest/ | 参考 / AboutSecurity |
| [API Recon and Docs — Endpoints, Schemas, and Version Surface](./api-recon-and-docs.md) | API 侦察与文档：端点、schema、版本与隐藏面。 | 参考 |
| [Bot 模式分类与识别](./bot-patterns.md) | Bot 快速分类参考。聚焦 Bot 代码结构分析和模式快速识别。 | 手册 |
| [CRMEB E-commerce System Reconnaissance](./crmeb-recon.md) | 适用目标：基于 CRMEB（开源新零售社交电商系统）搭建的商城 | 参考 |
| [Frontend JS 逆向分析](./frontend-js-reverse.md) | 前端 JS 逆向：定位入口、还原混淆、抽取 API 与签名参数。 | 参考 |
| [GraphQL 方法论](./graphql.md) | 常见路径: /graphql, /api/graphql, /graphiql, /v1/graphql, /query | 参考 / AboutSecurity |
| [GraphQL and Hidden Parameters — Introspection, Batching, and Undocumented Fields](./graphql-and-hidden-parameters.md) | GraphQL introspection/batching 与隐藏参数发现。 | 参考 |
| [HackSkills 路由](./pentest-router.md) | Bug bounty / Web / API 渗透的顶层路由。 | 参考 |
| [JavaScript 混淆模式识别与反混淆](./js-obfuscation-patterns.md) | 分析 JS 逆向题/恶意脚本/混淆代码时使用。 | 手册 |
| [JS API 提取](./js-api-extract.md) | 前后端分离架构中，JS bundle 是 API 端点的最大信息源——比目录扫描高效 10 倍。 | 参考 / AboutSecurity |
| [Next.js App Router 安全分析方法论](./nextjs-analysis.md) | Next.js App Router 安全分析参考。聚焦 App Router 模式的安全分析，包括 RSC/flight data 分析、nodemodules 源码审计、middleware 审计。 | 参考 |
| [Recon and Methodology — Expert Bug Bounty Playbook](./recon-and-methodology.md) | Bug bounty 侦察方法论：子域、端口、指纹与资产优先级。 | 方法论 |
| [SPA/前端框架安全分析方法论](./spa-frontend-analysis.md) | 前端框架（SvelteKit、React SPA 等）安全分析参考。聚焦无后端数据库、数据全部存在客户端的场景（localStorage/sessionStorage）。 | 参考 |
| [V2Board Penetration Testing Reference](./v2board-recon.md) | V2Board 面板侦察与 CORS/API 攻击面。 | 参考 |
| [Web 安全分析方法论](./web-methodology.md) | Web 测试方法论：白盒/黑盒路径、输入追踪与验证顺序。 | 方法论 |
| [Web 安全分析核心原则](./web-principles.md) | 从 secplan 领域编排器提取的通用方法论，去掉了任务编排与框架运行时引用。读完自行判断，非硬性规则。 | 方法论 |
| [Web 渗透测试清单](./pentest-web-checklist.md) | 用于 main document §9 的 Web 域路由。覆盖 OWASP Top 10 主线，并强调前端 JS 深度分析与架构梳理。以"系统/主机"为单位全面覆盖其所有端口/服务/组件。 | 清单 |
| [Web API 黑盒漏洞测试方法论](./api-blackbox-testing.md) | 实战总结的 PHP/Web API 黑盒安全测试流程。适用于没有源码、只有 URL 的场景。 | 参考 |
| [Web API Recon & Chain Exploitation Patterns](./web-api-recon-patterns.md) | Web API 侦察与链式利用模式：令牌泄露、对象枚举与越权。 | 手册 |

## 认证、授权与会话（17）

| 文档 | 讲什么 | 类型 |
|---|---|---|
| [401/403 Bypass Techniques — Expert Attack Playbook](./401-403-bypass.md) | 401/403 绕过：路径变形、方法/头/编码与代理差异。 | 手册 |
| [认证与授权路由](./auth-sec.md) | 认证与授权测试路由：登录、会话、JWT、OAuth、CORS、CSRF。 | 参考 |
| [移动端后端 API](./mobile-backend.md) | 移动后端 API 和传统 Web 的区别：移动端通常直接调用 REST API（不经过浏览器），认证机制、参数格式、业务逻辑都有移动端特色。 | 参考 / AboutSecurity |
| [API Auth and JWT Abuse — Token Trust, Header Tricks, and Rate Limits](./api-auth-and-jwt-abuse.md) | API 认证与 JWT 滥用：token 信任、头伪造与限速绕过。 | 参考 |
| [API Authorization and BOLA — Object Access, Function Access, and Mass Assignment](./api-authorization-and-bola.md) | API 授权与 BOLA：对象/功能级越权与批量赋值。 | 参考 |
| [Authentication Bypass — Expert Attack Playbook](./authbypass-authentication-flaws.md) | After reducing routing entries, default credentials, username variants, port focus, and wordlist sizing are handled here in one place. | 手册 |
| [Clickjacking — Expert Attack Playbook](./clickjacking.md) | Clickjacking loads a target page in a transparent iframe overlaid on an attacker's page.… | 参考 |
| [Cookie 分析](./cookie-analysis.md) | 覆盖：When to Use / Step 1: Extract the cookie / Step 2: Identify cookie type / Step 3: Common bypass patterns | 参考 / AboutSecurity |
| [CORS Misconfiguration — Credentialed Origins, Reflection, and Trust Boundary Errors](./cors-cross-origin-misconfiguration.md) | Some origin validators normalize Unicode after comparison, while the browser sends the original — or vice versa. | 参考 |
| [CORS Misconfiguration — Extended Scenarios](./cors-cross-origin-misconfiguration-scenarios.md) | 主文档扩展：JSONP hijacking, same-origin policy deep dive, and real-world exploitation patterns. | 手册 |
| [CSRF — Cross-Site Request Forgery — Expert Attack Playbook](./csrf.md) | CSRF exploits a victim's active session to perform state-changing requests from the attacker's origin. | 参考 |
| [IDOR 不安全直接对象引用方法论](./idor.md) | IDOR 测试：参数包装/编码/HPP/方法切换、批量检测与标识符可预测性。 | 参考 / hack-skills |
| [JWT 攻击方法论](./jwt-attack.md) | JWT 攻击：算法混淆、kid/jku/x5u 注入与离线爆破。 | 参考 / hack-skills |
| [OAuth Token 攻击](./oauth-token-attacks.md) | 适用场景：应用支持 Login with Google/GitHub/Microsoft/Okta 等 IdP；URL 出现 authorize/callback/redirecturi/code/state/nonce/codechallenge；移动端或 SPA 依赖 OAuth/OIDC 流。 | 手册 / hack-skills |
| [OAuth/SSO 攻击方法论](./oauth-sso-attack.md) | 点击「第三方登录」，观察重定向 URL 中的 clientid, redirecturi, responsetype, scope, state。 | 参考 / AboutSecurity |
| [SAML SSO and Assertion Attacks — Signature Validation, Binding, and Trust Confusion](./saml-sso-assertion-attacks.md) | SAML SSO 断言攻击：签名校验、绑定与信任混淆。 | 手册 |
| [Web 权限提升](./privilege-escalation-web.md) | Web 权限提升和系统提权不同——不需要 exploit，只需要找到应用逻辑中的权限检查漏洞。 | 参考 / AboutSecurity |

## 注入与反序列化（39）

| 文档 | 讲什么 | 类型 |
|---|---|---|
| [表达式语言注入](./expression-language-injection.md) | 关键区分：SSTI 针对模板渲染引擎；EL 注入针对 Java 框架中嵌入的表达式求值器。 | 参考 / AboutSecurity |
| [反序列化方法论](./deserialization.md) | 常见位置：Cookie 值、POST Body、Hidden 表单字段（viewstate）、API 参数、文件上传 | 参考 / AboutSecurity |
| [原型链污染利用](./prototype-pollution-exploit.md) | 核心原理：通过修改 Object.prototype，向所有 JavaScript 对象注入恶意属性 | 参考 / AboutSecurity |
| [注入测试路由](./injection-checking.md) | 注入测试路由：按解释器/执行环境选择测试。 | 参考 |
| [Advanced XSS Tricks — Supplementary Reference](./xss-advanced-xss-tricks.md) | Browser HTML parser "fixes" markup differently than sanitizers expect, causing benign-looking HTML to mutate into executable payloads after DOM insert… | 手册 |
| [CRLF Injection — Expert Attack Playbook](./crlf-injection.md) | 覆盖：CORE CONCEPT / DETECTION / EXPLOITATION SCENARIOS / FILTER BYPASS | 参考 |
| [CSV Formula Injection](./csv-formula-injection.md) | Routing note: when testing CSV exports, back-office reports, or user data opened in spreadsheets, prioritize these prefix characters. | 参考 |
| [Email Header Injection — Expert Attack Playbook](./email-header-injection.md) | SMTP headers are separated by CRLF (\r\n). If user input is placed into email headers without sanitization, injecting %0d%0a (or \r\n) adds arbitrary … | 参考 |
| [ENGINEPAYLOADS.md — Extended SSTI Fingerprinting & Payload Matrix](./ssti-engine-payloads.md) | 主文档扩展：per-engine payloads, fingerprint probes, and blind SSTI detection techniques. | 参考 |
| [Extra Injection Types — SSI, LDAP, XPath](./injection-checking-extra-injection-types.md) | 主文档扩展：injection types that are less common in modern web apps but still appear in specific technology stacks. | 参考 |
| [HTTP Parameter Pollution (HPP)](./http-parameter-pollution.md) | Hypothesis: the security check reads one occurrence of a parameter while the action reads another. | 参考 |
| [Insecure Deserialization — Expert Attack Playbook](./deserialization-insecure.md) | Key classes in the chain: InvokerTransformer → ChainedTransformer → TransformedMap → triggers Runtime.exec() during deserialization. | 参考 |
| [Java 反序列化方法论](./java-deserialization.md) | Java 反序列化是 Java 生态中最危险的漏洞类之一——一旦成功通常直接 RCE。 | 参考 / AboutSecurity |
| [Java Gadget Chains & Cross-Language Deserialization Deep Dive](./deserialization-insecure-java-gadget-chains.md) | Recommended priority: CC6 → CC7 → CC5 (broadest compatibility, no JDK version constraint). | 手册 |
| [JNDI Injection — Expert Attack Playbook](./jndi-injection.md) | JNDI (Java Naming and Directory Interface) provides a unified API for looking up objects from naming/directory services (RMI, LDAP, DNS, CORBA). | 参考 |
| [LDAP 注入](./ldap-injection.md) | LDAP（轻量目录访问协议）广泛用于企业用户认证和目录查询。当应用将用户输入直接拼接到 LDAP 搜索过滤器中时，攻击者可以修改查询逻辑来绕过认证或提取目录数据。 | 参考 / AboutSecurity |
| [NoSQL 注入](./nosql-injection.md) | NoSQL 数据库（MongoDB 为主）使用结构化查询对象而非 SQL 字符串，但这不意味着安全——当应用直接将用户输入拼接到查询对象中时，攻击者可以注入查询操作符来改变查询逻辑。 | 参考 / AboutSecurity |
| [OS Command Injection — Expert Attack Playbook](./command-injection.md) | Other sinks (quick reference): PDF generators (wkhtmltopdf / WeasyPrint with user HTML); Git wrappers (git clone URL / hooks). | 参考 |
| [PHP 类型混淆](./php-type-juggling.md) | 只要 $storedhash 的 MD5 恰好是 0e 开头纯数字，攻击者只需输入任何一个已知 MD5 也是 0e 开头纯数字的字符串。 | 参考 / AboutSecurity |
| [PHP 绕过](./php-bypass.md) | 当你已获取 webshell（能执行 PHP 代码）但无法执行系统命令时，本文档 指导你突破 disablefunctions 和 openbasedir 限制。 | 手册 / AboutSecurity |
| [PHP Type Juggling — Weak Comparison & Magic Hash Bypass](./type-juggling.md) | First-pass goal: prove the server branch treats unequal secrets/tokens as equal via coercion, not guess the real password. | 参考 |
| [Prototype Pollution — Expert Attack Playbook](./prototype-pollution.md) | Routing note: prioritize PP when you see deep merges, recursive assign, JSON.parse followed by Object.assign, or URL queries converted to nested objec… | 参考 |
| [Prototype Pollution — Known Gadgets Reference](./prototype-pollution-advanced-known-gadgets.md) | 原型链污染 known gadgets：Angular sandbox、DOM XSS 与常见库利用链。 | 手册 |
| [Prototype Pollution Advanced — RCE & Gadget Exploitation](./prototype-pollution-advanced.md) | Detection: any EJS res.render() call after pollution triggers it. | 手册 |
| [Python 原型链污染](./python-prototype-pollution.md) | Python 原型链污染（又称 Class Pollution / Attribute Injection）利用 Python 类继承和 globals 机制，通过递归合并函数或深度属性设置函数（如 pydash.set()），从一个普通对象"跳出"当前作用域，修改全局变量、Flask 配置、Jin… | 参考 / AboutSecurity |
| [Python Web 调试](./python-web-debug.md) | Werkzeug debugger 在 Debug 模式下提供交互式 Python console，但自 Werkzeug 0.11+ 起需要 PIN 码验证。 | 参考 / AboutSecurity |
| [SQL 注入完整方法论](./sql-injection.md) | SQL 注入完整方法论：判据、数据库指纹、盲注与 sqlmap 配合。 | 参考 / hack-skills |
| [SQL Injection — Extended Scenarios & Real-World Cases](./sql-injection-scenarios.md) | 主文档扩展：additional attack scenarios, CVE case studies, and injection techniques from real-world engagements. | 手册 |
| [SQLMap Advanced Workflow & Deep SQL Injection Techniques](./sql-injection-sqlmap-advanced.md) | Tamper scripts modify payloads to evade WAF/IDS. Stack multiple with commas. | 手册 |
| [SSRF — Extended Scenarios & Real-World Cases](./ssrf-scenarios.md) | 主文档扩展：additional CVE case studies, advanced bypass techniques, and chaining scenarios. | 手册 |
| [SSRF 攻击方法论](./ssrf.md) | 配套：ssrf-scenarios.md（WebLogic/Redis RCE 链/DNS Rebinding/K8s CVE）、ssrf-url-parser-tricks.md（各语言 URL 解析差异表 + 全云元数据目录）。 | 参考 / hack-skills |
| [SSTI — Extended Scenarios & Real-World Cases](./ssti-scenarios.md) | 主文档扩展：additional CVE cases, PHP template exploitation, and expression language crossover scenarios. | 手册 |
| [SSTI 服务端模板注入方法论](./ssti.md) | SSTI：引擎识别、payload 矩阵与各框架/CVE 场景。 | 参考 / hack-skills |
| [URL Parser Differentials & Advanced SSRF Techniques](./ssrf-url-parser-tricks.md) | Different URL parsers interpret ambiguous URLs differently. This is the core of SSRF filter bypass. | 手册 |
| [XML External Entity Injection (XXE) — Expert Attack Playbook](./xxe.md) | Then rewrite body as XML — many backends use dual-format parsers or auto-detect. | 参考 |
| [XSLT 注入测试方法论](./xslt-injection.md) | XSLT 注入：引擎能力、payload 分类与验证。 | 参考 / hack-skills |
| [XSS — Extended Scenarios & Real-World Cases](./xss-scenarios.md) | 主文档扩展：additional attack scenarios, CVE case studies, and defense bypass techniques. | 手册 |
| [XSS 跨站脚本完整方法论](./xss.md) | XSS：上下文判据、CSP/框架绕过与利用链。 | 参考 / hack-skills |
| [XXE — Extended Scenarios & Real-World Cases](./xxe-scenarios.md) | 主文档扩展：additional CVE case studies and exploitation techniques. | 手册 |

## 文件、路径与信息泄露（7）

| 文档 | 讲什么 | 类型 |
|---|---|---|
| [路径穿越 / LFI](./path-traversal-lfi.md) | Path Traversal: Read arbitrary files by escaping the intended directory with ../ sequences. | 参考 |
| [文件访问路由](./file-access-vuln.md) | 文件访问/上传/下载/预览测试路由。 | 参考 |
| [文件上传方法论](./file-upload.md) | 上传链路测试：解析、存储、执行与绕过。 | 参考 / AboutSecurity |
| [信息泄露方法论](./information-disclosure.md) | → 源码恢复详细步骤 → 下文对应 REF 章节 | 参考 / AboutSecurity |
| [Open Redirect — Expert Attack Playbook](./open-redirect.md) | Open redirect occurs when an application redirects users to a URL derived from user input without validation.… | 参考 |
| [Upload Insecure Files — Extended Scenarios & Real-World Cases](./upload-insecure-files-scenarios.md) | 主文档扩展：parsing vulnerabilities, PUT method attacks, and CVE case studies. | 手册 |
| [Upload Insecure Files — Validation Bypass, Storage Abuse, and Processing Chains](./upload-insecure-files.md) | Many targets validate only one stage. The bug usually appears in a different stage than the one where the file was uploaded. | 参考 |

## 请求层、缓存与 WAF（24）

| 文档 | 讲什么 | 类型 |
|---|---|---|
| [缓存投毒与请求走私](./cache-poisoning-smuggling.md) | 两种相关但不同的高级 Web 攻击技术，都利用了多层 Web 架构中的解析差异。 | 参考 / AboutSecurity |
| [子域名接管](./subdomain-takeover.md) | 影响：cookie 窃取（父域 cookie）、OAuth token 拦截、可信域名钓鱼、CORS 绕过、CSP 绕过。 | 参考 / AboutSecurity |
| [子域名深度枚举](./subdomain-deep.md) | ⛔ 深入参考：subfinder/ksubdomain/amass 的完整参数、通配符过滤脚本、多工具联合流程见 下文「REF: enumeration-tools」 | 参考 / AboutSecurity |
| [CSP Bypass — Advanced Techniques](./csp-bypass-advanced.md) | Critical insight: base-uri, form-action, and frame-ancestors do NOT fall back to default-src. Their absence is always a potential bypass vector. | 手册 |
| [CSP（Content Security Policy）绕过技术](./csp-bypass.md) | CSP 通过 HTTP 响应头 Content-Security-Policy 告诉浏览器哪些资源可以加载/执行。 | 手册 |
| [Dangling Markup Injection — Exfiltration Without JavaScript](./dangling-markup-injection.md) | Core insight: You don't need JavaScript to exfiltrate data — you just need the browser to make a request that includes the data in the URL. | 参考 |
| [DNS Rebinding — Expert Attack Playbook](./dns-rebinding-attacks.md) | Key insight: SOP checks the hostname string, not the resolved IP. DNS can change the IP behind the same hostname. | 手册 |
| [Ghost Bits / Cast Attack — Java char to byte Narrowing Playbook](./ghost-bits-cast-attack.md) | not a standalone vulnerability class. Whenever you see (1) a Java backend, | 参考 |
| [Ghost Bits Cast Attack — Payload Cookbook](./ghost-bits-cast-attack-payload-cookbook.md) | main document is already in context AND you need (a) a complete | 手册 |
| [Host 头攻击](./http-host-header-attacks.md) | 如果应用不验证 Host header，攻击者可以操纵它来投毒链接、缓存或路由。 | 手册 / AboutSecurity |
| [HTTP 请求走私](./request-smuggling.md) | Routing note: load this document when you suspect CDN/reverse-proxy and origin disagree on request-end boundaries, or when abnormal concatenation appe… | 参考 |
| [HTTP/2 Smuggling Variants & Advanced Desync Techniques](./request-smuggling-h2-smuggling-variants.md) | HTTP/2 specification forbids transfer-encoding in H2 frames. However, some front-end proxies don't strip it when downgrading to H1.… | 手册 |
| [HTTP/2 Specific Attacks — Expert Attack Playbook](./http2-specific-attacks.md) | h2c is HTTP/2 without TLS, negotiated via the HTTP/1.1 Upgrade mechanism.… | 手册 |
| [WAF 绕过方法论](./waf-bypass.md) | WAF 识别、语法变形与分块/编码绕过。 | 手册 / AboutSecurity |
| [WAF Bypass Techniques — Evasion Playbook](./waf-bypass-techniques.md) | WAFs that inspect the full body may not reassemble chunks before matching. | 手册 |
| [WAF Bypass: Digit-Anchored Regex Filters](./waf-bypass-digit-regex.md) | Match condition: String contains a digit, followed by at least 1 char, then a non-digit, then at least 1 more char. Minimum 4 characters. | 手册 |
| [WAF Product Bypass Matrix](./waf-bypass-techniques-waf-product-matrix.md) | 按 WAF 产品对照绕过语法：Cloudflare/AWS/ModSecurity/Akamai。 | 手册 |
| [Web 缓存欺骗](./web-cache-deception.md) | Cache keys typically include: Host, URL path, query string. | 参考 |
| [Web 漏洞扫描](./web-vuln-scan.md) | 与 recon-full（广度优先、资产发现）不同，本文档是深度优先——对已确定的单个 Web 目标做全面漏洞测试。 | 参考 / AboutSecurity |
| [Web Cache Poisoning 专题](./cache-poisoning.md) | Web Cache Poisoning 深度参考。 | 参考 |
| [Web Cache Poisoning Techniques — Advanced Reference](./web-cache-deception-cache-poisoning-techniques.md) | These are distinct attack classes — do not confuse them. | 手册 |
| [Webshell 部署](./webshell-deploy.md) | 当漏洞利用需要上传/写入 webshell 时，按此方法论操作。 | 参考 / AboutSecurity |
| [Webshell 管理](./webshell-management.md) | 前置条件：webshell 已部署到目标。本文档 聚焦部署后的 CLI 交互与管理操作。 | 参考 / AboutSecurity |
| [WebSocket 攻击](./websocket-attack.md) | WebSocket 提供全双工通信，但安全机制常被忽略——没有同源策略的自动保护、没有 CSRF token 的标准实践。 | 参考 / AboutSecurity |

## 业务逻辑与平台测试（11）

| 文档 | 讲什么 | 类型 |
|---|---|---|
| [竞态条件](./race-condition.md) | TOCTOU means the decision (check) and the mutation (use) are not one indivisible step. | 参考 |
| [业务逻辑攻击](./business-logic-attack.md) | 业务逻辑漏洞的本质是：应用在服务端没有正确校验业务规则，导致攻击者可以通过修改请求参数来违反预期的业务流程。这类漏洞 WAF 和自动化扫描器几乎无法检测——因为每个请求看起来都是"正常"的 HTTP 请求。 | 参考 / AboutSecurity |
| [业务逻辑漏洞](./business-logic-vulnerabilities.md) | Impact: Receive credit to account, items for free, bank transfers in reverse. | 参考 |
| [业务逻辑漏洞测试方法论](./web-business-logic-vulns.md) | 业务逻辑漏洞无固定签名，几乎无法被自动化工具发现，依赖业务深度理解 | 参考 / hack-skills |
| [业务逻辑路由](./business-logic-vuln.md) | 业务逻辑与状态机测试路由。 | 参考 |
| [Business Logic Vulnerabilities — Extended Scenarios](./business-logic-vulnerabilities-scenarios.md) | 业务逻辑漏洞场景集：支付、验证码、认证与数据暴露的真实案例。 | 手册 |
| [Business Logic Vulnerability Checklist / 业务逻辑漏洞检查清单](./business-logic-vulnerabilities-checklist.md) | 业务逻辑漏洞检查清单：按流程/状态/权限逐项核对。 | 清单 |
| [Business Logic Vulnerability Testing Methodology / 业务逻辑漏洞测试方法论](./business-logic-vulnerabilities-methodology.md) | 业务逻辑测试方法论：状态机、并发、权限与数据边界。 | 方法论 |
| [OWASP WSTG 渗透测试实战案例](./owasp-wstg-case-study.md) | OWASP WSTG 实战案例：信息泄露链、FOFA 与 PHP API 枚举。 | 案例 |
| [Web 漏洞模式速查](./web-vulnerabilities.md) | 漏洞模式速查。每个漏洞类型包含：识别方法、利用思路、关键检查点。 | 参考 |
| [Web 平台全量安全审计方法论](./web-platform-testing.md) | 针对前后端分离的 Web 管理平台的端到端安全审计流程。适用于 FastAPI/Django/Node.js + React/Vue 技术栈。 | 参考 |

## 区块链与智能合约（3）

| 文档 | 讲什么 | 类型 |
|---|---|---|
| [智能合约漏洞](./smart-contract-vulnerabilities.md) | Contract A calls Contract B, which calls back into Contract A (or Contract C that reads A's stale state).… | 参考 |
| [DeFi 攻击模式](./defi-attack-patterns.md) | Flash loans provide uncollateralized borrowing within a single transaction.… | 手册 |
| [Solidity Vulnerability Patterns — Code Reference](./smart-contract-vulnerabilities-solidity-vuln-patterns.md) | Tool to check: cast sig "functionName(argTypes)" computes selector. | 手册 |
