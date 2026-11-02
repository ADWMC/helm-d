# DNS Rebinding

> 来源提炼: yaklang/hack-skills (dns-rebinding-attacks)
> 通过 DNS 操纵绕过同源策略的客户端侧攻击

## 核心原理

浏览器同源策略绑定 `protocol + host + port`，host 在连接时经 DNS 解析。攻击者控制 `attacker.com` 的 DNS:

1. 第一次解析 → 攻击者 IP(投放恶意 JS)
2. 第二次解析 → 内网 IP
3. 浏览器认为同源(`attacker.com`)
4. JS 读取内网服务响应

关键: SOP 检查的是主机名字符串，不是解析后的 IP。

## TTL 与浏览器 DNS 缓存

| 浏览器 | 内部缓存 | 绕过 |
|--------|---------|------|
| Chrome | 约 60s 最小值 | 等 60s / 多子域 |
| Firefox | 约 60s | 可调 network.dnsCacheExpiration |
| Safari | 较短 | 同左 |
| Edge | 同 Chrome | 同 Chrome |

绕过策略: 多 A 记录(同时返回攻击者+目标 IP，攻击者 IP 被防火墙阻断后回退内网 IP)、子域泛洪(每个子域新解析)、service worker 延迟。

## 攻击变体

- 经典 HTTP rebinding: 等缓存过期后 fetch 内网服务，`navigator.sendBeacon` 外传。
- WebSocket rebinding: WS 连接跨 rebinding 持久。
- TOCTOU: 服务端校验 DNS 时通过，连接复用/重定向时 rebinding 到内网 IP(与 SSRF 混合)。
- 多 A 记录(最快): 攻击者 IP 首次加载 JS 后阻断，回退内网 IP。

## 高价值目标

| 目标 | 端口 | 原因 |
|------|------|------|
| 云元数据 | 169.254.169.254:80 | 实例凭据/token |
| Docker API | 172.17.0.1:2375 | 容器创建/挂载→RCE |
| K8s API | 10.96.0.1:443/6443 | Pod 创建/secret |
| 内网面板 | 各端口 | 路由/NAS/打印机/SCADA |
| Elasticsearch | :9200 | 数据外传 |
| Redis | :6379 | 数据读/配置 RCE |
| Consul/etcd | :8500/2379 | 服务发现/密钥 |

云元数据 IMDSv2 防御要求 `X-aws-ec2-metadata-token` 头，rebinding 在 no-cors 下难设置自定义头。

## 工具

| 工具 | 用途 |
|------|------|
| Singularity | 完整 DNS rebinding 框架 (nccgroup) |
| rbndr.us | 零配置 rebind DNS 服务 |
| whonow | 动态 DNS rebinding 服务器 |
| dnsrebinder | 最小 Python DNS 服务器 |

rbndr.us 格式: `<hex-ip1>.<hex-ip2>.rbndr.us`，如 `7f000001.c0a80101.rbndr.us`。

## DNS Rebinding vs SSRF

| 维度 | DNS Rebinding | SSRF |
|------|--------------|------|
| 执行上下文 | 客户端(浏览器) | 服务端 |
| 绕过 | 同源策略 | 网络访问控制 |
| 攻击者控制 | DNS 解析 | 服务端发送的 URL/请求 |
| 凭据 | 浏览器自动带 cookie | 无用户凭据 |
| 协议 | HTTP/WS(浏览器限制) | 任意(gopher/file 等) |

## 防御与绕过

- DNS pinning → 多 A 记录/子域/等缓存过期/CNAME 链。
- Host 头校验 → 内网服务常不检查 Host、IP vhost 不检查、通配符 vhost。
- Private Network Access(PNA) → 仅 Chrome 部分执行、WS 不触发 preflight、HTTPS→HTTP 降级。
- 内网服务鉴权、网络分段为根本缓解。