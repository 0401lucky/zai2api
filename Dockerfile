FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

COPY --from=ghcr.io/astral-sh/uv:0.8.18 /uv /uvx /bin/

WORKDIR /app

COPY pyproject.toml uv.lock README.md ./
RUN uv sync --frozen --no-dev --no-install-project

COPY src ./src
RUN uv sync --frozen --no-dev

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    PORT=8000 \
    CAPTCHA_PROVIDER=playwright \
    PATH="/app/.venv/bin:$PATH"

COPY --from=ghcr.io/astral-sh/uv:0.8.18 /uv /uvx /bin/

WORKDIR /app

# Playwright 系统依赖（Chromium 无头浏览器所需）
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libatk-bridge2.0-0 libdrm2 libxkbcommon0 \
    libgbm1 libasound2 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libpango-1.0-0 libcairo2 libatspi2.0-0 \
    libcups2 libx11-6 libxcb1 libxext6 libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app /app
RUN mkdir -p /app/data

# 安装 Playwright 的 Chromium 浏览器
RUN uv pip install --no-cache playwright ddddocr numpy pillow \
    && python -m playwright install --with-deps chromium \
    && python -m playwright install-deps chromium

EXPOSE 8000
VOLUME ["/app/data"]

CMD ["uv", "run", "zai2api"]
