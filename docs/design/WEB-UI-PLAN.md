# WebUI 具体方案（DSH 原生 UI）

> **状态**：2026-10-27。工作台 UI 的唯一事实源。
> **前提**：DSH 0.2.1-rc.2 Web 宿主；插件是 `@adwmc/helm-d`；不引入 Harness Client 包；不写 `document.body/head`。
> **依据**：`dsh-agent-preset/skills/cordis-plugin-development/` 的 `SKILL.md`、`references/practices.md`、`references/ui-plugin.md`、`references/verification.md`、`references/host-plugin.md`，以及宿主 `dsh-client-ui-*` 源码。

---

## 0. 已确定的决策

- **删除设置页健康卡片。** 原注册槽位 `settings.plugin.item` 在 0.2.1 不存在；DSH 当前设置页使用 `settings.section` / `settings.plugins.tab` / `plugins.item`。
- **保留两个入口**：会话头部胶囊 → 浮层工作台；右侧栏 tab → 全高工作台。
- **星标卡**挂在 `shell.overlay`，不再 `document.body.appendChild`。
- **样式只用 token**：`--dsw-alias-*`、`--dsw-radius-*`、`--ds-font-family-code`；字面色值只允许出现在图标/图形本身。
- **不 require** `@deepseek-ai/dsh-client-ui-primitives`；按宿主源码复制 markup/CSS，类名限定在 `.helmd-workbench`。
- **不做 mock 截图验收**；验收以真实宿主 slot、console、light/dark 为准。

---

## 1. 信息架构

```
会话头部
└─ [helmd 工作台 ▾] 胶囊
   ├─ 点击：打开并聚焦右侧栏 helmd tab
   └─ 仅当 sidebar 服务不可用：回退 470×580 浮层（同一组件）

右侧栏
└─ helmd 工作台 tab（全高，宽度随 sidebar）
   └─ 同一四 tab 面板

全局
└─ shell.overlay → Star 支持卡（可选；默认收起“自动验证”）

设置页
└─ 不再有 helmd 卡片
```

### 官方槽位映射

| UI | 槽位/服务 | 注册形态 |
|---|---|---|
| 右侧栏正文 | `sidebar.right.pane.tab` | keyed / session，`key = "helm-d:eval"` |
| 右侧栏标题 | `sidebar.right.pane.tab.title` | keyed / session，同上 |
| 右侧栏类型 | `ctx.sidebarRightTabs.register` | `id/kind/title/guide` |
| 头部胶囊 | `conversation.session.header.actions` | list / session，`id = "agent-preset"` |
| 星标卡 | `shell.overlay` | list / root，`id = "helm-d:gate"` |
| 打开 tab | `ctx.sidebarRight.openTabIn/openTab` | 服务方法 |
| 样式 | `--dsw-*` tokens | 面板内 `<style>`（卸载即移除） |

---

## 2. 视觉规范（对齐 DSH）

### 2.1 面板骨架

```
┌──────────────────────────────────────────────┐
│ 安全分析  0.5.2                          ×   │  12px padding
│ core · 33 个工具 · 1 个未决假设               │  12px tertiary
│ 破甲   Case 1   拦截 3   关于                 │  13px，下划线 tab
├──────────────────────────────────────────────┤
│                                              │
│  [tab content, 12px padding, 10px gap]       │
│                                              │
└──────────────────────────────────────────────┘
```

- 面板背景：`var(--dsw-alias-bg-base)`。
- 头部底边：`0.5px solid var(--dsw-alias-border-l2)`。
- 标题：14px / 600，版本 11px / 400 tertiary。
- 副标题：12px tertiary，格式 `profile · N 个工具 · M 个未决假设`。
- 关闭按钮：28×28，`--dsw-radius-sm`，透明底，hover `--dsw-alias-interactive-bg-hover`。
- Tab：13px / 20px，`padding: 7px 1px 9px`，间距 18px；激活项文字 primary + 2px 底部指示条（`border-radius: 2px 2px 0 0`），计数 11px tertiary。
- 内容：`padding: 12px`，卡片间距 10px。

### 2.2 卡片

| 属性 | 值 |
|---|---|
| 背景 | `var(--dsw-alias-settings-card-fill)` |
| 边框 | `0.5px solid var(--dsw-alias-settings-card-stroke)` |
| 圆角 | `var(--dsw-radius-md)`（12px） |
| 内边距 | `12px 14px` |
| 卡片间距 | `10px` |
| 标题 | 13px / 600 primary |
| 正文 | 13px / 20px secondary |
| 说明 | 11px / 16px tertiary |
| 内嵌块 | `var(--dsw-radius-sm)`，`0.5px solid var(--dsw-alias-border-l1)` |

### 2.3 颜色

