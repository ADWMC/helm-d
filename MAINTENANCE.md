# 维护指南（MAINTENANCE）

面向 helmd 仓库维护者的操作手册：改什么、怎么发、哪里有坑。所有流程均在本仓库实测过。

---

## 1. 架构速查

```
用户会话
   └── Preset (~/.dsh/.agent-presets/helmd/)     ← 人格 + 工具配置（激活层）
          └── 引用 @adwmc/helm-d bundle
                 └── Profile (~/.dsh/profiles/web/node_modules/)  ← 包（能力层）
```

| 层 | 谁写入 | 内容 |
|----|--------|------|
| Profile | `dsh plugin add` / install.ps1 / update.ps1 | 33 个工具（router 4 + 账本 1 + 案件生命周期 5 + 工具发现 1 + 领域 22）、`/hcot` 内部命令、bootstrap 收窄、运行时钩子层（tool-wash / persist / advisory / hcot / llm-stream）、references、scripts、工作台 UI |
| Preset | `setup-preset` 脚本 / install.ps1 [3/4] | luna persona、激活词 `helmd`、全套工具 section |

**单一事实源表**

| 数据 | 唯一编辑点 | 自动流向 |
|------|-----------|---------|
| persona 文本 | `packages/helmd/presets/persona.txt` | repack 经 `scripts/gen-preset.mjs` 注入 → `presets/full-reverse/agent.cordis.yml`（生成物）→ 包内镜像 → tgz |
| preset 平台行 | 宿主内置 `standard` | `gen-preset.mjs` 读取宿主 `<dsh>/.../dsh-agent-presets/presets/standard/agent.cordis.yml`，保留平台行并整体替换 persona，末尾追加 `@adwmc/helm-d` 行（agent 面主插件由 preset 声明）。安装/更新脚本在目标机再次生成（bundle 内 `scripts/gen-preset.mjs` 走 `--out`），生成失败才退回 tgz 快照 |
| 工具代码 | `packages/helmd/src/*.ts` | `pnpm build` → dist |
| 依赖 cohort | `pnpm-workspace.yaml` `overrides`（宿主 dsh 0.1.5-rc.2 全家 + cordis + schemastery） | `pnpm install` → `pnpm-lock.yaml` + node_modules；`pnpm peers check` 必须无问题（跨 cohort peer = 迁移未完成） |
| 领域文档 | `packages/helmd/references/` | 直接打包 |
| H-CoT 语料与账本 | 语料 `packages/helmd/scripts/ai-security/h_cot_variants.json`（纯数据）；结果账本 `~/.dsh/helmd-tools/h_cot_results.jsonl`（`HELMD_TOOLS_DIR` 可重定向） | 引擎直接读写；账本经工作台或 `/hcot` 清理/分组删除 |
| 工作台 UI | `packages/helmd/client.js`（浏览器半，免构建）+ `src/hcot-settings.ts`（host 半，`pnpm build`）+ `cordis.patch.yml` 的 `dsh.client.inject` | settings `hcot` 命名空间是唯一通道：UI 写配置/动作请求，宿主消费并回写运行态 |
| 安装脚本 | 根目录 `install.{ps1,sh,bat}` | release assets（不进 tgz） |
| 更新脚本 | `scripts/update.{ps1,sh}` | 仅仓库，随 git 分发 |

> ⚠️ **禁止手改任何位置的 `agent.cordis.yml`**。平台行必须从当前宿主 `standard` 生成，否则 `pwsh`、`read` 等工具会缺失或在升级后漂移。两面的归属是分开的：host 面 `cordis.patch.yml` 挂**裸包名** `helm-d`（导出解析到 `dist/health.js`，只注册设置命名空间），agent 面主插件由 preset 末行的 `@adwmc/helm-d/agent` 声明（2026-09-11 起如此。此前 host 行写深路径 `helm-d/dist/health.js`，宿主 `client-modules` 的 `exactPackageSpecifier` 只认 `@scope/name` 两段，于是包的 `dsh.client` 从未被发现、设置卡片永远不出现——浏览器半边不是没跑，是没进模块图）。生成器内建断言：输出行集合 = 宿主 standard 行 + `helmd`、无重复 id、且 `helm-d` 恰好出现一次，违者构建即红。

