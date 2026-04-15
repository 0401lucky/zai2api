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
});
