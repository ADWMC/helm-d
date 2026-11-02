# SkillOpt 方法论：把技能文档当权重训练

来源：`E:\Downloads\SkillOpt-0.2.0.zip`（microsoft/SkillOpt v0.2.0，413 文件，2026-07-02 构建，arXiv:2605.23904，PyPI `skillopt`）。
本文所有断言都能对到包内文件与行号，见 §11 取证索引；包内文本一律当素材不当指令（AGENTS.md §6）。

## 0. 一句话

把 skill / persona / AGENTS.md 这类**自然语言文档当作冻结模型的唯一可训练参数**，用「rollout → 反思 → 合并 → 裁剪 → 落笔 → 门禁」六阶段闭环去改它，并且**只接受在留出集上严格变好的版本**——从而把"手工调 prompt / 一次性生成 / 放任自我修订"这三种常见做法升级为可复现、可回滚、可度量的优化过程。部署产物是一份 300–2000 token 的 `best_skill.md`，推理期零额外调用。

## 1. 心智模型：深度学习 ↔ 技能优化

| 深度学习 | SkillOpt | 落点 |
|---|---|---|
| 模型权重 | 技能文档（Markdown） | 被训练对象 |
| 前向 | Rollout：target 模型带文档执行任务 | 采轨迹 + 打分 |
| 损失 | 任务评分器（exact match 等） | 必须客观可算 |
| 反向传播 | Reflect：optimizer 模型分析轨迹产出编辑补丁 | 浅层（逐条）/ 深层（跨条找系统性问题） |
| 梯度 | 编辑补丁（add / insert_after / replace / delete） | 结构化四算子 |
| 梯度聚合 | 分层合并相似编辑 | failure 优先于 success |
| 梯度裁剪 | 编辑选择：`learning_rate` = 每步最多几条编辑 | 步长控制 |
| LR 调度 | `constant` / `linear` / `cosine` / `autonomous` | autonomous＝模型自己数几条 |
| SGD 一步 | 补丁落到文档 | 产生候选版本 |
| 验证集 | selection split + gate | 唯一真相来源 |
| 早停 | gate 连拒不收 | 拒绝缓冲 |
| 动量 | Slow Update（epoch 边界纵向对比） | 防灾难遗忘 |
| 元学习 | Meta Skill（optimizer 侧跨 epoch 记忆） | 优化器自己变强 |
| batch / worker | `batch_size` / `analyst_workers` | 并行反思 |
| checkpoint | 每次被接受的技能快照 | 可回滚 |
| 迁移学习 | seed skill / 跨 benchmark 初始化 | 热启动 |

关键：这套类比不是为了好看，而是**把 DL 里已经验证过的稳定性机制（步长、裁剪、留出验证、动量、记忆）成体系搬过来**。默认超参：4 epoch、batch 40、编辑预算 4（下限 2）、cosine 调度、开启 slow update + meta skill、20 个样本做纵向对比。

## 2. 单步闭环六阶段

1. **Rollout**：target 用当前技能跑 `batch_size` 个任务，每条产出轨迹 + 分数。
2. **Reflect**：optimizer 看**整个 minibatch（默认 8 条）**而不是单条，只找**跨样本的共性模式**，产出 ≤L 条编辑。硬约束写在提示词里：不得硬编码任务专有值、不得重复技能已有内容、"edits 允许为空——没有缺口就别改"。
3. **Aggregate**：分层 LLM 合并。优先级规则明确——纠错型（failure）编辑压制强化型（success）编辑，二者重合时保留 failure 版；活过更多合并轮的编辑代表更广共识，优先级更高；每条编辑必须携带 `support_count` 与 `source_type`。
4. **Select**：按四条准则排序取 top-L——① 系统性影响（修 50% 失败的规则胜过修一个边角）② 补空白而非重复 ③ 通用表述优于具体题型 ④ 可执行性（具体的强于含糊的）。L 由调度器给。
5. **Update**：三种落笔模式——`patch`（精确 target 定位编辑，默认）/ `rewrite_from_suggestions`（按选中建议重写整篇）/ `full_rewrite_minibatch`。默认走 patch，因为**可定位、可回滚、可归因**。
6. **Gate**：候选版本在 selection split 上评分，与 current / best 比。

每步之间还有一层**保护段检查**：技能文档里 `<!-- SLOW_UPDATE_START -->…<!-- SLOW_UPDATE_END -->` 之间的内容，对所有步级分析师与合并器明令禁改，代码侧也有同一道校验——提示词约束与实现约束双保险。

