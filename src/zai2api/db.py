from __future__ import annotations

from dataclasses import dataclass
import json
import os
from pathlib import Path
import sqlite3
import time
from typing import Any

from .config import DEFAULT_LOG_RETENTION_DAYS


LOG_RETENTION_DAYS_KEY = "log_retention_days"


@dataclass(slots=True)
class LogRecord:
    id: int
    created_at: int
    level: str
    category: str
    message: str
    details: dict[str, Any] | None


@dataclass(slots=True)
class AccountRecord:
    id: int
    jwt: str | None
    session_token: str | None
    user_id: str | None
    email: str | None
    name: str | None
    enabled: bool
    status: str
    last_checked_at: int | None
    last_error: str | None
    failure_count: int
    created_at: int
    updated_at: int


class Database:
    def __init__(self, path: str):
        self.path = Path(path)

    def initialize(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS admin_sessions (
                    id TEXT PRIMARY KEY,
                    created_at INTEGER NOT NULL,
                    expires_at INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at INTEGER NOT NULL,
                    level TEXT NOT NULL,
                    category TEXT NOT NULL,
                    message TEXT NOT NULL,
                    details TEXT
                );

                CREATE TABLE IF NOT EXISTS accounts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    jwt TEXT,
                    session_token TEXT,
                    user_id TEXT,
                    email TEXT,
                    name TEXT,
                    enabled INTEGER NOT NULL DEFAULT 1,
                    status TEXT NOT NULL DEFAULT 'unknown',
                    last_checked_at INTEGER,
                    last_error TEXT,
                    failure_count INTEGER NOT NULL DEFAULT 0,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at DESC);
                CREATE INDEX IF NOT EXISTS idx_accounts_enabled ON accounts(enabled);
                CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
                CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
                CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);
                CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at);
                """
            )

    def get_setting(self, key: str) -> str | None:
        with self._connect() as conn:
            row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
        if row is None:
            return None
        return str(row["value"])

    def set_setting(self, key: str, value: str) -> None:
        now = int(time.time())
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO settings(key, value, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
                """,
                (key, value, now),
            )

    def delete_setting(self, key: str) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM settings WHERE key = ?", (key,))

    def create_admin_session(self, session_id: str, expires_at: int) -> None:
        now = int(time.time())
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO admin_sessions(id, created_at, expires_at) VALUES (?, ?, ?)",
                (session_id, now, expires_at),
            )

    def get_admin_session(self, session_id: str) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT id, created_at, expires_at FROM admin_sessions WHERE id = ?",
                (session_id,),
            ).fetchone()
        if row is None:
            return None
        return dict(row)

    def delete_admin_session(self, session_id: str) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM admin_sessions WHERE id = ?", (session_id,))

    def delete_expired_admin_sessions(self, now: int | None = None) -> int:
        cutoff = int(time.time()) if now is None else now
        with self._connect() as conn:
            cursor = conn.execute(
                "DELETE FROM admin_sessions WHERE expires_at <= ?",
                (cutoff,),
            )
            return int(cursor.rowcount or 0)

    def upsert_account(
        self,
        *,
        jwt: str | None,
        session_token: str | None,
        user_id: str | None,
        email: str | None,
        name: str | None,
        enabled: bool = True,
        status: str = "active",
        last_checked_at: int | None = None,
        last_error: str | None = None,
        failure_count: int = 0,
    ) -> AccountRecord:
        now = int(time.time())
        checked_at = last_checked_at if last_checked_at is not None else now
        with self._connect() as conn:
            existing = self._find_existing_account_row(conn, user_id=user_id, email=email)
            if existing is None:
                cursor = conn.execute(
                    """
                    INSERT INTO accounts(
                        jwt, session_token, user_id, email, name, enabled, status,
                        last_checked_at, last_error, failure_count, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        jwt,
                        session_token,
                        user_id,
                        email,
                        name,
                        int(enabled),
                        status,
                        checked_at,
                        last_error,
                        failure_count,
                        now,
                        now,
                    ),
                )
                account_id = int(cursor.lastrowid)
            else:
                account_id = int(existing["id"])
                conn.execute(
                    """
                    UPDATE accounts
                    SET jwt = ?, session_token = ?, user_id = ?, email = ?, name = ?,
                        enabled = ?, status = ?, last_checked_at = ?, last_error = ?,
                        failure_count = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (
                        jwt,
                        session_token,
                        user_id,
                        email,
                        name,
                        int(enabled),
                        status,
                        checked_at,
                        last_error,
                        failure_count,
                        now,
                        account_id,
                    ),
                )
            row = conn.execute("SELECT * FROM accounts WHERE id = ?", (account_id,)).fetchone()
        return self._row_to_account(row)

    def list_accounts(
        self,
        *,
        enabled_only: bool = False,
        healthy_only: bool = False,
    ) -> list[AccountRecord]:
        clauses: list[str] = []
        params: list[Any] = []
        if enabled_only:
            clauses.append("enabled = 1")
        if healthy_only:
            clauses.append("status IN ('active', 'unknown')")
            clauses.append("(session_token IS NOT NULL OR jwt IS NOT NULL)")
        where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        query = f"SELECT * FROM accounts {where_sql} ORDER BY id ASC"
        with self._connect() as conn:
            rows = conn.execute(query, params).fetchall()
        return [self._row_to_account(row) for row in rows]

    def count_accounts(self, *, enabled_only: bool = False) -> int:
        query = "SELECT COUNT(*) AS total FROM accounts"
        if enabled_only:
            query += " WHERE enabled = 1"
        with self._connect() as conn:
            row = conn.execute(query).fetchone()
        return int(row["total"])

    def get_account(self, account_id: int) -> AccountRecord | None:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM accounts WHERE id = ?", (account_id,)).fetchone()
        if row is None:
            return None
        return self._row_to_account(row)

    def set_account_enabled(self, account_id: int, enabled: bool) -> None:
        now = int(time.time())
        status = "active" if enabled else "disabled"
        with self._connect() as conn:
            conn.execute(
                "UPDATE accounts SET enabled = ?, status = ?, updated_at = ? WHERE id = ?",
                (int(enabled), status, now, account_id),
            )

    def mark_account_success(
        self,
        account_id: int,
        *,
        session_token: str | None = None,
        name: str | None = None,
        email: str | None = None,
    ) -> None:
        now = int(time.time())
        with self._connect() as conn:
            existing = conn.execute(
                "SELECT session_token, name, email FROM accounts WHERE id = ?",
                (account_id,),
            ).fetchone()
            if existing is None:
                return
            conn.execute(
                """
                UPDATE accounts
                SET session_token = ?, name = ?, email = ?, enabled = 1, status = 'active',
                    last_checked_at = ?, last_error = NULL, failure_count = 0, updated_at = ?
                WHERE id = ?
                """,
                (
                    session_token if session_token is not None else existing["session_token"],
                    name if name is not None else existing["name"],
                    email if email is not None else existing["email"],
                    now,
                    now,
                    account_id,
                ),
            )

    def mark_account_failure(self, account_id: int, *, error: str, disable: bool) -> None:
        now = int(time.time())
        status = "invalid" if disable else "error"
        with self._connect() as conn:
            row = conn.execute(
                "SELECT failure_count FROM accounts WHERE id = ?",
                (account_id,),
            ).fetchone()
            if row is None:
                return
            failure_count = int(row["failure_count"] or 0) + 1
            conn.execute(
                """
                UPDATE accounts
                SET enabled = CASE WHEN ? THEN 0 ELSE enabled END,
                    status = ?,
                    last_checked_at = ?,
                    last_error = ?,
                    failure_count = ?,
                    updated_at = ?
                WHERE id = ?
                """,
                (int(disable), status, now, error, failure_count, now, account_id),
            )

    def add_log(
        self,
        *,
        level: str,
        category: str,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        now = int(time.time())
        cutoff = self._log_retention_cutoff(now)
        encoded_details = json.dumps(details, ensure_ascii=False) if details is not None else None
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO logs(created_at, level, category, message, details) VALUES (?, ?, ?, ?, ?)",
                (now, level, category, message, encoded_details),
            )
            self._delete_logs_before_conn(conn, cutoff)

    def list_logs(self, limit: int = 100) -> list[LogRecord]:
        cutoff = self._log_retention_cutoff()
        with self._connect() as conn:
            self._delete_logs_before_conn(conn, cutoff)
            rows = conn.execute(
                "SELECT id, created_at, level, category, message, details FROM logs ORDER BY id DESC LIMIT ?",
                (limit,),
            ).fetchall()
        records: list[LogRecord] = []
        for row in rows:
            records.append(
                LogRecord(
                    id=int(row["id"]),
                    created_at=int(row["created_at"]),
                    level=str(row["level"]),
                    category=str(row["category"]),
                    message=str(row["message"]),
                    details=json.loads(row["details"]) if row["details"] else None,
                )
            )
        return records

    def delete_logs_before(self, cutoff: int) -> int:
        with self._connect() as conn:
            return self._delete_logs_before_conn(conn, cutoff)

    def _find_existing_account_row(
        self,
        conn: sqlite3.Connection,
        *,
        user_id: str | None,
        email: str | None,
    ) -> sqlite3.Row | None:
        if user_id:
            row = conn.execute("SELECT * FROM accounts WHERE user_id = ?", (user_id,)).fetchone()
            if row is not None:
                return row
        if email:
            row = conn.execute("SELECT * FROM accounts WHERE email = ?", (email,)).fetchone()
            if row is not None:
                return row
        return None

    def _row_to_account(self, row: sqlite3.Row) -> AccountRecord:
        return AccountRecord(
            id=int(row["id"]),
            jwt=row["jwt"],
            session_token=row["session_token"],
            user_id=row["user_id"],
            email=row["email"],
            name=row["name"],
            enabled=bool(row["enabled"]),
            status=str(row["status"]),
            last_checked_at=int(row["last_checked_at"]) if row["last_checked_at"] is not None else None,
            last_error=str(row["last_error"]) if row["last_error"] is not None else None,
            failure_count=int(row["failure_count"]),
            created_at=int(row["created_at"]),
            updated_at=int(row["updated_at"]),
        )

    def _delete_logs_before_conn(self, conn: sqlite3.Connection, cutoff: int) -> int:
        cursor = conn.execute("DELETE FROM logs WHERE created_at < ?", (cutoff,))
        return int(cursor.rowcount or 0)

    def _log_retention_cutoff(self, now: int | None = None) -> int:
        current = int(time.time()) if now is None else now
        return current - (self._log_retention_days() * 86400)

    def _log_retention_days(self) -> int:
        env_value = os.getenv("LOG_RETENTION_DAYS")
        if env_value is not None:
            try:
                return max(1, int(env_value))
            except ValueError:
                return DEFAULT_LOG_RETENTION_DAYS
        stored_value = self.get_setting(LOG_RETENTION_DAYS_KEY)
        if stored_value is not None:
            try:
                return max(1, int(stored_value))
            except ValueError:
                return DEFAULT_LOG_RETENTION_DAYS
        return DEFAULT_LOG_RETENTION_DAYS

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        return conn
