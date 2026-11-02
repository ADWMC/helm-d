#!/usr/bin/env python3
"""r2 Function List - Export all functions with metadata.

Usage:
    python r2_func_list.py target.bin [output.csv]

Requires: pip install r2pipe
"""
import r2pipe
import sys
import json
import csv

def list_functions(target, out_file=None):
    r2 = r2pipe.open(target, flags=["-2"])
    r2.cmd("aaa")
    funcs = r2.cmdj("aflj") or []
    rows = []
    for f in funcs:
        rows.append({
            "address": f"0x{f.get('offset',0):x}",
            "name": f.get("name", "unknown"),
            "size": f.get("size", 0),
            "blocks": f.get("nbbs", 0)
        })
    r2.quit()
    if out_file:
        with open(out_file, "w", newline="") as fp:
            w = csv.DictWriter(fp, fieldnames=rows[0].keys())
            w.writeheader()
            w.writerows(rows)
        print(f"Exported {len(rows)} functions to {out_file}")
    else:
        for row in rows[:50]:
            print(f"{row['address']}  {row['name']:40s}  size={row['size']}")
        if len(rows) > 50:
            print(f"... and {len(rows)-50} more")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python r2_func_list.py target.bin [output.csv]")
        sys.exit(1)
    list_functions(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
