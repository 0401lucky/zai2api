from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from zai2api.config import Settings
from zai2api.db import Database
from zai2api.server import create_app
from zai2api.zai_client import UpstreamChunk


class ErroringStreamPool:
    def __init__(self, *, mode: str):
        self.mode = mode

    async def collect_prompt(self, **_: object):
        raise AssertionError("collect_prompt should not be used in streaming tests")

    async def stream_prompt(self, **_: object):
        if self.mode == "chunk_error":
            yield UpstreamChunk(phase=None, text="", error="upstream said no")
            return
        raise RuntimeError("upstream stream exploded")


def make_settings(tmp_path: Path) -> Settings:
    return Settings(
        host="127.0.0.1",
        port=8000,
        log_level="info",
        zai_base_url="https://chat.z.ai",
        zai_jwt=None,
        zai_session_token=None,
        default_model="glm-5",
        request_timeout=120.0,
        database_path=str(tmp_path / "state.db"),
        panel_password_env=None,
        api_password_env=None,
        admin_cookie_name="zai2api_admin_session",
        admin_session_ttl_hours=24,
        admin_cookie_secure=False,
    )


def test_chat_completion_stream_reports_error_in_band(tmp_path: Path) -> None:
    settings = make_settings(tmp_path)
    app = create_app(settings, prompt_pool=ErroringStreamPool(mode="chunk_error"))

    with TestClient(app) as client:
        response = client.post(
            "/v1/chat/completions",
            json={"model": "glm-5", "stream": True, "messages": [{"role": "user", "content": "hi"}]},
        )

    assert response.status_code == 200
    assert '"type": "upstream_error"' in response.text
    assert '"message": "upstream said no"' in response.text
    assert "data: [DONE]" in response.text
    logs = Database(settings.database_path).list_logs(limit=20)
    assert any(item.message == "Streaming chat completion request failed" for item in logs)


def test_responses_stream_reports_runtime_error_in_band(tmp_path: Path) -> None:
    settings = make_settings(tmp_path)
    app = create_app(settings, prompt_pool=ErroringStreamPool(mode="runtime_error"))

    with TestClient(app) as client:
        response = client.post(
            "/v1/responses",
            json={"model": "glm-5", "stream": True, "input": "hi"},
        )

    assert response.status_code == 200
    assert '"type": "response.failed"' in response.text
    assert '"status": "failed"' in response.text
    assert '"message": "upstream stream exploded"' in response.text
    assert "data: [DONE]" in response.text
    logs = Database(settings.database_path).list_logs(limit=20)
    assert any(item.message == "Streaming responses request failed" for item in logs)
