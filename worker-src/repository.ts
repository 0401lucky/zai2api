import type { AccountRecord, LogRecord } from "./bindings";
import { DEFAULT_LOG_RETENTION_DAYS, LOG_RETENTION_DAYS_KEY } from "./config";
import { decryptSecret, encryptSecret } from "./crypto";
import { nowSeconds, safeJsonParse } from "./utils";

interface AccountRow {
  id: number;
  jwt: string | null;
  session_token: string | null;
  user_id: string | null;
  email: string | null;
  name: string | null;
  enabled: number;
  status: string;
  last_checked_at: number | null;
  last_error: string | null;
  failure_count: number;
  request_count: number;
  created_at: number;
  updated_at: number;
}

interface LogRow {
  id: number;
  created_at: number;
  level: string;
  category: string;
  message: string;
  details: string | null;
}

interface SessionRow {
  id: string;
  created_at: number;
  expires_at: number;
}

interface ExistingAccountCandidateRow {
  id: number;
  user_id: string | null;
  email: string | null;
}

interface AccountSummaryRow {
  total: number | null;
  enabled_total: number | null;
  healthy_total: number | null;
}

const LOG_STRING_MAX_LENGTH = 2_000;
const LOG_REDACTED = "[已脱敏]";
const SENSITIVE_DETAIL_KEY_PATTERN = /(jwt|token|secret|password|cookie|authorization|api[_-]?key|session([_-]?id|[_-]?token)?)/i;

export function sanitizeLogDetails(details: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!details) {
    return null;
  }
  return sanitizeLogObject(details, 0);
}

export interface AccountSummaryCounts {
  persistedTotal: number;
  persistedEnabled: number;
  persistedHealthy: number;
}

export function pickExistingAccountCandidate(
  rows: ExistingAccountCandidateRow[],
  userId: string | null,
  email: string | null,
): { id: number } | null {
  const normalizedUserId = normalizeIdentifier(userId);
  const normalizedEmail = normalizeIdentifier(email);
  const hasStableUserId = Boolean(normalizedUserId && normalizedUserId !== "unknown");

  if (hasStableUserId) {
    const exactUserMatches = rows.filter((row) => normalizeIdentifier(row.user_id) === normalizedUserId);
    if (exactUserMatches.length) {
      if (normalizedEmail) {
        const exactUserAndEmail = exactUserMatches.find((row) => normalizeIdentifier(row.email) === normalizedEmail);
        if (exactUserAndEmail) {
          return { id: Number(exactUserAndEmail.id) };
        }
      }
      return { id: Number(exactUserMatches[0].id) };
    }
  }

  if (normalizedEmail) {
    const provisionalEmailMatch = rows.find((row) => {
      const rowUserId = normalizeIdentifier(row.user_id);
      return normalizeIdentifier(row.email) === normalizedEmail && (!rowUserId || rowUserId === "unknown");
    });
    if (provisionalEmailMatch) {
      return { id: Number(provisionalEmailMatch.id) };
    }
  }

  return null;
}

export class D1Repository {
  constructor(
    private readonly db: D1Database,
    private readonly encryptionSecret: string,
    private readonly logRetentionDaysOverride: number | null,
  ) {}

  async getSetting(key: string): Promise<string | null> {
    const row = await this.db.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first<{ value: string }>();
    return row?.value ?? null;
  }

