# Frontend JS 逆向分析

## 触发条件

- 用户要求分析/解密/反混淆网页中的 JS 文件
- 需要从前端 JS 中提取隐藏的 API 端点、密钥、计算逻辑
- 页面有"实时数据计数器"但想弄清数据来源

## 工作流程

```
1. 下载页面 HTML
   curl -sL "URL" -o page.html

2. 提取所有 JS 引用
   grep -oE 'src="[^"]*\.js[^"]*"' page.html | sort -u

3. 逐个下载 JS（注意 Referer 头）
   curl -sL -H 'Referer: ORIGINAL_URL' "JS_URL" -o script.js

4. 快速分类
   head -30 script.js
   → 已可读？标注注释即可
   → 混淆？继续步骤 5

5. 反混淆（按严重程度递进）
   a) Unicode 转义: \u0041\u0042 → "AB"
   b) XOR 常量: 714286 ^ 714182 = 1000（用 Python 异或计算）
   c) 字符串反转: "zgnep-sai".split("").reverse().join("") = "ias-pengz"
   d) 数组索引引用: _0x1234[5] 需要还原数组定义
   e) 控制流平坦化: 需要专用工具（js-beautify + 自定义脚本）

6. 提取关键逻辑
   - API 端点: grep -iE 'url|fetch|ajax|http|api' script.js
   - 计算公式: 找 setInterval/setTimeout 中的数学运算
   - DOM 操作: getElementById / querySelector 的目标元素

7. 调用发现的 API（带 Referer）
   curl -s -H 'Referer: PAGE_URL' 'API_ENDPOINT'
```

## 常见混淆模式

### 1. Unicode 转义（最常见）

```javascript
// 混淆版
document["\u0061\u0064\u0064\u0045\u0076\u0065\u006E\u0074\u004C\u0069\u0073\u0074\u0065\u006E\u0065\u0072"]
// 还原
document["addEventListener"]

// Python 批量还原:
import re
code = re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), obfuscated)
```

### 2. XOR 常量隐藏数字

```javascript
// 混淆版
const interval = 780371 ^ 780409;  // = 42
const rate = 224.86 / (714286 ^ 714182);  // = 224.86 / 1000 = 0.22486

// 还原: 用 Python 计算
print(780371 ^ 780409)  # 42
print(714286 ^ 714182)  # 1000
```

### 3. 字符串拆分+反转

```javascript
// 混淆版
document.getElementById("zgnep-sai".split("").reverse().join(""))
// 还原
document.getElementById("ias-pengz")
```

### 4. 死代码注入

```javascript
// 混淆版: 大量无用赋值和计算
var _0x1b575e = (697686 ^ 697681) + (631875 ^ 631883);  // = 7 + 8 = 15, 但从未使用
_0xgd9fd = 7228242208;  // 覆盖了上面的值

// 还原: 只保留实际影响 DOM/网络请求的代码
```

### 5. 双脚本架构（真实API + 假动画Fallback）

常见于营销页面的"实时计数器"：

| 脚本 | 职责 | 网络依赖 |
|------|------|---------|
| 主逻辑脚本 | 轮询 API，更新 DOM（翻牌器动画） | 依赖网络 |
| 假动画脚本 | `Date.now()` 线性插值，纯数学计算 | 零网络依赖 |

**判断方法**: 断网后如果数字还在跳 → 是假动画脚本在跑

**关键特征**: 假动画脚本操作的 DOM 元素（如 `#ias-gongli`）与主脚本（如 `#numberContainer1`）不同，两层叠放。

## API 黑盒测试（前端逆向的延伸）

从前端 JS 中提取 API 端点后，进一步测试 API 安全性：

### Referer 校验绕过模式

```bash
# 1. 正常 Referer（确认 API 可用）
curl -s -H 'Referer: https://auto.huawei.com/cn/' 'API_URL'

# 2. 测试根路径（可能被拒）
curl -s -H 'Referer: https://auto.huawei.com/' 'API_URL'  # 通常返回空

# 3. 测试 IP 地址绕过（常见漏洞）
curl -s -H 'Referer: http://127.0.0.1/' 'API_URL'  # 华为案例中有效！

# 4. 测试子域名
curl -s -H 'Referer: https://sub.auto.huawei.com/' 'API_URL'

# 5. 无 Referer（确认校验存在）
curl -s 'API_URL'  # 应返回 406
```

**Referer 校验绕过清单**（按成功率排序）：
1. IP 地址: `http://127.0.0.1/` — 最常见绕过方式
2. 子域名: `https://sub.target.com/` — 通常通过
3. 路径变体: `https://target.com/any/path/` — 只要域名匹配
4. http 降级: `http://target.com/` — 部分站点不区分协议

### 端点枚举

```bash
# 从前端 JS 提取 API 路径前缀后，枚举可能的端点
for ep in queryInit query health status config info version mileage pilot avoid history; do
  echo -n "/v1/$ep → "
  curl -s -H 'Referer: URL' "BASE_URL/v1/$ep" | head -c 80
  echo
done
```

### 响应头分析（CDN + 基础设施）

```bash
curl -s -D - -o /dev/null -H 'Referer: URL' 'API_URL'
```

