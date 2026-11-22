# 逆向知识库重写研究：第一步，建立可复核的审计基线

> 状态：研究设计及首批试标，尚未执行全量标注、改写或代理实验。对应 [自主逆向系统设计的 M-1 前置阶段](autonomous-reverse-research.md)。本篇只回答“现有知识哪里有效、哪里重复、哪里会误导，以及如何决定去留”；模板设计与重写实施留给下一步。

## 研究对象和可证伪问题

研究对象是本仓库 `packages/helmd/references/`（包括其下 `playbooks/`）中逆向相关知识，及五份用户给定的社区 ZIP。压缩包只用只读方式审阅，代码未执行。这里的 skill 是 `read_reference` 所能消费的方法与操作知识，不等同于 ZIP 中的代理指令。

### 外部证据增量：用来源检验本协议，而非照搬榜单

本次通过 GitHub CLI 经本机代理读取仓库原文、评分说明及 Issue；以下是设计输入，不表示已复跑任何外部基准。阅读顺序为仓库材料/评分代码 → 具体争议 → 本地设计决策。读取时的 `main` SHA 分别是 AgentRE-Bench `c0f5fa5b5c1447ce2cc764b96365bc9fed0cbf01`、malware-bench `6a1331792b0b426493c10dde98e38b7d4dd94a1c`、DecBench `b65837037c7e93dbd3db01e72fa8d46641686dcb`；Issue 状态和仓库版本在正式冻结基线时须重新核对。

