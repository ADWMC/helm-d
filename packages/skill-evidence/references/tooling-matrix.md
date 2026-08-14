# Tooling Matrix

Select tools already available in the environment. Do not install heavy tooling unless useful and permitted.

## Universal triage
- Hashes: `Get-FileHash`, `sha256sum`, Python `hashlib`
- File type: `file`, Python magic-bytes fallback
- Strings: `strings`, FLOSS, Python fallback
- Metadata: ExifTool, Detect It Easy, TrID
- Hex view: `xxd`, `hexdump`, HxD, 010 Editor

## Native binary static analysis
- Ghidra, IDA Free/Pro, Binary Ninja, Radare2/rizin, objdump, readelf, nm, dumpbin
- PE: PE-bear, CFF Explorer, pefile, sigcheck
- ELF: readelf, checksec, ldd only in safe contexts, eu-readelf
- Mach-O: otool, jtool2, class-dump/objc tools

## Dynamic analysis
- Debuggers: x64dbg, WinDbg, gdb/lldb, Frida
- Tracing: Procmon, Process Explorer, API Monitor, strace/ltrace, dtruss, ETW/xperf
- Network: Wireshark, tcpdump, mitmproxy in authorized lab
- Sandboxes: local VM snapshots, containers for Linux utilities, emulator for mobile

## Managed/mobile
- .NET: dnSpyEx, ILSpy, dotnet metadata tools
- Java/Android: jadx, apktool, dex2jar, Android Studio profiler, adb
- iOS/macOS: class-dump, Hopper/Ghidra, lldb, Frida on owned test devices

## Firmware
- binwalk, unblob, jefferson/sasquatch, unsquashfs, qemu-user/system, FirmAE when appropriate

## Vulnerability evidence
- Sanitizers: ASAN/UBSAN/MSAN where recompilation is possible
- Fuzzing harness support: libFuzzer/AFL++/honggfuzz for owned code or lab targets
- Crash triage: debugger stack trace, registers, fault address, input offset correlation
- Patch diff: bindiff, Diaphora, Ghidra version tracking, git diff/source diff

## Evidence to collect per tool run
Record command, version, input hash, output path, timestamp, and interpretation. Prefer raw logs plus a short summarized finding.
