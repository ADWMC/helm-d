# 🤖 Agent 行为规则 — LFI/RFI

## ⛔ NEVER
- NEVER 确认 LFI 后不读 references 就尝试 RCE — 必须先读完整利用链
- NEVER 只测 `/etc/passwd` 就放弃 — 必须尝试多种路径穿越深度（`../` 1-10 层）
- NEVER 忽略 PHP Wrapper — `php://filter` 读源码是 LFI 最重要的利用之一
- NEVER 在同一个端点上连续测试超过 5 个参数都无响应差异时还继续 — 立即换端点
- NEVER 跳过页面发现就直接测 LFI — 先找全所有端点再测漏洞
- NEVER 只在首页已知的链接中找 LFI — 隐藏页面（如 private.php, admin.php）才是常见入口
- NEVER 逐个手动测试参数名（超过 3 轮还在枚举参数 = 严重违规！）— 用 Python 批量 Fuzz
- NEVER 用目录字典做参数名 Fuzz — 参数 Fuzz 只用 `Web/CTF/Fuzz_param.txt`
- NEVER 忽略 Dockerfile 中的 WORKDIR + 文件名信息 — 直接拼接为第一优先路径

## ✅ ALWAYS
- ALWAYS 第一步：枚举全部页面（ffuf 扫描；ffuf 不可用时用 Python 测试 Top-50 常见文件名）
- ALWAYS 测 LFI 前先确认目标端点有动态参数（对比有参数/无参数的响应差异）
- ALWAYS 响应长度差异 < 10 字节 = 该参数无效，立即换参数或换端点
- ALWAYS 确认 LFI 后立即读 references/lfi-to-rce.md 获取完整利用路径
- ALWAYS 尝试 `php://filter/convert.base64-encode/resource=` 读取源码
- ALWAYS ffuf 失败时立即降级：用 python3 requests 批量测试常见文件名
- ALWAYS 参数发现用 Python 一次批量测试（file/page/path/include/doc/...全部一轮搞定）
- ALWAYS 已获取 Dockerfile 时：提取 WORKDIR + 文件名 → 拼接绝对路径作为首选

## 🔧 工具偏好
1. `ffuf` / `spray` — 页面发现首选（LFI 测试的前提）
2. `python3` — 参数批量 Fuzz 首选（一次测完所有参数×所有页面）
3. `curl` (via Bash) — LFI 测试和日志投毒首选（比 http_request 更灵活，支持管道/重定向）
4. 读取 references 文件 — 确认 LFI 后立即读取 references
5. `ffuf` + `Web/CTF/Fuzz_param.txt` — 参数 Fuzz 备选（注意用参数字典不是目录字典）

## 📋 日志投毒 Checklist
确认 LFI 后走日志投毒路线时，严格按以下顺序执行：
1. ✅ 用 LFI 读日志文件（逐个试 nginx/apache 路径）→ 确认可读
2. ✅ 用 curl 注入 webshell payload 到 User-Agent（`\$_GET` 转义！）
3. ✅ 立即验证：LFI 包含日志 + `&cmd=id` → 确认输出 `uid=`
4. ✅ 成功 → 搜 flag + 写持久 webshell；失败 → 检查排查表（见 lfi-to-rce.md）
