# 游戏安全方法论

> 游戏逆向、反作弊绕过、内存分析系统化流程

## 一、环境准备

### 1.1 工具链
| 工具 | 用途 |
|------|------|
| Cheat Engine | 内存扫描、指针链追踪 |
| x64dbg | 调试、断点、Patch |
| Frida | 动态 Hook、内存读写 |
| IDA/Ghidra | 静态分析 |
| ReClass.NET | 内存结构重建 |

### 1.2 反反调试
```javascript
// Frida 绕过常见反调试
// 1. 绕过 IsDebuggerPresent
Interceptor.attach(Module.findExportByName("kernel32.dll", "IsDebuggerPresent"), {
    onLeave(retval) { retval.replace(0); }
});

// 2. 绕过 NtQueryInformationProcess
Interceptor.attach(Module.findExportByName("ntdll.dll", "NtQueryInformationProcess"), {
    onEnter(args) {
        this.infoClass = args[1].toInt32();
    },
    onLeave(retval) {
        if (this.infoClass === 0) { // ProcessDebugPort
            args[2].writeInt(0);
        }
    }
});

// 3. 绕过 CheckRemoteDebuggerPresent
Interceptor.attach(Module.findExportByName("kernel32.dll", "CheckRemoteDebuggerPresent"), {
    onLeave(retval) {
        Memory.readPointer(args[1]).writeInt(0);
    }
});
```

## 二、内存扫描

### 2.1 值搜索流程
```
1. 已知值搜索: 首次搜索当前值
2. 变化过滤: 值变化时搜 "Changed"
3. 不变过滤: 值不变时搜 "Unchanged"
4. 重复: 直到剩 1-3 个地址
```

### 2.2 Frida 内存扫描
```javascript
// 扫描整数值
Process.enumerateRanges('rw-').forEach(range => {
    try {
        Memory.scan(range.base, range.size, '0A000000', {
            onMatch(address, size) {
                console.log(`Found at ${address} in ${range.base}`);
            },
            onComplete() {}
        });
    } catch(e) {}
});
```

### 2.3 指针链追踪
```python
# 指针链搜索 (CE 风格)
def find_pointer_chain(target_addr, base_regions, max_depth=3, max_offset=0x1000):
    """搜索从基址到目标地址的指针链"""
    results = []
    # ... 递归搜索实现
    return results
```

## 三、常见反作弊检测

| 反作弊 | 检测方式 | 绕过方法 |
|--------|---------|---------|
| EAC | 驱动级检测、内存扫描 | 驱动级绕过 |
| BattlEye | 进程注入、调试器检测 | 内核级隐藏 |
| VAC | 签名检测、内存校验 | 代码混淆 |
| Tencent ACE | 驱动保护、行为检测 | 云端验证绕过 |
| FairFight | 行为分析 | 参数限制 |

## 四、Hook 技术

### 4.1 DLL 注入
```cpp
// 标准 DLL 注入流程
HANDLE hProc = OpenProcess(PROCESS_ALL_ACCESS, FALSE, pid);
LPVOID addr = VirtualAllocEx(hProc, NULL, sizeof(dllPath), MEM_COMMIT, PAGE_READWRITE);
WriteProcessMemory(hProc, addr, dllPath, sizeof(dllPath), NULL);
CreateRemoteThread(hProc, NULL, 0, (LPTHREAD_START_ROUTINE)LoadLibraryA, addr, 0, NULL);
```

### 4.2 IAT Hook
```cpp
// 修改导入地址表
PIMAGE_IMPORT_DESCRIPTOR import = /* ... */;
for (PIMAGE_THUNK_DATA thunk = import->FirstThunk; thunk->u1.Function; thunk++) {
    if (original_func == (FARPROC)thunk->u1.Function) {
        DWORD old;
        VirtualProtect(&thunk->u1.Function, sizeof(FARPROC), PAGE_EXECUTE_READWRITE, &old);
        thunk->u1.Function = (ULONG_PTR)hook_func;
        VirtualProtect(&thunk->u1.Function, sizeof(FARPROC), old, &old);
    }
}
```

## 五、Overlay/ESP

### 5.1 D3D Hook (ESP)
```cpp
// D3D11 Present Hook
typedef HRESULT(__stdcall* PresentFn)(IDXGISwapChain*, UINT, UINT);
PresentFn oPresent;

HRESULT __stdcall hkPresent(IDXGISwapChain* pSwapChain, UINT SyncInterval, UINT Flags) {
    // 获取 back buffer
    ID3D11Texture2D* pBackBuffer;
    pSwapChain->GetBuffer(0, __uuidof(ID3D11Texture2D), (void**)&pBackBuffer);
    
    // 绘制 ESP
    // ...
    
    return oPresent(pSwapChain, SyncInterval, Flags);
}
```
