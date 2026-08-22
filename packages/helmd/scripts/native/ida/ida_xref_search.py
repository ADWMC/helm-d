# IDAPython - Find XREFs to a string or address
# Usage: idat -A -S"ida_xref_search.py search_term" target
import sys, idautils, idc, ida_strlist, ida_funcs

search = sys.argv[1] if len(sys.argv) > 1 else "password"
out = "C:/tmp/ida_xrefs.txt"
idaapi.auto_wait()
count = 0
with open(out, "w") as f:
    f.write(f"XREF Search: {search}\n{'='*60}\n")
    slist = ida_strlist.string_list_t()
    ida_strlist.setup_string_list(slist)
    for s in slist:
        val = idc.get_strlit_contents(s.ea, s.length, s.strtype)
        if val and search.encode() in val:
            f.write(f"\nString at 0x{s.ea:x}: {val.decode(errors='ignore')}\n")
            for ref in idautils.XrefsTo(s.ea):
                func = ida_funcs.get_func(ref.frm)
                fname = idc.get_func_name(func.start_ea) if func else "unknown"
                f.write(f"  <- 0x{ref.frm:x} ({fname})\n")
                count += 1
print(f"Found {count} XREFs -> {out}")
idc.qexit(0)
