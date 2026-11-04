import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { join, resolve } from 'node:path'
import { packageRoot, readTextSeam  } from '../seam.js'
import { TOOL_CATALOG, catalogEntry } from '../toolbox/catalog.js'
import { installCatalogTool, installCatalogMirror, toolHealth, updateCatalogTool } from '../toolbox/installer.js'
import { probeCommand } from '../toolbox/health.js'
import { loadSettings } from '../settings.js'

const refRoot = join(packageRoot(), 'references', 'toolbox')

// 信号 -> 首选工具 | 替代 | 存证格式（按分类分组）
const rules: Record<string, string> = {
  // 0. 总则：工具获取
  tool: '工具获取: 先查本机(where/Get-Command/--version) → 有则直接用并记版本路径 → 无则除 C 盘外最大盘建 X:\\Reverse\\ 下载 → 超时先探本机代理，探不到就直连 → 详见 references/toolbox/tool-install.md',
  install: '工具获取: 先查本机 → 无则除 C 外最大盘 X:\\Reverse\\ → 超时先探本机代理，探不到就直连 → 详见 references/toolbox/tool-install.md',
  download: '工具获取: 先查本机 → 无则除 C 外最大盘 X:\\Reverse\\ → 超时先探本机代理，探不到就直连 → 详见 references/toolbox/tool-install.md',
  proxy: '出站通道: 先直连一次 → 失败则探环境变量/系统设置/回环监听端口，逐个用控制请求验证 → 全部失败回退直连+换源 → 靶机与内网地址永不走代理 → 详见 references/toolbox/network-egress.md',
  timeout: '出站通道: 直连失败后探本机可用代理(验证通过才用)，探不到就直连+换源，不要猜端口 → 详见 references/toolbox/network-egress.md',
  network: '出站通道: 直连优先，失败后按 环境变量→系统设置→回环端口 发现代理并验证，全部失败回退直连+换源 → 详见 references/toolbox/network-egress.md',
  setup: '环境配置: scoop install apktool/jadx/adb + pip install frida/capstone/unicorn → 详见 references/toolbox/tool-install.md',
  env: '环境配置: scoop install apktool/jadx/adb + pip install frida/capstone/unicorn → 详见 references/toolbox/tool-install.md',

  // 2. Android
  garlic: 'garlic https://github.com/neocanable/garlic/releases — C 实现的超快 APK/DEX/JAR 反编译器 + aarch64 ELF 分析 | 下载: Releases 选平台二进制 | 首选: 快速初筛/字符串搜索/ELF 分析',
  decompile: 'garlic https://github.com/neocanable/garlic/releases — APK/DEX/JAR 反编译 (200MB/12s) | 下载: Releases | 首选: 快速初筛',
  jadx: 'jadx https://github.com/skylot/jadx/releases — DEX/APK → Java 反编译 | 下载: Releases 选 `jadx-x.x.x.zip` | 深度反编译/交叉引用',
  dex: 'DEX → garlic https://github.com/neocanable/garlic/releases (首选) | 替代: jadx/Fernflower | 存证: Java 源码',
  apktool: 'apktool https://github.com/ibotpeaches/apktool/releases — APK 解包/重打包/smali 调试 | 下载: Releases 选 `apktool_x.x.x.jar`',
  apk: 'APK → garlic (快速反编译) + apktool (解包) | 存证: Java 源码/smali/manifest',
  mobsf: 'MobSF https://github.com/MobSF/Mobile-Security-Framework-MobSF — 静态+动态一体化移动应用评估 | docker run -p 8000:8000 opensecurity/mobile-security-framework-mobsf | 存证: 报告/流量',
  objection: 'objection https://github.com/sensepost/objection — Frida 运行时移动探索 | pip install objection | objection -g <pkg> explore',
  quark: 'Quark Engine https://github.com/ev-flow/quark-engine — 安卓恶意行为评分 | pip install quark-engine | quark -a app.apk -s',
  apkid: 'APKiD https://github.com/rednaga/APKiD — 壳/保护器/混淆器识别 | pip install apkid | apkid app.apk',
  androguard: 'androguard https://github.com/androguard/androguard — pip install androguard | APK 静态分析',
  unidbg: 'unidbg https://github.com/zhkl0228/unidbg — Android native SO 模拟执行 | 下载: Releases 或 mvnw package 构建',
  emulat: '模拟执行 → unidbg | 替代: angr/unicorn',
  fernflower: 'fernflower https://github.com/jetBrains/fernflower — Java 字节码 → Java | 下载: Releases 选 `fernflower.jar`',
  jar: 'JAR → garlic https://github.com/neocanable/garlic/releases (首选) | 替代: fernflower/CFR',
  bytecode: '字节码 → fernflower https://github.com/jetBrains/fernflower/releases',
  jvm: 'JVM mod 常量加密 → scripts/native/jvm/ 全管线 (scan_jar/extract/flatten/Oracle/decrypt) + references/native/jvm-mod-deobf-workflow.md | headless JVM oracle 重放，不逆向 PRNG',
  forge: 'Forge/Fabric mod 常量加密 → references/native/jvm-mod-deobf-workflow.md + scripts/native/jvm/ | 特征: MixinConfigs manifest + emoji/iI 类名 + DESKeySpec 共现',
  mixin: 'mixin 混淆类 → references/native/jvm-mod-deobf-workflow.md §1 特征速查 + scan_jar.py 分类',
  des: 'DES 常量解密 (DESKeySpec+IvParameterSpec+DES/CBC/NoPadding 同类共现) → references/native/jvm-mod-deobf-workflow.md + decrypt_sites.py | key = ret ^ xor, 大端 8B, 零 IV',
  indy: 'indy bootstrap 惰性解密 (Lookup/MutableCallSite 签名) → 静态不可解, 保留运行时原解密器 | 判定依据: references/native/jvm-mod-deobf-workflow.md §6',
  rustfrida: 'rustFrida https://github.com/kkkbbb/rustFrida/releases — Android ARM64 动态插桩 | 下载: Releases 选 ELF ARM64 → adb push',
  instrument: '动态插桩 -> rustFrida https://github.com/kkkbbb/rustFrida/releases',
  spawn: 'spawn 注入 -> rustFrida --spawn 或 Frida -f',
  'search': '字符串搜索 → garlic -f "pattern" (支持正则) | 下载: https://github.com/neocanable/garlic/releases',

  // 3. Web / JavaScript
  scrapling: 'Scrapling https://github.com/d4vinci/Scrapling — pip install scrapling | 自适应网页抓取/反爬',
  scrap: '网页抓取 → Scrapling | pip install scrapling',
  crawl: '爬虫 → Scrapling | pip install scrapling',
  wechat: 'WeChat-lm https://github.com/HSGQSRGS/WeChat-lm — pip install wechat-lm | 微信小程序渗透',
  wxapkg: '微信小程序包 → WeChat-lm | pip install wechat-lm',
  miniprogram: '微信小程序逆向 → WeChat-lm | pip install wechat-lm',
  ip_check: 'IP 存活检测 → ip_checker https://github.com/test692618/ip_checker/releases | 下载: Releases 选平台二进制',
  alive: '存活检测 → ip_checker https://github.com/test692618/ip_checker/releases',
  cipher: '加解密/签名 → CipherBridge https://github.com/CuriousLearnerDev/CipherBridge/releases | 下载: Releases 选平台二进制',
  decrypt: '解密 → CipherBridge https://github.com/CuriousLearnerDev/CipherBridge/releases',
  aes: 'AES → CipherBridge https://github.com/CuriousLearnerDev/CipherBridge/releases',
  sign: '签名 → CipherBridge https://github.com/CuriousLearnerDev/CipherBridge/releases',
  nuclei: 'Nuclei https://github.com/projectdiscovery/nuclei — 模板化漏洞扫描 | UI 工具页直接装 Windows 包 | nuclei -u <target> -severity high,critical',
  ffuf: 'ffuf https://github.com/ffuf/ffuf — Web 目录/参数 fuzz | UI 工具页直接装 Windows 包 | ffuf -w wordlist.txt -u https://target/FUZZ',
  mitm: 'mitmproxy https://github.com/mitmproxy/mitmproxy — TLS 拦截/重放 | pip install mitmproxy | mitmproxy -p 8080',
  impacket: 'Impacket https://github.com/fortra/impacket — SMB/WMI/Kerberos 协议工具 | pip install impacket | python -m impacket.examples.secretsdump -h',
  netexec: 'NetExec https://github.com/Pennyw0rth/NetExec — 网络/AD 枚举与执行 | pipx install git+https://github.com/Pennyw0rth/NetExec | nxc smb 10.0.0.0/24',
  sqlmap: 'sqlmap https://github.com/sqlmapproject/sqlmap — SQL 注入检测/利用 | git clone + python sqlmap.py -u "<url>" --batch',

  // 4. Native / 二进制
  'headless-ida': 'headless-ida https://github.com/DennyDai/headless-ida — pip install headless-ida | IDA idalib 无界面跑脚本',
  idalib: 'idalib → headless-ida | pip install headless-ida',
  ida: 'IDA 反汇编 → headless-ida + IDA Pro | 替代: Ghidra/radare2',
  radare2: 'radare2 https://github.com/radareorg/radare2/releases — 命令行逆向框架 | 下载: Releases 选平台二进制 | scoop install radare2',
  r2: 'r2 → radare2 https://github.com/radareorg/radare2/releases',
  rizin: 'Rizin https://github.com/rizinorg/rizin/releases — radare2 分支，CLI 逆向框架 | UI 工具页可直接装 Windows 静态包 | rizin -A sample.bin',
  capa: 'capa https://github.com/mandiant/capa — 识别可执行文件能力并映射 ATT&CK/MBC | pip install flare-capa | capa sample.exe',
  floss: 'FLOSS https://github.com/mandiant/flare-floss — 提取混淆/栈字符串 | pip install flare-floss | floss sample.exe',
  angr: 'angr https://github.com/angr/angr — 符号执行/二进制分析平台 | pip install angr',
  pwntools: 'pwntools https://github.com/Gallopsled/pwntools — 漏洞利用开发/CTF | pip install pwntools (建议 WSL/Kali) | pwn checksec ./bin',
  rop: 'ROPgadget https://github.com/JonathanSalwan/ROPgadget — 搜索 ROP/JOP gadget | pip install ROPgadget | ROPgadget --binary ./bin',
  ghidra: 'Ghidra https://github.com/NationalSecurityAgency/ghidra/releases — 反编译套件 | 约 570MB，建议手动下载 | GhidraMCP https://github.com/LaurieWired/GhidraMCP 提供 agent 接口',
  firmware: '固件提取 → binwalk (cargo install binwalk / 手动下载) + unblob (Linux/WSL: pip install unblob) | binwalk firmware.bin',
  semgrep: 'Semgrep https://github.com/semgrep/semgrep — 模式化源码审计 | pip install semgrep | semgrep --config auto .',
  joern: 'Joern https://github.com/joernio/joern — 代码属性图/数据流查询 | 下载 joern-cli-windows-x86_64.zip (~1.7GB) | joern --script query.sc',

  // 5. Windows
  vmp: 'VMP → VMPStaticUnpacker https://github.com/YuroGod/VMPStaticUnpacker/releases | 下载: Releases 选 `VMPStaticUnpacker.exe`',
  vmprotect: 'VMProtect → VMPStaticUnpacker https://github.com/YuroGod/VMPStaticUnpacker/releases',
  unpack: '脱壳 → VMPStaticUnpacker https://github.com/YuroGod/VMPStaticUnpacker/releases / detect_packer',
  x64dbg: 'x64dbg https://github.com/x64dbg/x64dbg/releases — Windows 用户态调试器 | 下载: Releases 选 `snapshot_*.zip`',
  debug: 'Windows 调试 → x64dbg https://github.com/x64dbg/x64dbg/releases',
  'x64dbg-mcp': 'x64dbg-mcp https://github.com/SetsunaYukiOvO/x64dbg-mcp/releases — AI 控制调试 | 下载: Releases 选 `dp32/dp64`',
  mcp: 'MCP 调试 → x64dbg-mcp https://github.com/SetsunaYukiOvO/x64dbg-mcp/releases',
  hashdump: 'Hash Dump → HashDump-BypassEDR https://github.com/AabyssZG/HashDump-BypassEDR/releases | 下载: Releases 选 `BootKey.exe` + gcc 编译',
  edr: 'EDR 绕过 → HashDump-BypassEDR https://github.com/AabyssZG/HashDump-BypassEDR/releases',

  // 6. 运行时 / Hook
  frida: '运行时 hook -> Frida | pip install frida frida-tools | Android 自包含替代: rustFrida https://github.com/kkkbbb/rustFrida/releases',

  // 7. 协议 / 流量
  weakpass: '弱口令检测 → WeakPassDetect https://github.com/Pick-program/WeakPassDetect/releases | 下载: Releases 选平台二进制',
  weak: '弱口令 → WeakPassDetect https://github.com/Pick-program/WeakPassDetect/releases',
  brute: '爆破 → WeakPassDetect https://github.com/Pick-program/WeakPassDetect/releases',

  // 8. 恶意样本
  pe_inspector: 'PE 恶意检测 → pe-inspector https://github.com/la-1314/pe-inspector/releases | 下载: Releases 选平台二进制',
  malware: '恶意样本检测 → pe-inspector https://github.com/la-1314/pe-inspector/releases',
  yara: 'YARA https://github.com/VirusTotal/yara — 规则匹配/样本分类 | UI 工具页装 Windows 包 | yara rule.yar sample.exe',
  ember: 'EMBER/PE 特征 → pe-inspector https://github.com/la-1314/pe-inspector/releases / yara_gen',
  volatility: 'Volatility 3 https://github.com/volatilityfoundation/volatility3 — 内存取证 | pip install volatility3 | vol -f memory.raw windows.pslist',
  oletools: 'oletools https://github.com/decalage2/oletools — Office/OLE 宏分析 | pip install oletools | olevba sample.doc',
  pesieve: 'PE-sieve https://github.com/hasherezade/pe-sieve — 进程注入/内存 implant 检测 | UI 工具页装 Windows 包 | pe-sieve64.exe /pid <pid>',
  hollows: 'hollows_hunter https://github.com/hasherezade/hollows_hunter — 扫描进程 hollowing/injection | UI 工具页装 Windows 包 | hollows_hunter64.exe /loop',

  // 9. AI / LLM 安全
  garak: 'garak https://github.com/NVIDIA/garak — LLM 漏洞/越狱扫描 | pip install "garak==0.17.0"（0.17.1 wheel 缺 probe 模块）| garak --target_type openai --target_name <model> --spec probes.encoding.InjectBase64 -g 1',
  jailbreak: '模型安全评测 -> references/ai-security/{model-security-analysis-guide,bypass-framework-matrix}.md；在自有测试样本上比较响应分类、拒答一致性和审计记录',
  llm: 'LLM 应用安全评测 -> garak + references/ai-security/ + llm_sim 工具',
}

