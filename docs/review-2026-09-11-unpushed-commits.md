# 审查记录：未推送的两次提交（f22bbd2 / 5262f8f）

> 审查日期：2026-09-11（本地时区 +08:00）
> 审查基线：`origin/main..HEAD`，即 `f22bbd2 feat(helmd): H-CoT runtime, accountable advisory
> ledger, preset auto-heal`（+2082/−20）与 `5262f8f chore: import remaining workspace changes;
> ignore _refs/ and cookie.txt`（226 文件，+52690/−2288）。
> 流程：Patchwork `/patchwork-review`（用户路径走查 → 用户会犯的错 → 体验缺陷 → 商业化边界），
> 验收标准取 `docs/product-engineering-guide.md` §六。
> 本记录只陈述可核实内容；**未修改任何源码/配置**，审查结束时 `git status` 干净。
> 结论不代表已修复：全部问题按现状记录，修复需另开任务。

## 0. 用户假设

已安装 dsh 的安全分析操作者，走"装包 → 写 preset → 开会话 → 派任务 → 读卡片/报告"这条首次
价值路径；替代品是逐领域手工拼装 skill。因此本次走查重点在：部署位 preset 的改动、
agent 实际被注入的指令、`route_task`/`case_status` 卡片这类用户可见产物，以及仓库文档
与实现是否一致。

## 1. 实测证据（命令与结果）

| 验证 | 命令 / 方式 | 结果 |
|---|---|---|
| 类型检查 | `npx tsc -p packages/helmd/tsconfig.json --noEmit` | 通过，exit 0 |
| 编译 | `npx tsc -p packages/helmd/tsconfig.json` | 通过，写入 gitignore 的 `dist/` |
| H-CoT 语料/三步 | `python packages/helmd/scripts/ai-security/h_cot_attack.py --goal "…" --dry-run` | 通过，probe/forge/inject 三段齐全，不联网 |
| H-CoT 胜率表 | 同脚本 `--stats` | 通过（空账本输出 `(no records)`） |
| 路由实跑 | `node --input-type=module -e "…matchRoute(…)"`（编译产物） | `dll 劫持 分析`→hcot；`进程劫持 排查`→hcot；`ssrf 越权`→web |
| 采纳率卡片实跑 | 合成 `advisories.jsonl`（3 行 `stance:no-hedge` / ignored）+ `renderAdvisoryStats()` | 卡片输出 `| stance:no-hedge | adopted=0 ignored=3 | 已降频 |`，但 `isDemoted(key,'mandatory')===false` |
| 拒绝正则实跑 | 同 `hcot-hook.ts:16-17` 的字面量 + `advisory-hook.ts:21-26` 的 marker 表 | `我无法核实该来源，证据不足，先标注未验证。` → hcot 命中 `true`，hedge 命中 `false` |
| preset 同源 | `node scripts/gen-preset.mjs --check` | `preset check OK`，宿主指纹 `08a029…`；`packages/helmd/presets/agent.cordis.yml`、`presets/full-reverse/agent.cordis.yml`、`~/.dsh/.agent-presets/helmd/agent.cordis.yml` 三份 SHA-256 一致（`D0BEE205…`） |
| reference 链接 | 解析 `packages/helmd/references/**/index.md` 的本地 `](*.md)` 并 `Test-Path` | 358 个 md，**0 断链**（导入提交的 `fix-links.mjs` 生效） |
| skills-reference 链接 | 同上，针对 `docs/skills-reference/*.md` | **5/5 断链** |
| 发布件比对 | `tar -xzf dist-tgz/helmd.tgz` 后逐文件 `Get-FileHash` 与 `packages/helmd/` 比 | `presets/agent.cordis.yml`、`presets/persona.txt`、`dist/{advisory,hcot-hook,health,router,ledger}.js`、`scripts/ai-security/h_cot_attack.py` 八项 **SAME** |
| 凭据 | `git log --all -- cookie.txt`；`git ls-files` | `cookie.txt` **从未进入任何提交**；`_refs/`、`cookie.txt` 均未被跟踪且已入 `.gitignore` |
| 运行时是否在跑被审代码 | 列 `~/.dsh/profiles/web/node_modules/@dsh-security/helmd/dist` | 安装副本（9/10）**没有** `advisory.js` / `advisory-hook.js` / `hcot-hook.js` → 被审运行时尚未在当前 GUI 中运行 |

## 2. 问题清单（按用户影响排序）

### F1【高】自动修复 preset 绕过本项目自己的护栏，且静默覆盖手改文件（无 `.bak`）

