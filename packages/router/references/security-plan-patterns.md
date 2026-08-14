---
name: patterns
description: Security analysis patterns quick reference — anti-analysis, packers, pitfalls.
---

# Patterns

Common security analysis patterns and quick reference tables.

## Quick Reference

### Packer/Protector Signatures

| Protector | Signature | Strategy |
|-----------|-----------|----------|
| UPX | `UPX!` magic | `upx -d` |
| VMProtect | `.winlice` + `.boot` sections (PE) or `.vmp0`/`.vmp1` (ELF) | Dynamic analysis only |
| TUSI | `UPX_BySpra` + trailer `TUSI-Obfus` | Frida dynamic unpack |
| Jiagu (360) | `libjiagu.so` + `libjiagu_art.so` | `adb shell am start` + attach dump |
| OLLVM | Flattened CFG, bogus blocks | IDA + script deobfuscation |

### Anti-Analysis Quick Check

| Technique | Detection | Bypass |
|-----------|-----------|--------|
| Frida detection | `/proc/self/maps` contains `frida` | Rename frida-server, use FUSE/bind mount |
| Anti-debug | `ptrace(PTRACE_TRACEME)` | Patch `ptrace` call or use kernel debugger |
| Integrity check | Self-hash computation | Runtime patch `cmp; b.eq` → `b` |
| Direct syscall | `svc #0` instead of libc calls | Use `process_vm_readv` or kernel module |

### Common Patch Encodings

| Arch | From | To | Bytes |
|------|------|----|-------|
| ARM64 | `b.eq` | `b` | `0x14000000` |
| ARM64 | `cbz` | `nop` | `0x1F2003D5` |
| x86 | `je` | `jne` | `74→75` |
| x86 | `call` | `nop` | `E8→90` |

## Detailed Patterns

| Pattern | Reference |
|---------|-----------|
| AES key capture | `skill-native/references/frida-hook-templates.md` |
| Anti-Frida DLL | `skill-native/references/vmp-pe-frida-windows.md` |
| Shell dropper | `skill-native/references/self-extracting-shellscript-analysis.md` |
| Android shellcode | `skill-native/references/android-shellcode-analysis.md` |
| Android ELF malware | `skill-android/references/android-elf-malware-analysis.md` |
| Root module | `skill-android/references/android-root-module-analysis.md` |
| Memory scanning | `skill-android/references/android-arm64-memory-dump.md` |
| Heap exploitation | `skill-native/references/heap-exploitation-methodology.md` |
| Web vulnerabilities | `skill-web/references/web-vulnerabilities.md` |
| AI/LLM attacks | `skill-ai-security/references/llm-attack-methodology.md` |
