# dsh-anchored-standard 对齐证据

> 本文记录 helm-d 与 [xiaobright/dsh-anchored-standard](https://github.com/xiaobright/dsh-anchored-standard) 的对齐事实。
> 每条结论附置信度；未做端到端启动验证的项单独标注。

## 1. 已对齐的事实

| # | 事实 | helm-d 落点 | 证据 | 置信度 |
|---|---|---|---|---|
| 1 | persona 用 `@deepseek-ai/dsh-persona`，`complete: true` | `presets/*/agent.cordis.yml` identity 段 | 文件内 `- id: persona` / `complete: true` / `includeRuntimeContext: false` | 高 |
| 2 | 首轮工具目录经 `system-prompt/assemble` 过滤 | `packages/bootstrap/src/index.ts` | `ctx.on('system-prompt/assemble', ...)`；`inject = ['systemPrompt']` | 高 |
| 3 | 只保留一个平台 shell + `read` | 三个 preset 的 `tool-bootstrap` config | `shellTools: [bash, pwsh]`、`commonTools: [read]` | 高 |
| 4 | 默认 `promoteOn: either` | 同上 | `promoteOn: either` | 高 |
| 5 | 子 agent 跳过 bootstrap，始终完整目录 | `packages/bootstrap/src/index.ts` | `if ((session.header?.delegationDepth ?? 0) > 0) return true` | 高 |
| 6 | router 不再注入系统提示段 | `packages/router/src/index.ts` | `export const inject = ['tools']`；无 `ctx.systemPrompt.section` | 高 |
| 7 | preset 目录含 `preset.yml` + `agent.cordis.yml` | `presets/{minimal,standard,full-reverse}/` | 两个文件均存在 | 高 |
| 8 | 安装即构建 | 所有 `packages/*/package.json` | `"prepare": "tsc -p tsconfig.json"` | 高 |

## 2. 关键 API 证据（来自本机 rc.6 安装）

- `@deepseek-ai/dsh-system-prompt` README：`ctx.systemPrompt.section()` 与 `system-prompt/assemble` 是权威瀑布；`complete: true` 段会成为最终提示。置信度：高。
- `@deepseek-ai/dsh-agent` README：`agent/inbox/inserted { message }` 与 `agent/session-start` 均为真实事件。置信度：高。
- `@deepseek-ai/dsh-agent-presets` README：preset 是 `agent.cordis.yml` 目录；行包名从宿主组装解析；`preset.yml` 只承载展示文本。置信度：高。
- 本机 npx 缓存中的 rc.6 随附 preset：`C:\Users\Administrator\AppData\Local\npm-cache\_npx\...\node_modules\@deepseek-ai\dsh\config\agent-presets\{minimal,standard,cordis,code}\agent.cordis.yml`；其 standard 行结构与参考仓库 rc.5 一致，差异仅在 persona 文本与 bootstrap 行。置信度：高。

## 3. 与参考仓库的有意差异

- persona 文本从英文固定句改为 helm-d 中文工程规范（`packages/router/prompt.md` 内容），保留 `complete: true`。
- bootstrap 插件从 `./tool-bootstrap.mjs` 改为 `@dsh-security/bootstrap` TS 包，逻辑对齐。
- 末尾追加 `@dsh-security/router` 与领域 bundle 行。
- 暂未实现 `zero-anchored-standard` 的 `anchor-turn` / 零工具锚定模式。

## 4. 未验证项 / 残余风险

- **启动兼容性**：参考仓库基于 rc.5 / commit `47f9438`；本机为 rc.6。三个 preset 的行 id/config 尚未实际挂载验证。置信度：中。
- **bundle 解析**：`@dsh-security/*` 在 preset 中以 `name:` 行解析，要求这些包已安装到 host 可解析的 `node_modules`（profile 或宿主）。本工作区未安装依赖，未做 `pnpm install` 后的解析验证。置信度：中。
- **工具过滤范围**：bootstrap 只过滤 `assembled.tools`，未调用 `ToolRuntime.restrict()`；这与参考仓库一致，但 rc.6 文档建议跨呈现/查找/执行保持一致时用 `restrict()`。置信度：中。

## 5. 验证命令建议

```powershell
# 语法/类型层面（本工作区当前无 node_modules，实际构建需先 pnpm install）
pnpm -r build

# 启动后导出 session JSONL，检查首条 request/header 的工具目录：
# 应只有 pwsh/read（Windows）或 bash/read（Linux），后续 header 为完整目录。
```
