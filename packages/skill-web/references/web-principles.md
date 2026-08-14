# Web 安全分析核心原则

> 从 secplan 领域编排器提取的通用方法论，去掉了任务编排与框架运行时引用。读完自行判断，非硬性规则。

## 核心原则

1. **攻击面优先** — 先找所有用户可控的输入点，再逐个分析每个输入点能影响什么
2. **配置即代码** — nginx/Docker/middleware 配置是「隐藏的源码」，必须阅读分析
3. **框架源码审计** — 复杂 Web 题的突破往往在框架源码（node_modules/vendor）中
4. **组合利用** — 单个漏洞往往不够，需要组合多个小漏洞构造攻击链
5. **假设必须验证** — 假设缓存键匹配/Vary 匹配时，必须实际测试，不能仅凭推理
6. **从攻击者视角思考** — 问「攻击者能让其他用户收到什么内容？」而非「这个功能正常吗？」

## 通用约束

- **禁止编造结论**：分析结果必须区分「事实」（工具输出/源码）和「推测」（标注置信度）
- **安全红线**：不向生产环境发送破坏性请求，CTF 靶机和授权测试环境除外
- **禁止 DoS**：即使是测试环境也注意速率控制，不发送大量请求导致 DoS

## 常见陷阱

| 问题 | 原因 | 解决 |
|------|------|------|
| 终端输出密码/密钥显示 `***` | 自动脱敏敏感数据 | 用 `curl -o /tmp/raw.json` 保存原始响应再读取，或 Python `requests` 写文件后读取；不要依赖终端输出判断是否拿到敏感数据 |
| 多个 API 请求同时发出后全部超时/429 | 并行请求触发目标限频/WAF | 安全测试必须顺序执行，一个请求完成后再发下一个 |
| 大量端点返回 404 但目标明显存在 | WAF 拦截或端点名错误 | 区分真 404（nginx 默认页）和 WAF 404（自定义内容）；先确认已知端点可访问再批量枚举 |
| Session Fixation 测试误判 | 服务器接受任意 session ID 但不绑定认证状态 | 完整验证：设置固定 session → 登录 → 用同一 session 访问受保护页面，确认能否劫持已认证会话 |

## 攻击模式速查

### 信息泄露链式利用（IDOR + 信息泄露）

1. 过期/无效资源 → API 返回关联实体 ID（如 last_user, last_account）
2. 关联实体 ID → 查询接口返回当前绑定的凭证/资源
3. 凭证 → 兑换/使用接口获取完整访问权限

### PHP Session Fixation 测试

```python
import requests
s = requests.Session()
s.cookies.set('PHPSESSID', 'attacker_id', domain='target.com')
s.get('https://target.com/admin/')
s.post('https://target.com/admin/', data={'user':'x','pass':'y','captcha':'z'})
assert s.cookies.get('PHPSESSID') == 'attacker_id'  # Fixation 成功
```
