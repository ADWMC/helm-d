// Add a one-line "SRC-tier pointer" to the existing web docs whose topic src-hunter
// also covers. Contract: the two tiers REPLACE, never merge — this script only adds a
// pointer, it never copies src-hunter content outward (maintainer: "不要合并到其它的 skills 里").
// Idempotent: re-running rewrites the same single line in place.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REF = resolve('packages/helmd/references/web')
const MARK = '> **SRC / 众测语境**'

// existing web doc -> [relative link into src-hunter, what the SRC tier adds]
const XREFS = {
  'sql-injection.md': ['src-hunter/playbooks/sqli.md', '入口参数频率表（WooYun 27,732 例）+ payloader/by-category/web/sql-nosql-injection.md'],
  'xss.md': ['src-hunter/playbooks/xss/00-index.md', '类型分类 / 绕过矩阵 / 利用链 + 335 份 H1 案例'],
  'ssrf.md': ['src-hunter/playbooks/ssrf-cache-host/00-index.md', '云元数据 / 缓存投毒 / Host 头 + payloader/by-category/web/ssrf.md'],
  'information-disclosure.md': ['src-hunter/playbooks/info-disclosure.md', '.git / .svn / 备份 / 日志 / OSS bucket 清单'],
  'waf-bypass-techniques.md': ['src-hunter/payloader/waf-bypass.md', 'WAF/EDR 绕过变体 + src-hunter/methodology/02-bypass-toolkit.md 决策树'],
  'idor.md': ['src-hunter/playbooks/arbitrary-x-authz.md', '任意账号 86.4% / 任意操作 72.5% 统计 + 465 份 H1 案例'],
  'csrf.md': ['src-hunter/playbooks/logic-flaws/10-csrf.md', 'JSON CSRF / login CSRF / OAuth state 实战'],
  'ssti.md': ['src-hunter/playbooks/rce/14-ssti.md', '引擎指纹 + payloader/by-category/web/ssti.md'],
  'xxe.md': ['src-hunter/playbooks/rce/15-xxe.md', '带外 / OOXML / SOAP 实战 + payloader/by-category/web/xxe.md'],
  'command-injection.md': ['src-hunter/playbooks/rce/11-command-injection.md', '盲注带外 / 转换器 / 导入管线'],
  'business-logic-vulnerabilities.md': ['src-hunter/playbooks/logic-flaws/11-business-logic.md', '密码重置 4 模式 / 支付 / 验证码 + 234 份 H1 案例'],
  'race-condition.md': ['src-hunter/playbooks/race-conditions.md', '优惠券双花 / 余额超扣 / 限额绕过'],
  'graphql.md': ['src-hunter/playbooks/graphql.md', 'Introspection / 嵌套 IDOR / DoS'],
  'open-redirect.md': ['src-hunter/playbooks/oauth-saml-jwt/10-oauth-redirect.md', 'redirect_uri 白名单绕过链'],
  'clickjacking.md': ['src-hunter/playbooks/logic-flaws/12-clickjacking.md', '框架绕过 / 多步点击链'],
  'request-smuggling.md': ['src-hunter/playbooks/http-smuggling.md', 'CL.TE / TE.CL / H2→H1 变体'],
  'file-upload.md': ['src-hunter/playbooks/file-upload/00-index.md', '解析漏洞 / 编辑器 / 截断绕过'],
  'path-traversal-lfi.md': ['src-hunter/playbooks/path-traversal/00-index.md', '6 种编码 + WEB-INF / web.config + wrapper 链'],
  'subdomain-takeover.md': ['src-hunter/playbooks/info-disclosure.md', 'dangling CNAME/NS/MX 判定流程'],
  'authbypass-authentication-flaws.md': ['src-hunter/playbooks/unauth-access.md', '默认凭据表 + Actuator/Swagger + 14377 例未授权统计'],
  'jwt-attack.md': ['src-hunter/playbooks/oauth-saml-jwt/12-jwt.md', 'alg/kid 滥用 + 密钥混淆'],
  'oauth-token-attacks.md': ['src-hunter/playbooks/oauth-saml-jwt/00-index.md', 'OAuth / SAML / JWT 全族'],
  'prototype-pollution.md': ['src-hunter/playbooks/rce/17-prototype-pollution.md', '服务端 RCE gadget 链'],
  'deserialization.md': ['src-hunter/playbooks/rce/12-deserialization.md', 'Java/PHP/Python 反序列化链 + 385 份 RCE 案例'],
  'api-authorization-and-bola.md': ['src-hunter/playbooks/api-rest/10-rest-api.md', 'BOLA / Mass Assignment / 速率'],
  'websocket-attack.md': ['src-hunter/playbooks/api-rest/13-websocket.md', 'WS 授权缺陷 / 消息伪造'],
  'cache-poisoning.md': ['src-hunter/playbooks/ssrf-cache-host/12-cache.md', '缓存投毒 + Host 注入组合'],
  'nosql-injection.md': ['src-hunter/playbooks/api-rest/10-rest-api.md', 'Mongo 操作符 + payloader/by-category/web/sql-nosql-injection.md'],
  'jndi-injection.md': ['src-hunter/playbooks/rce/10-framework.md', 'Log4j2 / Spring 指纹与检测 payload'],
  'java-deserialization.md': ['src-hunter/playbooks/rce/12-deserialization.md', 'gadget 链与版本指纹'],
  'ldap-injection.md': ['src-hunter/playbooks/sqli.md', '注入类入口频率与绕过'],
  'expression-language-injection.md': ['src-hunter/playbooks/rce/14-ssti.md', 'EL/SpEL/OGNL 表达式注入'],
  'type-juggling.md': ['src-hunter/playbooks/oauth-saml-jwt/13-auth-misc.md', '弱比较与签名校验绕过'],
  'privilege-escalation-web.md': ['src-hunter/playbooks/arbitrary-x-authz.md', '越权矩阵与提权路径'],
  'information-disclosure.md2': null,
  'cors-cross-origin-misconfiguration.md': ['src-hunter/playbooks/api-rest/10-rest-api.md', 'CORS 配置错误组合利用'],
}

