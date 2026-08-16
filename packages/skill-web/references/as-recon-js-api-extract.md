# js-api-extract

> 来源: wgpsec/AboutSecurity (recon) | 融合进 skill-web


# JavaScript API 端点提取方法论

前后端分离架构中，JS bundle 是 API 端点的**最大信息源**——比目录扫描高效 10 倍。

## ⛔ 深入参考（必读）

- JS 分析正则库 + 提取脚本 → [references/js-extract-patterns.md](references/js-extract-patterns.md)

---

## Phase 1: JS 文件收集

### 1.1 从页面 HTML 收集
```bash
# 抓取页面中所有 JS 引用
curl -s "$TARGET" | grep -oE '(src|href)="[^"]*\.js[^"]*"' | sed 's/.*="\(.*\)"/\1/'

# 递归抓取（含 iframe/动态加载）
curl -s "$TARGET" | grep -oP '(?:src|href|url)\s*[=:]\s*["\x27]([^"\x27]*\.js[^"\x27]*)["\x27]' | sort -u
```

### 1.2 从 Source Map 恢复
```bash
# 检查 JS 文件末尾的 sourceMappingURL
curl -s "$TARGET/static/js/app.xxx.js" | tail -1
# 如果有 //# sourceMappingURL=app.xxx.js.map
curl -s "$TARGET/static/js/app.xxx.js.map" -o sourcemap.json

# Source Map 暴露完整源码——等于拿到了前端源码
```

### 1.3 从 Webpack 清单收集
```bash
# 常见 chunk 清单文件
/static/js/manifest.json
/asset-manifest.json
/webpack-manifest.json
/build/asset-manifest.json
/static/js/runtime~main.xxx.js  # runtime chunk 包含所有 chunk 映射
```

### 1.4 历史版本
```bash
# Wayback Machine 获取旧版 JS（可能包含已删除但未下线的 API）
curl -s "https://web.archive.org/cdx/search/cdx?url=$DOMAIN/*.js&output=text&fl=original" | sort -u
```

## Phase 2: API 端点提取

### 2.1 路径模式提取
```bash
# 从 JS 内容中提取 API 路径（最核心的一步）
curl -s "$JS_URL" | grep -oP '["'"'"'](/(?:api|v[0-9]|rest|service|graphql|ws|internal|admin|auth|user|public)[^\s"'"'"']*?)["'"'"']' | sort -u

# 拼接路径提取（前端常见写法：baseURL + path）
curl -s "$JS_URL" | grep -oP '(?:baseURL|BASE_URL|API_URL|apiPrefix|apiBase)\s*[=:]\s*["'"'"']([^"'"'"']+)["'"'"']'

# 通用路径提取（含相对路径）
curl -s "$JS_URL" | grep -oP '["'"'"'](/[a-zA-Z][a-zA-Z0-9_/\-]{2,}(?:\?[^"'"'"']*)?)["'"'"']' | sort -u | grep -v '\.\(js\|css\|png\|jpg\|svg\|ico\|woff\|ttf\)'
```

### 2.2 完整 URL 提取
```bash
# 提取完整的 HTTP(S) URL
curl -s "$JS_URL" | grep -oP 'https?://[^\s"'"'"'<>]+' | sort -u

# 提取内部域名/子域名
curl -s "$JS_URL" | grep -oP 'https?://[a-zA-Z0-9._-]+\.DOMAIN\.com[^\s"'"'"']*' | sort -u
```

### 2.3 关键信息提取
```bash
# API Key / Secret / Token
curl -s "$JS_URL" | grep -oiP '(?:api[_-]?key|secret|token|auth|password|credential)\s*[=:]\s*["'"'"']([^"'"'"']{8,})["'"'"']'

# WebSocket 端点
curl -s "$JS_URL" | grep -oP 'wss?://[^\s"'"'"']+' | sort -u

# 内部 IP/域名
curl -s "$JS_URL" | grep -oP '(?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d+\.\d+' | sort -u
```

## Phase 3: 端点分类与优先级

提取完后按安全价值分类：

| 优先级 | 特征 | 说明 |
|--------|------|------|
| 🔴 高 | `/admin/`, `/internal/`, `/debug/`, `/manage/` | 管理功能，可能缺乏认证 |
| 🔴 高 | `/upload`, `/import`, `/export`, `/download` | 文件操作，可能有路径穿越/任意读写 |
| 🔴 高 | `/user/`, `/account/`, `/profile/`, `/order/` | 用户数据操作，IDOR 高发区 |
| 🟡 中 | `/auth/`, `/login/`, `/register/`, `/reset/` | 认证流程，可能有逻辑绕过 |
| 🟡 中 | `/search`, `/query`, `/filter` | 查询接口，SQL 注入高发区 |
| 🟢 低 | `/static/`, `/public/`, `/health`, `/status` | 静态资源/健康检查 |

## Phase 4: 批量验证

```bash
# 对提取的端点逐一验证存活
for path in $(cat extracted_paths.txt); do
    code=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET$path" --connect-timeout 5 -m 10)
    echo "$code $path"
done | grep -v "^404 " | sort
```

**关键看点**：
- `200` → 直接可访问，检查响应内容
- `401/403` → 存在但需认证，尝试绕过
- `405` → 端点存在但方法不对，尝试 POST/PUT/DELETE
- `500` → 后端报错，可能有注入点
- `301/302` → 跟踪重定向目标

## 输出要求

提取结束后输出：
1. **JS 文件清单** — 分析了哪些 JS
2. **发现的 API 端点列表** — 按优先级排序
3. **暴露的敏感信息** — API Key、内部域名、Token
4. **推荐的下一步测试** — 哪些端点应该优先 fuzz


---

## REF: js-extract-patterns

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
