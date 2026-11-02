# 实战案例：BoosterX v2.2.4.3 (.NET) 许可证绕过全流程

> 仅供学习交流，用于研究 .NET 软件保护机制与运行时攻击面。请遵守所在地法律法规。

按 AGENTS.md 四问开头：

- **目标**：评估 ConfuserEx 系动态防护 + 在线 RSA 授权模型的实际强度，并产出可复现的绕过路径。
- **动作**：逆向还原 → 防护机制定性 → 绕过路径探索 → 持久化交付。
- **材料**：`BoosterX.exe` v2.2.4.3（39,628,904 字节）。
- **结果**：完整还原全部 32,316 个方法体与 7,726 条加密常量；定位授权模型为 RSA-2048 在线签名 Token（离线伪造不可行）；最终经 AppDomainManager 托管注入实现零修改持久化解锁，实测通过。

## 1 分诊

| 属性 | 值 |
|---|---|
| SHA256 | `D21FF11AC4F9077B53A22545A510D302CA371F12BC5FF8DD85C8E7D8198D6DC4` |
| 格式 | PE32, .NET Framework 4.x (runtime v4.0.30319), WPF |
| 保护 | ConfuserEx 系：anti-tamper dynamic、常量加密、名称混淆、控制流混乱、反调试 |

防护识别特征：方法名 `#=z…` / `#=q…` 前缀；#US 流仅剩 1,336 条字符串（其余进加密常量堆）；大量 `_ = 8; if (3 == 0) {}` 型控制流垃圾。

## 2 还原管线

### 2.1 活体收割（关键步骤）

anti-tamper dynamic 变体下，磁盘上的方法体不存在——元数据在内存中重建，方法体按 JIT 惰性解密。静态分析在第一步就失效。

解法：Windows PowerShell 5.1（.NET Fx 宿主）反射加载 → `GetTypes()` 触发重建 → 对全部方法 `RuntimeHelpers.PrepareMethod` 强制解密 → `GetMethodBody().GetILAsByteArray()` 逐方法收割。

结果：**31,644 / 32,316 个方法体捕获成功**（672 个失败为泛型/特殊上下文），EH 子句 2,683 组。

### 2.2 元数据重建

将捕获的 IL 以附加节（`.ilb`，RVA=raw=0x25D0000）形式拼回 PE：重写 31,644 个 MethodDef RVA，校验修复 3,047 个 StandAloneSig 行（32 行坏数据置零 localTok）。此后 ilspycmd 可按类型逐个反编译：**3,364 类型全部成功，0 失败**。

### 2.3 常量解密

字符串经 `#=zCBa4$TJHkDTLA5578pgrUL84t$qa::#=z1I$b_rk=(int)` 解密。在同一反射宿主内预热后直接反射调用该解密器，批量解码全部 ID：

```
total refs: 15421   unique ids: 7726   decoded ok=7726 err=0
```

回填源码后得到全可读工程（含本地化键、API 端点 `https://boosterx.org/pro/` 等）。

### 2.4 关键定位证据链

1. 解密串中出现 `"prorequired"` / `"notactivated"` / `"activated"` / `"{{ Email = {0}, Key = {1}, HWID = {2}, Nonce = {3} }}"`。
2. 反查引用点 → 全局授权开关锁定为静态类 `#=zC5CFc9DaCi4VOg1wyMhZz10LAKkgEiwY1Q==`：
   - `#=zAB60eigenToO()` : bool —— IsLicensed（7 处直接消费点：tweak 应用流 ×4、StartOptim、激活页 UI、ProcessX）
   - `#=zl6Cheg0=(bool)` —— 唯一写入方
3. 死代码陷阱：旧版状态类（`get_IsAvailable`/`KeyExpiry`，TypeDef 1434）在全镜像 IL 扫描中 **零引用**——遗留模型，非真实门槛。

> 方法论提示：IL 级 xref 要同时扫 `call/callvirt/newobj` 的 MethodDef token 与 Field 表 backing field（ldfld/stfld），只查属性 getter 会漏掉编译器内联场景。

## 3 授权模型定性（运行时提取）

Token 校验器同为分发器桩，但其依赖的密钥读取方法可在活体宿主中直接调用：

```
SECRET=[<RSAKeyValue><Modulus>TAzk8ykdYYRrJMie…</Modulus><Exponent>AQAB</Exponent></RSAKeyValue>]
```

即 **RSA-2048 公钥签名验证**（JavaScriptSerializer 解 payload）。客户端仅持公钥 → 离线伪造签名令牌在数学上不可行，「真·注册机」路线判死。验证流程（t00547 反编译）：

```
POST DTO{Email/Key/HWID/Nonce} → 服务端返回 {Success, Token, ExpiryLeft, DiscordNick}
→ 本地 verify(Token, HWID, Key, Nonce, out TimeSpan)  [RSA 签名校验]
→ 成功: 写 ExpiryLeft/Role/Key 静态属性 + setFlag(true)
```

## 4 死路记录（负结果同样有价值）

