# 逆向分析结果视频化工作流

> 将前端JS逆向、API黑盒测试等技术分析结果，转化为短视频内容  
> 工具链：Playwright + imageio + Edge TTS + ffmpeg

---

## 一、壳理论选题（影视飓风方法论）

**核心：先找"壳"，再包"核"。**

| 要素 | 说明 | 示例 |
|------|------|------|
| 壳 | 生活化、引发好奇的切入点 | "我拔了网线，数字还在跳" |
| 核 | 硬核技术知识 | Date.now()线性插值、双脚本架构 |
| 对立 | 制造认知冲突 | 断网vs还在跳、假vs真、72亿vs125亿 |

**选题公式：**
```
[反常识行为] + [权威数据/IP] + [悬念提问]
```

**案例：**
- 坏：「华为乾崑智驾里程计算分析」
- 好：「我拔了网线，华为智驾的数字还在跳」

---

## 二、视频结构模板（28秒竖版）

| 时间 | 场景 | 内容 | 情绪 |
|------|------|------|------|
| 0-4s | 壳 | 钩子标题 + 悬念 | 好奇 |
| 4-9s | 冲突 | 实验/对比/反常现象 | 震惊 |
| 9-14s | 揭秘 | 两个脚本/技术对比 | 理解 |
| 14-19s | 证据 | 代码/数据/截图 | 信服 |
| 19-24s | 真相 | 真实数据/API结果 | 认知 |
| 24-28s | 暴击 | 一句话总结/反转 | 记忆 |

---

## 三、技术实现

### 3.1 HTML场景定义

```html
<!-- 每个场景是一个独立div，通过JS控制显示/隐藏 -->
<div id="s0" class="scene" style="display:flex; opacity:1">
  <!-- 场景内容 -->
</div>
<div id="s1" class="scene" style="display:none; opacity:0">
  <!-- 场景内容 -->
</div>
```

**关键：场景ID必须与render.py中的SCENES定义完全一致！**

### 3.2 Playwright截图渲染

```python
from playwright.sync_api import sync_playwright
import imageio.v3 as iio
import numpy as np
from PIL import Image

HTML_PATH = "index.html"
FPS = 30

SCENES = [
    ("s0", 4),  # (scene_id, duration_seconds)
    ("s1", 5),
]

def capture_scene(page, scene_id):
    """截取单个场景"""
    js = f"""
    document.querySelectorAll('.scene').forEach(el => {{
        el.style.display = 'none';
        el.style.opacity = '0';
    }});
    var target = document.getElementById('{scene_id}');
    if (target) {{
        target.style.display = 'flex';
        target.style.opacity = '1';
    }}
    """
    page.evaluate(js)
    page.wait_for_timeout(300)
    screenshot = page.screenshot(type="png")
    return np.array(Image.open(io.BytesIO(screenshot)))[:, :, :3]

# 渲染流程
frames = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1080, "height": 1920})
    page.goto(f"file:///{HTML_PATH}")
    page.wait_for_timeout(500)

    for scene_id, duration in SCENES:
        frame = capture_scene(page, scene_id)
        for _ in range(duration * FPS):
            frames.append(frame)

    browser.close()

iio.imwrite("output.mp4", frames, fps=FPS, codec="libx264")
```

### 3.3 TTS配音

**Edge TTS（免费，中文支持好）：**
```python
# 通过Hermes text_to_speech工具
text_to_speech(text="我拔了网线，华为智驾的数字还在跳", output_path="s0.mp3")
```

**MiMo TTS（需单独API key）：**
```python
# 注意：MiMo TTS需要单独的API key，与chat API key不同
# 端点：https://api.xiaomimimo.com/v1/chat/completions
# 模型：mimo-v2.5-tts
# 认证：api-key header（不是Authorization）
```

### 3.4 音视频合并

```bash
# 使用imageio-ffmpeg自带的ffmpeg
FFMPEG="path/to/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe"

# 1. 合并音频文件
ffmpeg -y -f concat -safe 0 -i filelist.txt -c copy combined.mp3

# 2. 合并音视频
ffmpeg -y -i video.mp4 -i combined.mp3 -c:v copy -c:a aac -shortest output.mp4
```

---

## 四、常见陷阱

| 问题 | 原因 | 解决 |
|------|------|------|
| 视频全黑 | 场景ID不匹配 | 确保HTML的id与SCENES定义完全一致 |
| HyperFrames卡住 | Chrome下载循环 | 用Playwright+imageio替代 |
| MiMo TTS 401 | API key不通用 | TTS需单独key，用Edge TTS替代 |
| pydub报错 | 需要ffmpeg | 用imageio-ffmpeg自带的二进制 |
| 音频比视频长/短 | 时长不匹配 | 按音频时长调整视频场景duration |
| 场景过渡生硬 | 无动画 | 加CSS transition/animation |
| 中文乱码 | 字体缺失 | 用local()加载系统字体 |

---

## 五、文件组织

```
project/
├── index.html              # HTML场景源码
├── render.py               # 纯视频渲染
├── render_with_audio.py    # 带音频渲染
├── generate_voice.py       # TTS生成脚本
├── audio/
│   ├── s0.mp3              # 各场景配音
│   ├── s1.mp3
│   └── combined.mp3        # 合并后音频
└── output.mp4              # 最终视频
```
