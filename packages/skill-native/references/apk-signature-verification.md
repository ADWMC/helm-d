# APK 签名验证与完整性校验模式

## APK Signing Block (V2/V3) 检测

V2 签名位于 ZIP Central Directory 之前，格式：
```
┌─────────────────────────┐
│ size of block (8 bytes) │
├─────────────────────────┤
│ ID-value pairs          │
│  ├ size (8 bytes)       │
│  ├ ID (4 bytes)         │
│  └ data                 │
├─────────────────────────┤
│ size of block (8 bytes) │ ← 与头部相同
├─────────────────────────┤
│ magic: APK Sig Block    │
│ 42 65 67 69 6e 20 6f 66 │
│ 70 6b 20 53 69 67 ...   │
└─────────────────────────┘
```

V2 ID: `0x7109871a`
V3 ID: `0xf05368c0`

## 腾讯 GCloud SDK ChannelInfoUtil 模式

典型的游戏 SDK APK 渠道签名验证类，位于 `IIPS/Source/app/version_manager/signature/ChannelInfoUtil.cpp`。

### 关键函数

| 函数 | 用途 |
|------|------|
| `isV2Signature(path)` | 打开 APK → fseek 到 EOCD → 找 APK Signing Block offset → 检查是否有 V2 签名 |
| `isV2PlusOrV3Signature(path)` | 区分 V2 普通 vs V2+/V3（检查 signing block 中的 scheme ID） |
| `getV2SignBlockOffset(path)` | 返回 APK Signing Block 的文件偏移 |
| `getChannelInfoOffset(path)` | 读取渠道信息块偏移 |
| `writeChannleInfo(id, path, value)` | 通过 JNI 调用 Java 层写入渠道信息 |
| `reWriteV2ChannelInfo(old, new)` | 保留 V2 签名块，重写渠道信息到新 APK |

### 签名检测逻辑（Ghidra 反编译）

```c
// isV2Signature 核心逻辑
void isV2Signature(char *apkPath) {
    // 打开 APK 文件
    void *handle = open_apk(apkPath);  // FUN_001f4fb0
    if (!handle) return;
    
    // 读取签名块信息
    int result = read_sign_info(handle, &info);  // FUN_001f49d4
    close_apk(handle);
    
    if (result == 0 && info.offset != -1) {
        // 找到 V2/V3 签名块
        log("contains v2 or v3 signature");
        return 1;
    } else {
        // 仅 V1 签名
        log("contains v1 signature");
        return 0;
    }
}

// isV2PlusOrV3Signature 区分逻辑
void isV2PlusOrV3Signature(char *apkPath) {
    // ...
    if ((info.field1 & 0xfff) == 0 && (info.field2 & 0xfff) == 0) {
        // V2+ 或 V3 (对齐检查)
        return 1;
    } else {
        // 普通 V2
        log("contains common v2 signature, not V2+ or V3");
        return 0;
    }
}
```

### JNI 调用模式

`writeChannleInfo` 等函数通过 JNI 调用 Java 层实现：

```c
void writeChannleInfo(int id, char *path, char *value) {
    if (id < 0) return;
    if (!path || !value) return;
    
    JNIEnv *env;
    JavaVM *vm = getJavaVM();  // FUN_0026b83c
    if (!vm) return;
    
    vm->AttachCurrentThread(&env, NULL);
    
    jclass clazz = findClass("ChannelInfoUtil");
    jmethodID mid = env->GetStaticMethodID(clazz, "writeChannleInfo", "(ILjava/lang/String;Ljava/lang/String;)V");
    
    jstring jPath = env->NewStringUTF(path);
    env->CallStaticVoidMethod(clazz, mid, id, jPath, jValue);
    
    env->DeleteLocalRef(jPath);
    vm->DetachCurrentThread();
}
```

## 文件级完整性校验

### CRC32 + MD5 双重校验

腾讯 IFS (Installable File System) 模块使用 CRC32 + MD5 校验下载文件：

```
VERIFY_FILE_SECTOR_CRC_ERROR  ;[code]:%d    ← CRC32 校验失败
VERIFY_FILE_MD5_ERROR ;[code]:%d            ← MD5 校验失败
VERIFY_READ_ERROR ;[code]:%d                ← 读取错误
```

CRC32 通过 `libz.so` 的 `crc32()` 实现，在解压/读取流程中调用。

### 差分更新 MD5

`CheckLocalDiffMD5Flag` - 检查本地差分包的 MD5 标志。

## 搜索模式

在未知二进制中搜索 APK 签名验证相关代码：

```bash
# 字符串搜索
strings target.so | grep -iE 'v2.*sign|v3.*sign|channel.*info|apk.*sign|signing.*block'

# r2 搜索
r2 -q -c 'iz~signature' target.so
r2 -q -c 'iz~channel' target.so

# Python 搜索
python -c "
with open('target.so', 'rb') as f:
    data = f.read()
for kw in [b'isV2signature', b'v2 or v3', b'VERIFY_FILE', b'ChannelInfoUtil']:
    idx = data.find(kw)
    if idx != -1:
        print(f'{idx:#x}: {kw}')
"
```
