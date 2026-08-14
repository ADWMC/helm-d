# 流量分析与 PCAP 取证

> 来源提炼: yaklang/hack-skills (traffic-analysis-pcap)
> 覆盖 PCAP 修复、Wireshark 过滤、协议分析、数据提取、隐蔽信道检测、tshark 命令行

## PCAP 修复与转换

```bash
pcapfix corrupted.pcap -o fixed.pcap          # 修复
editcap -F pcap capture.pcapng capture.pcap    # pcapng→pcap
mergecap -w merged.pcap f1.pcap f2.pcap        # 合并
# magic: d4c3b2a1=pcap(LE) a1b2c3d4=pcap(BE) 0a0d0d0a=pcapng
```

## Wireshark 常用过滤

```text
ip.addr == 10.0.0.1 ; ip.src == 10.0.0.1 ; ip.dst == 10.0.0.1
http ; dns ; tcp ; ftp ; smtp ; tls ; icmp ; arp
tcp.stream eq 5 ; tcp.port == 80
tcp.flags.syn == 1 && tcp.flags.ack == 0
http.request.method == "POST" ; http.response.code >= 400
http.request.uri contains "login"
dns.qry.name contains "evil.com" ; dns.qry.type == 16
tls.handshake.type == 1 ; tls.handshake.extensions.server_name
frame contains "password" ; frame contains "flag{"
```

## 协议分析要点

- HTTP: Follow TCP Stream、File→Export Objects→HTTP、`http.authbasic` 抓 base64 凭据。
- HTTPS 解密: `SSLKEYLOGFILE` 环境变量导出浏览器预主密钥；Wireshark TLS 偏好加载；或 RSA 私钥(仅 RSA 密钥交换)。
- DNS 隧道检测: 子域名>30 字符、TXT 记录高量、固定域名一致查询、Base32/64 子域、单主机高频。
- FTP: 明文 USER/PASS，数据通道独立端口，Follow 数据流重建文件。
- SMTP: Follow 流取 MAIL FROM/RCPT TO/DATA，MIME base64 解附件。
- USB HID: `usb.transfer_type == 0x01`，8 字节 capdata 解码击键(byte[0]=修饰键, byte[2]=键码)。
- WiFi: `airodump-ng` 抓 WPA handshake，`hcxpcapngtool` 转 hash，`hashcat -m 22000`。
- ICMP exfil: `icmp && data.len > 48`、`icmp.type == 8`。

## 数据提取

```bash
# 文件雕刻
binwalk -e exported_stream.bin
foremost -i exported_stream.bin -o carved/
# 凭据: ftp || telnet || http.authbasic || smtp || pop || imap
# NTLM: ntlmssp.auth.username → user::domain:challenge:NTProofStr:blob → hashcat -m 5600
```

隐蔽信道指标: DNS 长子域、ICMP 大载荷、HTTP 编码头、固定 beacon 间隔(C2)。统计: `tshark -q -z io,stat,1`、`-z conv,tcp`。

## tshark 命令行

```bash
tshark -r cap.pcap -Y "http.request" -T fields -e http.host -e http.request.uri
tshark -r cap.pcap -Y "dns.flags.response==0" -T fields -e dns.qry.name | sort -u
tshark -r cap.pcap -Y "http.request.method==POST" -T fields -e http.file_data
tshark -r cap.pcap -q -z io,phs          # 协议层级
tshark -r cap.pcap -q -z conv,tcp        # 会话
tshark -r cap.pcap -q -z endpoints,ip    # 端点
tshark -r cap.pcap -q -z follow,tcp,ascii,0
tshark -r cap.pcap --export-objects http,/tmp/exported/
```

## 决策树

```
PCAP 打不开 → xxd|head 查 magic → pcapfix / editcap
概览 → io,phs + conv,tcp + endpoints,ip
HTTP → Export Objects + POST/password 过滤 + Follow stream
HTTPS → SSLKEYLOGFILE / RSA key
DNS → 长子域/高 TXT → 隧道/exfil
FTP/Telnet/SMTP → 明文凭据 + 文件/邮件重建
USB → HID 击键解码
WiFi → WPA handshake 破解 / deauth 检测
ICMP → 大载荷 → exfil/隧道
异常 → beacon 间隔(C2) / 异常端口(隐蔽信道)
```