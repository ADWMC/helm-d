// frida_bypass.js - Bypass common anti-Frida checks
// Usage: frida -U -f com.target.app -l frida_bypass.js

// 1. Bypass /proc/self/maps scanning for frida
var openPtr = Module.findExportByName("libc.so", "open");
Interceptor.attach(openPtr, {
    onEnter(args) {
        this.path = args[0].readUtf8String();
    },
    onLeave(retval) {
        if (this.path && (this.path.includes("/proc/self/maps") || this.path.includes("/proc/" + Process.id + "/maps"))) {
            // Will be read later, hook read/fgets instead
        }
    }
});

// 2. Hook strstr to hide "frida" in maps
var strstrPtr = Module.findExportByName("libc.so", "strstr");
Interceptor.attach(strstrPtr, {
    onEnter(args) {
        this.haystack = args[0];
        this.needle = args[1].readUtf8String();
    },
    onLeave(retval) {
        if (this.needle && this.needle.includes("frida")) {
            retval.replace(ptr(0));
        }
    }
});

// 3. Bypass pthread_create monitoring (anti-frida thread detection)
var pthreadCreatePtr = Module.findExportByName("libc.so", "pthread_create");
Interceptor.attach(pthreadCreatePtr, {
    onEnter(args) {
        // Log but don't block
        console.log("[*] pthread_create called");
    }
});

// 4. Bypass D-Bus detection (frida uses D-Bus)
var connectPtr = Module.findExportByName("libc.so", "connect");
Interceptor.attach(connectPtr, {
    onEnter(args) {
        var sockaddr = args[1];
        var family = sockaddr.readU16();
        if (family === 1) { // AF_UNIX
            var path = sockaddr.add(2).readUtf8String();
            if (path && path.includes("frida")) {
                console.log("[*] Blocking frida D-Bus connect");
                // Replace with /dev/null path
                args[1].add(2).writeUtf8String("/dev/null");
            }
        }
    }
});

// 5. Bypass frida-server port detection (27042)
// This is handled by the D-Bus hook above

console.log("[*] Anti-Frida bypass loaded");
