# social-engineering

> 来源: wgpsec/AboutSecurity (recon) | 融合进 skill-web


# 社会工程学情报收集方法论

> **⛔ 深入参考**：钓鱼邮件模板、pretexting 话术、凭据猜测脚本、水坑攻击方法见 `references/social-engineering-techniques.md`

社工攻击的成功率取决于前期情报质量。本技能聚焦于人员和组织层面的情报收集，为后续的钓鱼/水坑/凭据猜测提供弹药。

## Phase 1: 邮箱格式发现
通过 `http_request` 或 `curl` 查询 Hunter API 搜索目标域名关联的邮箱地址。

**关键目标**：
- 确定邮箱命名规则（如 `first.last@`, `f.last@`, `flast@`）
- 收集已知邮箱列表（用于后续钓鱼或密码喷射）
- 识别通用邮箱（`info@`, `hr@`, `support@`）— 通常多人共享，更容易中招

## Phase 2: 组织信息收集
通过 `http_request` 或 `curl` 查询 FOFA API 搜索目标域名关联的资产，关注：

**内部系统暴露**：
- OA/ERP 系统 → 泄露组织架构
- VPN 入口 → 远程办公入口点
- 邮件系统（OWA/Zimbra）→ 凭据攻击目标
- HR/招聘系统 → 泄露岗位和技术栈信息
- Wiki/Confluence → 可能有无认证的知识库

**信息泄露检查**：
- 文档元数据（PDF/Word 中的作者名、内部路径）
- GitHub/GitLab 公开仓库（搜索组织名或域名）
- 招聘信息泄露技术栈（"熟悉 Spring Boot + MySQL"）

## Phase 3: 关键人员识别

优先识别以下角色（按社工价值排序）：
1. **IT 管理员** — 有系统权限，技术邮件更容易伪造
2. **HR/行政** — 习惯打开附件（简历、合同等）
3. **财务人员** — 常见 BEC（商业邮件欺诈）目标
4. **高管** — CEO/CFO 身份可用于内部钓鱼
5. **新员工** — 不熟悉内部流程，更容易上当

## Phase 4: 社工攻击方案

基于收集的情报，评估可行的攻击方向：

| 攻击类型 | 前提条件 | 成功率 |
|----------|----------|--------|
| 钓鱼邮件 | 有邮箱列表 + 邮箱格式 | 高 |
| 密码喷射 | 有邮箱列表 + 登录入口 | 中 |
| 水坑攻击 | 知道目标常访问的网站 | 中 |
| 凭据猜测 | 有人员姓名 + 邮箱格式 | 低-中 |
| 电话社工 | 有组织架构 + 关键人员 | 场景依赖 |

## 注意事项
- 用 `evidence_save` 保存关键发现（邮箱列表、人员信息）以便后续使用
- 社工情报有时效性，人员可能离职或换岗
- 所有信息来源应标注可信度（搜索引擎/官网/推测）

## 目标选择
- 角色排序：按优先级选择目标（IT管理员 > 普通员工）

## 密码模式推测
- 常见模式：公司名+年份（2026）、季节等当前时间相关
- 注意账户锁定策略（lockout），通常 5 次锁定


---

## REF: social-engineering-techniques

# 社工攻击技术参考

## 1. 钓鱼邮件模板

### 1.1 IT 部门通知型

```
主题：[紧急] 您的邮箱密码将于今日过期，请立即更新
发件人：IT Support <it-support@{target-domain}>
---
尊敬的 {姓名}，

根据公司信息安全策略，您的邮箱密码将于今日 18:00 过期。
请点击以下链接完成密码更新，否则您的邮箱将被暂时锁定：

[立即更新密码]({钓鱼链接})

如有疑问，请联系 IT 部门（分机 8001）。

信息技术部
{目标公司名}
```

**为什么有效**：紧迫感 + 权威来源 + 明确后果 + 低成本操作

### 1.2 文件共享型

```
主题：{同事姓名} 与您共享了文件 "Q4财务报告.xlsx"
发件人：notifications@{仿冒域名}
---
{同事姓名} 通过 OneDrive/飞书 与您共享了一个文件：

📄 Q4财务报告.xlsx (2.4 MB)
共享时间：{当前日期}

[查看文件]({钓鱼链接})

此链接将于 7 天后过期。
```

### 1.3 HR 通知型

```
主题：关于 {当前月份} 薪资调整通知
发件人：HR Department <hr@{target-domain}>
---
各位同事，

经管理层批准，公司将对 {当前月份} 起的薪资结构进行调整。
请登录 HR 系统查看您的个人调整方案：

[查看薪资调整方案]({钓鱼链接})

请于 {截止日期} 前确认。
人力资源部
```

