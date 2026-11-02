# 安装故障排查：`ERR_PNPM_TARBALL_INTEGRITY`

## 现象

更新 DSH 插件时 pnpm 在重放依赖树阶段失败：

```text
ERR_PNPM_TARBALL_INTEGRITY: Got unexpected checksum for
"https://github.com/ADWMC/helm-d/releases/latest/download/helmd.tgz".
```

失败后的自动回滚可能在同一处再次失败，表现为这个 profile 里的所有插件都无法更新。

## 原因

`releases/latest/download/<asset>` 是**滚动地址**：每次发版都会把同名资产指向新文件，但 `pnpm-lock.yaml` 记录的是安装当时那份文件的 `sha512`。同一个 URL 返回不同字节，完整性校验必然失败。

这不是包内容损坏，也不是 DSH 的问题；是“把滚动地址写进依赖”导致的。

## 修复

先移除旧依赖，再用**版本化 URL** 重装：

```bash
dsh plugin --profile web remove @adwmc/helm-d
dsh plugin --profile web add https://github.com/ADWMC/helm-d/releases/download/v0.5.2/helm-d.tgz
```

把 `v0.5.2` 换成你要安装的 Release tag。装完重启 DSH。

### 如果 remove 也失败

1. 备份 profile 的 `package.json` 和 `pnpm-lock.yaml`（Windows：`%USERPROFILE%\.dsh\profiles\web\`）。
2. 从 `package.json` 删除 `@adwmc/helm-d` 这一行。
3. 重新执行上面的版本化 `dsh plugin add`。
4. 仍然卡住时，作为最后手段备份后删除该 profile 的 `node_modules` 和 `pnpm-lock.yaml`，让 pnpm 重新解析；这会重装该 profile 的其它插件。

不要手动把 lockfile 里的 `sha512` 改成新值来绕过：那会掩盖资产内容变化，下一次更新还会坏。

## 为什么版本化 URL 安全

`https://github.com/ADWMC/helm-d/releases/download/v0.5.2/...` 指向该 tag 下的固定资产；只要不覆盖这个已发布版本的资产，内容就保持不变。`latest/download` 则会随下一次 Release 改变。

发布者约定：新版本用新 tag，不覆盖已发布 tag 的同名资产。

相关：[Issue #5](https://github.com/ADWMC/helm-d/issues/5) · [更新日志](../CHANGELOG.md)
