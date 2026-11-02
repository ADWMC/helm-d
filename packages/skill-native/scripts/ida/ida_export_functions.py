# IDAPython - Export functions to CSV
# Usage: idat -A -S"ida_export_functions.py output.csv" target
import sys, csv, idautils, idc, ida_funcs

out = sys.argv[1] if len(sys.argv) > 1 else "C:/tmp/ida_functions.csv"
idaapi.auto_wait()
with open(out, "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["address","name","size","calls_to","calls_from"])
    for ea in idautils.Functions():
        name = idc.get_func_name(ea)
        func = ida_funcs.get_func(ea)
        size = func.size() if func else 0
        callees = len([x for x in idautils.CodeRefsFrom(ea, 1)])
        callers = len([x for x in idautils.CodeRefsTo(ea, 1)])
        w.writerow([f"0x{ea:x}", name, size, callees, callers])
print(f"Exported to {out}")
idc.qexit(0)
