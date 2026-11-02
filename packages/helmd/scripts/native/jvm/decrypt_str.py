#!/usr/bin/env python3
"""decrypt_str.py -- attempt direct decryption of ISO-8859-1 string ciphers.

Flow per root class <clinit>: ldc "binary" -> getBytes("ISO-8859-1") -> split
into 8-byte blocks -> DES/CBC/NoPadding zero IV with key = ret ^ xor.

NOTE (boundary): if the target's string family uses indy bootstrap lazy
decryption (3-stage key derivation, state-sensitive), this direct approach
produces garbage -- that is the expected signal to STOP and keep the runtime
decryptor instead. See references/native/jvm-mod-deobf-workflow.md section 5.

Usage:
  python decrypt_str.py <sites.json> <out.txt> <oracle_out.txt>
"""
import json, sys, struct
from Crypto.Cipher import DES

def des_dec(key8, data):
    if len(data) % 8: data = data[:len(data)//8*8]
    return DES.new(key8, DES.MODE_CBC, iv=b"\x00"*8).decrypt(data) if data else b''

def main(sites_p, out_p, oracle_out_p):
    sites = json.load(open(sites_p, encoding='utf-8'))
    # oracle returns keyed by class::method#bi
    rets = {}
    for line in open(oracle_out_p, encoding='utf-8'):
        line = line.strip()
        if not line or 'FAIL' in line: continue
        ident, rest = line.split('|', 1)
        rets[ident] = [int(x) for x in rest.split(',')]
    out, ok = [], 0
    for cls, methods in sites.items():
        if cls == '__errors__': continue
        for m in methods:
            strs = m.get('ciphS') or []
            if not strs: continue
            chain = sorted(m.get('chain', []), key=lambda c: c['off'])
            for bi, boot in enumerate(m.get('boots') or []):
                ident = f"{cls}::{m['method']}#{bi}"
                rr = rets.get(ident)
                if not rr or not chain: continue
                # key material from first selector entry with an xor const
                key = None
                for ch in chain:
                    if ch['sel'] is not None and rr and ch['xor'] is not None:
                        key = ((rr[0]) ^ ch['xor']) & 0xFFFFFFFFFFFFFFFF
                        break
                if key is None: continue
                key8 = key.to_bytes(8, 'big')
                for si, s in enumerate(strs):
                    data = s.encode('iso-8859-1', errors='replace')
                    pt = des_dec(key8, data)
                    # try utf-16le and latin-1 renderings
                    try: u16 = pt.decode('utf-16-le', errors='replace')
                    except Exception: u16 = ''
                    l1 = ''.join(chr(b) if 32 <= b < 127 else '.' for b in pt)
                    out.append(f"{ident} str[{si}] len={len(data)}\n  u16: {u16!r}\n  l1 : {l1}")
                    ok += 1
                    break   # one string per boot is enough for validation
    open(out_p, 'w', encoding='utf-8').write('\n'.join(out))
    print(f'[+] attempted {ok} string ciphers -> {out_p}')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3])