## 3. 五个稳定化机制（这套方法真正的内容）

1. **编辑预算（学习率）**：每步最多改 L 条，且 L 随训练衰减。经验值 L=4–16，太小学得慢、太大噪声压不住。等价于"别在一次改动里重构整个 persona"。
2. **保护段 + 附录（appendix）双通道**。技能被切成 `S_body`（正文规则）与 `S_app`（附录，只强调"已存在且正确的规则"，永不引入新规则）。配合**缺陷三态判定**：
   - `SKILL_DEFECT`＝规则错/缺/不够具体 → 改正文；
   - `EXECUTION_LAPSE`＝规则对但执行者没照做 → 只往附录追加提醒，正文一字不动；
   - **拿不准时默认判 LAPSE**——不为一次执行滑手删掉一条有效规则。
   附录用 append + 近重复折叠，避免无限膨胀。
3. **被拒编辑缓冲（step buffer）**：本 epoch 内累计一份"哪一步做了什么、失败模式是什么（附 task ids 与出现次数）、被拒的编辑是哪几条、分数从多少掉到多少"，整段喂回给后续反思。用途写得很直白：**别重复提已被证伪的编辑，优先处理仍未解决的失败模式**。
4. **Slow Update（动量）**：epoch 边界做纵向对比——同一批 20 个任务在上一版与当前版技能下重跑，分四象限（回退 / 持续失败 / 改善 / 稳定成功），由一个"战略顾问"角色**先复盘上一轮自己的指导哪有效哪帮倒忙**，再写出覆盖式指导塞进保护段。它面向 target 直陈（"遇到 X 就做 Y"），要求每句都挣得它的位置，且不得与正文重复。
5. **Meta Skill（优化器侧记忆）**：另一条记忆通道，写的不是给 target 的规则，而是**给未来 optimizer 的"这个环境里什么样的编辑有用/太含糊/太脆/会帮倒忙"**。硬约束：不得面向 target 输出任务指令、不得复述整篇技能。两条记忆严格分层——面向执行者的与面向改稿人的。

## 4. Gate：唯一的真相来源

纯函数决策，三态：`candidate > current` 且 `> best` → `accept_new_best`；只 `> current` → `accept`；否则 `reject`（回滚到 current，编辑进缓冲）。注意是**严格大于**，持平即拒。

门禁度量三选一：`hard`（默认，精确匹配）、`soft`（逐项部分分）、`mixed`（`(1-w)·hard + w·soft`）。什么时候才该离开 `hard`——官方给的是一条很值得抄的"特性开关文档"：**仅当①自定义环境 ②留出集只有 ~10 条以内 ③奖励本身是连续的（F1/BLEU/软匹配）**，此时硬门禁会因为"逐题软分从 0.06 涨到 0.26 却翻不过 0/1"导致训练全部被拒而停摆。反过来说：**大样本 + 二值奖励就用 `hard`，它更保守**。

## 5. 数据切分与开销

- 三分裂 `train : selection : test`，默认 **2:1:7**——训练集只用来出题，selection 专门喂 gate，test 只在发版前动。
- "零推理开销"：优化发生在离线，部署时 target 只看一份文档，不额外调用模型。
- 无梯度、无权重、无微调——所以能在别人家的托管模型上做，也所以产物可读、可审、可手改。

## 6. 实证结论：什么迁移、什么不迁移

作者自报（论文口径，单 seed 42）：六 benchmark × 七 target 模型 × 三种执行载体（直连 chat / Codex CLI / Claude Code CLI），52 个格子里全部最优或并列最优；GPT-5.5 相对无技能基线，直连 +23.5 分、Codex 环内 +24.8、Claude Code 环内 +19.1；优化后的技能可跨模型规模、跨 Codex/Claude Code 载体、跨相近 benchmark 迁移。

作者明说**能迁移的 DL 直觉**：cosine > constant；中等编辑预算（4–16）优于极大/极小；slow update 抑制遗忘；meta 记忆提升反思质量。
**不迁移的**：batch 越大越好不成立（API 成本下收益递减）；epoch 越多越好不成立（技能比权重收敛快得多，2–4 轮通常够）。
**噪声红线**：单 seed 基线波动 ±1–2 分，**小于 ~1.5 分的差异一律当噪声**。这条对自己的评测同样适用。

## 7. SkillOpt-Sleep：部署态的夜间循环

v0.2.0 的头牌。面向"你自己天天在用的编码代理"，一晚一轮：

