# APK Fingerprint 参考

本文件是参考，读完自行判断，不强制执行。

## 目的

判断 APK 的 framework / HTTP stack / 混淆强度，决定下一步走 Java 反编译还是换框架专用工具。

## 判断信号

| 信号 | 结论 | 下一步 |
|---|---|---|
| libflutter.so / libapp.so | Flutter | 换 Flutter 工具，不硬跑 jadx |
| libhermes.so + index.android.bundle | React Native | 换 RN 工具 |
| classes.dex + Retrofit/OkHttp 注解 | 业务 Java/Kotlin | jadx 反编译 + API 抽取 |
| 高熵 + 无 strings | 加固/壳 | 先脱壳再分析 |
