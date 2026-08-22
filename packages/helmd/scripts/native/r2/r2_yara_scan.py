#!/usr/bin/env python3
"""r2 YARA Scanner - Scan binary with YARA rules via r2pipe.

Usage:
    python r2_yara_scan.py target.bin rules.yar [--sections]

Requires: pip install r2pipe yara-python
"""
import r2pipe, sys, yara, os

def yara_scan(target, rules_file, scan_sections=False):
    rules = yara.compile(filepath=rules_file)
    r2 = r2pipe.open(target, flags=["-2"])
    r2.cmd("aaa")
    matches = []
    if scan_sections:
        for sec in (r2.cmdj("iSj") or []):
            addr, size, name = sec.get("vaddr",0), sec.get("vsize",0), sec.get("name","?")
            if size == 0 or size > 50*1024*1024: continue
            data_hex = r2.cmd(f"p8 {size} @ {addr}")
            if not data_hex: continue
            data = bytes.fromhex(data_hex.strip())
            m = rules.match(data=data)
            if m:
                print(f"[+] Section {name} (0x{addr:x}, {size} bytes):")
                for match in m:
                    print(f"    Rule: {match.rule}")
                    for s in match.strings:
                        for inst in s.instances:
                            print(f"      0x{addr + inst.offset:x} {s.identifier}")
                matches.extend(m)
    else:
        filepath = r2.cmdj("ij").get("core",{}).get("file", target)
        if os.path.isfile(filepath):
            m = rules.match(filepath)
            for match in m:
                print(f"[+] Rule: {match.rule}")
                for s in match.strings:
                    for inst in s.instances:
                        print(f"    0x{inst.offset:x} {s.identifier}: {inst.matched_data[:32]}")
                matches.append(match)
    r2.quit()
    print(f"\nTotal: {len(matches)} rules matched")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python r2_yara_scan.py target.bin rules.yar [--sections]")
        sys.exit(1)
    yara_scan(sys.argv[1], sys.argv[2], "--sections" in sys.argv)
