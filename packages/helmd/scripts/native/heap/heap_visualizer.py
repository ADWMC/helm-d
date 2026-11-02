#!/usr/bin/env python3
"""Heap Visualizer - Parse glibc heap dump, visualize chunks.

Usage:
    python heap_visualizer.py dump.bin [--base 0xHEAP_BASE]
"""
import sys, struct

def parse_heap_chunks(data, base=0):
    chunks = []
    offset = 0
    while offset < len(data) - 16:
        prev_size = struct.unpack("<Q", data[offset:offset+8])[0]
        size_flags = struct.unpack("<Q", data[offset+8:offset+16])[0]
        size = size_flags & ~0x7
        flags = size_flags & 0x7
        if size == 0 or size > len(data) - offset: break
        inuse = not (flags & 1)
        is_mmap = bool(flags & 2)
        is_prev_inuse = bool(flags & 1)
        chunks.append({
            "offset": offset, "addr": base + offset,
            "prev_size": prev_size, "size": size,
            "inuse": inuse, "mmap": is_mmap, "prev_inuse": is_prev_inuse
        })
        offset += max(size, 16)
    return chunks

def detect_corruption(chunks):
    issues = []
    for i, c in enumerate(chunks):
        if c["size"] < 16:
            issues.append(f"0x{c['addr']:x}: suspiciously small chunk ({c['size']} bytes)")
        if i > 0 and c["prev_inuse"] == False and chunks[i-1]["inuse"] == True:
            issues.append(f"0x{c['addr']:x}: prev_inuse=0 but previous chunk is in-use (double-free?)")
    return issues

def main():
    if len(sys.argv) < 2:
        print("Usage: python heap_visualizer.py dump.bin [--base 0xHEAP_BASE]")
        sys.exit(1)
    data = open(sys.argv[1], "rb").read()
    base = 0
    if "--base" in sys.argv:
        base = int(sys.argv[sys.argv.index("--base") + 1], 16)
    chunks = parse_heap_chunks(data, base)
    print(f"Chunks: {len(chunks)}")
    print("-" * 80)
    for c in chunks:
        status = "INUSE" if c["inuse"] else "FREE"
        flags = []
        if c["mmap"]: flags.append("MMAP")
        if not c["prev_inuse"]: flags.append("PREV_FREE")
        flag_str = " ".join(flags) if flags else ""
        print(f"  0x{c['addr']:010x}  size=0x{c['size']:05x} ({c['size']:6d})  {status:4s}  {flag_str}")
    issues = detect_corruption(chunks)
    if issues:
        print(f"\nPotential issues ({len(issues)}):")
        for issue in issues:
            print(f"  [!] {issue}")

if __name__ == "__main__":
    main()
