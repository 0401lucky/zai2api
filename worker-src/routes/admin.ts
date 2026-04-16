import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import type { AppEnv } from "../app-env";
import { LOG_RETENTION_DAYS_KEY } from "../config";
import {
  accountSummary,
  buildSessionCookie,
  clearSessionCookie,
  currentLogRetentionDays,
  getCookieValue,
  logRetentionCutoff,
  requestFailureDetail,
  requestFailureStatusCode,
  serializeAccount,
  serializeGuestSource,
  serializeLog,
  serializeSecuritySettings,
} from "../helpers";
import type { AppServices } from "../services";

export function createAdminRoutes(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.get("/bootstrap", async (c) => {
    const services = c.get("services");
    const sessionId = getCookieValue(c.req.raw.headers.get("cookie"), services.config.adminCookieName);
    const loggedIn = await services.auth.verifyAdminSession(sessionId);
    const panelSource = await services.auth.panelPasswordSource();
    const apiSource = await services.auth.apiPasswordSource();
    return c.json({
      logged_in: loggedIn,
      panel_password: {
        source: panelSource,
        default_password_active: false,
        overridden_by_env: panelSource === "env",
      },
      api_password: {
        source: apiSource,
        enabled: await services.auth.isApiAuthEnabled(),
        overridden_by_env: apiSource === "env",
      },
      accounts: await accountSummary(services),
      guest_source: serializeGuestSource(await services.guestSource.getSnapshot()),
      frontend_ready: false,
      setup_required: panelSource === "disabled",
    });
  });

  app.post("/setup", async (c) => {
    const services = c.get("services");
    if ((await services.auth.panelPasswordSource()) !== "disabled") {
      throw new HTTPException(409, { message: "后台已经初始化，不能重复设置" });
    }
    if (!services.config.setupToken) {
      throw new HTTPException(503, { message: "缺少 SETUP_TOKEN，禁止匿名初始化" });
    }
    const authorization = c.req.raw.headers.get("authorization");
    const providedToken =
      authorization && authorization.toLowerCase().startsWith("bearer ")
        ? authorization.slice("bearer ".length).trim()
        : String(c.req.query("token") ?? "");
    if (providedToken !== services.config.setupToken) {
      throw new HTTPException(401, { message: "初始化令牌无效" });
    }
    const payload = (await c.req.json()) as Record<string, unknown>;
    const panelPassword = String(payload.panel_password ?? "").trim();
    if (!panelPassword) {
      throw new HTTPException(400, { message: "缺少 panel_password" });
    }
    await services.auth.updatePanelPassword(panelPassword);

    const apiPassword = String(payload.api_password ?? "").trim();
    if (apiPassword) {
      await services.auth.updateApiPassword(apiPassword);
    }

    if (payload.log_retention_days !== undefined && payload.log_retention_days !== null) {
      const retentionDays = Number.parseInt(String(payload.log_retention_days), 10);
      if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
        throw new HTTPException(400, { message: "log_retention_days 必须是大于 0 的整数" });
      }
      await services.repository.setSetting(LOG_RETENTION_DAYS_KEY, String(retentionDays));
    }

    await services.repository.addLog({
      level: "info",
      category: "settings",
      message: "已初始化安全设置",
    });
    const { sessionId, expiresAt } = await services.auth.createAdminSession();
    const response = c.json({
      ok: true,
      expires_at: expiresAt,
      security: await serializeSecuritySettings(services),
    });
    response.headers.append("Set-Cookie", buildSessionCookie(services.config, sessionId));
    return response;
  });

  app.post("/login", async (c) => {
    const services = c.get("services");
    if ((await services.auth.panelPasswordSource()) === "disabled") {
      throw new HTTPException(503, { message: "请先初始化后台密码" });
    }
    const payload = (await c.req.json()) as Record<string, unknown>;
    const password = String(payload.password ?? "");
    if (!(await services.auth.verifyPanelPassword(password))) {
      await services.repository.addLog({
        level: "warning",
        category: "admin_auth",
        message: "面板登录失败",
      });
      throw new HTTPException(401, { message: "密码错误" });
    }
    const { sessionId, expiresAt } = await services.auth.createAdminSession();
    await services.repository.addLog({
      level: "info",
      category: "admin_auth",
      message: "面板登录成功",
      details: { expires_at: expiresAt },
    });
    const response = c.json({ ok: true, expires_at: expiresAt });
    response.headers.append("Set-Cookie", buildSessionCookie(services.config, sessionId));
    return response;
  });

  app.post("/logout", async (c) => {
    const services = c.get("services");
    const sessionId = getCookieValue(c.req.raw.headers.get("cookie"), services.config.adminCookieName);
    await services.auth.deleteAdminSession(sessionId);
    await services.repository.addLog({
      level: "info",
      category: "admin_auth",
      message: "面板已退出登录",
    });
    const response = c.json({ ok: true });
    response.headers.append("Set-Cookie", clearSessionCookie(services.config));
    return response;
  });

  app.get("/session", async (c) => {
    const services = c.get("services");
    await requireAdminSession(c.req.raw, services);
    return c.json({
      authenticated: true,
      panel_password_source: await services.auth.panelPasswordSource(),
      api_password: {
        source: await services.auth.apiPasswordSource(),
        enabled: await services.auth.isApiAuthEnabled(),
      },
      accounts: await accountSummary(services),
    });
  });

  app.get("/accounts", async (c) => {
    const services = c.get("services");
    await requireAdminSession(c.req.raw, services);
    return c.json({
      accounts: (await services.accountPool.listAccounts()).map(serializeAccount),
      guest_source: serializeGuestSource(await services.accountPool.getGuestSourceSnapshot()),
    });
  });

  app.post("/accounts", async (c) => {
    const services = c.get("services");
    await requireAdminSession(c.req.raw, services);
    const payload = (await c.req.json()) as Record<string, unknown>;
    const jwt = String(payload.jwt ?? "").trim();
    if (!jwt) {
      throw new HTTPException(400, { message: "缺少 JWT" });
    }
    try {
      const account = await services.accountPool.registerJwt(jwt);
      return c.json({ account: serializeAccount(account) });
    } catch (error) {
      throw new HTTPException(requestFailureStatusCode(error) as 502 | 503, { message: requestFailureDetail(error) });
    }
  });

  app.post("/accounts/:accountId/enable", async (c) => {
    const services = c.get("services");
    await requireAdminSession(c.req.raw, services);
    return c.json({ account: serializeAccount(await services.accountPool.setAccountEnabled(Number(c.req.param("accountId")), true)) });
  });

  app.post("/accounts/:accountId/disable", async (c) => {
    const services = c.get("services");
    await requireAdminSession(c.req.raw, services);
    return c.json({ account: serializeAccount(await services.accountPool.setAccountEnabled(Number(c.req.param("accountId")), false)) });
  });

  app.post("/accounts/:accountId/check", async (c) => {
    const services = c.get("services");
    await requireAdminSession(c.req.raw, services);
    return c.json({ account: serializeAccount(await services.accountPool.checkAccount(Number(c.req.param("accountId")))) });
  });

  app.get("/logs", async (c) => {
    const services = c.get("services");
    await requireAdminSession(c.req.raw, services);
    const limit = Math.max(1, Math.min(Number.parseInt(c.req.query("limit") ?? "100", 10) || 100, 500));
    return c.json({ logs: (await services.repository.listLogs(limit)).map(serializeLog) });
  });

  app.get("/settings/security", async (c) => {
    const services = c.get("services");
    await requireAdminSession(c.req.raw, services);
    return c.json(await serializeSecuritySettings(services));
  });

  app.post("/settings/security", async (c) => {
    const services = c.get("services");
    await requireAdminSession(c.req.raw, services);
    const payload = (await c.req.json()) as Record<string, unknown>;
    const changed: string[] = [];

    const panelPassword = String(payload.panel_password ?? "").trim();
    if (panelPassword) {
      await services.auth.updatePanelPassword(panelPassword);
      changed.push("panel_password");
    }

    if (payload.disable_api_password) {
      await services.auth.updateApiPassword(null);
      changed.push("api_password_disabled");
    } else {
      const apiPassword = String(payload.api_password ?? "").trim();
      if (apiPassword) {
        await services.auth.updateApiPassword(apiPassword);
        changed.push("api_password");
      }
    }

    if (payload.log_retention_days !== undefined && payload.log_retention_days !== null) {
      const retentionDays = Number.parseInt(String(payload.log_retention_days), 10);
      if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
        throw new HTTPException(400, { message: "log_retention_days 必须是大于 0 的整数" });
      }
      await services.repository.setSetting(LOG_RETENTION_DAYS_KEY, String(retentionDays));
      await services.repository.deleteLogsBefore(logRetentionCutoff(retentionDays));
      changed.push("log_retention_days");
    }

    if (!changed.length) {
      throw new HTTPException(400, { message: "未提交任何安全配置变更" });
    }

    await services.repository.addLog({
      level: "info",
      category: "settings",
      message: "已更新安全设置",
      details: { changed },
    });
    return c.json(await serializeSecuritySettings(services));
  });

  return app;
}

