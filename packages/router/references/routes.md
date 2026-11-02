# 路由参考

本文件是参考，读完自行判断，不强制执行。

## 触发信号 -> 领域

| 信号 | 领域 bundle |
|---|---|
| APK / AAB / DEX / smali | @helm-d/skill-android |
| JS / fetch / XHR / WebSocket / sign | @helm-d/skill-web |
| PE / ELF / Mach-O / shellcode | @helm-d/skill-native |
| PCAP / TCP / UDP / gRPC / Protobuf | @helm-d/skill-protocol |
| C2 / persistence / IOC / sample | @helm-d/skill-malware |
| prompt / model / injection | @helm-d/skill-ai-security |

## 证据契约

每个结论都应有：证据、路由、复现步骤、局限、下一步。缺证据时说明缺什么，不假装分析。
