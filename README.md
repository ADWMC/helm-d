<div align="center">

# helmd

**DeepSeek Harness 破甲一体化安全分析插件**

一个 preset 挂载 · Android · Web · Native · Protocol · Malware · AI-Security 六大领域即开即用

[English](README.en.md) | 中文

[![Telegram](https://img.shields.io/badge/Telegram-@helm_xD-26A5E4?style=flat&logo=telegram)](https://t.me/helm_xD)
[![topic: dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-2ea44f)](https://github.com/topics/dsh-plugin)
[![topic: deepseek-harness](https://img.shields.io/badge/topic-deepseek--harness-2ea44f)](https://github.com/topics/deepseek-harness)
[![Node >=22.19](https://img.shields.io/badge/Node-%3E%3D22.19.0-green)](https://nodejs.org)
[![pnpm 11.7.0](https://img.shields.io/badge/pnpm-11.7.0-orange)](https://pnpm.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

> 仅供学习交流。使用者须遵守所在地法律法规，对使用本项目产生的后果自负。

## Why helmd

<table>
<tr>
<td width="50%">

### 破甲一体化

Android · Web · Native · Protocol · Malware · AI-Security 六大安全领域聚合在一个 preset 里。装一次，全领域工具就绪，不再逐领域拼装。

</td>
<td width="50%">

### 单包聚合 · 一条命令

全部能力收敛进一个 `@dsh-security/helmd` bundle：bootstrap、router、七大领域工具、toolbox 全在里面。`install.ps1` / `install.sh` 下载 Release 预构建 tarball 一条命令装齐，preset 自动写入。

</td>
</tr>
<tr>
<td width="50%">

### 知识按需读

领域知识、规则、工作流、案例全部放 `references/`，工具按需读取——不塞进 system prompt 替模型做决定，控 token，也保判断。

</td>
<td width="50%">

### 首轮工具锚定

首个顶层请求只暴露 shell + `read`，晋升后放开完整目录。文本首答不会困在 bootstrap，第二轮一定见到全量工具。

</td>
</tr>
</table>

## 为什么做这个

DSH 的安全分析能力原本分散在多个领域 bundle：装 Android 要 add，装 Web 要 add，装 Native 还要 add，preset 和 router 也得自己拼。

helmd 把七大领域 + 证据链（evidence）+ 首轮工具锚定（bootstrap）+ 工具箱（toolbox）打包成一个 bundle：

`一个 preset` &ensp; `一个 bundle` &ensp; `25 个工具` &ensp; `零手动拼装`

装一次，会话里发 `helmd`，全领域工具就绪。

## 架构

```mermaid
flowchart LR
    Q["用户问题"] --> SP["system-prompt/assemble"]
    SP --> BS["bootstrap 首轮收窄<br/>shell + read"]
    BS --> P{"会话晋升"}
    P -->|首轮| BS
    P -->|晋升后| ROUTER["router 领域路由"]
    ROUTER --> ANDROID["Android"]
    ROUTER --> WEB["Web"]
    ROUTER --> NATIVE["Native"]
    ROUTER --> PROTO["Protocol"]
    ROUTER --> MAL["Malware"]
    ROUTER --> AI["AI-Security"]
    ROUTER --> EVID["Evidence"]
    ANDROID & WEB & NATIVE & PROTO & MAL & AI & EVID --> REF["read_reference 按需读 references/"]
    REF --> OUT["模型自主判断 + 置信度结论"]

    style BS fill:#eff6ff,stroke:#3b82f6,stroke-width:2px,color:#1e40af
    style ROUTER fill:#f0fdf4,stroke:#16a34a,stroke-width:2px,color:#15803d
    style REF fill:#fffbeb,stroke:#f59e0b,stroke-width:2px,color:#92400e
    style OUT fill:#15803d,color:#fff,stroke:#166534,stroke-width:2px
```

- **首轮收窄**：首个顶层请求只暴露 shell + `read`，晋升后放开完整工具目录
- **领域路由**：`router` 用 `skill_catalog` / `read_reference` 把问题路由到对应领域
- **按需参考**：`references/` 是知识库，不是注入物；模型读完后自主判断

## 运行规则

helmd 会话遵循以下固定规则：

### 激活与会话

| 规则 | 行为 |
|------|------|
| 激活词 | preset 内置 persona 定义激活词（默认 `helmd`），精确匹配才回激活语，其余输入一律当任务执行 |
| 首轮锚定 | 首个顶层请求仅暴露 shell + `read`；首次工具调用或助手消息后晋升，放开全部工具 |
| 子代理豁免 | delegationDepth > 0 的会话始终可见完整目录 |
| 分析档位 | Ponytail 式阶梯：`analysis_mode` 设 lite（快速分诊）/ full（标准流程，默认）/ deep（完整证据链），会话内持久，选能回答任务的最浅档 |
| 确定性路由 | `route_task(hint)` 关键词匹配出 PRIMARY 路由 + 一句依据（先路由后动手），未命中回落决策树 |

### 知识与路由

| 规则 | 行为 |
|------|------|
| 知识按需读 | 209 个参考文档全放 `references/`，经 `read_reference` 读取，绝不注入 system prompt |
| 目录即元数据 | `skill_catalog` 只做领域/信号路由，不下结论：`tree` 分诊、`methodology` 方法论、`patterns` 模式、`install` 工具安装、`jvm` JVM 解密等 |
| 参考非硬规则 | 文档供模型自主判断，不作为强制约束 |

### 工具与脚本

| 规则 | 行为 |
|------|------|
| 调用链 | 用户请求 → `defineTool.execute()` → `runSeam()` → 子进程（优先 ctx.subprocess，回退 execFile） |
| Python 解析 | `resolveCommand()` 按 python → py → python3 顺序探测，Windows 兼容 py launcher |
| 路径安全 | 所有文件读写经 `assertWithinRoot()` 校验，越界路径直接拒绝 |
| 外部工具获取 | 先查本机（where / --version）→ 无则装到除 C 盘外最大盘的 `X:\Reverse\` → 下载走代理 → 记录版本；详见 `references/toolbox/tool-install.md` |
| Releases 优先 | 有 GitHub Releases 的工具一律下预编译二进制，不源码编译 |

### 存证

| 规则 | 行为 |
|------|------|
| 报告模板 | 结论按 severity / confidence 分级，模板见 `references/evidence/reporting.md` |
| case 工作区 | 正式分析用 `create_case` 建 case.json 结构化工作区，产物可追溯 |

## 快速上手

**前提**：已安装 [`dsh`](https://github.com/deepseek-ai/deepseek-harness) CLI 与 pnpm。

Windows（双击 `install.bat`，或 PowerShell 运行）：

```powershell
.\install.ps1
```

macOS / Linux：

```bash
./install.sh
```

安装器会下载最新 Release 的 `helmd.tgz`、装入 profile、写入 preset，一步到位。然后启动：

```bash
dsh web
```

会话里发送 `helmd` 即激活。

## 从插件商店安装

helmd 已提交 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 收录（[PR #2708](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/2708)）。合并后可在 [dshmarket.com](https://dshmarket.com) 或 dshmarket 插件 UI 里一键安装；命令行等价于：

```bash
# 预构建 tarball（免构建审批）
dsh plugin --profile web add https://github.com/ADWMC/helm-d/releases/latest/download/helmd.tgz

# 或从源码
dsh plugin --profile web add github:ADWMC/helm-d/tree/main/packages/helmd
```

## 验证

```bash
dsh --profile web --dump-config   # 应看到 @dsh-security/helmd 一行
```

会话里发送 `helmd` 后：

```text
skill_catalog        → 返回领域/信号路由（含 jvm、install 等新路由）
native_reference     → 读取 Native 领域参考
detect_packer <file> → 判定 PE/ELF 保护器
```

上面任一正常返回即安装成功。

## 包清单

| 包 | 注入 | 职责 | 暴露工具 |
| --- | --- | --- | --- |
| `@dsh-security/helmd` | tools + systemPrompt | 全领域安全分析一体化 | 见下表 |

### helmd 暴露的工具

| 领域 | 工具 | 说明 |
| --- | --- | --- |
| **路由** | `skill_catalog` | 领域路由目录 |
| **路由** | `read_reference` | 读取路由级参考文档 |
| **Android** | `apk_fingerprint` | APK 框架/HTTP/混淆检测 |
| **Web** | `web_reference` | Web 安全参考文档 |
| **Web** | `bot_analyze` | Puppeteer Bot 分析 |
| **Native** | `native_reference` | Native/二进制参考文档 |
| **Native** | `detect_packer` | PE/ELF 加壳检测 |
| **Native** | `scan_strings` | ASCII/UTF-16LE 字符串提取 |
| **Native** | `xor_bruteforce` | 单字节 XOR 暴力破解 |
| **Native** | `encoding_detect` | Base64/Hex/ROT13/XOR 解码 |
| **Protocol** | `protocol_reference` | 协议/流量参考文档 |
| **Protocol** | `pcap_parse` | PCAP TCP/UDP 流提取 |
| **Protocol** | `state_machine` | 协议状态机推断 |
| **Protocol** | `parse_har` | HAR 请求/响应解析 |
| **Malware** | `malware_reference` | 恶意样本参考文档 |
| **Malware** | `ioc_extract` | IOC 提取 |
| **Malware** | `yara_gen` | YARA 规则生成 |
| **AI-Security** | `ai_reference` | AI/LLM 安全参考文档 |
| **AI-Security** | `llm_sim` | LLM 应用模拟测试 |
| **Evidence** | `evidence_reference` | 证据/报告参考文档 |
| **Evidence** | `create_case` | 创建逆向 case 工作区 |
| **Evidence** | `triage_artifact` | 离线分诊 |
| **Evidence** | `hash_artifact` | SHA-256 哈希 |
| **Toolbox** | `tool_recommend` | 工具库推荐 |
| **Router** | `route_task` | 确定性路由：任务提示 → PRIMARY 路由 + 依据 |
| **Session** | `analysis_mode` | 分析档位阶梯 lite/full/deep（Ponytail 式） |

每个 `*_reference` 工具按需读取对应 `references/<domain>/`，入口是各自的 `index.md`。

## 方案选型

| 方案 | 不选的原因 |
|------|-----------|
| 10 个独立 bundle | 10 次 add + 手动拼 preset + router，重复且易错；seam.ts 复制 9 遍 |
| 只挂原生 shell 工具 | 无领域知识，模型靠猜，结论不可复现 |
| 知识塞进 system prompt | token 爆炸，且替模型做决定，违背按需原则 |
| helmd 单包 | 一次安装全聚合，共享 seam，知识按需读，模型自主判断 |

## 常用命令

```bash
pnpm install                # 安装依赖（prepare 自动 tsc）
pnpm build                  # 构建 workspace 全部包（发布物仅 helmd）
pnpm typecheck              # 干净树 tsc --noEmit 类型门禁
```

本地打包交付：

```powershell
.\scripts\repack.ps1                                    # 生成 dist-tgz\helmd.tgz（含稳定命名别名）
dsh plugin --profile web add .\dist-tgz\helmd.tgz       # 装进 web profile
```

## 部署

一键安装见上「快速上手」；手动分步如下。前置：`@dsh-security/helmd` 包已发布到 npm（见「发布」）。

### 1. 安装 bundle 到 profile

```bash
dsh plugin --profile web add @dsh-security/helmd
```

`dsh plugin` 会把参数转发给 profile 目录里的 pnpm，包落到 `$DSH_HOME/profiles/node_modules/`。

### 2. 挂载 preset

把 `presets/full-reverse/` 复制到 DSH 用户 preset 根目录 `$DSH_HOME/.agent-presets/helmd/`：

macOS / Linux：

```bash
mkdir -p ~/.dsh/.agent-presets/helmd
cp presets/full-reverse/agent.cordis.yml ~/.dsh/.agent-presets/helmd/
cp presets/full-reverse/preset.yml ~/.dsh/.agent-presets/helmd/
```

Windows（PowerShell）：

```powershell
$p = Join-Path $env:USERPROFILE '.dsh\.agent-presets\helmd'
New-Item -ItemType Directory -Force $p | Out-Null
Copy-Item presets\full-reverse\agent.cordis.yml $p
Copy-Item presets\full-reverse\preset.yml $p
```

### 3. 设为默认 preset

在 UI 的 preset 选择器里选 `helmd`，或改 `$DSH_HOME/settings.yaml`：

```yaml
agent-presets:
  default: helmd
```

### 4. 启动并激活

```bash
dsh web
```

会话里发送 `helmd` 即激活。`DSH_HOME` 默认是 `~/.dsh`，自定义过就替换对应路径。

## 目录结构

```text
helmd/
├── packages/
│   └── helmd/                 发布包（单 bundle）
│       ├── src/
│       │   ├── bootstrap.ts   首轮工具收窄过滤器
│       │   ├── router.ts      skill_catalog / read_reference 路由
│       │   ├── seam.ts        共享 IO seam（fs / subprocess / 命令解析 / 路径校验）
│       │   └── tools/         8 个工具模块（25 个工具）
│       ├── references/        209 个参考文档，按需读取（8 大域 + toolbox）
│       ├── scripts/           80 个分析脚本，经 runSeam 调用（含 native/jvm 管线）
│       └── cordis.patch.yml   bundle 挂载清单
├── presets/full-reverse/      preset 定义（persona + 全部工具行）
├── install.ps1/.sh/.bat       一键安装器
└── docs/                      设计文档
```

> `packages/` 下其余目录为历史拆分包，已由 helmd 单包取代，仅作归档保留、不再发布。

## 构建

需要 pnpm；构建产物目标 ES2022 / NodeNext。

```bash
pnpm install
pnpm build
```

根 `pnpm build` 构建 `@dsh-security/helmd` 包；`pnpm typecheck` 在干净树上执行 `tsc --noEmit` 类型门禁。

## 依赖

- `@deepseek-ai/cordis` `^4.0.1`
- `@deepseek-ai/dsh-tools` `>=0.1.0-rc.1 <0.1.0 || >=0.1.0-rc.1 <0.2.0-0`（显式预发布分支，避免静默排除 rc 构建）

版本通过 `pnpm-workspace.yaml` 的 `overrides` 固定。

## 发布

- 根包 `private: true`，不发布；发布对象是 `@dsh-security/helmd` 单包。
- `files` 白名单限定为 `dist`、`references`、`scripts`、`cordis.patch.yml`。
- `prepare` 脚本会在发布前自动执行 `tsc`。
- 当前版本 `0.1.4`。
- Release 资产：`dsh-security-helmd-<ver>.tgz` + 稳定别名 `helmd.tgz`（供商店 tarball 字段与安装器使用）。

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| DSH 宿主版本升级不兼容 | peer 依赖 cordis / dsh-tools，`overrides` 固定版本 |
| 本机缺 `python` | seam 自动探测 python / py / python3，Windows 兼容 `py -3` |
| 单包版本错位 | 版本 0.1.4，tarball 与 release 同步发布 |
| 参考知识过时 | 按需读、模型自主判断，非硬性规则 |

## 参考项目

本项目融合了多个优秀开源项目的设计理念与实现思路，借鉴了社区中许多先行者的经验。如有雷同，那就是对优秀设计的借鉴与致敬。

- [ADWMC/helm-x](https://github.com/ADWMC/helm-x) — 提示词注入与计分制设计
- [yynxxxxx/Codex-X](https://github.com/yynxxxxx/Codex-X) — 提示词模板与可视化管理

## 文档

- [docs/principles.md](docs/principles.md) — 设计原则
- [docs/architecture.md](docs/architecture.md) — 架构
- [docs/architecture-v2.md](docs/architecture-v2.md) — 架构 v2（persona + 工具锚定 + 按需知识）

## Contributing

欢迎提 issue 与 PR。改动前请先阅读 [docs/principles.md](docs/principles.md)，并保持「参考知识按需读取、不替模型做决定」的架构约束。

## License

本项目基于 [MIT License](LICENSE) 开源，可自由使用、修改和分发。详见 [LICENSE](LICENSE)。

## AI 生成与法律风险

本仓库部分或全部代码由 AI 辅助生成，可能存在错误或不适用场景。使用前请自行审查，并自行判断是否适合你的使用场景与所在司法辖区；使用者须遵守所在地法律，对使用本项目产生的后果自负。本项目按 MIT “原样”提供，不附带任何担保。
