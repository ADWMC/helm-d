#!/usr/bin/env python3
"""decrypt_sites.py -- pair oracle returns with site constants and DES-decrypt.

Per chain entry (offset-ordered): key = ret ^ xor  -> big-endian 8B DES key
cipher = ciphL as big-endian 8B block, DES/CBC/NoPadding zero IV.
Plaintext long: low 32 bits = value, high 32 = checksum/obfuscation header.

Output: data/plain_sites.txt  lines "<class>::<method>  idx=<n>  int=<v>  hex=<..>"
"""
import json, sys, struct
from Crypto.Cipher import DES   # pip install pycryptodome ; fallback below if absent

def des_decrypt_block(key8: bytes, block: bytes) -> bytes:
    try:
        c = DES.new(key8, DES.MODE_CBC, iv=b"\x00"*8)
        return c.decrypt(block)
    except NameError:
        raise SystemExit("pycryptodome required: pip install pycryptodome")

def main(sites_p, oracle_out_p, outp):
    sites = json.load(open(sites_p, encoding='utf-8'))
    rets = {}
    for line in open(oracle_out_p, encoding='utf-8'):
        line = line.strip()
        if not line or 'FAIL' in line: continue
        ident, rest = line.split('|', 1)
        rets[ident] = [int(x) for x in rest.split(',')]

    rows, ok = [], 0
    for cls, methods in sites.items():
        if cls == '__errors__': continue
        for m in methods:
            chain = sorted(m.get('chain', []), key=lambda c: c['off'])
            for bi, boot in enumerate(m.get('boots') or []):
                ident = f"{cls}::{m['method']}#{bi}"
                rr = rets.get(ident)
                if not rr: continue
                si = 0
                idx_in_chain = 0
                for ch in chain:
                    if ch['sel'] is not None:
                        if si >= len(rr): break
                        ret = rr[si]; si += 1
                    else:
                        ret = rr[-1] if rr else None
                    if ret is None or ch['xor'] is None or ch['ciphL'] is None:
                        idx_in_chain += 1
                        continue
                    key = (ret ^ ch['xor']) & 0xFFFFFFFFFFFFFFFF
                    key8 = key.to_bytes(8, 'big')
                    block = (ch['ciphL'] & 0xFFFFFFFFFFFFFFFF).to_bytes(8, 'big')
                    pt = des_decrypt_block(key8, block)
                    val = struct.unpack('>q', pt)[0]
                    lo32 = struct.unpack('>i', pt[4:8])[0]
                    hi32 = struct.unpack('>I', pt[0:4])[0]
                    rows.append(f"{ident}  chain[{idx_in_chain}]  int={lo32}  hi=0x{hi32:08x}  raw={pt.hex()}")
                    ok += 1
                    idx_in_chain += 1
    with open(outp, 'w', encoding='utf-8') as f:
        f.write('\n'.join(rows))
    print(f'[+] decrypted {ok} long-cipher blocks -> {outp}')
    from collections import Counter
    hi = Counter(r.split('hi=')[1].split()[0] for r in rows)
    print('[+] high-32 distribution:', dict(hi.most_common(5)))
    lows = [int(r.split('int=')[1].split()[0]) for r in rows]
    printable = sum(1 for v in lows if 32 <= v < 0x110000 and (v < 0xD800 or v > 0xDFFF))
    print(f'[+] low32 plausible char/int values: {printable}/{len(lows)}')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3])
