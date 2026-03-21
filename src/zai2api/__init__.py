from __future__ import annotations

import uvicorn

from .config import settings
from .server import create_app

app = create_app()


def main() -> None:
    uvicorn.run(app, host=settings.host, port=settings.port, log_level=settings.log_level)
