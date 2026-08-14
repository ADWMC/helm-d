# androguard APK 分析 (无 Java 环境 fallback)

当 jadx/apktool 不可用（Java 未安装）时，用 Python androguard 做静态分析。

## 安装

```bash
pip install androguard
```

## APK 元数据提取

```python
from androguard.core.apk import APK

apk = APK("target.apk")
print(f"Package:    {apk.get_package()}")
print(f"App Name:   {apk.get_app_name()}")
print(f"Version:    {apk.get_androidversion_name()}")
print(f"Min SDK:    {apk.get_min_sdk_version()}")
print(f"Target SDK: {apk.get_target_sdk_version()}")
print(f"Main Activity: {apk.get_main_activity()}")

# 签名
for cert in apk.get_certificates():
    print(f"Subject: {cert.subject.human_friendly}")
    print(f"Issuer:  {cert.issuer.human_friendly}")

# 组件
for act in apk.get_activities(): print(f"Activity: {act}")
for svc in apk.get_services(): print(f"Service: {svc}")
for rcv in apk.get_receivers(): print(f"Receiver: {rcv}")
```

## DEX 类/方法枚举

```python
from androguard.core.dex import DEX
from zipfile import ZipFile

with ZipFile("target.apk") as z:
    dex_data = z.read('classes.dex')

dex = DEX(dex_data)
for cls in dex.get_classes():
    name = cls.get_name()
    if 'inject' in name.lower() or 'hook' in name.lower():
        print(f"Class: {name}")
        for method in cls.get_methods():
            print(f"  Method: {method.get_name()}{method.get_descriptor()}")
```

## DEX 字符串提取 (无反编译)

```python
import re
strings = set()
for match in re.finditer(rb'[\x20-\x7e]{6,}', dex_data):
    strings.add(match.group().decode('ascii', errors='ignore'))

# 分类
for s in sorted(strings):
    if 'http' in s.lower():
        print(f"URL: {s}")
    elif re.search(r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', s):
        print(f"IP: {s}")
```

## 局限性

- 无法获取完整 Java 源码（只能枚举类/方法签名）
- 无法分析 smali 级别的控制流
- 混淆后的类名/方法名无法自动还原
- 资源文件（布局、字符串资源）解析能力有限

## 适用场景

- 快速识别包名、权限、组件
- 枚举 native 库列表和大小
- 提取 DEX 中的 URL/IP/加密相关字符串
- 识别可疑类名和方法签名
- 签名证书分析
