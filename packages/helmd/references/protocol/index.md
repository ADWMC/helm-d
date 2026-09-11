# skill-protocol references index

知识按需读，模型自主判断，不作为硬性规则。共 15 个文件。

**职责边界**：仅网络协议层——PCAP / 协议逆向 / 隧道 / HTTP2 / DNS。应用层 Web 漏洞归 `skill-web`，移动端流量拦截归 `skill-android`。

- dns-rebinding.md
- http2-attacks.md
- network-protocol-attacks.md
- protocol-reverse-methodology.md
- traffic-analysis-pcap.md
- tunneling-and-pivoting.md

## hack-skills 融合（hs-*，源自 [yaklang/hack-skills](https://github.com/yaklang/hack-skills)）

- dependency-confusion.md [Infrastructure & Network] — Supply-chain testing via package-manager dependency confusion: when internal package names resolve to attacker-controlled public registries, leading t
- insecure-source-code-management.md [Infrastructure & Network] — Source control and artifact exposure (.git, .svn, .hg, backups, .env). Use when recon finds VCS paths, 403 on hidden dirs, or backup/config leaks duri
- network-protocol-attacks.md [Infrastructure & Network] — Network protocol attack playbook. Use when exploiting layer 2/3 protocols including ARP spoofing, LLMNR/NBT-NS/mDNS poisoning, WPAD abuse, DHCPv6 atta
- reverse-shell-techniques.md [Infrastructure & Network] — Reverse shell techniques playbook. Use when establishing remote shells including language one-liners, encrypted shells (OpenSSL/socat/ncat), web shell
- tunneling-and-pivoting.md [Infrastructure & Network] — Tunneling and pivoting playbook. Use when establishing network tunnels through compromised hosts including SSH tunneling, Chisel, Ligolo-ng, socat, DN
- unauthorized-access-common-services.md [Infrastructure & Network] — Unauthorized access playbook for common exposed services. Use when Redis, Rsync, PHP-FPM, AJP/Ghostcat, Hadoop YARN, H2 Console, or similar management
- websocket-security.md [Infrastructure & Network] — WebSocket handshake, CSWSH, tooling (wsrepl, ws-harness, Burp), and common flaws. Use when apps use real-time channels, chat, notifications, or WS-bac
