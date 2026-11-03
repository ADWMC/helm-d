#!/usr/bin/env python3
"""XOR Bruteforce - Bruteforce single-byte or multi-byte XOR key.

Usage:
    python xor_bruteforce.py file_or_hex [-k keylen] [-n top_n]
"""
import sys, itertools

# Scoring: chi-squared against English letter frequencies. Hand-rolled
# printable/run weights all lose to padding artifacts (a 0x90-filled buffer
# XORs into 'P'*32 under the right key — same letter count as real text);
# chi-squared nukes single-byte-repeat junk because every other class shows
# (0-expected)²/E. Non-class bytes add a flat penalty so binary junk loses.
_FREQ = {
    ' ': 0.180, 'e': 0.100, 't': 0.075, 'a': 0.068, 'o': 0.064, 'i': 0.058,
    'n': 0.056, 's': 0.052, 'h': 0.050, 'r': 0.048, 'd': 0.036, 'l': 0.034,
    'u': 0.024, 'c': 0.023, 'm': 0.021, 'f': 0.020, 'w': 0.019, 'g': 0.017,
    'y': 0.016, 'p': 0.015, 'b': 0.013, 'v': 0.009, 'k': 0.008, 'x': 0.0015,
    'j': 0.0010, 'q': 0.0009, 'z': 0.0006,
}

def _chi2(dec):
    if not dec:
        return float('inf')
    observed = {c: 0 for c in _FREQ}
    junk = 0
    for b in dec:
        ch = chr(b)
        c = ch.lower() if 'a' <= ch.lower() <= 'z' else (' ' if ch == ' ' else None)
        if c is None:
            junk += 1
        else:
            observed[c] += 1
    n = len(dec)
    chi2 = 0.0
    for c, p in _FREQ.items():
        expected = p * n
        if expected > 0:
            diff = observed[c] - expected
            chi2 += diff * diff / expected
    return chi2 + junk * 1.5

def _printable_runs(dec, min_len=8):
    runs = []
    cur = bytearray()
    for b in bytes(dec) + b"\x00":
        if 32 <= b < 127:
            cur.append(b)
        else:
            if len(cur) >= min_len:
                runs.append(bytes(cur))
            cur = bytearray()
    return runs

def _rank_score(dec):
    """Lower is better: best per-byte chi2 over the whole buffer and over every
    printable run. A short embedded flag rides its clean window; padding noise
    has no clean window and its whole-buffer stats are drowned by repeats."""
    best = _chi2(dec) / len(dec)
    runs = _printable_runs(dec)
    for run in runs:
        best = min(best, _chi2(run) / len(run))
    return best

def _run_quality(dec):
    """Best printable run quality: length (capped 40) × character diversity ×
    letter density. Padding artifacts XOR into same-byte or punctuation runs
    (score ~0); real plaintext — words, keys, even CTF flags — is letter-dense.
    The final 0.3 floor keeps high-diversity non-letter runs (hex blobs) in the
    race without letting them beat words."""
    best = 0.0
    cur = bytearray()
    seen = set()
    letters = 0
    import re
    word_re = re.compile(r"flag\{|ctf\{|key\{|password|secret|token|admin|hello|\b(?:the|and|is|of|to|in|for|xor|weak|test|user)\b", re.I)
    for b in bytes(dec) + b"\x00":
        if 32 <= b < 127:
            cur.append(b)
            seen.add(b)
            if chr(b).isalpha():
                letters += 1
        else:
            if len(cur) >= 8:
                density = 0.3 + 0.7 * (letters / len(cur))
                q = (min(len(cur), 40) / 40) * (len(seen) / len(cur)) * density
                text = cur.decode("ascii", errors="replace")
                hits = word_re.findall(text)
                q += min(0.15 * len(hits) + (0.4 if re.search(r"flag\{|ctf\{|key\{", text, re.I) else 0.0), 0.6)
                if q > best:
                    best = q
            cur = bytearray()
            seen = set()
            letters = 0
    return best

def _rank_score(dec):
    """Higher is better: run quality dominates, whole-buffer chi2 penalizes
    candidates whose plaintext is statistically junk (repeats, control junk)."""
    return _run_quality(dec) - 0.05 * (_chi2(dec) / len(dec))

def xor_bruteforce_single(data, top_n=10):
    results = []
    for key in range(256):
        dec = bytes([b ^ key for b in data])
        runs = _printable_runs(dec)
        max_run = max((len(r) for r in runs), default=0)
        results.append((key, _rank_score(dec), max_run, dec))
    results.sort(key=lambda x: x[1], reverse=True)
    return results[:top_n]

def xor_bruteforce_multi(data, keylen, top_n=10):
    # keylen=1 IS the single-byte case: route through the ranked scorer
    # (run quality + word bonus), not the per-position chi2 mush.
    if keylen == 1:
        ranked = xor_bruteforce_single(data, 1)
        key = bytes([ranked[0][0]])
        dec = bytes([b ^ key[0] for b in data])
        return key, dec
    best_key = bytearray(keylen)
    for pos in range(keylen):
        chunk = data[pos::keylen]
        best_score, best_byte = float('inf'), 0
        for key in range(256):
            dec = bytes([b ^ key for b in chunk])
            score = _chi2(dec) / len(chunk)
            if score < best_score:
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
        for key, score, max_run, dec in xor_bruteforce_single(data, top_n):
            preview = dec[:60].decode("ascii", errors="replace")
            print(f"Key 0x{key:02x} ({chr(key) if 32 <= key < 127 else '?'}): score {score:.2f} (run {max_run}) | {preview}")

if __name__ == "__main__":
    main()
