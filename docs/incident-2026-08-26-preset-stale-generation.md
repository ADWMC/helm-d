# 事故报告：helmd preset 组装残废（2026-08-26 夜）

> 状态：根因定位完成，最后一公里（致哑具体行）待受控复现定音。
> 所有结论附证据与置信度。调查过程未修改任何部署文件。

> 2026-08-31 架构更新：本文记录的是当时“helmd 主插件由 profile 全局加载”的
> 历史修复。当前全局 bundle 只加载 `helmd-health`，主插件由 helmd preset 在
> Agent 隔离上下文中加载；不要再按本文旧结论把主插件移回 profile。

## 0. 一句话结论

v0.2.0 部署（08/26 20:53）改写了 `~/.dsh/.agent-presets/helmd/agent.cordis.yml`，当晚首个新顶层会话触发 DSH agent-presets 的 standing-mount **重建新一代**；新代组装出「只剩 bundle 工具、宿主平台工具层整体缺失」的残废目录并静默开席，导致 luna 分析师整场无法调用 shell/read/fs 等任何平台工具。

## 1. 故障解剖

### 1.1 故障会话的组装状态（高置信度）

来源：用户提供日志 `session-4c21cd85-be0e-4337-81e8-bdf7de69c2fd`（cwd=`F:\projects\test`，`agentPreset:"helmd"`）。

两个 `request/header`（seq10、seq21，模型 deepseek-v4-flash）工具目录完全相同：

- 总数 **44** = **31 个 @dsh-security/helmd v0.2.0 域工具** + **13 个 dsh-mnemon 工具**
- 宿主平台工具全部缺失：`bash/pwsh/read/glob/grep/edit/write/todo_write/web_search/jobs/goals/subagent/workflow/ralph/skill/plan-mode/compaction…`
- **bootstrap 锚定从未触发**（健康形态首轮应为 `[pwsh, read]` 两件套）
- persona 正常：system = 2369B 的 luna 全文（`complete:true` 生效）

行为侧证据：turn6 中模型依次探测 `bash / powershell / shell / exec / cmd / read / pwsh / terminal / run / execute / command / shell_exec / run_command / execute_command / node / python` 共 17 个名字，全部返回 unknown tool（143 次 tool/call、143 次 tool/result 配对完整，无静默丢失）。与用户贴出的独白逐条吻合。

两个子代理（a71a0863、e6c6ad3d，经 composeFrom 继承同一 composition）同样残废（44 工具），证明问题在 standing composition 本身而非单个会话。

### 1.2 健康对照

| 样本 | 时间 | preset | 目录形态 |
|---|---|---|---|
| 昨晚 luna 子代理 `eeda4d8a`（D:\Reverse\helm-d） | 08/26 23:46 | helmd | 首轮 `[pwsh,read]` ✓ → 晋升 50 工具 ✓，后期 96+ |
| 同样本的工具集 | — | — | 含 `create_case`（**v0.1.x 工具**，v0.2.0 已 retired）、无 `begin_case` ⇒ 运行在**旧一代 mount**上 |
| 当前会话（本调查所在进程，PID 28532，今日 13:34 启动） | 08/27 | standard | 70 工具全量健康 ⇒ 排除宿主组合/profile bundle 层本身损坏 |

⇒ 同一台机器、同一 profile、同一份 preset 名字：79 秒内一次健康一次残废，唯一变量是 standing mount 的新旧两代。

## 2. 时间线（全部实证）

