import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import type { AppEnv } from "./app-env";
import { LAST_ACCOUNT_POLL_AT_KEY } from "./config";
import { createAdminRoutes, runScheduledMaintenance } from "./routes/admin";
import { createOpenAIRoutes } from "./routes/openai";
import { createServices } from "./services";

export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.onError((error, c) => {
    if (error instanceof HTTPException) {
      const status = error.status;
      return c.json({ detail: error.message || "请求失败" }, status);
    }
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ detail: message || "服务内部错误" }, 500);
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