export function registerToolboxTools(ctx: Context): void {
  const tokenize = (text: string): string[] => [...new Set(
    text.toLowerCase().split(/[^a-z0-9\u4e00-\u9fff]+/).filter((token) => token.length >= 2),
  )]
  const catalogMatches = (query: string) => {
    const tokens = tokenize(query)
    return TOOL_CATALOG.map((entry) => {
      const haystack = `${entry.id} ${entry.name} ${entry.category} ${entry.purpose} ${entry.usage}`.toLowerCase()
      const reasons = tokens.filter((token) => haystack.includes(token))
      const health = toolHealth(entry.id)
      const score = reasons.length * 10 + (health.installed ? 3 : 0) + (entry.license !== undefined ? 1 : 0)
      return { entry, score, reasons, health }
    }).filter((row) => row.reasons.length > 0)
      .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id))
      .slice(0, 8)
  }
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
      const matches = catalogMatches(q)
      const catalogLines = matches.map(({ entry, health, reasons }) =>
        `- ${entry.id} (${entry.category}) — ${entry.purpose} | ${health.installed ? `installed ${health.version ?? ''}` : 'not installed'} | trust=${entry.license !== undefined ? 'verified' : 'unverified'} | match=${reasons.join(',')}`)
      const tail = catalogLines.length > 0 ? ['catalog matches (scored; installed first):', ...catalogLines] : []
      if (unique.length > 0) return [...unique, ...tail].join('\n')
      return tail.length > 0
        ? tail.join('\n')
        : 'triage-and-route: begin_case + detect_packer + scan_strings + hash_artifact'
    },
  }))
  ctx.tools.register(defineTool({
    name: 'toolbox',
    description:
      'External-tool catalog and install status. action=catalog lists curated tools with GitHub repo, purpose, usage, and whether installed; ' +
      'action=status shows installed rows; action=mcp lists read-only MCP tool names exposed by the host; ' +
      'action=probe checks whether a local command resolves (where/which, cached 5min; never executes it); ' +
      'action=install installs one catalog release asset; action=update re-downloads the latest release; ' +
      'action=mirror installs a local archive with an operator-supplied sha256 (offline); ' +
      'model install/update/mirror are disabled unless the operator enables them. ' +
      'Only bundled catalog entries with a verified GitHub repository exist — arbitrary URLs are not accepted.',
    parameters: {
      action: { type: 'string', required: true, description: 'catalog | status | mcp | probe | install | update | mirror' },
      id: { type: 'string', description: 'Catalog id for install/update/mirror (e.g. jadx).' },
      asset_name: { type: 'string', description: 'Release asset name when the release has multiple candidates.' },
      path: { type: 'string', description: 'Local archive path for action=mirror.' },
      sha256: { type: 'string', description: 'Required sha256 for action=mirror.' },
      query: { type: 'string', description: 'catalog: filter by id/name/category/purpose.' },
    },
    output: { schema: { type: 'string' }, render: (_a: unknown, v: string) => [{ type: 'text', text: v }] },
    async execute(args: { action: string; id?: string; asset_name?: string; path?: string; sha256?: string; query?: string }) {
      if (args.action === 'probe') {
        const command = (args.query ?? args.id ?? '').trim()
        if (command === '') return 'REJECTED — probe needs query (a command name)'
        try {
          return JSON.stringify(probeCommand(command))
        } catch (error) {
          return 'REJECTED — ' + (error instanceof Error ? error.message : String(error))
        }
      }
      if (args.action === 'mcp') {
        let names: string[] = []
        try {
          const schemas = (ctx.tools as unknown as { schemas?: () => Array<{ name?: unknown }> }).schemas
          names = typeof schemas === 'function' ? schemas().map((schema) => String(schema.name ?? '')).filter((name) => name.startsWith('mcp__')) : []
        } catch { /* host without public schema enumeration */ }
        return names.length > 0
          ? ['MCP tools (read-only discovery; no external server is started):', ...names.sort().map((name) => '- ' + name)].join('\n')
          : 'no MCP tools are registered in this host'
      }
      if (args.action === 'catalog' || args.action === 'status') {
        const q = (args.query ?? '').toLowerCase()
        const rows = TOOL_CATALOG
          .filter((entry) => (args.action === 'status' ? toolHealth(entry.id).installed : true))
          .filter((entry) => q === '' || (entry.id + ' ' + entry.name + ' ' + entry.category + ' ' + entry.purpose).toLowerCase().includes(q))
          .map((entry) => {
            const health = toolHealth(entry.id)
            const status = health.installed
              ? 'installed ' + String(health.version) + ' at ' + String(health.path)
              : 'not installed'
            return '- ' + entry.id + ' (' + entry.category + ') — ' + entry.purpose + '\n'
              + '  repo: ' + entry.repo + '\n'
              + '  kind: ' + entry.kind + ' | ' + status
              + (entry.license !== undefined ? ' | license: ' + entry.license : '') + '\n'
              + (entry.installHint !== undefined ? '  install: ' + entry.installHint + '\n' : '')
              + '  usage: ' + entry.usage
          })
        return rows.length > 0 ? rows.join('\n') : 'no catalog entries match'
      }
      if (args.action === 'install' || args.action === 'update' || args.action === 'mirror') {
        const entry = catalogEntry(args.id ?? '')
        if (entry === undefined) return 'REJECTED — unknown catalog id: ' + (args.id ?? '(empty)')
        if (entry.kind !== 'release') {
          return entry.name + ' is a ' + entry.kind + ' tool; install manually: ' + (entry.installHint ?? entry.usage)
        }
        if (!loadSettings().toolbox.modelInstall) {
          return 'REJECTED — model install is disabled. Use the WebUI 工具 tab (operator action), or enable toolbox.modelInstall in settings.'
        }
        try {
          const installed = args.action === 'install'
            ? await installCatalogTool(entry.id, args.asset_name)
            : args.action === 'update'
              ? await updateCatalogTool(entry.id, args.asset_name)
              : await installCatalogMirror(entry.id, args.path ?? '', args.sha256 ?? '')
          return 'installed ' + installed.name + ' ' + installed.version + '\n'
            + 'path: ' + installed.path + '\n'
            + 'sha256: ' + installed.sha256 + '\n'
            + 'usage: ' + entry.usage
        } catch (error) {
          return 'REJECTED — ' + (error instanceof Error ? error.message : String(error))
        }
      }
      return 'REJECTED — action must be catalog | status | mcp | probe | install | update | mirror.'
    },
  }))

}
