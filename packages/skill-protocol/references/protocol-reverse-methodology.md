# 协议逆向方法论

> 从抓包到还原协议结构的系统化流程

## 一、信息收集

### 1.1 抓包
```bash
# tcpdump
tcpdump -i eth0 -w capture.pcap host target.com

# tshark (Wireshark CLI)
tshark -i any -f "host target.com" -w capture.pcap

# mitmproxy
mitmproxy -s script.py --mode transparent
```

### 1.2 初步分析
```bash
# 协议分布
tshark -r capture.pcap -q -z io,phs

# TCP 流统计
tshark -r capture.pcap -q -z conv,tcp

# 提取 TCP 流
tshark -r capture.pcap -q -z follow,tcp,ascii,0
```

## 二、字段识别

### 2.1 固定字段模式
| 特征 | 含义 |
|------|------|
| 前 2-4 字节大端递增 | 长度字段 |
| `\x00` 结尾 | Null-terminated 字符串 |
| 固定位置相同值 | Magic/Version/Header |
| 高频重复模式 | Padding/对齐 |

### 2.2 长度字段检测
```python
def detect_length_fields(data, min_len=2, max_len=4):
    candidates = []
    for offset in range(len(data) - max_len):
        for size in range(min_len, max_len + 1):
            val = int.from_bytes(data[offset:offset+size], 'big')
            if 0 < val < len(data) and offset + size + val <= len(data):
                candidates.append((offset, size, val))
    return candidates
```

### 2.3 字段边界识别
```python
def find_field_boundaries(data, separator=b'\x00'):
    fields = []
    start = 0
    while start < len(data):
        end = data.find(separator, start)
        if end == -1:
            fields.append(data[start:])
            break
        fields.append(data[start:end])
        start = end + len(separator)
    return fields
```

## 三、状态机推断

### 3.1 消息序列分析
```python
from collections import defaultdict

def infer_state_machine(messages):
    """从消息序列推断状态转移"""
    transitions = defaultdict(lambda: defaultdict(int))
    for i in range(len(messages) - 1):
        current = messages[i]["type"]
        next_msg = messages[i + 1]["type"]
        transitions[current][next_msg] += 1
    return dict(transitions)
```

### 3.2 状态图生成
```python
def generate_dot(transitions, output="state_machine.dot"):
    with open(output, "w") as f:
        f.write("digraph StateMachine {\n")
        f.write('  rankdir=LR;\n')
        f.write('  node [shape=circle];\n')
        for src, dsts in transitions.items():
            for dst, count in dsts.items():
                f.write(f'  "{src}" -> "{dst}" [label="{count}"];\n')
        f.write("}\n")
```

## 四、加密/编码检测

### 4.1 常见编码特征
| 特征 | 编码 |
|------|------|
| A-Za-z0-9+/= | Base64 |
| 0-9a-f | Hex |
| 高熵 (>7.5 bits/byte) | 加密 |
| 重复 8 字节块 | DES-ECB |
| 单字节 XOR | XOR |

### 4.2 熵分析
```python
import math
from collections import Counter

def entropy(data):
    if not data:
        return 0
    freq = Counter(data)
    length = len(data)
    return -sum((c/length) * math.log2(c/length) for c in freq.values())
```

## 五、工具链

| 工具 | 用途 |
|------|------|
| Wireshark/tshark | 抓包分析 |
| mitmproxy | HTTP/HTTPS 代理 |
| Scapy | Python 包构造/解析 |
| protoc | Protocol Buffers 逆向 |
| pcap_minimal.py | 自定义 pcap 解析 |
| protocol_state_machine.py | 状态机推断 |
