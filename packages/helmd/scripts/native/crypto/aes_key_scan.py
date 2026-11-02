#!/usr/bin/env python3
"""AES Key Scanner - Scan binary for potential AES key candidates.

Usage:
    python aes_key_scan.py target.bin
"""
import sys, math
from collections import Counter

def entropy(data):
    if not data: return 0
    freq = Counter(data)
    n = len(data)
    return -sum((c/n) * math.log2(c/n) for c in freq.values())

def scan_aes_keys(filepath, min_entropy=7.5):
    data = open(filepath, "rb").read()
    candidates = []
    for keylen in (16, 24, 32):
        for i in range(len(data) - keylen):
            chunk = data[i:i+keylen]
            ent = entropy(chunk)
            if ent >= min_entropy:
                candidates.append((i, keylen, ent, chunk))
    # Deduplicate overlapping
    seen = set()
    results = []
    for offset, keylen, ent, chunk in candidates:
        key = (offset // 8, keylen)
        if key not in seen:
            seen.add(key)
            results.append((offset, keylen, ent, chunk))
    return results

def main():
    if len(sys.argv) < 2:
        print("Usage: python aes_key_scan.py target.bin")
        sys.exit(1)
    results = scan_aes_keys(sys.argv[1])
    if not results:
        print("No high-entropy sequences found")
        return
    print(f"Found {len(results)} AES key candidates:")
    print("-" * 70)
    for offset, keylen, ent, chunk in results[:50]:
        print(f"0x{offset:08x}  AES-{keylen*8}  entropy={ent:.2f}  {chunk.hex()}")

if __name__ == "__main__":
    main()
