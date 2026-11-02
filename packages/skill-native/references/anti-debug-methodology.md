# 反调试绕过方法论

> 检测与绕过常见反调试技术的系统化流程

## 一、Windows 反调试

### 1.1 IsDebuggerPresent
```javascript
// Frida 绕过
Interceptor.attach(Module.findExportByName("kernel32.dll", "IsDebuggerPresent"), {
    onLeave(retval) { retval.replace(0); }
});
```

### 1.2 NtQueryInformationProcess
```javascript
// ProcessDebugPort (0), ProcessDebugObjectHandle (0x1E), ProcessDebugFlags (0x1F)
Interceptor.attach(Module.findExportByName("ntdll.dll", "NtQueryInformationProcess"), {
    onEnter(args) {
        this.infoClass = args[1].toInt32();
        this.debugPort = args[2];
        this.debugFlags = args[3];
    },
    onLeave(retval) {
        if (this.infoClass === 0) { // ProcessDebugPort
            this.debugPort.writeS32(0);
        } else if (this.infoClass === 0x1E) { // ProcessDebugObjectHandle
            retval.replace(-1); // STATUS_PORT_NOT_SET
        } else if (this.infoClass === 0x1F) { // ProcessDebugFlags
            this.debugFlags.writeS32(1);
        }
    }
});
```

### 1.3 CheckRemoteDebuggerPresent
```javascript
Interceptor.attach(Module.findExportByName("kernel32.dll", "CheckRemoteDebuggerPresent"), {
    onEnter(args) { this.debuggerPresent = args[1]; },
    onLeave(retval) { this.debuggerPresent.writeS32(0); }
});
```

### 1.4 NtSetInformationThread (ThreadHideFromDebugger)
```javascript
Interceptor.attach(Module.findExportByName("ntdll.dll", "NtSetInformationThread"), {
    onEnter(args) {
        if (args[1].toInt32() === 0x11) { // ThreadHideFromDebugger
            args[2].writeS32(0);
        }
    }
});
```

### 1.5 OutputDebugString
```javascript
// 检测 OutputDebugString 是否被调用
var OutputDebugStringW = Module.findExportByName("kernel32.dll", "OutputDebugStringW");
Interceptor.attach(OutputDebugStringW, {
    onEnter(args) {
        console.log("OutputDebugStringW: " + args[0].readUtf16String());
    }
});
```

### 1.6 时间检测
```javascript
// QueryPerformanceCounter / GetTickCount / timeGetTime
var qpc = Module.findExportByName("kernel32.dll", "QueryPerformanceCounter");
Interceptor.attach(qpc, {
    onEnter(args) { this.start = args[0]; },
    onLeave(retval) {
        // 返回正常值，不触发时间异常检测
    }
});

// RDSTC (x86)
// 需要内核级 hook 或 hypervisor
```

## 二、Linux 反调试

### 2.1 ptrace 检测
```javascript
// 绕过 ptrace(PTRACE_TRACEME)
Interceptor.attach(Module.findExportByName("libc.so", "ptrace"), {
    onEnter(args) {
        this.request = args[0].toInt32();
    },
    onLeave(retval) {
        if (this.request === 0) { // PTRACE_TRACEME
            retval.replace(0);
        }
    }
});
```

### 2.2 /proc/self/status 检测
```javascript
// Hook open 检查 TracerPid
Interceptor.attach(Module.findExportByName("libc.so", "open"), {
    onEnter(args) {
        this.path = args[0].readUtf8String();
    },
    onLeave(retval) {
        if (this.path && this.path.includes("/proc/")) {
            console.log("open: " + this.path);
        }
    }
});
```

### 2.3 /proc/self/maps 检测
```javascript
// 检查 frida-server 映射
var open = Module.findExportByName("libc.so", "open");
Interceptor.attach(open, {
    onEnter(args) {
        this.path = args[0].readUtf8String();
    },
    onLeave(retval) {
        if (this.path && this.path.includes("/proc/self/maps")) {
            console.log("maps access detected");
        }
    }
});
```

### 2.4 prctl 检测
```javascript
// prctl(PR_SET_DUMPABLE, 0)
Interceptor.attach(Module.findExportByName("libc.so", "prctl"), {
    onEnter(args) {
        if (args[0].toInt32() === 4) { // PR_SET_DUMPABLE
            args[1] = ptr(1); // 强制设置为可 dump
        }
    }
});
```

## 三、Android 反调试

### 3.1 Java 层检测
```javascript
Java.perform(function() {
    // 绕过 Debug.isDebuggerConnected()
    var Debug = Java.use("android.os.Debug");
    Debug.isDebuggerConnected.implementation = function() {
        return false;
    };
    
    // 绕过 Settings.Secure
    var Settings = Java.use("android.provider.Settings$Secure");
    Settings.getInt.overload("android.content.ContentResolver", "java.lang.String", "int").implementation = function(cr, name, def) {
        if (name === "adb_enabled") return 0;
        return this.getInt(cr, name, def);
    };
});
```

### 3.2 Native 层检测
```javascript
// 绕过 fork + ptrace
Interceptor.attach(Module.findExportByName("libc.so", "fork"), {
    onLeave(retval) {
        retval.replace(0); // 子进程返回 0
    }
});
```

### 3.3 Frida 检测绕过
```javascript
// 隐藏 frida-server
// 1. 修改 /proc/self/maps
// 2. 隐藏 frida 端口 (27042)
// 3. 修改 D-Bus 响应
```

## 四、VM / 沙箱检测绕过

### 4.1 CPUID 检测
```javascript
// 检查 hypervisor 标志
// 需要内核级或 hypervisor 级绕过
```

### 4.2 MAC 地址检测
```javascript
// 修改 MAC 地址
// ifconfig eth0 hw ether 00:11:22:33:44:55
```

### 4.3 进程检测
```javascript
// 检查 vmtoolsd, VBoxService 等
// 杀掉或隐藏这些进程
```

## 五、通用绕过策略

| 策略 | 适用场景 |
|------|---------|
| 早注入 (Spawn) | 在检测代码执行前 hook |
| 延迟注入 | 等待检测完成后再 hook |
| 内核级 hook | 绕过用户态检测 |
| Hypervisor | 绕过硬件级检测 |
| 代码 patch | 直接 NOP 检测指令 |