## 2. 发布流程（checklist 式）

```powershell
# 0. 改完代码后
git status --porcelain            # 必须干净

# 1. bump 版本号（唯一位置）
node -e "const fs=require('fs');const p='packages/helmd/package.json';const pkg=JSON.parse(fs.readFileSync(p,'utf8'));pkg.version='X.Y.Z';fs.writeFileSync(p,JSON.stringify(pkg,null,2)+'\n')"

# 2. 打包（自动同步 preset 源）
.\scripts\repack.ps1              # 输出 adwmc-helm-d-X.Y.Z.tgz + helmd.tgz 别名

# 3. 本地验证安装（见 §5 坑位表——同版本会被 pnpm 跳过！）
dsh plugin --profile web add "<绝对路径>\dist-tgz\helmd.tgz"

# 4. tag + push
git tag -a vX.Y.Z -m "..."
git push && git push origin vX.Y.Z

# 5. release —— 资产五件套缺一不可：
gh release create vX.Y.Z `
  "dist-tgz\adwmc-helm-d-X.Y.Z.tgz" `
  "dist-tgz\helmd.tgz" `
  "install.ps1" "install.sh" "install.bat" `
  --title "..." --notes-file "release-notes-X.Y.Z.md"
Remove-Item "release-notes-X.Y.Z.md"

# 6. 发布后核验（三条都要绿）
gh api repos/ADWMC/helm-d/releases/latest -q '.tag_name, (.assets|length)'   # = X.Y.Z, 5
Invoke-WebRequest -Method Head "https://github.com/ADWMC/helm-d/releases/latest/download/helmd.tgz"  # 200
.\scripts\update.ps1                                                          # installed == latest
```

> ⚠️ **历史事故**：v0.1.6 创建时漏传了 installer 三件套。第 5 步的五件资产是硬性清单。
>
> ⚠️ **改名记录（@dsh-security/helmd → @adwmc/helm-d，2026-09）**：无 scope 的 `helm-d` 被 npm
> 以防拼写抢注拒绝（与 helmet 过近），定名 `@adwmc/helm-d`。update 脚本已改为下载稳定别名
> `helmd.tgz`，与版本化资产名解耦——release 资产保持五件：`adwmc-helm-d-X.Y.Z.tgz` +
> `helmd.tgz` 别名 + installer 三件套。

## 3. 改人格 / preset 的流程

1. **只编辑 `packages/helmd/presets/persona.txt`**（人格文本单源）。preset.yml 可直接编辑。**不要手改任何 `agent.cordis.yml`**——它是生成物
2. `.\scripts\repack.ps1`（自动执行 gen-preset 生成 + 镜像到 `packages/helmd/presets/`）
3. 本机生效二选一：
   ```powershell
   # 方式 A：重装 bundle 后跑 setup（模拟商店用户路径）
   & "$env:USERPROFILE\.dsh\profiles\web\node_modules\@adwmc\helm-d\scripts\setup-preset.ps1"
   # 方式 B：直接把生成物覆盖到现役 preset 目录（stamp 变化 ⇒ 下个会话重建 mount）
   Copy-Item .\presets\full-reverse\agent.cordis.yml "$env:USERPROFILE\.dsh\.agent-presets\helmd\agent.cordis.yml" -Force
   ```
4. 重启会话选 `helmd` preset 验证（见 §8 护栏断言）

