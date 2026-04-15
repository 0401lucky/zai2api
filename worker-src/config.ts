import type { CloudflareBindings } from "./bindings";
import { parseBoolean, parseInteger } from "./utils";

export interface AppConfig {
  logLevel: string;
  zaiBaseUrl: string;
  zaiJwt: string | null;
  zaiSessionToken: string | null;
  setupToken: string | null;
  defaultModel: string;
  requestTimeoutMs: number;
  panelPasswordEnv: string | null;
  apiPasswordEnv: string | null;
  adminCookieName: string;
  adminSessionTtlSeconds: number;
  adminCookieSecure: boolean;
  accountPollIntervalSeconds: number;
  accountErrorThreshold: number;
  accountCooldownSeconds: number;
  logRetentionDaysEnv: number | null;
}

export const DEFAULT_LOG_RETENTION_DAYS = 7;
export const DEFAULT_ADMIN_COOKIE_NAME = "zai2api_admin_session";
export const PANEL_PASSWORD_KEY = "panel_password_hash";
export const API_PASSWORD_KEY = "api_password_hash";
export const LOG_RETENTION_DAYS_KEY = "log_retention_days";
export const LAST_ACCOUNT_POLL_AT_KEY = "last_account_poll_at";

export function loadConfig(env: CloudflareBindings): AppConfig {
  const ttlHours = parseInteger(env.ADMIN_SESSION_TTL_HOURS, 168);
  return {
    logLevel: env.LOG_LEVEL ?? "info",
    zaiBaseUrl: env.ZAI_BASE_URL ?? "https://chat.z.ai",
    zaiJwt: env.ZAI_JWT ?? null,
    zaiSessionToken: env.ZAI_SESSION_TOKEN ?? null,
    setupToken: env.SETUP_TOKEN ?? null,
    defaultModel: env.DEFAULT_MODEL ?? "glm-5",
    requestTimeoutMs: parseInteger(env.REQUEST_TIMEOUT, 120) * 1000,
    panelPasswordEnv: env.PANEL_PASSWORD ?? env.ADMIN_PASSWORD ?? null,
    apiPasswordEnv: env.API_PASSWORD ?? null,
    adminCookieName: env.ADMIN_COOKIE_NAME ?? DEFAULT_ADMIN_COOKIE_NAME,
    adminSessionTtlSeconds: ttlHours * 3600,
    adminCookieSecure: parseBoolean(env.ADMIN_COOKIE_SECURE, true),
    accountPollIntervalSeconds: parseInteger(env.ACCOUNT_POLL_INTERVAL_SECONDS, 300),
    accountErrorThreshold: parseInteger(env.ACCOUNT_ERROR_THRESHOLD, 3),
    accountCooldownSeconds: parseInteger(env.ACCOUNT_COOLDOWN_SECONDS, 60),
    logRetentionDaysEnv: env.LOG_RETENTION_DAYS ? parseInteger(env.LOG_RETENTION_DAYS, DEFAULT_LOG_RETENTION_DAYS) : null,
  };
}
