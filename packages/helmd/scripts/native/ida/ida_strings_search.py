# IDAPython - Export strings with XREFs
# Usage: idat -A -S"ida_strings_search.py [filter]" target
import sys, csv, idautils, idc, ida_strlist, ida_funcs

filter_str = sys.argv[1] if len(sys.argv) > 1 else None
out = "C:/tmp/ida_strings.csv"
idaapi.auto_wait()
count = 0
with open(out, "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["address","string","xref_from","function"])
    slist = ida_strlist.string_list_t()
    ida_strlist.setup_string_list(slist)
    for s in slist:
        val = idc.get_strlit_contents(s.ea, s.length, s.strtype)
        if not val: continue
        val_str = val.decode(errors="ignore")
        if filter_str and filter_str.lower() not in val_str.lower(): continue
        for ref in idautils.XrefsTo(s.ea):
            func = ida_funcs.get_func(ref.frm)
            fname = idc.get_func_name(func.start_ea) if func else ""
            w.writerow([f"0x{s.ea:x}", val_str[:80], f"0x{ref.frm:x}", fname])
            count += 1
print(f"Exported {count} string XREFs to {out}")
idc.qexit(0)
