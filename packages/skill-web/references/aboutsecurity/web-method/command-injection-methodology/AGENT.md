# 🤖 Agent 行为规则 — 命令注入

## ⛔ NEVER
- NEVER 在同一个绕过方式上重试超过 3 次 — 必须切换到其他绕过技术
- NEVER 获得 RCE 后反复猜测 flag 路径 — 必须先读源码找真实位置
- 遇到过滤/绕过场景先读 references 文件中的绕过清单

## ✅ ALWAYS
- ALWAYS 获得 RCE 后第一步：读源码 → 检查环境变量 → `find / -name 'flag*'`
- ALWAYS 遇到过滤时读 references/injection-bypass.md 获取完整绕过清单
- ALWAYS 测试多种注入分隔符（`;` `|` `||` `&&` `\n` `%0a` `` ` ``）
- ALWAYS 区分：回显注入（直接读输出）vs 盲注（需要外带/延时）

## 🔧 工具偏好
1. `http_request` — 注入测试首选（精确控制参数编码）
2. `curl` — 复杂 payload 场景（需要特殊字符）
3. 读取 references 文件 — 遇到过滤时立即读取绕过参考
