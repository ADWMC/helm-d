# 🤖 Agent 行为规则 — SSTI

## ⛔ NEVER
- NEVER 在未确认模板引擎类型前尝试 RCE payload
- NEVER 对 Django 模板尝试 RCE — Django 只能读上下文变量
- NEVER 跳过简单变量测试 `{{flag}}` `{{config}}` `{{secret}}` 就直接尝试复杂链
- NEVER 在确认引擎后不读 references 就开始利用

## ✅ ALWAYS
- ALWAYS 先用探测 payload 确认引擎类型（`{{7*7}}` `${7*7}` `<%= 7*7 %>` `{7*7}`）
- ALWAYS 确认 Jinja2 后立即读 references/jinja2-exploitation.md
- ALWAYS 确认其他引擎后立即读 references/other-engines-and-bypass.md
- ALWAYS 先尝试简单上下文变量（`{{flag}}` `{{app.config}}`）再尝试 RCE 链

## 🔧 工具偏好
1. `http_request` — 模板注入测试（精确控制输入点）
2. 读取 references 文件 — 确认引擎后立即读取对应 references
3. `python3` — 复杂 payload 编码/构造
