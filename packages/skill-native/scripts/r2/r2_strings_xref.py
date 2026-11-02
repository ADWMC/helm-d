#!/usr/bin/env python3
"""r2 Strings XREF - Find strings and their cross-references.

Usage:
    python r2_strings_xref.py target.bin [filter] [output.csv]

Requires: pip install r2pipe
"""
import r2pipe, sys, csv

def strings_xref(target, filter_str=None, out_file=None):
    r2 = r2pipe.open(target, flags=["-2"])
    r2.cmd("aaa")
    rows = []
    for s in (r2.cmdj("izj") or []):
        val = s.get("string","")
        if filter_str and filter_str.lower() not in val.lower(): continue
        addr = s.get("vaddr",0)
        for ref in (r2.cmdj(f"axtj @ {addr}") or []):
            rows.append({
                "string_addr": f"0x{addr:x}", "string": val[:80],
                "xref_from": f"0x{ref.get('from',0):x}", "function": ref.get("fcn_name","")
            })
    r2.quit()
    if out_file:
        with open(out_file, "w", newline="") as fp:
            if rows:
                w = csv.DictWriter(fp, fieldnames=rows[0].keys())
                w.writeheader(); w.writerows(rows)
        print(f"Exported {len(rows)} string XREFs to {out_file}")
    else:
        for row in rows[:100]:
            print(f"{row['string_addr']}  {row['xref_from']}  {row['function']:30s}  {row['string'][:50]}")
        if len(rows) > 100: print(f"... and {len(rows)-100} more")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python r2_strings_xref.py target.bin [filter] [output.csv]")
        sys.exit(1)
    target = sys.argv[1]
    f = sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].endswith(".csv") else None
    o = sys.argv[3] if len(sys.argv) > 3 else (sys.argv[2] if len(sys.argv) > 2 and sys.argv[2].endswith(".csv") else None)
    strings_xref(target, f, o)