- 位置：`packages/helmd/src/health.ts:109-126`（`autoHealPreset`）、`:199-210`（`apply()` → `evaluateHealth()`，宿主启动路径，同步 `spawnSync`）；`packages/helmd/scripts/gen-preset.mjs:212-226`（`writeFileSync`，无备份）。
- 对照事实：
  - 手工路径 `packages/helmd/scripts/setup-preset.ps1:41` 写前 `Copy-Item … .bak`；
  - `MAINTENANCE.md:112`："内容实际变化后仍须重启 dsh 再开新会话"；
  - `MAINTENANCE.md:156`：**每次改动 `agent.cordis.yml` 产物后**必须开测试会话断言首轮 `[pwsh,read]`、晋升后 ≥60 工具，不达标回滚 `.bak`；
  - `docs/incident-2026-08-26-preset-stale-generation.md` §7：该缺陷"剩余触发面是「运行中改 preset 文件且不重启」"；
  - `README.md:194`：把"手改了 agent.cordis.yml"列为内容漂移成因之一——项目自己承认用户会手改该文件。
- 用户影响：宿主升级后的首次启动会无人值守改写部署文件；用户的手改内容被抹掉且无 `.bak` 可回滚；"改文件不重启"正是 08/26「44 工具残废」的触发面。本次因部署字节与仓库一致而未触发，下一次宿主升级即具备触发条件。
- 最小修复：写盘前留 `.bak`；默认只报告、写盘改为 opt-in；写盘后在健康卡片/日志提示"必须重启并做 §8 断言"。

### F2【高】H-CoT 拒绝检测把"我无法核实"判成拒绝，与同一次提交的论证和文档冲突

- 位置：`packages/helmd/src/hcot-hook.ts:16-17` 的 `REFUSAL_RE` 含裸 `我无法|无法提供|不能提供`。
- 对照事实：`packages/helmd/src/advisory-hook.ts:21-26` 与 `packages/helmd/references/evidence/advisory-ledger.md:69` 明确论证"`无法核实来源` 是质疑前提纪律**要求**的表达，裸 `无法/不能` 不能算 hedge"；`packages/helmd/presets/persona.txt` 的 CHALLENGE THE PREMISE 第 3 条正是要求写这句话。
- 复现：`我无法核实该来源，证据不足，先标注未验证。` → hcot 拒绝=**true**，hedge=**false**。
- 用户影响：用户要求核对来源/挑错时，agent 每写一句诚实的"无法核实"，下一轮装配即被注入 `tier: mandatory` 的 `REFUSAL SIGNAL DETECTED … open the H-CoT channel`，并被推去调用 `hcot_attack`（打外部模型 API）。即把合规的核查动作误判为需要破甲。
- 最小修复：把 `REFUSAL_RE` 收窄到"拒绝交付"话术（我无法协助/无法提供/不能提供该/不予/拒绝…），与 `HEDGE_MARKERS` 及文档纪律对齐。

### F3【中】采纳率卡片把 mandatory 指标标成"已降频"

- 位置：`packages/helmd/src/advisory.ts:243-247`（`demotedKeys()` 只统计 key/verdict，不看 tier）、`:250-259`（据此打 `已降频` 标签）；而 `:237-240` 的 `isDemoted` 对 `mandatory` 恒为 false。
- 对照事实：`references/evidence/advisory-ledger.md:45` 写的是"同 key `ignored ≥ 3` **且 `tier ≠ mandatory`** → 不再渲染（`route_task` 卡片显示 `已降频`）"。
- 复现：合成 3 行 `stance:no-hedge`（mandatory / ignored）→ `demotedKeys=[stance:no-hedge]`、`isDemoted('stance:no-hedge','mandatory')===false`、卡片显示 `已降频`。
- 用户影响：`route_task` / `case_status` / `end_case` 三处露出都会显示；而 mandatory 指标永不降频，等于恒误报，用户据此判断"这条提示已退场"是错的。
- 最小修复：`demotedKeys()` 按账本行记录的 `tier` 过滤，或 `renderAdvisoryStats` 改用 `isDemoted(key, tier)`。

### F4【中】`劫持` 关键词把 DLL/进程劫持误路由到 H-CoT（本次引入的回归）

