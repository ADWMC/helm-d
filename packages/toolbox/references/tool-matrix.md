# 工具矩阵（Tool Matrix）

按任务选首选工具、替代与存证格式。按需读，非硬性规则。

| 任务 | 首选 | 替代 | 存证 |
|------|------|------|------|
| 样本分诊 | `file` + `hash` + `detect_packer` | `triage_artifact` | 类型 / 哈希 / 熵 / 壳判定 |
| PE / ELF 静态 | IDA / Ghidra | radare2 / rizin / objdump | 函数 / 类型 / xrefs |
| 字符串 / 签名 | `scan_strings` | strings | 签名 / URL / 报错串 |
| 编码 / 加密 | `encoding_detect` + `xor_bruteforce` | CyberChef | 明文 / 密钥 / 算法 |
| APK / DEX | JADX / apktool + `apk_fingerprint` | Androguard / Ghidra | manifest / call graph / smali |
| 运行时 hook | Frida + `dynamic-analysis-frida.md` | x64dbg / LLDB | hook log / stack / 参数 |
| 内存 dump | Frida dump + 校验清单 | WinDbg / Volatility | dump + headers / mappings / imports |
| 协议流量 | Wireshark / tshark + `pcap_parse` | Scapy / Kaitai | 字段表 / 状态机 |
| Web 请求 | Chrome DevTools / CDP + `bot_analyze` | mitmproxy / Playwright | HAR / 请求 diff |
| 恶意样本 | triage + `ioc_extract` + `yara_gen` | 沙箱 | IOC / 规则 / 行为 |
| LLM 注入 | `llm_sim` + `ai_reference` | 手工 | payload / 响应 |
| 证据 / 报告 | `create_case` + `hash_artifact` | 手工 | case 目录 / 哈希 / 报告 |

规则：

- 记录工具版本、命令、时间戳、输入哈希、环境变量。
- 自动反编译结果是假设，直到运行时或交叉引用证据确认。
- 首选工具不可用时，说明原因并选替代，不空转。