只使用 token，不写字面值：

- 主文字 `--dsw-alias-label-primary`
- 次文字 `--dsw-alias-label-secondary`
- 说明 `--dsw-alias-label-tertiary`
- 成功/活跃 `--dsw-alias-state-success-primary`（#22c55e）
- 业务/信息 `--dsw-alias-state-business-primary`
- 警告 `--dsw-alias-state-warn-primary`
- 错误 `--dsw-alias-state-error-primary`
- 代码块 `--dsw-alias-markdown-code-block`
- 中性标签底 `--dsw-alias-bg-module-platform`
- hover `--dsw-alias-interactive-bg-hover`

### 2.4 字号/圆角/间距阶梯

- 字号：20（大数字）/ 14（面板标题）/ 13（正文、tab、卡片标题）/ 12（小标题）/ 11（说明、计数、代码）。
- 圆角：`xs 4` / `sm 8` / `md 12` / `lg 16` / `xl 20`。
- 间距：卡片 10，区块 12，行 4–8，按钮高 28。
- 代码：`var(--ds-font-family-code)`，11px / 18px。

---

## 3. 四个 Tab 的具体规格

### 3.1 破甲

数据：`GET /api/helmd/profile`；切换 `POST /api/helmd/profile {id}`。

```
当前档位  [ACTIVE]
全能主档（v10 全量）  core
全部域规则 · 完整破甲 · 默认档
● 热切换 · 下一次模型调用生效 · 无需重启

切换档位
┌ ● 全能主档（v10 全量）  core        当前 ┐
│   全部域规则 · 完整破甲 · 默认档          │
├ ○ 轻量隐匿版  stealth             切换 ┤
│   最小输出 · 只读优先 · 单目标收敛        │
├ ○ 渗透加厚版  redteam-max         切换 ┤
│   全链路攻击 · 攻防双栏 · 产物成套        │
└──────────────────────────────────────────┘
```

- 当前卡：12px 标签 + 绿色 `ACTIVE` 标签；名称 15px/600；id 11px code；描述 12px；热切换提示 11px + 绿点。
- 档位行：圆形单选 16px；激活行绿色描边；名称 13px/500；id 11px code；描述 11px tertiary；右侧 `当前`（绿）/`切换`（tertiary）。
- 切换中：行禁用，顶部显示 `切换中…`；失败显示错误条（`state-error-tertiary` 底、红色文字）。
- 成功后只更新本面板状态，不刷新页面；下一次模型调用生效。

### 3.2 Case

数据：`GET /api/helmd/case` + `/case/findings` + `/case/evidence`。

```
2026-10-27-boosterx-license              [OPEN]
定位 ConfuserEx 动态防护下的许可证校验点…

┌ Evidence 12 ┐  ┌ Open hypotheses 1 ┐

假设                                     3
● H-001  LicenseCheck 在 .cctor 内完成 RSA 公钥初始化   [confirmed]
● H-002  校验返回值只影响 UI 分支…                     [open]
● H-003  补丁点位于 0x2A1C 的 brtrue.s                 [refuted]
```

- 案件头：名称 14px/600 + OPEN 绿标；goal 13px secondary。
- 统计：两列等宽，内嵌块；标签 11px；数字 20px/500，颜色按语义（Evidence 蓝、Open 琥珀/绿）。
- 假设行：6px 状态圆点 + id 11px code tertiary + statement 12px secondary + 状态标签（绿/蓝/琥珀/红）。
- 无案件：`暂无进行中的案件` + `begin_case` 提示。
- **结论**：`record_finding` 的标题/详情/证据 id/`repro_cmd`；缺 repro 显示 `repro: MISSING`；空态提示 `record_finding`。
- **证据**：`evidence/` 的 E 编号与文件名；空态提示 `save_evidence`。
- **刷新**：Case 卡头部有小“刷新”按钮；切到 Case tab 时自动拉一次。
- 无假设：`还没有假设` + `record_hypothesis` 提示。

### 3.3 拦截

数据：`GET /api/helmd/intercept`。

```
流式拦截                                [ACTIVE]
3
已拦截并走恢复阶梯的拒答次数
实时挂载在 LLM 流式输出前置节点…

┌ ● ● ●  helmd-stream-intercept.log ─────────┐
│ [STREAM-OK] 拦截器已上线 · 已处理 3 次      │
│ [LAST]      2026-10-27 15:42:08             │
│ [REFUSAL]   "I can't help with that…"       │
│ [AUDIT]     ~/.dsh/helmd-stream-intercept.log│
└─────────────────────────────────────────────┘
```

