#!/usr/bin/env python3
"""Packer Detection - Detect PE/ELF packers: UPX, VMProtect, Themida, OLLVM, TUSI.

Usage:
    python detect_packer.py target.bin
"""
import sys, math, struct
from collections import Counter

def entropy(data):
    if not data: return 0
    freq = Counter(data)
    n = len(data)
    return -sum((c/n) * math.log2(c/n) for c in freq.values())

def detect_pe_packer(data):
    if data[:2] != b'MZ': return None, []
    pe_off = struct.unpack_from('<I', data, 0x3C)[0]
    if pe_off + 24 > len(data): return None, []
    if data[pe_off:pe_off+4] != b'PE': return None, []
    num_sec = struct.unpack_from('<H', data, pe_off + 6)[0]
    opt_size = struct.unpack_from('<H', data, pe_off + 20)[0]
    sec_off = pe_off + 24 + opt_size
    sections = []
    signs = []
    for i in range(min(num_sec, 20)):
        if sec_off + (i+1)*40 > len(data): break
        sec = data[sec_off+i*40 : sec_off+(i+1)*40]
        name = sec[:8].rstrip(b'\x00').decode('ascii', errors='ignore')
        vsize = struct.unpack_from('<I', sec, 8)[0]
        raw_size = struct.unpack_from('<I', sec, 16)[0]
        sections.append(name)
        if raw_size == 0 and vsize > 0:
            signs.append(f"section {name}: RSize=0 (packed)")
    signs_detect = []
    if any('.vmp' in s for s in sections): signs_detect.append("VMProtect (.vmp section)")
    if any('.winlice' in s for s in sections): signs_detect.append("VMProtect/Themida (.winlice)")
    if any('.boot' in s for s in sections): signs_detect.append("VMProtect boot (.boot)")
    if any('.themida' in s for s in sections): signs_detect.append("Themida")
    if any('.ndata' in s for s in sections): signs_detect.append("NSIS installer (.ndata)")
    if b'TUSI-ObfuscatorClang' in data: signs_detect.append("TUSI-ObfuscatorClang")
    if b'UPX_BySpra' in data: signs_detect.append("TUSI modified UPX")
    elif b'UPX!' in data[:0x1000] or b'UPX!' in data[-0x1000:]:
        signs_detect.append("UPX")
    return signs_detect, signs + sections

def detect_elf_packer(data):
    if data[:4] != b'\x7fELF': return None, []
    signs_detect = []
    sections = []
    if b'.vmp0' in data or b'.vmp1' in data: signs_detect.append("VMProtect (.vmp0/.vmp1)")
    if b'TUSI-ObfuscatorClang' in data: signs_detect.append("TUSI-ObfuscatorClang")
    if b'UPX_BySpra' in data: signs_detect.append("TUSI modified UPX (UPX_BySpra)")
    elif b'UPX!' in data[:0x1000] or b'UPX!' in data[-0x1000:]:
        signs_detect.append("UPX")
    if b'OLLVM' in data or b'Obfuscator-LLVM' in data:
        signs_detect.append("OLLVM")
    return signs_detect, sections

def main():
    if len(sys.argv) < 2:
        print("Usage: python detect_packer.py target.bin")
        sys.exit(1)
    filepath = sys.argv[1]
    data = open(filepath, "rb").read()
    ent = entropy(data)
    print(f"File: {filepath}")
    print(f"Size: {len(data)} bytes")
    print(f"Entropy: {ent:.2f} bits/byte")
    if ent > 7.5: print("  [!] High entropy - possibly packed/encrypted")
    print()
    pe_signs, pe_secs = detect_pe_packer(data)
    elf_signs, elf_secs = detect_elf_packer(data)
    signs = pe_signs or elf_signs
    secs = pe_secs or elf_secs
    if signs:
        print(f"Detected packers:")
        for s in signs: print(f"  [!] {s}")
    else:
        print("No known packer signatures detected")
    if secs:
        print(f"\nSections: {', '.join(secs[:15])}")

if __name__ == "__main__":
    main()
