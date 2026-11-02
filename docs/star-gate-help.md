# Star 弹窗帮助

## 这个弹窗是什么

一个**可选的** Star 支持提示，不是功能门禁。helm-d 的人设、工具、破甲档位都不受它影响；跳过也不会少任何能力。

弹窗只有两个正常出口：

1. **手动 Star**：打开仓库 → 点 Star → 回到弹窗点「本次不再提示」。
2. **自动验证（可选）**：展开「自动验证」→ 打开 `github.com/login/device` → 输入代码并授权 → 给 `ADWMC/helm-d` 点 Star → 点「我已完成，刷新状态」。授权只用于确认 Star，令牌即弃，不落盘。

弹窗通常在启动约 2 秒后出现，避免挡住第一屏操作。不想处理就点右上角 `×` 或「本次不再提示」；本次启动不再出现，重启 dsh 后会再问一次。

## 常见问题

### 代码一直显示「生成中…」/「自动验证暂不可用」

通常是网络或代理问题。GitHub 设备流需要访问 `github.com` 和 `api.github.com`：

- 设置 `HTTPS_PROXY` / `ALL_PROXY`（或 Windows 系统代理），再重启 dsh。
- 确认当前网络能直接打开 `https://github.com/login/device`。
- 失败后会自动退避（30 秒 → 1 → 2 → 4 → 5 分钟），不用反复点；需要立即重试就点「重新验证」。
- 代理可用但偶发失败时，等退避结束或点「重新验证」；也可以先用「手动 Star」路径。
- 纯终端启动可在 `$DSH_HOME/storages/helmd/gate-code.txt` 读取一次性代码，或看 stderr 的 `[helmd] verification:` 一行。

### 授权成功，但一直检测不到 Star

- 确认点的是 **`ADWMC/helm-d` 仓库的 Star**，不是只完成 OAuth 授权。
- 自动检测在授权后每 30 秒查一次，最长 15 分钟；刚点完 Star 稍等片刻再点「我已完成，刷新状态」。
- 15 分钟后仍未检测到，弹窗会停在「已授权，未检测到 Star」，不会自动反复发新代码；点「重新验证」才会生成新代码。
- 不想等：直接手动 Star，然后点「本次不再提示」。

### 设备代码过期

设备流代码有有效期；过期后弹窗下一次轮询会生成新代码（通常几秒内）。展开「自动验证」即可看到新代码；CLI 通道的 `gate-code.txt` 也会更新。

### 不想授权 GitHub OAuth

完全不需要授权。直接打开仓库点 Star，然后点「本次不再提示」；或直接跳过。gate 不影响任何功能。

### 已经 Star 了，弹窗还在

- 点「本次不再提示」即可。
- 如果走的是自动验证，确认授权和 Star 都完成，再点「我已完成，刷新状态」。
- 弹窗是全局的，每个 dsh 进程只问一次；重启后会重新出现。

### 想重置 / 重新触发

删除 `$DSH_HOME/storages/helmd/gate-state.json`（默认 `~/.dsh/storages/helmd/gate-state.json`），重启 dsh。gate 是 honor system，状态文件可手动编辑，没有反绕过。

## 反馈

- 帮助文档没覆盖：开 [Issue](https://github.com/ADWMC/helm-d/issues/new)。
- 仓库：[ADWMC/helm-d](https://github.com/ADWMC/helm-d)。
