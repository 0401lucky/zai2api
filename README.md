# zai2api

OpenAI-compatible chat/completion proxy backed by `https://chat.z.ai/`.

## Features

- Supports `POST /v1/chat/completions`
- Supports `POST /v1/responses`
- Creates a fresh upstream chat for every request
- Preserves reasoning output separately from final answer text
- Reuses `ZAI_SESSION_TOKEN` directly or refreshes it from `ZAI_JWT`

## Requirements

- Python 3.12+
- `uv`
- One of:
  - `ZAI_JWT`
  - `ZAI_SESSION_TOKEN`

## Run

```bash
export ZAI_JWT='your-jwt'
uv run python -m zai2api
```

Or with the installed script:

```bash
export ZAI_JWT='your-jwt'
uv run zai2api
```

Default bind address is `0.0.0.0:8000`.

## Environment variables

- `ZAI_JWT`: preferred auth source; used to fetch a fresh session token
- `ZAI_SESSION_TOKEN`: optional direct session token reuse
- `DEFAULT_MODEL`: defaults to `glm-5`
- Available public model ids: `glm-5`, `glm-5.1`, `glm-5-turbo` and their `-nothinking` variants
- `HOST`: defaults to `0.0.0.0`
- `PORT`: defaults to `8000`
- `LOG_LEVEL`: defaults to `info`
- `REQUEST_TIMEOUT`: defaults to `120`

## Example requests

### Chat Completions

```bash
curl http://127.0.0.1:8000/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{
    "model": "glm-5",
    "messages": [
      {"role": "system", "content": "Be concise."},
      {"role": "user", "content": "Say hello."}
    ]
  }'
```

### Responses API

```bash
curl http://127.0.0.1:8000/v1/responses \
  -H 'content-type: application/json' \
  -d '{
    "model": "glm-5",
    "input": "Say hello."
  }'
```
