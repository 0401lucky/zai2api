# zai2api

基于 `https://chat.z.ai/` 的 OpenAI 兼容聊天 / 补全代理服务。

## 功能特性

- 支持 `POST /v1/chat/completions`
- 支持 `POST /v1/responses`
- 每次请求都会创建一条全新的上游会话
- 将推理内容与最终回答文本分开保留
- 支持直接复用 `ZAI_SESSION_TOKEN`，或通过 `ZAI_JWT` 自动刷新会话
- 内置中文管理页，可管理账号、安全设置和审计日志

## 运行要求

- Python 3.12+
- `uv`
- 以下凭证二选一：
  - `ZAI_JWT`
  - `ZAI_SESSION_TOKEN`

## 启动方式

```bash
export ZAI_JWT='your-jwt'
uv run python -m zai2api
```

或者使用安装后的脚本：

```bash
export ZAI_JWT='your-jwt'
uv run zai2api
```

默认监听地址为 `0.0.0.0:8000`。

## 环境变量

- `ZAI_JWT`：首选认证来源，用于换取新的会话令牌
- `ZAI_SESSION_TOKEN`：可选，直接复用已有会话令牌
- `DEFAULT_MODEL`：默认值为 `glm-5`
- 可用公开模型 ID：`glm-5`、`glm-5.1`、`glm-5-turbo`，以及它们的 `-nothinking` 变体
- `HOST`：默认值为 `0.0.0.0`
- `PORT`：默认值为 `8000`
- `LOG_LEVEL`：默认值为 `info`
- `REQUEST_TIMEOUT`：默认值为 `120`

## 请求示例

### Chat Completions

```bash
curl http://127.0.0.1:8000/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{
    "model": "glm-5",
    "messages": [
      {"role": "system", "content": "请简洁回答。"},
      {"role": "user", "content": "打个招呼。"}
    ]
  }'
```

### Responses API

```bash
curl http://127.0.0.1:8000/v1/responses \
  -H 'content-type: application/json' \
  -d '{
    "model": "glm-5",
    "input": "打个招呼。"
  }'
```
