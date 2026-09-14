// /hcot — dsh 内部命令：H-CoT 攻击，完全寄生宿主运行时（零 Python、零子进程）。
//
// 两种执行路径：
//   /hcot <goal> [flags]          单发：Node 原生执行器（hcot-engine.ts）；
//                                 加 --semantic-auto 走语义自动匹配（分类→策略建议）
//   /hcot breach <goal> [flags]   统一调度器（hcot-attack-scheduler.ts）：
//                                 子代理主路 → 防线3 重试 → 执行器降级
//
// 设计依据：helmd 完全寄生 dsh。执行走 Node engine（fetch + SSE）或宿主子代理；
// 机制实例库与账本只作参考，不限制 AI 判断（见 hcot-strategy.ts 的声明）。

import type { Context } from '@deepseek-ai/cordis'
import { renderStats, runHcotAttack, type HcotOptions } from './hcot-engine.js'
import { scheduleAttack } from './hcot-attack-scheduler.js'
import { evaluateHealth } from './health.js'
import { getStreamInterceptionStats } from './llm-stream-hook.js'

export interface SecurityToolMeta {
  name: string
  category: string
  description: string
  example: string
}

export const HELMD_TOOL_CATALOG: SecurityToolMeta[] = [
  // Android
  { name: 'apk_fingerprint', category: 'Android 移动逆向', description: '提取 APK/AAB/DEX 指纹、权限与加壳保护', example: 'apk_fingerprint(apkPath: "target.apk")' },
  { name: 'dex_dump', category: 'Android 移动逆向', description: '内存脱壳与 DEX 重建提取', example: 'dex_dump(packageName: "com.example.app")' },
  { name: 'smali_search', category: 'Android 移动逆向', description: 'Smali 代码符号与关键逻辑调用检索', example: 'smali_search(dir: "smali/", keyword: "checkLicense")' },
  { name: 'frida_prepare', category: 'Android 移动逆向', description: '生成 Frida Hook 脚本骨架与插桩配置', example: 'frida_prepare(target: "java.lang.SecurityManager")' },

  // Native
  { name: 'detect_packer', category: 'Native 二进制', description: '识别 PE/ELF/Mach-O 保护壳 (UPX/VMP/Themida/OLLVM)', example: 'detect_packer(filePath: "sample.exe")' },
  { name: 'scan_strings', category: 'Native 二进制', description: '提取二进制字符串、敏感特征码与 URL', example: 'scan_strings(filePath: "sample.bin", minLength: 6)' },
  { name: 'xor_bruteforce', category: 'Native 二进制', description: '单/双字节 XOR 异或加密爆破与推导', example: 'xor_bruteforce(data: "1a2b3c...", knownPlaintext: "HTTP")' },
  { name: 'encoding_detect', category: 'Native 二进制', description: '自动识别 Base64/Hex/RC4/AES 密文及编码', example: 'encoding_detect(text: "eyJhbGciOi...")' },
  { name: 'native_reference', category: 'Native 二进制', description: '查询 Native 逆向与 Exploit 参考手册', example: 'native_reference(topic: "arm64-rop")' },

  // Web & Protocol
  { name: 'web_reference', category: 'Web & 协议安全', description: '查询 Web 漏洞与自动化审计 Playbook', example: 'web_reference(vuln: "sqli")' },
  { name: 'pcap_parse', category: 'Web & 协议安全', description: '解析 PCAP 流量包提取 TCP/UDP 与会话载荷', example: 'pcap_parse(pcapPath: "traffic.pcap")' },
  { name: 'parse_har', category: 'Web & 协议安全', description: '解析 HAR HTTP 会话文件提取接口与敏感凭证', example: 'parse_har(harPath: "session.har")' },

  // Malware & Threat
  { name: 'ioc_extract', category: '威胁情报 & 恶意代码', description: '提取样本中的 IOC 指标 (IP/Domain/Hash/C2)', example: 'ioc_extract(content: "sample text or file")' },
  { name: 'yara_gen', category: '威胁情报 & 恶意代码', description: '生成针对样本恶意特征的 YARA 检测规则', example: 'yara_gen(samplePath: "malware.bin", ruleName: "Trojan_X")' },

  // AI Security
  { name: 'hcot_attack', category: 'AI 攻防 & 思维链安全', description: '执行寄生式 H-CoT 思维链状态注入与越狱', example: 'hcot_attack(goal: "逆向分析目标防护逻辑", variant: "analysis")' },
  { name: 'llm_sim', category: 'AI 攻防 & 思维链安全', description: '模拟 LLM 提示词注入与越狱鲁棒性测试', example: 'llm_sim(prompt: "测试提示词", defenseLevel: "high")' },

  // Case & Ledger
  { name: 'begin_case', category: 'Case 存证与工作流', description: '创建安全分析案件工作区并初始化审计账本', example: 'begin_case(goal: "APK 去授权验证", samples: ["app.apk"])' },
  { name: 'case_status', category: 'Case 存证与工作流', description: '查看当前案件分析进度、阶段状态与恢复信息', example: 'case_status()' },
  { name: 'record_finding', category: 'Case 存证与工作流', description: '记录已确证的漏洞与分析技术事实', example: 'record_finding(title: "签名校验缺陷", confidence: "high")' },
  { name: 'save_evidence', category: 'Case 存证与工作流', description: '保存分析证据文件 (Dump/反编译/流量包)', example: 'save_evidence(filePath: "dump.bin", description: "解密内存")' },
  { name: 'end_case', category: 'Case 存证与工作流', description: '归档案件并生成标准化交付报告与证据清单', example: 'end_case(summary: "完成全流程分析")' },
  { name: 'find_tool', category: 'Case 存证与工作流', description: '跨本地工具货架与 GitHub 智能发现工具', example: 'find_tool(query: "apk decompiler")' },
  { name: 'tool_memory', category: 'Case 存证与工作流', description: '跨会话记录与检索安全工具踩坑与使用经验', example: 'tool_memory(action: "search", query: "frida hook")' },
  { name: 'route_task', category: 'Case 存证与工作流', description: '对样本或目标进行技术领域意图路由判断', example: 'route_task(hint: "分析这个加密 APK")' },
  { name: 'skill_catalog', category: 'Case 存证与工作流', description: '检索 helmd 技能库与参考文档目录', example: 'skill_catalog()' },
  { name: 'read_reference', category: 'Case 存证与工作流', description: '按需阅读具体领域的深度安全逆向规范与手册', example: 'read_reference(path: "android/apk-reverse.md")' },
]

