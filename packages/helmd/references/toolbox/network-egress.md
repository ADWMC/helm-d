# 出站通道规则 — 代理发现与直连回退

> 需要出站的动作（下载工具、查 CVE/公告/官方文档、访问外部 API）按本规则走：
> **先探当前这台机器有没有可用代理，有就用，没有或连不上就直连。**
> 全文不含固定端口与固定地址，换机器、换代理软件都不需要改。

## 何时读

任何一次外部请求超时 / DNS 解析到不该解析的地址 / connection refused / TLS 握手被中断时。
不要等到用户提示，也不要凭记忆猜端口。

## 决策顺序

| 步 | 动作 | 通过则 |
|---|---|---|
| 0 | 先分目标类别：任务指定的靶机、内网/链路地址、`localhost` → **直连，永不走代理**（见「边界」1）；外部权威源（代码托管 / 包索引 / 漏洞库 / 官方文档）→ 进 1 | 直连，结束 |
| 1 | 直连一次，`--max-time` ≤ 15s | 保持直连，不碰代理 |
| 2 | 直连失败 → 按 A → B → C 收集候选代理，逐个验证，**验证通过才用** | 用该代理重试原请求 |
| 3 | 全部候选失败 → 回退直连 + 换源（镜像站 / 官方 API / 已下载离线包），把该目标记为 deadend | — |
| 4 | 一轮发现总耗时 ≤ 60s（命中即停），超时即按 3 处理 | 不阻塞主任务 |

第 3 步之后不要在同一目标上反复重试；换通道或换源，或明确报告"该外部源不可达 + 已尝试的通道"。

## A. 环境变量（最快，先验证再用）

`HTTP_PROXY` `HTTPS_PROXY` `ALL_PROXY` 及其小写形式。注意三者互不等价：`http_proxy` 只管 http，
`no_proxy` 会静默豁免部分目标。**已设置不等于可用**，一律走「验证」。

另：git 的 `http.proxy` 与 curl 的代理配置互不读取，工具链各走各的通道，别假设设一个就全通。

## B. 系统代理设置

| 平台 | 命令 |
|---|---|
| Windows | `Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' \| Select-Object ProxyEnable,ProxyServer` |
| Windows | `netsh winhttp show proxy` |
| macOS | `scutil --proxy` |
| Linux (GNOME) | `gsettings get org.gnome.system.proxy.mode` / `.host` / `.port` |

`ProxyEnable=1` / `HTTPEnable=1` 时把 `host:port` 拼成 `http://host:port` 加入候选。
系统代理可能是 PAC（`AutoConfigURL`）——PAC 无法直接当 `http://` 用，取回 PAC 文本读里面的规则，或跳过。

## C. 监听端口探测

不猜端口号，列出回环上正在监听的端口逐个试。**过滤器必须含 `::`**——Windows 上的代理软件常只监听 IPv6 任意地址，
只筛 `127.0.0.1` 会把它整个漏掉：

```powershell
# Windows（Get-NetTCPConnection 的 LocalAddress 取值：127.0.0.1 / ::1 / 0.0.0.0 / ::）
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalAddress -in '127.0.0.1','::1','0.0.0.0','::' } |
  Select-Object -ExpandProperty LocalPort -Unique
```

```bash
# macOS
lsof -nP -iTCP -sTCP:LISTEN -a -i 127.0.0.1 -i ::1 | awk 'NR>1{n=$9; sub(/.*:/,"",n); print n}' | sort -un
# Linux
ss -ltnH | awk '{print $4}' | sed 's/.*://' | sort -un
```

候选一律按 `http://127.0.0.1:<port>` 试；只监听 `::` 的端口同样能用 v4 回环连上。

## 验证：什么才算「这是个可用代理」

对候选发一次**控制请求**（一个必然可达、内容无关紧要的外部端点），看有没有拿到 HTTP 状态码：

```bash
curl -s -o /dev/null -w '%{http_code}' --max-time 6 -x http://<host>:<port> https://api.github.com
```

| 返回 | 判定 |
|---|---|
| `200` / `401` / `403` / `301` | 代理可用（状态码来自真实上游，认证类错误同样说明链路通了） |
| `000` / 超时 / 连接被拒 | 不是可用代理，丢弃 |
| 端口开放但 TLS 报错 | 可能是 SOCKS 口，改用 `--socks5-hostname` 再验一次 |

**只有验证通过的候选才允许写进后续命令。** 端口号本身不构成证据。

## 一次成型（Windows，串 A+B+C，输出唯一可用代理或 NONE）

```powershell
function Test-Proxy([string]$u) {
  if (-not $u) { return $false }
  $code = (curl.exe -s -o NUL -w '%{http_code}' --max-time 2 -x $u https://api.github.com 2>$null)
  return $code -match '^(200|301|401|403)$'
}
$cands = [System.Collections.Generic.List[string]]::new()
# A 环境变量
foreach ($n in 'HTTPS_PROXY','https_proxy','ALL_PROXY','all_proxy') {
  if ($v = [Environment]::GetEnvironmentVariable($n)) { $cands.Add($v) }
}
# B 系统代理（IE 设置；ProxyEnable=1 才用）
$ie = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -ErrorAction SilentlyContinue
if ($ie.ProxyEnable -eq 1 -and $ie.ProxyServer) {
  $ie.ProxyServer -split ';' | ForEach-Object { if ($_ -notmatch '=') { $cands.Add("http://$_") } }
}
# C 回环监听端口（含 :: —— 只监听 IPv6 的代理很常见）
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalAddress -in '127.0.0.1','::1','0.0.0.0','::' } |
  Select-Object -ExpandProperty LocalPort -Unique |
  ForEach-Object { $cands.Add("http://127.0.0.1:$_") }
# 去重后逐个验证，命中即停
$seen = @{}
foreach ($c in $cands) {
  if (-not $c -or $seen[$c]) { continue }
  $seen[$c] = 1
  if (Test-Proxy $c) { "PROXY=$c"; return }
}
"PROXY=NONE"
```

`PROXY=NONE` → 直连 + 换源，不要继续加压。macOS / Linux 按同样三段顺序改写即可。
耗时按候选数线性增长：实测 Windows 上 32 个回环监听口全跑一遍（不提前退出）19.7s，`--max-time 2`；
A/B 命中时通常 1~2 次验证就退出。同一轮里 32 个端口只有 1 个通过验证——端口开不等于代理可用，判定以状态码为准。

## 边界（必须遵守）

1. **靶机与内网地址永不走代理**：任务指定的目标、RFC1918、链路本地、`localhost` 一律直连，
   并设 `NO_PROXY` 兜底。代理会吞掉内网请求或改写源地址，直接污染"目标怎么回我"的结论。
2. **通道会影响取证结论**：走代理等于换了出口 IP，指纹、限流、CDN 节点、地理判定在两种通道下不等价。
   报告里写明当时用的是哪条通道，同一目标不要在两条通道间混着比结论。
3. **凭据脱敏**：`http://user:pass@host:port` 形式的代理不回显到日志、报告或提交物里。
4. **代理只是出口通道**，不是分析对象；探测仅限判断"能不能当代理解析器"。
5. **不把上一轮记下的端口当默认值**：机器和代理软件都会变，每次重新走 A→B→C。

## 沉淀

发现成功后 `tool_memory register` 记一条：发现方式（A/B/C 哪一段命中）、`host:port`、验证返回码、日期。
下次会话先查账本，命中就直接进「验证」，跳过全量探测；验证失败说明环境变了，回退到 A→B→C 重跑并更新账本。
