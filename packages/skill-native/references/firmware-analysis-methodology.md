# 固件分析方法论

> IoT/嵌入式固件逆向、提取、分析系统化流程

## 一、固件获取

### 1.1 常见来源
```bash
# 官网下载
# OTA 更新包
# 设备 dump (SPI flash / JTAG / UART)
# 固件库 (firmware.re)
```

### 1.2 固件格式识别
```bash
# file 命令
file firmware.bin

# binwalk 识别
binwalk firmware.bin

# 查找 Magic
binwalk -A firmware.bin  # 所有签名
binwalk -R "UBI#" firmware.bin  # 特定签名
```

## 二、固件解包

### 2.1 binwalk 自动提取
```bash
# 递归提取
binwalk -e firmware.bin
binwalk -eM firmware.bin  # 递归 + 合并

# 指定输出目录
binwalk -e -C output_dir firmware.bin

# 强制提取 (忽略校验)
binwalk --dd=".*" firmware.bin
```

### 2.2 手动提取
```bash
# SquashFS
unsquashfs filesystem.squashfs

# JFFS2
jefferson firmware.jffs2

# UBIFS
ubireader_extract_images firmware.ubi
ubireader_extract_files firmware.ubi

# CramFS
fsck.cramfs --extract cramfs.img

# YAFFS
unyaffs yaffs.img output_dir/
```

### 2.3 加密固件处理
```bash
# 检测加密
binwalk -E firmware.bin  # 熵分析

# 高熵区域 (>7.5) = 可能加密/压缩
# 低熵区域 = 代码/数据

# 常见解密
# 1. XOR 密钥在 bootloader 中
# 2. AES 密钥在设备硬件中
# 3. 固件签名验证
```

## 三、文件系统分析

### 3.1 目录结构分析
```bash
# 查找关键文件
find . -name "*.conf" -o -name "*.cfg" -o -name "*.ini"
find . -name "*.key" -o -name "*.pem" -o -name "*.crt"
find . -name "*.sh" -o -name "*.lua" -o -name "*.py"
find . -name "passwd" -o -name "shadow" -o -name "hosts"

# 查找硬编码凭证
grep -r "password" . 2>/dev/null
grep -r "admin" . 2>/dev/null
grep -r "key" . 2>/dev/null
```

### 3.2 二进制分析
```bash
# 识别架构
file bin/busybox
readelf -h bin/busybox

# 查找后门
strings bin/httpd | grep -i "shell\|exec\|cmd\|command"
strings bin/httpd | grep -i "admin\|root\|password"

# 查找远程访问
strings bin/sshd | grep -i "permit\|auth\|login"
```

### 3.3 网络配置分析
```bash
# 查找网络配置
cat etc/resolv.conf
cat etc/hosts
cat etc/network/interfaces

# 查找服务配置
cat etc/init.d/*
cat etc/crontab

# 查找 web 服务
find . -name "*.html" -o -name "*.js" -o -name "*.php"
find . -name "lighttpd*" -o -name "nginx*" -o -name "httpd*"
```

## 四、漏洞挖掘

### 4.1 常见漏洞类型
| 类型 | 检测方法 |
|------|---------|
| 命令注入 | grep "system\|popen\|exec" |
| 缓冲区溢出 | grep "strcpy\|strcat\|sprintf" |
| 硬编码凭证 | strings + grep |
| 后门 | 反汇编 + 行为分析 |
| 弱加密 | 检查加密库版本 |

### 4.2 命令注入检测
```bash
# 查找 system() 调用
strings bin/httpd | grep "system"
grep -r "system(" source/
grep -r "popen(" source/
grep -r "exec(" source/
```

### 4.3 缓冲区溢出检测
```bash
# 查找不安全函数
strings bin/httpd | grep -E "strcpy|strcat|sprintf|gets|scanf"

# 查找栈保护
readelf -s bin/httpd | grep "stack_chk"
```

## 五、动态分析

### 5.1 QEMU 模拟
```bash
# 静态二进制
qemu-arm bin/busybox

# 动态二进制 (需要库)
qemu-arm -L /path/to/libs bin/httpd

# 用户模式模拟
qemu-arm -g 1234 -L /path/to/libs bin/httpd
# 另一个终端
gdb-multiarch -ex "target remote :1234"
```

### 5.2 Firmadyne/FirmAE
```bash
# 自动化固件模拟
# Firmadyne
./analyze.py firmware.bin

# FirmAE
./run.sh -r <brand> firmware.bin
```

## 六、工具链

| 工具 | 用途 |
|------|------|
| binwalk | 固件解包/分析 |
| unsquashfs | SquashFS 解包 |
| jefferson | JFFS2 解包 |
| ubireader | UBIFS 解包 |
| qemu-arm | ARM 模拟 |
| gdb-multiarch | 多架构调试 |
| Firmadyne | 自动化固件模拟 |
| FirmAE | 固件仿真分析 |
| firmware.re | 固件库 |
| FACT | 固件分析工具 |
