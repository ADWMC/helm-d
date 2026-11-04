# 网络协议与流量 参考索引

> 自动生成，勿手改。共 **14** 篇；总索引：[../index.md](../index.md)。重新生成：`node scripts/gen-references-index.mjs`。

**职责边界**：PCAP/协议逆向、协议攻击、隧道与反弹 shell、供应链与源码暴露。应用层 Web 漏洞归 web 域。

**先读**：[协议逆向方法论](./protocol-reverse-methodology.md) · [流量分析与 PCAP 取证](./traffic-analysis-pcap.md) · [隧道与横向移动](./tunneling-and-pivoting.md) · [网络协议攻击](./network-protocol-attacks.md)

## 抓包与协议逆向（2）

| 文档 | 讲什么 | 类型 |
|---|---|---|
| [流量分析与 PCAP 取证](./traffic-analysis-pcap.md) | 覆盖 PCAP 修复、Wireshark 过滤、协议分析、数据提取、隐蔽信道检测、tshark 命令行 | 参考 / hack-skills |
| [协议逆向方法论](./protocol-reverse-methodology.md) | 覆盖：一、信息收集 / 二、字段识别 / 三、状态机推断 / 四、加密/编码检测 | 方法论 |

## 协议攻击与服务暴露（7）

| 文档 | 讲什么 | 类型 |
|---|---|---|
| [网络协议攻击](./network-protocol-attacks.md) | 二层/三层协议攻击：ARP、LLMNR/NBT-NS、DHCPv6、WPAD。 | 手册 |
| [DNS Rebinding](./dns-rebinding.md) | 通过 DNS 操纵绕过同源策略的客户端侧攻击 | 参考 / hack-skills |
| [HTTP/2 协议层攻击面](./http2-attacks.md) | 覆盖 h2c 走私、伪头注入、HPACK 攻击、多路复用竞态、H2→H1 降级缺陷 | 手册 / hack-skills |
| [NAME RESOLUTION POISONING — Responder & mitm6 Deep Dive](./network-protocol-attacks-name-resolution-poisoning.md) | Supplementary reference for network-protocol-attacks §2–§4.… | 手册 |
| [PORT / SERVICE EXPLOITATION MATRIX](./unauthorized-access-common-services-port-service-matrix.md) | Supplementary reference for unauthorized-access-common-services. Organized by port for rapid triage during service enumeration. | 手册 |
| [Unauthorized Access to Common Services — Expert Attack Playbook](./unauthorized-access-common-services.md) | 常见服务未授权访问：端口矩阵、协议指纹与利用路径。 | 参考 |
| [WebSocket Security](./websocket-security.md) | Routing note: in Burp/browser DevTools, filter for 101 and Upgrade: websocket; for deeper API testing, align authn/authz models through api-sec. | 参考 |

## 隧道、代理与反弹（3）

| 文档 | 讲什么 | 类型 |
|---|---|---|
| [反弹 Shell 技术](./reverse-shell-techniques.md) | 覆盖：REVERSE vs BIND SHELL DECISION / ENCRYPTED SHELLS / WEB SHELLS / PTY UPGRADE SEQUENCE | 手册 |
| [隧道与横向移动](./tunneling-and-pivoting.md) | 隧道与横向：端口转发、SOCKS、代理链与出站规避。 | 参考 |
| [REVERSE SHELL CHEATSHEET](./reverse-shell-techniques-shell-cheatsheet.md) | Supplementary reference for reverse-shell-techniques. Replace ATTACKER with your IP and PORT with your listener port. | 手册 |

## 供应链与源码暴露（2）

| 文档 | 讲什么 | 类型 |
|---|---|---|
| [Dependency Confusion — Supply Chain Attack Playbook](./dependency-confusion.md) | 依赖混淆：私有/公共包索引与版本范围导致的供应链投毒。 | 参考 |
| [Insecure Source Code Management](./insecure-source-code-management.md) | Routing note: quickly probe these paths first; for full recon workflow, load methodology from recon-for-sec and recon-and-methodology before deeper te… | 参考 |
