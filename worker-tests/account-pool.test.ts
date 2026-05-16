import { describe, expect, it } from "vitest";

import { AccountPool } from "../worker-src/account-pool";
import type { AccountRecord, UpstreamChunk } from "../worker-src/bindings";
import type { AppConfig } from "../worker-src/config";
import { D1Repository } from "../worker-src/repository";
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
    accountErrorThreshold: 1,
    accountCooldownSeconds: 60,
    accountMaxAttemptsPerRequest: 4,
    logRetentionDaysEnv: null,
  };
}

function makeAccount(id: number, sessionToken: string): AccountRecord {
  return {
    id,
    jwt: null,
    sessionToken,
    userId: `user-${id}`,
    email: `user-${id}@example.com`,
    name: `user-${id}`,
    enabled: true,
    status: "active",
    lastCheckedAt: null,
    lastError: null,
    failureCount: 0,
    requestCount: 0,
    createdAt: 1,
    updatedAt: 1,
  };
}

class FakeRepository {
  readonly accounts = [makeAccount(1, "bad-token"), makeAccount(2, "good-token")];
  readonly logs: Array<{ message: string; details?: Record<string, unknown> | null }> = [];

  async listAccounts(options: { enabledOnly?: boolean; healthyOnly?: boolean } = {}): Promise<AccountRecord[]> {
    return this.accounts.filter((account) => {
      if (options.enabledOnly && !account.enabled) {
        return false;
      }
      if (options.healthyOnly && !["active", "unknown"].includes(account.status)) {
        return false;
      }
      return true;
    });
  }

  async getAccount(accountId: number): Promise<AccountRecord | null> {
    return this.accounts.find((account) => account.id === accountId) ?? null;
  }

  async markAccountSuccess(accountId: number): Promise<void> {
    const account = await this.getAccount(accountId);
    if (!account) {
      return;
    }
    account.status = "active";
    account.lastError = null;
    account.failureCount = 0;
    account.requestCount += 1;
  }

  async markAccountFailure(accountId: number, error: string): Promise<void> {
    const account = await this.getAccount(accountId);
    if (!account) {
      return;
    }
    account.status = "error";
    account.lastError = error;
    account.failureCount += 1;
  }

  async listCooldownAccounts(): Promise<AccountRecord[]> {
    return [];
  }

  async addLog(entry: { message: string; details?: Record<string, unknown> | null }): Promise<void> {
    this.logs.push(entry);
  }
}

function makeGuestSource() {
  return {
    getSnapshot: async () => ({
      enabled: false,
      status: "disabled",
      inRotation: false,
      lastRefreshedAt: null,
      lastError: null,
      requestCount: 0,
      cooldownUntil: null,
      lastUserId: null,
    }),
  };
}

describe("account pool", () => {
  it("流式账号在输出前报错时会继续尝试下一个账号", async () => {
    const repository = new FakeRepository();
    const pool = new AccountPool(
      makeConfig(),
      repository as unknown as D1Repository,
      makeGuestSource() as never,
      ((_, sessionToken) =>
        ({
          streamPrompt:
            sessionToken === "bad-token"
              ? async function* (): AsyncGenerator<UpstreamChunk> {
                  yield { phase: null, text: "", error: "Model not available for current user level" };
                }
              : async function* (): AsyncGenerator<UpstreamChunk> {
                  yield { phase: "answer", text: "ok" };
                },
          ensureSession: async () => ({
            token: sessionToken ?? "",
            userId: "user",
            name: "user",
            email: "user@example.com",
            role: "user",
          }),
        }) as unknown as ZAIClient),
    );

    const chunks: UpstreamChunk[] = [];
    for await (const chunk of pool.streamPrompt({
      prompt: "hello",
      model: "glm-5.1",
      enableThinking: true,
      autoWebSearch: false,
    })) {
      chunks.push(chunk);
    }

    expect(chunks.map((chunk) => chunk.text)).toEqual(["ok"]);
    expect(repository.accounts[0].status).toBe("error");
    expect(repository.accounts[0].lastError).toContain("Model not available");
    expect(repository.accounts[1].requestCount).toBe(1);
  });
});
