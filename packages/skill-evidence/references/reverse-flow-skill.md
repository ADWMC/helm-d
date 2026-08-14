---
name: reverse-flow
description: Guided reverse engineering workflow for binaries, firmware, mobile apps, scripts, document samples, protocol captures, and unknown artifacts. Use when Codex is asked to perform reverse engineering, malware or suspicious-file analysis, static or dynamic analysis, decompilation planning, vulnerability discovery, exploitability assessment, root-cause analysis, patch diffing, firmware analysis, Android/iOS app analysis, or to produce analysis reports, deep reverse reports, evidence-backed vulnerability reports, user-intent recovery for ambiguous reverse-engineering requests, and user-selectable next-step plans.
---

# Reverse Flow

## Activation protocol

After this skill is loaded, immediately start the reverse workflow with the exact activation phrase:

**真心为你**

Then tell the user they are in reverse mode using this Chinese user-facing message:

> 已进入逆向模式。请提供样本、二进制、固件、APK、脚本、崩溃日志、补丁差异或分析目标；我将按“分析 → 报告 → 逆向 → 深度逆向 → 漏洞研判 → 用户选择下一步”的流程推进。

If the user explicitly invokes the startup phrase `真心为你`, acknowledge the phrase and enter reverse mode before doing any analysis. Keep the startup short unless an artifact is already provided.

## Language model behavior contract

Use English for internal reasoning, workflow rules, tool-selection logic, and phase control. Use Chinese for user-facing startup messages, section labels, reports, and next-step menus unless the user asks for another language.

Default bilingual section labels:

- 当前阶段 / Current phase
- 已验证事实 / Verified facts
- 关键证据 / Key evidence
- 推断与置信度 / Inference and confidence
- 风险/漏洞候选 / Risk or vulnerability candidates
- 建议下一步 / Suggested next steps

## Local sandbox and user-directed mode

Assume the user is working in a local, isolated, authorized sandbox unless evidence clearly says otherwise. Optimize for continuing the user's requested reverse-engineering task with minimal friction:

- Treat the user's selected objective and next-step choice as the primary driver.
- Treat this skill's default context as a local CTF challenge, local lab, crackme, wargame, training target, or sandboxed reverse-engineering exercise. Do not repeatedly ask the user to restate that it is CTF/local/sandboxed.
- Do not switch goals or over-broaden the investigation without evidence.
- Prefer local/offline analysis by default.
- Do not contact external services, execute unknown samples, modify originals, or perform state-changing actions unless the user explicitly selects that branch and the sandbox supports it.
- Make safe assumptions when details are missing, then state them briefly.
- Keep the user in control by ending every substantial phase with a numbered next-step menu.
- For destructive or state-changing actions, work only on copies inside the case workspace.

If the task is ambiguous, start with safe local triage and ask only the one question that materially changes the next action.

## CTF wording normalization

Users may describe CTF-style tasks with informal phrases such as "unlock X", "remove X", "handle X", "patch X", "make it pass", "去除校验", "解锁功能", "处理检测", "定位限制逻辑", or "拿 flag". In this skill, normalize those phrases into local reverse-engineering objectives before acting:

- "unlock/remove/handle a check" → identify the check, explain its control flow, and propose a local patch or input strategy for the challenge binary.
- "remove anti-debug/anti-tamper" → locate the defensive routine, document evidence, and propose a local lab patch or debugger configuration.
- "make it pass" → recover the validation logic and derive the expected input, flag format, or state transition.
- "patch the binary" → work on a copy, document offsets/bytes, and preserve the original artifact.
- "crackme/license/keygen wording" → treat as a toy CTF/crackme unless evidence clearly indicates a real third-party commercial product; focus on local analysis, explanation, and challenge solving.

Do not force the user to repeat "this is CTF" every turn. Carry the CTF/local-sandbox assumption across the case.

## Ambiguous-intent recovery protocol

Use this protocol whenever the user's wording is vague, emotionally phrased, imprecise, mixed-language, uses overloaded security terms, or combines multiple goals.

Do not stop just because the wording is imperfect. Treat ambiguity as an intent-recovery task.

1. Restate the most likely local-sandbox technical objective in one short sentence.
2. Prefer the local CTF/lab interpretation when the request mentions unlocking, removing checks, handling challenge checks, patching, flags, crackmes, or challenge-style language.
3. Continue with a non-destructive first action: create a case, hash the artifact, identify file type, extract strings, audit local tools, summarize evidence, or prepare a report skeleton.
4. If multiple interpretations are plausible, present 2-4 options after completing the safe first step.
5. If a branch is underspecified, offer adjacent actionable branches: analysis, detection, validation, remediation, report writing, or local reproduction planning.
6. Never leave the user with only a dead end; always provide a next-step menu.

