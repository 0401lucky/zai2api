import { describe, expect, it } from "vitest";

import { PUBLIC_MODEL_ALIASES, accountSummary, availableModels, normalizePublicModelName, resolveModelRequest } from "../worker-src/helpers";

describe("model helpers", () => {
  it("公开模型别名完整", () => {
    expect(PUBLIC_MODEL_ALIASES["glm-5-turbo"]).toBe("GLM-5-Turbo");
  });

  it("可以把上游模型名归一化为公开模型名", () => {
    expect(normalizePublicModelName("GLM-5-Turbo")).toBe("glm-5-turbo");
    expect(normalizePublicModelName("glm-5-turbo-nothinking")).toBe("glm-5-turbo-nothinking");
  });

  it("可以解析上游模型与思考开关", () => {
    expect(resolveModelRequest("glm-5-turbo")).toEqual({
      upstreamModel: "GLM-5-Turbo",
      enableThinking: true,
    });
    expect(resolveModelRequest("glm-5-nothinking")).toEqual({
      upstreamModel: "glm-5",
      enableThinking: false,
    });
  });

  it("公开模型列表包含 thinking 与 nothinking 变体", () => {
    const models = availableModels({ defaultModel: "glm-5", logLevel: "info", zaiBaseUrl: "", zaiJwt: null, zaiSessionToken: null, setupToken: null, requestTimeoutMs: 1, panelPasswordEnv: null, apiPasswordEnv: null, adminCookieName: "a", adminSessionTtlSeconds: 1, adminCookieSecure: true, accountPollIntervalSeconds: 0, logRetentionDaysEnv: null });
    expect(models).toContain("glm-5");
    expect(models).toContain("glm-5-turbo");
    expect(models).toContain("glm-5-turbo-nothinking");
  });

  it("账号摘要按健康账号决定是否显示 env fallback", async () => {
    const summary = await accountSummary({
      config: {
        defaultModel: "glm-5",
        logLevel: "info",
        zaiBaseUrl: "",
        zaiJwt: "jwt",
        zaiSessionToken: null,
        setupToken: "token",
        requestTimeoutMs: 1,
        panelPasswordEnv: null,
        apiPasswordEnv: null,
        adminCookieName: "a",
        adminSessionTtlSeconds: 1,
        adminCookieSecure: true,
        accountPollIntervalSeconds: 0,
        logRetentionDaysEnv: null,
      },
      repository: {
        countAccounts: async (enabledOnly: boolean) => (enabledOnly ? 2 : 3),
        listAccounts: async () => [{ id: 1 }],
      },
    } as never);
    expect(summary.persisted_enabled).toBe(2);
    expect(summary.persisted_healthy).toBe(1);
    expect(summary.using_env_fallback).toBe(false);
  });
});
