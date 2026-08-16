# 🤖 Agent 行为规则 — SQL 注入

## ⛔ NEVER
- NEVER 手动拼接 EXTRACTVALUE/UPDATEXML 输出超过 32 字符 — 必须用 Python 脚本自动化
- NEVER 在未验证 LENGTH() 的情况下提交 flag
- NEVER 放弃 UNION SELECT 前不尝试全部 6 种变体（NULL/1/字符串/混合/注释/括号）
- 遇到过滤/绕过场景先读 references 文件中的绕过清单，标记为必读的部分不可跳过

## ✅ ALWAYS
- ALWAYS 先用 ORDER BY 确定列数，再构造 UNION
- ALWAYS 在 flag 提交前执行 LENGTH() + 格式检查（`flag{...}` 64-70 hex 字符）
- 遇到输出截断时立即切换到 Python 脚本（读取 references 获取脚本模板）
- ALWAYS 3 次相同失败后换策略（UNION→Error→Boolean→Time）

## 🔧 工具偏好
1. `http_request` — 注入测试首选（可控 header/body/method）
2. `python3` — 自动化提取（EXTRACTVALUE 截断场景）
3. 读取 references 文件 — 每个 Phase 开始前读取对应 references
