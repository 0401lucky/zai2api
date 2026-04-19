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
    const models = availableModels({ defaultModel: "glm-5", logLevel: "info", zaiBaseUrl: "", zaiJwt: null, zaiSessionToken: null, guestEnabled: false, guestEnabledEnv: null, setupToken: null, requestTimeoutMs: 1, panelPasswordEnv: null, apiPasswordEnv: null, adminCookieName: "a", adminSessionTtlSeconds: 1, adminCookieSecure: true, adminAuthMaxAttempts: 5, adminAuthWindowSeconds: 900, adminAuthLockSeconds: 900, accountPollIntervalSeconds: 0, accountErrorThreshold: 3, accountCooldownSeconds: 60, logRetentionDaysEnv: null });
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
        guestEnabled: false,
        guestEnabledEnv: null,
        setupToken: "token",
        requestTimeoutMs: 1,
        panelPasswordEnv: null,
        apiPasswordEnv: null,
        adminCookieName: "a",
        adminSessionTtlSeconds: 1,
        adminCookieSecure: true,
        adminAuthMaxAttempts: 5,
        adminAuthWindowSeconds: 900,
        adminAuthLockSeconds: 900,
        accountPollIntervalSeconds: 0,
        accountErrorThreshold: 3,
        accountCooldownSeconds: 60,
        logRetentionDaysEnv: null,
      },
      repository: {
        getAccountSummaryCounts: async () => ({
          persistedTotal: 3,
          persistedEnabled: 2,
          persistedHealthy: 1,
        }),
      },
      guestSource: {
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
      },
    } as never);
    expect(summary.persisted_enabled).toBe(2);
    expect(summary.persisted_healthy).toBe(1);
    expect(summary.using_env_fallback).toBe(false);
  });

  it("账号摘要可识别游客来源兜底", async () => {
    const summary = await accountSummary({
      config: {
        defaultModel: "glm-5",
        logLevel: "info",
        zaiBaseUrl: "",
        zaiJwt: null,
        zaiSessionToken: null,
        guestEnabled: true,
        guestEnabledEnv: null,
        setupToken: "token",
        requestTimeoutMs: 1,
        panelPasswordEnv: null,
        apiPasswordEnv: null,
        adminCookieName: "a",
        adminSessionTtlSeconds: 1,
        adminCookieSecure: true,
        adminAuthMaxAttempts: 5,
        adminAuthWindowSeconds: 900,
        adminAuthLockSeconds: 900,
        accountPollIntervalSeconds: 0,
        accountErrorThreshold: 3,
        accountCooldownSeconds: 60,
        logRetentionDaysEnv: null,
      },
      repository: {
        getAccountSummaryCounts: async () => ({
          persistedTotal: 0,
          persistedEnabled: 0,
          persistedHealthy: 0,
        }),
      },
      guestSource: {
        getSnapshot: async () => ({
          enabled: true,
          status: "active",
          inRotation: true,
          lastRefreshedAt: 1,
          lastError: null,
          requestCount: 2,
          cooldownUntil: null,
          lastUserId: "guest-user",
        }),
      },
    } as never);
    expect(summary.using_guest_source).toBe(true);
    expect(summary.using_env_fallback).toBe(false);
  });
});