---

## 2. Pretexting 话术

### 2.1 电话社工 — IT 支持

```
场景：冒充 IT 部门远程协助
话术：
"您好，我是 IT 部门的 {姓名}。我们监测到您的工作站有异常流量告警，
可能是最近的安全补丁没有正确安装。我需要远程确认一下您的系统状态，
能否告诉我您电脑右下角的 IP 地址/您的工号？"
"您需要暂时关闭杀毒软件，我来推送最新的安全补丁。"

目标：获取内网信息/安装远控
```

### 2.2 电话社工 — 供应商

```
场景：冒充合作供应商
话术：
"您好，我是 {已知供应商} 的项目经理。我们这边系统升级，
需要重新对接 VPN/API 接口，能否提供一下新的访问凭据？
之前的联系人 {某姓名} 好像离职了，所以直接联系您了。"

目标：获取系统凭据/内部联系人
```

### 2.3 现场社工 — 尾随进入

```
场景：跟随员工进入办公区
方法：
- 双手拿咖啡/快递箱 → 请别人帮忙刷卡
- 穿维修工/快递制服 → 降低警惕
- 伪造访客证 → 需要提前收集证件样式

目标：物理访问/USB 投放/WiFi 嗅探
```

---

## 3. 凭据猜测模式

### 3.1 密码规则推导

> **💡 工具提示**：如果目标是中国人且有个人信息（姓名/生日/电话/身份证），用 `ccupp` 自动生成社工字典比手工写脚本更快更全：`ccupp interactive` 交互式输入 → `ccupp generate -o passwords.txt`

```python
# 基于收集到的信息生成密码字典
import itertools

company = "target"  # 公司名/简称
year = "2026"
seasons = ["spring", "summer", "autumn", "winter", "Spring", "Summer"]
months = [f"{i:02d}" for i in range(1, 13)]
specials = ["!", "@", "#", "$", "123", "1234"]

passwords = []
# 公司名 + 年份
for s in specials:
    passwords.append(f"{company}{year}{s}")
    passwords.append(f"{company.capitalize()}{year}{s}")
    passwords.append(f"{company.upper()}{year}{s}")
# 公司名 + 季节
for season in seasons:
    passwords.append(f"{company}{season}{year}")
    passwords.append(f"{company.capitalize()}{season}")
# 常见弱密码
passwords.extend([
    f"{company}@{year}", f"{company}#{year}",
    f"P@ssw0rd", f"Admin@123", f"admin123",
    f"{company}admin", f"Welcome1",
])
```

### 3.2 用户名生成

```python
# 从姓名列表生成邮箱用户名
def generate_usernames(first, last, domain):
    """基于已知邮箱格式生成用户名"""
    patterns = [
        f"{first}.{last}@{domain}",          # john.smith
        f"{first[0]}.{last}@{domain}",        # j.smith
        f"{first}{last[0]}@{domain}",          # johns
        f"{first[0]}{last}@{domain}",          # jsmith
        f"{last}.{first}@{domain}",            # smith.john
        f"{first}_{last}@{domain}",            # john_smith
        f"{first}{last}@{domain}",             # johnsmith
    ]
    return patterns
```

---

## 4. 水坑攻击准备

### 4.1 目标常访问站点识别

```
信息来源：
- 公司官网外链（合作伙伴、行业协会）
- 员工社交媒体关注/转发
- 招聘 JD 中提到的工具/平台（GitHub/Confluence/Jira）
- 行业论坛/技术社区

攻击方式：
- 入侵目标常访问的第三方站点
- XSS 注入到行业论坛的热门帖子
- 伪造行业活动注册页面
- 发布带后门的开源工具/库（供应链攻击）
```

---

## 5. OSINT 信息源速查

| 信息类型 | 来源 | 工具/方法 |
|---|---|---|
| 邮箱列表 | Hunter.io / Phonebook.cz / Skymem | API 查询 |
| 人员信息 | LinkedIn / 脉脉 / 企查查 | 手动搜索 |
| 组织架构 | 企业官网 / 年报 / 工商信息 | 天眼查/企查查 |
| 技术栈 | 招聘 JD / GitHub / BuiltWith | 关键词搜索 |
| 文档元数据 | FOCA / exiftool | 分析公开 PDF/Word |
| 凭据泄露 | Have I Been Pwned / dehashed | API/搜索 |
| 社交媒体 | Twitter/微博/GitHub | 员工搜索 |
