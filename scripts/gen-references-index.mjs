// Generate the references master index and every domain index from the docs on
// disk. The indexes are derived artifacts: never hand-edit them. Run
//   node scripts/gen-references-index.mjs          # rewrite
//   node scripts/gen-references-index.mjs --check  # fail on drift (CI/check suite)
//
// Designing rules:
//   - every markdown file is listed exactly once under its domain;
//   - titles come from the H1, summaries from the first real paragraph (or the
//     H2 outline when the doc opens with navigation);
//   - the task router only links docs that exist — a missing target fails the
//     generator instead of shipping a dead index;
//   - no timestamps, so output is deterministic and diffable.

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const defaultRoot = join(repoRoot, 'packages', 'helmd', 'references')

const DOMAIN_ORDER = ['toolbox', 'android', 'native', 'web', 'ai-security', 'malware', 'protocol', 'evidence']

const DOMAINS = {
  toolbox: {
    title: '工具箱',
    scope: '分诊决策、方法论、模式速查、工具选择/安装与出站通道。任何领域都能先经过这里，但不替代领域文档。',
    read: ['toolbox/decision-tree.md', 'toolbox/methodology.md', 'toolbox/tool-matrix.md', 'toolbox/network-egress.md'],
    groups: [
      ['start', '入口与决策', /^(decision-tree|methodology)$/],
      ['reference', '速查与选型', /^(patterns|tool-matrix)$/],
      ['environment', '环境与出站', /^(tool-install|network-egress)$/],
    ],
  },
  android: {
    title: 'Android / 移动端',
    scope: 'APK/AAB/DEX、Java/Kotlin 与 native 层、Frida、脱壳、TLS 拦截、iOS。桌面 PE/ELF 与通用 Frida API 归 native 域。',
    read: ['android/fingerprint.md', 'android/mobile-methodology.md', 'android/mobile-ssl-pinning-bypass.md', 'android/android-unpacking.md', 'android/frida-hook-principles.md', 'android/android-tools.md'],
    groups: [
      ['start', '方法论与总览', /^(mobile-methodology|mobile-principles|mobile-patterns|fingerprint|android-tools|ios-tools|garlic)$/],
      ['frida', 'Frida 与运行时', /^(mobile-frida|frida-|android-ui-automation|android-pentesting-tricks-frida-scripts)/],
      ['unpack', '脱壳、加固与反分析', /^(android-unpacking|android-shellcode-anti-analysis|android-arm64-memory-dump|android-cloud-native-binary|android-root-module-analysis|android-elf-malware-analysis)/],
      ['malware', 'APK 恶意代码分析', /^(android-apk-malware|androguard-apk-fallback|android-contentobserver|android-deeplink)/],
      ['traffic', '流量与 TLS', /^(mitm-methodology|tls-traffic-interception|mobile-ssl-pinning-bypass|flutter-ssl-bypass)/],
      ['ios', 'iOS', /^ios-/],
      ['external', '外部 playbook', /^android-pentesting-tricks$/],
    ],
  },
  native: {
    title: 'Native / 二进制与主机',
    scope: 'PE/ELF/Mach-O、壳与反调试、ARM64、密码与 JVM 常量、PWN/利用、驱动、Windows/AD/内网、Linux/macOS/容器。',
    read: ['native/sample-intake-playbook.md', 'native/native-principles.md', 'native/protection-detection-methodology.md', 'native/packer-handling.md', 'native/anti-debug-methodology.md'],
    groups: [
      ['start', '入口与方法论', /^(sample-intake-playbook|native-principles|verification-patterns|game-security-methodology)$/],
      ['cases', '案例与实战', /^(bypass-case-|gh-loader-anti-frida-case|native-casebook)/],
      ['protection', '保护、壳与反调试', /^(packer-handling|protection-detection-methodology|anti-debug|anti-frida|code-obfuscation|commercial-hardening|vmp-|elvmp-|memory-patchcode|process-patch|license-bypass|zygisk-module-license|model-decryption-key|windows-av-edr-evasion)/],
      ['tools', '静态分析、反编译与工具', /^(ghidra-|idapython-|r2pipe|radare2-|arm64-|elf-got|pe-|dll-injection|dynamic-analysis|frida-|unicorn-templates|self-extracting|windows-compat|firmware-|apk-signature)/],
      ['crypto', '密码、算法与常量', /^(crypto-|custom-xor|ecdlp-|rsa-|lattice-|classical-cipher|hash-attack|symmetric-cipher)/],
      ['jvm', 'JVM / Java', /^jvm-/],
      ['pwn', 'PWN、堆与利用', /^(stack-overflow|heap-|glibc-|uaf-|format-string|arbitrary-write|binary-protection|kernel-exploitation|kernel-driver|browser-exploitation|symbolic-execution|exploit-dev|sandbox-escape|vm-and-bytecode)/],
      ['infra', 'Windows / AD / 内网 / 容器', /^(active-directory|ad-lpe|ntlm-relay|windows-|linux-|macos-|container-escape|kubernetes-)/],
      ['mobile-native', 'Android native / shellcode', /^(android-|nbg-)/],
      ['misc', '其他二进制参考', /^./],
    ],
  },
  web: {
    title: 'Web 应用安全',
    scope: '前端 JS、API 黑盒、认证授权、注入、文件与请求层、缓存/WAF、业务逻辑、区块链。协议层归 protocol 域。',
    read: ['web/web-methodology.md', 'web/web-principles.md', 'web/frontend-js-reverse.md', 'web/api-blackbox-testing.md', 'web/waf-bypass.md'],
    groups: [
      ['recon', '方法论、侦察与 JS 逆向', /^(web-methodology|web-principles|attack-orchestration|recon-|passive-recon|target-profiling|js-api-extract|js-obfuscation|frontend-js|browser-debugging|spa-frontend|nextjs-|api-(recon|blackbox|dictionary|fuzz|sec)|graphql|web-api-recon|bot-patterns|pentest-router|pentest-web-checklist|social-engineering|crmeb-|v2board-|rental-system|video-production)/],
      ['auth', '认证、授权与会话', /^(auth-sec|authbypass|api-auth|api-authorization|401-403|cookie-|jwt-|oauth-|saml-|csrf|clickjacking|idor|cors-|privilege-escalation-web|mobile-backend)/],
      ['injection', '注入与反序列化', /^(sql-injection|xss|ssti|xxe|ssrf|command-injection|ldap-|nosql|expression-language|jndi|crlf|csv-|email-header|http-parameter|type-juggling|php-|deserialization|java-deserialization|python-prototype|prototype-pollution|xslt|injection-checking|python-web-debug)/],
      ['file', '文件、路径与信息泄露', /^(file-upload|upload-insecure|file-access|path-traversal|information-disclosure|open-redirect)/],
      ['transport', '请求层、缓存与 WAF', /^(request-smuggling|web-cache-deception|cache-poisoning|csp-bypass|waf-bypass|http-host-header|http2-|websocket-|dns-rebinding|dangling-markup|ghost-bits|subdomain-|web-vuln-scan|webshell-)/],
      ['logic', '业务逻辑与平台测试', /^(business-logic|race-condition|web-business-logic|owasp-wstg|web-platform-testing|web-vulnerabilities)/],
      ['blockchain', '区块链与智能合约', /^(smart-contract|defi-)/],
      ['misc', '其他 Web 参考', /^./],
    ],
  },
  'ai-security': {
    title: 'AI / LLM 安全',
    scope: '提示注入、越狱、模型评测、防御画像、载体构造与拒答路由。只对自有或授权模型端点做评测。',
    read: ['ai-security/llm-attack-methodology.md', 'ai-security/llm-injection-playbook.md', 'ai-security/model-security-analysis-guide.md', 'ai-security/bypass-framework-matrix.md'],
    groups: [
      ['start', '方法论与防御', /^(ai-principles|llm-attack-methodology|model-security-analysis-guide|ai-security-defense|model-defense-profiles)/],
      ['injection', '注入、越狱与载体', /^(llm-injection|llm-prompt-injection|prompt-injection-patterns|carrier-construction|bypass-framework|refusal-prompt)/],
      ['eval', '评测、工作流与模型面', /^(payload-effectiveness|canned-workflows|input-normalization|ai-ml-security|ml-model-security)/],
    ],
  },
  malware: {
    title: '恶意代码与取证',
    scope: '样本分析流程、分平台静态 playbook、内存取证、流量与隐写、IOC/VT 查询。',
    read: ['malware/malware-analysis-methodology.md', 'malware/malware-case-workflow.md', 'malware/memory-forensics-volatility.md', 'malware/traffic-analysis-pcap.md'],
    groups: [
      ['start', '方法论与响应', /^(malware-analysis-methodology|malware-case-workflow|incident-response)/],
      ['static', '静态 playbook', /^malware-static-playbook-/],
      ['forensics', '内存取证', /^memory-forensics-/],
      ['traffic', '流量、隐写与查询', /^(traffic-analysis-pcap|steganography-|vt-lookup)/],
    ],
  },
  protocol: {
    title: '网络协议与流量',
    scope: 'PCAP/协议逆向、协议攻击、隧道与反弹 shell、供应链与源码暴露。应用层 Web 漏洞归 web 域。',
    read: ['protocol/protocol-reverse-methodology.md', 'protocol/traffic-analysis-pcap.md', 'protocol/tunneling-and-pivoting.md', 'protocol/network-protocol-attacks.md'],
    groups: [
      ['start', '抓包与协议逆向', /^(protocol-reverse-methodology|traffic-analysis-pcap)/],
      ['attack', '协议攻击与服务暴露', /^(network-protocol-attacks|http2-|dns-rebinding|websocket-security|unauthorized-access)/],
      ['tunnel', '隧道、代理与反弹', /^(tunneling-and-pivoting|reverse-shell)/],
      ['supply', '供应链与源码暴露', /^(dependency-confusion|insecure-source-code-management)/],
    ],
  },
  evidence: {
    title: '证据链与报告',
    scope: 'Case 证据链、发现 schema/评分、报告模板、漏洞提交与复核。技术细节归各领域。',
    read: ['evidence/workflow.md', 'evidence/finding-schema-severity.md', 'evidence/reporting.md', 'evidence/pentest-report-template.md'],
    groups: [
      ['chain', '证据链与工作流', /^(workflow|reverse-techniques|advisory-ledger|vulnerability-review)/],
      ['schema', '发现结构与知识库', /^(finding-schema-severity|vuln-kb-schema)/],
      ['report', '报告、提交与模板', /^(reporting|pentest-report-template|vuln-reward)/],
    ],
  },
}

