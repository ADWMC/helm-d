#!/usr/bin/env python3
"""extract_sites.py -- pull decryptor site constants out of every class in a jar.

Patterns recognized inside method bytecode (offsets ordered):
  BOOT   : ldc2_w A; ldc2_w B; <lookup>; invokestatic <bootClass>.<bootM>(JJ,Object)<ret>
  SELECT : ldc2_w S; ...; invokeinterface/invokevirtual <selName>:(J)J  -> selector S
  XOR    : (after a select, before next call) ldc2_w X ... lxor      -> xor const X
  CIPH_L : ldc2_w C; ...; invokevirtual Cipher.doFinal               -> long cipher C
  CIPH_S : ldc "binary"; ...; getBytes(...)                          -> string cipher

Output sites.json:
  {class: {"methods": [{method, desc, boots:[[A,B]], chain:[{off,sel,xor,ciphL}], ciphS:[str]}]}}
Usage:
  python extract_sites.py <jar> <out.json> [boot_desc] [select_name]
Defaults match the HeyPixelMod reference case:
  boot_desc  = '(JJLjava/lang/Object;)Lcom/heypixel/x;'
  select_name= 'a'
"""
import struct, sys, json, zipfile

def read_u2(d, o): return struct.unpack_from('>H', d, o)[0]
def read_u4(d, o): return struct.unpack_from('>I', d, o)[0]

CP_SIZE = {1:'var',3:5,4:5,5:9,6:9,7:3,8:3,9:5,10:5,11:5,12:5,15:4,16:3,17:5,18:5,19:3,20:3}

def parse_pool(d):
    n = read_u2(d, 8)
    pool = {}
    i, idx = 10, 1
    while idx < n:
        tag = d[i]
        if tag == 1:
            ln = read_u2(d, i+1); pool[idx] = ('Utf8', d[i+3:i+3+ln].decode('utf-8','replace')); i += 3+ln
        elif tag == 3: pool[idx] = ('Int', struct.unpack_from('>i',d,i+1)[0]); i += 5
        elif tag == 4: i += 5
        elif tag == 5: pool[idx] = ('Long', struct.unpack_from('>q',d,i+1)[0]); i += 9; idx += 1
        elif tag == 6: i += 9; idx += 1
        elif tag == 7: pool[idx] = ('Class', read_u2(d,i+1)); i += 3
        elif tag == 8: pool[idx] = ('String', read_u2(d,i+1)); i += 3
        elif tag in (9,10,11): pool[idx] = ('Ref', read_u2(d,i+1), read_u2(d,i+3)); i += 5
        elif tag == 12: pool[idx] = ('NT', read_u2(d,i+1), read_u2(d,i+3)); i += 5
        elif tag == 15: i += 4
        elif tag == 16: i += 3
        elif tag in (17,18): pool[idx] = ('Indy', read_u2(d,i+1), read_u2(d,i+3)); i += 5
        elif tag in (19,20): i += 3
        else: raise ValueError(f'cp tag {tag} @{i}')
        idx += 1
    return pool

def utf8(pool, i):
    e = pool.get(i); return e[1] if e and e[0]=='Utf8' else None

def stringify(pool, i):
    e = pool.get(i)
    if not e: return None
    return utf8(pool, e[1]) if e[0]=='String' else (e[1] if e[0]=='Utf8' else None)

def ref_name(pool, idx):
    e = pool.get(idx)
    if not e or e[0] != 'Ref': return None
    nt = pool.get(e[2])
    if not nt or nt[0] != 'NT': return None
    return utf8(pool, nt[1]), utf8(pool, nt[2])

def members_of(d, i, pool):
    """parse a field or method table; return (entries_with_code, next_offset)
    only methods carry Code, but both share layout."""
    n = read_u2(d, i); i += 2
    out = []
    for _ in range(n):
        nm_e = utf8(pool, read_u2(d,i+2)); nd_e = utf8(pool, read_u2(d,i+4))
        na = read_u2(d, i+6); j = i + 8
        for _a in range(na):
            an = utf8(pool, read_u2(d,j)); alen = read_u4(d,j+2); body = d[j+6:j+6+alen]
            if an == 'Code':
                cl = read_u4(body, 4)
                out.append((nm_e, nd_e, body[8:8+cl]))
            j += 6 + alen
        i = j
    return out, i

def methods_of(d, pool):
    n = read_u2(d, 8); i, idx = 10, 1
    while idx < n:                       # skip constant pool
        tag = d[i]
        if tag == 1: i += 3 + read_u2(d,i+1)
        else:
            i += CP_SIZE[tag]
            if tag in (5,6): idx += 1
        idx += 1
    i += 2                               # access flags
    i += 2                               # this_class
    i += 2                               # super_class
    ni = read_u2(d, i); i += 2 + 2*ni    # interfaces
    _, i = members_of(d, i, pool)        # FIELDS -- must consume before methods!
    methods, _ = members_of(d, i, pool)
    return methods

LDC2W, LDCW, LDC = 0x14, 0x13, 0x12
INVOKESTATIC, INVOKEVIRTUAL, INVOKEINTERFACE = 0xb8, 0xb6, 0xb9
LXOR = 0x83                            # NOT 0x85 (that is lcmp!)

def _u2(code, o):
    if 0 <= o and o + 2 <= len(code): return struct.unpack_from('>H', code, o)[0]
    return -1

