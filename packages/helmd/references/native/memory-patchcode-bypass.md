# Memory.patchCode Bypass — When API Hooks Fail

## Problem

Some protected DLLs use **direct syscalls** or unconventional socket APIs that bypass all standard Windows API hooks:
- `send()`, `WSASend()`, `WSASendMsg()` — no trigger
- `WriteFile()`, `NtWriteFile()` — no trigger
- `TransmitFile()` — no trigger
- `accept()` never fires (connection pre-established or IOCP-based)

This was observed in a DLL running an embedded HTTP server on a TCP port (confirmed via netstat) where curl received responses but zero hooks triggered.

## Solution: Patch Response Template in Memory

Instead of intercepting the response at the API level, directly modify the data that the DLL uses to construct responses.

### Steps

1. **Identify the response pattern** in the DLL's data sections:
   ```
   frida -p <PID> -e '
   var base = null;
   Process.enumerateModules().forEach(function(m) {
       if (m.path.indexOf("TARGET_DLL") !== -1) base = m.base;
   });
   // Scan for response template
   Memory.scan(base, size, "hex_pattern", {
       onMatch: function(addr, size) { console.log("Found: " + addr); },
       onComplete: function() {}
   });
   '
   ```

2. **Patch with Memory.patchCode**:
   ```javascript
   // Example: change "false" to "true " in JSON response
   // false = 66 61 6C 73 65
   // true  = 74 72 75 65 20  (padded to same length)
   Memory.patchCode(addr.add(offset), 5, function(ptr) {
       ptr.writeByteArray([0x74, 0x72, 0x75, 0x65, 0x20]);
   });
   ```

3. **Verify** with curl/Python that the response changed.

### Key Insights

- `Memory.patchCode` works on runtime-modified data, not just static code
- The pattern `"7B 22 6F 6B 22 3A 66 61 6C 73 65"` (`{"ok":false`) may not exist as a static string — it might be constructed at runtime from smaller pieces
- However, the **component strings** (like `"false"`, `"ok"`, `"reason"`, `"not found"`) ARE present in the data section
- Patching the string values (e.g., changing `"false"` bytes to `"true "`) affects the dynamically-constructed response
- This approach is **process-lifetime only** — restart requires re-patching

### When to Use

- DLL runs an embedded HTTP server (netstat shows LISTENING port)
- All standard socket API hooks (send/WSASend/WriteFile/NtWriteFile) show zero activity
- curl/Python can reach the server and get responses
- The response contains a checkable field (like `"ok":false`)

### Frida 17.x Notes

- `Module.findExportByName()` throws `TypeError: not a function` on Windows
- Use `module.enumerateExports()` and iterate to find exports
- `Memory.scan()` with hex string patterns works but can be slow on large DLLs (>50MB)
- `Memory.patchCode()` requires the callback pattern — cannot write directly
