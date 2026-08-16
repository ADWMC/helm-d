---
name: recon-full
description: "主动式全流程资产侦察。当需要对目标进行从零到漏洞发现的完整侦察、渗透测试的第一阶段、或需要全面了解目标攻击面时使用。覆盖子域名枚举→端口扫描→存活检测→指纹识别→POC 扫描的完整链条"
metadata:
  tags: "recon,subdomain,port,fingerprint,poc,扫描,侦察,资产发现,攻击面,渗透测试,nmap"
  category: "recon"
  mitre_attack: "T1595,T1592,T1590,T1589"
---

# 主动式全流程侦察方法论

本技能是渗透测试的标准第一步，目标是从域名/IP 出发，尽可能多地发现资产和漏洞。

## 深入参考

- Web 目录、历史端点、隐藏参数、Next.js/SPA 路由发现 → [references/web-discovery-methods.md](references/web-discovery-methods.md)

## Phase 0: 范围确认

确认测试目标的范围，和任务描述，尽量不要超出目标范围
- 如果任务强调不测试子域名，则跳过 Phase 1: 子域名枚举步骤
- 如果任务强调不测试其他端口，则跳过 Phase 2: 端口扫描步骤

## Phase 1: 子域名枚举
用 dns 枚举工具获取更多子域名。这步很关键——子域名往往是被遗忘的攻击面（测试环境、旧版本、内部系统）。

推荐使用工具
- ksubdomain

**分析要点**：
- 子域名命名模式：`dev.`, `test.`, `staging.`, `api.`, `admin.` 通常是高价值目标
- CDN 分布：被 CDN 保护的域名可能需要找源站 IP
- 通配符记录：`*.example.com` 存在时，需要用字典枚举而非纯 DNS 解析

## Phase 2: 端口扫描
对发现的 IP/域名用端口扫描工具扫描端口。

推荐使用工具
- naabu

**高价值端口**：
- Web：80, 443, 8080, 8443, 8888
- 数据库：3306(MySQL), 5432(PostgreSQL), 6379(Redis), 27017(MongoDB)
- 远程管理：22(SSH), 3389(RDP), 5900(VNC)
- 中间件：8009(AJP/Tomcat), 9200(Elasticsearch), 2375(Docker API)

**建议**
- 如果扫描判断目标没有开放任何端口，建议用全端口扫描 (1-65535)
- 除非实在没有工具可用，不然不建议使用 nmap , 速度太慢，效果太差

## Phase 3: 存活检测
用 urlive 探活工具检测 HTTP/HTTPS 服务存活状态。

推荐使用工具
- httpx

**分析要点**：
- HTTP 到 HTTPS 的重定向链
- 不同端口返回不同应用（同 IP 多站点）
- 状态码 403/401 的端点 → 可能是需要认证的管理后台
- 302 跳转到登录页 → 说明有受保护的内容

## Phase 4: 指纹识别
用指纹识别工具识别技术栈，这直接决定后续的漏洞利用方向。

推荐使用工具
- nuclei

**技术栈 → 攻击策略映射**：
| 技术栈 | 优先检查 |
|--------|----------|
| PHP | LFI/文件上传/反序列化 |
| Java/Spring | 反序列化/JNDI/Actuator |
| Python/Django/Flask | SSTI/Pickle |
| Node.js/Express | 原型链污染/SSRF |
| WordPress/Joomla | CMS 专用 POC |
| Nginx/Apache | 解析漏洞/配置错误 |

## Phase 5: POC 扫描
用漏洞扫描工具进行已知漏洞扫描。根据指纹结果关注特定类别漏洞。

推荐使用工具
- nuclei

常见漏洞类型
- 框架漏洞（Spring4Shell, Struts2, Log4j）
- CMS 漏洞（WordPress plugin, Joomla, Drupal）
- 中间件漏洞（Tomcat Manager, WebLogic, JBoss）

## 输出要求
每个阶段结束后简要总结发现，最终按攻击优先级排序：
1. 可直接利用的高危漏洞
2. 暴露的管理后台和敏感接口
3. 可进一步探测的攻击面
