# helm-d 全量审查（2026-10-26）

> **状态**：审查报告；修复建议见 [总方案](design/MASTER-PLAN-PRO-RE-PENTEST.md)。

## P0（已确认）

| # | 问题 | 证据 |
|---|---|---|
| P0-1 | 安装包缺 `scripts/gen-preset.mjs`；`health.autoHeal` 不可用 | `build-sealed.mjs` 只封 dist+references；tarball 无 scripts（**0.5.2 已修**：scripts 封进 `payload.dat`，首次导入解压；`verify-pack` 解封断言） |
| P0-2 | `case_status(name)` 路径穿越 | `case.ts` `loadCaseInfoFromDisk` 未 assertWithinRoot |
| P0-3 | 证据编号 >999 回卷 | `case.ts` `nextEvidenceId` 用 `E-\d{3}` |
| P0-4 | `record_finding` 允许 0 证据 | `caseflow.ts` `args.evidence_ids ?? []` |
| P0-5 | 无 CI / 发布产物校验 | 无 `.github/`；发布全靠手工 checklist |

## P1（主要项）

| # | 问题 |
|---|---|
| P1-1 | `persist` 写证据失败 → 工具调用变异常 |
| P1-2 | `find_tool` fetch 无超时/不读代理 |
| P1-3 | `model-probe` 同样不读代理（**已随功能删除解决**） |
| P1-4 | `GET /api/helmd/gate/skip` 用 GET 改状态 |
| P1-5 | `gate.applyPersonaSection` getSectionOrder 无 fallback |
| P1-6 | bootstrap 同时 bash+pwsh 时 fail-open |
| P1-7 | `prompt-assembly` 无条件剥离 sandbox/approval context |
| P1-8 | `save_evidence(file)` 无大小上限 |
| P1-9 | `0.5.1fix` 非 SemVer（`npx semver` exit 1）（**0.5.2 已修**：版本改为 `0.5.2`） |
| P1-10 | `payload.dat`/`references.dat` 二进制 blob 入库 |
| P1-11 | 遗留 `packages/skill-*` 仍参与 build |

## 已验证事实

- 工具数 32（删 `llm_probe`/`llm_eval_suite` 后）
- 参考数 362
- tarball 12 文件封印形态
- release 3 tgz（无 installer）
- `npx semver 0.5.1fix` exit 1
- `pnpm build`/`typecheck`/`test:checks`（13 PASS）/`verify-pack` 全绿