const TITLE_OVERRIDES = {
  'evidence/vuln-kb-schema.md': '漏洞知识库 Schema',
  'native/ad-lpe-checklist.md': 'AD 本地提权清单',
  'native/exploit-dev-checklist.md': '漏洞 PoC/检测脚本开发清单',
  'evidence/pentest-report-template.md': '渗透测试报告模板',
  'web/file-upload.md': '文件上传方法论',
  'web/pentest-web-checklist.md': 'Web 渗透测试清单',
  'web/waf-bypass.md': 'WAF 绕过方法论',
  'android/ios-pentesting-tricks.md': 'iOS 渗透测试',
  'android/mobile-ssl-pinning-bypass.md': '移动端 SSL Pinning 绕过',
  'evidence/reverse-techniques.md': '逆向技术参考',
  'evidence/vulnerability-review.md': '漏洞复核',
  'evidence/vuln-reward-submission.md': '漏洞奖励计划提交辅助',
  'evidence/workflow.md': '逆向分析工作流',
  'malware/memory-forensics-volatility.md': '内存取证（Volatility 3）',
  'malware/steganography-techniques.md': '隐写分析技术',
  'malware/traffic-analysis-pcap.md': '流量分析与 PCAP 取证',
  'native/active-directory-kerberos-attacks.md': 'AD Kerberos 攻击',
  'native/anti-debugging-techniques.md': '反调试技术',
  'native/binary-protection-bypass.md': '二进制保护绕过',
  'native/code-obfuscation-deobfuscation.md': '代码混淆与反混淆',
  'native/container-escape-techniques.md': '容器逃逸技术',
  'native/heap-exploitation.md': '堆利用',
  'native/kernel-exploitation.md': 'Linux 内核利用',
  'native/kubernetes-pentesting.md': 'Kubernetes 渗透',
  'native/lattice-crypto-attacks.md': '格密码攻击',
  'native/linux-lateral-movement.md': 'Linux 横向移动',
  'native/linux-privilege-escalation.md': 'Linux 提权',
  'native/ntlm-relay-coercion.md': 'NTLM Relay 与认证强制',
  'native/rsa-attack-techniques.md': 'RSA 攻击技术',
  'native/stack-overflow-and-rop.md': '栈溢出与 ROP',
  'protocol/network-protocol-attacks.md': '网络协议攻击',
  'protocol/reverse-shell-techniques.md': '反弹 Shell 技术',
  'protocol/tunneling-and-pivoting.md': '隧道与横向移动',
  'web/business-logic-vulnerabilities.md': '业务逻辑漏洞',
  'web/path-traversal-lfi.md': '路径穿越 / LFI',
  'web/race-condition.md': '竞态条件',
  'web/request-smuggling.md': 'HTTP 请求走私',
  'web/smart-contract-vulnerabilities.md': '智能合约漏洞',
  'web/web-cache-deception.md': 'Web 缓存欺骗',
  'web/defi-attack-patterns.md': 'DeFi 攻击模式',
  'web/api-sec.md': 'API 安全路由',
  'web/auth-sec.md': '认证与授权路由',
  'web/business-logic-vuln.md': '业务逻辑路由',
  'web/file-access-vuln.md': '文件访问路由',
  'web/injection-checking.md': '注入测试路由',
  'web/pentest-router.md': 'HackSkills 路由',
  'web/recon-for-sec.md': '侦察与方法论路由',
  'web/api-fuzz.md': 'API Fuzz',
  'web/business-logic-attack.md': '业务逻辑攻击',
  'web/cache-poisoning-smuggling.md': '缓存投毒与请求走私',
  'web/cookie-analysis.md': 'Cookie 分析',
  'web/deserialization.md': '反序列化方法论',
  'web/expression-language-injection.md': '表达式语言注入',
  'web/graphql.md': 'GraphQL 方法论',
  'web/http-host-header-attacks.md': 'Host 头攻击',
  'web/information-disclosure.md': '信息泄露方法论',
  'web/java-deserialization.md': 'Java 反序列化方法论',
  'web/js-api-extract.md': 'JS API 提取',
  'web/ldap-injection.md': 'LDAP 注入',
  'web/mobile-backend.md': '移动端后端 API',
  'web/nosql-injection.md': 'NoSQL 注入',
  'web/passive-recon.md': '被动侦察',
  'web/php-bypass.md': 'PHP 绕过',
  'web/php-type-juggling.md': 'PHP 类型混淆',
  'web/privilege-escalation-web.md': 'Web 权限提升',
  'web/prototype-pollution-exploit.md': '原型链污染利用',
  'web/python-prototype-pollution.md': 'Python 原型链污染',
  'web/python-web-debug.md': 'Python Web 调试',
  'web/recon-full.md': '完整侦察流程',
  'web/social-engineering.md': '社会工程',
  'web/subdomain-deep.md': '子域名深度枚举',
  'web/subdomain-takeover.md': '子域名接管',
  'web/target-profiling.md': '目标画像',
  'web/web-vuln-scan.md': 'Web 漏洞扫描',
  'web/webshell-deploy.md': 'Webshell 部署',
  'web/webshell-management.md': 'Webshell 管理',
  'web/websocket-attack.md': 'WebSocket 攻击',
}

