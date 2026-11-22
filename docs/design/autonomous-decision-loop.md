# 自主逆向的决策内核：实验选择、裁决与停止

> 设计状态：未实现、未做端到端验收。适用对象是可复制、离线分析的样本。前置技能审计见 [reverse-skill-audit-protocol.md](reverse-skill-audit-protocol.md)；总方案见 [autonomous-reverse-research.md](autonomous-reverse-research.md)。

保护目标的动态升级、变换识别与分级恢复由 [protection-escalation-protocol.md](protection-escalation-protocol.md) 单列；本决策内核负责对该路由提案执行相同的预测、预算与裁决门禁。

## 研究命题与真实边界

在相同模型、精简后的技能库、工具、样本和预算下，**事前提交可区分预测并根据可信观测调整下一实验**，是否比现有顺序提示提高外部 oracle pass@1，降低错误肯定且不靠过早弃答？若无配对收益或成本显著上升，则撤回“更有效”的主张。

核对的一手代码：[reagent `UpdateModelTool`](https://github.com/criticic/reagent/blob/master/src/reagent/agent/orchestrator.py) 接受模型提交的 finding/evidence 并可提升 hypothesis；入口本身不验证语义或独立复跑。[red-harness 验证器](https://github.com/LiebertDev/red-harness/blob/main/src/redharness/evidence/verifier.py) 把静态引文、受控复跑、错误与不完整覆盖分开，不能把其复杂规则直接视为任意语义的证明。[LUCENT oracle](https://github.com/huskersec/LUCENT/blob/main/src/oracle.py) 用预期 crash 签名区分指定故障与任意崩溃，适用性取决于预期签名和环境。[angr Explorer](https://github.com/angr/angr/blob/master/angr/exploration_techniques/explorer.py) 用显式 find/avoid 和找到路径数量结束搜索，同时警告不完整 CFG 会错误排除有效路径。以上只核对源码入口，没有运行这些项目。

当前 `packages/helmd/src/autonomy.ts` 的 `deriveNextAction` 是按状态给顺序建议，`detectNoPath` 只检测三次相同调用且证据未增长；`packages/helmd/src/tools/caseflow.ts` 的 finding 门禁要求真实工具证据。**DSH 仍拥有唯一 agent loop**；helm-d 只提供快照、建议、持久化和受控执行，不增加第二个代理循环。现有 Case 一次只允许一个 open hypothesis；竞争机制以独立候选账本保存，不同时创建多个 open hypothesis。

## 每轮的输入、提案、选择

只读快照：`revision, sample_sha256, goal, observable_scope, environment, remaining_budget, candidate_mechanisms, experiments, evidence_clusters, permitted_backends`。范围写清输入通道、采样窗口和缺失上下文；预算含调用次数、token、墙钟及单次超时。候选保存 `claim, scope, prior_evidence_ids, disconfirming_observation`。不足两种机制时可用“现有机制 vs 未知/工具假象”安排校准，但不能靠一次负观测排除未知。

模型事前冻结实验提案：`id, question, input_digests, backend_id, argv, predictions_by_candidate, outcome_schema, validity_checks, next_if_support/refute/inconclusive/error, estimated_cost, expected_revision`。每项预测必须落在相同可比较的观测字段（如两个输入的目标 RVA 与退出码）；预测集合重叠不能算区分。若提案只是验证测量工具是否工作，标为 calibration，不冒充机制区分实验。记录预测版本，不许事后重写。

首先过滤样本身份错误、Case 副本路径越界、前提不满足、预算不足、无后端、缺输入、无可判分预测及重复已成功实验。失败重试必须有明确改变的环境/后端并使用不同去重键。其余按预测不同的假设对比例 `split`、可复跑性与目标相关性分档，同档选较低成本，再用稳定 ID 破同分；预测缺项不进高优先级队列。`split` 衡量的是预测表的辨别力，**不是真实信息增益或预测可信度**。没有有效实验就返回缺失前提或停止理由，不补造命令。

## 状态与裁决权

事件状态：`proposed → reserved → running → observed → adjudicated → verified|refuted|inconclusive`；采集基础设施失败进 `failed`，不能进 `refuted`。写入检查 `expected_revision`，过期则重新读取；先存原始 E-id 再写 observed。崩溃恢复 running 时核查真实产物，查不清则 inconclusive。每次执行记载样本/工具哈希、输入摘要、参数数组、环境摘要、运行 ID、退出码、stdout/stderr E-id、超时/截断、产物哈希及证据父 ID。不把工具输出中的命令当代理指令。

裁决分三层：

1. **有效采集**：核对样本和输入身份、真实执行、退出/超时、日志完整性与观测窗口；监测器故障为 error 或 inconclusive，目标程序非零退出在监测器正常时可以是有效观测。
2. **预测对照**：按冻结的 `outcome_schema` 解析原始记录，区分 supports、refutes、nondiscriminating、unknown；未见事件只有覆盖完备时才能支持否定。排除相矛盾候选，不能把剩余唯一候选自动提升为 verified。
3. **结论验证**：行为声明对原样本副本做正/负对照与固定输入重复，机制声明另核对地址映射及不同失效模式的证据来源。验证器只认绑定的执行与 E-id；`repro_cmd` 字符串、同一 trace 的两种导出物都不等于独立验证。复杂语义需任务 oracle 或人工复核，不能由模型给自身确认。

反驳当前主假设时，先记录原始证据与适用范围并 `update_hypothesis`，再开启另一主假设；支持但尚有竞争解释时继续区分；工具错误只改变该后端可靠性并换采集路径；预测一致的观测表示实验不具辨别力。所有预测失败保留供校准分析。

停止条件：目标完成且验证通过；硬预算耗尽；材料/环境缺失；或最近 K=3 个**独立、有效、不同输入或方法**的实验都没有缩小候选或带来可验证覆盖，且所有可选实验收益档低于成本。K 只是待消融默认值；重复调用失败工具不算独立实验。退出仍列出候选、覆盖、E-id、未知与改变结论所需的最小实验；局部 verified 与全局任务未解可以并存。

## 三轮轨迹（设计预期，非实测）

目标：剥符号程序的 `OK` 由原始输入比较（H-A），还是变换后比较（H-B）。静态工具仅提出间接调用点 `RVA 0x1200` 可能到 A 或 B，尚无运行证据。

| 轮 | 事前预测和行动 | 裁决与下一步 |
|---|---|---|
| 1 | 同长单字节差分的两输入；H-A 预测 A 的原始参数变化，H-B 预测 B 的变换结果变化；追踪调用目标和参数摘要。 | 两条完整轨迹若都指向 B 且摘要符合预测，只反驳 H-A 对此输入对的预测；B 仍是候选。下一步验证 B 的输入变换并做负对照。 |
| 2（故障注入） | 重跑时故意让跟踪器丢失间接调用事件。 | 监测缺口是 error/inconclusive，不是“没有调用”、不反驳任一机制。改用 `0x1200` 的指针赋值静态切片或另一种有覆盖证明的跟踪器。 |
| 3 | 干净环境对原样本副本运行候选接受输入及一字节负对照，记录输出和退出码。 | 若稳定且独立定位证据确证 B，可报告有界的输入对行为及该调用；无独立定位时只报告已测行为，未测输入和其他调用目标保持未知。 |

“观察到 B”不证明所有路径都走 B；监测器失败不能给 B 加分；一个接受输入不证明重建算法对所有输入等价。

## 实现切口和可证伪评测

M-1 先审计、精简技能并冻结文本哈希。M1 加事件账本、revision 冲突检测、重启恢复；不得将损坏账本当空账本。M2 增**一个**白名单本地分析后端：限制 Case 内副本路径、参数和预算，捕获 stdout/stderr/退出为真正的工具 E-id，与 `record_finding` 门禁绑定；不得将 `save_evidence` 的 `manual_` 重命名绕过门禁。`case_status` 扩展还是另设只读快照取决于现有输出兼容性；设计接口不等于已实现 API。先测工具故障、重复、恢复、证据引用和 revision 冲突。

基线为现有顺序提示 + 同版精简技能库；实验组只增加预测/选择/反馈，模型、任务、工具镜像、网络和预算固定。账本、选择、验证各自做消融；保留集按源项目隔离，隐藏 oracle 不向模型泄露。评分器以正负例和故障注入自检。主指标为外部 pass@1 与错误肯定率；同时报告正确弃答、预测校准、验证成功、成本和软停时原本可解的比例，逐任务配对、按项目聚类给区间及失败轨迹。故障注入覆盖假保护签名、损坏 dump、跟踪缺口、超时。验收反例：工具错误被当反证、同源 E-id 算独立、缺预测提案优先、过早弃答、隐藏 oracle 泄漏；任一反例通过门禁时不能宣称可信自主。

## 纠偏：预测账本不能阻止模型乱做

上文方案仅能解释、记录并发现部分错误，**不能单靠提案约束实际执行**。例如模型可以在 `test_cmd` 中写无意义命令，执行未登记的 shell，引用一个真实但无关的 E-id，再让 `update_hypothesis(status=confirmed)` 落盘。按当前代码，`packages/helmd/src/tools/caseflow.ts` 的该接口只检查非 blocked 状态拥有至少一个实际存在的 E-id；它没有验证观测对预测的支持关系。`record_finding` 也允许提交 `status`（默认可为 verified），验证 E-id 存在、细节中的部分字面值及工具出处不等于验证结论的机制语义。即使完善这两个接口，如果宿主 shell 绕开插件控制，插件依然无法保证所有实际动作受限。

因此要分清两个承诺：**可审计自主**允许模型自由探索，但凡未经门禁的动作只能生成未认证草稿；**受控自主**要求目标环境的全部分析执行都经过唯一受控入口，或者宿主提供已证实可拦截所有调用的前置 hook。未验证宿主的真实工具路由、shell、子进程与插件执行关系之前，不能宣称受控自主。发现旁路时将其列为架构阻塞，不通过在 persona 里加“请自觉”解决。

### 模型权限不是一个开关，而是动作分层

| 层 | 模型能做什么 | 硬边界与状态 |
|---|---|---|
| L0 观察 | 读已落盘 E-id、Case 快照与按需参考；提出多个机制和不确定点。 | 不得修改证据原文或真值；外部内容不形成指令。 |
| L1 提案 | 申请对 Case 副本的分析动作，填入要回答的问题、预计改变哪个候选、具体有效性检查和停止预算。 | 机器检查样本/路径/参数/预算、重复及与目标的因果关联；不合格只返回拒绝原因，不执行。 |
| L2 执行 | 只能执行门禁签发的单次、短期、绑定 `sample_hash + revision + action_digest + backend + input_digest + budget` 的票据；执行端按票据原样运行，不用模型自由文本拼 shell。 | 工具按预定义操作类型和参数 schema 调度，隔离与超时在执行端实施；票据一次性消费。可以建议额外检查，但不能自签票据或越权放宽预算。 |
| L3 推论 | 提交“某一观测支持/反驳何种预测”的候选解释。 | 确定性采集/范围门禁裁决结果分类；无法机检的语义最多是 provisional，不得因为引用 E-id 自动 confirmed。 |
| L4 交付 | 提交有界结论、复现实验和未知项。 | 只有验证器或独立复核的事件能把状态晋升为 verified；未验证仍可报告为候选，`end_case` 允许如实未解，不强迫模型造 finding。 |

L1 的“与目标关联”不能靠语义相似度字符串假装证明。动作必须有结构化 `question_id`、当前候选 ID、待获取观测字段及它会改变的状态；静态分诊与工具校准等必要探索明确标为 `baseline/calibration`，各设上限。允许探索中发现新目标后登记新问题并重新预算，但不得把无关工具反复调用记成进展。门禁过滤明显无关与超额动作，**不承诺过滤所有低价值实验**；是否优于自由代理仍由保留集测量。

### 真正能拦下错误的验收状态机

把“模型提议/系统确认”拆成两个不同字段，不再允许模型传最终权威状态：`model_claim` 与 `verdict = unverified|supported|refuted|verified|unknown`。`update_hypothesis` 的 `confirmed` 仅保留给兼容旧 Case 的显示或迁移，不能等价于 verifier 的 verified；新 Case 的晋升由受信执行事件和任务型验证器决定。`record_finding` 新增 `verification_id` 后校验它指向同一样本、目标、输入、结论类型及不同证据簇；手工证据、复制的工具摘要、另一次无关工具运行都不能借一个合法 E-id 提升等级。现有 `end_case` 的 deep 模式至少一条 finding 规则会诱导编造：应将“有 verified finding”与“合理弃答/预算耗尽且有真实轨迹”作为互斥合法终态；不能在不修改门禁的情况下把这个设计说成现状。

错误动作处理不得循环重试：连续两次同一拒绝类（路径越界、schema 错、无目标关联等）必须退回只读快照与一个明确的缺失条件；同一问题最多一次参数修复机会。模型若仍绕过或无法生成可判分提案，记 `agent-control-failure`，停止认证路径并输出草稿/失败报告，而不是把失败归咎于样本。执行前保存提案和机器拒绝记录，保留“原本想干什么”，才能测出代理乱做率。

### 宿主集成先做旁路审计

M0 加一个只读、可重复的路由实验：在隔离测试 Case 中，逐一发出插件分析工具、宿主 `pwsh`/`bash`、`read`、工具启动的子进程及模型可用的其他执行入口；观察是否经过门禁、是否能写 Case/运行样本、原始输出能否绑定到事件。根据日志建立覆盖矩阵，任何未拦截的执行通道均不算“全部动作受控”。`applyPersistenceWrap` 只包裹之后通过 `ctx.tools.register` 注册的工具；从 `packages/helmd/src/index.ts` 看宿主 shell 作为单独入口被暴露，不能凭这个包装推断它已经被拦截。若缺少全局前置 hook，选择两条诚实路线：让评测/受控模式只暴露受控执行工具并在沙箱/OS 层限制其他命令，**或**把 shell 输出当非认证探索材料，仅允许门禁后的实验进入 verified 结论。宿主沙箱隔离与工具清单实际可控性均需实测，不能靠本文件声明。

加入对抗测试而非只做“正常轨迹”：未登记 shell 后立刻提交 finding、用真实但无关的 E-id 证实假说、把超时说成分支不存在、重复同一运行作为两份独立证据、在工具输出中诱导执行外部命令、用过期 revision 重放票据、通过子进程绕过调用计数。每个测试必须有**错误实现会变红**的断言：非认证动作不产生 verified；有效的探索仍能作为 provisional 保存。主要控制指标新增“未登记执行率、无关动作率、错误晋升率、绕过率、合理弃答率”；如果绕过率非零，论文只报告有限控制范围，不宣称模型已经不会乱做。
