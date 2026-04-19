# zai2api

面向 **Cloudflare Workers** 的 Z.ai OpenAI 兼容代理，内置中文后台，可管理账号池、安全设置与审计日志。

## 当前架构

- 运行时：`TypeScript + Hono + Cloudflare Workers`
- 持久化：`D1`
- 后台页面：`Workers Assets`
- 上游：`https://chat.z.ai`

## 已提供能力

- `POST /v1/chat/completions`
- `POST /v1/responses`
- `GET /v1/models`
- 中文后台：初始化、登录、账号管理、安全设置、日志查看
- 支持 `ZAI_JWT` 自动刷新会话
- 支持 `ZAI_SESSION_TOKEN` 直连并先走 `/api/v1/auths/` 校验/刷新
- 支持 `ZAI_GUEST_ENABLED=true` 或后台安全设置开启游客来源，并在后台单独展示游客状态
- 支持持久化账号失败后回退到环境变量账号

## 本地开发

1. 安装依赖

```bash
npm install
```

2. 复制开发变量

```bash
cp .dev.vars.example .dev.vars
```

3. 创建 D1 数据库并把 `wrangler.jsonc` 里的 `database_id` 改成真实值

```bash
npx wrangler d1 create zai2api
```

4. 应用迁移

```bash
npx wrangler d1 migrations apply zai2api
```

5. 启动本地开发

```bash
npm run dev
```

## Cloudflare 部署

1. 创建 D1 数据库并更新 `wrangler.jsonc`
2. 配置 Secrets

```bash
npx wrangler secret put ACCOUNT_ENCRYPTION_KEY
npx wrangler secret put SETUP_TOKEN
npx wrangler secret put PANEL_PASSWORD
npx wrangler secret put API_PASSWORD
npx wrangler secret put ZAI_JWT
```

说明：

- `ACCOUNT_ENCRYPTION_KEY`：必填，用于加密存储账号凭证
- `SETUP_TOKEN`：必填，用于首次初始化后台，避免匿名占坑
- `SETUP_TOKEN`：调用 `/api/admin/setup` 时仅支持放在 `Authorization: Bearer <token>` 中
- `PANEL_PASSWORD`：建议首发时直接设置；若不设置，则必须带 `SETUP_TOKEN` 先完成一次初始化
- `API_PASSWORD`：可选，不填则 `/v1/*` 默认不开启密码
- `ZAI_JWT` 或 `ZAI_SESSION_TOKEN`：二选一即可，推荐 `ZAI_JWT`
- `ZAI_GUEST_ENABLED`：可选，设为 `true` 后可启用游客来源；默认关闭

3. 应用 D1 迁移

```bash
npx wrangler d1 migrations apply zai2api --remote
```

4. 部署

```bash
npm run deploy
```

## 关键变量

- `ZAI_JWT`：首选认证来源
- `ZAI_SESSION_TOKEN`：可选，会先向 `/api/v1/auths/` 校验/刷新
- `ZAI_GUEST_ENABLED`：显式开启游客来源，默认 `false`
- `DEFAULT_MODEL`：默认 `glm-5`
- `REQUEST_TIMEOUT`：默认 `120` 秒
- `LOG_RETENTION_DAYS`：默认 `7`
- `ACCOUNT_POLL_INTERVAL_SECONDS`：默认 `300`
- `ADMIN_COOKIE_NAME`：默认 `zai2api_admin_session`
- `ADMIN_SESSION_TTL_HOURS`：默认 `168`
- `ADMIN_COOKIE_SECURE`：默认 `true`
- `ADMIN_AUTH_MAX_ATTEMPTS`：默认 `5`
- `ADMIN_AUTH_WINDOW_SECONDS`：默认 `900`
- `ADMIN_AUTH_LOCK_SECONDS`：默认 `900`

## API 示例

### Chat Completions

```bash
curl https://your-worker.example.com/v1/chat/completions \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer your-api-password' \
  -d '{
    "model": "glm-5",
    "messages": [
      {"role": "system", "content": "请简洁回答。"},
      {"role": "user", "content": "打个招呼。"}
    ]
  }'
```

### Responses

```bash
curl https://your-worker.example.com/v1/responses \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer your-api-password' \
  -d '{
    "model": "glm-5",
    "input": "打个招呼。"
  }'
```

## 兼容说明

- 仓库中仍保留原 Python 代码作为迁移参考
- Cloudflare 版为当前主线，后续新增功能默认在 `worker-src/` 和 `public/` 中演进
- 当前仅稳定支持 `model`、`messages` / `input`、`stream`
- `max_tokens`、`max_completion_tokens`、`max_output_tokens` 会为兼容常见 OpenAI 客户端而放行，但当前不会严格控制上游输出长度
- `temperature`、`top_p`、`tools`、`tool_choice`、`response_format` 等常见 OpenAI 参数会做兼容忽略，不再直接返回 `400`
- 其中 `tools` / `tool_choice` 当前仅做兼容透传前忽略，不会真正执行函数调用或工具编排
- 后台写接口仅接受 `application/json`，并要求同源请求或显式管理请求头，避免 CSRF
