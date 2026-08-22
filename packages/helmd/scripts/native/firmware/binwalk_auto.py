#!/usr/bin/env python3
"""Binwalk Auto - Wrapper for recursive firmware extraction.

Usage:
    python binwalk_auto.py firmware.bin [output_dir]
"""
import sys, os, subprocess

INTERESTING = (".conf", ".cfg", ".ini", ".key", ".pem", ".crt", ".p12",
               ".sh", ".lua", ".py", ".html", ".js", ".php",
               "passwd", "shadow", "hosts", "authorized_keys")

def run_binwalk(filepath, out_dir=None):
    if out_dir is None:
        out_dir = filepath + "_extracted"
    os.makedirs(out_dir, exist_ok=True)
    print(f"[*] Extracting {filepath} -> {out_dir}")
    r = subprocess.run(["binwalk", "-eM", "-C", out_dir, filepath],
                       capture_output=True, text=True, timeout=300)
    if r.returncode != 0 and r.stderr:
        print(f"[!] binwalk stderr: {r.stderr[:200]}")
    return out_dir

def find_interesting(root_dir):
    results = []
    for dirpath, dirs, files in os.walk(root_dir):
        for f in files:
            fpath = os.path.join(dirpath, f)
            for pattern in INTERESTING:
                if pattern in f.lower():
                    results.append(fpath)
                    break
    return results

def main():
    if len(sys.argv) < 2:
        print("Usage: python binwalk_auto.py firmware.bin [output_dir]")
        sys.exit(1)
    filepath = sys.argv[1]
    out_dir = sys.argv[2] if len(sys.argv) > 2 else None
    extracted = run_binwalk(filepath, out_dir)
    interesting = find_interesting(extracted)
    print(f"\n[*] Interesting files ({len(interesting)}):")
    for f in interesting[:100]:
        print(f"  {f}")
    print(f"\n[*] Extracted to: {extracted}")

if __name__ == "__main__":
    main()