关键头：
- `Server:` → Web 服务器类型（openresty/nginx/apache）
- `X-ALB-*` → 负载均衡器
- `via:` / `X-CCDN-*` → CDN 节点链路
- `X-Server-Process-Time:` → 源站处理耗时
- `X-Upstream-Process-Time:` → 上游耗时
- `x-login-url:` → 认证系统信息（信息泄露）

### 增长速率测量

```bash
# 两次采样间隔 10 秒，计算增长速率
python -c "
import json, time, subprocess
def fetch():
    r = subprocess.run(['curl','-s','-H','Referer: URL','API_URL'], capture_output=True, text=True)
    return json.loads(r.stdout), time.time()
d1, t1 = fetch()
time.sleep(10)
d2, t2 = fetch()
dt = t2 - t1
# queryInit: data 为数组 [最新, 次新]; query: data 为对象
for key in d1['data'][0] if isinstance(d1['data'], list) else d1['data']:
    v1 = int(d1['data'][0][key]['value'] if isinstance(d1['data'], list) else d1['data'][key]['value'])
    v2 = int(d2['data'][0][key]['value'] if isinstance(d2['data'], list) else d2['data'][key]['value'])
    rate = (v2 - v1) / dt
    print(f'{key}: +{v2-v1} in {dt:.1f}s = {rate:.1f}/s = {rate*3600:,.0f}/h')
"
```

## 案例: 华为乾崑智驾安全数据页

### 发现的架构

- **API 端点**:
  - `GET /external/uiapi/ads/v1/queryInit` → 返回 `[max, min]` 两个值（首次加载，用于滚动动画起止）
  - `GET /external/uiapi/ads/v1/query` → 返回单个实时值（每3秒轮询）
- **Referer 校验**: API 返回 `406 "请求头参数Referer不能为空"`，必须带 `Referer` 头
- **Referer 绕过**: `http://127.0.0.1/` 可绕过域名白名单（IP 地址不校验域名）
- **假动画脚本**: `safety_kilometer.js`，混淆严重（unicode+XOR+字符串反转），`setInterval(42ms)` 纯 `Date.now()` 插值
- **主逻辑脚本**: `safety_260521.js`，未混淆，jQuery + WebWorker
- **基础设施**: openresty + ALB + 华为云 CDN（华北廊坊联通节点），源站处理 ~50ms

### 反混淆还原的核心公式

```javascript
// safety_kilometer.js 还原后
var BASE = new Date("2026-01-12T16:19:12Z").getTime();
var PILOT_BASE = 7228242208;  // 72.28亿公里
var PILOT_RATE = 224.86 / 1000;  // 0.22486 km/ms = 809496 km/h

setInterval(function () {
    var elapsed = Date.now() - BASE;
    var value = Math.floor(PILOT_BASE + elapsed * PILOT_RATE);
    document.getElementById("ias-gongli").innerHTML = formatNumber(value);
}, 42);
```

### API 响应结构

```json
// queryInit
{"code":"200","data":[
  {"pilot":{"value":"12551616396","lastUpdateDate":"2026-07-06 17:49:43"},
   "mileage":{"value":"36667505360","lastUpdateDate":"2026-07-06 17:49:43"},
   "avoid":{"value":"5859652","lastUpdateDate":"2026-07-06 17:49:43"}},
  {"pilot":{"value":"12551614542","lastUpdateDate":"2026-07-06 17:49:40"},...}
]}

// query
{"code":"200","data":{"pilot":{"value":"12551616396"},...}}
```

## 输出文件规范

用户说"发我"时，将反混淆文件写到桌面，用 Markdown 链接格式：

```
[file.js](<C:/Users/Administrator/Desktop/file.js>)
```

Windows 路径用尖括号包裹避免冒号被 Markdown 误解析。

文件命名：
- `*_decoded.js` — 反混淆还原版
- `*_obfuscated.js` — 原始混淆版（保留对照）
- `*_annotated.js` — 加注释版（可读代码 + 段落标注）
- `*_report.md` — 分析报告

## Pitfalls

| 问题 | 原因 | 解决 |
|------|------|------|
| curl 调 API 返回 406 | 华为/营销页 API 校验 Referer | 加 `-H 'Referer: PAGE_URL'` |
| 断网后数字还在跳 | 假动画脚本用 `Date.now()` 线性插值 | 找到并识别假动画脚本，区分真实 API 数据 |
| JS 文件中文注释乱码 | UTF-8 vs GBK 编码不一致 | 用 Python `open(f, encoding='utf-8', errors='replace')` 读取 |
| 混淆 JS 中大量死代码 | 混淆器注入无用赋值干扰分析 | 只追踪影响 DOM/网络的代码路径，忽略纯计算死代码 |
| `read_file` 输出带行号前缀 | `1\|content` 格式 | 用 `re.match(r'^\d+\|(.*)$', line)` 去除，或直接用 `execute_code` |
| Referer 校验看似有效但 IP 可绕 | 服务端只校验域名白名单，不校验 IP | 优先测试 `http://127.0.0.1/` 作为 Referer |
| API 端点枚举全部 403 | 非 API 路径返回对象存储默认响应 | 只有 JS 中 grep 到的路径才是真实端点 |
| 采样增长速率波动大 | CDN 缓存 TTL=1s + 代理延迟 | 多次采样取平均，注意 via 头中的缓存命中率 |