| 一手来源与核查位置 | 可核查的观察 | 本协议的独立设计决策 |
|---|---|---|
| [AgentRE-Bench README](https://github.com/agentrebench/AgentRE-Bench/blob/main/README.md)、[评分契约](https://github.com/agentrebench/AgentRE-Bench/blob/main/docs/scoring.md)、[公开评分器](https://github.com/agentrebench/AgentRE-Bench/blob/main/scorer.py) | README 描述固定工具调用预算、结构化答案、ELF/PE 和 stripped 对照；评分说明注明其 2026-11 的当前评分器与完整审核材料并未全部随公开展示代码发布。 | 借用“固定预算+分层任务+保存逐次答案”的实验约束，但为技能重写另定义首步、路由、错误肯定与失败恢复，不能直接把该榜单分数当成技能质量。评分器必须和声明的版本、输入快照绑定。 |
| [AgentRE-Bench Issue #22](https://github.com/agentrebench/AgentRE-Bench/issues/22)、[Issue #20](https://github.com/agentrebench/AgentRE-Bench/issues/20) | #22 报告公开旧评分器在特定合并标签输入下可给 PE 技术项满分；#20 用字节与运行路径分析质疑某一真值字段是否能从交付二进制推出。均为截至阅读时的开放报告，本次未独立复现；前述评分说明亦明确公开代码不等于当前完整评分实现。 | 增加评分器对抗性测试（堆砌所有标签、互相矛盾结论、无证据猜测），并在任务上线前做二进制→真值的独立复现审计；有争议的任务隔离，不能以其分数决定保留/删除知识。 |
| [malware-bench README](https://github.com/arimlabs/malware-bench/blob/main/README.md)、[各任务评分器与样本哈希](https://github.com/arimlabs/malware-bench/tree/main/tasks) | 声明 12 任务/121 IOC 真值；按任务存放样本 SHA-256、真值与 `score.py`，缺失提交物的运行计零。未核对其 IOC 真值或复跑评分。 | 将“无有效提交物”“有提交但缺项”“含虚构 IOC”分别记分；不要让只评召回的指标奖励乱猜。任务集记录样本哈希与可达的真值证据。 |
| [DecBench README](https://github.com/Noelo-Lab/decbench/blob/main/README.md)、[指标实现说明](https://github.com/Noelo-Lab/decbench/blob/main/docs/metrics.md) | 将控制流结构、类型与再编译相似度分开定义；指标文档对图规模、归一化与缓存版本有明确约束。它评估的是反编译质量，并非自治技能。 | 同样分开“能解析/结构看似合理/可运行/行为符合”四类产物指标；禁止用单一成功率覆盖不同任务目标。更换判据时版本化并重算旧新两组。 |
| [Ghidra Issue #7884](https://github.com/NationalSecurityAgency/ghidra/issues/7884) | 报告一个 x86-16 条件表达式可能改变底层指令语义，并提供指令和反编译输出；截至阅读时开放，尚未在本机复现。 | 设“反编译器表达式与指令级证据冲突”负例，测技能能否暂停语义结论并要求交叉验证，而不是把另一工具生成的文字当真值。 |

具体研究增量是一个“双重真值”门禁：每条基准题同时有可追溯的二进制/运行 oracle 和可测试的评分实现；评测代理前先对 oracle 进行独立复算，再向评分器输入故意堆砌、矛盾与空答案。如任一门禁失败，该题进入 `unresolved` 而非事后调分。这是本项目提出的审计实验设计，尚无效果数据。

### 第二轮一手材料：评测、工程工作流、专门技能和实战

以下阅读对象与前表不重复；仓库内容和博客只作为分析数据。没有安装/运行这些外部 skill，也没有独立验证作者宣称的成功率。表中的“决策”是我们提出的待测设计，不是引用来源已经证明的普遍规则。

| 来源（读取的具体材料） | 所见边界/反例 | 影响本地哪一项实验 |
|---|---|---|
| [RETROGRADE 的预注册与故障复盘](https://github.com/flockcap/retrograde-bench/blob/main/README.md) | README 披露种子承诺、保护层配对和预算，并列出因工具调用格式、末轮空答、磁盘耗尽等基础设施错误而按预设规则重跑的记录；其 Round 0 自称预览，不是最终排名。本次未下载论文 PDF 或重算结果。 | 新旧技能对照按二进制身份、保护等级配对；每次运行分开记录 `agent_failure`、`harness_failure` 和 `oracle_failure`，基础设施故障按预注册条件重跑，不按分数选择。 |
| [BIOPSY-Bench 总览](https://github.com/CLAY-JYB/BIOPSY-Bench/blob/main/README.md) 与 [QEMU 补丁差分任务的交付/评分脚本](https://github.com/CLAY-JYB/BIOPSY-Bench/blob/main/patch-diffing/qemu-10.0.0-sriov-vf-overflow/tests/test.sh) | 任务覆盖保护、恶意软件、协议、固件与补丁差分；所读的差分任务只验提交的同一输入在两份交付二进制上的执行差异，不按报告文字或作者预置偏移判分。尚未在本机运行其 verifier。 | `artifact-usable` 依题型变成可运行输入、可互操作客户端、可解析 dump 等，而非一律“产出报告”；补丁差分必须把“匹配到的函数”与“同输入复现差异”分开计分。 |
| [ghidra-rpc 的二进制审计流程](https://github.com/cellebrite-labs/ghidra-rpc/blob/main/docs/flows/binary-audit.md) 与 [版本差分流程](https://github.com/cellebrite-labs/ghidra-rpc/blob/main/docs/flows/patch-analysis.md) | 文档提供可分页函数清单、跨版本候选匹配和反编译差分；重命名会传播到调用者，持久工程项目会保存改名/注释。文档所举“先反编译 main”仅适用于存在合适入口的情形，非所有加壳目标的通用首步。 | `journey` 除读文档路径还记工程数据库突变；原始分析与推断性命名分开存证，在“函数匹配错误”和“错误命名传播”案例上测试。 |
| [parsimony-re 技能](https://github.com/Azizfois2/parsimony-re/blob/main/README.md) 与 [五臂评测设计](https://github.com/Azizfois2/parsimony-re/blob/main/bench/README.md) | 区分廉价分诊与昂贵升级、记录证据和升级门禁；作者明确说明未在真实目标上完成基准，其答案 key 仍为占位，文字约束对 MCP 调用也不能强制执行。 | 在既有旧/新成对实验之外，给同一精简库加/不加升级判据做独立消融，并固定可用工具集合；分别计漏升级与无谓升级，不把“省 token”视为正确性的充分证据。 |
| [REx@Skill 正文](https://github.com/tihanyin/REx-skill/blob/main/claude-skill/skills/reverse-engineering/SKILL.md) | 将漏洞证据拆为入口、危险操作、保护条件和受影响主体，区分 probable 与 confirmed；公开正文也有大量工具/脚本依赖和平台约束。本次没有核实其声称的跨目标成绩。 | 当任务是漏洞研判时加入 `source/sink/guard/principal` 核对项；对于普通脱壳/定位任务不强加漏洞模板，测试“目标错配但看似详细”的负例。 |
| [MobileRE-Skill 的 DEX 内存快照卡](https://github.com/index-login/MobileRE-Skill/blob/main/.kilo/skill/dex-mem-dump/SKILL.md) | 明确分开 DEX 骨架、方法体回填和 Android native SO，且列出设备/root 等前提；同一页面包含命中后可直接判定“正常输出”等较强措辞，未见独立样本验证。 | 给 `output-kind` 增加“DEX 骨架/方法体可用”，加入“文件头可读但方法体缺失”的反例；预检依赖不足时正确停机，不从单条扫描日志升级为有效载荷确认。 |
| [capa 官方限制](https://github.com/mandiant/capa/blob/master/doc/limitations.md) | 官方明确告知加壳/混淆与安装器可能导致误导或结果不全，还说明 wrapper/子函数匹配的边界。 | 知识主张标注 `tool_status` 之外另记 `tool_limitation`；用“无命中但存在隐藏行为”和“子函数匹配不传递”的任务测错误否定结论。 |
| [OALabs 的 Emotet 栈字符串实战](https://research.openanalysis.net/emotet/emulation/config/dumpulator/malware/2022/05/19/emotet_x64_emulation.html) 与 [GuLoader VEH 实战](https://research.openanalysis.net/guloader/emulation/dumpulator/veh/exceptions/2023/01/15/dumpulator-veh.html) | 前者记录 packed/unpacked 哈希、minidump 中调用解码函数的具体地址和输出；后者给出异常处理驱动控制流与样本哈希。固定地址和路径均是个案，未在本机复算。 | 抽取“从静态结构提出局部模拟假设 → 在具体快照中调用 → 对照实际输出”的方法链；地址/解码常量留案例，不作为通用触发；局部模拟不等于原进程整条路径成立。 |

### 第三轮：从混淆器实现与社区故障反推分诊判据

此轮关注变换的**攻击面**而非产品名。源码/官方文档用于说明“变换声称做什么”，Issues 是具体报告和维护者回应，论坛评论是个人判断；三者证据等级不同。没有编译、运行保护器或在真实样本上复现其声称效果。

| 防护侧材料与社区核对点 | 观察/不确定项 | 本项目提出的分流或反例 |
|---|---|---|
| [OLLVM Flattening.cpp](https://github.com/obfuscator-llvm/obfuscator/blob/llvm-4.0/lib/Transforms/Obfuscation/Flattening.cpp)、[BogusControlFlow.cpp](https://github.com/obfuscator-llvm/obfuscator/blob/llvm-4.0/lib/Transforms/Obfuscation/BogusControlFlow.cpp) | 前者建立 `switchVar`、loop/switch 调度；后者有不透明谓词和基本块克隆。静态样式可提供候选，但不保证是该保护器，更不保证所有分支可删。 | 记录状态变量定义与转移/实际执行路径，再做 CFG 归约；用“正常业务分派”做假阳性对照，以真实到达路径或语义等价检验删块结果。 |
| [OLLVM Issue #179](https://github.com/obfuscator-llvm/obfuscator/issues/179) | 报告入口块后继与 `origBB` 首元素不一致时，flatten 可能改变控制流，给了示例和建议修正；截至阅读为 open，未复现。 | 再加“保护器错误改写”假设：若原始/保护后可控程序行为不同，先判变换正确性而不是把崩溃一概归因于反调试或环境。 |
| [Tigress 官方变换分类](https://tigress.wtf/transformations.html) 与 [Anti Analysis](https://tigress.wtf/antiAnalysis-transforms.html) | 官方把 Virtualize/Jit/JitDynamic、Flatten、Opaque、编码外部调用、自修改、完整性检测、干扰静态别名及动态污点分析列成不同变换；分类是功能声明，不等于每个具体构建均有效。 | 入口由“当前问题受阻在哪条观察通道”分流：CFG/数据流/运行时状态/外部 API/执行监控；污点链断裂时不要由“无传播”推出“无依赖”，先换观测方法。 |
| [Amice README](https://github.com/fuqiuluo/amice/blob/main/README.md)、[Issue #83](https://github.com/fuqiuluo/amice/issues/83) 及维护者回复 | README 声称可组合字符串、间接调用、CFG、MBA、VMP；#83 报告 `function_wrapper + indirect_call` 组合在 Android arm64 破坏 `std::string` 路径，维护者称原因是调用约定属性（含 sret）未保留并于 v0.1.5-beta.2 修复。本次未复跑。 | 保护器名称不足以定策略：记录版本、pass 组合与顺序、ABI；错误路径构造“未保护 / 单 pass / 组合 pass”矩阵，区分语义回归与反分析。 |
| [FDartVMP 的 Flutter 迁移设计](https://github.com/haothtrteen/FDartVMP/blob/main/README.md)、[covirt 的 marker/平台边界](https://github.com/dmaivel/covirt/blob/main/README.md) | 前者声称把敏感 Dart 逻辑变为加密字节码，经 FFI 调入 native 解释器；后者在 ELF/PE 上选择局部函数区间做栈 VM 转换，明确 PE 仅在 MinGW-w64 构建物测试。没有运行两者。 | “保护”可能是跨格式/跨语言迁移或局部 VM，而不是整文件加壳；任务必须先定位业务入口 → 解释器/字节码 → 调用与结果边界，记录未保护部分作为对照；不能把 `libapp.so` 与普通 JNI `.so` 混同。 |
| [M/o/Vfuscator 官方说明](https://github.com/Battelle/movfuscator/blob/master/README.md)、[javascript-obfuscator 的能力说明](https://github.com/javascript-obfuscator/javascript-obfuscator/blob/master/README.md) | 前者声称用 `mov` 表达运算和控制流；后者把开源 JS 级平坦化/字符串数组与商业 VM 级保护分开说明。README 的强防护和抗模型表述未经本次验证。 | 把“可见跳转少”和“没看到业务源码”当成**表示变化**的候选，不当成行为消失；不同实现级别分别设逆向目标及可执行 oracle。 |
| [javascript-obfuscator Issue #1423](https://github.com/javascript-obfuscator/javascript-obfuscator/issues/1423) 与维护者回复、[Issue #1408](https://github.com/javascript-obfuscator/javascript-obfuscator/issues/1408) | #1423 的报告者在讨论中多次修正归因：由 pass 交互改为单独的 CFG 平坦化；维护者表示修复已在 5.4.5 发布。#1408 提供了种子相关的 optional-call 问题并由维护者称 5.4.3 修复。不能仅以 closed 判定本机版本无问题。 | 记录随机 seed/版本/输入构建链，对同源产物多 seed 差分；优先复现最小因果矩阵。审计 claim 时要求“崩溃=反调试”的强断言给出保护前后/版本对照。 |
| [HN 逆向讨论中的工程师评论](https://news.ycombinator.com/item?id=38531706) | 评论者区分可模式化的静态变换与 VM/JIT 的困难；这是个人判断，不是实验结论或普适难度排名。直接访问看雪关联帖得到 504，本轮不引用其内容。 | 只把该评论转为“静态可见 vs 运行时生成”的对照题；失败应标注观测通道和样本条件，不写成“VM/JIT 已不可逆”。 |

新增实验问题 Q6：在有限预算内，按**受阻的观测通道**而不是已猜测的产品名路由，能否减少假阳性分类且增加跨层目标定位？配对任务包括普通分派器/OLLVM 式平坦化、JIT/运行时生成代码、局部 VM/普通解释器、DEX 骨架/native FFI 逻辑、完整性失败/保护器自身语义回归。答案由可复算的输入输出、静态结构和动态路径共同核验；生产代码的 pass 组合和随机种子单独保留，禁止一条签名直接盖章。

### 指定社区项目：reverse-skill v1.0.1 的路由、Case 审查与方法内容

用户指定的 [Release](https://github.com/zhaoxuya520/reverse-skill/releases/tag/v1.0.1) 是源码发布，GitHub API 返回 `assets: []`；注释 tag 指向 commit `9c28c6ca1062a1a076e28baf40f241dbb4cf5dc2`，与阅读时 main `b972ad0e90f26d8f044828f004da22a4a585da12` 不同。以下只审 release tag 源码，未安装/执行，不能把 main README 的“44 条路由/221 例”当作该 release 的成绩。

| 核查位置 | 可验证的内容及限制 | 对 helm-d 的裁决候选 |
|---|---|---|
| [routing.json](https://github.com/zhaoxuya520/reverse-skill/blob/v1.0.1/skills/config/routing.json)、[路由用例](https://github.com/zhaoxuya520/reverse-skill/blob/v1.0.1/skills/tests/routing-benchmark.json)、[测试器](https://github.com/zhaoxuya520/reverse-skill/blob/v1.0.1/skills/scripts/test-routing.ps1) | 配置有 41 条路线，用例有 163 个 `hint → expect`，脚本检查选中的 PRIMARY 是否等于预期；本次未运行测试器。Release 声称 `163/163`，不等于“逆向成功 163 次”。 | `merge` 方法：为本项目 `route_task` 加中英、混合对象、易混缩写及否定词的固定路由样本；同时做真实 `read_reference` 可达检查。不要移植其全部路线或把关键词命中当保护类型识别。 |
| [MASTER-ROUTING](https://github.com/zhaoxuya520/reverse-skill/blob/v1.0.1/skills/MASTER-ROUTING.md)、[路由实现](https://github.com/zhaoxuya520/reverse-skill/blob/v1.0.1/skills/scripts/master-route.ps1) | 结构化配置单源，关键词命中计数，按优先级打平；默认导航要求打开相应 skill。单一 PRIMARY 对同时含 APK/native SO 或多阶段问题的表达能力需另评。 | `repair` 本地路由设计：在任务集中加入双对象及跨层目标，测 primary 与后续专门参考能否正确交接；不要机械复制它的匹配优先级。 |
| [Case Review](https://github.com/zhaoxuya520/reverse-skill/blob/v1.0.1/skills/case-review/SKILL.md)、[脚本](https://github.com/zhaoxuya520/reverse-skill/blob/v1.0.1/skills/case-review/scripts/review_case.py)、[八项测试](https://github.com/zhaoxuya520/reverse-skill/blob/v1.0.1/skills/case-review/tests/test_review_case.py) | 检查证据 ID 引用、workitem/timeline、可选文件 SHA-256、低置信却标 validated 等结构问题；它无法从一个有效哈希判断“Hook 100% 可靠”或漏洞调用链是否成立。 | `merge` 检查思想：把 Case 结构完整性作为独立静态门禁；技术真实性仍由二进制证据/独立消费/正负对照检查。暂不移植脚本及 case 格式。 |
| [Ghidra 模块](https://github.com/zhaoxuya520/reverse-skill/blob/v1.0.1/skills/ghidra-reverse/SKILL.md)、[binary-diff 模块](https://github.com/zhaoxuya520/reverse-skill/blob/v1.0.1/skills/binary-diff/SKILL.md)、[RE 工作流](https://github.com/zhaoxuya520/reverse-skill/blob/v1.0.1/skills/reverse-engineering/references/re-agent-workflow.md) | Ghidra 卡有工具路径预检、静态→动态交接，但默认“导入→反编译”不适用于所有保护目标；binary-diff 的“200 函数约 1 元、准确率高”未见对应基准；工作流中的 5–15 分钟分诊是建议值。 | `retain` 对象/工具可用性与交接字段；`unresolved` 成本和准确率宣传；对壳/虚拟化目标把先决条件写清，不能把粗工作流升格为强制顺序。 |
| [reverse-engineering 模块](https://github.com/zhaoxuya520/reverse-skill/blob/v1.0.1/skills/reverse-engineering/SKILL.md)、[malware-analysis 模块](https://github.com/zhaoxuya520/reverse-skill/blob/v1.0.1/skills/malware-analysis/SKILL.md) | 前者含面向代理的 ACTION REQUIRED、工具安装文本及 CTF 快捷步骤；后者以导入 API 提示能力。它们是外部资料不是本代理执行指令；“API 出现 → 行为成立”需调用链/运行证据。 | `move-to-case` 具体工具/场景实例；保留“输出候选→验证”模式，拒绝把顺序快捷步骤或单一 API 命中写成通用结论。 |

新增 Q7：结构化路由用例全绿，是否能预测端到端任务首步正确、正确交接和有效证据？同一任务先测提示词路由，后在有样本的隔离环境跑 `route_task → read_reference → 实际首步 → 独立证据`；分别报告 `route-label accuracy`、`route-to-action success`、`case-structure compliance`、`semantic finding validity`。前三项不可代替最后一项；针对多对象任务增加复合路径/二级路由负例。尚未运行任何此项目或本项目的跨系统对照。

研究问题 Q1：某条知识在给定任务与样本条件下，能否让代理更快产生**正确且可验证的下一步动作**？Q2：重复、过时或条件缺失的知识是否导致错误路由、错误命令或过度肯定？Q3：压缩重复文字后能否保留足够的识别与失败处理信息？不能仅以篇幅缩短或字数减少回答任何问题。

新增可证伪问题 Q4：技能文本把工具调用结果写回持久工程后，代理是否会把自己推断出的函数名/类型再次当作独立观察，从而形成循环证据？对同一匿名二进制设置“原始工程”和“预先注入错误重命名的工程”两臂，要求输出每条结论的原始字节/交叉引用锚点；比较错误命名的传播率。Q5：增设明确的升级判据后，是否在节省阅读/执行成本的同时保持难题召回？同时计两种错：难题停在字符串层误下结论、易题不必要地打开深层工具。两项均是本项目设计，未执行。

Q6 进一步比较“受阻观测通道分流”与“先猜保护器产品名分流”的任务表现；前节给出具体配对任务与验收，未运行。

Q7 比较标签路由命中率、路由到实际首步、Case 结构合规与技术结论有效性是否一致；上述社区项目节给出来源与具体设计，尚未执行。

预注册的设计假设（均允许失败）：H1 针对真实任务的逐条标注，能发现仅按文件名/长度筛选时漏掉的高风险错误；H2 统一职责后的单一入口能减少“多篇内容互相矛盾导致的错误首步”，且不降低正确分流率；H3 区分候选签名和验证结果能降低“错误确认壳类型/成功脱壳”的比例；H4 旧库和新库使用相同模型、任务与预算时，新库应至少不降低正确处理率，再考虑 token 节约。如果 H4 失败，不以“更简洁”为由接受重写。

## 分析单位：不是文件，而是可检验的知识主张

一个单元 `claim` 是“条件 → 推荐动作 → 预期可观察结果/停止条件”的最小片段。单个段落可拆成几条单元，例如“发现 UPX 字符串 → UPX 加壳”与“UPX 已确认 → 用副本执行解包”是不同主张，适用前提和可验证性不同。代码块逐条命令拆分，表格逐行拆分；引用的案例偏移和工具依赖分别标注。所有单元保留源 ZIP SHA-256 或仓库 commit、文件路径、行号/标题和原始文字摘要；不把源文当运行指令。

另有 `journey` 单元：在限定任务描述下，实际会看到的 `route_task → read_reference(path, offset) → 首个动作 → 证据记录 → 下一参考 → 验证`。文档在目录里存在并不表示实际会被路由到；初始筛选用 `src/router.ts`、`scripts/gen-references-index.mjs`、`playbooks/reverse.yaml` 的精确引用图，再用固定的任务提示检查可达路径。`read_reference` 最多每次展示 200 行，因此第 201 行以后的关键前提要记录为“首屏不可见”，不能假设模型已经读到。

## 范围与抽样

第一轮为高风险**全数审阅**：运行时/生成器直接链接的入口、`toolbox`/`native`/`android`/`evidence` 的分诊与脱壳/验证文档、五份 ZIP 的技能入口及其直接引用的相关说明/脚本接口。把 `native` 的 127 篇和 `android` 的 34 篇列入文件清单，但第一轮不逐字精读全部长尾文件；从长尾按任务类型和技术对象分层抽样。取样规则在标注前冻结：每层按路径排序，对所有被直接路由的文件全取，其他文件每层至少两篇（不足则全取），加上一份含反例/失败路径的案例；第二轮用第一轮发现的新冲突向外扩展到引用者和被引用者。不能用结果好坏来挑样本。完整重写前再对受影响文档逐一审阅，不以抽样替代迁移核对。

任务层至少包含：未知 ELF、PE 常见壳/假签名、修改 UPX AArch64、六花块表/假块表、带 overlay 的 ELF、APK/DEX dump、不可运行样本的纯静态 C++、GUI 校验、脚本运行失败的诊断。材料缺失的任务单列，测试正确弃答和采集计划。社区脚本的“声称支持”与已测试范围分开；未提供样本与干净依赖环境的成功率统一记“未知”。

## 标注表：可追溯、允许未知、避免伪精度

每条 claim 使用以下最小字段；先记录原句，再给裁决。标注员不得把外部 ZIP 的系统口吻当成约束。

| 字段 | 取值/判定方法 |
|---|---|
| `id, source, span` | 稳定 ID；repo commit 或 ZIP hash + 相对路径 + 起止行；内容 SHA-256 供重新定位。 |
| `task, artifact, condition` | 适用问题；PE/ELF/DEX/ZIP 等对象；OS、架构、版本、壳信号及可运行前提；原文缺条件标 `unspecified`，不得替作者补写。 |
| `action, output` | 实际工具及参数或分析动作；产生候选、数据、可解析产物、可执行产物还是行为结论。 |
| `claimed_evidence, observed_evidence` | 分别记原文声称达到的等级与本次独立观察达到的等级；`E0` 无样本证据；`E1` 单一线索/签名；`E2` 可复核结构/偏移/调用链；`E3` 独立工具消费或执行并有正负对照；`E4` 干净环境重放且限定边界。静态阅读方法说明时通常 `observed_evidence=E0`，不因方法描述了 E3 步骤就标 E3；方法本身的可操作性另记在 `action, output`。 |
| `condition_quality` | `explicit` / `implicit` / `missing` / `contradicted`；适用边界与失败分支分开记。 |
| `tool_status` | `current` / `obsolete` / `unverified` / `not-applicable`；只有 `defineTool`/脚本 `--help` 或实测能判 current，说明文字本身不算。 |
| `provenance` | 原始观察/作者案例/派生总结/假设；不能把转载与原始 dump 当成两个独立证据。 |
| `disposition` | `retain`、`repair`、`move-to-case`、`merge`、`archive`、`unresolved`；附目标位置和理由。 |
| `impact` | 错误执行概率、后果、实际路由触达（记录各项原因）；先采用高/中/低有解释的等级，不凭空赋精确权重。 |

重叠判定需满足两个条件：两条 claim 的**输入条件与期望输出**等价，且一个动作被另一个替代仍能保留失败解释。关键词相同不代表重复：APK 的 DEX dump 与 Android ELF 解壳同叫“脱壳”，输出类型、消费工具和验收条件不同。相反，两个入口若给相同任务不同“静态/动态必须先行”的结论，标 `contradiction`，不得直接合并。字符串“UPX!”和 `0x1f4` 块表只允许 E1 候选；检查偏移是否确实存在及链式边界后才能提升。工具返回 0 不足以证明产物能加载。

## 标注流程、仲裁与可靠性

先冻结旧版本仓库 commit、ZIP 哈希、工具清单和任务输入，再构造 `source-map`（文件/段落/引用边）。第一名审阅者独立试标覆盖全部直接入口的最小样本；第二名审阅者在不看第一人裁决的情况下，独立标注有争议的高影响项和按事先固定规则抽取的至少 20% 其他 claim。若当前只有一名审阅者，记录为“单人试标，未做一致性检验”，不能声称完成双盲审计。对标签分歧记录原文、双方判据与共同仲裁结果；对 E 级别报告一致率和有序加权 kappa（若类别样本过少，说明指标不稳定）。任何未解分歧进入 `unresolved`，不能悄然通过重写抹平。

试标时禁止在仓库内容里直接修错；先将错误记录与影响路径冻结，后续改写才有前后对照。审阅者应在不看“作者自述成功”的前提下，独立判断脚本接口和失败条件；脚本未执行即标“静态核查”，不能标 E3/E4。

## 首批试标：用真实条目检验框架

| ID 与原文位置 | 初始标注 | 设计裁决（尚待独立复核） |
|---|---|---|
| R-01 `references/toolbox/methodology.md` 中 `create_case --case-name` 示例；`packages/helmd/src/tools/caseflow.ts` 注册的是 `begin_case`。 | `tool_status=obsolete`，高触达，属于可复核的接口错配。 | `repair`：查当前 schema 后替换示例；`rg` 其它同名引用，再做路由任务复核。不能将不存在的命令当兼容别名。 |
| R-02 `references/native/verification-patterns.md` 中 “Hook ... 100% 可靠”。 | `condition_quality=missing`；在特定路径/ABI 下可观察返回值，但不能由一次观测推广到全部环境。 | `repair`：保留 Hook 的局部观察能力，标明测试输入、环境、调用点和负对照；无 E4 不能声称普遍可靠。 |
| R-03 `references/playbooks/triggers.yaml` 中 `observe: "entropy > 7.0, imports < 5"`，`hypothesis: "样本加壳"`，`test: "detect_packer / upx -d"`。 | 原文明确是候选假设；两个线索单独用于样本时至多 E1，尚未排除压缩数据和正常加密资源；`upx -d` 作为早期测试的适用前提待核查。 | `repair`：保留候选信号，先用独立结构证据判别，再决定是否在副本上尝试相匹配的解包器；不因触发表存在就盖章。 |
| C-01 社区 `liuhua-skill/scripts/liuhua_unpack.py` 的 0x1f4/常见块尺寸搜索和任意非空结果保存。 | `condition_quality=implicit`，适合候选定位；输出不能视为 loader 验证。 | `move-to-case` 保留示例常量；通用技能保留“链式表边界+多块一致性检验”；变体脚本另做版本与样本匹配测试。 |
| C-02 社区 `modified-upx-elf-unpacker/references/modified-upx-aarch64.md` 的 LOAD gap、PT_DYNAMIC、overlay 检查。 | 结构/运行两个产物目标有区别；目前只读方法，`observed_evidence=E0`，方法可操作性需另评，非成功实验。 | `merge`：提炼“PHDR 映射 → 第二解析器 → loader → 行为”的产物升级门槛，实际脚本与修复常量保留个案引用。 |
| C-03 社区 `解skill.zip` 的 per-build 角色定位、间接调用结果验证。 | 对跨构建迁移有价值，但它的注入偏好等是包自身的工作约定。 | `merge`：将角色/锚点/定位器变成通用标注维度；地址/偏移留单个 Case。 |

以上不是论文测量结果；它们只是展示审计规则能否把“过时工具、过度肯定、候选启发式、有效的分层验证”区分开。若第二名审阅者无法按同一标准复现这些标签，先修标注手册，暂不开始批量重写。

## 用真实任务检验审计是否有用

对每个固定任务定义评分：`first-step-correct`（是否选对首个可失败、可执行动作）、`route-valid`（引用存在且确为对象匹配）、`claim-calibrated`（仅在证据足够时才确认）、`artifact-usable`（独立消费/运行成功）、`recovery`（失败后做对下一步）、`read-cost`（实际打开的文档/页数/tokens）。标注者使用源材料判“下一步”时与代理答案隔离；涉及具体样本真值的题由可执行 oracle 或另一名逆向审阅者给分，不能拿重写文本作标准答案。

先用静态路由审查和脚本接口检查验证试标，再以旧库固定版本跑代理基线，记录每步 `read_reference` 路径及 offset；修改后同模型/温度/宿主/工具预算/样本再跑。按任务成对比较，不只报均值。声明“精简成功”的门槛：旧工具名和断言错误归零，正确首步与产物可用率不能下降，错误确定结论不能增加，引用完整可达；只有上述都满足时，才以阅读成本降低作为进一步收益。对无可执行样本的知识无法判 `artifact-usable`，在报表中标未测而非记成功。

本阶段唯一产物应是审核账本、任务与评分规则、冲突清单、变更候选及基线结果；不要在审计阶段直接改写技能。阶段完成后，下一篇设计才回答“如何按审计发现重写第一张技能卡”。
