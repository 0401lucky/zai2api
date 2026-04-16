import { describe, expect, it } from "vitest";

import { loadConfig } from "../worker-src/config";

describe("config", () => {
  it("读取 SETUP_TOKEN", () => {
    const config = loadConfig({
      DB: {} as D1Database,
      ASSETS: { fetch: async () => new Response("ok") },
      ACCOUNT_ENCRYPTION_KEY: "secret",
      SETUP_TOKEN: "bootstrap-token",
    });
    expect(config.setupToken).toBe("bootstrap-token");
  });

  it("读取游客来源开关", () => {
    const config = loadConfig({
      DB: {} as D1Database,
      ASSETS: { fetch: async () => new Response("ok") },
      ACCOUNT_ENCRYPTION_KEY: "secret",
      ZAI_GUEST_ENABLED: "true",
    });
    expect(config.guestEnabled).toBe(true);
    expect(config.guestEnabledEnv).toBe(true);
  });
});
