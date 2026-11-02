# HTTP/2 协议层攻击面

> 来源提炼: yaklang/hack-skills (http2-specific-attacks)
> 覆盖 h2c 走私、伪头注入、HPACK 攻击、多路复用竞态、H2→H1 降级缺陷

## 攻击面总览

| 特性 | 攻击面 |
|------|--------|
| 二进制分帧 | 帧级操纵、解析器差异 |
| HPACK 压缩 | 压缩 oracle(CRIME/BREACH)、表投毒 |
| 多路复用 | 单包竞态、RST_STREAM 泛洪 |
| Server push | 未经请求的推送缓存投毒 |
| 伪头(`:method`/`:path`/`:authority`/`:scheme`) | 注入、请求分裂、路径差异 |

## h2c 明文走私

h2c 是经 HTTP/1.1 `Upgrade` 协商的无 TLS HTTP/2。反向代理若盲目转发 `Upgrade: h2c` 头，可绕过代理层访问控制(路径 ACL、WAF、限流、鉴权、IP 限制)。

```bash
curl -v --http1.1 https://target.com/ \
  -H "Upgrade: h2c" \
  -H "HTTP2-Settings: AAMAAABkAAQCAAAAAAIAAAAA" \
  -H "Connection: Upgrade, HTTP2-Settings"
# 101 Switching Protocols → h2c 支持
```

```bash
# h2csmuggler
python3 h2csmuggler.py -x https://target.com/ --test
python3 h2csmuggler.py -x https://target.com/ -X GET -p /admin/users
```

## 伪头注入

- 路径差异: `:path: /public/../admin/users` → 代理匹配 `/public/*`，后端归一化到 `/admin`。
- 重复伪头: 代理用第一个 `:path` 路由，后端用最后一个。
- authority vs Host 不一致: `:authority: public.target.com` + `host: admin.internal.target.com`。
- scheme 操纵: `:scheme: http` 可能被后端当"内部"请求。

## HPACK 压缩攻击

- CRIME/BREACH: 攻击者控制部分头 + 同上下文秘密 → 匹配猜测→更小帧→oracle(比原 CRIME 难，HPACK 用静态+动态表)。
- 动态表投毒: 连接复用场景下跨请求泄漏。

## 多路复用滥用

- 单包攻击(竞态): 多个请求打包进同一 TCP 段，服务端真正同时处理。用 `h2` 库一次 `sendall` 发全部帧。
- RST_STREAM 泛洪(CVE-2023-44487 "Rapid Reset"): HEADERS→RST_STREAM 循环，客户端不等待响应，放大服务端 CPU。
- PRIORITY 操纵: exclusive+weight=256 饿死其他请求。

## H2→H1 降级缺陷

- 二进制头注入: H2 头值内 `\r\n` 是合法数据，降级 H1 时变成真实换行→头注入。
- Transfer-Encoding 走私: H2 规范禁止 `transfer-encoding`，代理降级时透传→后端 chunked→H2.TE。
- Content-Length 不一致: H2 用帧长，代理降级生成 CL 与攻击者 CL 冲突→走私。
- 头名大小写: H2 要求小写，`Transfer-Encoding` 大写非法但可能透传为合法 H1 头。

## 工具

| 工具 | 用途 |
|------|------|
| h2csmuggler | h2c 升级走私 |
| http2smugl | H2 特定 desync |
| h2 (Python) | H2 协议库造帧 |
| nghttp2 | H2 客户端/服务端 |
| Burp HTTP Request Smuggler | 自动化变体扫描 |
| curl --http2 | 快速探测 |