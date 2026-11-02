# helmd 交互与 UI/UX 架构全面重构方案：从插件干扰到宿主原生复刻

> **版本**：v1.1.0  
> **源码基线**：`deepseek-harness-dsh-v0.1.5-rc.2`（解压自 `E:\Downloads\deepseek-harness-dsh-v0.1.5-rc.2.zip`）  
> **核心原则**：源码级真实（Source-Truth）、零外部污染（Zero Intrusion）、100% 复刻 DSH 官方 UI/UX 标准（Token-Aligned）。

---

## 1. 现状痛点根因分析与“干扰其他插件”真相

用户指出：“**而且我们这个在设置插件的明显干扰了其他的用 不能按照官方做吗，UI的设计也不行 我现在需要你去读dsh源码和文档 找到入口 解决方法 UI UX设计方案的复刻 全部要写到一个文档里面**”。

结合用户上传的截图以及官方源码 `packages/client/ui-settings-plugins` 和 `packages/client/ui-settings-general`，我们定位出导致界面丑陋与侵入性干扰的**三大根本性缺陷**：

### 1.1 缺陷一：霸占公用 `settings.plugin.item` 顶层列表（排挤官方插件）
- **官方源码设计**（`packages/client/ui-settings-plugins/src/client/tab-store.ts` 第 25 行）：
  > “The tab enumerates settings namespaces but never interprets one — a card arrives through `settings.plugin.item` keyed by the namespace it edits, so a plugin that ships a browser half owns its own card and this tab only decides which keys to dispatch.”
- **现有违规代码**（`packages/helmd/client.js` 第 1013–1014 行）：
  ```javascript
  ctx.slots.register({ name: "settings.plugin.item", key: "helmd" }, HelmdHealthCard);
  ctx.slots.register({ name: "settings.plugin.item", key: "hcot" }, HcotSettingsCard);
  ```
- **破坏后果**：
  在「插件配置」（`configurable`）标签页中，官方插件（如“终端 Bash”、“Agent 循环”、“网页搜索”）全部是可折叠的规范卡片（`PluginCard`）。而 `helmd` 却在这里强行挂载了两个**始终完全展开、写死大面积键值对**的静态 `<li>` 卡片，霸占了最顶部的视口，直接破坏了下方官方卡片（如截图中的“终端”）的排版节奏，导致用户无法顺畅浏览和操作其它插件设置。

### 1.2 缺陷二：H-CoT“割裂孤岛”与入口冲突（单个小窗口打架）
- **现有违规代码**：
  - 在设置页里放 `HcotSettingsCard`（只有死文本，无交互）；
  - 在右侧栏注册 `sidebar.right.pane.tab`（狭窄 300px 侧栏）；
  - 在左侧边栏强行插一个 `sidebar.panellist`；
  - 还在中央工作区抢占 `main`；
- **破坏后果**：
  各入口互相争抢、重复挂载，功能割裂成一个个“单个小窗口”，无法在真实对话流中形成合力，既缺乏工具列表联动，也没有审计日志与状态看板。

### 1.3 缺陷三：自造样式未继承官方设计系统（视觉割裂）
- **官方规范**（见 `packages/client/ui-settings-plugins/src/client/PluginCard.module.css`）：
  - 外壳：`border: 0.5px solid var(--dsw-alias-border-l4); border-radius: 16px; background: var(--dsw-alias-bg-layer-3);`
  - 展开态：`background: var(--dsw-alias-bg-layer-2); border-color: var(--dsw-alias-label-dimmed);`
  - 交互：带标准的 14px Chevron 旋转动画（`rotate(180deg)`）、右上角轻量 Tag。
- **现有违规样式**：
  采用写死的 `liStyle = { border: '1px solid ...', borderRadius: 10, background: T.bg1 }`，导致背景黑灰发硬、无折叠动效、字阶错位，视觉极不协调。

---

## 2. 官方源码 UI 入口与扩展点（Slot Architecture）

基于 `packages/client/*` 源码，DSH 官方标准前端扩展矩阵如下：

| 扩展槽位 (Slot Name) | 所属包 | 官方设计意图 | helmd 正确集成策略 |
|---|---|---|---|
| `settings.plugin.item` | `ui-settings-plugins` | 插件自身设置项（单行/折叠） | **遵循官方 `PluginCard`**，默认单行折叠，带 Chevron 下拉，绝对不占空间 |
| `settings.plugins.tab` | `ui-settings-plugins` | 「插件」大类下的子标签页（已有 `configurable`, `all`） | **新增 `[安全分析 & H-CoT]` 独立 Tab**，将重型状态与工作台收敛于此，零污染通用页 |
| `sidebar.right.pane.tab` | `ui-sidebar-right` | 会话右侧停靠面板（多合一抽屉） | **打造统一会话工作台**（H-CoT 注入 + 19+ 逆向工具货架 + 拦截审计监控） |
| `sidebar.right.pane.tab.title` | `ui-sidebar-right` | 右侧停靠标签的标题与图标 | 纯净图标与标签文本绑定 |
| `ctx.commands` | `dsh-commands` / `ui-commands` | 输入框斜杠命令（`/` 菜单） | **注册 `/tools` 与 `/status`**，实现零 Token 毫秒级呼出 |

