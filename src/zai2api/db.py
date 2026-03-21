from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import sqlite3
import time
from typing import Any


@dataclass(slots=True)
class LogRecord:
    id: int
    created_at: int
    level: str
    category: str
    message: str
    details: dict[str, Any] | None


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

    def add_log(
        self,
        *,
        level: str,
        category: str,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        now = int(time.time())
        encoded_details = json.dumps(details, ensure_ascii=False) if details is not None else None
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO logs(created_at, level, category, message, details) VALUES (?, ?, ?, ?, ?)",
                (now, level, category, message, encoded_details),
            )

    def list_logs(self, limit: int = 100) -> list[LogRecord]:
        with self._connect() as conn:
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

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        return conn