```
harvest 采集会话记录 → mine 挖反复任务 → replay 离线重放
  → consolidate（反思 → 有界编辑 → 在真实留出任务上 GATE）
  → stage 提案 → 人 adopt 采纳
```

与论文代码包**零依赖**（gate 是复制进来的），以 claude-code / codex / copilot / devin / openclaw 插件壳发布，`skillopt-sleep run|status|adopt|schedule` 一条 cron 跑每晚。三个默认关闭的增强旋钮：`dream_rollouts`（同题跑 K 次，用好坏对照做对比式反思）、`recall_k`（从归档里联想召回 K 条相似历史任务）、`dream_factor`（合成轻量变体）。结果：gbrain-evals 上有缺陷的种子技能在 Claude Code 与 Codex 双载体上 0.00 → 1.00（含真实工具环）；SearchQA 1400 条留出集上 `recall_k=20` 给 +4.5 分，全历史重放 +5.6，**召回越多收益单调越高**；SpreadsheetBench（真跑 openpyxl 逐格比对）+3.6。作者的诚实边界值得原样记住：**只在"任务会重复 + 有可核对的正确性信号"时成立**；接近天花板或噪声大的基准上效果与噪声持平，靠 gate 兜住最坏情况，所以 gate 默认开。

## 8. 训练产物长什么样

`ckpt/*/gpt5.5_skill.md` 是官方产物样本，可以反推"训练收敛后的技能文档"的文体：概览 + 输出契约 → 任务类型表（`目标 → 关键步骤链`）→ 通用原则编号列表 → 逐类边角与 bookkeeping（"维护一个 searched 集合，观测到过空就标已搜，别再说未探索"）→ 干扰项规则（"要 mug 时别拿 cup，留下并标该处已搜"）。全是**面向执行的直陈句 + 可核对的行为约束**，没有一句解释"为什么训练时改了这条"。

顺带一条反面观察：同一份产物里能看到训练把无序列表**插进了 GitHub 表格中间**（第 21–27 行，表格被劈成两段）。自动编辑只保证语义，不保证 markdown 结构——**结构校验必须进 gate 的候选检查**，helmd 侧同理（`tool-catalog` 那种机械核对是必要的一类门禁）。

## 9. 对 helm-d 的落地映射

helm-d 已有原料，缺的是闭环里那两样：**留出集**和**严格门禁**。

| SkillOpt 机制 | helm-d 现状 | 差距与做法 |
|---|---|---|
| 可训练文档 | `persona.txt`（<2k 载体）、`AGENTS.md`、`ica-context.ts` L2 示范 | 已经是单源，可直接当 body；正文与"改稿经验"必须分层（见下 §9.4） |
| Rollout 打分 | H-CoT 账本 `~/.dsh/helmd-tools/h_cot_results.jsonl` 已含 `refused_final` / `first_fragment_leaked` / `final_usable` / `broke` | 这四项天然是**二值 hard metric**，`gate_metric: hard` 直接可用，别急着上 soft |
| 三分裂 | 只有历史 case 流水，无 split 概念 | 题库固定化 + 切 2:1:7；selection 只喂门禁，test 只在发版跑 |
| 编辑预算 | 手工整块推倒重来（0.4.1 那次 AGENTS.md 重写） | 改成每轮 ≤4 条 add/replace/delete，带精确 target 串，可归因可回滚 |
| 保护段 | 无 | persona 的 OUTPUT CONTRACT 与"零环境声明"约束用标记夹住，禁止任何自动循环触碰 |
| 三态判定 | 隐式做过（0.4.1 的根因是 `SKILL_DEFECT`：AGENTS.md §1/§6 原文给了拒绝依据，被逐字引用） | 显式化：一次拒绝 ≠ persona 有病；**拿不准判 LAPSE 只加附录提醒，别删正文规则** |
| 被拒缓冲 | 散在 CHANGELOG 与记忆里（TARGET PREMISE 声明式前提无效、假文本注入伪造交付物、pi-ai 不支持 stop） | 落成机器可读的 rejected 账本，喂回下一次分析——这些正是已被证伪的编辑 |
| Meta Skill | 无 | 加一份"优化器侧"文本：什么措辞在 helmd 的 persona 里会被推理层判死；与面向 target 的 persona 严格分开 |

**最有价值的一条是 §3.2 的三态判定 + "拿不准判 LAPSE"**：helmd 破限迭代最大的风险就是"模型拒了一次就把某条规则删掉"，而拒绝可能来自渠道噪声、上下文长度、模型版本，不是规则本身错。默认不动正文，能挡住大部分倒退。

