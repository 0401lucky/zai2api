import type { CloudflareBindings } from "./bindings";
import type { AppServices } from "./services";

export type AppEnv = {
  Bindings: CloudflareBindings;
  Variables: {
    services: AppServices;
  };
};
