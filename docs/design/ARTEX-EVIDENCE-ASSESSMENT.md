# ARTEX 的证据研判与 helm-d 的实现边界

研究基线：BaaRai/ARTEX `d235be850e9b34247ddb566686c47e6d4e4f0daf`（2026-11-23 拉取）。以下为源码中的实际行为，不把 README 的能力描述当作独立验证。

## 写入、验证与展示

1. `db/findings.go` 将人工分诊 `status` 与机器核对的 `verification_status` 分开，还保存 `poe_level`、`verification_note`、`counterevidence` 和 `confidence_rationale`。`db/finding_traffic.go` 将 HTTP 请求/响应按 baseline、proof、verification、supporting 角色绑定到 finding。
2. `agent/finding_workflow.go` 要求报告代理读执行记录、逐条核对候选流量，不能凭域名和时间关联流量；没有精确匹配时保留未绑定状态。绑定后读取证据版本再写报告，避免报告基于过期证据。
3. `server/finding_verification.go` 的 `assessFindingVerification` 在存在 proof/verification 流量、声明的 PoE 达 L3、引文足够长且能在解码后的响应正文中找到时才返回 `verified`；取证读取失败为 `not_assessed`。报告的证据版本变化由 `report/quality.go` 标记 stale。`web/src/app/(main)/function/findings/detail/page.tsx` 分别显示状态、验证说明、反证与置信度理由。

## 自主部分

`agent/planner.go` 根据探索图醒来、维护跨轮次待办，只派发满足前置条件的步骤；`agent/worker.go` 对单个 intent 执行工具并实时写回事实/漏洞；finding 写入会唤醒 planner。两层图及相应任务事件循环是 ARTEX 能自主覆盖新方向的基础。`agent/planner.go` 对否定性事实要求核对证据，并限制同方向重复复查一次；预算、停滞和最终收尾另有分支。它不是单靠一个“请自主分析”的 prompt。

## helm-d 当前接入

`record_finding` 增加可选 `confidence_rationale`、`proof_quotes`（每条指定 E 编号和原文）。写入时核对逐字包含；Case API 的 `/case/findings` 每次读取重查引用文件、哈希记录及引文。UI 同时显示模型/人工分诊状态、证据核对状态、判断理由、正反证据、复现命令和缺项。旧数据无引文显示“待核对”，证据丢失或改变显示“不匹配/已变化”。

这里的 `matched` 只意味着文本来源可核对，**不能证明漏洞可达、影响或复现成功**。现有 E 文件来自不同领域的工具，不全是 ARTEX 的 HTTP 响应；因此没有套用它的 PoE L3 门槛，也不把引文匹配提升为漏洞 `verified`。现有 `verified` 是分诊状态，旧 Case 的状态保持原值。要做到与 ARTEX 相当的自动漏洞验证，还需引入类型化请求/响应绑定、执行环境及基线/负对照、验证器按漏洞类别重放，以及证据版本与报告版本联动；没有这些输入不应显示“机器已验证漏洞”。

## 渗透自主流程重设计（2026-11-24）

额外核查：`agent/planner.go` 的提示词把工作拆为“读图 → 裁决目标 → 只派发未覆盖方向”，对运行中方向允许 0 新任务；`agent/worker.go` 的提示词约束 Worker 只做一个 intent，边做边写回，遇到新线索先交还 Planner；`agent/promptcatalog.go` 的单代理提示词强调不同机制路线、反证和已实测影响；`agent/wrapup.go` 区分“一轮规划结束”和“整个任务结束”。这些提示词在 ARTEX 里由 `server/engine.go` 的事件循环和 `agent/tools.go` 的 `prove_goal` 服务端拒绝门禁支持，不是光靠自然语言保证。

helm-d 目前没有 Planner/Worker 守护进程，因此只实施可验证的单会话闭环：从磁盘 Case 中读取 scope/资产/假设/结论 → 提议一个可达动作 → 执行工具 → 落 E 证据并更新假设 → 再次计算建议。`record_hypothesis` 允许最多 3 条开放的渗透路线并拒绝重复陈述；其他领域仍只允许一条。`record_finding` 的渗透默认状态是 candidate，避免单个响应或版本线索自动变成已验证漏洞。`case_status` 与工具后提醒共用相同的状态决策，候选漏洞优先复核，证据不足时给出诚实的收尾条件；playbook 和运行时 profile 同步要求基线、反证、前置条件及实际影响。

**已知界限**：这不是独立后台自治系统；没有自动派工、量化目标解析、漏洞重放验证或完整攻击面分母。`pentestRouteAdmission` 只拒绝文本归一化后完全相同的方向，不具备语义级去重；`assets.evidenceId` 只能表示资产是否关联过证据，不能证明所有漏洞类别已测。不能据此宣称达到了 ARTEX 的目标证明强度或持续自主性能。需要真实目标的重复运行基准，分别测任务完成、误报、重复动作、证据缺失和 token/时间成本。

分类与停滞修正：显式渗透意图可在缺 scope 时识别并拒绝网络侦察；单独的 `web/http/jwt` 不再触发渗透流程。仅有具体攻击方法而没有目标范围时，不猜测为活动渗透。三次完全相同的调用且无新证据时，下一步先记录阻塞并更换有根据的机制；已确认假设不再通过 finding 正文里是否出现 E 编号来“关联漏洞”，也不把资产已关联证据误作已测试覆盖率。UI 的 `verified` 仍是人工/模型分诊状态；显式传入 `status: verified` 可绕过 candidate 默认，**没有**机器可达性或影响验证。下一阶段应把结构化试验（目标、身份、基线、对照、输出与可重复性）作为有版本的验证输入，按漏洞类别定义独立验证器，再把可核对的结果映射到机器验证状态；在此之前不得用分诊状态宣称自动证明漏洞。

## 双领域自治边界

共用的只是 Case 存证、开放假设与防重复信号，以及每次工具调用后重新给出下一动作；逆向和渗透各有决策函数及 playbook。渗透以明确 scope、已观察资产、身份边界、对照与实际影响作为推进和验证依据。逆向以原样本身份、目标相关的地址/输入输出切片、保护或变换的可区分预测、独立语义验证与恢复产物的分级验收为依据；高熵或壳名不能决定何时动态、使用哪种解密器或声称脱壳完成。逆向的假设确认可能仅回答一个代码位置，不必强制产出漏洞 finding。两条路线都允许证据不足时记录精确阻塞并结束。`protection_route` 仍接收调用方提供的信号，未自动从 E 文件抽取并独立核验，因而这仍是有状态的模型建议而非已证明的自动逆向代理。

后续工具清洗：运行时不再注册 `protection_route` 等自写领域工具，保留 Case/路由/外部工具发现。外部 CLI 原始输出通过 `save_evidence` 导入，默认候选；导入内容和 `verified` 人工分诊都不能证明执行真实性。先前段落描述的是清洗前的实现，不能作为当前工具目录使用。