export async function runScheduledMaintenance(services: AppServices, lastAccountPollAtKey: string): Promise<void> {
  await services.repository.deleteExpiredAdminSessions();
  await services.repository.deleteLogsBefore(logRetentionCutoff(await currentLogRetentionDays(services)));
  if (services.config.accountPollIntervalSeconds <= 0) {
    return;
  }
  const now = Math.floor(Date.now() / 1000);
  const lastPoll = Number.parseInt((await services.repository.getSetting(lastAccountPollAtKey)) ?? "0", 10) || 0;
  if (now - lastPoll < services.config.accountPollIntervalSeconds) {
    return;
  }
  await services.repository.setSetting(lastAccountPollAtKey, String(now));
  try {
    await services.accountPool.checkAllAccounts();
  } catch (error) {
    await services.repository.addLog({
      level: "warning",
      category: "accounts",
      message: "后台账号健康检查失败",
      details: { error: requestFailureDetail(error) },
    });
  }
}

async function requireAdminSession(request: Request, services: AppServices): Promise<void> {
  const sessionId = getCookieValue(request.headers.get("cookie"), services.config.adminCookieName);
  if (await services.auth.verifyAdminSession(sessionId)) {
    return;
  }
  throw new HTTPException(401, { message: "需要先完成面板登录" });
}