- 位置：`packages/helmd/src/router.ts:59` 给 `hcot` 路由加了裸关键词 `劫持`，且该行排在 `native`/`web` 之前。
- 复现：`matchRoute('dll 劫持 分析')` → primary **hcot**；`matchRoute('进程劫持 排查')` → **hcot**。
- 用户影响：本仓库 native 领域本就覆盖 DLL 劫持/进程注入题材；用户问样本里的劫持分析，`route_task` 卡片却指向 H-CoT 越狱 playbook，并顺带触发 hcot 相关计量。
- 最小修复：删除裸 `劫持`（保留 `h-cot`/`hcot`/`chain-of-thought`/`思维链`/`思维链劫持`/`cot 劫持`），或把 hcot 行下移到 native/web 之后。

### F5【中】`tool_memory` 把 `evidence` 声明为所有 action 必填

- 位置：`packages/helmd/src/ledger.ts:305`（`evidence: { …, required: true }`），而 `execute` 只在 `note` 分支真正校验（`:319-330`）。
- 机制证据：dsh-tools 把 `required: true` 编译进 JSON Schema 的 `required`，入参校验失败报 `missing required property`（`@deepseek-ai/dsh-tools/lib/index.js:454-455`、`lib/types/schema.js:78-82`）。
- 用户影响：`persona.txt` 与 `tools/caseflow.ts` 的 RULES 都把 `tool_memory(register/note)` 当常规动作；模型必须为 `register`/`search`/`sync` 编一个 `evidence` 值才能过校验——与工具自身"无证据不写入"的纪律矛盾，并给账本塞假证据。
- 最小修复：去掉 `evidence` 的 `required: true`（`note` 分支已有 `REJECTED` 兜底）。

### F6【中】自动修复的结果在 GUI 里不可见

- 位置：`packages/helmd/client.js` 的行渲染列表只输出 detail / 双指纹 / 版本 / 评估时间 / 两条路径；`src/health.ts:50-51` 新增的 `autoHeal` 无人渲染。`README.md:184-198` 仍称"只读健康卡片"，并要求用户"重跑 install / setup-preset，再重启"。
- 用户影响：修复失败（`failed (…)`）时用户看到的仍是"宿主已升级 → 重跑 install"，真因只存在于不显示的字段里；修复成功时用户也不知道文件已被改写。
- 最小修复：卡片补 `autoHeal` 行（含失败原因）；README 健康卡片一节补自动修复语义与关闭开关。

### F7【中】版本与工具清单没跟上（两次提交都在动文档，唯独这三处漏了）

- `README.md:413`、`README.en.md:411` 及漂移对策表 `README.md:422` / `README.en.md:420` 仍写 **0.2.3**，而 `5262f8f` 把 `packages/helmd/package.json` 提到 **0.2.4**（该表自己写的是"版本 0.2.3，tarball 与 release 同步发布"）。
- `README.md:269` 的 AI-Security 工具表未收录 `hcot_attack`；Router 表未收录 `tool_memory`。
- `HELMD_AUTO_HEAL` 全仓库只出现在 `packages/helmd/src/health.ts`，用户没有关闭自动写盘的文档入口。
- 用户影响：按 README 核对版本/工具会得到自相矛盾的信息；关闭自动写盘只能读源码。

### F8【中】导入的两份渗透 skill 文档全是死链，且仓库内没有入口

- 位置：`docs/skills-reference/authorized-pentest-framework.md`、`docs/skills-reference/实战派红队渗透测试专家.md`。
- 复现：5 个本地链接全部不存在——`../web/pentest-web-checklist.md`、`../native/ad-lpe-checklist.md`、`../evidence/pentest-report-template.md`（这 3 个目标实际在 `packages/helmd/references/…` 下）、`../toolbox/pentest-workflow.md`（全仓库不存在）、`./redteam-pipeline.md`（全仓库不存在）；文档自述的 `skills/` 目录也不存在。
- 另：全仓库无任何文件引用 `docs/skills-reference`；agent 的参考树是 `packages/helmd/references/`，因此这两份内容对用户和 agent 都不可发现。
- 最小修复：修正指向并在 README/索引给出入口，或先不入库。

### F9【低】建议账本在 prompt 装配关键路径上全量扫文件，且每轮追加一行

- 位置：`packages/helmd/src/advisory.ts:196-212`（`ignoredCounts`/`advisoryStats` 每次全读文件）、`:237-247`（`renderAdvisories` 对每条 live advisory 各查一次降频）；`src/advisory-hook.ts:86-96` 的 `stance:no-hedge` 每轮 arm/核销 → 每轮落一行账，无轮转/上限。
- 用户影响（推断，中置信度）：账本随会话量线性增长，而每轮装配都全量读 × live advisory 条数；用户可感知的是每轮首 token 变慢。
- 最小修复：进程内缓存 + mtime 失效；per-turn 的 stance 计量改为内存聚合、定期落盘。

