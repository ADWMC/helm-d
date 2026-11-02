# Self-Extracting Shell Script Dropper Analysis

## Pattern Recognition

Self-extracting shell scripts use `sed` + `gzip` to embed binary payloads:

```bash
# Typical structure
sed -n "$((LINENO+1)),$ p" < "$0" | gzip -c -d > "${target}"
chmod +x "${target}"; "${target}"; rm -f "${target}"
```

**Indicators**: `sed -n`, `LINENO+1`, `gzip -c -d`, immediate self-delete after execution.

## Extraction Workflow

### 1. Find gzip magic bytes (`1f 8b`)
```python
data = open('sample.sh', 'rb').read()
pos = data.find(b'\x1f\x8b')
```

### 2. Decompress and check for nested layers
```python
import gzip
decompressed = gzip.decompress(data[pos:])
# Check if decompressed starts with shell code + another gzip stream
# If yes: find 'exit 127;' marker, split, decompress again
marker = b'exit 127;'
marker_pos = decompressed.find(marker)
if marker_pos >= 0:
    binary_start = marker_pos + len(marker) + 1  # skip newline
    second_gzip = decompressed[binary_start:]
    payload = gzip.decompress(second_gzip)
```

### 3. Handle N layers (recursive decompression)
```python
current = data[pos:]
depth = 0
while current[:2] == b'\x1f\x8b':
    depth += 1
    decompressed = gzip.decompress(current)
    marker = decompressed.find(b'exit 127;')
    if marker >= 0:
        current = decompressed[marker + len(b'exit 127;\n'):]
    else:
        break  # final payload
print(f"Layers: {depth}, Final payload: {len(decompressed)} bytes")
```

## Anti-Analysis Detection (Android ARM64 Shellcode)

### Common /proc scanning pattern
Shellcode reads `/proc/self/maps`, `/proc/self/smaps`, `/proc/self/status`, `/proc/self/fd/` and scans for:
- `frida`, `gum`, `gadget` (Frida detection)
- `TracerPid` non-zero (ptrace detection)
- Character-by-character comparison with hardcoded ASCII values

### Detection bypass: Corrupt XOR-encrypted path strings
If paths are XOR-encrypted (common key: 0xd5), corrupt the first byte:
```python
key = 0xd5
# '/proc/self/maps' XOR 0xd5 = encrypted bytes
# Change first encrypted byte so decrypted path becomes invalid → openat fails
encrypted_paths = [0x327514, 0x327532, 0x327543, ...]  # known offsets
for addr in encrypted_paths:
    data[file_offset + (addr - rwx_va)] = 0xaf  # 'z' XOR 0xd5
```

### Detection bypass: NOP character comparisons
```python
NOP = 0xD503201F  # ARM64 nop
# Find cmp w5, #0x66 ('f'), cmp w5, #0x54 ('T'), cmp w5, #0x67 ('g')
# NOP them to prevent string matching
```

### Integrity hash bypass
Many shellcodes compute a hash of their own code and exit if tampered.
**Critical**: The integrity check exit function uses `b` (unconditional branch), not `bl`.
This means the exit function has no return address — you cannot simply replace it with `ret`.

**Solution**: Bypass the check at the comparison point:
```python
# At the cmp + b.eq that gates the integrity check:
# Change b.eq to b (always succeed)
struct.pack_into('<I', data, check_offset, 0x14000006)  # b #+6
```

## Runtime Dumping (Android)

### Challenge: Process exits before dump
If the binary exits immediately after verification:
1. **Block license server** with iptables to force timeout
2. **Provide required inputs** (card-key, target process) to keep binary alive
3. **Race condition**: Poll /proc/PID/maps and dump /proc/PID/mem via `dd iflag=skip_bytes`
4. **ptrace tool**: Compile static ARM64 binary to intercept exit syscalls (needs NDK)

### dd for /proc/PID/mem (Android toybox)
```bash
# toybox dd supports iflag=skip_bytes (faster than bs=1)
dd if=/proc/$PID/mem of=dump.bin iflag=skip_bytes skip=$START count=$SIZE bs=65536
# bs=1 works but is very slow for large dumps (>1MB)
# bs=4096 with skip=$((START/4096)) is a compromise but loses byte-level precision
```

### I/O error on /proc/PID/mem
If dd/cat returns "read error: I/O error" even when the process appears alive in maps:
- Process may be in `ptrace_stop` state (traced by another debugger) → kill the tracer first
- Process may be exiting during the read → need to prevent exit (hook or ptrace)
- Memory region may have been unmapped by the kernel → check maps again

## Key Tool Gaps on Android Cloud Phones

| Need | Typical State | Workaround |
|------|--------------|------------|
| Python | Not installed | Use shell scripts |
| C compiler | Not installed | Cross-compile from host, push static binary |
| strace | Not available | Download static ARM64 build |
| Frida | May be detected | Rename agent or recompile gadget |

## Case Study: NBG.sh (Tencent Game Cheat RFTools)

- 3-layer gzip nesting → ARM64 Android ELF (4.23 MB)
- XOR 0xd5 encrypted strings (273 found)
- Direct syscalls (svc #0) for ALL file/network operations
- Anti-Frida: scans 9 /proc paths for frida/gum/gadget/TracerPid
- Integrity hash: custom mul+eor+ror+madd chain at 0x3268cc
- Encrypted payload: 1.17MB at RWX+0x10000, entropy 8.0
- Decryption: custom stream cipher, 24-byte blocks, runtime state variables
- License: T3 platform (w.t3yanzheng.com), any card-key accepted
- Driver: /dev/virtpipe-* IPC to running Tencent game process
- Exit trigger: driver connection failure → immediate exit
- Card-key cache: `/data/adb/modules/<module_name>/.t3card` (delete to force slow network verification)
- Virtual pipes: `/dev/virtpipe-common`, `/dev/virtpipe-render`, `/dev/virtpipe-sec` (IPC with game)
- Helper script: `.android_ios.sh` (IMEI spoofing, game prefs modification, property spoofing)
