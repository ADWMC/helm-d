# helmd

[English](README.en.md) | 中文

[![Telegram](https://img.shields.io/badge/Telegram-@helm_xD-26A5E4?style=flat&logo=telegram)](https://t.me/helm_xD)

DeepSeek Harness (DSH) 安全分析插件集。9 个 `@dsh-security/*` bundle 组成的 pnpm monorepo，提供多领域安全分析工具与按需参考知识，附带 1 个可直接挂载的 agent preset。

> 仅供学习交流。使用者须遵守所在地法律法规，对使用本项目产生的后果自负。

## 这是什么

helmd 是 DeepSeek Harness (DSH) 的安全分析插件集：把安全分析能力拆成 9 个可独立发布、按需加载的 bundle，通过 cordis preset 挂载到 DSH agent。

核心能力：

- **提示词注入**：persona（`complete: true`）作为唯一系统提示，发送激活词 `helmd` 进入执行模式
- **领域路由**：`router` 提供 `skill_catalog` / `read_reference`，把问题路由到对应领域
- **七大领域 + 锚定**：Android / Web / Native / 协议 / 恶意样本 / AI 安全 / 证据，外加首轮工具锚定 bootstrap
- **按需参考**：领域知识、规则、工作流、案例全部放 `references/`，工具按需读取，不写进 system prompt 替模型做决定
- **首轮工具锚定**：首个顶层请求只暴露 shell + `read`，晋升后放开完整目录

## 激活

在 DSH 会话中发送：

```
helmd
```

即可激活。

## 架构

```text
用户问题
  → system-prompt/assemble
  → bootstrap 首轮收窄（shell + read）
  → 会话晋升
  → router + 领域 bundle 工具
  → read_reference 按需读 references/
  → 模型自主判断 + 置信度结论
```

## 包清单

| 包 | 注入 | 职责 | 暴露工具 |
| --- | --- | --- | --- |
| `@dsh-security/bootstrap` | systemPrompt | 首轮工具目录收窄，晋升后放开 | 无 |
| `@dsh-security/router` | tools | 领域路由与目录 | `skill_catalog`、`read_reference` |
| `@dsh-security/skill-android` | tools | Android 逆向 | `apk_fingerprint` |
| `@dsh-security/skill-web` | tools | Web 安全 | `web_reference`、`bot_analyze` |
| `@dsh-security/skill-native` | tools | Native / 二进制逆向 | `native_reference`、`detect_packer`、`scan_strings`、`xor_bruteforce`、`encoding_detect` |
| `@dsh-security/skill-protocol` | tools | 协议 / 流量 | `protocol_reference`、`pcap_parse`、`state_machine`、`parse_har` |
| `@dsh-security/skill-malware` | tools | 恶意样本 | `malware_reference`、`ioc_extract`、`yara_gen` |
| `@dsh-security/skill-ai-security` | tools | AI / LLM 安全 | `ai_reference`、`llm_sim` |
| `@dsh-security/skill-evidence` | tools | 证据 / 报告 / case | `evidence_reference`、`create_case`、`triage_artifact`、`hash_artifact` |

每个 `*_reference` 工具按需读取对应 `references/`，入口是各自的 `index.md`。

## 使用

唯一 preset 位于 `presets/full-reverse/`，挂载全部 7 个领域 bundle：

- `preset.yml` — 元数据（`name: helmd`）
- `agent.cordis.yml` — agent composition（persona + bootstrap + router + 7 个领域 bundle）

在 DSH profile 中引用该 preset 即可获得完整能力。

## 目录结构

```text
helmd/
├── packages/
│   ├── bootstrap/            首轮工具收窄过滤器
│   ├── router/               领域路由与目录
│   ├── skill-ai-security/    AI / LLM 安全
│   ├── skill-android/        Android 逆向
│   ├── skill-web/            Web 安全
│   ├── skill-native/         Native / 二进制逆向
│   ├── skill-protocol/       协议 / 流量
│   ├── skill-malware/        恶意样本
│   └── skill-evidence/       证据 / 报告 / case
├── presets/
│   └── full-reverse/
└── docs/
```

## 构建

需要 pnpm；构建产物目标 ES2022 / NodeNext。

```bash
pnpm install
pnpm -r build
```

根 `pnpm build` 等价于 `pnpm -r build`，逐包执行 `tsc`。

## 依赖

- `@deepseek-ai/cordis` `4.0.1`
- `@deepseek-ai/dsh-tools` `0.1.0-rc.6`

版本通过根 `package.json` 的 `pnpm.overrides` 固定。

## 发布

- 根包 `private: true`，不发布；发布对象是 9 个 `@dsh-security/*` 子包。
- 各子包 `files` 白名单限定为 `dist`、`references`、`scripts`、`cordis.patch.yml`。
- 每个子包的 `prepare` 脚本会在发布前自动执行 `tsc`。
- 当前版本 `0.1.0`。

## 部署

一键安装（推荐）：

```bash
./install.sh      # macOS / Linux
```

Windows PowerShell：

```powershell
.\install.ps1
```

脚本会装包、挂 preset、设默认一步到位；手动分步见下。

把 helmd 挂载到本地 DSH 分三步：装包 → 挂 preset → 设默认。

前置：已安装 `dsh` CLI 与 pnpm；9 个 `@dsh-security/*` 包已发布到 npm（见上「发布」）。

### 1. 安装 bundle 到 profile

```bash
dsh plugin --profile web add \
  @dsh-security/bootstrap \
  @dsh-security/router \
  @dsh-security/skill-android \
  @dsh-security/skill-web \
  @dsh-security/skill-native \
  @dsh-security/skill-protocol \
  @dsh-security/skill-malware \
  @dsh-security/skill-ai-security \
  @dsh-security/skill-evidence
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

## 参考项目

本项目融合了多个优秀开源项目的设计理念与实现思路，借鉴了社区中许多先行者的经验。如有雷同，那就是对优秀设计的借鉴与致敬。

- [ADWMC/helm-x](https://github.com/ADWMC/helm-x) — 提示词注入与计分制设计
- [yynxxxxx/Codex-X](https://github.com/yynxxxxx/Codex-X) — 提示词模板与可视化管理

## 文档

- [docs/principles.md](docs/principles.md) — 设计原则
- [docs/architecture.md](docs/architecture.md) — 架构
- [docs/architecture-v2.md](docs/architecture-v2.md) — 架构 v2（persona + 工具锚定 + 按需知识）

## 快速开始

```bash
git clone https://github.com/ADWMC/helm-d.git
cd helm-d
pnpm install
pnpm -r build
```

在 DSH profile 中引用 `presets/full-reverse/` 后，于会话中发送 `helmd` 激活。详见上方「使用」。

## Contributing

欢迎提 issue 与 PR。改动前请先阅读 [docs/principles.md](docs/principles.md)，并保持「参考知识按需读取、不替模型做决定」的架构约束。

## License

本项目基于 [MIT License](LICENSE) 开源，可自由使用、修改和分发。详见 [LICENSE](LICENSE)。

## AI 生成与法律风险

本仓库部分或全部代码由 AI 辅助生成，可能存在错误或不适用场景。使用前请自行审查，并自行判断是否适合你的使用场景与所在司法辖区；使用者须遵守所在地法律，对使用本项目产生的后果自负。本项目按 MIT “原样”提供，不附带任何担保。
