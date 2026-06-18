"""
Playwright 驱动的阿里云滑块验证码解决器。

仅当 ``CAPTCHA_PROVIDER=playwright`` 时由 ``captcha.py`` 惰性导入。
需额外安装: pip install playwright ddddocr numpy pillow
         && playwright install chromium

不适合 Docker 部署。仅供本地桌面环境使用。
"""

from __future__ import annotations

import asyncio
import io
import json
import logging
import random
import time

logger = logging.getLogger(__name__)

# Z.ai 验证码配置
CAPTCHA_SCENE_ID = "didk33e0"
CAPTCHA_PREFIX = "no8xfe"
CAPTCHA_MODE = "popup"
CAPTCHA_REGION = "cn"
CAPTCHA_LANGUAGE = "en"

SOLVE_TIMEOUT = 30.0

CAPTCHA_PAGE_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Captcha</title>
<style>
  body{margin:0;padding:0;display:flex;justify-content:center;align-items:center;
        height:100vh;background:#f5f5f5;font-family:Arial,sans-serif}
  #cap-box{width:340px;min-height:280px;background:#fff;border-radius:8px;
            box-shadow:0 2px 12px rgba(0,0,0,.1);padding:20px;text-align:center}
  .title{color:#333;margin-bottom:16px;font-size:14px}
  .spinner{display:none;width:30px;height:30px;border:3px solid #e0e0e0;
            border-top-color:#007bff;border-radius:50%;animation:spin .8s linear infinite;
            margin:60px auto}
  @keyframes spin{to{transform:rotate(360deg)}}
  .status{margin-top:12px;font-size:12px;color:#999}
</style>
</head>
<body>
<div id="cap-box">
  <div class="title">Security Verification</div>
  <div class="spinner" id="spinner"></div>
  <div id="captcha-element"></div>
  <div class="status" id="status"></div>
</div>
<script>
  window.__CAPTCHA_STATE__ = {
    ready: false,
    sdkLoaded: false,
    result: null,
    error: null
  };
  var status = document.getElementById('status');
  var spinner = document.getElementById('spinner');
  spinner.style.display = 'block';
  status.textContent = 'Loading SDK...';
</script>
</body>
</html>
"""


def _generate_drag_track(target_x: int) -> list[dict]:
    """生成类似人类的拖动轨迹。"""
    track = []
    current = 0
    while current < target_x * 0.7:
        step = random.randint(3, 8)
        current += step
        if current > target_x:
            current = target_x
        track.append({"x": current, "delay": random.randint(5, 15)})
    while current < target_x:
        step = random.randint(1, 4)
        current += step
        if current > target_x:
            current = target_x
        track.append({"x": current, "delay": random.randint(8, 25)})
    if random.random() < 0.3:
        overshoot = current + random.randint(1, 3)
        track.append({"x": overshoot, "delay": random.randint(20, 40)})
        track.append({"x": current, "delay": random.randint(30, 60)})
    return track


class CaptchaSolver:
    """单个 Playwright 浏览器实例，负责解决一次阿里云滑块验证码。"""

    def __init__(self) -> None:
        self._playwright = None
        self._browser = None
        self._context = None
        self._page = None
        self._started = False

    async def start(self) -> None:
        """启动 Playwright 并加载验证码页面。"""
        if self._started:
            return
        try:
            from playwright.async_api import async_playwright
        except ImportError:
            raise RuntimeError("需安装 playwright: pip install playwright && playwright install chromium")

        logger.info("正在启动 Chromium...")
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-gpu",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled",
                "--ignore-certificate-errors",
                "--disable-web-security",
                "--window-size=420,500",
            ],
        )
        self._context = await self._browser.new_context(
            viewport={"width": 420, "height": 500},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
            ),
            locale="en-US",
            timezone_id="Asia/Shanghai",
        )
        await self._context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {get: () => false});
            Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
            Object.defineProperty(navigator, 'languages', {get: () => ['en-US', 'en']});
            window.chrome = {runtime: {}};
        """)

        self._page = await self._context.new_page()

        # 步骤1: 加载基础 HTML（不含外部脚本，秒级完成）
        logger.info("加载验证码基础页面...")
        await self._page.set_content(CAPTCHA_PAGE_HTML, wait_until="domcontentloaded")
        await asyncio.sleep(1)

        # 步骤2: 动态加载阿里云验证码 SDK（带独立超时和错误处理）
        logger.info("加载阿里云验证码 SDK...")
        sdk_url = "https://o.alicdn.com/captcha-frontend/aliyunCaptcha/AliyunCaptcha.js"
        try:
            await self._page.add_script_tag(url=sdk_url)
            logger.info("SDK 脚本加载完成")
        except Exception as exc:
            # 尝试备用 CDN
            logger.warning("主 CDN 加载失败 (%s)，尝试备用地址...", exc)
            try:
                await self._page.add_script_tag(
                    url="https://o.alicdn.com/captcha-frontend/aliyunCaptcha/AliyunCaptcha.js"
                )
            except Exception as exc2:
                raise RuntimeError(f"阿里云验证码 SDK 加载失败: {exc2}")

        # 等待 SDK 就绪
        try:
            await self._page.wait_for_function(
                "typeof window.initAliyunCaptcha === 'function'",
                timeout=20000,
            )
            logger.info("验证码 SDK 就绪")
        except Exception:
            raise RuntimeError("验证码 SDK 函数未就绪，可能 CDN 连接超时")

        # 步骤3: 注入验证码初始化代码
        logger.info("初始化验证码组件...")
        await self._page.evaluate(f"""
            () => {{
                var status = document.getElementById('status');
                var spinner = document.getElementById('spinner');
                status.textContent = 'Loading captcha...';
                window.initAliyunCaptcha({{
                    sceneId: '{CAPTCHA_SCENE_ID}',
                    prefix: '{CAPTCHA_PREFIX}',
                    mode: '{CAPTCHA_MODE}',
                    region: '{CAPTCHA_REGION}',
                    language: '{CAPTCHA_LANGUAGE}',
                    element: '#captcha-element',
                    timeout: 60000,
                    success: function(data) {{
                        window.__CAPTCHA_STATE__.result = data;
                        status.textContent = 'Success';
                    }},
                    fail: function(reason) {{
                        window.__CAPTCHA_STATE__.error = 'fail:' + String(reason);
                        status.textContent = 'Failed: ' + reason;
                    }},
                    onError: function(err) {{
                        window.__CAPTCHA_STATE__.error = 'error:' + JSON.stringify(err);
                        status.textContent = 'Error';
                    }},
                    onReady: function() {{
                        window.__CAPTCHA_STATE__.ready = true;
                        spinner.style.display = 'none';
                        status.textContent = 'Drag the slider to verify';
                    }}
                }});
            }}
        """)

        # 步骤4: 等待验证码组件就绪（延长超时）
        try:
            await self._page.wait_for_function(
                "window.__CAPTCHA_STATE__.ready === true",
                timeout=45000,
            )
        except Exception:
            # 检查是否 SDK 加载失败
            error_state = await self._page.evaluate("() => window.__CAPTCHA_STATE__.error")
            if error_state:
                raise RuntimeError(f"验证码初始化错误: {error_state}")
            raise RuntimeError("验证码组件就绪超时（45秒），可能是网络问题或 CDN 不可达")

        logger.info("验证码页面就绪")
        self._started = True

    async def _reset_page(self) -> None:
        """重置验证码页面状态。"""
        try:
            await self._page.set_content(CAPTCHA_PAGE_HTML, wait_until="domcontentloaded")
            await asyncio.sleep(0.5)
            # 重新注入 SDK
            sdk_url = "https://o.alicdn.com/captcha-frontend/aliyunCaptcha/AliyunCaptcha.js"
            await self._page.add_script_tag(url=sdk_url)
            await self._page.wait_for_function(
                "typeof window.initAliyunCaptcha === 'function'",
                timeout=15000,
            )
            # 重新初始化验证码
            await self._page.evaluate(f"""
                () => {{
                    window.__CAPTCHA_STATE__.result = null;
                    window.__CAPTCHA_STATE__.error = null;
                    window.__CAPTCHA_STATE__.ready = false;
                    document.getElementById('captcha-element').innerHTML = '';
                    document.getElementById('spinner').style.display = 'block';
                    document.getElementById('status').textContent = 'Loading...';
                    window.initAliyunCaptcha({{
                        sceneId: '{CAPTCHA_SCENE_ID}',
                        prefix: '{CAPTCHA_PREFIX}',
                        mode: '{CAPTCHA_MODE}',
                        region: '{CAPTCHA_REGION}',
                        language: '{CAPTCHA_LANGUAGE}',
                        element: '#captcha-element',
                        timeout: 60000,
                        success: function(data) {{
                            window.__CAPTCHA_STATE__.result = data;
                            document.getElementById('status').textContent = 'Success';
                        }},
                        fail: function(reason) {{
                            window.__CAPTCHA_STATE__.error = 'fail:' + String(reason);
                        }},
                        onError: function(err) {{
                            window.__CAPTCHA_STATE__.error = 'error:' + JSON.stringify(err);
                        }},
                        onReady: function() {{
                            window.__CAPTCHA_STATE__.ready = true;
                            document.getElementById('spinner').style.display = 'none';
                        }}
                    }});
                }}
            """)
            await self._page.wait_for_function(
                "window.__CAPTCHA_STATE__.ready === true", timeout=30000
            )
        except Exception as exc:
            logger.debug("重置页面失败（可忽略）: %s", exc)

    async def solve(self) -> str:
        """解决一次滑块验证码并返回 captcha_verify_param 令牌。"""
        if not self._started:
            await self.start()

        page = self._page

        # 等待滑块元素出现
        slider_appeared = False
        try:
            await page.wait_for_selector(".aliyun-captcha-slider", timeout=10000)
            slider_appeared = True
        except Exception:
            logger.debug("滑块未自动出现，尝试触发")

        if not slider_appeared:
            await self._reset_page()
            try:
                await page.wait_for_selector(".aliyun-captcha-slider", timeout=15000)
                slider_appeared = True
            except Exception:
                raise RuntimeError("无法触发验证码滑块")

        # 计算滑块距离
        distance = await self._calculate_distance()
        if distance <= 0:
            logger.warning("无法计算滑块距离，使用默认值")
            distance = random.randint(180, 260)
        logger.info("滑块距离: %dpx", distance)

        # 获取滑块元素位置并拖动
        slider_box = await page.evaluate("""
            () => {
                const slider = document.querySelector('.aliyun-captcha-slider');
                if (!slider) return null;
                const rect = slider.getBoundingClientRect();
                return {x: rect.x, y: rect.y, width: rect.width, height: rect.height};
            }
        """)

        if slider_box:
            start_x = slider_box["x"] + slider_box["width"] // 2
            start_y = slider_box["y"] + slider_box["height"] // 2
            await page.mouse.move(start_x, start_y)
            await page.mouse.down()
            for step in _generate_drag_track(distance):
                await page.mouse.move(start_x + step["x"], start_y, steps=1)
                await asyncio.sleep(step["delay"] / 1000.0)
            await asyncio.sleep(random.uniform(0.2, 0.4))
            await page.mouse.up()
        else:
            logger.warning("未找到滑块元素")

        # 等待结果
        try:
            await page.wait_for_function(
                "window.__CAPTCHA_STATE__.result !== null || window.__CAPTCHA_STATE__.error !== null",
                timeout=SOLVE_TIMEOUT * 1000,
            )
        except Exception:
            logger.warning("等待验证结果超时")

        state = await page.evaluate("() => window.__CAPTCHA_STATE__")
        if state.get("error"):
            raise RuntimeError(f"验证码失败: {state['error']}")
        result = state.get("result")
        if not result:
            raise RuntimeError("验证码未返回结果")

        token = result.get("captcha_verify_param") or json.dumps(result)
        logger.info("Playwright 验证码解决成功")
        return token

    async def _calculate_distance(self) -> int:
        """计算滑块需要拖动的距离。"""
        try:
            import ddddocr
            import httpx

            images = await self._page.evaluate("""
                () => {
                    const imgs = document.querySelectorAll('#captcha-element img');
                    const found = {shadow: null, back: null};
                    imgs.forEach(img => {
                        const src = img.src || '';
                        if (src.includes('shadow') || src.includes('puzzle') || src.includes('block'))
                            found.shadow = src;
                        else if (src.includes('back') || src.includes('bg') || src.includes('background'))
                            found.back = src;
                    });
                    return found;
                }
            """)

            if images.get("shadow") and images.get("back"):
                async with httpx.AsyncClient(timeout=10) as client:
                    shadow_resp = await client.get(images["shadow"])
                    back_resp = await client.get(images["back"])
                det = ddddocr.DdddOcr(det=False, ocr=False)
                result = det.slide_match(shadow_resp.content, back_resp.content)
                if result and result.get("target"):
                    return int(result["target"][0])
        except ImportError:
            logger.debug("ddddocr 不可用")
        except Exception as exc:
            logger.debug("ddddocr 计算失败: %s", exc)

        # 回退：截图像素对比
        try:
            return await self._calculate_by_screenshot()
        except Exception as exc:
            logger.warning("截图计算失败: %s", exc)
            return 0

    async def _calculate_by_screenshot(self) -> int:
        """回退：通过 Playwright 截图像素对比计算距离。"""
        info = await self._page.evaluate("""
            () => {
                const c = document.querySelector('#captcha-element');
                if (!c) return null;
                const r = c.getBoundingClientRect();
                return {x: r.x, y: r.y, width: r.width, height: r.height};
            }
        """)
        if not info:
            return 0

        screenshot = await self._page.screenshot(clip={
            "x": info["x"], "y": info["y"], "width": info["width"], "height": info["height"],
        })

        import numpy as np
        from PIL import Image

        img = np.array(Image.open(io.BytesIO(screenshot)).convert("L"))
        height, width = img.shape
        y1, y2 = height // 3, 2 * height // 3
        col_diff = np.zeros(width)
        for x in range(1, width):
            col_diff[x] = float(np.sum(np.abs(
                img[y1:y2, x].astype(float) - img[y1:y2, x - 1].astype(float)
            )))
        margin = 20
        if width > margin * 2:
            col_diff[:margin] = 0
            col_diff[-margin:] = 0
        target = int(np.argmax(col_diff))
        distance = target - 40
        return max(30, min(distance, 350))

    async def close(self) -> None:
        """关闭浏览器并释放资源。"""
        if self._context:
            await self._context.close()
            self._context = None
        if self._browser:
            await self._browser.close()
            self._browser = None
        if self._playwright:
            await self._playwright.stop()
            self._playwright = None
        self._started = False
