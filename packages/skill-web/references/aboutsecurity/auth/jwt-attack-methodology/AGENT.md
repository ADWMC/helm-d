# 🤖 Agent 行为规则 — JWT 攻击

## ⛔ NEVER
- NEVER 在未解码 JWT 结构前就尝试攻击 — 必须先分析 header/payload
- NEVER 跳过 None Algorithm 测试（最简单的攻击向量）
- NEVER 在弱密钥爆破前不读 references — 完整工具和字典在 references 里

## ✅ ALWAYS
- ALWAYS 先解码 JWT 分析：算法（RS256/HS256/ES256）、claims、过期时间
- ALWAYS 按顺序尝试：None Alg → 弱密钥爆破 → Claims 篡改 → RS256→HS256 混淆 → kid 注入
- ALWAYS 发现 RS256 时获取公钥（`/api/jwks` `/jwks.json` `/.well-known/jwks.json`）
- ALWAYS 读 references/jwt-advanced.md 获取完整 payload 和脚本

## 🔧 工具偏好
1. `python3` — JWT 解码/签名/爆破（PyJWT 库）
2. `http_request` — 测试篡改后的 JWT token
3. 读取 references 文件 — 读取高级攻击 payload（RS256→HS256/kid 注入）
