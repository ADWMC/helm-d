#!/usr/bin/env python3
"""Memory Scanner - Scan memory dump for value (int/float/string/pattern).

Usage:
    python memory_scanner.py dump.bin value [--type int32|int64|float|string|hex]
"""
import sys, struct

def scan_memory(filepath, value, vtype="int32"):
    data = open(filepath, "rb").read()
    results = []
    if vtype == "int32":
        try: target = struct.pack("<I", int(value))
        except: target = struct.pack("<i", int(value))
        for i in range(len(data) - 3):
            if data[i:i+4] == target: results.append(i)
    elif vtype == "int64":
        try: target = struct.pack("<Q", int(value))
        except: target = struct.pack("<q", int(value))
        for i in range(len(data) - 7):
            if data[i:i+8] == target: results.append(i)
    elif vtype == "float":
        target = struct.pack("<f", float(value))
        for i in range(len(data) - 3):
            if data[i:i+4] == target: results.append(i)
    elif vtype == "string":
        target = value.encode()
        idx = 0
        while True:
            idx = data.find(target, idx)
            if idx == -1: break
            results.append(idx)
            idx += 1
    elif vtype == "hex":
        target = bytes.fromhex(value)
        idx = 0
        while True:
            idx = data.find(target, idx)
            if idx == -1: break
            results.append(idx)
            idx += 1
    return results

def main():
    if len(sys.argv) < 3:
        print("Usage: python memory_scanner.py dump.bin value [--type int32|int64|float|string|hex]")
        sys.exit(1)
    filepath, value = sys.argv[1], sys.argv[2]
    vtype = "int32"
    if "--type" in sys.argv:
        vtype = sys.argv[sys.argv.index("--type") + 1]
    results = scan_memory(filepath, value, vtype)
    print(f"Found {len(results)} matches for {value} ({vtype}):")
    for addr in results[:100]:
        print(f"  0x{addr:08x}")

if __name__ == "__main__":
    main()
