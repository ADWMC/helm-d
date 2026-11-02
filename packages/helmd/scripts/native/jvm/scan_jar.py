#!/usr/bin/env python3
"""scan_jar.py -- Stage-1 recon for obfuscated Forge mod jars.

Classifies every entry name (emoji / iI-confusable / normal), detects
case-collision pairs (NTFS unpack killer), and greps class constant pools
for crypto/decrypt fingerprints to shortlist string-decryptor candidates.

Usage: python scan_jar.py <jar> [out_dir]
"""
import sys, re, zipfile, json, os
from collections import Counter

CRYPTO_MARKERS = [
    b"javax/crypto/Cipher", b"javax/crypto/spec", b"DESKeySpec",
    b"SecretKeySpec", b"IvParameterSpec", b"javax/crypto/CipherInputStream",
]
NAME_MARKERS = [b"decrypt", b"Decrypt", b"decode", b"decode", b"Base64"]
# heuristic: UTF8 constant that looks like a base64/hex blob
BLOB_RE = re.compile(rb"^[A-Za-z0-9+/=]{24,}$")

def classify(name: str):
    base = name.rsplit("/", 1)[-1]
    stem = base[:-6] if base.endswith(".class") else base
    if any(ord(c) > 0x7F for c in stem):
        return "emoji"
    if stem and re.fullmatch(r"[Iil1O0]+", stem):
        return "confusable"
    return "normal"

def main(jar, out_dir="."):
    os.makedirs(out_dir, exist_ok=True)
    z = zipfile.ZipFile(jar)
    names = z.namelist()
    classes = [n for n in names if n.endswith(".class")]

    kinds = Counter(classify(n) for n in classes)
    # case-collision detection (lowercased full path)
    seen = {}
    collisions = []
    for n in classes:
        k = n.lower()
        if k in seen and seen[k] != n:
            collisions.append((seen[k], n))
        seen.setdefault(k, n)

    crypto_hits, marker_counter = {}, Counter()
    blob_samples = []
    for n in classes:
        data = z.read(n)
        hits = [m.decode() for m in CRYPTO_MARKERS if m in data]
        if hits:
            crypto_hits[n] = hits
            for h in hits:
                marker_counter[h] += 1

    report = {
        "jar": jar,
        "total_entries": len(names),
        "total_classes": len(classes),
        "class_kinds": dict(kinds),
        "case_collisions": collisions,
        "collision_count": len(collisions),
        "crypto_fingerprint_top": marker_counter.most_common(15),
        "crypto_candidate_classes": sorted(crypto_hits),
        "crypto_candidate_count": len(crypto_hits),
    }
    out = os.path.join(out_dir, "scan_report.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    with open(os.path.join(out_dir, "crypto_candidates.txt"), "w", encoding="utf-8") as f:
        for n, hits in sorted(crypto_hits.items()):
            f.write(f"{n}\t{','.join(hits)}\n")
    print(json.dumps({k: v for k, v in report.items() if k != "crypto_candidate_classes"},
                     ensure_ascii=False, indent=2))
    print(f"[+] report -> {out}")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else ".")
