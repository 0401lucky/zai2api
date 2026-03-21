from __future__ import annotations

import sqlite3
import time
from pathlib import Path

from zai2api.db import Database, LOG_RETENTION_DAYS_KEY


def test_list_logs_prunes_entries_older_than_retention_window(tmp_path: Path) -> None:
    db = Database(str(tmp_path / "state.db"))
    db.initialize()
    db.set_setting(LOG_RETENTION_DAYS_KEY, "7")

    now = int(time.time())
    with sqlite3.connect(db.path) as conn:
        conn.execute(
            "INSERT INTO logs(created_at, level, category, message, details) VALUES (?, ?, ?, ?, ?)",
            (now - 10 * 86400, "info", "tests", "old-log", None),
        )
        conn.execute(
            "INSERT INTO logs(created_at, level, category, message, details) VALUES (?, ?, ?, ?, ?)",
            (now, "info", "tests", "fresh-log", None),
        )

    logs = db.list_logs(limit=20)

    assert [item.message for item in logs] == ["fresh-log"]
