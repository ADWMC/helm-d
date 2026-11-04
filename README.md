<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/helm-d-dark.svg">
  <img src="assets/helm-d-light.svg" width="104" alt="helm-d icon">
</picture>

# helm-d

**DeepSeek Harness 的破甲安全分析插件。**

46 个工具 · 353 篇参考正文 + 9 个索引 · 证据链强制入链 · 四档破甲热切换 · 本地 Team 协作

[![Release](https://img.shields.io/github/v/release/ADWMC/helm-d?style=flat-square&label=release)](https://github.com/ADWMC/helm-d/releases)
[![Stars](https://img.shields.io/github/stars/ADWMC/helm-d?style=flat-square&logo=github&label=stars)](https://github.com/ADWMC/helm-d/stargazers)
[![CI](https://github.com/ADWMC/helm-d/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ADWMC/helm-d/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue?style=flat-square)](LICENSE)
[![views](https://hits.sh/github.com/ADWMC/helm-d.svg?label=views&color=2563eb&style=flat-square)](https://hits.sh/github.com/ADWMC/helm-d/)
[![Telegram](https://img.shields.io/badge/Telegram-%40helm__xD-26A5E4?style=flat-square&logo=telegram&logoColor=white)](https://t.me/helm_xD)

[安装](#安装) · [5 分钟上手](#5-分钟上手) · [能力](#能力) · [工作台](#工作台) · [工具](#工具) · [文档](#文档) · [English](README.en.md)

</div>

> **仅用于自有资产或已获授权的安全评估。** 完整法律条款见 [DISCLAIMER.md](DISCLAIMER.md)。

## 赞助商

> 想让你的项目出现在这里？[提交赞助申请](https://github.com/ADWMC/helm-d/issues/new?template=sponsor.yml)。

<details open>
<summary>展开 / 收起赞助商列表</summary>
<br/>

<table>
<tr>
<td width="180" align="center" valign="middle"><a href="https://github.com/3641397194-wq/gpt6-Astra"><img src="https://github.com/3641397194-wq.png?size=200" alt="toki · 冷咖啡" width="150"></a></td>
<td><strong>感谢 toki 赞助本项目</strong> · <a href="https://github.com/3641397194-wq/gpt6-Astra">冷咖啡 · 破甲工作台</a> · <a href="https://coldcoffeeai.com/">中转站</a><br/>
十一个 LLM 客户端一键破甲、一键卸载，Windows / macOS（arm64 · x64）/ Linux 三端安装包。勾选要破的软件按一下写入，打开软件后单独发口令「冷咖啡」；不想要了按卸载，文件回到写入之前。</td>
</tr>
<tr>
<td width="180" align="center" valign="middle"><a href="https://huablog.org"><img src="https://cloudflareimg.cdn.sn/i/6a255150f1770_1780830544.jpeg" alt="Hua · Vector" width="150"></a></td>
<td><strong>感谢 Hua 赞助本项目</strong> · <a href="https://huablog.org">Vector</a><br/>
一个中转站通吃 70+ 模型：Claude / Gemini / Codex / DeepSeek / Grok / Kimi / GLM 全覆盖。OpenAI 低至 0.065x、Plus 0.085x、Pro 0.165x，kiro 0.22x、ccmax 1.2x。</td>
</tr>
<tr>
<td width="180" align="center" valign="middle"><a href="https://tg.starontop.best/"><img src="https://tg.starontop.best/assets/common/images/default.jpg" alt="圈点钱 · TG 账号" width="150"></a></td>
<td><strong>友情链接</strong> · <a href="https://tg.starontop.best/">圈点钱 · TG 账号购买</a><br/>
Telegram / 推特 / 苹果 / 谷歌 / GPT 账号与会员，支持查单与售后。</td>
</tr>
</table>

</details>

## 它是什么

helm-d 是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的插件，不修改宿主二进制，通过 cordis 钩子给模型加四样东西：

- **46 个工具**：Android / Web / Native / Protocol / Malware / AI-Security，加上 Case 生命周期、路由与本地 Team 调度。
- **证据链**：工具输出自动落 `evidence/`，结论必须引用 E 编号和可复现的 `repro_cmd`。
- **按需知识**：353 篇参考正文 + 9 个索引由 `read_reference` 读取，不塞进 system prompt。
- **四档破甲**：ds4.1f / stealth / redteam-max / gpt-6x，工作台一键热切换，下一次模型调用生效。

它 **不是** 引擎补丁：不落盘改审批/沙箱，也不起独立进程。和补丁类工具可以同装，分工不同。

## 安装

**前提**：Node >= 22.19，已安装 [`dsh`](https://github.com/deepseek-ai/deepseek-harness) CLI。

```bash
dsh plugin --profile web add https://github.com/ADWMC/helm-d/releases/download/v0.5.2/helm-d.tgz
dsh web
```

> 安装/更新请使用带 `vX.Y.Z` 的版本化 URL。`releases/latest/download/*` 是滚动地址，写进 profile 依赖后，下次发版会让 pnpm lockfile 的 sha512 失配（`ERR_PNPM_TARBALL_INTEGRITY`）。遇到见 [安装故障排查](docs/install-troubleshooting.md)。

首次启动时健康检查会按本机 dsh 版本校验/修复 preset，不需要手工改 YAML。

> Web 端首次启动会出现 Star 提示面板；它 **不影响任何功能**，可以直接跳过。遇到问题见 [Star 弹窗帮助](docs/star-gate-help.md)。

## 5 分钟上手

1. 新建 DSH 会话，把 Agent 预设切到 **helmd**。
2. 发送 `helmd` 激活。
3. 先做一个读文件/列目录动作。首轮只暴露 `shell + read`，下一轮 46 个工具（含 `begin_case`）才会出现——这是宿主晋升机制，不是插件坏了。
4. 直接下任务，例如：

   > 分析 `samples/app.apk` 的加固方式，建 case、收集证据，最后给出带 `repro_cmd` 的结论。

5. 需要结构化结论时，让模型走 Case 流程：

```text
begin_case(goal, samples)
  → 工具输出自动写入 evidence/（E-001、E-002…）
  → record_finding(title, detail, evidence_ids, repro_cmd)
  → end_case(summary)
```

引用不存在的 E 编号会被拒绝；`repro_cmd` 是必填项，没有可复现命令的结论不算结论。

## 能力

| 能力 | 说明 |
|---|---|
| **六域工具** | Android 脱壳/Frida、Web 漏洞、Native 壳与反逆向、Protocol 抓包、Malware IOC/YARA、AI-Security |
| **Case 与证据链** | 磁盘工作区 + 自动入链 + E 编号校验 + `repro_cmd` 门禁；压缩上下文后 `case_status` 能从磁盘恢复 |
| **四档破甲** | ds4.1f / stealth / redteam-max / gpt-6x，`POST /api/helmd/profile` 原地重注册 persona section，无需重启 |
| **按需参考** | 353 篇正文 + 9 个索引，`skill_catalog` 路由、`read_reference` 按需读取，不占 system prompt |
| **自主状态包** | `case_status` 返回假设链、findings、证据、dead ends、匹配 playbook、下一步建议 |
| **工作台** | 破甲 / Case / Team / 工具 / 拦截 / 设置 / 关于七个 tab，侧边栏入口，数据走 `/api/helmd/*` |

<details>
<summary>四档破甲的区别（展开）</summary>

| Profile | 定位 | 内容 |
|---|---|---|
| **ds4.1f** | 似乎是ds4.1f v10（默认） | 完整主档规则 |
| **stealth** | 概率通用（轻量） | ds4.1f + 最小输出 / 只读优先 / 单目标收敛 |
| **redteam-max** | 概率通用（加厚） | ds4.1f + 全链路攻击链 / 攻防双栏 / 产物成套 |
| **gpt-6x** | gpt 6x | 独立主档：CTF 沙箱设定 + 计分表 + 四角色交付契约（源自 helm-x-wails v6，未在 DSH 实测） |

四档都封印在 `profiles.dat`；切换后旧 section 被 dispose 并原地重注册，无需重启宿主。

</details>

## 工作台

DSH 会话头部点 `helmd 工作台`，优先打开右侧栏（sidebar 不可用时回退浮层）：

- **破甲**：四档实时切换。
- **Case**：当前会话绑定的 case——假设链、结论、证据列表、未决假设；未绑定时显示提示与磁盘最近 case，不再自动展示别的会话。
- **Team**：本地多 agent 协作——ticket、角色 worker、报告、证据、evolution revision 与 A/B gate。
- **工具**：外部工具 catalog（仅 GitHub 仓库）、安装状态、release 资产安装/卸载。
- **拦截**：流式拒绝拦截的计数与摘录。
- **设置**：Team 并发/默认角色/自动建单、拦截开关、自主辅助、Star 延迟——与 DSH 设置页同源。
- **关于**：版本、作者、免责声明、更新地址、更新日志与“检查更新”。

## 工具

最常用的入口：`begin_case` / `case_status` / `record_finding` / `update_finding` / `end_case` / `route_task` / `read_reference` / `analysis_mode` / `team_create` / `team_dispatch` / `team_status`。

<details>
<summary><strong>46 个工具（按域展开）</strong></summary>

| 域 | 工具 |
|----|------|
| **Case** | `begin_case` `case_status` `record_finding` `update_finding` `save_evidence` `end_case` |
| **Case / 假设** | `record_hypothesis` `update_hypothesis` |
| **路由/知识** | `skill_catalog` `read_reference` `route_task` `analysis_mode` |
| **Android** | `apk_fingerprint` |
| **Web** | `web_reference` `bot_analyze` |
| **Native** | `native_reference` `detect_packer` `scan_strings` `xor_bruteforce` `encoding_detect` |
| **Protocol** | `protocol_reference` `pcap_parse` `state_machine` `parse_har` |
| **Malware** | `malware_reference` `ioc_extract` `yara_gen` |
| **AI-Security** | `ai_reference` `llm_sim` |
| **Evidence** | `evidence_reference` `triage_artifact` `hash_artifact` |
| **Recon** | `recon_passive` `recon_ports` `recon_http` `recon_crawl` `recon_import` |
| **PoC / Mining** | `run_poc` `mine_candidates` |
| **Toolbox** | `tool_recommend` `toolbox` |
| **Team** | `team_dispatch` `team_create` `team_status` `team_report` `team_steer` |

</details>

## 参考资料

353 篇正文 + 9 个索引在 [`references/`](packages/helmd/references/index.md)，包括 Android 脱壳与 Frida 模板、Web 漏洞 playbook、Native 壳识别与反逆向、Protocol 抓包与状态机、Malware IOC/YARA、AI-Security 提示注入、Evidence 报告模板。模型用 `read_reference` 按需读取，参考是弹药，不是硬规则。

## 运行方式

```text
请求 → 首轮锚定（shell + read）→ route_task 路由
     → 域工具 / read_reference → evidence/（E 编号）
     → 带置信度与 repro_cmd 的结论
```

<details>
<summary>架构与运行时钩子（展开）</summary>

- `bootstrap`：首轮只暴露平台 shell + `read`，工具调用或助手消息后晋升。
- `gate`：注册 `helm-d:persona` section；Star 面板只是提示层，不 gate 功能。
- `persist`：所有后注册域工具输出自动落 `evidence/`。
- `advisory-hook` / `llm-stream-hook` / `ica-context`：交付拒绝检测、流式拦截闭环与行为示范注入。
- `router` + `case`：领域路由、Case 生命周期与 `[autonomy]` 状态包。

详见 [架构文档](docs/architecture.md) 与 [设计原则](docs/principles.md)。

</details>

## 验证

- 八题原题干 60s 协议 **8/8 无拒绝**；完整数据与判档见 [八题评测报告](docs/reports/FINAL-REPORT-v9.md)。
- BoosterX v2.2.4.3 (.NET) 许可绕过：ConfuserEx 下还原 **32,316 个方法体**、解密 **7,726 条常量**；见 [实战案例](docs/case-studies/boosterx-dotnet-license-bypass.md)。

## 社区收录

| 目录 | 说明 |
|---|---|
| [dshfind](https://dshfind.com/zh/plugins/ADWMC/helm-d) | 插件超市，提供小标 / 下载量 / 展示卡三种嵌入徽章 |
| [DeepSeek Harness Plugin](https://deepseek-harness-plugin.com/plugins/helm-d/) | 独立目录，附安装命令与安装期风险提示 |
| [awesome-dsh-plugin](https://awesome-dsh-plugin.com/p/ADWMC/helm-d--packages-helmd/) | 分类目录 + 社区评论 |

## Star 趋势

<details>
<summary>展开星标曲线</summary>
<br/>

<a href="https://star-history.com/#ADWMC/helm-d&Date"><img src="https://api.star-history.com/svg?repos=ADWMC/helm-d&type=Date" alt="Star history" width="720"></a>

</details>

## 兼容性、更新与卸载

| 项 | 要求 |
|---|---|
| DSH | 0.2.x（本版在 `0.2.1-rc.2` 验证） |
| Node | `>= 22.19.0` |
| 平台 | Windows 用 `pwsh`；Linux / macOS 用 `bash`；WSL 通过 `wsl.exe` |

```bash
# 更新：先卸载，再装目标版本（不要用 latest/download）
dsh plugin --profile web remove @adwmc/helm-d
dsh plugin --profile web add https://github.com/ADWMC/helm-d/releases/download/v0.5.2/helm-d.tgz

# 卸载
dsh plugin --profile web remove @adwmc/helm-d
```

把 `v0.5.2` 换成目标 Release 的 tag；不要用 `releases/latest/download/*` 作为 profile 依赖。

## 文档

- [Star 弹窗帮助](docs/star-gate-help.md)
- [安装故障排查（ERR_PNPM_TARBALL_INTEGRITY）](docs/install-troubleshooting.md)
- [设计原则](docs/principles.md)
- [架构](docs/architecture.md)
- [开发与发布](docs/development.md)
- [安全边界与报告](SECURITY.md)
- [维护手册](MAINTENANCE.md)
- [更新日志](CHANGELOG.md)
- [实战案例：BoosterX .NET 许可绕过](docs/case-studies/boosterx-dotnet-license-bypass.md)
- [八题评测报告](docs/reports/FINAL-REPORT-v9.md)
- [总方案：专业逆向 + 渗透操作链](docs/design/MASTER-PLAN-PRO-RE-PENTEST.md)

## 社区与支持

- 问题与建议：[GitHub Issues](https://github.com/ADWMC/helm-d/issues)
- Star 面板问题：[Star 弹窗帮助](docs/star-gate-help.md)

如果 helm-d 对你有帮助，欢迎点个 Star。

## 致谢

本项目融合了大量优秀开源项目的设计思路与实现模式，向社区先行者致敬：

- [ADWMC/helm-x](https://github.com/ADWMC/helm-x) — prompt injection 与评分设计
- [yynxxxxx/Codex-X](https://github.com/yynxxxxx/Codex-X) — 提示词模板与可视化管理
- [dsh-purge](https://github.com/YuJunZhiXue/dsh-purge)（YuJunZhiXue）— 工具描述清洗话术表与输入归一化词表
- [dsh-purge-community](https://github.com/kingcharleslzy-ai/dsh-purge)（Jueze-2019，MIT）— `presets/boost.txt` 尾部覆盖块

## 参与贡献

欢迎 issue 与 PR。改动前请先读 [CONTRIBUTING.md](CONTRIBUTING.md) 和 [docs/principles.md](docs/principles.md)，保持两条架构约束：**证据强制入链、参考知识按需读取**。

## License

[GNU Affero General Public License v3.0](LICENSE)（SPDX：`AGPL-3.0-or-later`），Copyright (C) 2026 ADWMC。你可以按 AGPL v3 或自由软件基金会发布的任何更新版本使用、修改与分发本项目。

- **网络使用（§13）**：把本插件或其修改版作为网络服务对外提供时，必须向使用者提供对应源码。对应源码就是本仓库：npm 包内封印的 `profiles.dat` / `references.dat` / `payload.dat` 全部可由仓库内的明文源重新生成（`packages/helmd/scripts/build-profiles.mjs`、`build-sealed.mjs`），不存在额外的闭源组件。
- **再分发**：转发 npm 包或 tgz 时须附带本许可证全文，保留版权声明与第三方署名，并同样以 AGPL 授权。
- **贡献**：提交 PR 即表示你同意以 `AGPL-3.0-or-later` 授权该贡献，并确认你有权这样做。
- **第三方组件**：`presets/boost.txt` 的尾部覆盖块来自 [dsh-purge-community](https://github.com/kingcharleslzy-ai/dsh-purge)（MIT，© 2026 Jueze-2019），该部分仍为 MIT；「致谢」中列出的其它项目仅提供设计参考，未复制其代码。`references/` 内引用的第三方文章与代码片段版权归原作者，引用不改变其许可。

## 免责声明与使用条款

> [!WARNING]
> 仅限自有资产，或已获明确书面授权的安全评估。本软件含攻击性技术、自动化脚本与 AI 辅助生成内容，误用后果由使用者承担。

| 允许 | 禁止 |
|---|---|
| 自有 / 授权资产测试 · 逆向 · 取证 · CTF · 检测规则研发 | 未授权入侵 · 拒绝服务 · 勒索 · 恶意软件 · 隐私侵害 · 规避许可 |

- **无担保**：按「原样」提供，不附带任何明示或默示担保；责任限制与赔偿条款见全文。
- **非官方**：与 DeepSeek、DeepSeek Harness 及其维护者无隶属、赞助或背书关系。
- **输出风险**：结果可能错误或过时，不构成专业建议；执行前独立验证。
- **网络行为**：仅更新检查与 Star 验证会访问 GitHub / npm；插件不上传样本与证据。
- **法域**：欧盟（GDPR / CRA / 双用途条例）、中国（刑法 285/286、《网络安全法》《密码法》）、美国（CFAA / DMCA §1201 / EAR）的要点见全文 §15。
- **第三方**：`boost.txt` 来自 dsh-purge-community（MIT，Jueze-2019）；`references/` 引用版权归原作者。

完整条款（定义、使用者保证、禁止用途、赔偿、出口管制、三大法域、管辖等 17 节）见 **[DISCLAIMER.md](DISCLAIMER.md)**。
