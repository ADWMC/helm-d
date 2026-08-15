---
name: pe-loader-dll-injection-analysis
description: PE Loader 与 DLL 注入样本的静态和动态逆向分析入口。
whenToUse: 目标涉及 PE 资源提取、DLL 注入、远程线程或加载器行为时使用。
---

# PE Loader / DLL 注入分析

先完成样本分诊并保留原始文件，再调用 `native_reference` 读取
`pe-loader-dll-injection.md`。该参考文档包含资源提取、解密链定位、注入 API 交叉引用和证据记录模板；结论必须以实际字符串、导入、调用链或运行时证据为依据，并标注置信度。
