# Custom XOR Cipher Reversal

## Pattern: Repeating XOR with Per-Byte Key Transformation

Some protectors use a repeating XOR key where the key state mutates after each byte.

### Algorithm (observed in GH_Loader / NetEase aimbot injector)

```
Initial key: 24 bytes loaded from .rdata + constant
Transform per byte:  key[i] = (0x25 - key[i] * 0x53) & 0xFF   for ALL 24 bytes
XOR:                  data[j] ^= key[j % 24]
```

Key insight: the transform is applied to ALL 24 key bytes before each XOR, making the key stateful and position-dependent.

### Reversal Steps

1. Find the key material in .rdata (usually near string constants)
2. Identify the transform constants (look for `imul` + `sub` patterns near the XOR loop)
3. Check for AVX/SSE path (may use `vpmullw` + `psubb` for parallel transform)
4. Both scalar and SIMD paths produce the same result — verify by comparing outputs

### Identification Heuristics

- Loop structure: outer loop over data bytes, inner loop over key length (typically 16/24/32)
- Transform constants often small primes (0x53=83, 0x25=37)
- AVX path loads constants from memory: multiplier bytes (all same value) and base bytes (all same value)
- Key length determined by `cmp r8d, 0x18` (24) or similar

### Code Pattern (x86-64)

```asm
; Inner transform loop
0x140006240:  movsxd rax, r8d          ; key index
0x140006243:  lea rdx, [key_buf]
0x140006248:  add rdx, rax
0x14000624b:  movzx eax, byte [rdx]
0x14000624e:  imul ecx, eax, 0x53      ; multiply by constant
0x140006251:  mov eax, 0x25             ; base value
0x140006256:  sub al, cl                ; subtract
0x140006258:  mov byte [rdx], al        ; store back
0x14000625a:  inc r8d
0x14000625d:  cmp r8d, 0x18            ; key length
0x140006261:  jl 0x140006240

; XOR with cycling key
0x140006263:  movzx eax, byte [rsp + r9 + key_offset]
0x140006269:  xor byte [r10 + rdata], al
0x14000626d:  inc r9
; r9 mod key_len via: r9 * 0xAAAAAAAAAAAAAAAB >> 61
```

### Python Implementation

```python
def decrypt_xor_transform(encrypted, key_init):
    key = bytearray(key_init)
    decrypted = bytearray(len(encrypted))
    for i in range(len(encrypted)):
        for j in range(len(key)):
            key[j] = (0x25 - key[j] * 0x53) & 0xFF
        decrypted[i] = encrypted[i] ^ key[i % len(key)]
    return bytes(decrypted)
```