```
08/24 18:07  .agent-presets/helmd/agent.cordis.yml.bak 落盘（v0.1.x 单源，17568B）
08/26 20:53:15  repo dist-tgz/helmd.tgz 打包（v0.2.0）
08/26 20:53:29  profile node_modules/@dsh-security/helmd 更新（新包落位）
08/26 20:53:29  .agent-presets/helmd/agent.cordis.yml 覆写为 v0.2.0 版（16511B，哈希与 repo 单源一致）
             ↑ 三件事同一分钟：部署换血完成，但正在运行的老服务进程未感知
～当晚        旧服务进程内仍持有 20:53 之前建立的 helmd standing mount（v0.1.x 模块+旧 stamp）
08/26 23:46   luna 子代理经 composeFrom 加入【旧代】standing ⇒ 健康（绕过 stamp 检查，源码 index.js:988-995）
08/26 23:47:20 F:\projects\test 新顶层会话显式选 helmd ⇒ resolveMountable→ensureStanding
              → stamp 不匹配（16511B ≠ 旧值）⇒ 销毁引用、重建新一代
              → 新一代 Include 重读 v0.2.0 yml 并重新 import 各行 ⇒ 组装残废（44 工具）
08/27 13:34:53 服务重启（PID 28532）；此后 standard preset 会话一切正常
```

关键机制依据（`@deepseek-ai/dsh-agent-presets` rc.2 源码，高置信度）：

- `ensureStanding` 仅比对文件 mtime/size stamp，变化即重建新一代（index.js:1130-1159）；
- `composeFrom` 直接复用现成 standing，不做 stamp 检查 —— 这就是 79 秒前后一健一残共存的原因；
- `mountPreset` 为 fail-loud 设计：任一行 waiting 服务或向 root realm 泄漏服务都会整体拒载（mount.js:299-348）；
- 本次残废并未触发拒载 ⇒ 存在「各插件 usable 但 tools.register 产出未进入该 agent 目录」的路径（见 §4 待定音项）。

## 3. 根因

**直接原因**（高置信度）：v0.2.0 版 preset 文件在 rc.2 宿主上重建出的新 generation 缺失全部平台工具行的产出；persona 行与 helmd 自家 31 个工具正常。

**暴露的四项工程缺陷**（本次要修的对象）：

1. 【高】`@dsh-security/helmd` 不在 profile `package.json` 的 `dsh.profile.bundles` 列表里，靠 preset 文件末行拉起 —— 包换血与 yml 换血分属两条链路，可以只同步一半；
2. 【高】preset 手抄宿主 standard 全文（连注释逐字复制，已逐字核对）。宿主/rc 版本一变即漂移；仓库自己的对齐证据文档（`docs/anchored-standard-alignment-evidence.md` §4）早就预警过跨版本未验证；
3. 【高】组装残废零告警：inactiveRows 只校验「插件激活」，不校验「产出基准」；44 个工具照样静默开席；
4. 【中】rc.2 fail-loud 语义下仍存在可用却零产出的组装路径 —— 可作为宿主侧行为反馈上报。

## 4. 待定音项（需一次受控复现，未做——用户选择只要报告）

「平台行注册了却不出现在目录」的确切分支尚未分离。嫌疑序（建议二分顺序）：

1. compaction group 的 `tool-result-pruner` 配置组合；
2. delegation group（subagent/workflow/ralph 的 realm 聚合方式与本版宿主的兼容性）；
3. `tool-fs-search` 的 `sampleOverCapGlobResults` 配置；
4. `!!js` 表达式求值差异导致的 disabled 误判（低概率：persona/helmd 行成功说明解析器主体无异）。

定音实验步骤（随时可执行）：

```powershell
# 在当前新进程上以 helmd preset 开一个测试会话（GUI 选 helmd 或 API），
# 读新会话日志首个 request/header：
#   tools=44 且无 pwsh   ⇒ 稳态残废 ⇒ 立即执行方案 A 回滚
#   [pwsh,read] 两件套    ⇒ 仅当晚 transitional（重启自愈）⇒ 直接做 C 结构性治本
```

会话日志为 `%TEMP%` zip 时解压参考：`unzstd -f -o out.jsonl <session dir>\session.jsonl.zstd`（本机 w64devkit 自带 zstd）。

## 5. 修复方案与建议

