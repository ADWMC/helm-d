# DLL Injection & Runtime Memory Patching with Frida

## When to Use

Target is a DLL injector (like GH_Loader) that:
- Injects encrypted DLLs into host processes
- Runs an embedded HTTP server for license/verification
- Uses packed/obfuscated DLLs (section RSize=0 on disk)

## Workflow

### Phase 1: Static Analysis of Loader

```
1. Detect PE type and sections (python struct parsing)
2. Check for VMP/UPX signatures
3. Extract strings: license, auth, api, inject, process names
4. Identify embedded resources (RCDATA sections)
5. Decrypt resources if custom encryption is used
```

### Phase 2: Decrypt Embedded Payload

Custom XOR cipher pattern (24-byte repeating key):
```python
# Common pattern: key transformation per byte
key[i] = (constant - (key[i] * multiplier)) & 0xFF
data[i] ^= key[i % key_length]
```

Find the key in .rdata section near string constants. The transformation
constants are often loaded via `movabs` instructions before the XOR loop.

### Phase 3: Runtime Analysis with Frida

**Hook strategy (in priority order):**
1. `Module.findExportByName()` throws TypeError on Frida 17.x — use `mod.enumerateExports()` instead
2. Hook network APIs: `send`, `recv`, `WSASend`, `connect`, `getaddrinfo`
3. Hook file APIs: `CreateFileW`, `WriteFile` for config/license paths
4. Hook crypto: `CryptCreateHash` for hash verification
5. If ALL hooks show 0 traffic → DLL uses direct syscalls. Skip to Phase 4.

**Enumerate modules to find injected DLL:**
```javascript
Process.enumerateModules().forEach(function(m) {
    if (m.path.indexOf("suspicious_path") !== -1) {
        console.log("Found: " + m.base + " size=0x" + m.size.toString(16));
    }
});
```

### Phase 4: Memory Dump & Static Analysis of Runtime Code

When DLL sections have RSize=0 (packed/encrypted on disk):
1. Dump from runtime: `addr.readByteArray(size)` in chunks
2. Save as binary file
3. Analyze the dump with standard tools (rafind2, strings, pattern search)

**Key patterns to search in dump:**
- Response templates: `{"ok":false`, `{"ok":true`, `"expires_at"`
- Verification strings: `"license"`, `"valid"`, `"hwid"`, `"Server rejected"`
- Code patterns: `84 c0 0f 84` (test al,al + je) near CALL instructions

### Phase 5: Code Patching

**Find the verification function:**
1. Locate response template strings in data section
2. Find LEA instructions referencing them (scan .text for `48 8D` / `4C 8D` with RIP-relative)
3. Trace back to find the CALL + test + je pattern

**Patch targets (in priority order):**
1. **Conditional jump NOP**: `0f 84 xx xx xx xx` → `90 90 90 90 90 90` (6-byte NOP)
2. **Branch inversion**: `75` (jne) → `eb` (jmp) to force success path
3. **Return value force**: `84 c0` (test al,al) → `b0 01` (mov al,1)
4. **NULL check bypass**: NOP the `je` after `test rax,rax` for allocation checks

**Apply patches with Frida:**
```javascript
Memory.patchCode(addr, size, function(ptr) {
    ptr.writeByteArray([0x90, 0x90, ...]); // NOPs
});
```

## Critical Pitfalls

| Problem | Cause | Fix |
|---------|-------|-----|
| Hooks show 0 traffic despite server responding | DLL uses direct syscalls bypassing ntdll/ws2_32 | Patch memory directly, don't hook APIs |
| Patch causes timeout/hang | Success path needs data only populated by real verify | Patch the verify function itself, not just the branch |
| Server stops responding after patches | Multiple conflicting patches corrupted state | Restart process, apply all patches atomically at startup |
| Response missing required fields (e.g. expires_at) | Patched the wrong branch or template | Find the COMPLETE success template and ensure code reaches it |
| `Memory.scan` finds 0 results for known strings | Strings are constructed at runtime or in different encoding | Use manual byte scanning in execute_code instead |
| Offset calculation wrong (address vs file offset) | PE sections have different file offsets than RVAs | Always parse section headers to convert RVA↔FOffset |
| Patching packed DLL binary has no effect | RSize=0 sections are unpacked at runtime | Must patch in-memory after DLL loads, not on disk |

## Anti-Pattern: Incremental Patching

**DO NOT** patch one thing, test, patch another, test... This corrupts the process state.

**DO**: Analyze ALL needed patches first (from dump), then apply ALL at once when process is fresh.

## Template: Auto-Patch Frida Script

```javascript
// Wait for DLL → apply all patches → report success
var base = null;
function findDLL() {
    Process.enumerateModules().forEach(function(m) {
        if (m.path.indexOf("TARGET") !== -1) base = m.base;
    });
    return base !== null;
}

function applyPatches() {
    // Patch 1: NOP conditional jump
    Memory.patchCode(base.add(OFFSET1), 6, function(ptr) {
        ptr.writeByteArray([0x90,0x90,0x90,0x90,0x90,0x90]);
    });
    // Patch 2: Force branch
    Memory.patchCode(base.add(OFFSET2), 1, function(ptr) {
        ptr.writeByteArray([0xeb]);
    });
}

if (findDLL()) { applyPatches(); }
else {
    var iv = setInterval(function() {
        if (findDLL()) { clearInterval(iv); setTimeout(applyPatches, 2000); }
    }, 500);
}
```