  async getSettings(keys: string[]): Promise<Record<string, string>> {
    if (!keys.length) {
      return {};
    }
    const placeholders = keys.map(() => "?").join(", ");
    const result = await this.db
      .prepare(`SELECT key, value FROM settings WHERE key IN (${placeholders})`)
      .bind(...keys)
      .all<{ key: string; value: string }>();
    const rows = result.results ?? [];
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  async setSetting(key: string, value: string): Promise<void> {
    const now = nowSeconds();
    await this.db
      .prepare(
        `INSERT INTO settings(key, value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .bind(key, value, now)
      .run();
  }

  async deleteSetting(key: string): Promise<void> {
    await this.db.prepare("DELETE FROM settings WHERE key = ?").bind(key).run();
  }

  async createAdminSession(sessionId: string, expiresAt: number): Promise<void> {
    const now = nowSeconds();
    await this.db
      .prepare("INSERT INTO admin_sessions(id, created_at, expires_at) VALUES (?, ?, ?)")
      .bind(sessionId, now, expiresAt)
      .run();
  }

  async getAdminSession(sessionId: string): Promise<SessionRow | null> {
    const row = await this.db
      .prepare("SELECT id, created_at, expires_at FROM admin_sessions WHERE id = ?")
      .bind(sessionId)
      .first<SessionRow>();
    return row ?? null;
  }

  async deleteAdminSession(sessionId: string): Promise<void> {
    await this.db.prepare("DELETE FROM admin_sessions WHERE id = ?").bind(sessionId).run();
  }

  async deleteExpiredAdminSessions(now = nowSeconds()): Promise<number> {
    const result = await this.db.prepare("DELETE FROM admin_sessions WHERE expires_at <= ?").bind(now).run();
    return Number(result.meta.changes ?? 0);
  }

  async upsertAccount(input: {
    jwt: string | null;
    sessionToken: string | null;
    userId: string | null;
    email: string | null;
    name: string | null;
    enabled?: boolean;
    status?: string;
    lastCheckedAt?: number | null;
    lastError?: string | null;
    failureCount?: number;
  }): Promise<AccountRecord> {
    const now = nowSeconds();
    const checkedAt = input.lastCheckedAt ?? now;
    const existing = await this.findExistingAccountRow(input.userId, input.email);
    const jwt = await encryptSecret(input.jwt, this.encryptionSecret);
    const sessionToken = await encryptSecret(input.sessionToken, this.encryptionSecret);

    if (existing === null) {
      const result = await this.db
        .prepare(
          `INSERT INTO accounts(
             jwt, session_token, user_id, email, name, enabled, status,
             last_checked_at, last_error, failure_count, request_count, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        )
        .bind(
          jwt,
          sessionToken,
          input.userId,
          input.email,
          input.name,
          input.enabled === false ? 0 : 1,
          input.status ?? "active",
          checkedAt,
          input.lastError ?? null,
          input.failureCount ?? 0,
          now,
          now,
        )
        .run();
      return this.getAccount(Number(result.meta.last_row_id)) as Promise<AccountRecord>;
    }

    await this.db
      .prepare(
        `UPDATE accounts
         SET jwt = ?, session_token = ?, user_id = ?, email = ?, name = ?,
             enabled = ?, status = ?, last_checked_at = ?, last_error = ?,
             failure_count = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        jwt,
        sessionToken,
        input.userId,
        input.email,
        input.name,
        input.enabled === false ? 0 : 1,
        input.status ?? "active",
        checkedAt,
        input.lastError ?? null,
        input.failureCount ?? 0,
        now,
        existing.id,
      )
      .run();

    return this.getAccount(existing.id) as Promise<AccountRecord>;
  }

  async listAccounts(options: { enabledOnly?: boolean; healthyOnly?: boolean } = {}): Promise<AccountRecord[]> {
    const clauses: string[] = [];
    const params: Array<string | number> = [];
    if (options.enabledOnly) {
      clauses.push("enabled = 1");
    }
    if (options.healthyOnly) {
      clauses.push("status IN ('active', 'unknown')");
      clauses.push("(session_token IS NOT NULL OR jwt IS NOT NULL)");
    }
    const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const result = await this.db.prepare(`SELECT * FROM accounts ${whereSql} ORDER BY id ASC`).bind(...params).all<AccountRow>();
    const rows = result.results ?? [];
    return Promise.all(rows.map((row) => this.rowToAccount(row)));
  }

  async countAccounts(enabledOnly = false): Promise<number> {
    const sql = enabledOnly
      ? "SELECT COUNT(*) AS total FROM accounts WHERE enabled = 1"
      : "SELECT COUNT(*) AS total FROM accounts";
    const row = await this.db.prepare(sql).first<{ total: number }>();
    return Number(row?.total ?? 0);
  }

  async getAccountSummaryCounts(): Promise<AccountSummaryCounts> {
    const row = await this.db
      .prepare(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) AS enabled_total,
           SUM(
             CASE
               WHEN enabled = 1
                AND status IN ('active', 'unknown')
                AND (session_token IS NOT NULL OR jwt IS NOT NULL)
               THEN 1
               ELSE 0
             END
           ) AS healthy_total
         FROM accounts`,
      )
      .first<AccountSummaryRow>();
    return {
      persistedTotal: Number(row?.total ?? 0),
      persistedEnabled: Number(row?.enabled_total ?? 0),
      persistedHealthy: Number(row?.healthy_total ?? 0),
    };
  }

  async getAccount(accountId: number): Promise<AccountRecord | null> {
    const row = await this.db.prepare("SELECT * FROM accounts WHERE id = ?").bind(accountId).first<AccountRow>();
    return row ? this.rowToAccount(row) : null;
  }

  async setAccountEnabled(accountId: number, enabled: boolean): Promise<void> {
    const now = nowSeconds();
    const status = enabled ? "active" : "disabled";
    await this.db
      .prepare("UPDATE accounts SET enabled = ?, status = ?, updated_at = ? WHERE id = ?")
      .bind(enabled ? 1 : 0, status, now, accountId)
      .run();
  }

  async markAccountSuccess(
    accountId: number,
    input: {
      sessionToken?: string | null;
      name?: string | null;
      email?: string | null;
      countRequest?: boolean;
    } = {},
  ): Promise<void> {
    const now = nowSeconds();
    const existing = await this.db
      .prepare("SELECT session_token, name, email FROM accounts WHERE id = ?")
      .bind(accountId)
      .first<{ session_token: string | null; name: string | null; email: string | null }>();
    if (!existing) {
      return;
    }
    const nextSessionToken = input.sessionToken !== undefined ? await encryptSecret(input.sessionToken, this.encryptionSecret) : existing.session_token;
    await this.db
      .prepare(
        `UPDATE accounts
         SET session_token = ?, name = ?, email = ?, enabled = 1, status = 'active',
             last_checked_at = ?, last_error = NULL, failure_count = 0,
             request_count = request_count + ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        nextSessionToken,
        input.name ?? existing.name,
        input.email ?? existing.email,
        now,
        input.countRequest ? 1 : 0,
        now,
        accountId,
      )
      .run();
  }

  async markAccountFailure(accountId: number, error: string, disable: boolean, threshold = 1): Promise<void> {
    const now = nowSeconds();
    const row = await this.db
      .prepare("SELECT failure_count, status FROM accounts WHERE id = ?")
      .bind(accountId)
      .first<{ failure_count: number; status: string }>();
    if (!row) {
      return;
    }
    const failureCount = Number(row.failure_count ?? 0) + 1;
    const shouldMarkError = !disable && failureCount >= threshold;
    const nextStatus = disable ? "invalid" : shouldMarkError ? "error" : row.status;
    await this.db
      .prepare(
        `UPDATE accounts
         SET enabled = CASE WHEN ? THEN 0 ELSE enabled END,
             status = ?,
             last_checked_at = ?,
             last_error = ?,
             failure_count = ?,
             updated_at = ?
         WHERE id = ?`,
      )
      .bind(disable ? 1 : 0, nextStatus, now, error, failureCount, now, accountId)
      .run();
  }

  async listCooldownAccounts(cooldownSeconds: number): Promise<AccountRecord[]> {
    const cutoff = nowSeconds() - cooldownSeconds;
    const result = await this.db
      .prepare(
        `SELECT * FROM accounts
         WHERE enabled = 1
           AND status = 'error'
           AND (session_token IS NOT NULL OR jwt IS NOT NULL)
           AND last_checked_at <= ?
         ORDER BY failure_count ASC, last_checked_at ASC`,
      )
      .bind(cutoff)
      .all<AccountRow>();
    return Promise.all((result.results ?? []).map((row) => this.rowToAccount(row)));
  }

  async addLog(input: {
    level: string;
    category: string;
    message: string;
    details?: Record<string, unknown> | null;
  }): Promise<void> {
    const sanitizedDetails = sanitizeLogDetails(input.details);
    await this.db
      .prepare("INSERT INTO logs(created_at, level, category, message, details) VALUES (?, ?, ?, ?, ?)")
      .bind(nowSeconds(), input.level, input.category, input.message, sanitizedDetails ? JSON.stringify(sanitizedDetails) : null)
      .run();
  }

  async listLogs(limit = 100): Promise<LogRecord[]> {
    const result = await this.db
      .prepare("SELECT id, created_at, level, category, message, details FROM logs ORDER BY id DESC LIMIT ?")
      .bind(limit)
      .all<LogRow>();
    return (result.results ?? []).map((row) => ({
      id: Number(row.id),
      createdAt: Number(row.created_at),
      level: row.level,
      category: row.category,
      message: row.message,
      details: safeJsonParse<Record<string, unknown>>(row.details),
    }));
  }

  async deleteLogsBefore(cutoff: number): Promise<number> {
    const result = await this.db.prepare("DELETE FROM logs WHERE created_at < ?").bind(cutoff).run();
    return Number(result.meta.changes ?? 0);
  }

  async currentLogRetentionDays(): Promise<number> {
    if (this.logRetentionDaysOverride !== null) {
      return Math.max(1, this.logRetentionDaysOverride);
    }
    const stored = await this.getSetting(LOG_RETENTION_DAYS_KEY);
    if (stored !== null) {
      const parsed = Number.parseInt(stored, 10);
      if (Number.isFinite(parsed)) {
        return Math.max(1, parsed);
      }
    }
    return DEFAULT_LOG_RETENTION_DAYS;
  }

  private async findExistingAccountRow(userId: string | null, email: string | null): Promise<{ id: number } | null> {
    const clauses: string[] = [];
    const params: string[] = [];
    if (userId) {
      clauses.push("user_id = ?");
      params.push(userId);
    }
    if (email) {
      clauses.push("email = ?");
      params.push(email);
    }
    if (!clauses.length) {
      return null;
    }
    const result = await this.db
      .prepare(`SELECT id, user_id, email FROM accounts WHERE ${clauses.join(" OR ")} ORDER BY id ASC`)
      .bind(...params)
      .all<ExistingAccountCandidateRow>();
    return pickExistingAccountCandidate(result.results ?? [], userId, email);
  }

  private async rowToAccount(row: AccountRow): Promise<AccountRecord> {
    return {
      id: Number(row.id),
      jwt: await decryptSecret(row.jwt, this.encryptionSecret),
      sessionToken: await decryptSecret(row.session_token, this.encryptionSecret),
      userId: row.user_id,
      email: row.email,
      name: row.name,
      enabled: Boolean(row.enabled),
      status: row.status as AccountRecord["status"],
      lastCheckedAt: row.last_checked_at === null ? null : Number(row.last_checked_at),
      lastError: row.last_error,
      failureCount: Number(row.failure_count ?? 0),
      requestCount: Number(row.request_count ?? 0),
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    };
  }
}

function normalizeIdentifier(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function sanitizeLogObject(input: Record<string, unknown>, depth: number): Record<string, unknown> {
  if (depth >= 6) {
    return { truncated: true };
  }
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    output[key] = sanitizeLogValue(key, value, depth + 1);
  }
  return output;
}

function sanitizeLogValue(key: string, value: unknown, depth: number): unknown {
  if (value === null || value === undefined) {
    return value ?? null;
  }
  if (SENSITIVE_DETAIL_KEY_PATTERN.test(key)) {
    return LOG_REDACTED;
  }
  if (typeof value === "string") {
    return sanitizeLogString(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    if (depth >= 6) {
      return [LOG_REDACTED];
    }
    return value.map((item) => sanitizeLogValue(key, item, depth + 1));
  }
  if (typeof value === "object") {
    return sanitizeLogObject(value as Record<string, unknown>, depth + 1);
  }
  return String(value);
}

function sanitizeLogString(value: string): string {
  const cleaned = value
    .replace(
      /((?:jwt|token|secret|password|cookie|authorization|api[_-]?key|session(?:[_-]?id|[_-]?token)?)\s*[=:]\s*)(?:Bearer\s+)?[^\s",;]+/gi,
      `$1${LOG_REDACTED}`,
    )
    .replace(/Bearer\s+[^\s",;]+/gi, "Bearer [已脱敏]")
    .replace(/(enc:v\d:)[^\s",;]+/gi, "$1[已脱敏]");
  if (cleaned.length <= LOG_STRING_MAX_LENGTH) {
    return cleaned;
  }
  return `${cleaned.slice(0, LOG_STRING_MAX_LENGTH)}...[已截断]`;
}
