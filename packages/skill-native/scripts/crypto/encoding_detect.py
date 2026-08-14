#!/usr/bin/env python3
"""Encoding Detection - Detect and decode Base64, Hex, ROT13, XOR.

Usage:
    python encoding_detect.py "encoded_string"
"""
import sys, base64, codecs

def detect_and_decode(data):
    if isinstance(data, bytes): data = data.decode(errors="ignore")
    results = []
    # Base64
    try:
        dec = base64.b64decode(data)
        results.append(("Base64", dec))
    except: pass
    # Base64 URL-safe
    try:
        dec = base64.urlsafe_b64decode(data)
        results.append(("Base64-URL", dec))
    except: pass
    # Hex
    try:
        dec = bytes.fromhex(data.strip())
        if len(dec) > 0: results.append(("Hex", dec))
    except: pass
    # ROT13
    try:
        dec = codecs.decode(data, "rot_13")
        results.append(("ROT13", dec.encode()))
    except: pass
    # URL encoding
    if "%" in data:
        import urllib.parse
        dec = urllib.parse.unquote(data)
        results.append(("URL-encoded", dec.encode()))
    # XOR single-byte (try top 3)
    if len(data) > 10:
        best = []
        for key in range(256):
            dec = bytes([ord(c) ^ key for c in data])
            printable = sum(1 for b in dec if 32 <= b < 127) / len(dec)
            best.append((key, printable, dec))
        best.sort(key=lambda x: x[1], reverse=True)
        for key, ratio, dec in best[:3]:
            if ratio > 0.7:
                results.append((f"XOR(0x{key:02x})", dec))
    return results

def main():
    if len(sys.argv) < 2:
        print("Usage: python encoding_detect.py 'encoded_string'")
        sys.exit(1)
    data = sys.argv[1]
    results = detect_and_decode(data)
    if not results:
        print("No encoding detected")
    for enc_type, dec in results:
        preview = dec[:100].decode(errors="replace")
        print(f"[{enc_type}] {preview}")

if __name__ == "__main__":
    main()
