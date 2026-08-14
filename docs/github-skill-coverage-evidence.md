# GitHub Skill 融合与覆盖率证据报告

> 生成方式: 实测统计(文件数、行数、语法检查、残留扫描) + 逐项置信度标注。

## 1. 目标

- 通用性: 删除 r0crawl 逐字重复模板, 提炼通用工作流骨架。
- 覆盖度: 从 GitHub 抽取开源 skill 通用知识, 补强每个 bundle。
- 可验证: 所有结论附置信度(高/中/低)。

## 2. 来源仓库 (git clone 证据)

| 仓库 | 用途 | 提取方向 |
|------|------|---------|
| yaklang/hack-skills | 网络/二进制/LLM 攻击面 | protocol / native / ai-security / web |
| guelfoweb/malware-analysis-static | 恶意样本静态分析 | malware |
| hardw00t/ai-security-arsenal | 移动/发现/评分 | android / evidence |

> clone 通过 Clash Verge 代理(127.0.0.1:7897)完成; 直连与旧代理(7888)均不可达。

## 3. 冗余清理 (置信度: 高)

- 定位 r0crawl 6 个 leaf 模板逐字重复 8699 行, 占总 md 25.2%。
- 脚本验证每个 leaf 非模板正文行数 = 0。
- 删除 9 个纯模板文件, 提炼通用 `router/references/evidence-workflow.md`(7 步工作流 + 质量门 + 交付物 + 置信度分级 A/B/C)。
- 项目 md 总量: 34452 行 → 20943 行(实测)。

## 4. Bundle 覆盖率 (实测行数)

| Bundle | 融合前 | 融合后 | 新增文件数 |
|--------|-------|-------|-----------|
| skill-malware | 2 md / 164 行 | 8 md / 381 行 | +6 |
| skill-protocol | 2 md / 111 行 | 7 md / 450 行 | +5 |
| skill-ai-security | 10 md / 1137 行 | 12 md / 1266 行 | +2 |
| skill-native | 67 md / 9259 行 | 69 md / 9413 行 | +2 |
| skill-android | 28 md / 4100 行 | 29 md / 4162 行 | +1 |
| skill-evidence | 12 md / 578 行 | 13 md / 636 行 | +1 |
| skill-web | 22 md / 3493 行 | 23 md / 3545 行 | +1 |
| router | 9 md / 701 行 | 9 md / 701 行 | 0(本阶段) |
| **合计** | **references 170 md / 20554 行** | — | **+18** |

> skill-malware 覆盖率 +132%, skill-protocol +305%, 补齐原最薄弱两项。

## 5. 新增文件清单 (18 个)

- skill-malware: malware-static-playbook-{pe,elf-macho,apk,office-script,web-payload}.md, malware-case-workflow.md
- skill-protocol: network-protocol-attacks.md, traffic-analysis-pcap.md, tunneling-and-pivoting.md, http2-attacks.md, dns-rebinding.md
- skill-ai-security: llm-injection-playbook.md, ml-model-security.md
- skill-native: code-obfuscation-deobfuscation.md, windows-av-edr-evasion.md
- skill-android: android-deeplink-broadcast-attacks.md
- skill-evidence: finding-schema-severity.md
- skill-web: web-business-logic-vulns.md

每个文件顶部标注来源, 内容提炼为通用知识(工具/流程/决策树/清单), 不复制框架命令与本地路径。

## 6. 验证结果 (置信度: 高)

| 检查项 | 结果 |
|--------|------|
| TypeScript 语法 (`node --experimental-strip-types --check`) | 9 通过 / 0 失败 |
| Python 语法 (`python -m py_compile`) | 60 通过 / 0 失败 |
| index.md 与实际文件一致 | 8 个 bundle 全部一致 |
| 残留本地路径扫描 (nook/headless_ida/DennyDai/AGENT_DIR/C:\Users 等) | 0 命中 |

## 7. 残余风险 (置信度: 中)

- GitHub 源文件总量巨大, 仅抽取与 8 个 bundle 直接相关的通用知识; 未覆盖的细分领域(如 AD 域攻击、无线、IoT 固件)仍可作为后续增量来源。
- `helm-d-reference/` 位于项目仓库之外, 未被 git 跟踪, 不参与提交。

## 8. 置信度汇总

- r0crawl 模板冗余分析: 高(脚本逐 leaf 计数验证)。
- 融合文件数与行数统计: 高(实测)。
- GitHub 源质量与适用性: 高(官方开源 skill 结构清晰)。
- 覆盖率"高"的判定: 中(主观; 以每个 bundle ≥ 6 文件且覆盖主要子领域为界)。
