# PE Memory Dump Reconstruction

## When to Use

You have a raw memory dump of a packed/encrypted PE (DLL or EXE) where:
- Section headers show RSize=0 (empty on disk)
- The binary is unpacked in memory but packed on disk
- IDA/r2 can't load the original file because sections have no raw data
- You need to do static analysis on the runtime-unpacked code

## Workflow

### Step 1: Dump from Runtime with Frida

```javascript
var base = null;
var size = 0;
Process.enumerateModules().forEach(function(m) {
    if (m.path.indexOf("TARGET") !== -1) {
        base = m.base; size = m.size;
    }
});

var file = new File("C:\\dump.bin", "wb");
for (var off = 0; off < size; off += 4096) {
    try {
        file.write(base.add(off).readByteArray(Math.min(4096, size - off)));
    } catch(e) {
        file.write(new ArrayBuffer(Math.min(4096, size - off)));
    }
}
file.close();
```

### Step 2: Fix Section Headers for Flat Mapping

The dump is in memory layout (RVA = file offset from base). Fix section headers
so RawOffset = RVA and RawSize = VirtSize:

```python
import struct

with open('dump.bin', 'rb') as f:
    dump = bytearray(f.read())

pe_off = struct.unpack_from('<I', dump, 0x3C)[0]
n = struct.unpack_from('<H', dump, pe_off+6)[0]
magic = struct.unpack_from('<H', dump, pe_off+0x18)[0]
opt_off = pe_off + 0x18 + (0xF0 if magic == 0x20b else 0xE0)

for i in range(n):
    s_off = opt_off + i * 40
    vsize = struct.unpack_from('<I', dump, s_off+8)[0]
    rva = struct.unpack_from('<I', dump, s_off+12)[0]
    struct.pack_into('<I', dump, s_off+16, vsize)  # RawSize = VirtSize
    struct.pack_into('<I', dump, s_off+20, rva)    # RawOffset = RVA

with open('unpacked.dll', 'wb') as f:
    f.write(dump)
```

### Step 3: Load in IDA/r2

The reconstructed PE can now be loaded directly:
- IDA: File -> Open -> select unpacked.dll, IDA auto-detects PE64
- r2: `r2 -B <base> unpacked.dll` (base from the original module load address)

## Key Insight

Packed PE files (VMP, Themida, custom packers) have sections with RawSize=0.
The actual code/data is encrypted in the file and decrypted at runtime.
The memory dump captures the post-decryption state.
Fixing headers makes the dump a valid PE that analysis tools can load directly.

## Pitfalls

| Problem | Fix |
|---------|-----|
| IDA shows wrong addresses | Use `-B base_addr` to set correct base |
| Some pages are zero-filled | Unreadable pages were filled with 0x00 during dump |
| r2 aaa hangs on large dump | Skip full analysis, use `rafind2` + targeted `pd` |
| Section permissions wrong | Headers preserved original permissions, which are correct |