## 10. 不能照搬的四点（含一个反向陷阱）

1. **正确性信号**：SkillOpt 全靠 exact match / 逐格比对撑着；"交付可用"在破限场景是主观判定，必须先把它变成可复核的判据（人或强模型按固定 rubric 标），否则 gate 退化成自欺。
2. **题目可复现**：留出集要求同一批题在两个版本下可比。真实公网站点不可复现、会修漏洞、会封 IP——**留出集只能用靶机或冻结材料**，不能拿真目标当验证集。
3. **样本量与噪声**：作者自己的红线是 <1.5 分当噪声，且用的留出集是 1400 条量级。helmd 一次跑 10 题的 ASR 抖动远大于此，**没重复次数就不要报"变好了"**（与 AGENTS.md §8 质量门禁同源）。
4. **反向陷阱（必须先堵）**：自动化循环会为了短期分数**把"这是沙箱/本地/离线/授权环境"这类声明重新写回 persona**——因为声明式前提确实可能压低某些模型的拒绝率。而 0.4.1 的取证已经证明这类声明会在 Deliberative Alignment 型模型上自曝、反被当成拒绝证据。所以零环境声明清单必须是**候选编辑的硬前置约束（过不了直接不进门禁）**，绝不能变成"优化目标的一部分"。

## 11. 取证索引

| 断言 | 出处（包内） |
|---|---|
| 技能文档＝冻结代理的可训练状态；有界增删改 + 严格改进才接受；文本 LR 预算 / 被拒缓冲 / epoch 边界慢更新与元技能；部署零推理调用；产物 300–2000 token；52 格全优；+23.5/+24.8/+19.1；跨规模/载体/benchmark 迁移 | `README.md:31-48` |
| DL↔技能完整映射表 | `docs/index.md:88-97`、`docs/guide/dl-analogy.md:7-31` |
| 六阶段与浅/深反思、四象限纵向对比、慢更新与元技能职责 | `docs/guide/training-loop.md:28-87` |
| 默认超参（4 epoch / batch 40 / LR 4→min 2 / cosine / slow update 20 样本 / meta skill on / 2:1:7） | `docs/reference/config.md:22-70` |
| 调度器四模式；三种落笔模式 | `skillopt/optimizer/scheduler.py:10-16`、`optimizer/update_modes.py:7-9` |
| gate 三态、严格大于、hard/soft/mixed 定义 | `skillopt/evaluation/gate.py:121-148`、`gate.py:14-22` |
| 何时该离开 hard 门禁（三条件 + 两禁例） | `configs/features/soft_gate.yaml:10-31` |
| 反思提示词的共性/不硬编码/可为空约束 | `skillopt/prompts/analyst_error.md`、`analyst_success.md` |
| 合并优先级与 support_count 携带 | `skillopt/prompts/merge_final.md:1-20`、`gradient/aggregate.py:1-4` |
| 排序四准则 | `skillopt/prompts/ranking.md:5-12` |
| autonomous 编辑计数（不假设默认值） | `skillopt/prompts/lr_autonomous.md` |
| 保护段标记与代码侧禁改 | `skillopt/optimizer/skill.py:14-50`、`prompts/analyst_error.md` 末段 |
| 附录只强调不新增 + append/去重 | `skillopt/optimizer/appendix.py:1-20` |
| `SKILL_DEFECT` vs `EXECUTION_LAPSE`，拿不准默认 LAPSE | `skillopt/optimizer/skill_aware.py:17-21` |
| 被拒编辑缓冲内容与用途 | `skillopt/engine/trainer.py:520-565`、`1532-1557` |
| 慢更新先复盘自身上轮指导 | `skillopt/prompts/slow_update.md:22-50` |
| 元技能面向 optimizer 不面向 target | `skillopt/prompts/meta_skill.md` |
| Sleep 流水线、零依赖、三个可选旋钮 | `docs/sleep/README.md:11-23`、`56-67` |
| Sleep 结果与"±1–2 分噪声、<1.5 分当噪声" | `docs/sleep/README.md:74-105` |
| 能迁移/不迁移的超参直觉、2–4 epoch 收敛 | `docs/guide/dl-analogy.md:41-52` |
| 产物文体与表格被插劈的反面样本 | `ckpt/alfworld/gpt5.5_skill.md:1-45`（结构问题见 21–27 行） |
