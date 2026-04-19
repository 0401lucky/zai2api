import type { PasswordSource } from "./bindings";
import { API_PASSWORD_KEY, PANEL_PASSWORD_KEY, type AppConfig } from "./config";
import { hashPassword, makeSessionId, timingSafeEqualString, verifyPassword } from "./crypto";
import { D1Repository } from "./repository";
import { nowSeconds, safeJsonParse } from "./utils";

type AdminAuthAction = "login" | "setup";

interface AdminRateLimitState {
  failedCount: number;
  firstFailedAt: number;
  lockedUntil: number | null;
}

interface StoredAuthSettings {
  panelPasswordHash: string | null;
  apiPasswordHash: string | null;
}

export class AuthService {
  private storedAuthSettingsPromise: Promise<StoredAuthSettings> | null = null;

  constructor(
    private readonly config: AppConfig,
    private readonly repository: D1Repository,
  ) {}

  async panelPasswordSource(): Promise<PasswordSource> {
    if (this.config.panelPasswordEnv) {
      return "env";
    }
    if ((await this.loadStoredAuthSettings()).panelPasswordHash) {
      return "database";
    }
    return "disabled";
  }

  async apiPasswordSource(): Promise<PasswordSource> {
    if (this.config.apiPasswordEnv) {
      return "env";
    }
    if ((await this.loadStoredAuthSettings()).apiPasswordHash) {
      return "database";
    }
    return "disabled";
  }

  async isApiAuthEnabled(): Promise<boolean> {
    return (await this.apiPasswordSource()) !== "disabled";
  }

  async verifyPanelPassword(password: string): Promise<boolean> {
    if (this.config.panelPasswordEnv !== null) {
      return timingSafeEqualString(password, this.config.panelPasswordEnv);
    }
    const stored = (await this.loadStoredAuthSettings()).panelPasswordHash;
    if (!stored) {
      return false;
    }
    return verifyPassword(password, stored);
  }

  async verifyApiPassword(password: string): Promise<boolean> {
    if (!(await this.isApiAuthEnabled())) {
      return true;
    }
    if (this.config.apiPasswordEnv !== null) {
      return timingSafeEqualString(password, this.config.apiPasswordEnv);
    }
    const stored = (await this.loadStoredAuthSettings()).apiPasswordHash;
    if (!stored) {
      return false;
    }
    return verifyPassword(password, stored);
  }

  async updatePanelPassword(password: string): Promise<void> {
    await this.repository.setSetting(PANEL_PASSWORD_KEY, await hashPassword(password));
    this.invalidateStoredAuthSettings();
  }

  async updateApiPassword(password: string | null): Promise<void> {
    if (password) {
      await this.repository.setSetting(API_PASSWORD_KEY, await hashPassword(password));
      this.invalidateStoredAuthSettings();
      return;
    }
    await this.repository.deleteSetting(API_PASSWORD_KEY);
    this.invalidateStoredAuthSettings();
  }

  async createAdminSession(): Promise<{ sessionId: string; expiresAt: number }> {
    const sessionId = makeSessionId();
    const expiresAt = nowSeconds() + this.config.adminSessionTtlSeconds;
    await this.repository.createAdminSession(sessionId, expiresAt);
    return { sessionId, expiresAt };
  }

  async verifyAdminSession(sessionId: string | null): Promise<boolean> {
    if (!sessionId) {
      return false;
    }
    const session = await this.repository.getAdminSession(sessionId);
    if (!session) {
      return false;
    }
    if (session.expires_at <= nowSeconds()) {
      await this.repository.deleteAdminSession(sessionId);
      return false;
    }
    return true;
  }

  async deleteAdminSession(sessionId: string | null): Promise<void> {
    if (!sessionId) {
      return;
    }
    await this.repository.deleteAdminSession(sessionId);
  }

  extractApiPassword(request: Request): string | null {
    const authHeader = request.headers.get("authorization");
    if (authHeader) {
      const [scheme, value] = authHeader.split(/\s+/, 2);
      if (scheme?.toLowerCase() === "bearer" && value) {
        return value.trim();
      }
    }
    const apiKey = request.headers.get("x-api-key");
    if (apiKey) {
      return apiKey.trim();
    }
    return null;
  }

