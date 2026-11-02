# Zygisk Module License Bypass

## Architecture

Zygisk modules (KernelSU/Magisk) with PRO licensing typically follow this pattern:

```
JS UI (WebUI)
  → ksu.exec("copg_lic status")    # shell command to root helper
  → copg_lic binary                 # standalone validator
  → pipe/socket back to .so         # 1-byte response (1=valid, 0=invalid)
  → context[+0x1C] = flag           # license flag in memory
  → CMP flag, #1; B.NE → skip PRO  # feature gate
```

### Key Files in a Zygisk Module ZIP

| File | Role |
|------|------|
| `zygisk/arm64-v8a.so` | Main native module (arm64) |
| `zygisk/x86_64.so` | Emulator variant |
| `zygisk/armeabi-v7a.so` | 32-bit variant |
| `webroot/js/copg-data.js` | Bridge layer (ksu.exec wrapper) |
| `webroot/js/license.js` | License UI |
| `webroot/config.json` | KsuWebUI manifest |

The `copg_lic` binary is NOT in the ZIP — it lives on-device at `/data/adb/modules/COPG/copg_lic`.

## Detection Strings

```bash
# Quick triage — search for these in the .so
strings arm64-v8a.so | grep -iE 'lic_check|license|CPGL|copg_lic|VALID|GRACE|EXPIRED|REVOKED|FREE|MISMATCH'
```

### Common String Offsets (example from COPG v5.7.1)

| String | Purpose |
|--------|---------|
| `lic_check` | Command sent over pipe to companion |
| `/data/adb/modules/.../license/license.bin` | License file path |
| `CPGL` (43 50 47 4C) | License binary magic header |
| `COPG-L1`, `COPG-L2` | License tier identifiers |
| `ro.build.fingerprint` | Device fingerprint for binding |

## License Verification Flow (arm64)

### Step 1: Companion Entry Receives Command

```asm
; zygisk_companion_entry reads commands from pipe
; Command dispatch compares 8-byte chunks
; "lic_check" = 0x696c5f636865636b + 0x6b
```

### Step 2: Read and Validate License File

```asm
; Open license.bin, read into buffer
; Check file size >= 0x6c (108 bytes minimum)
; Check first 4 bytes == CPGL magic (0x5043_4c47)
; If invalid → set flag = 0, return
```

### Step 3: Cryptographic Verification

```
SHA-256 initialization (0x6a09e667f2bdc928 = h0)
→ Hash license payload
→ Polynomial MAC with 128-bit coefficient table
→ Compare against embedded expected value
→ If mismatch → set flag = 0
→ If match → set flag = 1
```

### Step 4: Feature Gating

```asm
; context structure (x28/r14 register):
; [+0x18] = has some feature configured
; [+0x19] = has PRO features configured
; [+0x1A] = another feature flag
; [+0x1B] = another feature flag
; [+0x1C] = LICENSE FLAG (1=valid, 0=invalid)  ← TARGET
; [+0x110] = tier/level value

; Gate pattern (arm64):
LDRB W8, [X28, #0x1C]    ; load license flag
CMP  W8, #1               ; check if valid
B.NE skip_pro_features    ; ← PATCH THIS to NOP

; Gate pattern (x86_64):
CMP  byte ptr [R14+0x1C], 1
JNE  skip_pro_features    ; ← PATCH THIS to NOP NOP
```

## Patch Strategy

### arm64-v8a: NOP Conditional Branches

Find all `B.NE` instructions that check `[context, #0x1C]`:

```python
# Pattern: LDRB Wn, [X28, #0x1C]; CMP Wn, #1; B.NE target
# Patch: NOP = 0xD503201F

# In COPG v5.7.1, three gates:
# 0x78da4: B.NE → NOP  (carrier/SIM spoofing)
# 0x78df4: B.NE → NOP  (location spoofing)
# 0x78e3c: B.NE → NOP  (remaining PRO features)
```

### x86_64: NOP Conditional Jumps

```python
# Pattern: CMP byte ptr [R14+0x1C], 1; JNE target
# Patch: NOP NOP = 0x90 0x90

# In COPG v5.7.1, three gates:
# 0x69da0: JNE → NOP NOP
# 0x69de7: JNE → NOP NOP
# 0x69e24: JNE → NOP NOP
```

### Generic Patch Script

```python
from elftools.elf.elffile import ELFFile

def patch_license_gates(so_path, gates):
    """
    gates: list of (addr, original_bytes, patch_bytes)
    """
    with open(so_path, 'rb') as f:
        elf = ELFFile(f)
        text = elf.get_section_by_name('.text')
        text_offset = text['sh_offset']
        text_addr = text['sh_addr']

    with open(so_path, 'rb') as f:
        data = bytearray(f.read())

    for addr, orig, patch in gates:
        off = text_offset + (addr - text_addr)
        assert data[off:off+len(orig)] == orig, f"Mismatch at {hex(addr)}"
        data[off:off+len(patch)] = patch

    out = so_path.replace('.so', '-patched.so')
    with open(out, 'wb') as f:
        f.write(data)
    return out
```

## Alternative: Fake copg_lic Script

If patching .so is not feasible, replace the `copg_lic` binary with a script:

```bash
#!/system/bin/sh
case "$1" in
  status) echo "state=VALID"; echo "tier=COPG-L2"; echo "expiry=0";;
  enroll) echo "COPG1-0000-0000-0000-0000";;
esac
```

**Caveat**: The .so also validates license.bin directly via pipe. Fake copg_lic alone may not suffice — the .so's internal lic_check reads the file independently. Best approach: combine both (fake copg_lic + patched .so).

## Pitfalls

| Issue | Cause | Fix |
|-------|-------|-----|
| Patching only JS UI | JS is display-only; real check is in .so | Must patch .so |
| copg_lic not in ZIP | It's an on-device binary, not distributed in the webroot | Analyze .so instead |
| armeabi-v7a different structure | Thumb-2 encoding, different register allocation | Separate analysis needed |
| Module update overwrites patch | OTA/module update replaces .so | Re-patch after each update |
| Only patching one gate | Multiple independent gates for different PRO features | Find and patch ALL gates |
| SHA-256 + MAC makes forging hard | Custom polynomial MAC with embedded coefficients | Easier to bypass gates than forge license |
| `strings` command not available on Windows | git-bash/MSYS may lack it | Use Python regex on binary |

## Finding License Flag Gates (General Approach)

1. Export symbols → find `zygisk_companion_entry`
2. Search for license file path string → find ADRP+ADD references
3. Trace from file read → CPGL magic check → SHA-256 → flag store
4. Find all `LDRB Wn, [context, #0x1C]` followed by `CMP #1; B.NE`
5. NOP all conditional branches that gate on the flag
