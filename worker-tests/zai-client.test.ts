import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppConfig } from "../worker-src/config";
import { ZAIClient } from "../worker-src/zai-client";

function makeConfig(): AppConfig {
  return {
    logLevel: "info",
    zaiBaseUrl: "https://chat.z.ai",
    zaiJwt: null,
    zaiSessionToken: null,
    guestEnabled: false,
    guestEnabledEnv: null,
    setupToken: null,
    defaultModel: "glm-5.1",
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
    accountMaxAttemptsPerRequest: 4,
    logRetentionDaysEnv: null,
  };
}

function jsonResponse(payload: Record<string, unknown>, init?: ResponseInit): Response {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
}

function streamResponse(chunks: string): Response {
  return new Response(chunks, {
    headers: { "content-type": "text/event-stream" },
  });
}

describe("zai client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("JWT 账号不会直接复用数据库里的旧 session token", async () => {
    const authHeaders: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const request = input instanceof Request ? input : new Request(input);
        const url = new URL(request.url);
        if (url.pathname === "/") {
          return new Response("prod-fe-1.1.33");
        }
        if (url.pathname === "/api/v1/auths/") {
          authHeaders.push(request.headers.get("authorization") ?? "");
          return jsonResponse({
            token: "fresh-session-token",
            id: "fresh-user",
            name: "fresh",
            email: "fresh@example.com",
            role: "user",
          });
        }
        throw new Error(`unexpected fetch ${request.method} ${url.pathname}`);
      }),
    );

    const client = new ZAIClient(makeConfig(), "jwt-token", "stale-session-token");
    const session = await client.ensureSession();

    expect(session.token).toBe("fresh-session-token");
    expect(authHeaders).toEqual(["Bearer jwt-token"]);
  });

  it("上游提示刷新页面时会用 JWT 刷新会话并重试一次", async () => {
    let authCalls = 0;
    let completionCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const request = input instanceof Request ? input : new Request(input);
        const url = new URL(request.url);
        if (url.pathname === "/") {
          return new Response("prod-fe-1.1.33");
        }
        if (url.pathname === "/api/v1/auths/") {
          authCalls += 1;
          return jsonResponse({
            token: `fresh-session-token-${authCalls}`,
            id: "fresh-user",
            name: "fresh",
            email: "fresh@example.com",
            role: "user",
          });
        }
        if (url.pathname === "/api/v1/chats/new") {
          return jsonResponse({ id: `chat-${completionCalls + 1}` });
        }
        if (url.pathname === "/api/v2/chat/completions") {
          completionCalls += 1;
          if (completionCalls === 1) {
            return streamResponse(
              'data: {"type":"chat:completion","data":{"error":{"detail":"Please refresh the page to update the app, then try again."}}}\n\n',
            );
          }
          return streamResponse(
            'data: {"type":"chat:completion","data":{"phase":"answer","delta_content":"ok","usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}}\n\ndata: [DONE]\n\n',
          );
        }
        throw new Error(`unexpected fetch ${request.method} ${url.pathname}`);
      }),
    );

    const client = new ZAIClient(makeConfig(), "jwt-token-retry", "stale-session-token");
    const result = await client.collectPrompt({
      prompt: "hello",
      model: "glm-5.1",
      enableThinking: true,
      autoWebSearch: false,
    });

    expect(result.answerText).toBe("ok");
    expect(authCalls).toBe(2);
    expect(completionCalls).toBe(2);
  });

  it("验证码错误会保留上游错误码且不会刷新会话重试", async () => {
    let authCalls = 0;
    let completionCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const request = input instanceof Request ? input : new Request(input);
        const url = new URL(request.url);
        if (url.pathname === "/") {
          return new Response("prod-fe-1.1.33");
        }
        if (url.pathname === "/api/v1/auths/") {
          authCalls += 1;
          return jsonResponse({
            token: "fresh-session-token",
            id: "fresh-user",
            name: "fresh",
            email: "fresh@example.com",
            role: "user",
          });
        }
        if (url.pathname === "/api/v1/chats/new") {
          return jsonResponse({ id: "chat-1" });
        }
        if (url.pathname === "/api/v2/chat/completions") {
          completionCalls += 1;
          return streamResponse(
            'data: {"type":"chat:completion","data":{"error":{"detail":"请刷新页面以更新应用后重试。","code":"FRONTEND_CAPTCHA_REQUIRED","captcha_error_type":"missing_param"}}}\n\n',
          );
        }
        throw new Error(`unexpected fetch ${request.method} ${url.pathname}`);
      }),
    );

    const client = new ZAIClient(makeConfig(), "jwt-token-captcha", null);
    await expect(
      client.collectPrompt({
        prompt: "hello",
        model: "glm-4.7",
        enableThinking: true,
        autoWebSearch: false,
      }),
    ).rejects.toThrow("Z.ai 上游要求浏览器验证码");
    expect(authCalls).toBe(1);
    expect(completionCalls).toBe(1);
  });
});
