# Android Magisk Module 分析

## 触发条件

分析 Magisk / KernelSU / APatch 模块 ZIP/仓库时。特征：
- `module.prop` (模块元数据)
- `post-fs-data.sh` / `service.sh` (开机脚本)
- `customize.sh` (安装器，Magisk API)
- `bin/` 下含 ELF 二进制（arm64-v8a/x86_64）
- 路径含 `tricky_store`, `magisk`, `apatch`, `kernelsu`

---

## 快速识别

```
grep_prop id "$TMPDIR/module.prop"         # 模块 ID
grep_prop name "$TMPDIR/module.prop"       # 显示名
grep_prop versionCode "$TMPDIR/module.prop" # 版本码
```

判断 root 管理器：
```
post-fs-data.sh 检测顺序：
  [ -n "$APATCH" ] → APatch
  [ -n "$KSU" ]   → KernelSU  
  [ -n "$MAGISK_VER_CODE" ] → Magisk
```

---

## 分析流程

### 1. 文件结构映射

标准模块：
```
├── module.prop          # 核心元数据
├── customize.sh         # 安装入口（Magisk API）
├── service.sh           # 守护启动
├── post-fs-data.sh      # 早期启动（root 管理器检测、模块隐藏）
├── prop.sh              # 属性伪装（可选）
├── action.sh            # WebUI 入口（可选）
├── uninstall.sh         # 卸载清理
├── bin/                 # ELF 二进制（按 ABI 分目录）
├── common/              # 共享资源（证书、服务端）
├── webui/               # Vue/React 前端
└── metadata/            # 附加数据
```

### 2. module.prop 解析

```bash
id=TA_enhanced                       # 模块 ID（文件系统路径名）
name=Tricky Addon Enhanced           # 显示名
version=v5.53.1                      # 版本
versionCode=50058                    # 版本码（数字）
author=EngineX0                       # 作者
description=Enhanced TrickyStore...  # 描述
updateJson=https://...               # 自动更新
banner=banner.png                    # 横幅图
```

### 3. customize.sh 分析重点

1. **root 管理器检测** — 通过环境变量 `$APATCH`, `$KSU`, `$MAGISK_VER_CODE`
2. **冲突模块检测** — 遍历 `/data/adb/modules/` 删除竞争模块
3. **键箱/密钥获取** — 从远程下载并安装敏感数据
4. **二进制验证** — 检查 ELF 是否能在设备运行
5. **区域信息快照** — 捕获 `ro.boot.hwc` 等设备区分信息

### 4. service.sh 分析重点

1. **模块自隐藏** — Magisk 用点前缀隐藏（`.TA_enhanced`）
2. **二进制启动** — 后台 daemon 启动
3. **键箱获取重试** — 启动时指数退避重试获取远程 keybox
4. **rc 文件分发** — 二进制/库文件拷贝到持久路径
5. **符号链接管理** — 挂载 WebUI、action 等

### 5. post-fs-data.sh 分析重点

1. **TrickyStore 存在性检测** — 核心依赖缺失则自删
2. **rc 文件清理** — 旧会话残留清理
3. **root 管理器持久化** — 写入 manager.sh 供 service.sh 使用
4. **热安装触发** — hotinstall.sh 被调用 post-fs-data + service

---

## 常见安全风险模式

### 高级持续威胁 (Root 模块场景)

| 模式 | 文件 | 风险 | 分析要点 |
|------|------|------|---------|
| 进程伪装 | `rust/src/platform/process.rs` | 反取证 | `prctl(PR_SET_NAME)` + `/proc/self/mem` 覆写 |
| 模块自隐藏 | `service.sh:27-43` | 躲避检测 | 点前缀复制 + 删除原始 module.prop |
| 竞争清除 | `customize.sh:55-76` | 损害用户环境 | `rm -rf` 不经确认直接删除 |
| 远程键箱 | `keybox/sources.rs` | 中间人 | HTTPS 获取但源可控 |
| WebUI 冲突扫描 | `customize.sh:70-76` | 竞争排除 | 扫描特定包名并清除 |
| 服务停止 | `prop.sh:65-67` | 影响系统功能 | 主动停止第三方服务 |

### 敏感 API 使用

- `setprop` / `resetprop` — 属性伪装
- `pm` (package manager) — 包安装/卸载/路径查询
- `killall` / `am force-stop` — 进程终止
- `pm path` — 包路径解析
- `magisk --denylist ls` — 获取 denylist
- `am start ... -e` — 启动 Activity 传参

---

## Rust Daemon 架构模式

现代高级 Magisk 模块常用 Rust daemon 替代 shell 脚本：

```
单进程 Rust daemon
├── epoll 事件循环（signal + inotify + timer）
├── 后台任务调度（keybox/secpatch/status/health/automation）
├── 配置热重载（inotify 监听 config.toml 变化）
├── 进程伪装（kworker 名）
└── 熔断器模式（指数退避重启）
```

**优势**：CPU 占用极低、可维护性强、反编译困难（Rust → 汇编）