- 统计卡：标签 11px；数字 20px/500 绿色；ACTIVE/IDLE 标签。
- 终端：`--dsw-alias-markdown-code-block` 底、12px 圆角、`0.5px` 边框、代码字体 11px/18px；顶部三个状态圆点 + 日志文件名。
- 行前缀颜色：`[STREAM-OK]` 绿、`[LAST]`/`[AUDIT]` tertiary、`[REFUSAL]` 琥珀。
- 日志最多 220px 高，可滚动。

---


### 3.4 关于

数据：`GET /api/helmd/update`（点击时请求；GitHub Releases 优先，npm registry 兜底）。

- **关于卡**：当前版本、作者链接（ADWMC / 仓库）、`检查更新` 按钮；结果显示已最新、远端版本，或失败原因；有更新时给 Releases 链接。
- **更新地址卡**：Releases 链接 + 一条安装命令；仓库内可用 `scripts/update.ps1` / `scripts/update.sh`。
- **更新日志卡**：4 条近期要点 + `完整日志` 链接（GitHub CHANGELOG）。
- **免责声明卡**：仅供学习交流与授权安全评估；MIT 原样提供，无担保；部分代码由 AI 辅助生成。
- 检查更新只在点击时发请求，不轮询、不阻塞其他 tab；失败不覆盖已有内容。

---

## 4. 交互与状态

- 轮询：5 个接口并行，15s 一次；组件卸载清理 timer。
- Tab 切换：重挂载内容，120ms 淡入；`prefers-reduced-motion` 关闭。
- Hover：行/按钮 100ms 背景过渡。
- 焦点：保留浏览器 focus ring（`--dsw-focus-ring-*`）。
- 空态/错误态/加载态：每个 tab 都有明确文案；错误不覆盖已有数据。
- 无自定义键盘处理；tab 用原生 `<button>`。
- 不写 `document.body/head`；样式在面板内以 `<style>` 渲染。
- 不 import Harness Client 包。

---

## 5. 官方 API 清单

| 方法 | 用途 | 当前状态 |
|---|---|---|
| `ctx.slots.inject/register` | 所有 UI 座位 | 已用 |
| `ctx.effect` | 定时器/样式/注册清理 | 已用 |
| `ctx.sidebarRightTabs.register` | 右侧栏 tab 类型 | 已用 |
| `ctx.sidebarRight.openTabIn/openTab` | 胶囊打开工作台 | 已用 |
| `ctx.locale.bind/register` | 可见文案 | **未用（P1）** |
| `--dsw-alias-*` | 颜色/边框/文字 | 已用 |
| `--dsw-radius-*` | 圆角 | 已用 |
| `--ds-font-family-code` | 代码字体 | 已用 |
| `locale/*.json` + `./icon` | Plugin Manager 显示 | **未做（P1）** |

---

## 6. 实施阶段

### P0：已完成

- 四 tab 工作台（破甲 / Case / 拦截 / 关于）。
- 头部胶囊 + 右侧栏 tab + 浮层，共用同一组件。
- 星标卡迁到 `shell.overlay`。
- 删除设置页健康卡片。
- 样式改为面板内 `<style>`；只用 token。
- `node --check` + 16 项 checks 通过。

### P1：官方显示/文案

1. `exports.inject` 增加 `locale`。
2. `ctx.effect(() => ctx.locale.register(NS, { zh, en }), "helmd: dictionaries")`。
3. 所有可见文案走 `t("...")`；slot 注册加 `label`/`locale`。
4. 新增 `locale/zh.json`、`locale/en.json`（`meta.title`/`meta.description`），`package.json` 加 `description`、`./locale/*.json`、`./icon`、`files`。
5. 提供原创 `icon.svg`（≤256 KiB）。

### P2：可选

- 快捷键打开工作台（`ctx.shortcuts`）。
- 若需要完整设置页，注册 `settings.plugins.tab`（不是 `settings.plugin.item`）。
- 头部胶囊的 `priority: -1` 复核；官方 agent-preset 只用 `id/order/locale`。

---

## 7. 验收清单

- [ ] 右侧栏 tab 出现，标题/图标正确。
- [ ] 胶囊点击打开浮层并展开 sidebar。
- [ ] 四 tab 在真实宿主渲染，console 无 `slot entry crashed`。
- [ ] 破甲切换返回 200，`profile.json` 更新，下一次调用生效。
- [ ] Case 统计/假设与 API 一致。
- [ ] 拦截计数与日志路径正确。
- [ ] light/dark 都正常，与相邻宿主页面视觉一致。
- [ ] 无字面色值、无 Client 包 import、无 `document.body/head` 写入。
- [ ] `locale/*.json` 与 `icon` 在 Plugin Manager 显示正常。
- [ ] `pnpm test:checks` 16 PASS。

> 按 `references/verification.md`：mock 页面截图不算验证；没有连接宿主页面时，只报告语法、slot 注册与静态审计结果。
