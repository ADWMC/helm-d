# v0.2.1 — 健康状态可视化 · 安装时 preset 再生

## 新增

**设置页健康卡片** 🟢🟠🔴
helmd 现在在 dsh 网页设置页（设置 → 插件 → 插件配置 → 「helmd 安全分析包」）常驻一块只读健康卡片。每次 dsh 启动评估一次部署位 preset 与已装宿主 `standard` 的指纹关系：

| 徽标 | 含义 | 动作 |
|------|------|------|
| 🟢 健康 Healthy | preset 与宿主匹配 | 无 |
| 🟠 宿主已升级 Host upgraded | 平台行过期 | 重跑 install / setup-preset 后重启 |
| 🔴 内容漂移 Content drift | 手改产物或 persona 未同步 | 重新生成 |
| 🟣 旧版产物 Legacy preset | 无指纹头旧文件 | 重新生成 |
| ⚪ 未部署 Not deployed | preset 缺失 | 跑 install |

展开可见双指纹、版本、评估时间与路径。

**安装时目标机实时生成 preset**
`install.ps1` / `install.sh` / `setup-preset.*` 不再复制发布机快照——在本机上直接读取你已装的 dsh 宿主 `standard` 预设派生生成（`gen-preset.mjs --out`），平台工具行永远匹配你自己的 dsh 版本；仅在生成器不可用时退回包内快照。

**CLI 指纹告警**
生成的 `agent.cordis.yml` 首行携带宿主指纹。`gen-preset.mjs --check` 可区分两种过期：

- 指纹移动 → `HOST UPGRADED`（宿主升级了，重生成即可）
- 内容不符 → `STALE (content drift)`（手改或 persona 未同步）

同一判定在 GUI 卡片 / CLI / 安装器三处生效，8/26 事故（44 工具残废目录）这一类漂移从此三面设防。

## 升级注意

从 0.2.0 升级：请通过安装器或 `dsh plugin --profile <profile> add <tgz>` 重装（会自动把 bundle 追加进 profile 的 `dsh.profile.bundles`），不要只手动解压到 node_modules——bundle 必须出现在 bundles 列表才会装配进宿主组合与客户端模块图。装完重启 dsh。

**Full Changelog**: https://github.com/ADWMC/helm-d/compare/v0.2.0...v0.2.1