**分析入口**：
1. `main.rs` — CLI 解析 + 伪装入口
2. `daemon/mod.rs` — epoll 循环主逻辑
3. `daemon/tasks.rs` — 后台任务实现
4. `keybox/mod.rs` — 键箱获取逻辑
5. `security_patch/mod.rs` — 安全补丁隐藏

---

## 关键箱 (Keybox) 分析

Android 认证机制中的重要组件：

| 文件 | 功能 | 分析重点 |
|------|------|---------|
| `keybox/sources.rs` | 远程获取 | URL、编码方式（Base64/Hex/AES） |
| `keybox/validate.rs` | 证书链验证 | 内嵌根证书、吊销状态数据库 |
| `keybox/generate.rs` | 本地生成 | 算法选择（ECDSA P-256, RSA-2048） |
| `keybox/roots/*.pem` | 根证书 | Google/AOSP/Knox 等 |
| `keybox/roots/status.json` | 吊销列表 | 在线 + 离线混合验证 |

验证流程：
1. 下载 Base64/Hex 编码的 keybox XML
2. 解码后解析 XML 结构
3. 验证证书链（内置根证书）
4. 检查吊销状态（在线检查 + 嵌入式缓存）
5. 安装到 `/data/adb/tricky_store/keybox.xml`

---

## 完整性绕过模式

### Security Patch 日期伪造

```
三种变体识别：
- James Fork → devconfig.toml [deviceProps] securityPatch
- TEESimulator / Standard → security_patch.txt
- Legacy → resetprop 直接设置

目标日期来源：
- Google Pixel 公告 https://source.android.com/docs/security/bulletin
- 自动同步最新日期
```

### VBHash 伪造

```sh
# prop.sh — 15+ 属性伪装
check_reset_prop "ro.boot.vbmeta.device_state" "locked"
check_reset_prop "ro.boot.verifiedbootstate" "green"
check_reset_prop "ro.boot.flash.locked" "1"
check_reset_prop "ro.debuggable" "0"
check_reset_prop "ro.secure" "1"
check_reset_prop "ro.build.type" "user"
check_reset_prop "ro.build.tags" "release-keys"
# MIUI/Realme 特殊属性
check_reset_prop "ro.secureboot.lockstate" "locked"
check_reset_prop "ro.boot.realmebootstate" "green"
```

### LineageOS 身份隐藏

```sh
# 移除 product name 的 lineage_ 前缀
# 替换 vendor camera packagelist
# 停止 lineage_health 服务
# 删除 init.svc.vendor.lineage_health
```

---

## 模块隐藏与反分析

### 隐藏层级

1. **简单**：点前缀目录名（.MAGISK_MODULE）
2. **中级**：删除 module.prop（Magisk 管理器不可见）
3. **高级**：
   - 二进制进程伪装为内核线程
   - inotify 实时检测分析工具
   - 健康监控 + 熔断器自动重启
   - 冲突检测 + 自动清除竞争模块

### 反取证技巧

- `prctl(PR_SET_NAME, "kworker/0:2")` — 进程名伪装
- `/proc/self/mem` 覆写 cmdline — 移除可执行文件路径
- inotify 监控分析工具的文件访问
- 二进制不存储在模块目录（重新构建路径）
- 所有外部通信走 HTTPS

---

## 防御性自保

### 自删机制

```sh
# post-fs-data.sh — TrickyStore 缺失时自删
if [ ! -d "$TS" ] || [ -f "$TS/remove" ]; then
    mkdir -p "/data/adb/modules/TA_enhanced"
    touch "/data/adb/modules/TA_enhanced/remove"
    # 或 touch "$MODPATH/remove"
fi
```

### 健康监控熔断器

```
Closed (正常)
  → 进程消失 → grace_period 内不管
  → 超时 → killall + service.sh 重启
  → restarts >= max_restarts → Open (指数退避)
  → 退避超时 → HalfOpen → 探针
  → 恢复成功 → Closed
  → 恢复失败 → Open (backoff *= 2)
```

---

## 分析工具链

```bash
# 1. 模块结构检查
file bin/arm64-v8a/ta-enhanced        # ELF 头检查
readelf -S bin/arm64-v8a/ta-enhanced  # 节表

# 2. 脚本逻辑检查
shellcheck customize.sh               # 脚本错误
grep -n "rm -rf" customize.sh         # 查找删除操作
grep -n "curl\|wget" customize.sh     # 查找网络请求

# 3. 配置检查
cat update.json                       # 更新 URL
cat module.prop                       # 模块 ID

# 4. 二进制反汇编（需要 IDA/Ghidra）
# 或直接 readelf 看符号
readelf -s bin/x86_64/ta-enhanced | grep -iE "|__aeabi|JNI|Java_"

# 5. 键箱证书检查
openssl x509 -in rust/src/keybox/roots/google.pem -text -noout
```

---

## 案例参考

| 项目 | 特点 | 技术栈 |
|------|------|--------|
| Tricky Addon Enhanced | 全能型 addon | Rust daemon + epoll |
| Tricky Addon Updated Target List | 简单版 addon | Shell 脚本 |
| KOW Keybox | 单纯键箱 | Bare keybox.xml |
| Yurikey | 在线键箱服务 | GitHub raw |

