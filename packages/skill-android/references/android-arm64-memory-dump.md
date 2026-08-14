# Android ARM64 ELF Dropper: Runtime Memory Dump When Frida Fails

## Problem

Target binary has anti-Frida/anti-analysis shellcode that:
- Reads `/proc/self/maps` checking for "frida", "gum", "gadget" strings
- Uses direct syscalls (svc #0) bypassing libc hooks
- Exits too fast for manual memory dumping (~1-2 seconds lifecycle)

## Solution: Cross-compiled ptrace dumper via process_vm_readv

### Step 1: Cross-compile a static ARM64 dumper on host

Requires `gcc-aarch64-none-linux-gnu` via scoop:
```bash
scoop install gcc-aarch64-none-linux-gnu
```

The dumper.c approach:
1. Write card-key to temp file
2. `fork()` → child redirects stdin from card-key file → `execv()` target binary
3. Parent waits 50ms, reads `/proc/child/maps` to find RWX segment
4. Reads RWX via `process_vm_readv()` in 64KB chunks (fast, kernel-level)
5. Fallback: `pread()` from `/proc/child/mem`
6. Writes dump to stdout, analysis to stderr
7. Kills child, cleans up

Compile:
```bash
CC="aarch64-none-linux-gnu-gcc"
$CC -static -O2 -D_GNU_SOURCE -o dumper dumper.c -lm
```

### Step 2: Deploy and run

```bash
adb push dumper /data/local/tmp/dumper
adb shell "su -c 'chmod 755 /data/local/tmp/dumper'"
adb shell "su -c '/data/local/tmp/dumper > /data/local/tmp/rwx.bin 2>/data/local/tmp/dump.log'"
```

### Key findings from this session

- `process_vm_readv()` works when `/proc/PID/mem` returns I/O error (process in kernel wait state)
- `process_vm_readv()` reads in chunks (64KB) to avoid partial-read issues
- Cloud phone devices (RedFinger-style) crash easily under heavy fork+exec; use `usleep(50000)` delay
- The RWX segment entropy (5.61 vs file's 8.0) indicates shellcode decrypts part of the segment during execution
- The dumper captures the RWX state DURING the shellcode's execution, not after

### Pitfalls

| Problem | Cause | Fix |
|---------|-------|-----|
| `/proc/PID/mem` I/O error | Process in kernel `do_wait` state (nanosleep) | Use `process_vm_readv()` instead |
| `process_vm_readv` returns partial data | Process exits mid-read | Read in 64KB chunks, accept partial |
| Cloud phone crashes | Fork+exec overhead on thin VMs | Add `usleep(50000)` before dump |
| `libc.so.6` not found on Android | Cross-compiler links against glibc | Use `-nostdlib -nodefaultlibs -lgcc` for shared libs |
| `dd` skip calculation wrong | `skip` is in blocks of `bs`, not bytes | Use `skip=$((ADDR/4096))` with `bs=4096` |

### Anti-analysis detection keywords

The shellcode checks these strings in `/proc/self/maps`:
- `frida` (character-by-character: f,r,i,d,a)
- `gum` (g,u,m)
- `gadget` (g,a,d,g,e,t)
- `TracerPid` in `/proc/self/status`

Detection uses direct syscalls (svc #0), NOT libc. Frida libc hooks are bypassed.

### Gadget rename trick

If using a Frida gadget (`libgadget.so`) via `LD_PRELOAD`, rename it to remove "gadget":
```bash
cp libgadget.so libhelper.so
LD_PRELOAD=/path/to/libhelper.so ./target
```
The maps entry shows the renamed path, avoiding "gadget" detection.

Note: some gadget builds require API 30+ (Android 11+) and fail on API 29.
