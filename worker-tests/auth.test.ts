import { describe, expect, it } from "vitest";

import { AuthService } from "../worker-src/auth";
import type { AppConfig } from "../worker-src/config";

class FakeRepository {
  readonly settings = new Map<string, string>();
  getSettingCalls = 0;
  getSettingsCalls = 0;

  async getSetting(key: string): Promise<string | null> {
    this.getSettingCalls += 1;
    return this.settings.get(key) ?? null;
  }

  async getSettings(keys: string[]): Promise<Record<string, string>> {
    this.getSettingsCalls += 1;
    return Object.fromEntries(
      keys
        .filter((key) => this.settings.has(key))
        .map((key) => [key, this.settings.get(key) as string]),
    );
  }

  async setSetting(key: string, value: string): Promise<void> {
    this.settings.set(key, value);
  }

  async deleteSetting(key: string): Promise<void> {
    this.settings.delete(key);
  }

  async createAdminSession(): Promise<void> {}

  async getAdminSession(): Promise<null> {
    return null;
  }

  async deleteAdminSession(): Promise<void> {}
}

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
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
    adminAuthMaxAttempts: 3,
    adminAuthWindowSeconds: 900,
    adminAuthLockSeconds: 900,
    accountPollIntervalSeconds: 0,
    accountErrorThreshold: 3,
    accountCooldownSeconds: 60,
    logRetentionDaysEnv: null,
    ...overrides,
  };
}

describe("auth service", () => {
  it("环境变量密码校验支持等时比较", async () => {
    const repository = new FakeRepository();
    const auth = new AuthService(
      makeConfig({
        panelPasswordEnv: "panel-secret",
        apiPasswordEnv: "api-secret",
      }),
      repository as never,
    );

    await expect(auth.verifyPanelPassword("panel-secret")).resolves.toBe(true);
    await expect(auth.verifyPanelPassword("panel-secret-x")).resolves.toBe(false);
    await expect(auth.verifyApiPassword("api-secret")).resolves.toBe(true);
    await expect(auth.verifyApiPassword("api-secret-x")).resolves.toBe(false);
  });

  it("后台失败次数达到阈值后会锁定", async () => {
    const repository = new FakeRepository();
    const auth = new AuthService(makeConfig(), repository as never);

    await expect(auth.recordAdminFailure("login", "127.0.0.1")).resolves.toMatchObject({ locked: false, failedCount: 1 });
    await expect(auth.recordAdminFailure("login", "127.0.0.1")).resolves.toMatchObject({ locked: false, failedCount: 2 });

    const finalAttempt = await auth.recordAdminFailure("login", "127.0.0.1");
    expect(finalAttempt.locked).toBe(true);
    expect(finalAttempt.retryAfterSeconds).toBeGreaterThan(0);

    const state = await auth.getAdminRateLimit("login", "127.0.0.1");
    expect(state.locked).toBe(true);
  });

  it("登录成功后会清空失败计数", async () => {
    const repository = new FakeRepository();
    const auth = new AuthService(makeConfig(), repository as never);

    await auth.recordAdminFailure("setup", "127.0.0.1");
    await auth.clearAdminFailures("setup", "127.0.0.1");

    await expect(auth.getAdminRateLimit("setup", "127.0.0.1")).resolves.toEqual({
      locked: false,
      retryAfterSeconds: 0,
      failedCount: 0,
    });
  });

  it("同一请求内重复读取认证配置只查一次 settings", async () => {
    const repository = new FakeRepository();
    repository.settings.set("panel_password_hash", "hashed-panel");
    repository.settings.set("api_password_hash", "hashed-api");
    const auth = new AuthService(makeConfig(), repository as never);

    await expect(auth.panelPasswordSource()).resolves.toBe("database");
    await expect(auth.apiPasswordSource()).resolves.toBe("database");
    await expect(auth.isApiAuthEnabled()).resolves.toBe(true);

    expect(repository.getSettingsCalls).toBe(1);
    expect(repository.getSettingCalls).toBe(0);
  });
});