def scan_code(code, pool):
    ev = []
    i = 0
    n = len(code)
    while i < n:
        op = code[i]
        if op == LDC2W:
            k = _u2(code,i+1)
            if k < 0: break
            ev.append((i,'l2w', pool.get(k,(None,None))[1])); i += 3
        elif op == LDCW:
            k = _u2(code,i+1)
            if k < 0: break
            ev.append((i,'str',stringify(pool,k))); i += 3
        elif op == LDC:
            ev.append((i,'str',stringify(pool,code[i+1]) if i+1 < n else None)); i += 2
        elif op in (INVOKESTATIC, INVOKEVIRTUAL, INVOKEINTERFACE):
            k = _u2(code,i+1)
            if k < 0: break
            ev.append((i,'call', ref_name(pool,k) or (None,None)))
            i += 5 if op == INVOKEINTERFACE else 3
        elif op == LXOR:
            ev.append((i,'lxor',None)); i += 1
        elif op == 0xc4:                   # wide: only iinc (0x84) differs in size
            wop = code[i+1] if i+1 < n else 0
            i += 6 if wop == 0x84 else 4
        elif op == 0xaa:                   # tableswitch: operands 4-byte aligned from code start
            base = (i + 4) & ~3
            if base + 8 <= n:
                lo, hi = struct.unpack_from('>ii', code, base)
                if 0 <= hi - lo <= 512:
                    i = base + 8 + 4*(hi-lo+1)
                else:
                    i += 1                 # misparse guard: advance instead of looping
            else:
                break                      # switch header would read past end
        elif op == 0xab:                   # lookupswitch: same alignment
            base = (i + 4) & ~3
            if base + 8 <= n:
                npairs = struct.unpack_from('>i', code, base+4)[0]
                if 0 <= npairs <= 4096:
                    i = base + 8 + 8*npairs
                else:
                    i += 1
            else:
                break
        elif op == 0xc5:                   # multianewarray
            i += 4
        else:
            i += 1
    return ev

def correlate(ev, boot_desc, select_name):
    boots, chain, ciphS = [], [], []
    recent_long = []                     # ordered long consts seen so far (capped)
    recent_strs = []                     # ordered strings seen so far
    cur = None                           # open chain entry
    for off, kind, val in ev:
        if kind == 'l2w':
            recent_long.append(val)
            if len(recent_long) > 64: recent_long.pop(0)
        elif kind == 'str':
            if val is not None: recent_strs.append((off,val))
        elif kind == 'lxor':
            if cur is not None and cur['xor'] is None and recent_long:
                cur['xor'] = recent_long[-1]
        elif kind == 'call':
            nm, de = val
            if de == boot_desc:
                if len(recent_long) >= 2: boots.append([recent_long[-2], recent_long[-1]])
                cur = None
            elif nm == select_name and de == '(J)J':
                cur = {'off': off, 'sel': recent_long[-1] if recent_long else None,
                       'xor': None, 'ciphL': None}
                chain.append(cur)
            elif nm == 'doFinal':
                tgt = cur if (cur and cur['ciphL'] is None) else None
                if tgt is not None:
                    tgt['ciphL'] = recent_long[-1] if recent_long else None
                elif chain:
                    chain.append({'off': off, 'sel': None, 'xor': None,
                                  'ciphL': recent_long[-1] if recent_long else None})
                cur = None
            elif nm == 'getBytes':
                if recent_strs: ciphS.append(recent_strs[-1][1])
    # drop entries that carry no data
    chain = [c for c in chain if c['sel'] is not None or c['ciphL'] is not None]
    return boots, chain, ciphS

def main(jar, outp, boot_desc=None, select_name=None):
    boot_desc = boot_desc or '(JJLjava/lang/Object;)Lcom/heypixel/x;'
    select_name = select_name or 'a'
    z = zipfile.ZipFile(jar)
    sites, errors = {}, []
    for n in z.namelist():
        if not n.endswith('.class'): continue
        try:
            d = z.read(n)
            pool = parse_pool(d)
            try:
                members = methods_of(d, pool)
            except Exception as ex:
                errors.append(f'{n}: STRUCT {type(ex).__name__} {ex}')
                continue
            for mname, mdesc, code in members:
                try:
                    if not code: continue
                    ev = scan_code(code, pool)
                    if not any(k=='l2w' for _,k,_ in ev): continue
                    boots, chain, ciphS = correlate(ev, boot_desc, select_name)
                    if boots or chain or ciphS:
                        sites.setdefault(n, []).append(
                            {'method': mname, 'desc': mdesc,
                             'boots': boots, 'chain': chain, 'ciphS': ciphS})
                except Exception as ex:
                    errors.append(f'{n}::{mname}: METHOD {type(ex).__name__} {ex}')
        except Exception as ex:
            errors.append(f'{n}: READ {type(ex).__name__} {ex}')
    with open(outp, 'w', encoding='utf-8') as f:
        json.dump(sites, f, ensure_ascii=False)
    n_chain = sum(len(m['chain']) for v in sites.values() for m in v)
    n_boot = sum(len(m['boots']) for v in sites.values() for m in v)
    n_str = sum(len(m['ciphS']) for v in sites.values() for m in v)
    print(f'[+] classes with sites : {len(sites)}')
    print(f'[+] boot pairs         : {n_boot}')
    print(f'[+] selector chain len : {n_chain}')
    print(f'[+] string ciphers     : {n_str}')
    print(f'[!] errors             : {len(errors)}')
    with open(outp + '.errors.txt','w',encoding='utf-8') as f: f.write('\n'.join(errors))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2],
         sys.argv[3] if len(sys.argv) > 3 else None,
         sys.argv[4] if len(sys.argv) > 4 else None)