  async getAdminRateLimit(action: AdminAuthAction, actorKey: string): Promise<{ locked: boolean; retryAfterSeconds: number; failedCount: number }> {
    const now = nowSeconds();
    const state = await this.loadAdminRateLimitState(action, actorKey);
    if (!state) {
      return { locked: false, retryAfterSeconds: 0, failedCount: 0 };
    }
    if (state.lockedUntil && state.lockedUntil > now) {
      return {
        locked: true,
        retryAfterSeconds: Math.max(1, state.lockedUntil - now),
        failedCount: state.failedCount,
      };
    }
    if (state.firstFailedAt + this.config.adminAuthWindowSeconds <= now) {
      await this.clearAdminRateLimit(action, actorKey);
      return { locked: false, retryAfterSeconds: 0, failedCount: 0 };
    }
    return { locked: false, retryAfterSeconds: 0, failedCount: state.failedCount };
  }

  async recordAdminFailure(
    action: AdminAuthAction,
    actorKey: string,
  ): Promise<{ locked: boolean; retryAfterSeconds: number; failedCount: number }> {
    const now = nowSeconds();
    const existing = await this.loadAdminRateLimitState(action, actorKey);
    const withinWindow = existing && existing.firstFailedAt + this.config.adminAuthWindowSeconds > now;
    const failedCount = (withinWindow ? existing.failedCount : 0) + 1;
    const lockedUntil = failedCount >= this.config.adminAuthMaxAttempts ? now + this.config.adminAuthLockSeconds : null;
    await this.saveAdminRateLimitState(action, actorKey, {
      failedCount,
      firstFailedAt: withinWindow && existing ? existing.firstFailedAt : now,
      lockedUntil,
    });
    return {
      locked: lockedUntil !== null,
      retryAfterSeconds: lockedUntil === null ? 0 : Math.max(1, lockedUntil - now),
      failedCount,
    };
  }

  async clearAdminFailures(action: AdminAuthAction, actorKey: string): Promise<void> {
    await this.clearAdminRateLimit(action, actorKey);
  }

  private adminRateLimitKey(action: AdminAuthAction, actorKey: string): string {
    return `admin_auth_rate_limit:${action}:${actorKey}`;
  }

  private async loadAdminRateLimitState(action: AdminAuthAction, actorKey: string): Promise<AdminRateLimitState | null> {
    const raw = await this.repository.getSetting(this.adminRateLimitKey(action, actorKey));
    const state = safeJsonParse<AdminRateLimitState>(raw);
    if (!state || !Number.isFinite(state.failedCount) || !Number.isFinite(state.firstFailedAt)) {
      return null;
    }
    return {
      failedCount: Math.max(0, Math.trunc(state.failedCount)),
      firstFailedAt: Math.max(0, Math.trunc(state.firstFailedAt)),
      lockedUntil: state.lockedUntil === null || state.lockedUntil === undefined ? null : Math.max(0, Math.trunc(state.lockedUntil)),
    };
  }

  private async saveAdminRateLimitState(action: AdminAuthAction, actorKey: string, state: AdminRateLimitState): Promise<void> {
    await this.repository.setSetting(this.adminRateLimitKey(action, actorKey), JSON.stringify(state));
  }

  private async clearAdminRateLimit(action: AdminAuthAction, actorKey: string): Promise<void> {
    await this.repository.deleteSetting(this.adminRateLimitKey(action, actorKey));
  }

  private async loadStoredAuthSettings(): Promise<StoredAuthSettings> {
    if (this.storedAuthSettingsPromise === null) {
      const keys: string[] = [];
      if (this.config.panelPasswordEnv === null) {
        keys.push(PANEL_PASSWORD_KEY);
      }
      if (this.config.apiPasswordEnv === null) {
        keys.push(API_PASSWORD_KEY);
      }
      this.storedAuthSettingsPromise = (async () => {
        const stored = await this.repository.getSettings(keys);
        return {
          panelPasswordHash: stored[PANEL_PASSWORD_KEY] ?? null,
          apiPasswordHash: stored[API_PASSWORD_KEY] ?? null,
        };
      })();
    }
    return this.storedAuthSettingsPromise;
  }

  private invalidateStoredAuthSettings(): void {
    this.storedAuthSettingsPromise = null;
  }
}
