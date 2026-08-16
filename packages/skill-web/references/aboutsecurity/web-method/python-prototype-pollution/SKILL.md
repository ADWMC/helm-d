---
name: python-prototype-pollution
description: "Python 原型链污染（属性注入/Class Pollution）检测与利用。当目标为 Python Web 应用（Flask/Sanic/Django/FastAPI）且存在递归合并(merge)、深度属性设置(pydash.set_)、JSON 配置更新接口时使用。覆盖污染入口识别、__globals__链构造、Flask SECRET_KEY/Jinja2定界符/searchpath污染、pydash路径过滤绕过、Sanic污染链、RCE/文件读取/权限提升利用"
metadata:
  tags: "prototype-pollution,python,pydash,merge,class-pollution,attribute-injection,flask,sanic,jinja2,rce,原型链污染,属性注入,deep,set_,__class__,__init__,proto,class pollution,深度设置,递归合并,globals,配置污染,cookie,octal,八进制,bypass,绕过,waf"
  category: "exploit"
---

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
