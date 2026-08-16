# JS 分析提取模式速查

## 一键批量提取脚本

```bash
#!/bin/bash
# 用法: bash js_extract.sh https://target.com
TARGET="$1"
OUT="/tmp/js_api_extract_$(date +%s)"
mkdir -p "$OUT"

echo "[*] Step 1: 收集 JS 文件..."
# 从主页收集 JS URL
curl -sL "$TARGET" | grep -oP '(?:src|href)\s*=\s*["'"'"']([^"'"'"']*\.js(?:\?[^"'"'"']*)?)["'"'"']' | \
  sed "s|^/|$TARGET/|;s|^\([^h]\)|$TARGET/\1|" | sort -u > "$OUT/js_urls.txt"

echo "[*] 发现 $(wc -l < "$OUT/js_urls.txt") 个 JS 文件"

echo "[*] Step 2: 下载并提取 API 路径..."
while read url; do
  curl -sL "$url" --connect-timeout 10 -m 30
done < "$OUT/js_urls.txt" > "$OUT/all_js.txt"

# API 路径
grep -oP '["'"'"'](/(?:api|v[0-9]|rest|service|auth|admin|user|internal|manage|upload|graphql)[^\s"'"'"'<>]{1,200})["'"'"']' "$OUT/all_js.txt" | \
  tr -d '"'"'"'"'"'" | sort -u > "$OUT/api_paths.txt"

# 完整 URL
grep -oP 'https?://[^\s"'"'"'<>\\]{5,200}' "$OUT/all_js.txt" | sort -u > "$OUT/full_urls.txt"

# 敏感信息
grep -oiP '(?:api[_-]?key|secret[_-]?key|token|password|access[_-]?key)\s*[=:]\s*["'"'"']([^"'"'"']{6,100})["'"'"']' "$OUT/all_js.txt" > "$OUT/secrets.txt"

echo "[*] 结果:"
echo "  API 路径: $(wc -l < "$OUT/api_paths.txt") 条"
echo "  完整 URL: $(wc -l < "$OUT/full_urls.txt") 条"
echo "  疑似密钥: $(wc -l < "$OUT/secrets.txt") 条"
echo "[*] 输出目录: $OUT"

cat "$OUT/api_paths.txt"
```

## 常见前端框架路由模式

### Vue.js (Vue Router)
```javascript
// 路由定义中的 API 调用
{path: '/admin/users', component: () => import('./views/AdminUsers.vue')}
// axios 调用
axios.get('/api/admin/users')
this.$http.post('/api/auth/login', data)
```
提取 pattern: `(?:axios|this\.\$http|fetch|request)\.[a-z]+\(['"]([^'"]+)['"]\)`

### React (fetch/axios)
```javascript
fetch('/api/users/' + userId)
await axios.post(`/api/v2/orders/${orderId}/refund`)
const API_BASE = process.env.REACT_APP_API_URL || '/api'
```
提取 pattern: `(?:fetch|axios)\s*[\.(]\s*['"\x60]([^'"\x60]+)`

### Angular (HttpClient)
```typescript
this.http.get<User[]>('/api/users')
this.http.post('/api/admin/config', payload)
environment.apiUrl + '/auth/token'
```
提取 pattern: `this\.http\.[a-z]+[<(]\s*['"]([^'"]+)['"]\)`

## 高价值字符串模式

| 类型 | 正则 |
|------|------|
| JWT Secret | `(?:jwt[_-]?secret\|JWT_SECRET)\s*[=:]\s*["']([^"']+)` |
| DB 连接串 | `(?:mongodb\|mysql\|postgres)://[^\s"']+` |
| AWS Key | `AKIA[0-9A-Z]{16}` |
| 私有 IP | `(?:10\|172\.(?:1[6-9]\|2\d\|3[01])\|192\.168)\.\d+\.\d+` |
| 邮件地址 | `[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}` |
| 内部域名 | `https?://[a-z0-9.-]+\.(?:internal\|local\|corp\|intranet)` |