> 单源规则：persona.txt 一处编辑，其余全部自动派生。若发现第三份 persona 文本，即为 bug。
>
> 宿主升级后必须重跑一次 repack（或 `node scripts\gen-preset.mjs && node scripts\gen-preset.mjs --check`），否则生成物还停留在旧宿主形状。`gen-preset --check` 非 0 时**区分两种过期**：
> - **`HOST UPGRADED`**（生成物头部指纹 `# gen-preset: host=<sha256>` 与现宿主 standard 不一致）＝宿主 dsh 已升级，平台行过期，重新生成/重装即可；
> - **`STALE … content drifted`**（指纹一致但产物与生成不符）＝persona.txt 或手改导致漂移，走本流程第一步同步。

## 4. Registry（awesome-dsh-plugin）维护

- 入口文件：上游 `data/plugins/ADWMC__helm-d--packages-helmd.yml`（subpackage 形态，monorepo 必须）
- 描述里的**数字声明会被 reviewer 和 decay scan 对照代码核验**（工具数、版本号）。改了工具集必须同步：
  - README.md / README.en.md 的徽章行和目录树行
  - registry yml 的 en/zh description（需向上游提 PR）
- 当前计数基准：33 个工具（router 4 + tool_memory 1 + 案件生命周期 5（含 save_evidence）+ find_tool 1 + 领域 22；create_case 已废弃）。核对方法：`pnpm test:checks` 里的 `tool-catalog` 检查——它读本行声明的数字与 mock-ctx 实际注册名比对，不一致即红（改工具集而忘了改文档会当场失败）。
- fork `ADWMC/awesome-dsh-plugin`：PR 合并后即可删（`gh repo delete --yes`）；再提 PR 时重新 fork 即可

## 5. 已知坑位表（全部踩过）

| 坑 | 症状 | 对策 |
|----|------|------|
| pnpm 同版本跳装 | add 显示 Done 但内容没换 | bump 版本，或删 `profiles\web\node_modules\@adwmc\helm-d` + 删 deps 条目再 add |
| 相对路径 ENOENT | `dsh plugin add ..\x.tgz` 找不到文件 | dsh 在 profile 目录里解析路径，**永远绝对路径** |
| `node -e` argv 索引 | 内联脚本报 bad-path/静默失败 | `-e` 模式参数从 `process.argv[1]` 起；脚本文件模式才是 `[2]` |
| PowerShell `(if ...)` 表达式 | PS5 运行时报 "'if' is not recognized" | if 结果赋变量再拼接；发布前用 Parser::ParseFile 验语法 |
| GitHub API 匿名限流 | update.ps1 报 403 | `$env:GH_TOKEN = gh auth token` 再跑 |
| bash 测 Windows 路径 | WSL 报 No such file | 用 `/mnt/c/...` 形式传给 `bash -n` |
| 强降级 | dev 新版被 latest release 覆盖 | update 脚本自带守卫；绕过需显式 `-AllowDowngrade` |
| 手抄 preset 平台行 | 宿主升级后 standing mount 重建出残废工具目录（2026-08-26：44 工具、零平台工具、bootstrap 两件套消失） | preset 一律由 `gen-preset.mjs` 从宿主 standard 派生；部署新 preset 后**必须**开测试会话断言（§8 护栏） |
| 重复运行安装器 | preset 内容未变也会触发 standing mount 重建，运行中宿主可能报 `already registered` | 生成器对相同内容保持文件 mtime；内容实际变化后仍须重启 dsh 再开新会话 |
| 以为插件会盲修 preset | 有指纹头（`STALE` / `HOST_UPGRADED`）的开机自动重生成；无指纹头（`LEGACY_PRESET`）只报告 | 自动修复只认"能证明是本包产物"的文件（指纹头即证明），写前留 `.bak`，改完仍须重启 + §8 断言；`HELMD_AUTO_HEAL=0` 全部只报告，`=1` 连手写文件也覆盖 |

## 6. 更新脚本用法（自用/分发同一套）

### 终端调用契约

- Windows 会话的原生终端工具名是 `pwsh`，需要执行 PowerShell、文件、进程、
  包管理或网络命令时直接调用它。
