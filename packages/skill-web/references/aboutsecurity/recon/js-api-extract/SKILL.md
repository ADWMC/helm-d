---
name: js-api-extract
description: "JavaScript 静态分析提取隐藏 API 端点。当目标是 SPA/前后端分离架构、页面使用 Vue/React/Angular、或常规目录扫描收效甚微时使用。通过分析 JS bundle 提取 API 路径、密钥、内部域名、WebSocket 端点。是 API 渗透的信息收集阶段。发现端点后 → api-fuzz 进行语义化 fuzz"
metadata:
  tags: "js,javascript,api,extract,spa,vue,react,angular,webpack,bundle,endpoint,前端分析"
  category: "recon"
---

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