---

## 3. UI/UX 官方设计语言（Design Token）100% 精确复刻

我们直接从 `packages/client/ui-settings-plugins/src/client/PluginCard.module.css` 提取官方原生样式变量：

```css
/* 官方 PluginCard 样式精确复刻 */
.dsh-plugin-card {
  list-style: none;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: 16px;
  background: var(--dsw-alias-bg-layer-3);
  transition: border-color 0.16s, background 0.16s;
  margin-bottom: 8px;
}

.dsh-plugin-card:hover {
  border-color: var(--dsw-alias-label-dimmed);
}

.dsh-plugin-card-open {
  background: var(--dsw-alias-bg-layer-2);
  border-color: var(--dsw-alias-label-dimmed);
}

.dsh-plugin-header {
  width: 100%;
  appearance: none;
  border: 0;
  background: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 12px;
  text-align: left;
}

.dsh-plugin-title {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--dsw-alias-label-primary);
}

.dsh-plugin-desc {
  font-size: 13px;
  line-height: 1.5;
  color: var(--dsw-alias-label-tertiary);
}

.dsh-plugin-chevron {
  color: var(--dsw-alias-label-tertiary);
  transition: transform 0.16s ease;
}

.dsh-plugin-chevron-open {
  transform: rotate(180deg);
}

.dsh-plugin-body {
  border-top: 0.5px solid var(--dsw-alias-border-l2);
  margin: 0 16px;
  padding: 12px 0 16px;
}
```

---

## 4. 全套解决方案实施计划

### 4.1 方案 A：设置页彻底去侵入（立即解决用户截图痛点）
1. **重构 `HelmdHealthCard`**：
   - 转换为 100% 官方折叠式的 `PluginCard` 结构。
   - 默认折叠：仅展示 `helmd 安全分析包` + 状态 Tag（`健康`）+ 单行小字描述，高度由原先的 400px+ 压缩为 52px，**不再排挤下方的“终端”等插件**。
   - 点击整行平滑展开：展示指纹、部署版本、自动修复状态及审计路径。
2. **将 H-CoT 工作台剥离通用配置，注册专属 Tab**：
   - 注册 `settings.plugins.tab`（`id: "helmd-security"`, `label: "安全分析 & H-CoT"`）。
   - 在设置页顶部与 `[插件配置]`、`[插件列表]` 并列展示，点开后为完整的全屏安全控制台。

### 4.2 方案 B：右侧栏升级为【一体化安全工作台】（解决割裂感与查看工具需求）
在右侧栏 `sidebar.right.pane.tab` 注册多功能选项卡，不再是单一狭窄窗口：
1. **Tab 1: 破甲与状态注入 (H-CoT Console)**：
   - 当前会话联动锁定，四大破甲支柱一键切换执行。
2. **Tab 2: 逆向工具货架 (Tool Matrix & Shelf)** —— *直接满足“看工具列表”*：
   - 聚合 19+ 官方内置安全工具，按 `Android`、`Native / 二进制`、`Web / 小程序`、`协议 / 抓包`、`恶意代码 / AI` 结构化展示。
   - 包含工具职责、本地安装检测状态、命令范式，点击即可一键插入输入框！
3. **Tab 3: 流式拦截与审计日志 (Interception & Audit)**：
   - 实时监控流式拒答拦截次数与最近事件。
   - 一键查看或清空 `~/.dsh/helmd-stream-intercept.log`。

### 4.3 方案 C：交互激活词与快捷命令系统
1. **斜杠命令（零 Token，瞬时直达）**：
   - `/tools`：在会话中直接以优雅 Markdown 表格列出所有可用工具及使用指南。
   - `/status`：查看当前工作区 Case、指纹健康与审计日志。
   - `/hcot [goal]`：快速调度思维链注入。
2. **自然语言激活短语**：
   - 当用户在聊天框发送 `helmd tools`、`工具列表`、`查看工具` 时，输入层自动结构化响应，输出官方货架卡片。

---

## 5. 验证与交付标准

1. **视觉与布局验收**：
   - 刷新 DSH 设置页，确认 `helmd` 卡片变为与“终端”完全一致的折叠卡片，下方官方插件无任何挤压变形。
   - 确认设置页出现独立的 `[安全分析 & H-CoT]` Tab。
2. **功能与工具货架验收**：
   - 右侧栏打开工作台，能流畅切换“破甲”、“工具列表”、“拦截日志”。
   - 在输入框键入 `/tools` 或在对话中输入 `工具列表`，能清晰列出 19+ 工具。
3. **自动化门禁全绿**：
   - `pnpm test:checks` (13 PASS)，无任何构建错误。
