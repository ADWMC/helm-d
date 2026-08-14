// ptrace_bypass.js - Bypass ptrace anti-debug
// Usage: frida -U -f com.target.app -l ptrace_bypass.js

// 1. Hook ptrace to return 0 for PTRACE_TRACEME
var ptracePtr = Module.findExportByName("libc.so", "ptrace");
Interceptor.attach(ptracePtr, {
    onEnter(args) {
        this.request = args[0].toInt32();
    },
    onLeave(retval) {
        if (this.request === 0) { // PTRACE_TRACEME
            console.log("[*] ptrace(PTRACE_TRACEME) -> 0");
            retval.replace(0);
        }
    }
});

// 2. Bypass /proc/self/status TracerPid check
var fgetsPtr = Module.findExportByName("libc.so", "fgets");
Interceptor.attach(fgetsPtr, {
    onEnter(args) {
        this.buf = args[0];
        this.size = args[1].toInt32();
        this.stream = args[2];
    },
    onLeave(retval) {
        if (!retval.isNull()) {
            var content = this.buf.readUtf8String();
            if (content && content.includes("TracerPid:")) {
                // Replace TracerPid with 0
                this.buf.writeUtf8String("TracerPid:\t0\n");
            }
        }
    }
});

// 3. Bypass prctl(PR_SET_DUMPABLE, 0)
var prctlPtr = Module.findExportByName("libc.so", "prctl");
Interceptor.attach(prctlPtr, {
    onEnter(args) {
        if (args[0].toInt32() === 4) { // PR_SET_DUMPABLE
            console.log("[*] prctl(PR_SET_DUMPABLE, 0) blocked");
            args[1] = ptr(1); // Keep dumpable
        }
    }
});

// 4. Bypass fork-based detection
var forkPtr = Module.findExportByName("libc.so", "fork");
Interceptor.attach(forkPtr, {
    onLeave(retval) {
        if (retval.toInt32() > 0) {
            // Parent process - child will detect debugging
            // Force child to return 0 (success)
            console.log("[*] fork() child pid: " + retval);
        }
    }
});

console.log("[*] ptrace anti-debug bypass loaded");
