import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vitest";

import type { AppEnv } from "../worker-src/app-env";
import { AuthService } from "../worker-src/auth";
import type { AppConfig } from "../worker-src/config";
import { createAdminRoutes } from "../worker-src/routes/admin";

class FakeRepository {
  readonly settings = new Map<string, string>();
  readonly logs: Array<{ level: string; category: string; message: string; details?: Record<string, unknown> | null }> = [];

  async getSetting(key: string): Promise<string | null> {
    return this.settings.get(key) ?? null;
  }

  async getSettings(keys: string[]): Promise<Record<string, string>> {
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

  async addLog(entry: { level: string; category: string; message: string; details?: Record<string, unknown> | null }): Promise<void> {
    this.logs.push(entry);
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
    panelPasswordEnv: "panel-secret",
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

function makeApp(repository: FakeRepository, config = makeConfig()) {
  const auth = new AuthService(config, repository as never);
  const services = {
    config,
    auth,
    repository,
    guestSource: {},
    accountPool: {},
  };
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
  app.route("/api/admin", createAdminRoutes());
  return { app, repository };
}

describe("admin routes", () => {
  it("登录失败达到阈值后返回 429", async () => {
    const { app } = makeApp(new FakeRepository());

    for (let index = 0; index < 2; index += 1) {
      const response = await app.request("http://localhost/api/admin/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": "127.0.0.1",
          "x-zai2api-admin-request": "same-origin",
        },
        body: JSON.stringify({ password: "wrong" }),
      });
      expect(response.status).toBe(401);
    }

    const locked = await app.request("http://localhost/api/admin/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": "127.0.0.1",
        "x-zai2api-admin-request": "same-origin",
      },
      body: JSON.stringify({ password: "wrong" }),
    });

    expect(locked.status).toBe(429);
    await expect(locked.json()).resolves.toMatchObject({
      detail: expect.stringContaining("尝试次数过多"),
    });
  });

  it("后台登录接口对无效 JSON 返回 400", async () => {
    const { app } = makeApp(new FakeRepository());

    const response = await app.request("http://localhost/api/admin/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": "127.0.0.1",
        "x-zai2api-admin-request": "same-origin",
      },
      body: "{invalid json",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      detail: "请求体必须是有效 JSON",
    });
  });

  it("后台写接口会拒绝缺少受信来源标记的请求", async () => {
    const { app } = makeApp(new FakeRepository());

    const response = await app.request("http://localhost/api/admin/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": "127.0.0.1",
      },
      body: JSON.stringify({ password: "wrong" }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      detail: "非法来源，已拒绝后台写操作",
    });
  });

  it("后台写接口允许同源 Origin 请求", async () => {
    const { app } = makeApp(new FakeRepository());

    const response = await app.request("http://localhost/api/admin/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost",
        "cf-connecting-ip": "127.0.0.1",
      },
      body: JSON.stringify({ password: "wrong" }),
    });

    expect(response.status).toBe(401);
  });
});
