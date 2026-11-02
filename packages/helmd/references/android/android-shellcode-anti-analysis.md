# Android ARM64 Shellcode Anti-Analysis & Card-Key Protection

## Case Study: NBG.sh (Telegram @xsnbyyds)

Multi-layer obfuscated Android ARM64 dropper distributing card-key protected tools.

### Structure

```
NBG.sh (3.1MB)
├─ Lines 1-6: Comments + find/rm (deletes 32-char hex filenames in /data/)
├─ Line 7: Shell dropper (root check, random path, chmod 123, 0.5s self-delete)
└─ Line 8+: 3-layer gzip nesting
     └─ Layer 1: Shell code copy + gzip
          └─ Layer 2: Shell code copy + gzip
               └─ Layer 3: ELF64 AArch64 Android binary (4.23 MB)
```

### ELF Binary Analysis

| Property | Value |
|----------|-------|
| Format | ELF64 ET_DYN (PIE), stripped |
| Architecture | AArch64 (ARM64) |
| Interpreter | `/system/bin/linker64` (Android) |
| Entry point | 0x320050 (inside RWX segment) |
| RWX segment | 0x320000, 1.2 MB |

### RWX Segment Layout

```
0x320000-0x330000 (64KB)  → Stage 1 shellcode (plaintext ARM64)
  ├─ 0x320050: Entry point (register save, stack frame)
  ├─ 0x320094: Flag check + anti-analysis chain
  ├─ 0x3231b0: Decryption loop (custom stream cipher, 24-byte blocks)
  ├─ 0x3268e4: Register restore + ret
  ├─ 0x326934: Exit function (mov w10, #errcode; b 0x326934)
  ├─ 0x3269b4: Cache flush (dc cvau / ic ivau / dsb ish / isb)
  └─ 0x326a18: Key derivation function

0x330000-0x44e7f0 (1.17MB) → Stage 2 encrypted payload (entropy 8.00)
```

### Anti-Analysis Techniques

#### 1. Direct Syscalls (bypass all libc hooks)

All /proc file operations use `svc #0` directly:
- openat (56), read (63), close (57), writev (66), mprotect (226), exit_group (94)

**Implication**: Frida `Interceptor.attach` on libc functions catches NOTHING.

#### 2. /proc File Scanning

| File | Detection Target |
|------|-----------------|
| /proc/self/maps | "frida", "gum", "gadget" |
| /proc/self/smaps | Same strings |
| /proc/self/status | TracerPid != 0 |
| /proc/self/fd/ | frida-agent file descriptors |
| /proc/net/unix | frida unix sockets |
| /proc/cpuinfo | Emulator detection |
| /proc/self/auxv | Analysis environment |
| /proc/uptime | Timing analysis |

String comparison is character-by-character against immediate values in CMP instructions:
- `cmp w5, #0x66` (f), `cmp w5, #0x72` (r), `cmp w5, #0x69` (i), etc.

#### 3. Integrity Hash Check

At 0x3268cc: `cmp w16, w17; b.eq #0x3268e4`

Computes hash of shellcode data using mul/eor/ror/madd chain with keys from RWX segment. If ANY byte of shellcode is modified → hash mismatch → exit.

#### 4. Anti-Tampering Exit Function

50+ conditional branches all target 0x326934 (exit function). Exit function writes "NBG_EXIT:XX" to stderr then calls exit_group(0).

### Decryption Algorithm

Custom stream cipher processing 24-byte (0x18) blocks:

```
State variables: w10, w11, w20, w21, w26 (initialized from RWX key material)
Keys: Stored at 0x327d00-0x327e60 in RWX segment

Per-byte derivation:
  w27 = (w26 * 3 + byte_offset) * 8 + byte_index
  w5 = w27 * w10 XOR w21 XOR (w27/3 * w11) XOR 0x9e3779b9
  w8 = chain of XOR+ROR with keys from 0x327e50, 0x327d84, 0x327dbc, ...
  w5 = w5 XOR w8 (after xorshift mixing)
  output_byte = input_byte XOR (w5 + w27/256) XOR w20
  w20 = rotate(w20 XOR output_byte XOR w27, 3) + 0x3d

After block: copy buffer → original location, cache flush, mprotect(RX)
```

Key constants:
- 0x9e3779b9 (golden ratio hash constant)
- 0x85ebca6b, 0x3c6ef372 (additional mixing constants)
- Keys at 0x327df0=0x966f9555, 0x327df4=0x73debafb, 0x327df8=0x773adda7

**Problem**: State variables (w10, w11, w20, w21) are computed at runtime from earlier function calls. Cannot fully replicate statically.

### Card-Key (卡密) Protection

After shellcode completes and returns, the binary's main code:
1. Prints "初始化授权组件 ... OK"
2. Prints "读取本地授权 ... NONE"
3. Prompts "卡密Key > "
4. Validates key → if valid, decrypts stage 2 payload
5. If invalid → "读取授权码失败" → exit(1)

**The encrypted payload only decrypts with a valid card-key.** Without it, analysis hits a dead end at the encryption layer.

### Bypass Attempts & Results

| Approach | Result | Why |
|----------|--------|-----|
| NOP all conditional branches (202) | Process exits, no decryption | Breaks control flow needed by decryption loop |
| Corrupt /proc path strings (XOR 0xfa→0xaf) | Process exits | openat failure treated as anomaly → exit |
| Patch exit function → register restore | Infinite loop | b (not bl) to exit, LR points back to caller |
| Patch integrity check (b.eq→b) + NOP char checks | Process exits | Other detection paths still trigger |
| Rename frida-server to fs-helper | Still detected | frida-agent-64.so injected into target maps |
| Memory.patchCode at runtime | Works for individual patches | Too many detection paths to patch all |
| Frida spawn + pre-patch before resume | Process exits | Anti-Frida detection runs in shellcode, not libc |

### Working Approaches (for this class of binary)

1. **Static analysis of shellcode logic** (this session) — Full disassembly of anti-analysis, decryption algorithm, key locations
2. **ptrace-based syscall interception** — Intercept openat to redirect /proc reads to clean files (requires C cross-compiler or static ARM64 binary)
3. **Custom frida-agent without "frida" string** — Compile from source with renamed agent
4. **Card-key acquisition** — Social engineering / purchasing the tool license
5. **Emulated execution** — QEMU user-mode emulation with controlled /proc filesystem

### Key Pattern: XOR 0xd5 String Encryption

Strings are encrypted with single-byte XOR 0xd5:
```python
decrypted = bytes(b ^ 0xd5 for b in encrypted_bytes)
```

Found at RWX segment offsets 0x327514+ (paths), 0x327728 ("NBG_EXIT:XX").
