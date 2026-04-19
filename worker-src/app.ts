import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import type { AppEnv } from "./app-env";
import { LAST_ACCOUNT_POLL_AT_KEY } from "./config";
import { PUBLIC_INTERNAL_ERROR_MESSAGE } from "./helpers";
import { createAdminRoutes, runScheduledMaintenance } from "./routes/admin";
import { createOpenAIRoutes } from "./routes/openai";
import { createServices } from "./services";

export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.onError(async (error, c) => {
    if (error instanceof HTTPException) {
      const status = error.status;
      return c.json({ detail: error.message || "请求失败" }, status);
    }
    const detail = error instanceof Error ? error.stack ?? error.message : String(error);
    try {
      const services = c.get("services");
      await services.repository.addLog({
        level: "error",
        category: "server",
        message: "发生未处理异常",
        details: { path: c.req.path, error: detail },
      });
    } catch {
      console.error("Unhandled application error:", detail);
    }
    return c.json({ detail: PUBLIC_INTERNAL_ERROR_MESSAGE }, 500);
  });

  app.use("*", async (c, next) => {
    c.set("services", createServices(c.env));
    await next();
  });

  app.get("/healthz", (c) => c.json({ status: "ok" }));
  app.route("/api/admin", createAdminRoutes());
  app.route("/v1", createOpenAIRoutes());

  return app;
}

export async function runWorkerMaintenance(env: AppEnv["Bindings"]): Promise<void> {
  await runScheduledMaintenance(createServices(env), LAST_ACCOUNT_POLL_AT_KEY);
}