const SUMMARY_OVERRIDES = {
  'ai-security/llm-prompt-injection.md': 'LLM 提示注入与越狱载荷总览：直接/间接注入、工具调用、数据外传、多步升级。',
  'ai-security/ai-ml-security.md': 'AI/ML 安全攻击面：供应链、对抗样本、投毒、模型窃取与隐私。',
  'ai-security/llm-prompt-injection-jailbreak-patterns.md': '按类别整理的越狱技术目录：多步升级、角色扮演、编码与边界绕过。',
  'android/android-pentesting-tricks.md': 'Android 渗透 playbook：SSL pinning、导出组件、WebView、Intent 重定向与本地数据。',
  'android/android-root-module-analysis.md': '分析 Magisk / KernelSU / APatch 模块 ZIP 与仓库：结构、权限、持久化与风险点。',
  'android/android-cloud-native-binary.md': 'APK 作为壳，真实逻辑由云端下发到应用私有目录后加载。',
  'android/android-arm64-memory-dump.md': 'Frida 失效时从 Android ARM64 进程内存 dump ELF dropper，并重建可分析镜像。',
  'android/android-shellcode-anti-analysis.md': '多层混淆的 Android ARM64 dropper 与卡密保护 shellcode 的反分析流程。',
  'android/android-elf-malware-analysis.md': 'Android ARM64 ELF 恶意样本（游戏外挂/工具）的静态与动态分析。',
  'android/frida-17x-api.md': 'Frida 17.x API 变化速查：Module/Memory/Process/Bridge 与移动端迁移注意点。',
  'android/frida-17x-bridge.md': 'Frida 17.x Java/ObjC/Swift Bridge 的编译、注入与使用。',
  'android/mobile-ssl-pinning-bypass.md': '移动端 SSL pinning 绕过 playbook：识别实现、Frida Hook 与改包重签流程。',
  'android/ios-pentesting-tricks.md': 'iOS 渗透 playbook：keychain、URL scheme、Universal Links、运行时操控与数据保护。',
  'android/frida-license-bypass-android.md': 'Android 云端下发 ELF 的卡密校验定位与绕过（模块枚举 / Hook / 内存扫描 / patch）。',
  'evidence/pentest-report-template.md': '渗透测试报告模板：范围、发现、证据、复现与修复建议的标准结构。',
  'evidence/vuln-kb-schema.md': '跨系统复用的漏洞知识库条目结构：元数据、根因、影响、复现与修复。',
  'evidence/reverse-techniques.md': '逆向工作流参考：静态优先分诊、反编译、动态调试与加壳/混淆处理。',
  'evidence/advisory-ledger.md': '建议账本：注入建议的采纳/核销签名与统计。',
  'evidence/reporting.md': '安全分析报告模板：结论、证据、复现、影响与修复。',
  'evidence/workflow.md': '逆向分析工作流：范围确认、静态/动态、验证与收口。',
  'native/zygisk-module-license-bypass.md': 'Zygisk 模块卡密绕过：模块结构、license 校验与 patch。',
  'native/memory-patchcode-bypass.md': 'API Hook 失效时的 Memory.patchCode 绕过与验证。',
  'protocol/network-protocol-attacks.md': '二层/三层协议攻击：ARP、LLMNR/NBT-NS、DHCPv6、WPAD。',
  'protocol/tunneling-and-pivoting.md': '隧道与横向：端口转发、SOCKS、代理链与出站规避。',
  'protocol/unauthorized-access-common-services.md': '常见服务未授权访问：端口矩阵、协议指纹与利用路径。',
  'protocol/dependency-confusion.md': '依赖混淆：私有/公共包索引与版本范围导致的供应链投毒。',
  'evidence/vuln-reward-result-template.md': '漏洞奖励提交前的自查结果模板：结论、证据缺口与审核保留项。',
  'evidence/vuln-reward-submission.md': '漏洞奖励提交辅助：是否建议提交、字段如何如实填写。',
  'web/api-dictionary.md': '前端 JS 中提取的 API/参数/存储键字典，供黑盒测试复用。',
  'web/frontend-js-reverse.md': '前端 JS 逆向：定位入口、还原混淆、抽取 API 与签名参数。',
  'web/passive-recon.md': '被动侦察：搜索引擎、证书、历史数据与第三方泄露面。',
  'web/v2board-recon.md': 'V2Board 面板侦察与 CORS/API 攻击面。',
  'web/web-api-recon-patterns.md': 'Web API 侦察与链式利用模式：令牌泄露、对象枚举与越权。',
  'web/web-methodology.md': 'Web 测试方法论：白盒/黑盒路径、输入追踪与验证顺序。',
  'web/api-sec.md': 'API 安全测试路由：recon / auth / BOLA / 隐藏参数的选择。',
  'web/auth-sec.md': '认证与授权测试路由：登录、会话、JWT、OAuth、CORS、CSRF。',
  'web/business-logic-vuln.md': '业务逻辑与状态机测试路由。',
  'web/file-access-vuln.md': '文件访问/上传/下载/预览测试路由。',
  'web/injection-checking.md': '注入测试路由：按解释器/执行环境选择测试。',
  'web/pentest-router.md': 'Bug bounty / Web / API 渗透的顶层路由。',
  'web/recon-for-sec.md': '新目标 / 未知攻击面的侦察入口。',
  'web/401-403-bypass.md': '401/403 绕过：路径变形、方法/头/编码与代理差异。',
  'malware/vt-lookup.md': 'VirusTotal 样本查询操作指南：检测统计、家族标签、文件名与情报提取。',
  'malware/memory-forensics-volatility.md': 'Volatility 3 内存取证：进程、注入、网络与恶意痕迹。',
  'malware/steganography-techniques.md': '隐写分析：LSB、文件结构、图像/音频/文档隐藏数据。',
  'native/anti-debugging-techniques.md': '反调试检测与绕过：ptrace/PEB/时序/异常等检测点及对应绕过。',
  'native/bypass-case-bt-kami.md': 'Android ARM64 宝塔内核 shell 场景下的卡密校验绕过案例。',
  'native/bypass-case-cpu-render-shellcode.md': 'cpurender shellcode 加载型卡密验证的定位与绕过案例。',
  'native/bypass-case-gh-loader-aimbot.md': 'Windows PE GHLoader DLL 注入器的卡密校验绕过案例。',
  'native/bypass-case-tusi-netease.md': 'TUSI-ObfuscatorClang 保护的 Android .so 卡密分析与绕过案例。',
  'native/crypto-validation-patterns.md': '常见密码学验证模式：算法识别、密钥与明密文校验。',
  'native/dynamic-analysis-frida.md': 'Frida 动态分析后备流程：IDA 调试失败时的 attach/spawn、Hook 与验证。',
  'native/dynamic-analysis.md': 'IDA 调试器动态分析首选流程：断点、调用跟踪与内存检查。',
  'native/ecdlp-solving.md': 'ECDLP 求解：曲线识别、求解器选择与渐进策略。',
  'native/frida-hook-templates.md': 'Frida Hook 架构模式与标准模板（Java / native / 拦截器链）。',
  'native/packer-handling.md': '加壳检测后：定位 OEP、dump、修复与静态兜底策略。',
  'native/unicorn-templates.md': 'Unicorn 模拟执行脚本模板与算法验证流程。',
  'native/verification-patterns.md': '结果验证：正向/负向对照、复现命令与判据。',
  'native/uaf-tcache-count-corruption.md': 'glibc 2.27 tcache count 破坏导致的 UAF 利用与堆布局。',
  'native/windows-av-evasion-amsi-bypass-techniques.md': 'AMSI 绕过：AmsiScanBuffer patch、CLR 内存加载与检测规避。',
  'native/anti-debugging-techniques-anti-debug-matrix.md': 'Linux/Windows 反调试技术 × 检测 × 绕过 × 工具兼容性矩阵。',
  'native/binary-protection-bypass.md': 'ASLR/PIE/NX/canary/RELRO/CET 的保护识别与绕过。',
  'native/code-obfuscation-deobfuscation.md': '控制流、字符串、常量与自修改代码的混淆识别和去混淆流程。',
  'native/classical-cipher-analysis.md': '古典密码识别与破解：替换、维吉尼亚、转置与 XOR。',
  'native/dll-injection-runtime-patching.md': 'DLL 注入与运行时内存 patch：定位密钥、改写校验与验证。',
  'native/exploit-dev-checklist.md': '漏洞 PoC/检测脚本开发清单：结构、验证、安全边界与文档规范。',
  'native/hash-attack-techniques.md': '哈希攻击：长度扩展、碰撞、HMAC 时序与 PoW。',
  'native/heap-exploitation.md': 'glibc 堆利用：UAF/double free/overflow 与 house-of 技术。',
  'native/kernel-exploitation.md': 'Linux 内核漏洞利用：UAF/OOB/race、提权与缓解绕过。',
  'native/lattice-crypto-attacks.md': '格密码攻击：Coppersmith、DSA/ECDSA nonce、背包与 LWE。',
  'native/ecdlp-pollard-rho.md': "Pollard's rho 的 ECDLP 并行实现与线程/DP 参数选择。",
  'native/vmp-pe-fast-triage.md': 'VMProtect PE 快速识别：先处理 Defender，再按 URL/域名/strings 信号决定是否继续静态分析。',
  'native/pe-memory-dump-reconstruction.md': '内存 dump 重建为可分析 PE：节表、导入表与 RVA 修正。',
  'native/idapython-reference.md': 'IDAPython 速查：常用 API、脚本模式与无人值守注意事项。',
  'native/radare2-windows-setup.md': 'Windows 下 radare2 + r2ghidra 的安装、配置与验证。',
  'native/radare2-plugin-recommendations.md': 'radare2 常用插件清单与适用场景。',
  'native/rsa-attack-techniques.md': 'RSA 参数弱点与攻击选择：小 n、共模、低指数、因子分解。',
  'native/rsa-attack-techniques-rsa-attack-catalog.md': 'RSA 攻击目录：具体实现、数学推导与适用条件。',
  'native/sandbox-escape-techniques.md': 'Python/Lua/seccomp/chroot/容器/浏览器沙箱逃逸。',
  'native/self-extracting-shellscript-analysis.md': '自解压 shell 脚本 dropper 的识别、解包与行为分析。',
  'native/stack-overflow-and-rop.md': '栈溢出与 ROP：canary/libc/PIE 泄露、链构造与 ret2libc。',
  'native/symmetric-cipher-attacks.md': '分组/流密码模式攻击：CBC padding、ECB 拼接、位翻转。',
  'native/symmetric-cipher-attacks-block-cipher-attacks.md': '分组密码攻击脚本与 walkthrough：CBC/ECB/CTR 场景。',
  'web/api-auth-and-jwt-abuse.md': 'API 认证与 JWT 滥用：token 信任、头伪造与限速绕过。',
  'web/api-authorization-and-bola.md': 'API 授权与 BOLA：对象/功能级越权与批量赋值。',
  'web/api-recon-and-docs.md': 'API 侦察与文档：端点、schema、版本与隐藏面。',
  'web/file-upload.md': '上传链路测试：解析、存储、执行与绕过。',
  'web/graphql-and-hidden-parameters.md': 'GraphQL introspection/batching 与隐藏参数发现。',
  'web/idor.md': 'IDOR 测试：参数包装/编码/HPP/方法切换、批量检测与标识符可预测性。',
  'web/jwt-attack.md': 'JWT 攻击：算法混淆、kid/jku/x5u 注入与离线爆破。',
  'web/owasp-wstg-case-study.md': 'OWASP WSTG 实战案例：信息泄露链、FOFA 与 PHP API 枚举。',
  'web/prototype-pollution-advanced-known-gadgets.md': '原型链污染 known gadgets：Angular sandbox、DOM XSS 与常见库利用链。',
  'web/recon-and-methodology.md': 'Bug bounty 侦察方法论：子域、端口、指纹与资产优先级。',
  'web/saml-sso-assertion-attacks.md': 'SAML SSO 断言攻击：签名校验、绑定与信任混淆。',
  'web/sql-injection.md': 'SQL 注入完整方法论：判据、数据库指纹、盲注与 sqlmap 配合。',
  'web/ssti.md': 'SSTI：引擎识别、payload 矩阵与各框架/CVE 场景。',
  'web/waf-bypass.md': 'WAF 识别、语法变形与分块/编码绕过。',
  'web/waf-bypass-techniques-waf-product-matrix.md': '按 WAF 产品对照绕过语法：Cloudflare/AWS/ModSecurity/Akamai。',
  'web/xss.md': 'XSS：上下文判据、CSP/框架绕过与利用链。',
  'web/xslt-injection.md': 'XSLT 注入：引擎能力、payload 分类与验证。',
  'web/business-logic-vulnerabilities-scenarios.md': '业务逻辑漏洞场景集：支付、验证码、认证与数据暴露的真实案例。',
  'web/business-logic-vulnerabilities-checklist.md': '业务逻辑漏洞检查清单：按流程/状态/权限逐项核对。',
  'web/business-logic-vulnerabilities-methodology.md': '业务逻辑测试方法论：状态机、并发、权限与数据边界。',
}

