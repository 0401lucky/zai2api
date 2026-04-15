from __future__ import annotations

import asyncio
from pathlib import Path

import httpx

from zai2api.zai_client import ZAIClient

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
