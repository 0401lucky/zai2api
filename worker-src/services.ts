import type { CloudflareBindings } from "./bindings";
import { AccountPool } from "./account-pool";
import { AuthService } from "./auth";
import { loadConfig, type AppConfig } from "./config";
import { D1Repository } from "./repository";

export interface AppServices {
  config: AppConfig;
  repository: D1Repository;
  auth: AuthService;
  accountPool: AccountPool;
}

export function createServices(env: CloudflareBindings): AppServices {
  const config = loadConfig(env);
  const repository = new D1Repository(env.DB, env.ACCOUNT_ENCRYPTION_KEY, config.logRetentionDaysEnv);
  const auth = new AuthService(config, repository);
  const accountPool = new AccountPool(config, repository);
  return { config, repository, auth, accountPool };
}