const PLAYBOOKS = [
  ['playbooks/reverse.yaml', '逆向阶段建议：入库 / 风险面 / 结构 / 假设 / 报告'],
  ['playbooks/pentest.yaml', '渗透阶段建议：范围 / 侦察 / 面 / 测试 / 报告'],
  ['playbooks/triggers.yaml', '信号 → 假设 → 测试 → 参考的触发表'],
]

const ROUTES = [  ['未知样本 / 首次分诊', ['toolbox/decision-tree.md', 'native/sample-intake-playbook.md'], '先定类型与路线，再进领域'],
  ['需要选工具 / 装环境 / 网络不通', ['toolbox/tool-matrix.md', 'toolbox/tool-install.md', 'toolbox/network-egress.md'], '选型 → 安装 → 出站回退'],
  ['APK 指纹 / 框架识别', ['android/fingerprint.md'], 'Flutter/RN/加固先分流'],
  ['APK 反编译与改包', ['android/garlic.md', 'android/android-tools.md'], 'jadx/apktool/garlic 的选择'],
  ['Android 加固与脱壳', ['android/android-unpacking.md'], '识别加固 → dump DEX → 验证'],
  ['Frida 基础与模板', ['android/frida-hook-principles.md', 'android/frida-hook-templates.md'], '先读铁律与 Java Bridge 陷阱'],
  ['Frida 17.x 迁移', ['android/frida-17x-api.md', 'android/frida-17x-bridge.md'], 'Bridge 拆分后的用法'],
  ['SSL pinning / 移动流量', ['android/mobile-ssl-pinning-bypass.md', 'android/mitm-methodology.md'], '先选 MITM 方案再绕 pinning'],
  ['Flutter 抓包', ['android/flutter-ssl-bypass.md'], 'native 层 pinning'],
  ['iOS 测试', ['android/ios-pentesting-tricks.md', 'android/ios-tools.md'], 'runtime/keychain/URL scheme'],
  ['APK 隐藏代码 / 恶意 APK', ['android/android-apk-malware-detection.md', 'android/android-apk-malware-analysis.md'], '源码对比与权限/DEX 审计'],
  ['云控 ELF / 卡密', ['android/android-cloud-native-binary.md', 'android/frida-license-bypass-android.md'], '运行时下发与校验绕过'],
  ['PE/ELF 初判', ['native/native-principles.md', 'native/protection-detection-methodology.md'], '先判保护与风险面'],
  ['壳 / VMP / 脱壳', ['native/packer-handling.md', 'native/vmp-pe-fast-triage.md', 'native/vmp-elf-protection.md'], '先验证保护类型再选策略'],
  ['反调试 / anti-Frida', ['native/anti-debug-methodology.md', 'native/anti-frida-workarounds.md'], '检测点枚举后再绕过'],
  ['OLLVM / 代码混淆', ['native/code-obfuscation-deobfuscation.md'], '控制流/字符串/常量分层处理'],
  ['ARM64 逆向', ['native/arm64-reverse-methodology.md', 'native/arm64-string-xref-search.md'], '调用约定、xref 与字符串定位'],
  ['JVM / Minecraft mod', ['native/jvm-mod-deobf-workflow.md'], '常量加密、DES、oracle 重放'],
  ['加密算法识别', ['native/crypto-analysis-methodology.md', 'native/custom-xor-cipher-reversal.md'], '先分类再解密'],
  ['RSA / ECC / 格密码', ['native/rsa-attack-techniques.md', 'native/ecdlp-solving.md', 'native/lattice-crypto-attacks.md'], '按参数弱点选攻击'],
  ['PWN / 堆 / ROP', ['native/heap-exploitation.md', 'native/stack-overflow-and-rop.md'], '先判漏洞类型与缓解'],
  ['内核 / 驱动', ['native/kernel-driver-analysis.md', 'native/kernel-exploitation.md'], 'IOCTL、对象与缓解绕过'],
  ['Windows 驱动取密钥', ['native/windows-driver-crypto-extraction.md'], '驱动通信与密钥材料定位'],
  ['许可证 / 卡密绕过', ['native/license-bypass-workflow.md'], '静态定位 → 动态验证 → patch'],
  ['游戏安全', ['native/game-security-methodology.md'], '反作弊、渲染与内存对抗'],
  ['固件分析', ['native/firmware-analysis-methodology.md', 'native/firmware-eeprom-analysis.md'], '提取 → 识别 → 模拟/静态'],
  ['Web 测试入口', ['web/web-methodology.md', 'web/web-principles.md'], '范围、侦察、验证顺序'],
  ['JS 逆向 / API 签名', ['web/frontend-js-reverse.md', 'web/js-obfuscation-patterns.md'], '定位签名与加密入口'],
  ['API 黑盒', ['web/api-blackbox-testing.md', 'web/web-api-recon-patterns.md'], '文档、版本、隐藏参数'],
  ['JWT / OAuth / SSO', ['web/jwt-attack.md', 'web/oauth-sso-attack.md'], '算法混淆、kid、redirect_uri'],
  ['SQL 注入', ['web/sql-injection.md', 'web/sql-injection-sqlmap-advanced.md'], '手工判据 + sqlmap 加速'],
  ['XSS', ['web/xss.md', 'web/xss-advanced-xss-tricks.md'], '上下文、CSP、利用链'],
  ['SSRF', ['web/ssrf.md', 'web/ssrf-url-parser-tricks.md'], '解析器差异与内网目标'],
  ['文件上传 / 路径穿越', ['web/file-upload.md', 'web/path-traversal-lfi.md'], '解析、存储、执行三层'],
  ['请求走私 / 缓存', ['web/request-smuggling.md', 'web/web-cache-deception.md'], '前后端解析差异'],
  ['WAF 绕过', ['web/waf-bypass.md', 'web/waf-bypass-techniques.md'], '先识别产品再选语法'],
  ['业务逻辑 / 竞态', ['web/business-logic-vulnerabilities.md', 'web/race-condition.md'], '状态机与并发窗口'],
  ['智能合约 / DeFi', ['web/smart-contract-vulnerabilities.md', 'web/defi-attack-patterns.md'], 'Solidity 模式与链上攻击'],
  ['AD / Kerberos / NTLM', ['native/active-directory-kerberos-attacks.md', 'native/ntlm-relay-coercion.md'], '枚举 → 凭据 → 横向'],
  ['Linux 提权 / 横向', ['native/linux-privilege-escalation.md', 'native/linux-lateral-movement.md'], 'SUID/capabilities/内核'],
  ['容器 / K8s 逃逸', ['native/container-escape-techniques.md', 'native/kubernetes-pentesting.md'], '特权、挂载、RBAC'],
  ['LLM 提示注入', ['ai-security/llm-injection-playbook.md', 'ai-security/carrier-construction-guide.md'], '直接/间接注入与载体构造'],
  ['LLM 越狱', ['ai-security/llm-prompt-injection-jailbreak-patterns.md', 'ai-security/bypass-framework-matrix.md'], '按防线选框架'],
  ['模型安全评测', ['ai-security/model-security-analysis-guide.md', 'ai-security/payload-effectiveness-evaluation.md'], '拒答分类、效果真实性'],
  ['恶意样本分析', ['malware/malware-analysis-methodology.md'], '分平台 playbook 的入口'],
  ['内存取证', ['malware/memory-forensics-volatility.md'], 'Volatility 3 与内存 artifact'],
  ['PCAP / 协议逆向', ['malware/traffic-analysis-pcap.md', 'protocol/protocol-reverse-methodology.md'], '流量提取 → 协议字段'],
  ['隧道 / 反弹 shell', ['protocol/tunneling-and-pivoting.md', 'protocol/reverse-shell-techniques.md'], '出站与横向通道'],
  ['证据链 / 报告', ['evidence/workflow.md', 'evidence/reporting.md'], 'E-id、复现与报告结构'],
]

