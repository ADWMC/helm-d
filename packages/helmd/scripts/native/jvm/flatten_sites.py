#!/usr/bin/env python3
"""flatten_sites.py -- turn sites.json into line-format oracle input.

Line: id|seedA|seedB|sel1,sel2,...
Only entries with a boot pair AND at least one selector are emitted.
"""
import json, sys

def main(inp, outp):
    sites = json.load(open(inp, encoding='utf-8'))
    n = 0
    with open(outp, 'w', encoding='utf-8') as f:
        for cls, methods in sites.items():
            if cls == '__errors__': continue
            for m in methods:
                for bi, boot in enumerate(m.get('boots') or []):
                    if len(boot) != 2: continue
                    # selectors from this method's chain, in offset order
                    sels = [c['sel'] for c in sorted(m.get('chain', []), key=lambda c: c['off'])
                            if c['sel'] is not None]
                    if not sels: continue
                    mid = f"{cls}::{m['method']}#{bi}"
                    f.write(f"{mid}|{boot[0]}|{boot[1]}|{','.join(str(s) for s in sels)}\n")
                    n += 1
    print(f'[+] wrote {n} oracle units -> {outp}')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