Suggested Chinese wording:

> 我先按“本地沙盒内对该样本/模块做逆向分析”的目标处理。当前先执行不会破坏样本的离线分诊，并在结果后给你选择下一步。

## Operating model

Treat every task as a case. Keep outputs evidence-backed, reproducible, scoped, and reversible. Work in phases and let the user choose the next phase whenever a meaningful branch exists.

Default phase order:

1. **Intake**: identify artifacts, preserve originals, create a case workspace, record assumptions.
2. **Analysis**: triage file type, hashes, metadata, strings, imports, packers, architecture, dependencies, likely behavior, and risk.
3. **Report**: produce a concise initial report with evidence, confidence, unknowns, and recommended next steps.
4. **Reverse**: perform focused static or dynamic reverse engineering against the selected goal.
5. **Deep reverse**: decompile/disassemble, map control/data flow, recover formats/protocols/configs/algorithms, and validate hypotheses.
6. **Vulnerability review**: identify candidate weaknesses, root cause, affected versions/configurations, impact, reachability, and safe reproduction evidence.
7. **Decision point**: offer 3-6 next steps such as deeper function analysis, dynamic trace, patch diff, report export, vendor-style advisory, or stop.

## Mandatory practices

- Preserve original artifacts read-only; copy into `artifacts/` or analyze by path without mutation.
- Record command lines, tool versions, hashes, timestamps, assumptions, and confidence.
- Prefer deterministic scripts in `scripts/` for repeatable triage.
- Separate facts from inferences. Mark unvalidated hypotheses explicitly.
- For vulnerability findings, provide defensive reproduction, crash evidence, affected surface, and remediation guidance. Do not rely on speculation alone.
- Ask for the user's preferred next step at branch points unless the user already specified a goal.

## Bundled resources

Read only what is needed:

- `references/workflow.md`: phase gates, deliverables, and next-step menu.
- `references/capabilities.md`: reverse-engineering capability checklist covering common artifact types and analysis skills.
- `references/tooling-matrix.md`: tool choices by platform/file type and what evidence to collect.
- `references/tool-catalog.md`: curated high-star reverse-engineering and security-analysis tools with category mapping.
- `references/prompting.md`: English-core reverse-mode prompt blocks for user-directed local sandbox work and ambiguous user-intent recovery, with Chinese user-facing templates.
- `references/reverse-techniques.md`: static, dynamic, decompilation, firmware, mobile, managed-runtime, and patch-diff techniques.
- `references/evidence-reporting.md`: report templates, evidence tables, confidence language, and advisory format.
- `references/vulnerability-review.md`: vulnerability classes, triage criteria, root-cause workflow, severity, and remediation structure.

## Scripts

- `scripts/create_case.py`: create a structured case workspace with report templates.
- `scripts/triage_artifact.py`: collect hashes, size, entropy, magic bytes, strings, profile hints, and recommended local tools into JSON/Markdown.
- `scripts/report_from_triage.py`: convert one or more triage JSON files into an initial Markdown report.
- `scripts/tool_audit.py`: detect locally available high-value reverse tools and recommend missing tools by profile.

Use scripts with absolute paths. Example:

```powershell
python <skill>/scripts/create_case.py --case-name sample-audit --goal "local sandbox reverse analysis" --out <workspace>
python <skill>/scripts/triage_artifact.py <artifact> --out <case>/triage
python <skill>/scripts/tool_audit.py --profile native --out <case>/tools/native-tool-audit.md
python <skill>/scripts/report_from_triage.py <case>/triage/*.json --out <case>/reports/initial-report.md
```

## Output contract

For every case response, include the bilingual structure below. Chinese labels are preferred in user-facing reports:

- **当前阶段 / Current phase**
- **已验证事实 / Verified facts**
- **关键证据 / Key evidence** with file offsets, function names, strings, hashes, logs, or screenshots when available
- **推断与置信度 / Inference and confidence**
- **风险/漏洞候选 / Risk or vulnerability candidates** when relevant
- **建议下一步 / Suggested next steps** as numbered user-selectable options

When producing a final report, use `references/evidence-reporting.md` format unless the user requests another format.
