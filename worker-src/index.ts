import type { CloudflareBindings } from "./bindings";
import { createApp, runWorkerMaintenance } from "./app";

const app = createApp();

export default {
  fetch(request: Request, env: CloudflareBindings, executionCtx: ExecutionContext) {
    const url = new URL(request.url);
    const isApiPath =
      url.pathname === "/healthz" ||
      url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/v1/");

    if (!isApiPath && request.method === "GET") {
      return env.ASSETS.fetch(request);
    }
    return app.fetch(request, env, executionCtx);
  },
  async scheduled(_controller: ScheduledController, env: CloudflareBindings, executionCtx: ExecutionContext) {
    executionCtx.waitUntil(runWorkerMaintenance(env));
  },
};