- WSL 不是独立的 helmd 工具；通过 `pwsh` 执行 `wsl.exe -- bash -lc 'command'`，
  指定发行版时使用 `wsl.exe -d <distro> -- ...`。
- Linux 会话使用工具列表中的 `bash`。不要因为不存在 `powershell`、`shell`、
  `exec` 或 `terminal` 这些别名，就推断终端不可用。

```powershell
.\scripts\update.ps1                # 有新版才更新（含旧包卸载）
.\scripts\update.ps1 -CheckOnly     # 只看两版号
.\scripts\update.ps1 -Force         # 等版本强制重装
./scripts/update.sh [--check|--force|--allow-downgrade]
PROFILE=headless ./scripts/update.sh   # 非 web profile
```

update 每次运行都执行旧包清扫：剥 deps 里非 helmd 的 `@helm-d/*` 条目 + 删 node_modules 残留（含 pnpm tmp 目录）。

## 7. 本机环境速查

```
repo            C:\Users\Administrator\Documents\GitHub\helm-d
registry fork   D:\Reverse\awesome-dsh-plugin（origin=fork，upstream=awesome-dsh-plugin/awesome-dsh-plugin）
profile         %USERPROFILE%\.dsh\profiles\web\
preset          %USERPROFILE%\.dsh\.agent-presets\helmd\
tgz 缓存        %USERPROFILE%\.dsh\.tgz-cache\
稳定别名        https://github.com/ADWMC/helm-d/releases/latest/download/helmd.tgz
商店页          https://dshmarket.com/p/ADWMC/helm-d--packages-helmd/
PR #2708        已合并 (2026-08-23)
当前版本        见 packages/helmd/package.json（以它为准，勿信记忆）
```

## 8. 改动后必须过的验证

- [ ] `pnpm build` 无错
- [ ] `pnpm peers check` 无问题（依赖图 cohort 与宿主一致，无跨 cohort peer）
- [ ] `pnpm test:checks` 全部绿（自动跑 `scripts/checks/*.check.mjs`；host seam 那几份直接跑在宿主真实 `dsh-session` 包上，宿主换访问器即红，不必等真机会话才暴露）
- [ ] 手工验收脚本（不进 run-all，按需跑）：`node scripts/checks/hcot-engine-verify.mjs`（Node 引擎 SSE 端到端：mock /chat/completions，拒绝→突破）、`node scripts/checks/hcot-workspace-verify.mjs`（client.js 契约 + 工作台插槽渲染）、`node scripts/checks/hcot-perf-bench.mjs`（evidence/advisory 热点性能基准）、`node scripts/checks/session-timing.mjs`（解压 session.v3.jsonl.zstd 做 step/turn 耗时归因）
- [ ] mock-ctx 工具数与 README/registry 一致（由 `pnpm test:checks` 的 `tool-catalog` 机械核对，无需手数）
- [ ] `repack` 后 tgz 内含 `presets/` + `scripts/setup-preset.*`
- [ ] setup-preset 从安装位置跑通且与 `presets/full-reverse/` 逐字节一致
- [ ] release 五件资产齐全 + 稳定别名 200
- [ ] **preset 护栏**（每次改动 agent.cordis.yml 产物后）：新开 helmd-preset 测试会话，读首条 `request/header`——首轮 tools 恰为 `[pwsh, read]`（win32），晋升后全量目录含 helmd 域工具 + 平台工具且 ≥60 个。不达标立即回滚 `.bak` 并查 `docs/incident-2026-08-26-preset-stale-generation.md` §4
  - 产物结构那一半已自动跑：自动修复后 `health.autoHeal` 会带 `artifact check OK (N rows …)`（行集合 = 宿主 standard + helmd、无重复 id、helmd 行恰好一次、persona 激活行在）——失败会写成 `ARTIFACT CHECK FAILED: …`
  - 真机会话那一半（首轮 `[pwsh, read]`）仍需操作者手跑：它要在重启后的宿主里发起请求，无法由宿主进程自证
