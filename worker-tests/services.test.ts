import { describe, expect, it } from "vitest";

import { createServices } from "../worker-src/services";

function makeEnv() {
  return {
    DB: {} as D1Database,
    ASSETS: { fetch: async () => new Response("ok") },
    ACCOUNT_ENCRYPTION_KEY: "secret",
  };
}

describe("services cache", () => {
  it("同一个 env 会复用同一组 services", () => {
    const env = makeEnv();
    const first = createServices(env);
    const second = createServices(env);

    expect(second).toBe(first);
    expect(second.repository).toBe(first.repository);
    expect(second.auth).toBe(first.auth);
  });

  it("不同 env 会得到不同的 services 实例", () => {
    const first = createServices(makeEnv());
    const second = createServices(makeEnv());

    expect(second).not.toBe(first);
  });
});
