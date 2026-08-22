# IDAPython - Batch NOP/patch bytes at addresses from CSV
# Usage: idat -A -S"ida_batch_patch.py patches.csv" target
# CSV format: address,patch_bytes (hex)
import sys, csv, ida_bytes, idc

patches_file = sys.argv[1] if len(sys.argv) > 1 else "C:/tmp/patches.csv"
idaapi.auto_wait()
count = 0
with open(patches_file) as f:
    for row in csv.reader(f):
        if not row or row[0].startswith("#"): continue
        addr = int(row[0], 16)
        patch = bytes.fromhex(row[1])
        for i, b in enumerate(patch):
            ida_bytes.patch_byte(addr + i, b)
        count += 1
        print(f"Patched 0x{addr:x} ({len(patch)} bytes)")
print(f"Applied {count} patches")
idc.qexit(0)