/**
 * Host seam contracts — declared locally because the services are injected by
 * the host (dsh-commands / dsh-subagent are not helmd dependencies), the same
 * pattern prompt-assembly.ts uses for the host waterfall.
 */
interface HostCommandInvocation {
  readonly rawInput: string
  readonly attachments: readonly unknown[]
  readonly signal: AbortSignal
  readonly agent: { id?: string }
}
interface HostCommandDefinition {
  readonly name: string
  readonly description: string
  readonly input?: { hint?: string; attachments?: boolean }
  readonly handler: (invocation: HostCommandInvocation) =>
    | { kind: 'success'; text: string }
    | { kind: 'error'; text: string }
    | Promise<{ kind: 'success'; text: string } | { kind: 'error'; text: string }>
}
interface HostCommandContext {
  commands: { register(definition: HostCommandDefinition): void }
}

/** Usage line shown on empty input and on errors. */
const USAGE = 'Usage: /hcot [<goal>] [flags...] | /hcot breach <goal> [--max-rounds <n>] [--provider spawn|fork] [flags...]'

/**
 * Parse "/hcot [breach] <goal> [flags]" from rawInput. Leading "breach" selects
 * the subagent loop; the next positional is the goal; the rest pass through.
 */
function parse(raw: string): { breach: boolean; goal: string | null; flags: string[] } {
  const tokens = raw.trim().match(/(?:[^\s"]+|"[^"]*")+/g) ?? []
  const unquote = (t: string) => t.replace(/^"|"$/g, '')
  let i = 0
  let breach = false
  if (tokens[0] && unquote(tokens[0]).toLowerCase() === 'breach') {
    breach = true
    i++
  }
  // The first non-flag token is the goal; a leading dash means no goal at all.
  let goal: string | null = null
  const flags: string[] = []
  for (; i < tokens.length; i++) {
    const t = unquote(tokens[i])
    if (goal === null && !t.startsWith('-')) {
      goal = t
    } else {
      flags.push(t)
    }
  }
  return { breach, goal, flags }
}

export const name = 'helmd-command-hcot'

/** Read "--key value" from a flag list; returns the value or undefined. */
function flagValue(flags: string[], key: string): string | undefined {
  const i = flags.indexOf(key)
  if (i >= 0 && flags[i + 1]) return flags[i + 1]
  return undefined
}

/** The host command service is required. */
export const inject = ['commands']

export function apply(ctx: Context): void {
  const register = (cmdCtx: Context) => {
    const host = cmdCtx as unknown as HostCommandContext
    host.commands?.register({
      name: 'hcot',
      description: 'Run the H-CoT (chain-of-thought hijacking) attack: single-shot, or breach loop via a host subagent',
      input: {
        hint: '[breach] [<goal>] [--variant <id>] [--auto] [--stats] [--probe <text>] [--max-rounds <n>] [--dry-run]',
        attachments: true,
      },
    handler: (invocation) => {
      const { breach, goal, flags } = parse(invocation.rawInput)

      if (!goal && !flags.includes('--stats')) {
        return { kind: 'success', text: `${USAGE}\n\nRun \`/hcot --stats\` for the variant win-rate table, or \`/hcot breach <goal>\` for the auto-retry loop.` }
      }

      if (!breach) {
        // Single-shot path: same Node engine as the hcot_attack model tool.
        if (flags.includes('--stats')) {
          return renderStats({ model: flagValue(flags, '--model'), ledger: flagValue(flags, '--ledger') }).then(
            (text) => ({ kind: 'success' as const, text }),
            (error) => ({ kind: 'error' as const, text: `hcot stats failed: ${error instanceof Error ? error.message : String(error)}` }),
          )
        }
        const opts: HcotOptions = {
          goal: goal ?? '',
          model: flagValue(flags, '--model') ?? undefined,
          baseUrl: flagValue(flags, '--base-url') ?? undefined,
          variant: flagValue(flags, '--variant') ?? undefined,
          probe: flagValue(flags, '--probe') ?? undefined,
          forgeFile: flagValue(flags, '--forge-file') ?? undefined,
          transferProbe: flagValue(flags, '--transfer-probe') ?? undefined,
          ledger: flagValue(flags, '--ledger') ?? undefined,
          dryRun: !flags.includes('--json'),
          // 语义自动匹配：分类(模型+目标) → 策略建议 → 三段式
          autoStrategy: flags.includes('--semantic-auto') || undefined,
        }
        const sf = flagValue(flags, '--frame')
        const se = flagValue(flags, '--enabler')
        const sc = flagValue(flags, '--continuation')
        if (sf || se || sc) opts.strategy = { frame: sf, enabler: se, continuation: sc }
        const fc = flagValue(flags, '--first-chars')
        if (fc) {
          const n = Number(fc)
          if (Number.isInteger(n) && n > 0) opts.firstChars = n
        }
        return runHcotAttack(opts).then(
          ({ text }) => ({ kind: 'success' as const, text }),
          (error) => ({ kind: 'error' as const, text: `hcot command failed: ${error instanceof Error ? error.message : String(error)}` }),
        )
      }

      // Breach path: unified scheduler (subagent main → defence-3 retries → engine fallback).
      const maxRounds = (() => {
        const i = flags.indexOf('--max-rounds')
        if (i >= 0 && flags[i + 1]) {
          const n = Number(flags[i + 1])
          if (Number.isInteger(n) && n > 0) return n
        }
        return 4
      })()

      return scheduleAttack(ctx, {
        agent: invocation.agent,
        signal: invocation.signal,
        goal: goal ?? undefined,
        model: flagValue(flags, '--model'),
        provider: flagValue(flags, '--provider'),
        maxRounds,
        ledger: flagValue(flags, '--ledger'),
        notify: false,
      }).then((result) => ({
        kind: result.ok ? 'success' as const : 'error' as const,
        text: [
          `[hcot breach] via=${result.via} subagentRefusals=${result.subagentRefusals}`,
          `goal: ${result.input.goal.slice(0, 160)}`,
          `trigger: ${result.input.triggerProfile}`,
          result.proposal ? `suggested: ${result.proposal.frame}/${result.proposal.enabler}/${result.proposal.continuation}` : '',
          '',
          result.ok ? result.text : (result.error ?? 'unknown failure'),
        ].filter(Boolean).join('\n'),
      }))
    },
  })

    // /tools — 内置逆向与安全分析工具货架
    host.commands?.register({
      name: 'tools',
      description: '查看 helmd 内置的 19+ 逆向与安全分析工具货架及调用示例',
      input: {
        hint: '[android|native|web|malware|ai|caseflow]',
        attachments: false,
      },
      handler: (invocation) => {
        const query = (invocation.rawInput || '').trim().toLowerCase()
        let list = HELMD_TOOL_CATALOG
        if (query) {
          list = list.filter((t) =>
            t.category.toLowerCase().includes(query) ||
            t.name.toLowerCase().includes(query) ||
            t.description.toLowerCase().includes(query),
          )
        }
        if (list.length === 0) {
          return {
            kind: 'success' as const,
            text: `未找到匹配 [${query}] 的工具。可用分类: android, native, web, malware, ai, caseflow。\n运行 \`/tools\` 查看全部 19+ 工具。`,
          }
        }

        // Group by category
        const groups: Record<string, typeof HELMD_TOOL_CATALOG> = {}
        for (const item of list) {
          groups[item.category] = groups[item.category] || []
          groups[item.category]!.push(item)
        }

        const lines: string[] = [
          `# 🛡️ helmd 安全分析与逆向工程工具货架 (共 ${list.length} 个工具)`,
          '',
          '> 提示：在右侧栏【安全分析工作台】可一键复制命令或填入提示词；在会话中也可直接让 AI 调用对应工具。',
          '',
        ]

        for (const [cat, items] of Object.entries(groups)) {
          lines.push(`### 📦 ${cat}`)
          for (const it of items) {
            lines.push(`- **\`${it.name}\`**: ${it.description}`)
            lines.push(`  - 示例: \`${it.example}\``)
          }
          lines.push('')
        }

        return { kind: 'success' as const, text: lines.join('\n') }
      },
    })

    // /status — 引擎健康、流式拦截审计与 H-CoT 状态
    host.commands?.register({
      name: 'status',
      description: '查看 helmd 引擎健康状态、流式拦截审计及 H-CoT 状态',
      input: {
        hint: '[--json]',
        attachments: false,
      },
      handler: async (invocation) => {
        const health = evaluateHealth()
        const streamStats = getStreamInterceptionStats()
        const hcotText = await renderStats({}).catch(() => 'H-CoT 账本读取失败')

        const lines = [
          '# 🛡️ helmd 安全分析引擎综合状态看板',
          '',
          '### 1. 引擎与宿主健康 (Host & Engine Health)',
          `- **状态 (Status)**: \`${health.status}\``,
          `- **版本 (Version)**: \`${health.version || '0.2.0'}\``,
          `- **自愈策略 (Auto-heal)**: ${health.autoHeal}`,
          `- **宿主指纹 (Host FP)**: \`${health.hostFingerprint || 'unknown'}\``,
          `- **预设指纹 (Preset FP)**: \`${health.presetFingerprint || 'unknown'}\``,
          `- **评估时间 (Checked At)**: ${health.checkedAt || new Date().toISOString()}`,
          '',
          '### 2. 流式拦截审计状态 (Stream Interceptor Audit)',
          `- **当前活跃拦截规则**: 22+ 条核心拒绝签名`,
          `- **累计拦截并替换拒绝流**: \`${streamStats.count}\` 次`,
          `- **审计日志文件**: \`${streamStats.logFile}\``,
          `- **最近拦截时间**: ${streamStats.lastTime ? new Date(streamStats.lastTime).toLocaleString() : '暂无拦截记录 (运行平稳)'}`,
          streamStats.lastSnippet ? `- **最近拦截样本**: \`${streamStats.lastSnippet.replace(/\n/g, ' ')}\`` : '',
          '',
          '### 3. H-CoT 状态注入战绩 (H-CoT Ledger Overview)',
          hcotText,
          '',
          '> 输入 `/tools` 查看工具列表，或点击右侧栏【安全分析工作台】进行可视化操作。',
        ]

        return { kind: 'success' as const, text: lines.join('\n') }
      },
    })
  }

  if (typeof ctx.inject === 'function') {
    ctx.inject(['commands'], (cmdCtx) => register(cmdCtx))
  } else {
    register(ctx)
  }
}
