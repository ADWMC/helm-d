# CTF PHP 技巧补充
## PHP7 OPcache 投毒 Webshell

`opcache.file_cache` 启用时，编译字节码存放在 `/tmp/OPcache/[system_id]/[webroot]/script.php.bin`。通过 SQLi `INTO DUMPFILE` 替换 `.bin` 文件可绕过上传限制执行任意 PHP：

```bash
# 1. 从 phpinfo() 计算 system_id
# 2. 本地生成同版本 PHP 的 opcode 缓存
php -d opcache.file_cache=/tmp/OPcache -f payload.php
# 3. 修补 binary 中的 system_id (bytes 9-40)
# 4. 通过 SQLi INTO DUMPFILE 覆写缓存文件
```

## PNG/PHP 多态文件上传

同时是有效 PNG 和有效 PHP 的文件，绕过图片类型检测：

```bash
# PHP 代码隐藏在 PNG IDAT 块中
# 配合双扩展名(.php.png)或 .htaccess AddType 利用
```
