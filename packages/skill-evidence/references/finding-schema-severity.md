# 漏洞发现 Schema 与严重度评分

> 来源提炼: hardw00t/ai-security-arsenal (finding_schema.json + severity_calculator.py)
> 通用发现结构与 CVSS 3.1 / OWASP 风险评分

## 发现必需字段

```json
{
  "id": "VULN001",
  "title": "短描述性标题(10-150 字符)",
  "severity": "critical|high|medium|low|info",
  "category": "MASVS-STORAGE|CRYPTO|AUTH|NETWORK|PLATFORM|CODE|RESILIENCE|PRIVACY",
  "description": "详细漏洞描述(≥50 字符)"
}
```

## 完整发现结构

| 字段 | 说明 |
|------|------|
| `cvss` | CVSS 3.1 评分(score/vector/AV/AC/PR/UI/S/C/I/A) |
| `owasp_risk` | OWASP 风险(likelihood/impact/risk_level) |
| `cwe_ids` | 相关 CWE，格式 `CWE-\d+` |
| `mastg_ids` | 相关 MASTG 用例，格式 `MASTG-TEST-\d{4}` |
| `technical_details` | 面向安全人员的解释 |
| `impact` | C/I/A 与业务影响 |
| `affected_component` / `affected_versions` | 受影响组件/版本 |
| `reproduction_steps` | 分步复现(step_number/description/command/expected_result/screenshot) |
| `evidence` | 证据数组(type: screenshot/logcat/code/request/response/frida_output/file/database + path + timestamp) |
| `remediation` | summary/detailed_steps/code_example(vulnerable/secure)/effort/priority |
| `references` | 外部引用(title/url) |
| `metadata` | discovered_date/by、verified、false_positive、status(new/confirmed/in_progress/resolved/accepted_risk/false_positive)、tags |

## CVSS 3.1 权重

| 维度 | 值 | 权重 |
|------|-----|------|
| 攻击向量 AV | N/A/L/P | 0.85 / 0.62 / 0.55 / 0.2 |
| 攻击复杂度 AC | L/H | 0.77 / 0.44 |
| 权限要求 PR | N/L/H | 0.85 / 0.62(或0.68 Changed) / 0.27(或0.50) |
| 用户交互 UI | N/R | 0.85 / 0.62 |
| 影响 C/I/A | H/L/N | 0.56 / 0.22 / 0 |

CVSS 3.1 向量串: `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H`

计算要点:
- ISS(影响子分) = 1 - (1-C)×(1-I)×(1-A)
- Scope Unchanged: Impact = 6.42×ISS
- Scope Changed: Impact = 7.52×(ISS-0.029) - 3.25×(ISS-0.02)^15
- Exploitability = 8.22 × AV × AC × PR × UI
- 总分 = Roundup(min(Impact+Exploitability, 10))，Impact=0 时总分为 0

## OWASP 风险评分

- likelihood: Low(1)/Medium(2)/High(3)
- impact: Low(1)/Medium(2)/High(3)
- 风险矩阵: 3×3，对角线及以上为 High/Critical，左下为 Low/Medium。

## 严重度分级 (mobile 自定义参考)

| 级别 | 典型判定 |
|------|---------|
| Critical | 无交互远程 RCE、账户接管、凭据外传 |
| High | 敏感数据泄漏、权限绕过、无授权写操作 |
| Medium | 有限范围数据泄漏、需特定条件 |
| Low | 轻微信息泄漏、低影响 |
| Info | 加固缺失、无直接利用 |

## 证据要求

每个发现必须附可核验证据: 截图/日志/代码/请求/响应/Frida 输出/文件/数据库，带路径与时间戳。声明"已利用/已复现"前需保留完整复现步骤与结果。