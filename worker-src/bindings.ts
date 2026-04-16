export interface AssetBinding {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface CloudflareBindings {
  DB: D1Database;
  ASSETS: AssetBinding;
  ACCOUNT_ENCRYPTION_KEY: string;
  SETUP_TOKEN?: string;
  PANEL_PASSWORD?: string;
  API_PASSWORD?: string;
  ZAI_JWT?: string;
  ZAI_SESSION_TOKEN?: string;
  ZAI_GUEST_ENABLED?: string;
  ZAI_BASE_URL?: string;
  DEFAULT_MODEL?: string;
  LOG_LEVEL?: string;
  REQUEST_TIMEOUT?: string;
  LOG_RETENTION_DAYS?: string;
  ACCOUNT_POLL_INTERVAL_SECONDS?: string;
  ACCOUNT_ERROR_THRESHOLD?: string;
  ACCOUNT_COOLDOWN_SECONDS?: string;
  ADMIN_COOKIE_NAME?: string;
  ADMIN_SESSION_TTL_HOURS?: string;
  ADMIN_COOKIE_SECURE?: string;
  ADMIN_PASSWORD?: string;
}

export type PasswordSource = "env" | "database" | "disabled";
export type AccountStatus = "active" | "unknown" | "disabled" | "invalid" | "error";
export type GuestSourceStatus = "disabled" | "idle" | "active" | "cooldown" | "error";

export interface AccountRecord {
  id: number;
  jwt: string | null;
  sessionToken: string | null;
  userId: string | null;
  email: string | null;
  name: string | null;
  enabled: boolean;
  status: AccountStatus;
  lastCheckedAt: number | null;
  lastError: string | null;
  failureCount: number;
  requestCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface LogRecord {
  id: number;
  createdAt: number;
  level: string;
  category: string;
  message: string;
  details: Record<string, unknown> | null;
}

export interface SessionState {
  token: string;
  userId: string;
  name: string;
  email: string;
  role: string;
}

export interface UpstreamChunk {
  phase: string | null;
  text: string;
  usage?: TokenUsage | null;
  done?: boolean;
  error?: string | null;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface UpstreamResult {
  answerText: string;
  reasoningText: string;
  usage: TokenUsage;
  finishReason: string;
}

export interface GuestSourceSnapshot {
  enabled: boolean;
  status: GuestSourceStatus;
  inRotation: boolean;
  lastRefreshedAt: number | null;
  lastError: string | null;
  requestCount: number;
  cooldownUntil: number | null;
  lastUserId: string | null;
}