| # | 方案 | 内容 | 成本 | 风险 |
|---|---|---|---|---|
| A | 应急回滚 | 用 `.bak` 还原现役 yml（回到已知良好的 v0.1.x 形态） | 分钟级 | 无 |
| B | 受控复现定音 | 见 §4，判定稳态/transitional，随后逐行二分 yml 找致哑行 | ~30min | 低 |
| C | 结构性治本 | preset 改 overlay 架构：fork 宿主内置 standard + 仅覆写 persona 段与追加 helmd 行；构建期断言「非 helmd 部分 ≡ 宿主当前版 standard」，不一致即 fail。消弭漂移类问题于永久 | 中 | 低 |
| D | 防回归护栏 | MAINTENANCE.md 发布清单增步：部署后开 test session 断言首请求 = `[pwsh,read]` 且晋升后 ≥60 工具，不达标回滚 tgz | 小 | 无 |

推荐路线：**B → （若稳态残废则 A）→ C + D**。

## 6. 附：调查中核验过的基线事实

- `.agent-presets/helmd`、repo `packages/helmd/presets/agent.cordis.yml`、安装包内副本三者 SHA-256 一致（470D4D4B…）⇒ 排除「发布件过期/不同步」假设；
- 宿主 rc.2（npm 全局 0.1.1-rc.2）vendor node_modules 内置全部被引插件包（dsh-tool-bash/pwsh/fs/… 均存在）⇒ 排除「包缺失」假设；
- 宿主内置四 preset（code/cordis/minimal/standard）与 helmd yml 的平台行形状一致 ⇒ 排除「形状过时」假设；
- mnemon 13 个工具来自 profile bundles（host/global 层），任何 preset 下都可见 ⇒ 44 的构成恰好反证「preset 层产出缺失、global 层完好」。

## 7. 修复执行与定音结果（2026-08-27，方案 C + 验证）

根因在方案 C 执行期间进一步加压成实证，并已修复。

**宿主内幕（session.create 路上的 fail-loud 注册冲突）**：对运行中 rc.2 宿主直接调 `session.create {agentPreset:'helmd'}`，当 preset 内容自上次 standing mount 变化后**首次重建**时，逐行抛 `tool "X" is already registered in this scope`（含全部平台行与 helmd 行）——即「旧代 standing 的注册残留 + 新代重建撞车」。昨晚 23:47 会话当时能启动是因为进程更早、静默降级；今日同一内容在重启后的进程里直接 fail-loud（可诊断，但当时表现为「建会话失败」）。

**分叉实验（全部实证）**：

| 探针（HTTP `session.create`） | 结果 |
|---|---|
| `standard` / `minimal`（宿主内置） | ✅ 成功 |
| `p1`（仅 persona 一行） | ✅ 成功 |
| `p2`（persona + 单工具行，补齐 rc.2 必填 config） | ✅ 成功 |
| `helmd`（我部署生成版后的首次创建） | ❌ 逐行「already registered in this scope」 |
| `helmd`（字节不变，仅 touch mtime） | ✅ 成功 |
| `helmd` 该会话首条 prompt | ✅ **req1=[pwsh,read]（两件套锚定）→ req2=100 工具（平台全量 + helmd 域全量）** |
| `helmd` 会话真实跑通 pwsh 并回复 | ✅ `healthcheck-ok` |

⇒ 排除「全局层污染」「preset 形状过时」「包缺失」；确证「standing mount 代际重建残留在同一 preset 作用域撞车」。修复（方案 C）落地后当前进程已恢复健康；该缺陷的剩余触发面是「运行中改 preset 文件且不重启」——已写入 MAINTENANCE §8 护栏：改过 `agent.cordis.yml` 产物后必须重启宿主进程（standing 驻留进程内），或至少按 §4 断言做一轮 live 验证。

**当前状态**：luna 会话工具目录健康（2→100）；`scripts/gen-preset.mjs --check` 绿；`scripts/repack.ps1` 端到端绿（750KB tgz）。

## 8. 修复清单（方案 C 交付物）

- `packages/helmd/presets/persona.txt` — persona 单源（新）
- `scripts/gen-preset.mjs` — 从宿主 standard 生成 preset + 字节级断言（新）
- `presets/full-reverse/agent.cordis.yml` — 生成物（重生成；顺带修正手抄时代的 `enableRunInBackground:false` → rc.2 原生 `backgroundMode: one-shot`）
- `scripts/repack.ps1` — 打包前先跑生成器（接入）
- `MAINTENANCE.md` — 单源表、§3 流程、§5 坑位表、§8 护栏改写
- 已部署：`~/.dsh/.agent-presets/helmd/agent.cordis.yml` = 生成版（与 repo 哈希一致，已活体验证）

