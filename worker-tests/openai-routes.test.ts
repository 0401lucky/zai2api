import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vitest";

import type { AppEnv } from "../worker-src/app-env";
import { createOpenAIRoutes } from "../worker-src/routes/openai";

function makeServices(options: {
  collectPrompt?: () => Promise<unknown>;
  streamPrompt?: () => AsyncGenerator<{ text: string; phase: string | null; error?: string | null }>;
}) {
  const logs: Array<{ level: string; category: string; message: string; details?: Record<string, unknown> | null }> = [];
  const services = {
    config: {
      logLevel: "info",
      zaiBaseUrl: "https://chat.z.ai",
      zaiJwt: null,
      zaiSessionToken: null,
      guestEnabled: false,
      guestEnabledEnv: null,
      setupToken: "setup-token",
      defaultModel: "glm-5",
      requestTimeoutMs: 1000,
      panelPasswordEnv: null,
      apiPasswordEnv: null,
      adminCookieName: "session",
      adminSessionTtlSeconds: 3600,
      adminCookieSecure: true,
      adminAuthMaxAttempts: 5,
      adminAuthWindowSeconds: 900,
      adminAuthLockSeconds: 900,
      accountPollIntervalSeconds: 0,
      accountErrorThreshold: 3,
      accountCooldownSeconds: 60,
      logRetentionDaysEnv: null,
    },
    auth: {
      isApiAuthEnabled: async () => false,
      extractApiPassword: () => null,
      verifyApiPassword: async () => false,
    },
    repository: {
      addLog: async (entry: { level: string; category: string; message: string; details?: Record<string, unknown> | null }) => {
        logs.push(entry);
      },
    },
    accountPool: {
      collectPrompt:
        options.collectPrompt ??
        (async () => ({
          answerText: "ok",
          reasoningText: "",
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          finishReason: "stop",
        })),
      streamPrompt:
        options.streamPrompt ??
        (async function* () {
          yield { phase: "answer", text: "ok" };
        }),
    },
  };
  return { services, logs };
}

function makeApp(services: unknown): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.onError((error, c) => {
    if (error instanceof HTTPException) {
      return c.json({ detail: error.message }, error.status);
    }
    return c.json({ detail: "服务暂不可用，请稍后重试" }, 500);
  });
  app.use("*", async (c, next) => {
    c.set("services", services as never);
    await next();
  });
  app.route("/v1", createOpenAIRoutes());
  return app;
}

describe("openai routes", () => {
  it("兼容接受 chat completions 的 max_tokens 参数", async () => {
    const { services } = makeServices({});
    const app = makeApp(services);

    const response = await app.request("http://localhost/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "glm-5",
        max_tokens: 128,
        messages: [{ role: "user", content: "hello" }],
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      object: "chat.completion",
      model: "glm-5",
    });
  });

  it("兼容忽略 chat completions 中常见但未实现的 OpenAI 参数", async () => {
    const { services } = makeServices({});
    const app = makeApp(services);

    const response = await app.request("http://localhost/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "glm-5",
        messages: [{ role: "user", content: "hello" }],
        temperature: 0.7,
        top_p: 0.9,
        tools: [{ type: "function", function: { name: "demo", parameters: {} } }],
        tool_choice: "auto",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      object: "chat.completion",
      model: "glm-5",
    });
  });

  it("兼容接受 responses 的 max_output_tokens 参数", async () => {
    const { services } = makeServices({});
    const app = makeApp(services);

    const response = await app.request("http://localhost/v1/responses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "glm-5",
        input: "hello",
        max_output_tokens: 128,
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      object: "response",
      model: "glm-5",
      status: "completed",
    });
  });

  it("兼容忽略 responses 中常见但未实现的 OpenAI 参数", async () => {
    const { services } = makeServices({});
    const app = makeApp(services);

    const response = await app.request("http://localhost/v1/responses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "glm-5",
        input: "hello",
        temperature: 0.7,
        top_p: 0.9,
        tools: [{ type: "function", function: { name: "demo", parameters: {} } }],
        tool_choice: "auto",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      object: "response",
      model: "glm-5",
      status: "completed",
    });
  });

  it("非 JSON 请求体返回 400", async () => {
    const { services } = makeServices({});
    const app = makeApp(services);

    const response = await app.request("http://localhost/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{invalid json",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      detail: "请求体必须是有效 JSON",
    });
  });

  it("非流式上游失败时对外返回脱敏文案并保留日志详情", async () => {
    const { services, logs } = makeServices({
      collectPrompt: async () => {
        throw new Error("internal upstream path /api/v2/chat/completions");
      },
    });
    const app = makeApp(services);

    const response = await app.request("http://localhost/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "glm-5",
        messages: [{ role: "user", content: "hello" }],
      }),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      detail: "上游服务暂不可用，请稍后重试",
    });
    expect(JSON.stringify(logs)).toContain("/api/v2/chat/completions");
  });

  it("流式失败事件不会回显内部错误细节", async () => {
    const { services } = makeServices({
      streamPrompt: async function* () {
        throw new Error("internal upstream path /api/v2/chat/completions");
      },
    });
    const app = makeApp(services);

    const response = await app.request("http://localhost/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "glm-5",
        stream: true,
        messages: [{ role: "user", content: "hello" }],
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("上游服务暂不可用，请稍后重试");
    expect(body).not.toContain("/api/v2/chat/completions");
  });
});
