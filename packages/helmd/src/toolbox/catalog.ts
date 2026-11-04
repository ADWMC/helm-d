// Curated external-tool catalog. Only entries with a verified GitHub
// repository are allowed (operator rule, 2026-11-04): commercial tools and
// projects without a GitHub home stay out of the installer. The catalog is
// bundled with the package and is the ONLY source the model/UI may install
// from — it never accepts an arbitrary URL.
//
// `kind`:
//   release — install a release asset from this repository (digest required)
//   pip     — show the pip command (not executed by helm-d)
//   manual  — show the upstream/source-build command (not executed)

export type ToolKind = 'release' | 'pip' | 'manual'

export interface ToolCatalogEntry {
  id: string
  name: string
  /** Verified GitHub repository (https://github.com/<owner>/<repo>). */
  repo: string
  category: string
  purpose: string
  kind: ToolKind
  /** pip package name for kind=pip. */
  package?: string
  /** Install/build hint shown for pip/manual entries. */
  installHint?: string
  /** Verified invocation template shown to the model after install. */
  usage: string
  /** Pin a specific release tag (needed when latest belongs to another project). */
  tag?: string
  /** Pin an exact release asset name (raw binaries without extensions). */
  asset?: string
  /** Version-agnostic asset matcher; must resolve to exactly one digest-pinned asset. */
  assetPattern?: string
}

