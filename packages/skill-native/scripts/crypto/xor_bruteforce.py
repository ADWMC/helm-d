#!/usr/bin/env python3
"""XOR Bruteforce - Bruteforce single-byte or multi-byte XOR key.

Usage:
    python xor_bruteforce.py file_or_hex [-k keylen] [-n top_n]
"""
import sys, itertools

def xor_bruteforce_single(data, top_n=10):
    results = []
    for key in range(256):
        dec = bytes([b ^ key for b in data])
        printable = sum(1 for b in dec if 32 <= b < 127 or b in (9,10,13))
        ratio = printable / len(dec)
        results.append((key, ratio, dec))
    results.sort(key=lambda x: x[1], reverse=True)
    return results[:top_n]

def xor_bruteforce_multi(data, keylen, top_n=10):
    best_key = bytearray(keylen)
    for pos in range(keylen):
        chunk = data[pos::keylen]
        best_score, best_byte = 0, 0
        for key in range(256):
            dec = bytes([b ^ key for b in chunk])
            score = sum(1 for b in dec if 32 <= b < 127 or b in (9,10,13)) / len(dec)
            if score > best_score:
                best_score, best_byte = score, key
        best_key[pos] = best_byte
    key = bytes(best_key)
    dec = bytes([b ^ key[i % keylen] for i, b in enumerate(data)])
    return key, dec

def main():
    if len(sys.argv) < 2:
        print("Usage: python xor_bruteforce.py file_or_hex [-k keylen] [-n top_n]")
        sys.exit(1)
    inp = sys.argv[1]
    keylen = None; top_n = 10
    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == "-k": keylen = int(sys.argv[i+1]); i += 2
        elif sys.argv[i] == "-n": top_n = int(sys.argv[i+1]); i += 2
        else: i += 1

    try: data = bytes.fromhex(inp)
    except: data = open(inp, "rb").read()

    if keylen:
        key, dec = xor_bruteforce_multi(data, keylen, top_n)
        print(f"Best key ({keylen} bytes): {key.hex()}")
        print(f"Decrypted: {dec[:200]}")
    else:
        print("Single-byte XOR bruteforce:")
        print("-" * 60)
        for key, ratio, dec in xor_bruteforce_single(data, top_n):
            preview = dec[:60].decode("ascii", errors="replace")
            print(f"Key 0x{key:02x} ({chr(key) if 32 <= key < 127 else '?'}): {ratio:.2%} printable | {preview}")

if __name__ == "__main__":
    main()
