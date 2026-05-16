from __future__ import annotations

import asyncio
from pathlib import Path

import httpx
import pytest

from zai2api.zai_client import UpstreamCaptchaRequired, ZAIClient

from conftest import make_settings


def test_session_token_is_exchanged_via_auths(tmp_path: Path) -> None:
    settings = make_settings(tmp_path)
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(f"{request.method} {request.url.path}")
        assert request.url.path == "/api/v1/auths/"
        assert request.headers["Authorization"] == "Bearer raw-session-token"
        return httpx.Response(
            200,
            request=request,
            json={
                "token": "fresh-session-token",
                "id": "user-1",
                "name": "测试用户",
                "email": "user@example.com",
                "role": "user",
            },
        )

    async def run_test() -> None:
        client = ZAIClient(settings, zai_session_token="raw-session-token")
        await client._client.aclose()
        client._client = httpx.AsyncClient(
            base_url=settings.zai_base_url,
            transport=httpx.MockTransport(handler),
        )
        try:
            session = await client.ensure_session()
            assert session.token == "fresh-session-token"
            assert session.name == "测试用户"
            assert client.zai_session_token == "fresh-session-token"
            assert calls == ["GET /api/v1/auths/"]

            again = await client.ensure_session()
            assert again.token == "fresh-session-token"
            assert calls == ["GET /api/v1/auths/"]
        finally:
            await client.aclose()

    asyncio.run(run_test())


def test_captcha_error_keeps_upstream_code_and_does_not_refresh_session(tmp_path: Path) -> None:
    settings = make_settings(tmp_path)
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(f"{request.method} {request.url.path}")
        if request.url.path == "/api/v1/auths/":
            return httpx.Response(
                200,
                request=request,
                json={
                    "token": "fresh-session-token",
                    "id": "user-1",
                    "name": "测试用户",
                    "email": "user@example.com",
                    "role": "user",
                },
            )
        if request.url.path == "/api/v1/chats/new":
            return httpx.Response(200, request=request, json={"id": "chat-1"})
        if request.url.path == "/api/v2/chat/completions":
            return httpx.Response(
                200,
                request=request,
                content=(
                    'data: {"type":"chat:completion","data":{"error":'
                    '{"detail":"请刷新页面以更新应用后重试。",'
                    '"code":"FRONTEND_CAPTCHA_REQUIRED",'
                    '"captcha_error_type":"missing_param"}}}\n\n'
                ),
                headers={"content-type": "text/event-stream"},
            )
        raise AssertionError(f"unexpected request: {request.method} {request.url.path}")

    async def run_test() -> None:
        client = ZAIClient(settings, zai_jwt="jwt-token")
        await client._client.aclose()
        client._client = httpx.AsyncClient(
            base_url=settings.zai_base_url,
            transport=httpx.MockTransport(handler),
        )
        try:
            with pytest.raises(UpstreamCaptchaRequired) as exc_info:
                await client.collect_prompt(
                    prompt="hello",
                    model="glm-4.7",
                    enable_thinking=True,
                    auto_web_search=False,
                )
            message = str(exc_info.value)
            assert "Z.ai 上游要求浏览器验证码" in message
            assert "FRONTEND_CAPTCHA_REQUIRED" in message
            assert "captcha_error_type=missing_param" in message
            assert calls == [
                "GET /api/v1/auths/",
                "POST /api/v1/chats/new",
                "POST /api/v2/chat/completions",
            ]
        finally:
            await client.aclose()

    asyncio.run(run_test())