export const TOOL_CATALOG: ToolCatalogEntry[] = [
  // Android
  {
    id: 'garlic',
    name: 'garlic',
    repo: 'https://github.com/neocanable/garlic',
    category: 'Android',
    purpose: 'APK/DEX/JAR fast decompiler and string search',
    kind: 'release',
    tag: 'v1.8-release',
    asset: 'garlic-win64.exe',
    usage: 'garlic -d out/ app.apk',
  },
  {
    id: 'jadx',
    name: 'jadx',
    repo: 'https://github.com/skylot/jadx',
    category: 'Android',
    purpose: 'DEX/APK to Java decompiler',
    kind: 'release',
    assetPattern: '^jadx-\\d.*\\.zip$',
    usage: 'jadx -d out/ app.apk',
  },
  {
    id: 'apktool',
    name: 'apktool',
    repo: 'https://github.com/iBotPeaches/Apktool',
    category: 'Android',
    purpose: 'APK unpack/repack, smali and resources',
    kind: 'release',
    usage: 'java -jar apktool.jar d app.apk -o out/',
  },
  {
    id: 'androguard',
    name: 'androguard',
    repo: 'https://github.com/androguard/androguard',
    category: 'Android',
    purpose: 'APK static analysis (manifest, call graph)',
    kind: 'pip',
    package: 'androguard',
    installHint: 'pip install androguard',
    usage: 'python -c "from androguard.core.apk import APK; ..."',
  },
  {
    id: 'unidbg',
    name: 'unidbg',
    repo: 'https://github.com/zhkl0228/unidbg',
    category: 'Android',
    purpose: 'Android native SO emulation',
    kind: 'manual',
    installHint: 'git clone + ./mvnw package (JDK required)',
    usage: 'java -jar unidbg-android.jar ...',
  },
  {
    id: 'fernflower',
    name: 'fernflower',
    repo: 'https://github.com/JetBrains/fernflower',
    category: 'Android',
    purpose: 'Java bytecode decompiler',
    kind: 'manual',
    installHint: 'download the fernflower jar / build from source',
    usage: 'java -jar fernflower.jar classes/ out/',
  },
  {
    id: 'rustfrida',
    name: 'rustFrida',
    repo: 'https://github.com/kkkbbb/rustFrida',
    category: 'Android',
    purpose: 'Android ARM64 dynamic instrumentation',
    kind: 'release',
    asset: 'rustfrida',
    usage: 'rustfrida --spawn <package>',
  },
  {
    id: 'frida',
    name: 'Frida',
    repo: 'https://github.com/frida/frida',
    category: 'Runtime',
    purpose: 'Cross-platform dynamic instrumentation',
    kind: 'pip',
    package: 'frida-tools',
    installHint: 'pip install frida frida-tools',
    usage: 'frida -U -f <package> -l hook.js',
  },

  // Web / JavaScript
  {
    id: 'scrapling',
    name: 'Scrapling',
    repo: 'https://github.com/D4Vinci/Scrapling',
    category: 'Web',
    purpose: 'Adaptive web scraping / anti-bot handling',
    kind: 'pip',
    package: 'scrapling',
    installHint: 'pip install scrapling',
    usage: 'python -m scrapling ...',
  },
  {
    id: 'wechat-lm',
    name: 'WeChat-lm',
    repo: 'https://github.com/HSGQSRGS/WeChat-lm',
    category: 'Web',
    purpose: 'WeChat mini-program unpacking',
    kind: 'pip',
    package: 'wechat-lm',
    installHint: 'pip install wechat-lm',
    usage: 'welm ...',
  },
  {
    id: 'ip-checker',
    name: 'ip_checker',
    repo: 'https://github.com/test692618/ip_checker',
    category: 'Web',
    purpose: 'IP liveness probe',
    kind: 'manual',
    installHint: 'build from source or use the project Releases page',
    usage: 'ip_checker -f ips.txt',
  },
  {
    id: 'cipherbridge',
    name: 'CipherBridge',
    repo: 'https://github.com/CuriousLearnerDev/CipherBridge',
    category: 'Web',
    purpose: 'Encryption/signature analysis bridge',
    kind: 'manual',
    installHint: 'download from the repository Releases; no sha256 digest published',
    usage: 'CipherBridge --help',
  },

  // Native / binary
  {
    id: 'headless-ida',
    name: 'headless-ida',
    repo: 'https://github.com/DennyDai/headless-ida',
    category: 'Native',
    purpose: 'IDA headless scripting (requires IDA Pro)',
    kind: 'pip',
    package: 'headless-ida',
    installHint: 'pip install headless-ida',
    usage: 'python -m headless_ida ...',
  },
  {
    id: 'radare2',
    name: 'radare2',
    repo: 'https://github.com/radareorg/radare2',
    category: 'Native',
    purpose: 'Command-line reverse-engineering framework',
    kind: 'release',
    assetPattern: '^radare2-.*-w64\\.zip$',
    usage: 'r2 -A sample.bin',
  },
  {
    id: 'ghidra',
    name: 'Ghidra',
    repo: 'https://github.com/NationalSecurityAgency/ghidra',
    category: 'Native',
    purpose: 'NSA reverse-engineering suite',
    kind: 'release',
    usage: 'ghidraRun',
  },
  {
    id: 'detect-it-easy',
    name: 'Detect It Easy',
    repo: 'https://github.com/horsicq/Detect-It-Easy',
    category: 'Native',
    purpose: 'Packer/compiler detection',
    kind: 'manual',
    installHint: 'install from the project Releases page (only pre-release DB assets on GitHub)',
    usage: 'diec sample.exe',
  },
  {
    id: 'upx',
    name: 'UPX',
    repo: 'https://github.com/upx/upx',
    category: 'Native',
    purpose: 'Executable packer/unpacker',
    kind: 'release',
    assetPattern: '^upx-.*-win64\\.zip$',
    usage: 'upx -d packed.exe',
  },

  // Windows
  {
    id: 'vmp-static-unpacker',
    name: 'VMPStaticUnpacker',
    repo: 'https://github.com/YuroGod/VMPStaticUnpacker',
    category: 'Windows',
    purpose: 'VMProtect static unpacking',
    kind: 'manual',
    installHint: 'download from the project Releases page (no published release found)',
    usage: 'VMPStaticUnpacker.exe sample.exe',
  },
  {
    id: 'x64dbg',
    name: 'x64dbg',
    repo: 'https://github.com/x64dbg/x64dbg',
    category: 'Windows',
    purpose: 'Windows user-mode debugger',
    kind: 'release',
    assetPattern: '^snapshot_.*\\.zip$',
    usage: 'x64dbg.exe sample.exe',
  },
  {
    id: 'x64dbg-mcp',
    name: 'x64dbg-mcp',
    repo: 'https://github.com/SetsunaYukiOvO/x64dbg-mcp',
    category: 'Windows',
    purpose: 'MCP bridge for x64dbg',
    kind: 'release',
    asset: 'x64dbg_mcp.dp64',
    usage: 'install plugin into x64dbg plugins/',
  },
  {
    id: 'hashdump-bypassedr',
    name: 'HashDump-BypassEDR',
    repo: 'https://github.com/AabyssZG/HashDump-BypassEDR',
    category: 'Windows',
    purpose: 'EDR-resistant hash dump helper',
    kind: 'release',
    usage: 'BootKey.exe',
  },

  // Protocol / malware
  {
    id: 'weakpassdetect',
    name: 'WeakPassDetect',
    repo: 'https://github.com/Pick-program/WeakPassDetect',
    category: 'Protocol',
    purpose: 'Weak-password detection',
    kind: 'manual',
    installHint: 'download from the project Releases page (no published release found)',
    usage: 'python weak_passwd_detect.py ...',
  },
  {
    id: 'pe-inspector',
    name: 'pe-inspector',
    repo: 'https://github.com/la-1314/pe-inspector',
    category: 'Malware',
    purpose: 'PE malware inspection',
    kind: 'manual',
    installHint: 'download from the project Releases page (no published release found)',
    usage: 'pe-inspector sample.exe',
  },

  // General
  {
    id: 'dex2jar',
    name: 'dex2jar',
    repo: 'https://github.com/pxb1988/dex2jar',
    category: 'General',
    purpose: 'DEX to JAR conversion',
    kind: 'manual',
    installHint: 'download from the repository Releases; no sha256 digest published',
    usage: 'd2j-dex2jar classes.dex',
  },
  {
    id: 'cfr',
    name: 'CFR',
    repo: 'https://github.com/leibnitz27/cfr',
    category: 'General',
    purpose: 'Java decompiler',
    kind: 'manual',
    installHint: 'download the CFR jar from Releases; no sha256 digest published',
    usage: 'java -jar cfr.jar classes.jar',
  },
  {
    id: 'nmap',
    name: 'nmap',
    repo: 'https://github.com/nmap/nmap',
    category: 'General',
    purpose: 'Network/port scanning',
    kind: 'manual',
    installHint: 'install from nmap.org or the distro package manager',
    usage: 'nmap -sV target',
  },
  {
    id: 'wireshark',
    name: 'Wireshark',
    repo: 'https://github.com/wireshark/wireshark',
    category: 'General',
    purpose: 'Packet capture/analysis',
    kind: 'manual',
    installHint: 'install from wireshark.org or the distro package manager',
    usage: 'tshark -r capture.pcap',
  },
]

export function catalogEntry(id: string): ToolCatalogEntry | undefined {
  return TOOL_CATALOG.find((entry) => entry.id === id)
}

/** Only https://github.com/<owner>/<repo> is accepted; every catalog entry
 *  must pass this (checked by the toolbox-catalog check). */
export function isGithubRepo(url: string): boolean {
  return /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(url)
}