let added = 0
let updated = 0
const missing = []
for (const [file, entry] of Object.entries(XREFS)) {
  if (entry === null) continue
  const [link, what] = entry
  const p = join(REF, file)
  if (!existsSync(p)) {
    missing.push(file)
    continue
  }
  const line = `${MARK} → 用 \`read_reference(path: "${link}")\`（${what}）`
  let text = readFileSync(p, 'utf8')
  const lines = text.split('\n')
  const idx = lines.findIndex((l) => l.startsWith(MARK))
  if (idx >= 0) {
    if (lines[idx] === line) continue
    lines[idx] = line
    updated += 1
  } else {
    // insert after YAML frontmatter if present, else after the H1 line
    let at = 0
    if (lines[0]?.trim() === '---') {
      // The closing delimiter is a LINE that is exactly '---'. A YAML description
      // can contain a line starting with '---', so match line-wise — matching the
      // substring put the pointer INSIDE the frontmatter and broke its parsing.
      const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---')
      at = end === -1 ? 1 : end + 1
      // skip a blank line right after the block
      while (lines[at]?.trim() === '') at += 1
    } else {
      const h1 = lines.findIndex((l) => l.startsWith('# '))
      at = h1 === -1 ? 0 : h1 + 1
      while (lines[at]?.trim() === '') at += 1
    }
    lines.splice(at, 0, line, '')
    added += 1
  }
  writeFileSync(p, lines.join('\n'), 'utf8')
}
console.log(`crossrefs: added ${added}, updated ${updated}`)
if (missing.length) console.log('skipped (no such doc): ' + missing.join(', '))
