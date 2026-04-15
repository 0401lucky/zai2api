import type { AccountRecord, LogRecord, PasswordSource } from "./bindings";
import { DEFAULT_LOG_RETENTION_DAYS, LOG_RETENTION_DAYS_KEY, type AppConfig } from "./config";
import type { AppServices } from "./services";
import { maskSecret, nowSeconds, randomId } from "./utils";
import { UpstreamHttpError, UpstreamRequestError, describeHttpError } from "./zai-client";

export const NOTHINKING_MODEL_SUFFIX = "-nothinking";
export const PUBLIC_MODEL_ALIASES: Record<string, string> = {
  "glm-5": "glm-5",
  "glm-5.1": "GLM-5.1",
  "glm-5-turbo": "GLM-5-Turbo",
  "glm-4.7": "GLM-4.7",
};
const UPSTREAM_TO_PUBLIC_MAP = Object.fromEntries(
  Object.entries(PUBLIC_MODEL_ALIASES).map(([publicName, upstream]) => [upstream, publicName]),
);

export async function accountSummary(services: AppServices): Promise<Record<string, unknown>> {
  const persistedHealthy = (await services.repository.listAccounts({ enabledOnly: true, healthyOnly: true })).length;
  const persistedEnabled = await services.repository.countAccounts(true);
  return {
    persisted_total: await services.repository.countAccounts(false),
    persisted_enabled: persistedEnabled,
    persisted_healthy: persistedHealthy,
    using_env_fallback: persistedHealthy === 0 && Boolean(services.config.zaiJwt || services.config.zaiSessionToken),
  };
}

export function serializeAccount(account: AccountRecord): Record<string, unknown> {
  return {
    id: account.id,
    user_id: account.userId,
    email: account.email,
    name: account.name,
    enabled: account.enabled,
    status: account.status,
    last_checked_at: account.lastCheckedAt,
    last_error: account.lastError,
    failure_count: account.failureCount,
    request_count: account.requestCount,
    masked_jwt: maskSecret(account.jwt),
    masked_session_token: maskSecret(account.sessionToken),
    created_at: account.createdAt,
    updated_at: account.updatedAt,
  };
}

export function serializeLog(log: LogRecord): Record<string, unknown> {
  return {
    id: log.id,
    created_at: log.createdAt,
    level: log.level,
    category: log.category,
    message: log.message,
    details: log.details,
  };
}

export async function serializeSecuritySettings(services: AppServices): Promise<Record<string, unknown>> {
  const panelSource = await services.auth.panelPasswordSource();
  const apiSource = await services.auth.apiPasswordSource();
  const logRetentionSource = await logRetentionDaysSource(services);
  return {
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
    log_retention: {
      days: await currentLogRetentionDays(services),
      source: logRetentionSource,
      overridden_by_env: logRetentionSource === "env",
      default_active: logRetentionSource === "default",
    },
    poll_interval_seconds: services.config.accountPollIntervalSeconds,
  };
}

export async function currentLogRetentionDays(services: AppServices): Promise<number> {
  if (services.config.logRetentionDaysEnv !== null) {
    return Math.max(1, services.config.logRetentionDaysEnv);
  }
  const stored = await services.repository.getSetting(LOG_RETENTION_DAYS_KEY);
  if (stored !== null) {
    const parsed = Number.parseInt(stored, 10);
    if (Number.isFinite(parsed)) {
      return Math.max(1, parsed);
    }
  }
  return DEFAULT_LOG_RETENTION_DAYS;
}

export async function logRetentionDaysSource(services: AppServices): Promise<PasswordSource | "default"> {
  if (services.config.logRetentionDaysEnv !== null) {
    return "env";
  }
  if (await services.repository.getSetting(LOG_RETENTION_DAYS_KEY)) {
    return "database";
  }
  return "default";
}

export function logRetentionCutoff(retentionDays: number): number {
  return nowSeconds() - Math.max(1, retentionDays) * 86400;
}

