# 子域名枚举工具详细参数

## subfinder

轻量级被动子域名枚举，聚合 40+ 数据源。

### 基本用法

```bash
# 单域名枚举
subfinder -d example.com -o subdomains.txt

# 多域名
subfinder -dL domains.txt -o all_subs.txt

# 指定数据源
subfinder -d example.com -sources crtsh,virustotal,shodan

# 安静模式（只输出域名）
subfinder -d example.com -silent

# 递归枚举
subfinder -d example.com -recursive

# 排除特定源（某些源慢或不可用时）
subfinder -d example.com -exclude-sources google
```

### 数据源配置

配置文件：`~/.config/subfinder/provider-config.yaml`

```yaml
# 重要 API Key 配置
shodan:
  - YOUR_SHODAN_KEY
virustotal:
  - YOUR_VT_KEY
securitytrails:
  - YOUR_ST_KEY
censys:
  - YOUR_CENSYS_ID:YOUR_CENSYS_SECRET
chaos:
  - YOUR_CHAOS_KEY
```

有 API Key 的源覆盖率显著高于无 Key 的。优先配置：SecurityTrails > Shodan > VirusTotal > Censys。

---

## ksubdomain

高性能 DNS 爆破工具（使用无状态 DNS 发包），适合大规模字典枚举。

### 基本用法

```bash
# 字典爆破
ksubdomain -d example.com -f /path/to/dict.txt -o results.txt

# 验证已知子域名（存活检测）
ksubdomain -l subdomains.txt -o alive.txt

# 控制速率（避免被目标 DNS 限速）
ksubdomain -d example.com -f dict.txt -b 5m   # 5Mbps 带宽限制

# 指定 DNS 解析器
ksubdomain -d example.com -f dict.txt -r resolvers.txt
```

### 字典选择

```
小型（快速）：  /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt
中型（平衡）：  /usr/share/seclists/Discovery/DNS/subdomains-top1million-20000.txt
大型（全面）：  /usr/share/seclists/Discovery/DNS/subdomains-top1million-110000.txt
自定义行业：   根据目标行业定制（如 oa/vpn/mail/api/dev 等中文互联网常见）
```

---

## amass

OWASP 出品，功能最全面的子域名枚举工具。

### 基本用法

```bash
# 被动枚举（仅使用 OSINT 数据源）
amass enum -passive -d example.com -o passive_subs.txt

# 主动枚举（DNS 爆破 + 被动）
amass enum -d example.com -o all_subs.txt

# 暴力破解模式
amass enum -brute -d example.com -w /path/to/wordlist.txt

# 指定 DNS 解析器
amass enum -d example.com -rf resolvers.txt

# 输出详细信息（包括来源）
amass enum -d example.com -json output.json

# IP/ASN 反查
amass intel -asn 12345
amass intel -cidr 10.0.0.0/24
```

### 配置文件

`~/.config/amass/config.ini` — 配置 API Key 和数据源优先级。

---

## 通配符 DNS 处理

### 检测方法

```bash
# 测试随机子域是否解析
dig A random$(date +%s).example.com +short
dig A nonexistent1234567.example.com +short

# 如果返回 IP → 存在通配符
# 记录通配符 IP 用于后续过滤
WILDCARD_IP=$(dig A random$(date +%s).example.com +short)
```

### 过滤脚本

```bash
# 过滤掉解析到通配符 IP 的子域名
WILDCARD_IP="1.2.3.4"
while read sub; do
  ip=$(dig A "$sub" +short | head -1)
  if [ "$ip" != "$WILDCARD_IP" ]; then
    echo "$sub"
  fi
done < all_subdomains.txt > real_subdomains.txt
```

### HTTP 内容比对（更可靠）

```bash
# 通配符可能解析到同一 IP 但返回不同内容
# 获取通配符基线
BASELINE_HASH=$(curl -sk "https://random$(date +%s).example.com" | md5sum | cut -d' ' -f1)

# 比对每个子域名的响应
while read sub; do
  HASH=$(curl -sk "https://$sub" 2>/dev/null | md5sum | cut -d' ' -f1)
  if [ "$HASH" != "$BASELINE_HASH" ]; then
    echo "[REAL] $sub"
  fi
done < all_subdomains.txt
```

---

## 多工具联合流程

```bash
# 推荐流程：subfinder(被动) + ksubdomain(主动) + 去重
# 1. 被动枚举
subfinder -d example.com -silent -o passive.txt

# 2. DNS 爆破（字典枚举）
ksubdomain -d example.com -f /path/to/dict.txt -o brute.txt

# 3. 合并去重
cat passive.txt brute.txt | sort -u > all_subs.txt

# 4. 存活检测
httpx -l all_subs.txt -silent -o alive_http.txt

# 5. 通配符过滤（如果检测到通配符）
# ... 使用上述过滤脚本

# 6. 结果分类（传给 target-profiling 做深度分析）
```
