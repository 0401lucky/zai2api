"""
Z.ai 阿里云滑块验证码令牌供应模块。

提供可插拔的验证码令牌供应商接口，支持多种后端实现：

- ``NoopCaptchaProvider``  —— 不提供令牌（默认，尝试通过浏览器指纹规避验证码）
- ``CapSolverProvider``     —— 通过 CapSolver API 获取令牌（适合 Docker/Zeabur 部署）
- ``PlaywrightProvider``    —— 本地 Playwright 浏览器自动解决（适合桌面部署）

用法：
    from .captcha import create_captcha_provider
    provider = create_captcha_provider(settings)
    await provider.start()
    token = await provider.get_token()
    # token 为 str 或 None（None 表示无令牌可用）
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 抽象供应商接口
# ---------------------------------------------------------------------------


class CaptchaProvider(ABC):
    """验证码令牌供应商抽象基类。"""

    @abstractmethod
    async def start(self) -> None:
        """初始化供应商（启动后台任务等）。"""

    @abstractmethod
    async def stop(self) -> None:
        """清理资源。"""

    @abstractmethod
    async def get_token(self) -> str | None:
        """获取一个有效的 captcha_verify_param 令牌，无可用令牌时返回 None。"""


# ---------------------------------------------------------------------------
# 空供应商（默认）
# ---------------------------------------------------------------------------


class NoopCaptchaProvider(CaptchaProvider):
    """空供应商 —— 始终返回 None。

    此模式下依赖改进后的浏览器指纹参数来避免触发验证码。
    如果 Z.ai 仍然要求验证码，请配置其他供应商（如 CapSolver）。
    """

    async def start(self) -> None:
        pass

    async def stop(self) -> None:
        pass

    async def get_token(self) -> str | None:
        return None


# ---------------------------------------------------------------------------
# CapSolver 供应商
# ---------------------------------------------------------------------------

# CapSolver API 文档: https://docs.capsolver.com/
CAPSOLVER_CREATE_TASK_URL = "https://api.capsolver.com/createTask"
CAPSOLVER_GET_TASK_URL = "https://api.capsolver.com/getTaskResult"
CAPSOLVER_POLL_INTERVAL = 2.0  # 轮询间隔（秒）
CAPSOLVER_TIMEOUT = 60.0  # 总超时（秒）

# Z.ai 验证码参数
CAPTCHA_APP_ID = "no8xfe"  # Aliyun captcha prefix
CAPTCHA_SCENE_ID = "didk33e0"  # chat.z.ai 生产环境


class CapSolverProvider(CaptchaProvider):
    """通过 CapSolver 外部服务获取验证码令牌。

    需要设置环境变量 ``CAPSOLVER_API_KEY``。

    CapSolver 支持阿里云滑块验证码（AliyunCaptchaTask），
    通过 HTTP API 提交任务并轮询结果，无需本地浏览器。
    适合 Docker / Zeabur / 无头服务器部署。

    费用参考：约 $0.5/1000 次（以 CapSolver 官网为准）。
    """

    def __init__(self, api_key: str) -> None:
        self._api_key = api_key
        self._started = False

    async def start(self) -> None:
        if self._started:
            return
        # 简单连通性检查
        try:
            import httpx

            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    CAPSOLVER_CREATE_TASK_URL,
                    json={
                        "clientKey": self._api_key,
                        "task": {
                            "type": "AliyunCaptchaTask",
                            "websiteURL": "https://chat.z.ai",
                            "captchaAppId": CAPTCHA_APP_ID,
                            "captchaSceneId": CAPTCHA_SCENE_ID,
                        },
                    },
                )
                data = resp.json()
                if data.get("errorId") not in (0, None):
                    logger.warning("CapSolver 连通性检查失败: %s", data.get("errorDescription"))
                else:
                    logger.info("CapSolver 供应商就绪")
        except Exception as exc:
            logger.warning("CapSolver 初始化检查失败: %s", exc)
        self._started = True

    async def stop(self) -> None:
        self._started = False

    async def get_token(self) -> str | None:
        if not self._started:
            await self.start()

        try:
            import httpx
        except ImportError:
            logger.error("CapSolver 供应商需要 httpx")
            return None

        try:
            async with httpx.AsyncClient(timeout=CAPSOLVER_TIMEOUT + 10) as client:
                # 1. 创建任务
                create_resp = await client.post(
                    CAPSOLVER_CREATE_TASK_URL,
                    json={
                        "clientKey": self._api_key,
                        "task": {
                            "type": "AliyunCaptchaTask",
                            "websiteURL": "https://chat.z.ai",
                            "captchaAppId": CAPTCHA_APP_ID,
                            "captchaSceneId": CAPTCHA_SCENE_ID,
                        },
                    },
                )
                create_data = create_resp.json()

                if create_data.get("errorId") != 0:
                    logger.warning("CapSolver 创建任务失败: %s", create_data.get("errorDescription"))
                    return None

                task_id = create_data.get("taskId")
                if not task_id:
                    logger.warning("CapSolver 未返回 taskId")
                    return None

                # 2. 轮询结果
                deadline = time.time() + CAPSOLVER_TIMEOUT
                while time.time() < deadline:
                    await asyncio.sleep(CAPSOLVER_POLL_INTERVAL)
                    result_resp = await client.post(
                        CAPSOLVER_GET_TASK_URL,
                        json={"clientKey": self._api_key, "taskId": task_id},
                    )
                    result_data = result_resp.json()

                    if result_data.get("errorId") != 0:
                        logger.warning("CapSolver 查询结果失败: %s", result_data.get("errorDescription"))
                        return None

                    status = result_data.get("status", "")
                    if status == "ready":
                        solution = result_data.get("solution", {})
                        # CapSolver 返回的 token 字段名可能为 captchaVerifyParam 或 token
                        token = (
                            solution.get("captchaVerifyParam")
                            or solution.get("token")
                            or json.dumps(solution)
                        )
                        logger.info("CapSolver 令牌获取成功")
                        return token

                logger.warning("CapSolver 轮询超时（%.0fs）", CAPSOLVER_TIMEOUT)
                return None

        except Exception as exc:
            logger.warning("CapSolver 令牌获取异常: %s", exc)
            return None


# ---------------------------------------------------------------------------
# Playwright 供应商（仅桌面/本地使用）
# ---------------------------------------------------------------------------


class PlaywrightProvider(CaptchaProvider):
    """通过本地 Playwright 浏览器自动解决验证码。

    需要安装: pip install playwright && playwright install chromium
    不适合 Docker 部署（镜像体积大、内存占用高）。
    """

    def __init__(self) -> None:
        self._solver = None  # CaptchaSolver 实例，惰性加载
        self._started = False

    async def start(self) -> None:
        if self._started:
            return
        try:
            from ._captcha_playwright import CaptchaSolver

            self._solver = CaptchaSolver()
            await self._solver.start()
            logger.info("Playwright 验证码供应商就绪")
            self._started = True
        except ImportError:
            logger.warning("Playwright 未安装，无法使用本地验证码解决")
        except Exception as exc:
            logger.warning("Playwright 验证码供应商初始化失败: %s", exc)

    async def stop(self) -> None:
        if self._solver:
            await self._solver.close()
            self._solver = None
        self._started = False

    async def get_token(self) -> str | None:
        if not self._started or self._solver is None:
            return None
        try:
            return await self._solver.solve()
        except Exception as exc:
            logger.warning("Playwright 验证码解决失败: %s", exc)
            return None


# ---------------------------------------------------------------------------
# 工厂函数
# ---------------------------------------------------------------------------


def create_captcha_provider(settings) -> CaptchaProvider:  # type: ignore[no-untyped-def]
    """根据配置创建验证码供应商。

    优先级：
    1. ``CAPSOLVER_API_KEY`` 环境变量 → CapSolverProvider
    2. ``CAPTCHA_PROVIDER=playwright`` → PlaywrightProvider（本地）
    3. 默认 → NoopCaptchaProvider（不提供令牌，依赖指纹规避）
    """
    capsolver_key = os.getenv("CAPSOLVER_API_KEY", "").strip()
    if capsolver_key:
        logger.info("使用 CapSolver 验证码供应商")
        return CapSolverProvider(capsolver_key)

    provider = os.getenv("CAPTCHA_PROVIDER", "").strip().lower()
    if provider == "playwright":
        logger.info("使用 Playwright 验证码供应商")
        return PlaywrightProvider()

    logger.info("验证码令牌供应已禁用（NoopCaptchaProvider），依赖浏览器指纹规避验证码")
    return NoopCaptchaProvider()
