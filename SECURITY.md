# 安全策略（Security Policy）

## 1. 支持范围

安全修复只保证最新发布版本。当前最新版本以 `packages/helmd/package.json` 为准；旧版本请先升级再报告。

## 2. 报告漏洞

- 优先使用 GitHub 仓库 **Security → Report a vulnerability** 的私密报告通道。
- 如果私密通道不可用，开一个**不含利用细节**的 issue，只说明"需要私密联系渠道"，不要公开 PoC、凭据、样本或未修复细节。
- 报告请包含：受影响版本、操作系统、dsh 版本、Node 版本、影响、最小复现、建议缓解；日志中的凭据、cookie、样本路径请先脱敏。
- 不要提交真实客户数据、未授权样本、`cookie.txt`、`~/.dsh` 下的会话/凭据文件。

## 3. 信任边界

helm-d 是**运行在用户权限下的宿主插件**，不是 sandbox：

- 它会读写工作区、`~/.dsh`、`helmd-cases/`、`helmd-tools/`，并可通过 `runSeam()` 执行本机子进程。
- 它可以修改发给模型的 system prompt（persona / boost section）、拦截 `llm/stream` 并重试、包装工具输出落证据。这些是产品能力，也意味着**插件代码本身就是信任边界**。
- `payload.dat` / `references.dat` / `profiles.dat` 使用 AES-256-GCM 封印，密钥内置于 `crypt.ts`。这是为了规避 npm 静态扫描与明文分发，**不是保密或防逆向机制**；任何拿到包的人都能解密。不要把封印当作安全控制。
- star gate 只做 GitHub OAuth device flow 的 star 校验：scope 为空、token 仅在内存中用于 star watch、随后丢弃；它不注册模型可见工具，也不阻断 persona。它是荣誉制，不是访问控制。
- 出站请求包括 GitHub API（star gate / `find_tool`）、模型提供方（`model-probe`）以及 `references/` 中工具说明涉及的第三方地址。使用前确认网络策略与代理配置。
- `prompt-assembly.ts` 会剥离名字含 `sandbox` / `approval` 的宿主 context。这是当前产品行为；如果你依赖宿主安全上下文，请在部署前评估。

## 4. 本地数据

| 路径 | 内容 | 建议 |
|---|---|---|
| `~/.dsh/storages/helmd/gate-state.json` | star 状态 / login | 可删除以重置门禁 |
| `~/.dsh/storages/helmd/gate-code.txt` | 一次性设备码 | 会话结束应清理 |
| `~/.dsh/helmd-tools/` | 工具账本 / dead-end / 模型评测 JSONL | 可能含目标信息，勿提交 |
| `~/.dsh/helmd-stream-intercept.log` | 拦截计数与拒绝摘录 | 可能含提示词片段，勿公开 |
| `helmd-cases/` | 样本、证据、CASE.md | 可能含敏感样本，勿提交 |
| `cookie.txt` | 本地 dsh 认证 cookie（已 gitignore） | 不要打包/共享 |

## 5. 供应链

- 从 GitHub Releases 下载时，优先核对发布资产的 SHA-256；当前发布资产是 3 个 tgz（版本化 tgz + `helm-d.tgz` + `helmd.tgz`）。
- 需要可审计时，从源码构建：`pnpm install && pnpm build && .\scripts\repack.ps1`，并对比 `payload.dat` / `references.dat` 的哈希。
- 发布者应保留构建环境、版本与命令记录；建议后续给 release 增加 `SHA256SUMS` 与 npm provenance。
- 安装第三方工具（`find_tool` / `references/` 指向的仓库）前自行审查；helm-d 不保证第三方工具的安全性。

## 6. 不在范围内

- 第三方工具、样本、references 中描述的攻击手法本身。
- 因用户未授权使用、违反所在地法律或超出授权范围产生的后果。
- 宿主（dsh）自身的安全问题；请向对应项目报告。
