from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Callable, Protocol

import httpx

from .config import Settings
from .db import AccountRecord, Database
from .zai_client import SessionState, UpstreamResult, ZAIClient


class SupportsZAIClient(Protocol):
    async def ensure_session(self, force_refresh: bool = False) -> SessionState: ...

    async def verify_completion_version(self) -> int: ...

    async def collect_prompt(
        self,
        *,
        prompt: str,
        model: str,
        enable_thinking: bool,
        auto_web_search: bool,
    ) -> UpstreamResult: ...

    async def stream_prompt(
        self,
        *,
        prompt: str,
        model: str,
        enable_thinking: bool,
        auto_web_search: bool,
    ): ...

    async def aclose(self) -> None: ...


@dataclass(slots=True)
class RoutedAccount:
    account_id: int | None
    jwt: str | None
    session_token: str | None
    label: str
    persistent: bool


ClientFactory = Callable[[str | None, str | None], SupportsZAIClient]


class AccountPool:
    def __init__(
        self,
        settings: Settings,
        db: Database,
        *,
        client_factory: ClientFactory | None = None,
    ):
        self.settings = settings
        self.db = db
        self._lock = asyncio.Lock()
        self._cursor = 0
        self._client_factory = client_factory or self._default_client_factory

    async def register_jwt(self, jwt: str) -> AccountRecord:
        client = self._client_factory(jwt, None)
        try:
            session = await client.ensure_session(force_refresh=True)
            completion_version = await client.verify_completion_version()
        finally:
            await client.aclose()

        if completion_version != 2:
            raise RuntimeError(f"Unsupported Z.ai completion_version={completion_version}")

        account = self.db.upsert_account(
            jwt=jwt,
            session_token=session.token,
            user_id=session.user_id,
            email=session.email,
            name=session.name,
            enabled=True,
            status="active",
            last_error=None,
            failure_count=0,
        )
        self.db.add_log(
            level="info",
            category="accounts",
            message="Registered account from JWT",
            details={"account_id": account.id, "email": account.email, "user_id": account.user_id},
        )
        return account

    def list_accounts(self) -> list[AccountRecord]:
        return self.db.list_accounts()


    def get_account(self, account_id: int) -> AccountRecord | None:
        return self.db.get_account(account_id)

    def set_account_enabled(self, account_id: int, enabled: bool) -> AccountRecord:
        account = self.db.get_account(account_id)
        if account is None:
            raise RuntimeError(f"Account {account_id} not found")
        self.db.set_account_enabled(account_id, enabled)
        self.db.add_log(
            level="info",
            category="accounts",
            message="Updated account enabled state",
            details={"account_id": account_id, "enabled": enabled},
        )
        updated = self.db.get_account(account_id)
        if updated is None:
            raise RuntimeError(f"Account {account_id} not found")
        return updated

    async def check_account(self, account_id: int) -> AccountRecord:
        account = self.db.get_account(account_id)
        if account is None:
            raise RuntimeError(f"Account {account_id} not found")

        routed = RoutedAccount(
            account_id=account.id,
            jwt=account.jwt,
            session_token=account.session_token,
            label=account.email or account.user_id or f"account-{account.id}",
            persistent=True,
        )
        client = self._client_factory(account.jwt, account.session_token)
        try:
            session = await client.ensure_session(force_refresh=bool(account.jwt))
            completion_version = await client.verify_completion_version()
            if completion_version != 2:
                raise RuntimeError(f"Unsupported Z.ai completion_version={completion_version}")
            self.db.mark_account_success(
                account.id,
                session_token=session.token,
                name=session.name,
                email=session.email,
            )
            self.db.add_log(
                level="info",
                category="accounts",
                message="Account health check succeeded",
                details={"account_id": account.id, "email": session.email},
            )
        except Exception as exc:
            await self._handle_failure(routed, exc)
        finally:
            await client.aclose()

        updated = self.db.get_account(account_id)
        if updated is None:
            raise RuntimeError(f"Account {account_id} not found")
        return updated

    async def check_all_accounts(self) -> list[AccountRecord]:
        results: list[AccountRecord] = []
        for account in self.db.list_accounts(enabled_only=True):
            results.append(await self.check_account(account.id))
        return results

    async def collect_prompt(
        self,
        *,
        prompt: str,
        model: str,
        enable_thinking: bool,
        auto_web_search: bool,
    ) -> UpstreamResult:
        candidates = await self._candidate_accounts()
        if not candidates:
            raise RuntimeError("No active accounts available")

        last_error: Exception | None = None
        for routed in candidates:
            client = self._client_factory(routed.jwt, routed.session_token)
            try:
                result = await client.collect_prompt(
                    prompt=prompt,
                    model=model,
                    enable_thinking=enable_thinking,
                    auto_web_search=auto_web_search,
                )
                await self._mark_success(routed, client)
                return result
            except Exception as exc:
                last_error = exc
                await self._handle_failure(routed, exc)
            finally:
                await client.aclose()

        if last_error is not None:
            raise last_error
        raise RuntimeError("No active accounts available")

    async def stream_prompt(
        self,
        *,
        prompt: str,
        model: str,
        enable_thinking: bool,
        auto_web_search: bool,
    ):
        candidates = await self._candidate_accounts()
        if not candidates:
            raise RuntimeError("No active accounts available")

        routed = candidates[0]
        client = self._client_factory(routed.jwt, routed.session_token)
        try:
            async for chunk in client.stream_prompt(
                prompt=prompt,
                model=model,
                enable_thinking=enable_thinking,
                auto_web_search=auto_web_search,
            ):
                yield chunk
            await self._mark_success(routed, client)
        except Exception as exc:
            await self._handle_failure(routed, exc)
            raise
        finally:
            await client.aclose()

    async def _candidate_accounts(self) -> list[RoutedAccount]:
        persisted = [
            RoutedAccount(
                account_id=account.id,
                jwt=account.jwt,
                session_token=account.session_token,
                label=account.email or account.user_id or f"account-{account.id}",
                persistent=True,
            )
            for account in self.db.list_accounts(enabled_only=True, healthy_only=True)
        ]

        if persisted:
            async with self._lock:
                start = self._cursor % len(persisted)
                ordered = persisted[start:] + persisted[:start]
                self._cursor = (start + 1) % len(persisted)
            return ordered

        if self.settings.zai_jwt or self.settings.zai_session_token:
            return [
                RoutedAccount(
                    account_id=None,
                    jwt=self.settings.zai_jwt,
                    session_token=self.settings.zai_session_token,
                    label="env-bootstrap",
                    persistent=False,
                )
            ]

        return []

    async def _mark_success(self, routed: RoutedAccount, client: SupportsZAIClient) -> None:
        if not routed.persistent or routed.account_id is None:
            return
        session = await client.ensure_session()
        self.db.mark_account_success(
            routed.account_id,
            session_token=session.token,
            name=session.name,
            email=session.email,
        )

    async def _handle_failure(self, routed: RoutedAccount, error: Exception) -> None:
        disable = self._should_disable(error)
        error_text = self._describe_error(error)
        self.db.add_log(
            level="warning",
            category="accounts",
            message="Account request failed",
            details={"account": routed.label, "disable": disable, "error": error_text},
        )
        if routed.persistent and routed.account_id is not None:
            self.db.mark_account_failure(routed.account_id, error=error_text, disable=disable)

    def _default_client_factory(self, jwt: str | None, session_token: str | None) -> SupportsZAIClient:
        return ZAIClient(self.settings, zai_jwt=jwt, zai_session_token=session_token)

    def _should_disable(self, error: Exception) -> bool:
        if isinstance(error, httpx.HTTPStatusError):
            return error.response.status_code == 401
        if isinstance(error, RuntimeError):
            return "Missing ZAI_JWT or ZAI_SESSION_TOKEN" in str(error)
        return False

    def _describe_error(self, error: Exception) -> str:
        if isinstance(error, httpx.HTTPStatusError):
            return f"HTTP {error.response.status_code}"
        return str(error)
