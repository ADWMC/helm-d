import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readTextSeam } from '../seam.js'

const refRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../references/toolbox')

// 信号 -> 首选工具 | 替代 | 存证格式（按分类分组）
const rules: Record<string, string> = {
  // 0. 总则：工具获取
  tool: '工具获取: 先查本机(where/Get-Command/--version) → 有则直接用并记版本路径 → 无则除 C 盘外最大盘建 X:\\Reverse\\ 下载 → 下载走代理 → 详见 references/toolbox/tool-install.md',
  install: '工具获取: 先查本机 → 无则除 C 外最大盘 X:\\Reverse\\ → 走代理下载 → 详见 references/toolbox/tool-install.md',
  download: '工具获取: 先查本机 → 无则除 C 外最大盘 X:\\Reverse\\ → 走代理下载 → 详见 references/toolbox/tool-install.md',
  setup: '环境配置: scoop install apktool/jadx/adb + pip install frida/capstone/unicorn → 详见 references/toolbox/tool-install.md',
  env: '环境配置: scoop install apktool/jadx/adb + pip install frida/capstone/unicorn → 详见 references/toolbox/tool-install.md',

  // 2. Android
  garlic: 'garlic https://github.com/neocanable/garlic/releases — C 实现的超快 APK/DEX/JAR 反编译器 + aarch64 ELF 分析 | 下载: Releases 选平台二进制 | 首选: 快速初筛/字符串搜索/ELF 分析',
  decompile: 'garlic https://github.com/neocanable/garlic/releases — APK/DEX/JAR 反编译 (200MB/12s) | 下载: Releases | 首选: 快速初筛',
  jadx: 'jadx https://github.com/skylot/jadx/releases — DEX/APK → Java 反编译 | 下载: Releases 选 `jadx-x.x.x.zip` | 深度反编译/交叉引用',
  dex: 'DEX → garlic https://github.com/neocanable/garlic/releases (首选) | 替代: jadx/Fernflower | 存证: Java 源码',
  apktool: 'apktool https://github.com/ibotpeaches/apktool/releases — APK 解包/重打包/smali 调试 | 下载: Releases 选 `apktool_x.x.x.jar`',
  apk: 'APK → garlic (快速反编译) + apktool (解包) | 存证: Java 源码/smali/manifest',
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

  // 4. Native / 二进制
  'headless-ida': 'headless-ida https://github.com/DennyDai/headless-ida — pip install headless-ida | IDA idalib 无界面跑脚本',
  idalib: 'idalib → headless-ida | pip install headless-ida',
  ida: 'IDA 反汇编 → headless-ida + IDA Pro | 替代: Ghidra/radare2',
  radare2: 'radare2 https://github.com/radareorg/radare2/releases — 命令行逆向框架 | 下载: Releases 选平台二进制 | scoop install radare2',
  r2: 'r2 → radare2 https://github.com/radareorg/radare2/releases',

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
  yara: 'YARA 规则 → pe-inspector https://github.com/la-1314/pe-inspector/releases / yara_gen',
  ember: 'EMBER → pe-inspector https://github.com/la-1314/pe-inspector/releases',
}

export function registerToolboxTools(ctx: Context): void {
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
