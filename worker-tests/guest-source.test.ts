import { describe, expect, it } from "vitest";

import type { SessionState, UpstreamChunk, UpstreamResult } from "../worker-src/bindings";
import type { AppConfig } from "../worker-src/config";
import { GuestSourceManager } from "../worker-src/guest-source";
import { D1Repository } from "../worker-src/repository";
import { UpstreamHttpError, ZAIClient } from "../worker-src/zai-client";

class FakeRepository {
  readonly settings = new Map<string, string>();
  readonly logs: Array<{ level: string; category: string; message: string; details?: Record<string, unknown> | null }> = [];

  async getSetting(key: string): Promise<string | null> {
    return this.settings.get(key) ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    this.settings.set(key, value);
  }

  async addLog(entry: { level: string; category: string; message: string; details?: Record<string, unknown> | null }): Promise<void> {
    this.logs.push(entry);
  }
}

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    logLevel: "info",
    zaiBaseUrl: "https://chat.z.ai",
    zaiJwt: null,
    zaiSessionToken: null,
    guestEnabled: true,
    setupToken: null,
    defaultModel: "glm-5",
    requestTimeoutMs: 1000,
    panelPasswordEnv: null,
    apiPasswordEnv: null,
    adminCookieName: "session",
    adminSessionTtlSeconds: 3600,
    adminCookieSecure: true,
    accountPollIntervalSeconds: 0,
    accountErrorThreshold: 3,
    accountCooldownSeconds: 60,
    logRetentionDaysEnv: null,
    ...overrides,
  };
}

function makeSession(token: string, userId: string): SessionState {
  return {
    token,
    userId,
    name: `guest-${userId}`,
    email: "",
    role: "guest",
  };
}

describe("guest source", () => {
  it("缓存复用并在 401 后重建游客会话", async () => {
    const repository = new FakeRepository();
    const sessions = [makeSession("guest-token-1", "guest-user-1"), makeSession("guest-token-2", "guest-user-2")];
    let sessionFactoryCalls = 0;
    let firstTokenFailures = 0;

    const manager = new GuestSourceManager(
      makeConfig(),
      repository as unknown as D1Repository,
      ((sessionToken: string) =>
        ({
          collectPrompt: async (): Promise<UpstreamResult> => {
            if (sessionToken === "guest-token-1" && firstTokenFailures === 0) {
              firstTokenFailures += 1;
              throw new UpstreamHttpError("401", "POST", "/api/v1/chats/new", 401, "");
            }
            return {
              answerText: "hello",
              reasoningText: "thinking",
              usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
              finishReason: "stop",
            };
          },
          ensureSession: async (): Promise<SessionState> => sessions[sessionToken === "guest-token-1" ? 0 : 1],
          streamPrompt: async function* (): AsyncGenerator<UpstreamChunk> {},
        }) as unknown as ZAIClient),
      async () => sessions[sessionFactoryCalls++],
    );

    const result = await manager.collectPrompt({
      prompt: "hello",
      model: "glm-5",
      enableThinking: true,
      autoWebSearch: false,
    });

    expect(result.answerText).toBe("hello");
    expect(sessionFactoryCalls).toBe(2);

    const snapshot = await manager.getSnapshot();
    expect(snapshot.enabled).toBe(true);
    expect(snapshot.status).toBe("active");
    expect(snapshot.inRotation).toBe(true);
    expect(snapshot.requestCount).toBe(1);
    expect(snapshot.lastUserId).toBe("guest-user-2");
    expect(repository.logs.some((entry) => entry.message === "游客会话失效，正在重建")).toBe(true);
  });

  it("失败后进入冷却并退出轮询", async () => {
    const repository = new FakeRepository();
    const manager = new GuestSourceManager(
      makeConfig(),
      repository as unknown as D1Repository,
      (() =>
        ({
          collectPrompt: async (): Promise<UpstreamResult> => {
            throw new UpstreamHttpError("503", "POST", "/api/v1/chats/new", 503, "");
          },
          ensureSession: async (): Promise<SessionState> => makeSession("guest-token-1", "guest-user-1"),
          streamPrompt: async function* (): AsyncGenerator<UpstreamChunk> {},
        }) as unknown as ZAIClient),
      async () => makeSession("guest-token-1", "guest-user-1"),
    );

    await expect(
      manager.collectPrompt({
        prompt: "hello",
        model: "glm-5",
        enableThinking: true,
        autoWebSearch: false,
      }),
    ).rejects.toBeInstanceOf(UpstreamHttpError);

    const snapshot = await manager.getSnapshot();
    expect(snapshot.status).toBe("cooldown");
    expect(snapshot.inRotation).toBe(false);
    expect(snapshot.cooldownUntil).not.toBeNull();
    expect(snapshot.lastError).toContain("HTTP 503");
  });
});
