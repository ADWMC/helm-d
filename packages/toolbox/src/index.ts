import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readTextSeam } from './seam.js'

export const name = 'toolbox'
export const inject = ['tools']

const refRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../references')

// 信号 -> 首选工具 | 替代 | 存证格式（按分类分组）
const rules: Record<string, string> = {
  // 0. 总则：工具获取
  tool: '工具获取: 先查本机(where/Get-Command/--version) → 有则直接用并记版本路径 → 无则除 C 盘外最大盘建 X:\\Reverse\\ 下载 → 下载走代理',
  install: '工具获取: 先查本机 → 无则除 C 外最大盘 X:\\Reverse\\ → 走代理下载',
  download: '工具获取: 先查本机 → 无则除 C 外最大盘 X:\\Reverse\\ → 走代理下载',

  // 1. 分诊 triage

  // 2. Android
  jadx: 'jadx https://github.com/skylot/jadx — DEX/APK → Java 反编译 | 替代: Fernflower/GDA | 存证: Java 源码',
  dex: 'DEX → jadx https://github.com/skylot/jadx | 替代: Fernflower | 存证: Java 源码',
  apktool: 'apktool https://github.com/ibotpeaches/apktool — APK 解包/重打包/smali 调试 | 替代: apktool.jar | 存证: smali/资源/重打包产物',
  apk: 'APK → apktool https://github.com/ibotpeaches/apktool (解包) + jadx (反编译) | 存证: smali/Java 源码/manifest',
  androguard: 'androguard https://github.com/androguard/androguard — APK 静态分析(Python) | 替代: jadx | 存证: manifest/权限/调用图',
  unidbg: 'unidbg https://github.com/zhkl0228/unidbg — Android native SO 模拟执行(JNI_OnLoad/JNIEnv/syscall) | 替代: Frida | 存证: 调用序列/返回值/trace',
  emulat: '模拟执行 → unidbg https://github.com/zhkl0228/unidbg | 替代: angr/unicorn | 存证: trace/返回值',
  fernflower: 'fernflower https://github.com/jetBrains/fernflower — Java 字节码 → Java | 替代: CFR/Procyon | 存证: Java 源码',
  jar: 'JAR → fernflower https://github.com/jetBrains/fernflower | 替代: CFR | 存证: Java 源码',
  bytecode: '字节码 → fernflower https://github.com/jetBrains/fernflower | 替代: CFR | 存证: Java 源码',
  rustfrida: 'rustFrida https://github.com/kkkbbb/rustFrida — Android ARM64 动态插桩 (--pid/--spawn/-l script.js) | 替代: Frida frida-server | 存证: hook log/stack/参数',
  instrument: '动态插桩 -> rustFrida (ARM64 Android) | 替代: Frida | 存证: hook log/stack',
  spawn: 'spawn 注入 -> rustFrida --spawn 或 Frida -f | 存证: 启动期 hook 点',

  // 3. Web / JavaScript
  scrapling: 'Scrapling https://github.com/d4vinci/Scrapling — 自适应网页抓取/反爬(单请求到全站) | 替代: Playwright/obscura | 存证: HTML/JSON/文章',
  scrap: '网页抓取 → Scrapling https://github.com/d4vinci/Scrapling | 替代: Playwright | 存证: HTML/JSON',
  crawl: '爬虫 → Scrapling https://github.com/d4vinci/Scrapling | 替代: scrapy | 存证: 抓取结果',
  wechat: 'WeChat-lm https://github.com/HSGQSRGS/WeChat-lm — 微信小程序渗透(wxapkg 解包/JS 反混淆/签名/mitmproxy/Burp 联动) | 替代: 手动 wxapkg 解包 | 存证: HTML+JSON 报告',
  wxapkg: '微信小程序包 → WeChat-lm https://github.com/HSGQSRGS/WeChat-lm (V1/V2 解密+多线程解包) | 存证: 解包产物/AppID',
  miniprogram: '微信小程序逆向 → WeChat-lm https://github.com/HSGQSRGS/WeChat-lm | 存证: 解包/接口/报告',
  ip_check: 'IP 存活检测 → ip_checker https://github.com/test692618/ip_checker (批量/CIDR/多线程 ICMP+TCP) | 替代: nmap -sn/fping | 存证: 存活/不可达结果+统计',
  alive: '存活检测 → ip_checker https://github.com/test692618/ip_checker | 替代: nmap -sn | 存证: 存活清单',
  cipher: '加解密/签名 → CipherBridge https://github.com/CuriousLearnerDev/CipherBridge (AES/DES/SM4 + MD5/SHA/HMAC 可视化) | 替代: CyberChef/手写 hook | 存证: 解密结果/密钥/算法',
  decrypt: '解密 → CipherBridge https://github.com/CuriousLearnerDev/CipherBridge | 替代: CyberChef | 存证: 明文/密钥',
  aes: 'AES → CipherBridge https://github.com/CuriousLearnerDev/CipherBridge | 替代: CyberChef | 存证: 明文/密钥',
  sign: '签名 → CipherBridge https://github.com/CuriousLearnerDev/CipherBridge | 替代: 手写 hook | 存证: 签名算法/密钥',

  // 4. Native / 二进制
  'headless-ida': 'headless-ida https://github.com/DennyDai/headless-ida — IDA idalib 无界面跑脚本 | 替代: Ghidra analyzeHeadless | 存证: 反汇编/反编译产物',
  idalib: 'idalib → headless-ida https://github.com/DennyDai/headless-ida | 替代: idat(禁用) | 存证: 反汇编产物',
  ida: 'IDA 反汇编 → headless-ida https://github.com/DennyDai/headless-ida + IDA Pro | 替代: Ghidra/radare2 | 存证: 函数/xrefs/反编译',
  radare2: 'radare2 https://github.com/radareorg/radare2 — 命令行逆向框架 | 替代: Ghidra/IDA | 存证: 函数/xrefs/段',
  r2: 'r2 → radare2 https://github.com/radareorg/radare2 | 替代: rizin | 存证: 分析输出',

  // 5. Windows
  vmp: 'VMP → VMPStaticUnpacker https://github.com/YuroGod/VMPStaticUnpacker (VMProtect 3.9.5 静态脱壳) | 替代: 动态 dump | 存证: unpacked PE',
  vmprotect: 'VMProtect → VMPStaticUnpacker https://github.com/YuroGod/VMPStaticUnpacker | 替代: Frida dump | 存证: unpacked PE',
  unpack: '脱壳 → VMPStaticUnpacker (VMProtect) / detect_packer | 存证: unpacked 产物 + 校验',
  x64dbg: 'x64dbg https://github.com/x64dbg/x64dbg — Windows 用户态调试器(RE/恶意样本) | 替代: WinDbg/OllyDbg | 存证: 断点/寄存器/内存',
  debug: 'Windows 调试 → x64dbg https://github.com/x64dbg/x64dbg | 替代: WinDbg | 存证: 断点/寄存器/内存',
  'x64dbg-mcp': 'x64dbg-mcp https://github.com/SetsunaYukiOvO/x64dbg-mcp — x64dbg MCP server(AI 经 JSON-RPC 控制调试) | 替代: 手动调试 | 存证: 调试会话/内存快照',
  mcp: 'MCP 调试 → x64dbg-mcp https://github.com/SetsunaYukiOvO/x64dbg-mcp | 替代: 手动 x64dbg | 存证: JSON-RPC 会话',
  hashdump: 'Hash Dump → HashDump-BypassEDR https://github.com/AabyssZG/HashDump-BypassEDR (reg.exe 导出 + RegReduction + secretsdump) | 替代: mimikatz/procdump | 存证: SAM/SYSTEM/SECURITY.hive + bootkey + hash',
  edr: 'EDR 绕过 → HashDump-BypassEDR https://github.com/AabyssZG/HashDump-BypassEDR | 替代: mimikatz | 存证: hive + hash',

  // 6. 运行时 / Hook
  frida: '运行时 hook -> Frida | Android 自包含替代: rustFrida https://github.com/kkkbbb/rustFrida | 存证: hook log/stack/参数',

  // 7. 协议 / 流量
  weakpass: '弱口令检测 → WeakPassDetect https://github.com/Pick-program/WeakPassDetect (端口扫描+21 服务爆破) | 替代: hydra/medusa | 存证: TXT 报告(端口+弱口令)',
  weak: '弱口令 → WeakPassDetect https://github.com/Pick-program/WeakPassDetect | 替代: hydra | 存证: 弱口令详情',
  brute: '爆破 → WeakPassDetect https://github.com/Pick-program/WeakPassDetect | 替代: hydra | 存证: 爆破结果',

  // 8. 恶意样本
  pe_inspector: 'PE 恶意检测 → pe-inspector https://github.com/la-1314/pe-inspector (Unipacker 脱壳+ClamAV/YARA+EMBER+MalConv2/PE-BERT) | 替代: ClamAV/YARA 手动 | 存证: JSON+HTML 威胁报告',
  malware: '恶意样本检测 → pe-inspector https://github.com/la-1314/pe-inspector | 替代: ClamAV | 存证: 威胁报告',
  yara: 'YARA 规则 → pe-inspector (多源合并编译) / yara_gen | 存证: 规则命中',
  ember: 'EMBER → pe-inspector https://github.com/la-1314/pe-inspector | 存证: 特征/判定',

  // 9. AI / LLM 安全

  // 10. 证据 / 报告
}

export function apply(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'tool_recommend',
    description: 'Recommend tools and evidence format from a task or signal description.',
    parameters: {
      query: { type: 'string', description: 'Plain task or signal, e.g. "APK unpack Frida dex"; empty returns the full tool matrix.' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { query?: string }) {
      const q = (args.query ?? '').toLowerCase()
      if (!q) {
        return await readTextSeam(ctx, resolve(refRoot, 'tool-matrix.md'))
      }
      const hits: string[] = []
      for (const [key, value] of Object.entries(rules)) {
        if (q.includes(key)) hits.push(value)
      }
      const unique = [...new Set(hits)]
      return unique.length
        ? unique.join('\n')
        : 'triage-and-route: detect_packer + scan_strings + create_case + hash_artifact'
    },
  }))
}