## 9. 后续修复：取消重复注册与恢复平台工具（2026-08-28）

### 问题是什么

上一版方案 C 把宿主 `standard` 的平台工具行和
`@dsh-security/helmd` 行都写进用户 preset。实测确认 profile 的
`dsh.profile.bundles` 已挂载 helmd bundle；再次写入该行会向同一注册表
重复注册。

当 dsh 对 `helmd` preset 建立或重建 standing mount 时，真实
`session.create` 会失败，错误为 `tool "<name>" is already registered`，
受影响项包括 helmd 域工具；这个现象不是包缺失、也不是 persona 解析失败，
而是 profile-owned helmd bundle 被 preset 重复声明。

随后将 preset 收缩为 persona-only overlay 的尝试被新的真实会话测试否定：
会话只得到 helmd 域工具，缺少 `pwsh`、`read` 和 standard 平台工具。因此
standard 工具行属于 agent preset，不能由 profile 自动替代。

### 如何修复

1. 将 `scripts/gen-preset.mjs` 和包内镜像
   `packages/helmd/scripts/gen-preset.mjs` 改为复制当前宿主 standard 的
   全部平台行，仅替换 persona；不输出 `@dsh-security/helmd` 行。
2. 生成器断言：输出行集合与宿主 standard 一致、无重复 id，且不能包含
   `@dsh-security/helmd`。这保留 `pwsh`、`bash`、`read` 等平台工具，同时
   让 helmd 仅由 profile bundle 挂载一次。
3. 对字节相同的生成结果不重写文件，避免无意义变更 mtime 而触发
   standing mount 重建。内容发生变化后，安装脚本明确提示先重启 dsh。
4. 同步仓库生成物与包内 `presets/agent.cordis.yml`，确保 tgz 安装路径
   使用同一份 standard-plus-persona preset。
5. 修复 `setup-preset.ps1` 的条件表达式：先取得 `Get-Command node`
   的结果再判断，避免 PowerShell 将 `-and` 误解析为 `Get-Command` 参数。

### 验证证据

| 验证项 | 结果 |
|---|---|
| `pnpm test:preset` | 通过；覆盖生成器幂等性、standard 行保留和无 helmd bundle 行 |
| `node scripts/gen-preset.mjs --check` | 通过 |
| `pnpm typecheck` / `pnpm build` | 均通过 |
| `setup-preset.ps1` 临时 `DSH_HOME` 安装 | 通过；生成结果与仓库 preset 逐字节一致 |
| 新启动 dsh 后 HTTP `session.create(agentPreset: "helmd")` | 成功，返回 `ok: true` 和新 sessionId，未出现重复注册错误 |
| standard 重生成物 | 包含 `tool-pwsh`、`tool-bash`、`tool-fs` 等 standard 行，且不含 helmd bundle 行 |
| 重启 dsh 后实际 `request/header` | 69 个工具，包含 `pwsh` 和 `read` |
| 模型实际 `pwsh` 调用 | `Write-Output helmd-pwsh-ok` 返回 `helmd-pwsh-ok` |
| 模型实际 WSL 调用 | `pwsh` 执行 `wsl.exe -- bash -lc 'printf helmd-wsl-ok'` 返回 `helmd-wsl-ok` |

模型驱动的 `pwsh` 回合未能完成，原因是该测试环境的模型提供方返回
`403 Insufficient account balance`；这是外部账户余额限制，不是 preset
mount、工具注册或 `pwsh` 可用性错误。

### 维护结论

此处的“复制宿主 standard、替换 persona、删除 helmd 行”取代本报告第 5 和
第 7 节中旧方案 C 的“复制宿主 standard 并追加 helmd 行”实现。今后用户
preset 负责 standard 平台工具和 persona；helmd bundle 只由 profile
`dsh.profile.bundles` 负责。改动 preset 内容后仍必须重启 dsh，再创建新会话
进行 `session.create` 验证。
