# 维护指南（MAINTENANCE）

面向 helmd 仓库维护者的操作手册：改什么、怎么发、哪里有坑。所有流程均在本仓库实测过。

---

## 1. 架构速查

```
用户会话
   └── Preset (~/.dsh/.agent-presets/helmd/)     ← 人格 + 工具配置（激活层）
          └── 引用 @dsh-security/helmd bundle
                 └── Profile (~/.dsh/profiles/web/node_modules/)  ← 包（能力层）
```

| 层 | 谁写入 | 内容 |
|----|--------|------|
| Profile | `dsh plugin add` / install.ps1 / update.ps1 | 31 个工具（case 流程 6 + router 4 + 领域 21）、bootstrap 收窄、references、scripts |
| Preset | `setup-preset` 脚本 / install.ps1 [3/4] | luna persona、激活词 `helmd`、全套工具 section |

**单一事实源表**

| 数据 | 唯一编辑点 | 自动流向 |
|------|-----------|---------|
| persona 文本 | `packages/helmd/presets/persona.txt` | repack 经 `scripts/gen-preset.mjs` 注入 → `presets/full-reverse/agent.cordis.yml`（生成物）→ 包内镜像 → tgz |
| preset 平台行 | **不存在**——从宿主内置 standard 派生 | `gen-preset.mjs` 读宿主 `<dsh>/config/agent-presets/standard/agent.cordis.yml` 原文，仅覆写 persona 段 + 追加 helmd 行；**安装/更新脚本在目标机再次生成**（bundle 内 `scripts/gen-preset.mjs` 走 `--out`），生成失败才退回 tgz 快照 |
| 工具代码 | `packages/helmd/src/*.ts` | `pnpm build` → dist |
| 领域文档 | `packages/helmd/references/` | 直接打包 |
| 安装脚本 | 根目录 `install.{ps1,sh,bat}` | release assets（不进 tgz） |
| 更新脚本 | `scripts/update.{ps1,sh}` | 仅仓库，随 git 分发 |

> ⚠️ **禁止手改任何位置的 `agent.cordis.yml`**。手抄平台行会在宿主升级后漂移——2026-08-26 事故（组装出 44 工具的残废目录、宿主平台工具全失）即由此而来，见 `docs/incident-2026-08-26-preset-stale-generation.md`。生成器内建断言：行集合 ≡ 宿主 standard + persona + helmd、无重复 id、非触碰区逐字节守恒，违者构建即红。

## 2. 发布流程（checklist 式）

```powershell
# 0. 改完代码后
git status --porcelain            # 必须干净

# 1. bump 版本号（唯一位置）
node -e "const fs=require('fs');const p='packages/helmd/package.json';const pkg=JSON.parse(fs.readFileSync(p,'utf8'));pkg.version='X.Y.Z';fs.writeFileSync(p,JSON.stringify(pkg,null,2)+'\n')"

# 2. 打包（自动同步 preset 源）
.\scripts\repack.ps1              # 输出 dsh-security-helmd-X.Y.Z.tgz + helmd.tgz 别名

# 3. 本地验证安装（见 §5 坑位表——同版本会被 pnpm 跳过！）
dsh plugin --profile web add "<绝对路径>\dist-tgz\helmd.tgz"

# 4. tag + push
git tag -a vX.Y.Z -m "..."
git push && git push origin vX.Y.Z

# 5. release —— 资产五件套缺一不可：
gh release create vX.Y.Z `
  "dist-tgz\dsh-security-helmd-X.Y.Z.tgz" `
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

## 3. 改人格 / preset 的流程

1. **只编辑 `packages/helmd/presets/persona.txt`**（人格文本单源）。preset.yml 可直接编辑。**不要手改任何 `agent.cordis.yml`**——它是生成物
2. `.\scripts\repack.ps1`（自动执行 gen-preset 生成 + 镜像到 `packages/helmd/presets/`）
3. 本机生效二选一：
   ```powershell
   # 方式 A：重装 bundle 后跑 setup（模拟商店用户路径）
   & "$env:USERPROFILE\.dsh\profiles\web\node_modules\@dsh-security\helmd\scripts\setup-preset.ps1"
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
- 当前计数基准：31 个工具（case 流程 4 + find_tool/save_evidence + router 4 + 领域 21；create_case 已废弃）。核对方法：
  ```powershell
  # mock ctx 捕获全部注册名（见 git log 00c081a 之前的测试脚本）
  ```
- fork `ADWMC/awesome-dsh-plugin`：PR 合并后即可删（`gh repo delete --yes`）；再提 PR 时重新 fork 即可

## 5. 已知坑位表（全部踩过）

| 坑 | 症状 | 对策 |
|----|------|------|
| pnpm 同版本跳装 | add 显示 Done 但内容没换 | bump 版本，或删 `profiles\web\node_modules\@dsh-security\helmd` + 删 deps 条目再 add |
| 相对路径 ENOENT | `dsh plugin add ..\x.tgz` 找不到文件 | dsh 在 profile 目录里解析路径，**永远绝对路径** |
| `node -e` argv 索引 | 内联脚本报 bad-path/静默失败 | `-e` 模式参数从 `process.argv[1]` 起；脚本文件模式才是 `[2]` |
| PowerShell `(if ...)` 表达式 | PS5 运行时报 "'if' is not recognized" | if 结果赋变量再拼接；发布前用 Parser::ParseFile 验语法 |
| GitHub API 匿名限流 | update.ps1 报 403 | `$env:GH_TOKEN = gh auth token` 再跑 |
| bash 测 Windows 路径 | WSL 报 No such file | 用 `/mnt/c/...` 形式传给 `bash -n` |
| 强降级 | dev 新版被 latest release 覆盖 | update 脚本自带守卫；绕过需显式 `-AllowDowngrade` |
| 手抄 preset 平台行 | 宿主升级后 standing mount 重建出残废工具目录（2026-08-26：44 工具、零平台工具、bootstrap 两件套消失） | preset 一律由 `gen-preset.mjs` 从宿主 standard 派生；部署新 preset 后**必须**开测试会话断言（§8 护栏） |

## 6. 更新脚本用法（自用/分发同一套）

```powershell
.\scripts\update.ps1                # 有新版才更新（含旧包卸载）
.\scripts\update.ps1 -CheckOnly     # 只看两版号
.\scripts\update.ps1 -Force         # 等版本强制重装
./scripts/update.sh [--check|--force|--allow-downgrade]
PROFILE=headless ./scripts/update.sh   # 非 web profile
```

update 每次运行都执行旧包清扫：剥 deps 里非 helmd 的 `@dsh-security/*` 条目 + 删 node_modules 残留（含 pnpm tmp 目录）。

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
- [ ] mock-ctx 工具数与 README/registry 一致
- [ ] `repack` 后 tgz 内含 `presets/` + `scripts/setup-preset.*`
- [ ] setup-preset 从安装位置跑通且与 `presets/full-reverse/` 逐字节一致
- [ ] release 五件资产齐全 + 稳定别名 200
- [ ] **preset 护栏**（每次改动 agent.cordis.yml 产物后）：新开 helmd-preset 测试会话，读首条 `request/header`——首轮 tools 恰为 `[pwsh, read]`（win32），晋升后全量目录含 helmd 域工具 + 平台工具且 ≥60 个。不达标立即回滚 `.bak` 并查 `docs/incident-2026-08-26-preset-stale-generation.md` §4
