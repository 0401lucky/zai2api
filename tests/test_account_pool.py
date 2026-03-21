from __future__ import annotations

import asyncio
from pathlib import Path

import httpx

from zai2api.account_pool import AccountPool
from zai2api.config import Settings
from zai2api.db import Database
from zai2api.zai_client import SessionState, UpstreamResult


class FakeClient:
    def __init__(self, *, name: str, answer: str, fail_status: int | None = None):
        self._name = name
        self._answer = answer
        self._fail_status = fail_status

    async def ensure_session(self, force_refresh: bool = False) -> SessionState:
        return SessionState(
            token=f"session-{self._name}",
            user_id=f"user-{self._name}",
            name=self._name,
            email=f"{self._name}@example.com",
            role="user",
        )

    async def verify_completion_version(self) -> int:
        return 2

    async def collect_prompt(
        self,
        *,
        prompt: str,
        model: str,
        enable_thinking: bool,
        auto_web_search: bool,
    ) -> UpstreamResult:
        if self._fail_status is not None:
            request = httpx.Request("POST", "https://example.com")
            response = httpx.Response(self._fail_status, request=request)
            raise httpx.HTTPStatusError("boom", request=request, response=response)
        return UpstreamResult(
            answer_text=f"{self._answer}:{prompt}",
            reasoning_text="reasoning",
            usage={"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
            finish_reason="stop",
        )

    async def stream_prompt(self, **_: object):
        if False:
            yield None

    async def aclose(self) -> None:
        return None


def make_settings(tmp_path: Path, **overrides: object) -> Settings:
    base = Settings(
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
    for key, value in overrides.items():
        setattr(base, key, value)
    return base


def test_account_pool_rotates_enabled_accounts(tmp_path: Path) -> None:
    settings = make_settings(tmp_path)
    db = Database(settings.database_path)
    db.initialize()
    first = db.upsert_account(
        jwt="jwt-a",
        session_token="token-a",
        user_id="user-a",
        email="a@example.com",
        name="a",
    )
    second = db.upsert_account(
        jwt="jwt-b",
        session_token="token-b",
        user_id="user-b",
        email="b@example.com",
        name="b",
    )

    def client_factory(jwt: str | None, session_token: str | None) -> FakeClient:
        if session_token == "token-a":
            return FakeClient(name="a", answer="alpha")
        if session_token == "token-b":
            return FakeClient(name="b", answer="beta")
        raise AssertionError(f"unexpected session token: {session_token}")

    pool = AccountPool(settings, db, client_factory=client_factory)
    first_result = asyncio.run(
        pool.collect_prompt(
            prompt="hello",
            model="glm-5",
            enable_thinking=True,
            auto_web_search=False,
        )
    )
    second_result = asyncio.run(
        pool.collect_prompt(
            prompt="hello",
            model="glm-5",
            enable_thinking=True,
            auto_web_search=False,
        )
    )

    assert first_result.answer_text == "alpha:hello"
    assert second_result.answer_text == "beta:hello"
    assert db.get_account(first.id).status == "active"
    assert db.get_account(second.id).status == "active"


def test_account_pool_disables_unauthorized_account(tmp_path: Path) -> None:
    settings = make_settings(tmp_path)
    db = Database(settings.database_path)
    db.initialize()
    bad = db.upsert_account(
        jwt="jwt-bad",
        session_token="token-bad",
        user_id="user-bad",
        email="bad@example.com",
        name="bad",
    )
    db.upsert_account(
        jwt="jwt-good",
        session_token="token-good",
        user_id="user-good",
        email="good@example.com",
        name="good",
    )

    def client_factory(jwt: str | None, session_token: str | None) -> FakeClient:
        if session_token == "token-bad":
            return FakeClient(name="bad", answer="bad", fail_status=401)
        if session_token == "token-good":
            return FakeClient(name="good", answer="good")
        raise AssertionError(f"unexpected session token: {session_token}")

    pool = AccountPool(settings, db, client_factory=client_factory)
    result = asyncio.run(
        pool.collect_prompt(
            prompt="hello",
            model="glm-5",
            enable_thinking=True,
            auto_web_search=False,
        )
    )

    bad_account = db.get_account(bad.id)
    assert result.answer_text == "good:hello"
    assert bad_account is not None
    assert bad_account.enabled is False
    assert bad_account.status == "invalid"


def test_register_jwt_persists_account(tmp_path: Path) -> None:
    settings = make_settings(tmp_path)
    db = Database(settings.database_path)
    db.initialize()

    def client_factory(jwt: str | None, session_token: str | None) -> FakeClient:
        assert jwt == "fresh-jwt"
        return FakeClient(name="fresh", answer="fresh")

    pool = AccountPool(settings, db, client_factory=client_factory)
    account = asyncio.run(pool.register_jwt("fresh-jwt"))

    assert account.user_id == "user-fresh"
    assert account.session_token == "session-fresh"
    assert db.count_accounts() == 1


def test_check_account_can_reenable_account(tmp_path: Path) -> None:
    settings = make_settings(tmp_path)
    db = Database(settings.database_path)
    db.initialize()
    account = db.upsert_account(
        jwt="jwt-a",
        session_token="token-a",
        user_id="user-a",
        email="a@example.com",
        name="a",
        enabled=False,
        status="invalid",
        last_error="HTTP 401",
        failure_count=2,
    )

    def client_factory(jwt: str | None, session_token: str | None) -> FakeClient:
        return FakeClient(name="a", answer="alpha")

    pool = AccountPool(settings, db, client_factory=client_factory)
    updated = asyncio.run(pool.check_account(account.id))

    assert updated.enabled is True
    assert updated.status == "active"
    assert updated.failure_count == 0
