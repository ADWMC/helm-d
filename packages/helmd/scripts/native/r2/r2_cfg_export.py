#!/usr/bin/env python3
"""r2 CFG Export - Export control flow graphs as JSON or DOT.

Usage:
    python r2_cfg_export.py target.bin [output_dir] [--dot]

Requires: pip install r2pipe
"""
import r2pipe, sys, os, json

def export_cfg(target, out_dir=None, dot_format=False):
    r2 = r2pipe.open(target, flags=["-2"])
    r2.cmd("aaa")
    if out_dir is None:
        out_dir = os.path.splitext(target)[0] + "_cfg"
    os.makedirs(out_dir, exist_ok=True)
    exported = 0
    for f in (r2.cmdj("aflj") or []):
        name = f.get("name","unknown").replace("sym.","").replace("fcn.","")
        addr = f.get("offset",0)
        safe = name.replace("/","_").replace(":","_")
        r2.cmd(f"s {addr}")
        r2.cmd(f"af @ {addr}")
        if dot_format:
            dot = r2.cmd(f"agfd @ {addr}")
            if dot and "digraph" in dot:
                with open(os.path.join(out_dir, f"{safe}.dot"), "w") as fp: fp.write(dot)
                exported += 1
        else:
            cfg = r2.cmdj(f"agfj @ {addr}")
            if cfg:
                with open(os.path.join(out_dir, f"{safe}.json"), "w") as fp: json.dump(cfg, fp, indent=2)
                exported += 1
    r2.quit()
    print(f"Exported {exported} CFGs to {out_dir}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python r2_cfg_export.py target.bin [output_dir] [--dot]")
        sys.exit(1)
    target = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith("-") else None
    export_cfg(target, out, "--dot" in sys.argv)