const NAV_PREFIXES = [
  'before going deep', 'also load', 'load trigger', 'consider loading', 'see also',
  'related routing', 'related documents', 'read ', '请先读取', '相关文档', '本文件是参考',
  '知识按需读', '来源提炼', '融合来源', '覆盖：', '目录', 'readme', 'note:', '注：', '注:',
]

function humanize(name) {
  return name
    .replace(/\.md$/, '')
    .split(/[-_]/)
    .map((part) => (part.length <= 3 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ')
}

function cleanInline(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isNav(text) {
  const lower = text.toLowerCase()
  return NAV_PREFIXES.some((prefix) => lower.startsWith(prefix)) || /[:：]$/.test(text)
}

/** First paragraphs that dive straight into one technique are poor index
 *  summaries (a random equation or payload tells the reader nothing about the
 *  document's scope). Prefer the H2 outline for those. */
function looksTechnical(text) {
  return /^(the |if |when |works when|two |find |indicators?:|e\(|cbc |dead code|python's |target |before |also |load )/i.test(text)
    || /[=⊕]|->|<-|```/.test(text)
    || (text.length < 40 && !/[适用于本覆盖方法流程分析检测判断提供描述总结指南参考工具案例目标审查识别定位绕过评估对比支持处理记录生成验证提取]/.test(text))
}

function truncate(text, max = 150) {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const stop = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('；'), cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
  return (stop > 50 ? cut.slice(0, stop + 1) : cut) + '…'
}

function summarize(text, titleLine) {
  const lines = text.split(/\r?\n/)
  let inCode = false
  for (let i = titleLine + 1; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.trim()
    if (line.startsWith('```')) { inCode = !inCode; continue }
    if (inCode || line === '' || line.startsWith('#') || line.startsWith('|') || line.startsWith('---')) continue
    if (line.startsWith('>')) {
      const quote = cleanInline(line.replace(/^>\s*/, ''))
      if (quote.length >= 18 && !isNav(quote) && !looksTechnical(quote) && !/^(来源|融合|相关|注)/.test(quote)) return truncate(quote)
      continue
    }
    if (line.startsWith('- ') || line.startsWith('* ') || /^\d+\.\s/.test(line)) continue
    const candidate = cleanInline(line)
    if (candidate.length >= 18 && !isNav(candidate) && !looksTechnical(candidate)) return truncate(candidate)
  }
  const headings = lines
    .filter((line) => /^##\s+/.test(line))
    .map((line) => cleanInline(line.replace(/^##\s+/, '')).replace(/^\d+[.、]\s*/, ''))
    .filter((heading) => heading !== '' && !/^(相关|related|目录|附录|when to load|advanced reference)/i.test(heading))
    .slice(0, 4)
  return headings.length > 0 ? `覆盖：${headings.join(' / ')}` : '（文档未提供摘要）'
}

function readDoc(root, path) {
  const text = readFileSync(join(root, path), 'utf8')
  const lines = text.split(/\r?\n/)
  let title = TITLE_OVERRIDES[path]
  let titleLine = -1
  if (title === undefined) {
    for (let i = 0; i < lines.length; i++) {
      const match = /^#\s+(.+?)\s*$/.exec(lines[i])
      if (match) { title = cleanInline(match[1]); titleLine = i; break }
    }
  } else {
    titleLine = lines.findIndex((line) => /^#\s+/.test(line))
    if (titleLine < 0) titleLine = 0
  }
  if (title === undefined) title = humanize(path.split('/').pop())
  let summary = SUMMARY_OVERRIDES[path] ?? summarize(text, titleLine)
  summary = summary.replace(/^Companion to main document\.\s*(Contains|Covers)\s*/i, '主文档扩展：')
  const source = /hack-skills/i.test(text.slice(0, 4000)) ? 'hack-skills'
    : /AboutSecurity/i.test(text.slice(0, 4000)) ? 'AboutSecurity' : ''
  return { path, title, summary, source }
}

function typeTag(path) {
  const name = path.split('/').pop().replace(/\.md$/, '')
  if (/template|submission|schema|result/.test(name)) return '模板'
  if (/case|casebook/.test(name)) return '案例'
  if (/checklist/.test(name)) return '清单'
  if (/methodology|principles|workflow/.test(name)) return '方法论'
  if (/matrix|cheatsheet|cookbook|patterns|scenarios|techniques|playbook|tricks|advanced|bypass|exploitation|attacks|variants|gadget/.test(name)) return '手册'
  return '参考'
}

function classify(domain, path) {
  const name = path.split('/').pop().replace(/\.md$/, '')
  for (const [id, title, pattern] of DOMAINS[domain].groups) {
    if (pattern.test(name)) return { id, title }
  }
  throw new Error(`unclassified reference: ${path}`)
}

function scan(root) {
  const docs = []
  const domains = {}
  for (const domain of DOMAIN_ORDER) {
    const dir = join(root, domain)
    const names = existsSync(dir)
      ? readdirSync(dir).filter((name) => name.endsWith('.md') && name !== 'index.md').sort()
      : []
    domains[domain] = names.map((name) => readDoc(root, `${domain}/${name}`))
    for (const doc of domains[domain]) {
      const group = classify(domain, doc.path)
      doc.group = group.id
      doc.groupTitle = group.title
      doc.type = typeTag(doc.path)
      docs.push(doc)
    }
  }
  return { docs, domains }
}

function link(from, to) {
  const rel = relative(dirname(from), to).split(sep).join('/')
  return rel.startsWith('.') ? rel : `./${rel}`
}

/** Markdown table cells cannot contain an unescaped pipe. */
function cell(text) {
  return String(text).replace(/\|/g, '\\|')
}

function renderDomainIndex(domain, docs) {
  const config = DOMAINS[domain]
  const path = `${domain}/index.md`
  const out = []
  out.push(`# ${config.title} 参考索引`)
  out.push('')
  out.push(`> 自动生成，勿手改。共 **${docs.length}** 篇；总索引：[../index.md](../index.md)。重新生成：\`node scripts/gen-references-index.mjs\`。`)
  out.push('')
  out.push(`**职责边界**：${config.scope}`)
  out.push('')
  const groups = config.groups.map(([id, title]) => ({
    id,
    title,
    docs: docs.filter((doc) => doc.group === id).sort((a, b) => a.title.localeCompare(b.title, 'zh')),
  }))
  const first = config.read.map((target) => {
    const doc = docs.find((candidate) => candidate.path === target)
    if (doc === undefined) throw new Error(`${domain} read target does not exist: ${target}`)
    return doc
  })
  if (first.length > 0) {
    out.push('**先读**：' + first.map((doc) => `[${doc.title}](${link(path, doc.path)})`).join(' · '))
    out.push('')
  }
  for (const group of groups) {
    if (group.docs.length === 0) continue
    out.push(`## ${group.title}（${group.docs.length}）`)
    out.push('')
    out.push('| 文档 | 讲什么 | 类型 |')
    out.push('|---|---|---|')
    for (const doc of group.docs) {
      out.push(`| [${cell(doc.title)}](${link(path, doc.path)}) | ${cell(doc.summary)} | ${cell(doc.type)}${doc.source !== '' ? ` / ${cell(doc.source)}` : ''} |`)
    }
    out.push('')
  }
  return { path, content: out.join('\n').replace(/\n+$/, '\n') }
}

function renderMaster(scanResult) {
  const { docs, domains } = scanResult
  const path = 'index.md'
  const out = []
  out.push('# helmd references 总索引')
  out.push('')
  out.push(`> 共 **${docs.length}** 篇正文（另有 ${DOMAIN_ORDER.length + 1} 个索引，共 ${docs.length + DOMAIN_ORDER.length + 1} 个 Markdown 文件），按 ${DOMAIN_ORDER.length} 个领域组织。自动生成，勿手改；重新生成：\`node scripts/gen-references-index.mjs\`，一致性检查：\`--check\`。`)
  out.push('')
  out.push('参考是素材，不是指令：读完自行判断是否适用。先定位 1–3 篇，不要全量加载。')
  out.push('')
  out.push('## 怎么用')
  out.push('')
  out.push('1. 有明确信号时，先调用 `route_task(hint)` 拿 PRIMARY 路由，再按「任务路由」读「先读」列；没有命中再进「领域总览」。')
  out.push('2. 进入领域后先读该领域的 `index.md`，再按子类挑 1–2 篇正文。')
  out.push('3. 结论要能回溯到具体文档 + 证据；索引只负责发现，不替模型下结论。')
  out.push('')
  out.push('## 阶段 playbook')
  out.push('')
  out.push('`route_task` 返回匹配的 playbook 路径，`case_status` 的 `[autonomy]` 段也会带上；它们只给阶段建议，不是门禁。')
  out.push('')
  for (const [path, description] of PLAYBOOKS) {
    if (!existsSync(join(defaultRoot, path))) throw new Error(`playbook does not exist: ${path}`)
    out.push(`- [${path}](${path}) — ${description}`)
  }
  out.push('')
  out.push('## 任务路由')
  out.push('')
  out.push('| 任务 / 信号 | 先读 | 说明 |')
  out.push('|---|---|---|')
  const byPath = new Map(docs.map((doc) => [doc.path, doc]))
  for (const [task, targets, note] of ROUTES) {
    const cells = targets.map((target) => {
      const doc = byPath.get(target)
      if (doc === undefined) throw new Error(`route target does not exist: ${target}`)
      return `[${cell(doc.title)}](${target})`
    })
    out.push(`| ${cell(task)} | ${cells.join(' · ')} | ${cell(note)} |`)
  }
  out.push('')
  out.push('## 领域总览')
  out.push('')
  out.push('| 领域 | 篇数 | 索引 | 覆盖 |')
  out.push('|---|---|---|---|')
  for (const domain of DOMAIN_ORDER) {
    const config = DOMAINS[domain]
    out.push(`| ${config.title} | ${domains[domain].length} | [${domain}/index.md](${domain}/index.md) | ${config.scope} |`)
  }
  out.push('')
  out.push('## 全量目录')
  out.push('')
  for (const domain of DOMAIN_ORDER) {
    const config = DOMAINS[domain]
    out.push(`### ${config.title}（${domains[domain].length}）`)
    out.push('')
    for (const [id, title] of config.groups) {
      const groupDocs = domains[domain].filter((doc) => doc.group === id).sort((a, b) => a.title.localeCompare(b.title, 'zh'))
      if (groupDocs.length === 0) continue
      out.push(`#### ${title}`)
      out.push('')
      for (const doc of groupDocs) {
        out.push(`- [${doc.title}](${doc.path}) — ${doc.summary} *(${doc.type}${doc.source !== '' ? ` / ${doc.source}` : ''})*`)
      }
      out.push('')
    }
  }
  out.push('## 维护')
  out.push('')
  out.push('- 新增/删除/重命名正文后运行生成器，索引与文件必须一一对应；`pnpm test:checks` 会校验。')
  out.push('- 摘要优先取正文首段；首段是导航时退回 H2 大纲。特殊文档在生成器 `SUMMARY_OVERRIDES` 中校正。')
  out.push('- 分类规则在 `DOMAINS[].groups`；未分类文件会让生成器直接失败，避免静默漏项。')
  return { path, content: out.join('\n').replace(/\n+$/, '\n') }
}

function build(root) {
  const result = scan(root)
  const outputs = [renderMaster(result)]
  for (const domain of DOMAIN_ORDER) outputs.push(renderDomainIndex(domain, result.domains[domain]))
  return { result, outputs }
}

function main() {
  const args = process.argv.slice(2)
  const check = args.includes('--check')
  const rootArg = args.find((arg) => !arg.startsWith('--'))
  const root = rootArg === undefined ? defaultRoot : rootArg
  const { outputs } = build(root)
  const drift = []
  for (const { path, content } of outputs) {
    const absolute = join(root, path)
    if (check) {
      if (!existsSync(absolute) || readFileSync(absolute, 'utf8') !== content) drift.push(path)
    } else {
      writeFileSync(absolute, content, 'utf8')
    }
  }
  if (check) {
    if (drift.length > 0) {
      console.error(`references index drift: ${drift.join(', ')}`)
      console.error('run: node scripts/gen-references-index.mjs')
      process.exit(1)
    }
    console.log(`references index: OK (${outputs.length} files)`)
  } else {
    console.log(`references index: wrote ${outputs.length} files`)
  }
}

export { build, defaultRoot }

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) main()
