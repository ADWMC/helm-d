# 加密分析方法论

> 常见加密算法识别、密钥提取、编码解码系统化流程

## 一、编码识别

### 1.1 特征表
| 特征 | 编码 | 解码 |
|------|------|------|
| A-Za-z0-9+/= | Base64 | `base64 -d` 或 `python -c "import base64; print(base64.b64decode('...'))"` |
| 0-9a-f | Hex | `xxd -r -p` 或 `bytes.fromhex('...')` |
| 0-9 | Decimal | `chr(int('...'))` |
| 0-7 | Octal | `chr(int('...', 8))` |
| 8 字节重复块 | DES-ECB | 逐块 DES 解密 |
| 高熵 (>7.5) | 加密 | 需要密钥 |
| 单字节 XOR | XOR | 爆破 256 密钥 |

### 1.2 自动检测
```python
import base64
import binascii

def detect_encoding(data):
    """检测数据编码类型"""
    if isinstance(data, str):
        data = data.encode()
    
    # Base64
    try:
        decoded = base64.b64decode(data)
        if len(decoded) > len(data) * 0.5:
            return "base64", decoded
    except:
        pass
    
    # Hex
    try:
        decoded = bytes.fromhex(data.decode())
        if len(decoded) > 0:
            return "hex", decoded
    except:
        pass
    
    # URL encoding
    if b'%' in data:
        import urllib.parse
        decoded = urllib.parse.unquote(data.decode()).encode()
        return "url", decoded
    
    return "unknown", data
```

## 二、XOR 分析

### 2.1 单字节 XOR 爆破
```python
def xor_bruteforce(data, top_n=10):
    """爆破单字节 XOR 密钥"""
    results = []
    for key in range(256):
        decrypted = bytes([b ^ key for b in data])
        printable = sum(1 for b in decrypted if 32 <= b < 127)
        ratio = printable / len(decrypted)
        results.append((key, ratio, decrypted))
    
    results.sort(key=lambda x: x[1], reverse=True)
    return results[:top_n]
```

### 2.2 多字节 XOR
```python
def xor_decrypt(data, key):
    """使用已知密钥解密 XOR"""
    return bytes([b ^ key[i % len(key)] for i, b in enumerate(data)])

def find_key_length(data, max_len=32):
    """通过重合指数找密钥长度"""
    def coincidence_index(text):
        freq = {}
        for b in text:
            freq[b] = freq.get(b, 0) + 1
        n = len(text)
        return sum(f * (f - 1) for f in freq.values()) / (n * (n - 1))
    
    best_len = 1
    best_ic = 0
    for length in range(1, max_len + 1):
        blocks = [data[i::length] for i in range(length)]
        avg_ic = sum(coincidence_index(b) for b in blocks) / length
        if abs(avg_ic - 0.065) < abs(best_ic - 0.065):
            best_ic = avg_ic
            best_len = length
    return best_len
```

### 2.3 已知明文攻击
```python
def known_plaintext_xor(ciphertext, plaintext):
    """已知明文恢复 XOR 密钥"""
    key = bytes([c ^ p for c, p in zip(ciphertext, plaintext)])
    return key
```

## 三、AES 分析

### 3.1 密钥扫描
```python
def scan_aes_keys(data):
    """扫描二进制中的 AES 密钥候选"""
    candidates = []
    for i in range(len(data) - 16):
        chunk = data[i:i+16]
        # 检查熵 (AES 密钥通常是高熵)
        freq = {}
        for b in chunk:
            freq[b] = freq.get(b, 0) + 1
        entropy = -sum((f/16) * (f/16-1) for f in freq.values())
        if entropy > 0.9:  # 高熵阈值
            candidates.append((i, chunk))
    return candidates
```

### 3.2 AES 模式检测
```python
def detect_aes_mode(ciphertext):
    """检测 AES 模式 (ECB/CBC/CTR)"""
    block_size = 16
    blocks = [ciphertext[i:i+block_size] for i in range(0, len(ciphertext), block_size)]
    
    # ECB: 相同明文块 → 相同密文块
    unique_blocks = len(set(blocks))
    if unique_blocks < len(blocks) * 0.8:
        return "ECB (detected duplicate blocks)"
    
    # CBC: 第一个块是 IV
    return "CBC or other mode"
```

### 3.3 Padding Oracle
```python
def padding_oracle_attack(oracle, ciphertext, block_size=16):
    """Padding Oracle 攻击"""
    blocks = [ciphertext[i:i+block_size] for i in range(0, len(ciphertext), block_size)]
    plaintext = b""
    
    for block_idx in range(1, len(blocks)):
        decrypted_block = bytearray(block_size)
        for byte_idx in range(block_size - 1, -1, -1):
            padding_value = block_size - byte_idx
            for guess in range(256):
                # 构造攻击块
                attack_block = bytearray(block_size)
                for k in range(byte_idx + 1, block_size):
                    attack_block[k] = decrypted_block[k] ^ padding_value
                attack_block[byte_idx] = guess ^ padding_value
                
                # 测试
                if oracle(bytes(attack_block) + blocks[block_idx]):
                    decrypted_block[byte_idx] = guess ^ padding_value
                    break
        
        plaintext += bytes([d ^ b for d, b in zip(decrypted_block, blocks[block_idx - 1])])
    
    return plaintext
```

## 四、哈希分析

### 4.1 哈希识别
```python
def identify_hash(hash_str):
    """识别哈希类型"""
    length = len(hash_str)
    if length == 32:
        return "MD5"
    elif length == 40:
        return "SHA1"
    elif length == 64:
        return "SHA256"
    elif length == 128:
        return "SHA512"
    elif hash_str.startswith("$2a$") or hash_str.startswith("$2b$"):
        return "bcrypt"
    elif hash_str.startswith("$6$"):
        return "SHA512-crypt"
    elif hash_str.startswith("$5$"):
        return "SHA256-crypt"
    elif hash_str.startswith("$1$"):
        return "MD5-crypt"
    return "unknown"
```

## 五、密钥捕获 (运行时)

### 5.1 Frida 密钥捕获
```javascript
// Hook OpenSSL
Interceptor.attach(Module.findExportByName("libssl.so", "SSL_write"), {
    onEnter(args) {
        console.log("SSL_write: " + args[2].readUtf8String());
    }
});

Interceptor.attach(Module.findExportByName("libssl.so", "SSL_read"), {
    onEnter(args) {
        this.buf = args[1];
        this.len = args[2];
    },
    onLeave(retval) {
        console.log("SSL_read: " + this.buf.readUtf8String());
    }
});

// Hook BCrypt
Interceptor.attach(Module.findExportByName("bcrypt.dll", "BCryptEncrypt"), {
    onEnter(args) {
        console.log("BCryptEncrypt called");
        console.log("Key handle: " + args[0]);
        console.log("Input: " + args[2].readUtf8String());
    }
});
```

## 六、工具链

| 工具 | 用途 |
|------|------|
| hashcat | 哈希破解 |
| John the Ripper | 哈希破解 |
| CyberChef | 编码/加密分析 |
| OpenSSL | 证书/密钥操作 |
| SageMath | 数学分析 |
| Frida | 运行时密钥捕获 |