export function normalizePublicModelName(requestedModel: string): string {
  const normalizedModel = requestedModel.trim();
  if (!normalizedModel) {
    return "glm-5";
  }
  const hasNoThinking = normalizedModel.toLowerCase().endsWith(NOTHINKING_MODEL_SUFFIX);
  const baseModel = hasNoThinking ? normalizedModel.slice(0, -NOTHINKING_MODEL_SUFFIX.length) : normalizedModel;
  const publicModel = canonicalPublicModelName(baseModel);
  return hasNoThinking ? `${publicModel}${NOTHINKING_MODEL_SUFFIX}` : publicModel;
}

export function resolveModelRequest(requestedModel: string): { upstreamModel: string; enableThinking: boolean } {
  const normalizedModel = normalizePublicModelName(requestedModel);
  if (normalizedModel.endsWith(NOTHINKING_MODEL_SUFFIX)) {
    const publicModel = normalizedModel.slice(0, -NOTHINKING_MODEL_SUFFIX.length) || normalizedModel;
    return { upstreamModel: PUBLIC_MODEL_ALIASES[publicModel] ?? publicModel, enableThinking: false };
  }
  return { upstreamModel: PUBLIC_MODEL_ALIASES[normalizedModel] ?? normalizedModel, enableThinking: true };
}

export function availableModels(config: AppConfig): string[] {
  const models: string[] = [];
  const defaultModel = normalizePublicModelName(config.defaultModel);
  if (!models.includes(defaultModel)) {
    models.push(defaultModel);
  }
  for (const model of Object.keys(PUBLIC_MODEL_ALIASES)) {
    if (!models.includes(model)) {
      models.push(model);
    }
  }
  return models.flatMap((model) => [model, `${model}${NOTHINKING_MODEL_SUFFIX}`]);
}

export function requestFailureStatusCode(error: unknown): number {
  if (error instanceof UpstreamHttpError || error instanceof UpstreamRequestError) {
    return 502;
  }
  return 503;
}

export function requestFailureDetail(error: unknown): string {
  return describeHttpError(error);
}

export function buildSessionCookie(config: AppConfig, sessionId: string): string {
  return `${config.adminCookieName}=${sessionId}; Max-Age=${config.adminSessionTtlSeconds}; Path=/; HttpOnly; SameSite=Lax${config.adminCookieSecure ? "; Secure" : ""}`;
}

export function clearSessionCookie(config: AppConfig): string {
  return `${config.adminCookieName}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${config.adminCookieSecure ? "; Secure" : ""}`;
}

export function getCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) {
    return null;
  }
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      return rest.join("=") || null;
    }
  }
  return null;
}

export function makeChatCompletionId(): string {
  return `chatcmpl-${randomId(16)}`;
}

export function makeResponseId(): string {
  return `resp_${randomId(16)}`;
}

export function sseJson(payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

export function chatStreamErrorEvent(input: { completionId: string; created: number; model: string; message: string }): Uint8Array {
  return sseJson({
    error: {
      message: input.message,
      type: "upstream_error",
      code: "upstream_stream_error",
    },
    id: input.completionId,
    object: "chat.completion.chunk",
    created: input.created,
    model: input.model,
  });
}

export function responseStreamFailedEvent(input: { responseId: string; created: number; model: string; message: string }): Uint8Array {
  return sseJson({
    type: "response.failed",
    response: {
      id: input.responseId,
      object: "response",
      created: input.created,
      model: input.model,
      status: "failed",
      error: {
        message: input.message,
        type: "upstream_error",
        code: "upstream_stream_error",
      },
    },
  });
}

function canonicalPublicModelName(requestedModel: string): string {
  const lower = requestedModel.toLowerCase();
  if (lower in PUBLIC_MODEL_ALIASES) {
    return lower;
  }
  return UPSTREAM_TO_PUBLIC_MAP[requestedModel] ?? requestedModel;
}
