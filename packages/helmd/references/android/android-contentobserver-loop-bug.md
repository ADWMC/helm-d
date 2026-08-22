# Android ContentObserver 循环触发 Bug 检测

## 概述

Android 应用中 ContentObserver 注册后未正确管理 `ignoreChanges` 标志，导致写入操作触发 onChange 回调，形成读取-写入-触发的无限循环。

## 典型症状

- 用户反馈"应用一直读取联系人"
- 系统权限日志显示短时间内大量 READ_CONTACTS 调用（如每秒70+次）
- 电池消耗异常高

## Forkgram 实际案例分析

### 问题代码

```java
// ContentObserver 注册（只有 register，没有 unregister）
registerContentObserver(ContactsContract.Contacts.CONTENT_URI, true, new MyContentObserver());

// onChange 回调
public void onChange(boolean selfChange) {
    synchronized (observerLock) {
        if (ignoreChanges) return;  // 检查标志
    }
    Utilities.globalQueue.postRunnable(checkRunnable, 500);  // 500ms 延迟
}

// 写入联系人方法 - 关键：没有设置 ignoreChanges!
private void performWriteContactsToPhoneBookInternal(...) {
    // 缺少: synchronized (observerLock) { ignoreChanges = true; }
    contentResolver.applyBatch(ContactsContract.AUTHORITY, query);
    // 缺少: synchronized (observerLock) { ignoreChanges = false; }
}
```

### 循环链

```
ContentObserver.onChange() 触发
    ↓ 500ms 延迟
checkContacts() 被调用
    ↓
checkContactsInternal() 查询 RawContacts.VERSION
    ↓ 版本变化
performSyncPhoneBook() 被调用
    ↓
readContactsFromPhoneBook() 读取所有联系人 ← READ_CONTACTS
    ↓
performWriteContactsToPhoneBook() 写入联系人到手机
    ↓
performWriteContactsToPhoneBookInternal() 写入联系人
    ↓ 没有设置 ignoreChanges = true!
ContentObserver.onChange() 再次触发 ← 循环!
```

### 正确实现对比

```java
// addContactToPhoneBook 正确设置了 ignoreChanges
public long addContactToPhoneBook(...) {
    synchronized (observerLock) {
        ignoreChanges = true;  // ← 正确设置
    }
    // ... 写入操作 ...
    synchronized (observerLock) {
        ignoreChanges = false;  // ← 正确恢复
    }
}
```

## 检测方法

### 1. 搜索 ContentObserver 注册/注销

```bash
# 搜索源码
grep -n "registerContentObserver\|unregisterContentObserver" ContactsController.java
```

如果只有 `register` 没有 `unregister`，观察者永不注销。

### 2. 检查 onChange 中的 ignoreChanges 保护

```bash
grep -A 10 "public void onChange" ContactsController.java
```

确认有 `if (ignoreChanges) return;` 检查。

### 3. 检查写入方法是否设置 ignoreChanges

```bash
# 搜索所有写入联系人的方法
grep -n "applyBatch\|contentResolver.insert\|contentResolver.update\|contentResolver.delete" ContactsController.java
```

对每个写入方法，检查前后是否有 `ignoreChanges = true/false` 设置。

### 4. 动态验证

使用 Frida hook `ContentResolver.applyBatch` 监控调用频率：

```javascript
Java.perform(function() {
    var ContentResolver = Java.use("android.content.ContentResolver");
    var count = 0;
    var lastTime = Date.now();

    ContentResolver.applyBatch.overload('java.lang.String', 'java.util.ArrayList').implementation = function(authority, operations) {
        count++;
        var now = Date.now();
        if (now - lastTime > 1000) {
            console.log("[applyBatch] " + count + " calls/sec");
            count = 0;
            lastTime = now;
        }
        return this.applyBatch(authority, operations);
    };
});
```

## 修复建议

在所有写入联系人的方法中添加 `ignoreChanges` 保护：

```java
private void performWriteContactsToPhoneBookInternal(...) {
    synchronized (observerLock) {
        ignoreChanges = true;
    }
    try {
        // ... 写入操作 ...
    } finally {
        synchronized (observerLock) {
            ignoreChanges = false;
        }
    }
}
```

## 参考

- Forkgram 源码: https://github.com/Forkgram/TelegramAndroid
- 相关文件: `ContactsController.java`
