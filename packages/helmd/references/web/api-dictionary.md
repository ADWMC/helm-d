> 融合来源：authorized-pentest-framework 的 API 字典累积规范。
> 相关文档：
- [pentest-web-checklist](./pentest-web-checklist.md)
用于 main document §8 步骤 12 / §9。将测试中梳理出的 URL / API 路径沉淀为 dir 字典，随每次测试累积，作为后续目录爆破 / 接口探测的输入。

## 存储位置

- 全局复用：`知识库/api_dict.txt`
- 单目标随附：`<目标文件夹>/api_paths.txt`

## 格式

- 每行一个路径（相对或绝对），以 `#` 开头为注释。
- 可附注释说明来源/参数，例如：

```text
# 来自前端 JS 逆向 - 用户服务
/api/v1/user/profile
/api/v1/user/export
# 来自爬取/架构梳理 - 管理
/admin/dashboard
/api/v2/order/{id}
```

## 使用建议

- 每次测试结束，将新发现的路径并入字典，避免重复劳动。
- 作为目录扫描工具的自定义字典输入（速率友好，避免大规模无差别扫描）。
- 与知识库交叉引用：路径对应的漏洞记入知识库条目。

## 隐私

- 字典保留**真实路径/组件名**以便复用与验证；但**不写入凭据、令牌等密钥**（字典常被复用/分享，避免密钥扩散）。对外发布时由使用者按需脱敏。