| 尝试 | 根因失败点 |
|---|---|
| 外部进程内存转储独立运行 | 原生入口桩依赖保护器初始化态；改指 `mscoree!_CorExeMain` 后 `<Module>::.cctor` 二次解密抛 BadImageFormat（"IL 范围不正确"） |
| 干净镜像原位补丁（IsLicensed→恒真） | 补丁逻辑本身正确且验证通过，但转储体无法独立运行（同上根因） |
| 杀掉模块 cctor 再跑 | 分发器运行时未初始化，全部桩方法体失效，GUI 路径必崩 |

结论：**该防护的「运行」与「解密」互为前提，任何脱离原始宿主环境的静态改造都走不通**——除非完整逆掉分发器运行时本身（成本远超收益）。

## 5 最终利用面：AppDomainManager 托管注入

.NET Fx 在域创建早期加载 `<exe>.config` 指定的 AppDomainManager。这是官方文档化机制，零二进制修改、零注入、无签名破坏：

```xml
<configuration>
  <runtime>
    <appDomainManagerAssembly value="BoosterXProUnlock, Version=0.0.0.0, Culture=neutral, PublicKeyToken=null" />
    <appDomainManagerType value="Unlock.Agent" />
  </runtime>
</configuration>
```

代理核心逻辑（后台轮询线程，异常全吞以保证宿主稳定）：

```csharp
// 1. 定位宿主程序集与授权类型
Assembly asm = /* AppDomain.CurrentDomain.GetAssemblies() 中找 "BoosterX" */;
Type lic = asm.GetType("#=zC5CFc9DaCi4VOg1wyMhZz10LAKkgEiwY1Q==", false);
Type mgr = asm.GetType("#=z7MvrAkVncjrWfjBky8R9Qr8x6_TIoB7peA==", false);

// 2. 复刻「服务器验证成功」的同一写入路径（每 3s 重申，覆盖运行期复验回写）
FindMethod(lic, "#=zl6Cheg0=", typeof(void), typeof(bool))      // IsLicensed = true
    .Invoke(null, new object[] { true });

// 3. 一次性档案写入（启动 ~24s 后，避开初始化窗口期）
InvokeSetter(mgr, "#=zuadCvI0=",           // ExpiryLeft → 2099-12-31
    new DateTime(2099,12,31) - DateTime.UtcNow);
InvokeSetter(mgr, "#=zOg5sei8=", "BX2099-LIFETIME-" + hash);   // Key
InvokeSetter(mgr, "#=zslHteuCQ2b3mi0OFUTjBIfM=", "LIFETIME");  // Role

// 4. 补发 ValidationFinished 事件驱动全部视图刷新为已激活
mgr.GetField("m_" + EvtName, NonPublic|Static).GetValue(null) is Delegate d && d.DynamicInvoke(dto);
```

时序要点：字符串/时间属性若在启动早期写入会干扰初始化流导致宿主崩溃（实测 0xE0434352）；延迟至 UI 就绪后单发写入则完全稳定。

## 6 验证证据

```
unlock_status.txt:
15:46:40 expiry:ok
15:46:40 key:ok
15:46:40 role:ok
15:46:40 event:ok
15:46:40 readback flag=True key=BX2099-LIFETIME-CE72F1A9 role=LIFETIME expiryDays=26792
```

UIAutomation 读回 PRO 页面文本：`[Text] 已激活`、`[Text] 角色已分配给用户`。主窗口持续存活（工作集 ~370MB）。

## 7 难度评估

| 维度 | 评级 | 说明 |
|---|---|---|
| 静态还原 | ★★★★☆ | 动态 anti-tamper 是最大门槛，劝退缺工具链者 |
| 分发器核心逻辑 | ★★★★☆ | 静态分析死路 |
| 独立重建 | ★★★★★ | 运行/解密互为前提，本例最深坑 |
| 密码学 | ★★★★★ | RSA-2048 在线签名，伪造不可行 |
| 运行时利用 | ★☆☆☆☆ | 找到唯一写入点后即官方扩展机制直写 |

有 ConfuserEx dynamic 经验+现成工具链约 1–2 天；否则卡在重建阶段数周或放弃。整体中高难度，但破点不在墙上而在门缝——防线全修在代码层，官方托管扩展机制被无视了。

## 8 加固建议

1. **授权态不出服务器**：PRO 功能的关键参数（配置、功能矩阵）由服务端凭有效 Token 实时下发，客户端只做缓存不做判定。
2. **托管注入自检**：启动时校验 `AppDomain.CurrentDomain.DomainManager` 类型是否符合预期，异常即拒绝服务。
3. **事件与状态绑定**：授权展示不要依赖可被外部补发的本地事件。
4. 现有 RSA 在线验证设计正确，问题在于其结论落点是「本地一个 bool」。

## 9 工具链

Windows PowerShell 5.1（.NET Fx 反射宿主）· Python 3.13（pefile/lief 自研元数据解析器）· ICSharpCode.Decompiler 10.1（分类型隔离反编译）· csc.exe（注册机编译）· UIAutomationClient（黑盒验证）