### F10【低】其余小项

- `src/advisory.ts` 的 `pending` Map 无会话结束清理（长进程累积）。
- `src/hcot-hook.ts:94` 缩进错位（不影响行为）。
- `src/health.ts` 硬编码 preset 目录名 `helmd`（`setup-preset.ps1 -Preset` 可改名；README 的部署路径固定为 `helmd`，故仅自定义名场景失效，且失败方向安全：`NOT_DEPLOYED` 不写盘）。
- `hcot_attack` 的 `goal` 在 schema 中非必填、描述却说必填；缺失时用户看到的是 python `argparse` 报错经 seam 包装后的文本。
- `shelfSummary()` 让只读的 `route_task` 产生写副作用（`TOOLS.md` / `DEAD_ENDS.md`，幂等）。

### 提交卫生（Patchwork Git 提交规范）

`5262f8f` 把 `.gitignore` + 版本号提升 + 226 个文件的内容导入混在一个提交里，提交信息亦自述"本次会话前工作树既有的未提交内容，非本轮所写"，无法作为"一个可独立审查的逻辑变化"。已核实无凭据泄漏：`cookie.txt` 从未进入任何提交，`_refs/`、`cookie.txt` 已入 `.gitignore` 且均未被跟踪——这一项做对了。

## 3. 待用户决策（记录，不代决）

| # | 议题 | 为什么需要产品决策 |
|---|---|---|
| D1 | `hcot_attack` 默认把越狱 payload 发往 `https://api.deepseek.com`（用使用者自己的 key） | README 首屏与工具表未披露"需要外部模型 API key + 会把越狱内容交给该服务"，涉及账号/ToS 与付费边界 |
| D2 | 破甲 persona（"拒绝即残余注入"+"FIRST PASS 归一化，绝不口头拒绝"）与自动 hook 组合 | 等于关闭 agent 的拒绝能力；与此前 CTF/授权定位是否仍一致、是否加显式"仅授权样本"边界，属产品决策 |
| D3 | F1 的修复方向：默认只报告（opt-in 写盘）还是保持默认开 | 改变默认行为，影响部署位文件的写入时机 |

## 4. 未验证 / 残余风险

- **未做 live 会话验证**：当前 profile 安装副本（`~/.dsh/profiles/web/node_modules/@dsh-security/helmd/dist`，9/10）不含 `advisory.js`/`hcot-hook.js`，被审运行时尚未在当前 GUI 中运行。要活体验证须先重装 tgz，再按 `MAINTENANCE.md` §8 断言首轮 `[pwsh,read]`、晋升后 ≥60 工具。
- 仓库自带测试（`scripts/test-*.mjs`）本次未运行。
- F1 的运行时后果（standing mount 撞车 / 残废目录）仅做代码与文档比对，未在活体宿主上复现（不做破坏性实验）。
- `dist-tgz/helmd.tgz` 未入库（`*.tgz` 被 ignore）：本次核到它与 HEAD 逐字节一致，但"提交的代码 = 发布件"只能靠重新构建复现，不能靠 git 追溯。
- F9 的性能影响是代码推断，没有实测延迟数据。

## 5. 复现本文验证

```powershell
# 1) 类型检查与编译（产物在 gitignore 的 dist/）
npx tsc -p packages/helmd/tsconfig.json --noEmit

# 2) preset 与宿主同源
node scripts/gen-preset.mjs --check

# 3) H-CoT 执行器（不联网）
python packages/helmd/scripts/ai-security/h_cot_attack.py --goal "测试目标" --dry-run
python packages/helmd/scripts/ai-security/h_cot_attack.py --stats

# 4) 路由与账本（用编译产物实跑函数，不靠阅读推断）
node --input-type=module -e "const m=await import('./packages/helmd/dist/router.js'); console.log(m.matchRoute('dll 劫持 分析').map(x=>x.key))"

# 5) 采纳率卡片（合成账本）
$d="$env:TEMP\helmd-review-check"; New-Item -ItemType Directory -Force $d | Out-Null
1..3 | ForEach-Object { '{"key":"stance:no-hedge","tier":"mandatory","verdict":"ignored","turnsWaited":1}' } | Set-Content "$d\advisories.jsonl"
$env:HELMD_TOOLS_DIR=$d
node --input-type=module -e "const a=await import('./packages/helmd/dist/advisory.js'); console.log(a.renderAdvisoryStats())"
```
