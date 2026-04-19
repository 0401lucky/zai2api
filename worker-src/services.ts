import type { CloudflareBindings } from "./bindings";
import { AccountPool } from "./account-pool";
import { AuthService } from "./auth";
import { loadConfig, type AppConfig } from "./config";
import { GuestSourceManager } from "./guest-source";
import { D1Repository } from "./repository";

export interface AppServices {
  config: AppConfig;
  repository: D1Repository;
  auth: AuthService;
  guestSource: GuestSourceManager;
  accountPool: AccountPool;
}

const servicesCache = new WeakMap<CloudflareBindings, AppServices>();

export function createServices(env: CloudflareBindings): AppServices {
  const cached = servicesCache.get(env);
  if (cached) {
    return cached;
  }
  const config = loadConfig(env);
  const repository = new D1Repository(env.DB, env.ACCOUNT_ENCRYPTION_KEY, config.logRetentionDaysEnv);
  const auth = new AuthService(config, repository);
  const guestSource = new GuestSourceManager(config, repository);
  const accountPool = new AccountPool(config, repository, guestSource);
  const services = { config, repository, auth, guestSource, accountPool };
  servicesCache.set(env, services);
  return services;
}
