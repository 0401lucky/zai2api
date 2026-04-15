from __future__ import annotations

from pathlib import Path

import httpx
from fastapi.testclient import TestClient

from zai2api.server import create_app

from conftest import make_settings


def make_http_status_error(
    *,
    method: str = "POST",
    url: str = "https://chat.z.ai/api/v2/chat/completions",
    status_code: int = 405,
) -> httpx.HTTPStatusError:
    request = httpx.Request(method, url)
    response = httpx.Response(status_code, request=request)
    return httpx.HTTPStatusError("boom", request=request, response=response)


class FailingCollectPool:
    async def collect_prompt(self, **_: object):
        raise make_http_status_error()

    async def stream_prompt(self, **_: object):
        if False:
            yield None


class FailingStreamPool:
    async def collect_prompt(self, **_: object):
        raise AssertionError("collect_prompt should not be used in streaming tests")

    async def stream_prompt(self, **_: object):
        raise make_http_status_error()
        if False:
            yield None


def test_chat_completion_maps_upstream_http_status_to_502(tmp_path: Path) -> None:
    settings = make_settings(tmp_path)
    app = create_app(settings, prompt_pool=FailingCollectPool())

    with TestClient(app) as client:
        response = client.post(
            "/v1/chat/completions",
            json={"model": "glm-5", "messages": [{"role": "user", "content": "hi"}]},
        )

    assert response.status_code == 502
    assert response.json()["detail"] == "上游接口错误: POST /api/v2/chat/completions -> HTTP 405"


def test_responses_maps_upstream_http_status_to_502(tmp_path: Path) -> None:
    settings = make_settings(tmp_path)
    app = create_app(settings, prompt_pool=FailingCollectPool())

    with TestClient(app) as client:
        response = client.post(
            "/v1/responses",
            json={"model": "glm-5", "input": "hi"},
        )

    assert response.status_code == 502
    assert response.json()["detail"] == "上游接口错误: POST /api/v2/chat/completions -> HTTP 405"


def test_chat_completion_stream_reports_upstream_http_status_in_band(tmp_path: Path) -> None:
    settings = make_settings(tmp_path)
    app = create_app(settings, prompt_pool=FailingStreamPool())

    with TestClient(app) as client:
        response = client.post(
            "/v1/chat/completions",
            json={"model": "glm-5", "stream": True, "messages": [{"role": "user", "content": "hi"}]},
        )

    assert response.status_code == 200
    assert '"type": "upstream_error"' in response.text
    assert '"message": "上游接口错误: POST /api/v2/chat/completions -> HTTP 405"' in response.text
    assert "data: [DONE]" in response.text


def test_responses_stream_reports_upstream_http_status_in_band(tmp_path: Path) -> None:
    settings = make_settings(tmp_path)
    app = create_app(settings, prompt_pool=FailingStreamPool())

    with TestClient(app) as client:
        response = client.post(
            "/v1/responses",
            json={"model": "glm-5", "stream": True, "input": "hi"},
        )

    assert response.status_code == 200
    assert '"type": "response.failed"' in response.text
    assert '"status": "failed"' in response.text
    assert '"message": "上游接口错误: POST /api/v2/chat/completions -> HTTP 405"' in response.text
    assert "data: [DONE]" in response.text
